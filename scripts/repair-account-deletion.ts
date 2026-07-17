import "server-only";

import {
  cleanupTrade82AccountData,
  markAccountDeletionPending,
} from "@/lib/account-deletion";
import { getDb } from "@/lib/db";

type Arguments = {
  userProfileId?: string;
  clerkUserId?: string;
  execute: boolean;
  confirmClerkDeleted: boolean;
};

function readArguments(argv: string[]): Arguments {
  const valueAfter = (flag: string) => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const userProfileId = valueAfter("--user-profile-id");
  const clerkUserId = valueAfter("--clerk-user-id");
  if (Boolean(userProfileId) === Boolean(clerkUserId)) {
    throw new Error("Provide exactly one of --user-profile-id or --clerk-user-id.");
  }
  return {
    userProfileId,
    clerkUserId,
    execute: argv.includes("--execute"),
    confirmClerkDeleted: argv.includes("--confirm-clerk-deleted"),
  };
}

async function main() {
  const args = readArguments(process.argv.slice(2));
  const db = getDb();
  const profile = await db.userProfile.findFirst({
    where: args.userProfileId ? { id: args.userProfileId } : { clerkUserId: args.clerkUserId },
    select: {
      id: true,
      clerkUserId: true,
      deletionStatus: true,
      companies: { select: { id: true, products: { select: { id: true } } } },
      partnerProfile: { select: { id: true } },
      _count: { select: { createdPaymentRequests: true, tradeOrderEvents: true, sellerPayoutEvents: true } },
    },
  });
  if (!profile) throw new Error("No matching user profile was found.");

  const summary = {
    userProfileId: profile.id,
    deletionStatus: profile.deletionStatus,
    companyCount: profile.companies.length,
    productCount: profile.companies.reduce((total, company) => total + company.products.length, 0),
    partnerProfile: Boolean(profile.partnerProfile),
    preservedFinancialEventCounts: profile._count,
  };

  if (!args.execute) {
    console.log(JSON.stringify({ mode: "dry-run", ...summary }));
    return;
  }
  if (!args.confirmClerkDeleted) {
    throw new Error("--execute requires --confirm-clerk-deleted.");
  }

  await markAccountDeletionPending(profile.id);
  const result = await cleanupTrade82AccountData({
    userProfileId: profile.id,
    clerkUserId: profile.clerkUserId,
  });
  console.log(JSON.stringify({ mode: "executed", ...summary, result }));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Account deletion repair failed.");
  process.exitCode = 1;
});
