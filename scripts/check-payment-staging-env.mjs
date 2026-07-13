#!/usr/bin/env node

// This preflight intentionally reads only the current process environment. Export
// an isolated staging environment before running it; do not rely on local .env files.
const errors = [];

function mask(value) {
  if (!value) return "missing";
  if (value.length <= 8) return "configured";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function requireValue(name) {
  const value = process.env[name]?.trim();
  if (!value) errors.push(`${name} is required.`);
  return value ?? "";
}

function parseUrl(name, value, allowedProtocols) {
  try {
    const url = new URL(value);
    if (!allowedProtocols.includes(url.protocol)) {
      errors.push(`${name} must use ${allowedProtocols.join(" or ")}.`);
      return null;
    }
    return url;
  } catch {
    errors.push(`${name} is not a valid URL.`);
    return null;
  }
}

function supabaseProjectFromDatabaseUrl(url) {
  const username = decodeURIComponent(url.username);
  const parts = username.split(".");
  return parts.length > 1 ? parts.at(-1) ?? null : null;
}

function isKnownProductionVercelHost(hostname) {
  if (!hostname.endsWith(".vercel.app")) return false;
  // Vercel Preview URLs contain the Git deployment marker. A bare project URL is
  // ambiguous and must be treated as production/unknown for a migration task.
  return !hostname.includes("-git-");
}

const environment = process.env.TRADE82_ENVIRONMENT?.trim();
const nodeEnvironment = process.env.NODE_ENV?.trim() || "unset";
const vercelEnvironment = process.env.VERCEL_ENV?.trim();
const vercelTargetEnvironment = process.env.VERCEL_TARGET_ENV?.trim();

if (environment !== "staging") {
  errors.push("TRADE82_ENVIRONMENT must be exactly staging.");
}
if (nodeEnvironment === "production") {
  errors.push("NODE_ENV must not be production for a staging migration.");
}
if (vercelEnvironment === "production" || vercelTargetEnvironment === "production") {
  errors.push("Vercel environment indicates production.");
}

const stagingProject = requireValue("TRADE82_STAGING_SUPABASE_PROJECT");
const databaseUrl = requireValue("DATABASE_URL");
const directUrl = requireValue("DIRECT_URL");
const supabaseUrl = requireValue("NEXT_PUBLIC_SUPABASE_URL");
const stripeSecretKey = requireValue("STRIPE_SECRET_KEY");
const stripePublishableKey = requireValue("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
const stripeWebhookSecret = requireValue("STRIPE_WEBHOOK_SECRET");
const appUrl = requireValue("NEXT_PUBLIC_APP_URL");

const database = databaseUrl
  ? parseUrl("DATABASE_URL", databaseUrl, ["postgresql:", "postgres:"])
  : null;
const direct = directUrl
  ? parseUrl("DIRECT_URL", directUrl, ["postgresql:", "postgres:"])
  : null;
const supabase = supabaseUrl
  ? parseUrl("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl, ["https:"])
  : null;
const application = appUrl
  ? parseUrl("NEXT_PUBLIC_APP_URL", appUrl, ["https:"])
  : null;

if (stripeSecretKey && !/^sk_test_/.test(stripeSecretKey)) {
  errors.push(
    /^sk_live_/.test(stripeSecretKey)
      ? "STRIPE_SECRET_KEY is a live-mode key."
      : "STRIPE_SECRET_KEY must be a Stripe test-mode key.",
  );
}
if (stripePublishableKey && !/^pk_test_/.test(stripePublishableKey)) {
  errors.push(
    /^pk_live_/.test(stripePublishableKey)
      ? "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is a live-mode key."
      : "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a Stripe test-mode key.",
  );
}
if (stripeWebhookSecret && !/^whsec_/.test(stripeWebhookSecret)) {
  errors.push("STRIPE_WEBHOOK_SECRET is not a recognized Stripe webhook secret.");
}
if ((stripeWebhookSecret && /^whsec_live_/i.test(stripeWebhookSecret)) || process.env.STRIPE_WEBHOOK_ENV === "production") {
  errors.push("Stripe webhook configuration indicates production.");
}

const databaseProject = database ? supabaseProjectFromDatabaseUrl(database) : null;
const directProject = direct ? supabaseProjectFromDatabaseUrl(direct) : null;
const supabaseProject = supabase?.hostname.endsWith(".supabase.co")
  ? supabase.hostname.split(".")[0]
  : null;

if (database && !databaseProject) {
  errors.push("DATABASE_URL does not expose a Supabase project reference for verification.");
}
if (direct && !directProject) {
  errors.push("DIRECT_URL does not expose a Supabase project reference for verification.");
}
if (supabase && !supabaseProject) {
  errors.push("NEXT_PUBLIC_SUPABASE_URL is not a Supabase project URL.");
}
for (const [name, project] of [
  ["DATABASE_URL", databaseProject],
  ["DIRECT_URL", directProject],
  ["NEXT_PUBLIC_SUPABASE_URL", supabaseProject],
]) {
  if (project && stagingProject && project !== stagingProject) {
    errors.push(`${name} does not match TRADE82_STAGING_SUPABASE_PROJECT.`);
  }
}

if (application) {
  const hostname = application.hostname.toLowerCase();
  if (hostname === "trade82.com" || hostname === "www.trade82.com") {
    errors.push("NEXT_PUBLIC_APP_URL points to the production Trade82 domain.");
  }
  if (isKnownProductionVercelHost(hostname)) {
    errors.push("NEXT_PUBLIC_APP_URL is an ambiguous or production Vercel URL.");
  }
}

console.log("Trade82 payment staging environment check");
console.log(`TRADE82_ENVIRONMENT: ${environment || "missing"}`);
console.log(`NODE_ENV: ${nodeEnvironment}`);
console.log(`Vercel environment: ${vercelEnvironment || "unset"}`);
console.log(`Database host: ${database?.host || "unavailable"}`);
console.log(`Direct database host: ${direct?.host || "unavailable"}`);
console.log(`Supabase project: ${mask(supabaseProject)}`);
console.log(`Database project: ${mask(databaseProject)}`);
console.log(`Direct database project: ${mask(directProject)}`);
console.log(`App host: ${application?.host || "unavailable"}`);
console.log(`Stripe secret mode: ${/^sk_test_/.test(stripeSecretKey) ? "test" : "not-test"}`);
console.log(`Stripe webhook secret: ${/^whsec_/.test(stripeWebhookSecret) ? "present (mode cannot be inferred from a secret)" : "invalid or missing"}`);

if (errors.length) {
  console.error("Staging payment environment check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Staging payment environment check passed. This script does not run migrations.");
}
