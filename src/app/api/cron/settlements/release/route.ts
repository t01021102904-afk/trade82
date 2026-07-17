import { releaseEligibleSettlementLegs } from "@/lib/stripe-connect-settlement-release";
import { isAuthorizedSettlementReleaseCronRequest } from "@/lib/settlement-release-cron-auth";
import { getStripeConnectTransferExecutionMode } from "@/lib/stripe-connect-transfer-execution-mode";

export async function GET(request: Request) {
  if (!isAuthorizedSettlementReleaseCronRequest(request)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const results = await releaseEligibleSettlementLegs({ batchSize: 20 });
    return Response.json(
      {
        evaluatedSettlements: results.length,
        readyLegCount: results.reduce((count, result) => count + result.readyLegIds.length, 0),
        executionMode: getStripeConnectTransferExecutionMode(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Settlement release cron failed.", error);
    return Response.json(
      { error: "Settlement release evaluation failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
