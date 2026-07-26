import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { apiError } from "@/lib/api-response";
import {
  assertSameOrigin,
  rateLimitOrResponse,
} from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import {
  optionalFile,
  parseHomepagePromotionForm,
} from "@/lib/homepage-promotion-validation";
import { uploadHomepagePromotionFile } from "@/lib/homepage-promotion-storage";
import {
  createHomepagePromotion,
  listAdminHomepagePromotions,
} from "@/lib/homepage-promotions";
import { deleteStorageFile } from "@/lib/supabase-storage";

export async function GET() {
  try {
    await requireAdmin();
    return Response.json(await listAdminHomepagePromotions(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const uploadedPaths: string[] = [];
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

    const form = await request.formData();
    const input = parseHomepagePromotionForm(form);
    const thumbnailFile = optionalFile(form, "thumbnailFile");
    const pdfFile = optionalFile(form, "pdfFile");
    if (!thumbnailFile) {
      throw new Response("A thumbnail image is required.", { status: 400 });
    }
    if (input.mediaType === "PDF" && !pdfFile) {
      throw new Response("A PDF file is required.", { status: 400 });
    }
    if (input.mediaType === "IMAGE" && pdfFile) {
      throw new Response("Image promotions cannot include a PDF.", {
        status: 400,
      });
    }

    const id = randomUUID();
    const thumbnail = await uploadHomepagePromotionFile({
      promotionId: id,
      kind: "thumbnail",
      file: thumbnailFile,
    });
    uploadedPaths.push(thumbnail.path);
    const pdf = pdfFile
      ? await uploadHomepagePromotionFile({
          promotionId: id,
          kind: "pdf",
          file: pdfFile,
        })
      : null;
    if (pdf) uploadedPaths.push(pdf.path);

    const promotion = await createHomepagePromotion({
      id,
      adminTitle: input.adminTitle,
      altTextEn: input.altTextEn,
      altTextKo: input.altTextKo,
      mediaType: input.mediaType,
      thumbnailUrl: thumbnail.publicUrl,
      thumbnailStoragePath: thumbnail.path,
      pdfUrl: pdf?.publicUrl ?? null,
      pdfStoragePath: pdf?.path ?? null,
      destinationUrl:
        input.usePdfAsDestination && pdf
          ? pdf.publicUrl
          : input.destinationUrl,
      openInNewTab: input.openInNewTab,
      isActive: input.isActive,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      createdByUserId: admin.id,
    });

    revalidatePromotionPages();
    return Response.json(promotion, { status: 201 });
  } catch (error) {
    await cleanupNewUploads(uploadedPaths);
    return apiError(error);
  }
}

async function cleanupNewUploads(paths: string[]) {
  await Promise.all(
    paths.map((path) =>
      deleteStorageFile(path, "public").catch((error: unknown) => {
        console.error("Homepage promotion upload rollback failed.", {
          name: error instanceof Error ? error.name : typeof error,
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
