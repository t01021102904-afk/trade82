import { execFileSync } from "node:child_process";

const PRODUCTION_ENVIRONMENT = "production";
const EXPECTED_SUPABASE_PROJECT = "cjryteuoyiiwsxarblfd";

if (process.env.VERCEL_ENV !== PRODUCTION_ENVIRONMENT) {
  console.log("Production database migrations skipped.");
  process.exit(0);
}

const connectionUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionUrl) {
  console.error("Production database migrations require DIRECT_URL or DATABASE_URL.");
  process.exit(1);
}

let hostname;

try {
  const parsedUrl = new URL(connectionUrl);
  if (parsedUrl.protocol !== "postgresql:" && parsedUrl.protocol !== "postgres:") {
    throw new Error("unsupported protocol");
  }
  hostname = parsedUrl.hostname.toLowerCase();
} catch {
  console.error("Production database connection is invalid.");
  process.exit(1);
}

if (!hostname.includes(EXPECTED_SUPABASE_PROJECT)) {
  console.error("Production database is not the expected Trade82 Supabase project.");
  process.exit(1);
}

try {
  execFileSync("npm", ["run", "db:deploy"], {
    env: process.env,
    stdio: "inherit",
  });
} catch {
  console.error("Production database migrations failed.");
  process.exit(1);
}
