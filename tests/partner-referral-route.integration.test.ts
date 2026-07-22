import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, mock, test } from "node:test";

import type { PrismaClient } from "../src/generated/prisma/client.ts";

function assertDisposableDatabase() {
  const value = process.env.DATABASE_URL;
  assert.ok(value, "DATABASE_URL is required for the disposable integration suite.");
  const url = new URL(value);
  assert.ok(["127.0.0.1", "localhost", "::1"].includes(url.hostname));
  assert.match(url.pathname.slice(1), /^trade82_order_payout_test_[a-z0-9_-]+$/i);
  assert.doesNotMatch(url.hostname, /supabase|neon|aws|vercel|render|railway|fly/i);
}

assertDisposableDatabase();
process.env.DATABASE_POOL_MAX = "4";
process.env.PARTNER_PROGRAM_MODE = "on";
process.env.NEXT_PUBLIC_APP_URL = "https://trade82.test";

mock.module("@clerk/nextjs/server", {
  namedExports: {
    auth: async () => ({ userId: null }),
  },
});

class TestNextResponse extends Response {
  cookies = {
    set: (cookie: {
      name: string;
      value: string;
      httpOnly: boolean;
      sameSite: "lax";
      secure: boolean;
      path: string;
      maxAge: number;
    }) => {
      this.headers.append(
        "Set-Cookie",
        [
          `${cookie.name}=${cookie.value}`,
          `Path=${cookie.path}`,
          `Max-Age=${cookie.maxAge}`,
          cookie.httpOnly ? "HttpOnly" : "",
          `SameSite=${cookie.sameSite === "lax" ? "Lax" : cookie.sameSite}`,
          cookie.secure ? "Secure" : "",
        ]
          .filter(Boolean)
          .join("; "),
      );
    },
  };

  static redirect(url: string | URL, status = 307) {
    return new TestNextResponse(null, {
      status,
      headers: { location: String(url) },
    });
  }
}

mock.module("next/server", {
  namedExports: { NextResponse: TestNextResponse },
});

const { getDb } = await import(new URL("../src/lib/db.ts", import.meta.url).href);
const { createReferralRouteHandler, HEAD } = await import(
  new URL("../src/app/r/[referralCode]/route.ts", import.meta.url).href,
);
const db = getDb() as PrismaClient;

after(async () => {
  await db.$disconnect();
});

function suffix() {
  return randomBytes(8).toString("hex");
}

function setCookies(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  return headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
}

function cookieJar(response: Response) {
  return setCookies(response)
    .flatMap((value) => value.split(/,(?=\s*trade82_)/))
    .map((value) => value.split(";", 1)[0])
    .filter(Boolean)
    .join("; ");
}

function requestFor(code: string, headers?: Record<string, string>) {
  return new Request(`https://trade82.test/r/${code}`, { headers });
}

async function createPartner(id = suffix()) {
  const user = await db.userProfile.create({
    data: {
      clerkUserId: `route-partner-${id}`,
      email: `route-partner-${id}@example.test`,
      displayName: "Route Partner",
      role: "user",
    },
  });
  const partner = await db.partnerProfile.create({
    data: {
      userId: user.id,
      referralCode: `T82-${id.toUpperCase()}`,
      status: "ACTIVE",
    },
  });
  return { user, partner };
}

async function deletePartnerFixture(partnerId: string, userId: string) {
  await db.referralClaimToken.deleteMany({ where: { partnerProfileId: partnerId } });
  await db.referralClickDailyVisitor.deleteMany({ where: { partnerProfileId: partnerId } });
  await db.referralConversion.deleteMany({ where: { partnerProfileId: partnerId } });
  await db.referralAttribution.deleteMany({ where: { partnerProfileId: partnerId } });
  await db.partnerProfile.delete({ where: { id: partnerId } });
  await db.userProfile.delete({ where: { id: userId } });
}

