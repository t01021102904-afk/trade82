import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";

import {
  resolveClerkIdentity,
  type IdentityDependencies,
} from "@/lib/clerk-identity-resolver";

export type ResolvedClerkUser = NonNullable<
  Awaited<ReturnType<typeof currentUser>>
>;

export type ClerkIdentityDependencies = IdentityDependencies<ResolvedClerkUser>;

export { isConfirmedMissingClerkUserError } from "@/lib/clerk-identity-resolver";

export function resolveCurrentClerkUser(): Promise<ResolvedClerkUser | null> {
  return resolveClerkIdentity<ResolvedClerkUser>({
    getAuth: auth,
    getCurrentUser: currentUser,
  });
}
