import { apiError } from "@/lib/api-response";
import {
  ApiValidationError,
  enumField,
  idParam,
  rateLimitOrResponse,
  readJsonObject,
  validationErrorResponse,
} from "@/lib/api-security";
import { requireAuth } from "@/lib/authz";
import { getDb } from "@/lib/db";

type DealAction =
  | "mark_in_progress"
  | "request_completion"
  | "confirm_completion";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const rateLimited = rateLimitOrResponse({
      request,
      scope: "deal-actions",
      userId: user.id,
      limit: 60,
      windowMs: 60 * 60_000,
      message: "Too many deal updates. Please try again shortly.",
    });
    if (rateLimited) return rateLimited;

    const { id: rawId } = await params;
    const id = idParam(rawId, "dealId");
    const body = await readJsonObject(request);
    const action = enumField(body, "action", [
      "mark_in_progress",
      "request_completion",
      "confirm_completion",
    ] satisfies DealAction[]);

    const deal = await getDb().deal.findFirst({
      where: {
        id,
        buyerCompany: { deletedAt: null },
        sellerCompany: { deletedAt: null },
        product: { deletedAt: null },
      },
      include: { buyerCompany: true, sellerCompany: true, product: true, reviews: true },
    });
    if (!deal) {
      return Response.json({ error: "Deal not found." }, { status: 404 });
    }
    if (deal.buyerCompany.ownerUserId === deal.sellerCompany.ownerUserId) {
      return Response.json({ error: "Invalid deal participants." }, { status: 400 });
    }

    const participant = await getDb().company.findFirst({
      where: {
        ownerUserId: user.id,
        deletedAt: null,
        id: { in: [deal.buyerCompanyId, deal.sellerCompanyId] },
      },
      select: { id: true, companyRole: true },
    });
    if (!participant) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (deal.dealStatus === "completed") {
      return Response.json(serializeDeal(deal));
    }
    if (deal.dealStatus === "cancelled") {
      return Response.json({ error: "Cancelled deals cannot be updated." }, { status: 400 });
    }

    const isBuyer = participant.id === deal.buyerCompanyId;
    let data:
      | {
          dealStatus: "in_progress" | "completion_requested" | "completed";
          confirmedByBuyer?: boolean;
          confirmedBySeller?: boolean;
          completedAt?: Date | null;
        }
      | null = null;

    if (action === "mark_in_progress") {
      data = { dealStatus: "in_progress" };
    }

    if (action === "request_completion") {
      data = {
        dealStatus: "completion_requested",
        confirmedByBuyer: isBuyer ? true : deal.confirmedByBuyer,
        confirmedBySeller: isBuyer ? deal.confirmedBySeller : true,
      };
    }

    if (action === "confirm_completion") {
      const confirmedByBuyer = isBuyer ? true : deal.confirmedByBuyer;
      const confirmedBySeller = isBuyer ? deal.confirmedBySeller : true;
      data = {
        dealStatus:
          confirmedByBuyer && confirmedBySeller
            ? "completed"
            : "completion_requested",
        confirmedByBuyer,
        confirmedBySeller,
        completedAt: confirmedByBuyer && confirmedBySeller ? new Date() : null,
      };
    }

    if (!data) {
      return Response.json({ error: "Invalid deal action." }, { status: 400 });
    }

    const updated = await getDb().deal.update({
      where: { id },
      data,
      include: { buyerCompany: true, sellerCompany: true, product: true, reviews: true },
    });
    return Response.json(serializeDeal(updated));
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return validationErrorResponse(error);
    }
    return apiError(error);
  }
}

function serializeDeal<T extends {
  contractFilePath: string | null;
  contractValue: { toString(): string };
  reviews: Array<{ contractValue?: { toString(): string } }>;
}>(deal: T) {
  return {
    ...deal,
    contractFilePath: undefined,
    hasContractFile: Boolean(deal.contractFilePath),
    contractValue: deal.contractValue.toString(),
    reviews: deal.reviews.map((review) => ({
      ...review,
      contractValue: review.contractValue?.toString(),
    })),
  };
}
