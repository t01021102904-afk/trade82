import assert from "node:assert/strict";
import { test } from "node:test";

import { Client } from "pg";

import {
  queryMerchantMigrationInitialState,
  queryMerchantMigrationPreflight,
  queryMerchantMigrationSchema,
  queryTargetSchema,
} from "../scripts/run-production-migrations.mjs";

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
    await client.query("BEGIN");
    await client.query('DROP TYPE IF EXISTS public."SettlementEventType" CASCADE');
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
    await client.query("ROLLBACK");
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
      await client.query("BEGIN");
      const labels = [
        "ADMIN_APPROVED",
        "ADMIN_HELD",
        "ADMIN_REEVALUATED",
        "PAYMENT_REQUEST_PAID",
        "TRANSFER_RETRY_SCHEDULED",
      ].filter((label) => label !== missingLabel);
      const sqlLabels = labels.map((label) => `'${label}'`).join(",\n        ");
      await client.query('DROP TYPE IF EXISTS public."SettlementEventType" CASCADE');
      await client.query(`
        CREATE TYPE public."SettlementEventType" AS ENUM (
          ${sqlLabels}
        )
      `);

      const evidence = await queryTargetSchema(client);
      assert.equal(evidence.target_enum_values, false);
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  });
}

test("merchant catalog checks accept the exact migrated schema and reject an extra column", {
  skip: !isDisposableLocalDatabase(databaseUrl),
  concurrency: false,
}, async () => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const durableKeys = [
    "merchant_status_enum",
    "merchant_table",
    "merchant_columns_total",
    "merchant_columns_names",
    "merchant_column_types",
    "merchant_primary_key",
    "merchant_company_unique",
    "merchant_stripe_unique",
    "merchant_status_index",
    "merchant_company_fk_restrict",
    "merchant_defaults",
    "merchant_nullability",
    "merchant_rls",
    "merchant_public_access_revoked",
  ];

  try {
    await client.query("BEGIN");
    await client.query('DROP TABLE public."SellerStripeMerchantAccount" CASCADE');
    await client.query('DROP TYPE public."SellerStripeMerchantAccountStatus"');
    const preflight = await queryMerchantMigrationPreflight(client);
    assert.equal(preflight.merchant_company_table, true);
    assert.equal(preflight.merchant_company_id_text, true);
    assert.equal(preflight.merchant_company_id_key, true);
    assert.equal(preflight.merchant_table_absent, true);
    assert.equal(preflight.merchant_status_enum_absent, true);
    assert.equal(preflight.merchant_company_index_absent, true);
    assert.equal(preflight.merchant_stripe_index_absent, true);
    assert.equal(preflight.merchant_status_index_absent, true);
    assert.equal(preflight.merchant_company_fk_absent, true);
    assert.equal(preflight.merchant_anon_role, true);
    assert.equal(preflight.merchant_authenticated_role, true);
    await client.query("ROLLBACK");

    const schema = await queryMerchantMigrationSchema(client);
    for (const key of durableKeys) assert.equal(schema[key], true, key);

    const initial = await queryMerchantMigrationInitialState(client);
    assert.equal(initial.merchant_zero_rows, true);

    await client.query("BEGIN");
    await client.query(
      'ALTER TABLE public."SellerStripeMerchantAccount" ADD COLUMN "_preflight_extra" TEXT',
    );
    const extraColumnSchema = await queryMerchantMigrationSchema(client);
    assert.equal(extraColumnSchema.merchant_columns_total, false);
    assert.equal(extraColumnSchema.merchant_columns_names, false);
    await client.query("ROLLBACK");

    const suffix = Date.now().toString(36);
    const userId = `preflight-user-${suffix}`;
    const companyId = `preflight-company-${suffix}`;
    const merchantId = `preflight-merchant-${suffix}`;
    await client.query("BEGIN");
    await client.query(`
      INSERT INTO public."UserProfile"
        ("id", "clerkUserId", "email", "displayName", "role", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 'seller', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [userId, userId, `${userId}@example.test`, "Preflight seller"]);
    await client.query(`
      INSERT INTO public."Company"
        ("id", "ownerUserId", "companyRole", "legalName", "country", "businessAddress", "updatedAt")
      VALUES ($1, $2, 'seller', $3, 'KR', 'Seoul', CURRENT_TIMESTAMP)
    `, [companyId, userId, `Preflight company ${suffix}`]);
    await client.query(`
      INSERT INTO public."SellerStripeMerchantAccount"
        ("id", "companyId", "stripeAccountId", "country", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, 'KR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [merchantId, companyId, `acct_preflight_${suffix}`]);
    const populatedInitial = await queryMerchantMigrationInitialState(client);
    assert.equal(populatedInitial.merchant_zero_rows, false);
    const populatedSchema = await queryMerchantMigrationSchema(client);
    for (const key of durableKeys) assert.equal(populatedSchema[key], true, key);
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
});

test("merchant catalog checks reject unsafe indexes, foreign keys, privileges, and RLS", {
  skip: !isDisposableLocalDatabase(databaseUrl),
  concurrency: false,
}, async () => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const mutations = [
    {
      name: "company index that is not unique",
      key: "merchant_company_unique",
      sql: async () => {
        await client.query('DROP INDEX public."SellerStripeMerchantAccount_companyId_key"');
        await client.query(
          'CREATE INDEX "SellerStripeMerchantAccount_companyId_key" ON public."SellerStripeMerchantAccount"("companyId")',
        );
      },
    },
    {
      name: "company index that is partial",
      key: "merchant_company_unique",
      sql: async () => {
        await client.query('DROP INDEX public."SellerStripeMerchantAccount_companyId_key"');
        await client.query(
          'CREATE UNIQUE INDEX "SellerStripeMerchantAccount_companyId_key" ON public."SellerStripeMerchantAccount"("companyId") WHERE "companyId" IS NOT NULL',
        );
      },
    },
    {
      name: "stripe account index on the wrong column",
      key: "merchant_stripe_unique",
      sql: async () => {
        await client.query('DROP INDEX public."SellerStripeMerchantAccount_stripeAccountId_key"');
        await client.query(
          'CREATE UNIQUE INDEX "SellerStripeMerchantAccount_stripeAccountId_key" ON public."SellerStripeMerchantAccount"("country")',
        );
      },
    },
    {
      name: "stripe account index that is partial",
      key: "merchant_stripe_unique",
      sql: async () => {
        await client.query('DROP INDEX public."SellerStripeMerchantAccount_stripeAccountId_key"');
        await client.query(
          'CREATE UNIQUE INDEX "SellerStripeMerchantAccount_stripeAccountId_key" ON public."SellerStripeMerchantAccount"("stripeAccountId") WHERE "stripeAccountId" IS NOT NULL',
        );
      },
    },
    {
      name: "status index in the wrong order",
      key: "merchant_status_index",
      sql: async () => {
        await client.query('DROP INDEX public."SellerStripeMerchantAccount_status_updatedAt_idx"');
        await client.query(
          'CREATE INDEX "SellerStripeMerchantAccount_status_updatedAt_idx" ON public."SellerStripeMerchantAccount"("updatedAt", "status")',
        );
      },
    },
    {
      name: "status index that is partial",
      key: "merchant_status_index",
      sql: async () => {
        await client.query('DROP INDEX public."SellerStripeMerchantAccount_status_updatedAt_idx"');
        await client.query(
          'CREATE INDEX "SellerStripeMerchantAccount_status_updatedAt_idx" ON public."SellerStripeMerchantAccount"("status", "updatedAt") WHERE "status" IS NOT NULL',
        );
      },
    },
    {
      name: "company index that is not btree",
      key: "merchant_company_unique",
      sql: async () => {
        await client.query('DROP INDEX public."SellerStripeMerchantAccount_companyId_key"');
        await client.query(
          'CREATE INDEX "SellerStripeMerchantAccount_companyId_key" ON public."SellerStripeMerchantAccount" USING hash ("companyId")',
        );
      },
    },
    {
      name: "foreign key with the wrong child column",
      key: "merchant_company_fk_restrict",
      sql: async () => {
        await client.query('ALTER TABLE public."SellerStripeMerchantAccount" DROP CONSTRAINT "SellerStripeMerchantAccount_companyId_fkey"');
        await client.query(`
          ALTER TABLE public."SellerStripeMerchantAccount"
          ADD CONSTRAINT "SellerStripeMerchantAccount_companyId_fkey"
          FOREIGN KEY ("stripeAccountId") REFERENCES public."Company"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE
        `);
      },
    },
    {
      name: "foreign key without restrictive delete",
      key: "merchant_company_fk_restrict",
      sql: async () => {
        await client.query('ALTER TABLE public."SellerStripeMerchantAccount" DROP CONSTRAINT "SellerStripeMerchantAccount_companyId_fkey"');
        await client.query(`
          ALTER TABLE public."SellerStripeMerchantAccount"
          ADD CONSTRAINT "SellerStripeMerchantAccount_companyId_fkey"
          FOREIGN KEY ("companyId") REFERENCES public."Company"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
        `);
      },
    },
    {
      name: "disabled row-level security",
      key: "merchant_rls",
      sql: () => client.query('ALTER TABLE public."SellerStripeMerchantAccount" DISABLE ROW LEVEL SECURITY'),
    },
    {
      name: "leaked anon select privilege",
      key: "merchant_public_access_revoked",
      sql: () => client.query('GRANT SELECT ON TABLE public."SellerStripeMerchantAccount" TO anon'),
    },
    {
      name: "leaked authenticated insert privilege",
      key: "merchant_public_access_revoked",
      sql: () => client.query('GRANT INSERT ON TABLE public."SellerStripeMerchantAccount" TO authenticated'),
    },
    {
      name: "invalid controller fees payer default",
      key: "merchant_defaults",
      sql: () => client.query(
        'ALTER TABLE public."SellerStripeMerchantAccount" ALTER COLUMN "controllerFeesPayer" SET DEFAULT \'account_invalid\'',
      ),
    },
    {
      name: "invalid controller losses payments default",
      key: "merchant_defaults",
      sql: () => client.query(
        'ALTER TABLE public."SellerStripeMerchantAccount" ALTER COLUMN "controllerLossesPayments" SET DEFAULT \'stripe_invalid\'',
      ),
    },
    {
      name: "invalid dashboard type default",
      key: "merchant_defaults",
      sql: () => client.query(
        'ALTER TABLE public."SellerStripeMerchantAccount" ALTER COLUMN "dashboardType" SET DEFAULT \'full_invalid\'',
      ),
    },
    {
      name: "boolean default changed to true",
      key: "merchant_defaults",
      sql: () => client.query(
        'ALTER TABLE public."SellerStripeMerchantAccount" ALTER COLUMN "chargesEnabled" SET DEFAULT true',
      ),
    },
    {
      name: "createdAt default shifted",
      key: "merchant_defaults",
      sql: () => client.query(
        'ALTER TABLE public."SellerStripeMerchantAccount" ALTER COLUMN "createdAt" SET DEFAULT (CURRENT_TIMESTAMP + interval \'1 minute\')',
      ),
    },
    {
      name: "unexpected updatedAt default",
      key: "merchant_defaults",
      sql: () => client.query(
        'ALTER TABLE public."SellerStripeMerchantAccount" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP',
      ),
    },
  ];

  try {
    for (const mutation of mutations) {
      await client.query("BEGIN");
      await mutation.sql();
      const evidence = await queryMerchantMigrationSchema(client);
      assert.equal(evidence[mutation.key], false, mutation.name);
      await client.query("ROLLBACK");
    }
  } finally {
    await client.end();
  }
});
