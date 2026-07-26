import { revalidatePath } from "next/cache";

import { apiError } from "@/lib/api-response";
import {
  assertSameOrigin,
  idParam,
  rateLimitOrResponse,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  optionalFile,
  parseHomepagePromotionForm,
} from "@/lib/homepage-promotion-validation";
import { uploadHomepagePromotionFile } from "@/lib/homepage-promotion-storage";
import { softDeleteHomepagePromotion } from "@/lib/homepage-promotions";
import { deleteStorageFile } from "@/lib/supabase-storage";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const newPaths: string[] = [];
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-homepage-promotions-write",
      userId: admin.id,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;
    const id = idParam((await context.params).id);
    const existing = await getDb().homepagePromotion.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new Response("Not found.", { status: 404 });

    const form = await request.formData();
    const input = parseHomepagePromotionForm(form);
    const thumbnailFile = optionalFile(form, "thumbnailFile");
    const pdfFile = optionalFile(form, "pdfFile");
    if (input.mediaType === "IMAGE" && pdfFile) {
      throw new Response("Image promotions cannot include a PDF.", {
        status: 400,
      });
    }
    if (
      input.mediaType === "PDF" &&
      !pdfFile &&
      (!existing.pdfUrl || !existing.pdfStoragePath)
    ) {
      throw new Response("A PDF file is required.", { status: 400 });
    }

    const thumbnail = thumbnailFile
      ? await uploadHomepagePromotionFile({
          promotionId: id,
          kind: "thumbnail",
          file: thumbnailFile,
        })
      : null;
    if (thumbnail) newPaths.push(thumbnail.path);
    const pdf = pdfFile
      ? await uploadHomepagePromotionFile({
          promotionId: id,
          kind: "pdf",
          file: pdfFile,
        })
      : null;
    if (pdf) newPaths.push(pdf.path);

    const finalPdfUrl =
      input.mediaType === "PDF" ? pdf?.publicUrl ?? existing.pdfUrl : null;
    const finalPdfPath =
      input.mediaType === "PDF" ? pdf?.path ?? existing.pdfStoragePath : null;
    const obsoletePaths = [
      ...existing.pendingStorageCleanupPaths,
      ...(thumbnail ? [existing.thumbnailStoragePath] : []),
      ...(pdf && existing.pdfStoragePath ? [existing.pdfStoragePath] : []),
      ...(input.mediaType === "IMAGE" && existing.pdfStoragePath
        ? [existing.pdfStoragePath]
        : []),
    ].filter((path, index, paths) => path && paths.indexOf(path) === index);

    const updated = await getDb().homepagePromotion.update({
      where: { id },
      data: {
        adminTitle: input.adminTitle,
        altTextEn: input.altTextEn,
        altTextKo: input.altTextKo,
        mediaType: input.mediaType,
        thumbnailUrl: thumbnail?.publicUrl ?? existing.thumbnailUrl,
        thumbnailStoragePath:
          thumbnail?.path ?? existing.thumbnailStoragePath,
        pdfUrl: finalPdfUrl,
        pdfStoragePath: finalPdfPath,
        destinationUrl:
          input.usePdfAsDestination && finalPdfUrl
            ? finalPdfUrl
            : input.destinationUrl,
        openInNewTab: input.openInNewTab,
        isActive: input.isActive,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        pendingStorageCleanupPaths: obsoletePaths,
      },
    });

    await finishPendingCleanup(id, obsoletePaths);
    revalidatePromotionPages();
    return Response.json(updated);
  } catch (error) {
    await cleanupPaths(newPaths, "replacement rollback");
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "admin-homepage-promotions-write",
      userId: admin.id,
      limit: 40,
      windowMs: 60 * 60_000,
    });
    if (rateLimited) return rateLimited;
    const id = idParam((await context.params).id);
    const deleted = await softDeleteHomepagePromotion(id);
    const paths = [
      deleted.thumbnailStoragePath,
      deleted.pdfStoragePath,
      ...deleted.pendingStorageCleanupPaths,
    ].filter((path): path is string => Boolean(path));

    try {
      await Promise.all(paths.map((path) => deleteStorageFile(path, "public")));
      await getDb().homepagePromotion.delete({ where: { id } });
      revalidatePromotionPages();
      return Response.json({ ok: true, cleanupPending: false });
    } catch (error) {
      console.error("Homepage promotion delete cleanup pending.", {
        name: error instanceof Error ? error.name : typeof error,
        promotionId: id,
        paths,
      });
      revalidatePromotionPages();
      return Response.json(
        { ok: true, cleanupPending: true },
        { status: 202 },
      );
    }
  } catch (error) {
    return apiError(error);
  }
}

async function finishPendingCleanup(id: string, paths: string[]) {
  if (!paths.length) return;
  try {
    await Promise.all(paths.map((path) => deleteStorageFile(path, "public")));
    await getDb().homepagePromotion.update({
      where: { id },
      data: { pendingStorageCleanupPaths: [] },
    });
  } catch (error) {
    console.error("Homepage promotion replacement cleanup pending.", {
      name: error instanceof Error ? error.name : typeof error,
      promotionId: id,
      paths,
    });
  }
}

async function cleanupPaths(paths: string[], operation: string) {
  await Promise.all(
    paths.map((path) =>
      deleteStorageFile(path, "public").catch((error: unknown) => {
        console.error("Homepage promotion storage cleanup failed.", {
          name: error instanceof Error ? error.name : typeof error,
          operation,
          path,
        });
      }),
    ),
  );
}

function revalidatePromotionPages() {
  revalidatePath("/");
  revalidatePath("/ko");
  revalidatePath("/api/public/homepage-promotions");
}
