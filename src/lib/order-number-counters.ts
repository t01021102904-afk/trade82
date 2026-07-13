import {
  formatSellerPayoutNumber,
  formatTradeOrderNumber,
} from "./trade-order-rules.ts";

type OrderNumberCounterClient = {
  orderNumberCounter: {
    upsert(args: {
      where: { year: number };
      create: { year: number; lastOrderSequence?: number; lastPayoutSequence?: number };
      update: {
        lastOrderSequence?: { increment: number };
        lastPayoutSequence?: { increment: number };
      };
      select: { lastOrderSequence: true; lastPayoutSequence: true };
    }): Promise<{ lastOrderSequence: number; lastPayoutSequence: number }>;
  };
};

// These upserts are invoked inside the enclosing serializable order/payout
// transactions. The database's unique year key makes concurrent allocation
// atomic, while this small module remains independently testable.
export async function nextTradeOrderNumber(
  tx: OrderNumberCounterClient,
  now = new Date(),
) {
  const year = now.getUTCFullYear();
  const counter = await tx.orderNumberCounter.upsert({
    where: { year },
    create: { year, lastOrderSequence: 1 },
    update: { lastOrderSequence: { increment: 1 } },
    select: { lastOrderSequence: true, lastPayoutSequence: true },
  });
  return formatTradeOrderNumber(year, counter.lastOrderSequence);
}

export async function nextSellerPayoutNumber(
  tx: OrderNumberCounterClient,
  now = new Date(),
) {
  const year = now.getUTCFullYear();
  const counter = await tx.orderNumberCounter.upsert({
    where: { year },
    create: { year, lastPayoutSequence: 1 },
    update: { lastPayoutSequence: { increment: 1 } },
    select: { lastOrderSequence: true, lastPayoutSequence: true },
  });
  return formatSellerPayoutNumber(year, counter.lastPayoutSequence);
}
