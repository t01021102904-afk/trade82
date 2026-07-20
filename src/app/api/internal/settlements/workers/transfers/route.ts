import { runSettlementTransferBatch } from "@/lib/settlement-operations-control-plane";
import { hasSettlementWorkerAuthorization } from "@/lib/settlement-worker-auth";
import { getStripeConnectTransferExecutionMode } from "@/lib/stripe-connect-transfer-execution-mode";

export async function POST(request: Request) {
  if (!hasSettlementWorkerAuthorization(request)) return Response.json({ ok: false, status: "unauthorized" }, { status: 401 });
  if (getStripeConnectTransferExecutionMode() !== "auto") return Response.json({ ok: false, status: "disabled" }, { status: 403 });
  try {
    const result = await runSettlementTransferBatch({ batchSize: 20 });
    return Response.json({ ok: true, worker: "transfers", ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, status: "worker_failed", errorCode: "worker_failed" }, { status: 500 });
  }
}
