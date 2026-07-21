export type ClerkIdentity = {
  id: string;
};

export type IdentityDependencies<T extends ClerkIdentity> = {
  getAuth: () => Promise<{ userId: string | null }>;
  getCurrentUser: () => Promise<T | null>;
};

const MISSING_USER_ERROR_CODES = new Set([
  "resource_not_found",
  "user_not_found",
]);

function isClerkAPIResponseErrorShape(
  error: unknown,
): error is {
  status: number;
  errors: Array<{ code?: string }>;
} {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    status?: unknown;
    errors?: unknown;
    isClerkAPIResponseError?: () => boolean;
    constructor?: { kind?: unknown };
  };
  let hasClerkTypeMarker = candidate.constructor?.kind === "ClerkAPIResponseError";
  if (!hasClerkTypeMarker && candidate.isClerkAPIResponseError) {
    try {
      hasClerkTypeMarker = candidate.isClerkAPIResponseError() === true;
    } catch {
      return false;
    }
  }

  return (
    hasClerkTypeMarker &&
    typeof candidate.status === "number" &&
    Array.isArray(candidate.errors)
  );
}

export function isConfirmedMissingClerkUserError(error: unknown) {
  if (!isClerkAPIResponseErrorShape(error) || error.status !== 404) {
    return false;
  }

  const codes = error.errors.map(({ code }) => code);
  return (
    codes.length > 0 &&
    codes.every((code) => MISSING_USER_ERROR_CODES.has(code ?? ""))
  );
}

export async function resolveClerkIdentity<T extends ClerkIdentity>(
  dependencies: IdentityDependencies<T>,
): Promise<T | null> {
  const { userId } = await dependencies.getAuth();
  if (!userId) return null;

  try {
    const clerkUser = await dependencies.getCurrentUser();
    if (!clerkUser || clerkUser.id !== userId) {
      return null;
    }
    return clerkUser;
  } catch (error) {
    if (isConfirmedMissingClerkUserError(error)) {
      return null;
    }
    throw error;
  }
}
