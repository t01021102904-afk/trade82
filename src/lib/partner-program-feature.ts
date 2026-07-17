import "server-only";

export type PartnerProgramMode = "off" | "on";

// Enrollment and attribution are deliberately opt-in. Whitespace is harmless,
// but every other value fails closed.
export function getPartnerProgramMode(
  value = process.env.PARTNER_PROGRAM_MODE,
): PartnerProgramMode {
  return value?.trim() === "on" ? "on" : "off";
}

export function isPartnerProgramEnabled(value = process.env.PARTNER_PROGRAM_MODE) {
  return getPartnerProgramMode(value) === "on";
}
