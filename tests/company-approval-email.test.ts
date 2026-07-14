import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const approvalEmailModule = await import(
  new URL("../src/lib/company-approval-email.ts", import.meta.url).href,
);
const emailTemplateModule = await import(
  new URL("../src/lib/email-templates.ts", import.meta.url).href,
);

type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
};

const {
  sendCompanyApprovalEmail,
  shouldSendCompanyApprovalEmail,
} = approvalEmailModule as {
  sendCompanyApprovalEmail: (
    input: {
      verificationRequestId: string;
      ownerEmail: string;
      preferredLanguage: string;
    },
    sendEmail: (input: EmailInput) => Promise<{
      sent: boolean;
      skipped: boolean;
      reason: string | null;
    }>,
    baseUrl: string,
  ) => Promise<boolean>;
  shouldSendCompanyApprovalEmail: (input: typeof pendingSellerApproval) => boolean;
};
const { companyApprovalEmail } = emailTemplateModule as {
  companyApprovalEmail: (input: { locale: "en" | "ko"; baseUrl: string }) => {
    subject: string;
    html: string;
    text: string;
  };
};

const pendingSellerApproval = {
  companyRole: "seller",
  companyVerificationStatus: "pending_review",
  verificationRequestStatus: "pending_review",
  nextVerificationStatus: "verified",
  ownerEmail: "owner@example.test",
};

test("sends only for a pending seller company approval with an owner email", () => {
  assert.equal(shouldSendCompanyApprovalEmail(pendingSellerApproval), true);
  assert.equal(
    shouldSendCompanyApprovalEmail({
      ...pendingSellerApproval,
      companyVerificationStatus: "verified",
    }),
    false,
  );
  assert.equal(
    shouldSendCompanyApprovalEmail({
      ...pendingSellerApproval,
      verificationRequestStatus: "verified",
    }),
    false,
  );
  assert.equal(
    shouldSendCompanyApprovalEmail({
      ...pendingSellerApproval,
      verificationRequestStatus: "rejected",
    }),
    false,
  );
  assert.equal(
    shouldSendCompanyApprovalEmail({
      ...pendingSellerApproval,
      nextVerificationStatus: "rejected",
    }),
    false,
  );
  assert.equal(
    shouldSendCompanyApprovalEmail({
      ...pendingSellerApproval,
      companyRole: "buyer",
    }),
    false,
  );
  assert.equal(
    shouldSendCompanyApprovalEmail({
      ...pendingSellerApproval,
      ownerEmail: "",
    }),
    false,
  );
});

test("renders Korean and English company approval templates", () => {
  const english = companyApprovalEmail({ locale: "en", baseUrl: "https://trade82.example" });
  const korean = companyApprovalEmail({ locale: "ko", baseUrl: "https://trade82.example" });

  assert.equal(english.subject, "[Trade82] Your company has been approved");
  assert.match(english.text, /Your company registration has been approved/);
  assert.match(english.html, /List a Product/);
  assert.match(english.html, /https:\/\/trade82\.example\/sell/);
  assert.equal(korean.subject, "[Trade82] 회사 등록이 승인되었습니다");
  assert.match(korean.text, /회사 등록 검토가 완료되었습니다/);
  assert.match(korean.html, /상품 등록하기/);
  assert.match(korean.html, /https:\/\/trade82\.example\/ko\/sell/);
});

test("uses the company approval idempotency key and safely handles a delivery failure", async () => {
  let capturedKey = "";
  let sendCalls = 0;
  const sent = await sendCompanyApprovalEmail(
    {
      verificationRequestId: "verification_request_123",
      ownerEmail: "owner@example.test",
      preferredLanguage: "ko",
    },
    async (input) => {
      sendCalls += 1;
      capturedKey = input.idempotencyKey ?? "";
      assert.match(input.subject, /회사 등록이 승인되었습니다/);
      return { sent: true, skipped: false, reason: null };
    },
    "https://trade82.example",
  );

  assert.equal(sent, true);
  assert.equal(sendCalls, 1);
  assert.equal(capturedKey, "trade82-company-approved-verification_request_123");

  const failed = await sendCompanyApprovalEmail(
    {
      verificationRequestId: "verification_request_456",
      ownerEmail: "owner@example.test",
      preferredLanguage: "en",
    },
    async () => {
      throw new Error("provider unavailable");
    },
    "https://trade82.example",
  );

  assert.equal(failed, false);
});

test("commits company approval before attempting a best-effort email", async () => {
  const route = await readFile(
    new URL("../src/app/api/admin/verifications/route.ts", import.meta.url),
    "utf8",
  );

  assert.ok(route.indexOf("await getDb().$transaction") < route.indexOf("await sendCompanyApprovalEmail"));
  assert.match(route, /return Response\.json\(\{ ok: true, verificationStatus, emailSent \}\)/);
});
