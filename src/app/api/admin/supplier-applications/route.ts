import { SupplierApplicationStatus } from "@/generated/prisma/client";
import { apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authz";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const statusValue = new URL(request.url).searchParams.get("status");
    if (
      statusValue &&
      !Object.values(SupplierApplicationStatus).includes(
        statusValue as SupplierApplicationStatus,
      )
    ) {
      throw new Response("status is invalid.", { status: 400 });
    }
    const status =
      statusValue &&
      Object.values(SupplierApplicationStatus).includes(
        statusValue as SupplierApplicationStatus,
      )
        ? (statusValue as SupplierApplicationStatus)
        : undefined;
    const [applications, reviewers] = await Promise.all([
      getDb().supplierApplication.findMany({
        where: status ? { status } : undefined,
        select: {
          id: true,
          applicationNumber: true,
          legalCompanyName: true,
          tradeName: true,
          registrationCountry: true,
          websiteDomain: true,
          status: true,
          statusReason: true,
          riskLevel: true,
          submittedAt: true,
          updatedAt: true,
          applicant: { select: { displayName: true, email: true } },
          assignedAdmin: {
            select: { id: true, displayName: true, email: true },
          },
          _count: {
            select: {
              documents: true,
              inventorySamples: true,
              duplicateFlags: true,
              informationRequests: true,
            },
          },
        },
        orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
        take: 200,
      }),
      getDb().userProfile.findMany({
        where: { role: "admin", deletedAt: null },
        select: { id: true, displayName: true, email: true },
        orderBy: { displayName: "asc" },
      }),
    ]);
    return Response.json(
      { applications, reviewers },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
