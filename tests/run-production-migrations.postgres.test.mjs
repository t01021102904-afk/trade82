import assert from "node:assert/strict";
import { test } from "node:test";

import { Client } from "pg";

import { queryTargetSchema } from "../scripts/run-production-migrations.mjs";

const databaseUrl = process.env.PRODUCTION_MIGRATION_TEST_DATABASE_URL;

function isDisposableLocalDatabase(url) {
  if (!url) return false;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  return ["127.0.0.1", "localhost", "::1"].includes(host)
    && databaseName.startsWith("trade82_preflight_test_");
}

test("target enum preflight accepts required admin values alongside unrelated values", {
  skip: !isDisposableLocalDatabase(databaseUrl),
  concurrency: false,
}, async () => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('DROP TYPE IF EXISTS public."SettlementEventType"');
    await client.query(`
      CREATE TYPE public."SettlementEventType" AS ENUM (
        'PAYMENT_REQUEST_CREATED',
        'PAYMENT_REQUEST_PAID',
        'ADMIN_APPROVED',
        'ADMIN_HELD',
        'ADMIN_REEVALUATED',
        'TRANSFER_RETRY_SCHEDULED',
        'REFUND_RECORDED',
        'DISPUTE_OPENED'
      )
    `);

    const evidence = await queryTargetSchema(client);
    assert.equal(evidence.target_enum_values, true);
  } finally {
    await client.query('DROP TYPE IF EXISTS public."SettlementEventType"');
    await client.end();
  }
});

for (const missingLabel of ["ADMIN_APPROVED", "ADMIN_HELD", "ADMIN_REEVALUATED"]) {
  test(`target enum preflight rejects a missing ${missingLabel} value`, {
    skip: !isDisposableLocalDatabase(databaseUrl),
    concurrency: false,
  }, async () => {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
      const labels = [
        "ADMIN_APPROVED",
        "ADMIN_HELD",
        "ADMIN_REEVALUATED",
        "PAYMENT_REQUEST_PAID",
        "TRANSFER_RETRY_SCHEDULED",
      ].filter((label) => label !== missingLabel);
      const sqlLabels = labels.map((label) => `'${label}'`).join(",\n        ");
      await client.query('DROP TYPE IF EXISTS public."SettlementEventType"');
      await client.query(`
        CREATE TYPE public."SettlementEventType" AS ENUM (
          ${sqlLabels}
        )
      `);

      const evidence = await queryTargetSchema(client);
      assert.equal(evidence.target_enum_values, false);
    } finally {
      await client.query('DROP TYPE IF EXISTS public."SettlementEventType"');
      await client.end();
    }
  });
}
