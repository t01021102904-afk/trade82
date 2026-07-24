"use client";

import { useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";

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
  partnerProfile: { id: string; status: string } | null;
  unreadMessageCount?: number;
};

type UserContextResponse = Omit<UserContext, "clerkUserId">;

const contextByUserId = new Map<string, UserContext>();
const requestsByUserId = new Map<string, Promise<UserContext | null>>();
const contextGenerationByUserId = new Map<string, number>();

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function loadUserContext(userId: string, force = false) {
  const cached = contextByUserId.get(userId);
  if (cached) return Promise.resolve(cached);

  const pending = requestsByUserId.get(userId);
  if (pending && !force) return pending;
  const generation = contextGenerationByUserId.get(userId) ?? 0;

  const request = fetch("/api/user/context", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        if (isDevelopment()) {
          console.warn(`[UserContext] Context request returned HTTP ${response.status}.`);
        }
        return null;
      }
      const value = (await response.json()) as UserContextResponse;
      const context = { ...value, clerkUserId: userId };
      if ((contextGenerationByUserId.get(userId) ?? 0) === generation) {
        contextByUserId.set(userId, context);
      }
      return context;
    })
    .catch((error: unknown) => {
      if (isDevelopment()) {
        console.error(
          "[UserContext] Context request failed.",
          error instanceof Error ? error.message : "Unknown error",
        );
      }
      return null;
    })
    .finally(() => {
      if (requestsByUserId.get(userId) === request) {
        requestsByUserId.delete(userId);
      }
    });

  requestsByUserId.set(userId, request);
  return request;
}

export function invalidateUserContext(userId?: string) {
  if (userId) {
    contextByUserId.delete(userId);
    contextGenerationByUserId.set(
      userId,
      (contextGenerationByUserId.get(userId) ?? 0) + 1,
    );
    return;
  }
  contextByUserId.clear();
  for (const userId of requestsByUserId.keys()) {
    contextGenerationByUserId.set(
      userId,
      (contextGenerationByUserId.get(userId) ?? 0) + 1,
    );
  }
}

export function refreshUserContext(userId: string | undefined) {
  if (!userId) return Promise.resolve(null);
  invalidateUserContext(userId);
  return loadUserContext(userId, true);
}

export function useUserContext() {
  const { isLoaded, isSignedIn, user } = useUser();
  const userId = isLoaded && isSignedIn ? user?.id : undefined;
  const [context, setContext] = useState<UserContext | null>(null);
  const previousUserId = useRef<string | undefined>(undefined);
  const cachedContext = userId ? contextByUserId.get(userId) : null;
  const activeContext =
    cachedContext ?? (context?.clerkUserId === userId ? context : null);

  useEffect(() => {
    if (!isLoaded) return;

    if (previousUserId.current && previousUserId.current !== userId) {
      invalidateUserContext(previousUserId.current);
    }
    if (!userId) {
      previousUserId.current = undefined;
      return;
    }
    previousUserId.current = userId;

    const cached = contextByUserId.get(userId);
    if (cached) return;

    let active = true;
    void loadUserContext(userId).then((value) => {
      if (active) setContext(value);
    });

    return () => {
      active = false;
    };
  }, [isLoaded, userId]);

  const refresh = useCallback(async () => {
    const value = await refreshUserContext(userId);
    setContext(value);
    return value;
  }, [userId]);

  return {
    context: activeContext,
    isLoaded,
    isSignedIn,
    user,
    userId,
    refreshUserContext: refresh,
  };
}
