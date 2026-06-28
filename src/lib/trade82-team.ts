import "server-only";

import { isAdminEmail } from "@/lib/authz";

export function isTrade82TeamAccount(user: {
  email?: string | null;
  role?: string | null;
}) {
  return user.role === "admin" || isAdminEmail(user.email);
}
