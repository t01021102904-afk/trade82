"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import type { AccountRole } from "@/lib/types";

export type UserContext = {
  clerkUserId: string;
  role: AccountRole;
  isAdmin: boolean;
  companies: Array<{
    id: string;
    companyRole: "seller" | "buyer";
    verificationStatus: string;
    legalName: string;
    tradeName: string | null;
  }>;
  unreadMessageCount?: number;
};

type UserContextResponse = Omit<UserContext, "clerkUserId">;

const contextByUserId = new Map<string, UserContext>();
const requestsByUserId = new Map<string, Promise<UserContext | null>>();

function loadUserContext(userId: string) {
  const cached = contextByUserId.get(userId);
  if (cached) return Promise.resolve(cached);

  const pending = requestsByUserId.get(userId);
  if (pending) return pending;

  const request = fetch("/api/user/context")
    .then(async (response) => {
      if (!response.ok) return null;
      const value = (await response.json()) as UserContextResponse;
      const context = { ...value, clerkUserId: userId };
      contextByUserId.set(userId, context);
      return context;
    })
    .catch(() => null)
    .finally(() => {
      requestsByUserId.delete(userId);
    });

  requestsByUserId.set(userId, request);
  return request;
}

export function useUserContext() {
  const { isLoaded, isSignedIn, user } = useUser();
  const userId = isLoaded && isSignedIn ? user?.id : undefined;
  const [context, setContext] = useState<UserContext | null>(null);
  const cachedContext = userId ? contextByUserId.get(userId) : null;
  const activeContext =
    cachedContext ?? (context?.clerkUserId === userId ? context : null);

  useEffect(() => {
    if (!isLoaded || !userId || contextByUserId.has(userId)) return;

    let active = true;
    void loadUserContext(userId).then((value) => {
      if (active && value) setContext(value);
    });

    return () => {
      active = false;
    };
  }, [isLoaded, userId]);

  return {
    context: activeContext,
    isLoaded,
    isSignedIn,
    user,
    userId,
  };
}