test("anonymous referral route captures a claim and partner-scoped click", async () => {
  const { partner, user } = await createPartner();
  try {
    const handler = createReferralRouteHandler({
      authenticate: async () => ({ userId: null }),
      getDatabase: () => db,
    });
    const response = await handler(requestFor(partner.referralCode), {
      params: Promise.resolve({ referralCode: partner.referralCode }),
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://trade82.test/signup");
    assert.match(response.headers.get("set-cookie") ?? "", /trade82_referral_visitor=/);
    assert.match(response.headers.get("set-cookie") ?? "", /trade82_referral_claim=/);
    const cookies = setCookies(response).join("\n");
    assert.match(cookies, /HttpOnly/);
    assert.match(cookies, /SameSite=Lax/);
    assert.match(cookies, /Path=\//);
    assert.doesNotMatch(cookies, /Domain=/);

    const [clicks, claims] = await Promise.all([
      db.referralClickDailyVisitor.count({ where: { partnerProfileId: partner.id } }),
      db.referralClaimToken.count({ where: { partnerProfileId: partner.id, consumedAt: null } }),
    ]);
    assert.equal(clicks, 1);
    assert.equal(claims, 1);

    const forwardedCookies = cookieJar(response);
    const followed = new Request(response.headers.get("location")!, {
      headers: { cookie: forwardedCookies },
    });
    assert.match(followed.headers.get("cookie") ?? "", /trade82_referral_visitor=/);
    assert.match(followed.headers.get("cookie") ?? "", /trade82_referral_claim=/);
  } finally {
    await deletePartnerFixture(partner.id, user.id);
  }
});

test("analytics failure does not block anonymous claim or leak identifiers", async () => {
  const { partner, user } = await createPartner();
  const rawMarker = `raw-route-marker-${suffix()}`;
  const logs: unknown[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => logs.push(args);
  try {
    const failingDb = {
      ...db,
      referralClickDailyVisitor: {
        ...db.referralClickDailyVisitor,
        upsert: async () => {
          throw new Error(rawMarker);
        },
      },
    } as unknown as PrismaClient;
    const handler = createReferralRouteHandler({
      authenticate: async () => ({ userId: null }),
      getDatabase: () => failingDb,
    });
    const response = await handler(requestFor(partner.referralCode), {
      params: Promise.resolve({ referralCode: partner.referralCode }),
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://trade82.test/signup");
    assert.match(response.headers.get("set-cookie") ?? "", /trade82_referral_claim=/);
    assert.equal(logs.length, 1);
    assert.doesNotMatch(JSON.stringify(logs), new RegExp(rawMarker));
    assert.doesNotMatch(JSON.stringify(logs), new RegExp(partner.referralCode));
    assert.equal(
      await db.referralClaimToken.count({
        where: { partnerProfileId: partner.id, consumedAt: null },
      }),
      1,
    );
  } finally {
    console.error = originalError;
    await deletePartnerFixture(partner.id, user.id);
  }
});

test("authenticated owners do not self-click while non-owners cannot receive late claims", async () => {
  const { partner, user: owner } = await createPartner();
  const visitor = await db.userProfile.create({
    data: {
      clerkUserId: `route-visitor-${suffix()}`,
      email: `route-visitor-${suffix()}@example.test`,
      displayName: "Route Visitor",
      role: "user",
    },
  });
  try {
    const ownerHandler = createReferralRouteHandler({
      authenticate: async () => ({ userId: owner.clerkUserId }),
      getDatabase: () => db,
    });
    const ownerResponse = await ownerHandler(requestFor(partner.referralCode), {
      params: Promise.resolve({ referralCode: partner.referralCode }),
    });
    assert.equal(ownerResponse.status, 302);
    assert.match(setCookies(ownerResponse).join("\n"), /trade82_referral_claim=.*Max-Age=0/);
    assert.equal(
      await db.referralClickDailyVisitor.count({ where: { partnerProfileId: partner.id } }),
      0,
    );

    const otherHandler = createReferralRouteHandler({
      authenticate: async () => ({ userId: visitor.clerkUserId }),
      getDatabase: () => db,
    });
    const otherResponse = await otherHandler(
      requestFor(partner.referralCode, { cookie: "trade82_referral_claim=stale-token" }),
      { params: Promise.resolve({ referralCode: partner.referralCode }) },
    );
    assert.equal(otherResponse.status, 302);
    assert.match(setCookies(otherResponse).join("\n"), /trade82_referral_claim=.*Max-Age=0/);
    assert.equal(
      await db.referralClickDailyVisitor.count({ where: { partnerProfileId: partner.id } }),
      1,
    );
    assert.equal(
      await db.referralClaimToken.count({ where: { partnerProfileId: partner.id } }),
      0,
    );
  } finally {
    await db.userProfile.delete({ where: { id: visitor.id } });
    await deletePartnerFixture(partner.id, owner.id);
  }
});

test("invalid, inactive, disabled, rate-limited, and framework requests do not create analytics", async () => {
  const { partner, user } = await createPartner();
  try {
    const handler = createReferralRouteHandler({
      authenticate: async () => ({ userId: null }),
      getDatabase: () => db,
    });
    const invoke = (request: Request, code = partner.referralCode) =>
      handler(request, { params: Promise.resolve({ referralCode: code }) });
    const assertNoAnalytics = async (stage: string) => {
      assert.equal(
        await db.referralClickDailyVisitor.count({ where: { partnerProfileId: partner.id } }),
        0,
        stage,
      );
      assert.equal(
        await db.referralClaimToken.count({ where: { partnerProfileId: partner.id } }),
        0,
        stage,
      );
    };

    await invoke(requestFor("INVALID"), "INVALID");
    await assertNoAnalytics("invalid");
    await db.partnerProfile.update({ where: { id: partner.id }, data: { status: "SUSPENDED" } });
    await invoke(requestFor(partner.referralCode));
    await assertNoAnalytics("suspended");
    await db.partnerProfile.update({ where: { id: partner.id }, data: { status: "ACTIVE", deletedAt: new Date() } });
    await invoke(requestFor(partner.referralCode));
    await assertNoAnalytics("deleted");
    await db.partnerProfile.update({ where: { id: partner.id }, data: { deletedAt: null } });

    process.env.PARTNER_PROGRAM_MODE = "off";
    await invoke(requestFor(partner.referralCode));
    await assertNoAnalytics("disabled");
    process.env.PARTNER_PROGRAM_MODE = "on";

    const rateLimitedHandler = createReferralRouteHandler({
      authenticate: async () => ({ userId: null }),
      getDatabase: () => db,
      attemptAnonymousClaim: async () => ({ rawToken: null, rateLimited: true }),
    });
    await rateLimitedHandler(requestFor(partner.referralCode), {
      params: Promise.resolve({ referralCode: partner.referralCode }),
    });
    await assertNoAnalytics("rate-limited");
    await invoke(new Request(`https://trade82.test/r/${partner.referralCode}`, {
      headers: { purpose: "prefetch" },
    }));
    await assertNoAnalytics("prefetch");
    await invoke(new Request(`https://trade82.test/r/${partner.referralCode}`, {
      headers: { "x-middleware-prefetch": "1" },
    }));
    await assertNoAnalytics("middleware-prefetch");
    const headResponse = await HEAD(new Request(`https://trade82.test/r/${partner.referralCode}`, { method: "HEAD" }));
    assert.equal(headResponse.status, 302);
    assert.equal(
      await db.referralClickDailyVisitor.count({ where: { partnerProfileId: partner.id } }),
      0,
    );
    assert.equal(
      await db.referralClaimToken.count({ where: { partnerProfileId: partner.id } }),
      0,
    );
  } finally {
    process.env.PARTNER_PROGRAM_MODE = "on";
    await deletePartnerFixture(partner.id, user.id);
  }
});
