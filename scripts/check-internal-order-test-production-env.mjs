const PRODUCTION_SUPABASE_PROJECT = "cjryteuoyiiwsxarblfd";
const PRODUCTION_APP_ORIGIN = "https://trade82.com";
const CLERK_USER_ID_PATTERN = /^user_[A-Za-z0-9_-]{1,128}$/;

const errors = [];

function requireValue(name) {
  const value = process.env[name];
  if (!value?.trim()) errors.push(`${name} is required.`);
  return value;
}

function maskHost(hostname) {
  if (hostname.length <= 6) return "***";
  return `${hostname.slice(0, 3)}…${hostname.slice(-3)}`;
}

function inspectDatabaseUrl(name, value) {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) {
      errors.push(`${name} must use a PostgreSQL connection URL.`);
      return null;
    }
    const referenceInHost = parsed.hostname.includes(PRODUCTION_SUPABASE_PROJECT);
    const referenceInUser = decodeURIComponent(parsed.username).includes(
      PRODUCTION_SUPABASE_PROJECT,
    );
    if (!referenceInHost && !referenceInUser) {
      errors.push(`${name} does not identify the approved production Supabase project.`);
    }
    return { host: maskHost(parsed.hostname) };
  } catch {
    errors.push(`${name} is not a valid database URL.`);
    return null;
  }
}

function inspectAppUrl(value) {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.origin !== PRODUCTION_APP_ORIGIN || parsed.pathname !== "/") {
      errors.push("NEXT_PUBLIC_APP_URL must be exactly https://trade82.com.");
    }
    return parsed.hostname;
  } catch {
    errors.push("NEXT_PUBLIC_APP_URL is not a valid URL.");
    return null;
  }
}

function strictAllowlist(value) {
  if (!value) return null;
  const ids = value.split(",");
  if (!ids.length || ids.some((id) => !CLERK_USER_ID_PATTERN.test(id))) return null;
  return ids;
}

const databaseUrl = requireValue("DATABASE_URL");
const directUrl = requireValue("DIRECT_URL");
const appUrl = requireValue("NEXT_PUBLIC_APP_URL");
const allowlist = strictAllowlist(requireValue("INTERNAL_ORDER_TESTER_CLERK_IDS"));

if (process.env.TRADE82_ENVIRONMENT !== "production") {
  errors.push("TRADE82_ENVIRONMENT must be production.");
}
if (process.env.TRADE82_PRODUCTION_SUPABASE_PROJECT !== PRODUCTION_SUPABASE_PROJECT) {
  errors.push("TRADE82_PRODUCTION_SUPABASE_PROJECT does not match the approved production project.");
}
if (process.env.INTERNAL_ORDER_TEST_MODE !== "on") {
  errors.push("INTERNAL_ORDER_TEST_MODE must be exactly on.");
}
if (!allowlist) {
  errors.push("INTERNAL_ORDER_TESTER_CLERK_IDS must be a strict comma-separated Clerk user ID allowlist.");
}
if (process.env.TRADE_ORDER_SYSTEM_MODE !== "off") {
  errors.push("TRADE_ORDER_SYSTEM_MODE must remain exactly off.");
}
if (process.env.MANUAL_PAYOUT_SYSTEM_MODE !== "off") {
  errors.push("MANUAL_PAYOUT_SYSTEM_MODE must remain exactly off.");
}

const database = inspectDatabaseUrl("DATABASE_URL", databaseUrl);
const directDatabase = inspectDatabaseUrl("DIRECT_URL", directUrl);
const appHostname = inspectAppUrl(appUrl);

if (errors.length) {
  console.error("Internal order test production environment check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Internal order test production environment check passed.");
  console.log(`Supabase project: ${PRODUCTION_SUPABASE_PROJECT}`);
  console.log(`DATABASE_URL host: ${database?.host ?? "unavailable"}`);
  console.log(`DIRECT_URL host: ${directDatabase?.host ?? "unavailable"}`);
  console.log(`App hostname: ${appHostname ?? "unavailable"}`);
  console.log("Internal order test mode: on");
  console.log(`Authorized tester count: ${allowlist.length}`);
  console.log("Trade order system mode: off");
  console.log("Manual payout system mode: off");
}
