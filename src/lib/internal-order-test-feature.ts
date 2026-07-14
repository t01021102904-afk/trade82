import "server-only";

import { auth } from "@clerk/nextjs/server";

import {
  isInternalOrderTestEnabledForClerkUser,
  type InternalOrderTestEnvironment,
} from "@/lib/internal-order-test-access-rules";

function runtimeEnvironment(): InternalOrderTestEnvironment {
  return {
    INTERNAL_ORDER_TEST_MODE: process.env.INTERNAL_ORDER_TEST_MODE,
    INTERNAL_ORDER_TESTER_CLERK_IDS: process.env.INTERNAL_ORDER_TESTER_CLERK_IDS,
    TRADE_ORDER_SYSTEM_MODE: process.env.TRADE_ORDER_SYSTEM_MODE,
    MANUAL_PAYOUT_SYSTEM_MODE: process.env.MANUAL_PAYOUT_SYSTEM_MODE,
  };
}

function internalOrderTestEnabledForRuntimeUser(clerkUserId: string | null | undefined) {
  return isInternalOrderTestEnabledForClerkUser(clerkUserId, runtimeEnvironment());
}

export async function getInternalOrderTestAccess() {
  const { userId } = await auth();
  if (!internalOrderTestEnabledForRuntimeUser(userId)) return null;
  return { clerkUserId: userId as string };
}

export async function requireInternalOrderTestAccess() {
  const { userId } = await auth();
  if (!userId) throw new Response("Unauthorized", { status: 401 });
  if (!internalOrderTestEnabledForRuntimeUser(userId)) {
    throw new Response("Forbidden", { status: 403 });
  }
  return { clerkUserId: userId };
}
