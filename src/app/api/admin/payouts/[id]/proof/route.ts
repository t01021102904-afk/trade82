import crypto from "node:crypto";

import { apiError } from "@/lib/api-response";
import { idParam } from "@/lib/api-security";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  createSignedPrivateFileUrl,
  sanitizeStoredFilename,
  uploadPrivateFile,
} from "@/lib/supabase-storage";
import { isManualPayoutSystemEnabledForClerkUser } from "@/lib/trade-order-feature";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };
const allowed = new Map<string, string>([
  ["application/pdf", "pdf"], ["image/jpeg", "jpg"], ["image/png", "png"],
]);
const MAX_PROOF_BYTES = 10 * 1024 * 1024;

function fileExtension(filename: string) {
  return filename.toLowerCase().split(".").at(-1)?.trim() ?? "";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403, headers: noStore });
    const payoutId = idParam((await params).id, "payoutId");
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return Response.json({ error: "Select a payout proof file." }, { status: 400, headers: noStore });
    const extension = allowed.get(file.type.toLowerCase());
    if (!extension || ![extension, extension === "jpg" ? "jpeg" : extension].includes(fileExtension(file.name))) {
      return Response.json({ error: "Payout proof must be a PDF, JPG, or PNG file with a matching MIME type." }, { status: 400, headers: noStore });
    }
    if (!file.size || file.size > MAX_PROOF_BYTES) return Response.json({ error: "Payout proof must be no larger than 10MB." }, { status: 400, headers: noStore });
    const payout = await getDb().sellerPayout.findUnique({ where: { id: payoutId }, select: { id: true } });
    if (!payout) return Response.json({ error: "Payout not found." }, { status: 404, headers: noStore });
    const filename = `${sanitizeStoredFilename(file.name).replace(/\.[^.]+$/, "").slice(0, 90) || "payout-proof"}.${extension}`;
    const path = `payout-proofs/${payout.id}/${crypto.randomUUID()}-${filename}`;
    await uploadPrivateFile({ path, body: Buffer.from(await file.arrayBuffer()), contentType: file.type });
    await getDb().$transaction(async (tx) => {
      await tx.sellerPayout.update({ where: { id: payout.id }, data: { payoutProofStoragePath: path } });
      await tx.sellerPayoutEvent.create({ data: { payoutId: payout.id, actorUserId: user.id, eventType: "INSTRUCTIONS_EXPORTED", message: "Admin attached a private payout proof." } });
    });
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) { return apiError(error); }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    if (!isManualPayoutSystemEnabledForClerkUser(user.clerkUserId)) return Response.json({ error: "Manual payouts are not enabled for this account." }, { status: 403, headers: noStore });
    const payoutId = idParam((await params).id, "payoutId");
    const payout = await getDb().sellerPayout.findUnique({ where: { id: payoutId }, select: { payoutProofStoragePath: true } });
    if (!payout?.payoutProofStoragePath) return Response.json({ error: "Payout proof not found." }, { status: 404, headers: noStore });
    const url = await createSignedPrivateFileUrl(payout.payoutProofStoragePath, 120);
    await getDb().sellerPayoutEvent.create({ data: { payoutId, actorUserId: user.id, eventType: "INSTRUCTIONS_EXPORTED", message: "Admin opened a private payout proof." } });
    return Response.json({ url }, { headers: noStore });
  } catch (error) { return apiError(error); }
}
