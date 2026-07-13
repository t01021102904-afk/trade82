const PRODUCTION_SUPABASE_PROJECT = "cjryteuoyiiwsxarblfd";
const PRODUCTION_APP_ORIGIN = "https://trade82.com";
const VALID_PAYMENT_MODES = new Set(["off", "internal", "on"]);

const requiredVariables = [
  "TRADE82_ENVIRONMENT",
  "TRADE82_PRODUCTION_SUPABASE_PROJECT",
  "DATABASE_URL",
  "DIRECT_URL",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "MESSAGE_PAYMENT_REQUEST_MODE",
];

const errors = [];

for (const name of requiredVariables) {
  if (!process.env[name]?.trim()) errors.push(`${name} is required.`);
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
      errors.push(`${name} does not identify the required production Supabase project.`);
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
    if (/(localhost|staging|preview|vercel\.app)/i.test(parsed.hostname)) {
      errors.push("NEXT_PUBLIC_APP_URL must not point to localhost, staging, preview, or Vercel.");
    }
    return { hostname: parsed.hostname };
  } catch {
    errors.push("NEXT_PUBLIC_APP_URL is not a valid URL.");
    return null;
  }
}

if (process.env.TRADE82_ENVIRONMENT !== "production") {
  errors.push("TRADE82_ENVIRONMENT must be production.");
}
if (process.env.TRADE82_PRODUCTION_SUPABASE_PROJECT !== PRODUCTION_SUPABASE_PROJECT) {
  errors.push("TRADE82_PRODUCTION_SUPABASE_PROJECT does not match the approved production project.");
}

const database = inspectDatabaseUrl("DATABASE_URL", process.env.DATABASE_URL);
const directDatabase = inspectDatabaseUrl("DIRECT_URL", process.env.DIRECT_URL);
const app = inspectAppUrl(process.env.NEXT_PUBLIC_APP_URL);

const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
if (!secretKey.startsWith("sk_live_")) {
  errors.push("STRIPE_SECRET_KEY must be a Stripe live-mode secret key for final production launch.");
}
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
if (!publishableKey.startsWith("pk_live_")) {
  errors.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a Stripe live-mode publishable key.");
}
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
if (!webhookSecret.startsWith("whsec_")) {
  errors.push("STRIPE_WEBHOOK_SECRET must be configured as a Stripe webhook signing secret.");
}

const paymentMode = (process.env.MESSAGE_PAYMENT_REQUEST_MODE ?? "").trim().toLowerCase();
if (!VALID_PAYMENT_MODES.has(paymentMode)) {
  errors.push("MESSAGE_PAYMENT_REQUEST_MODE must be off, internal, or on.");
} else if (paymentMode !== "off") {
  errors.push("The initial production deployment must keep MESSAGE_PAYMENT_REQUEST_MODE=off.");
}

if (errors.length) {
  console.error("Payment production environment check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Payment production environment check passed.");
  console.log(`Supabase project: ${PRODUCTION_SUPABASE_PROJECT}`);
  console.log(`DATABASE_URL host: ${database?.host ?? "unavailable"}`);
  console.log(`DIRECT_URL host: ${directDatabase?.host ?? "unavailable"}`);
  console.log(`Stripe mode: live`);
  console.log(`App hostname: ${app?.hostname ?? "unavailable"}`);
  console.log(`Message payment mode: ${paymentMode}`);
}
