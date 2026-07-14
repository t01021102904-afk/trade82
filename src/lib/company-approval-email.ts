import "server-only";

import { getEmailBaseUrl, sendTransactionalEmail } from "@/lib/email";
import { companyApprovalEmail } from "@/lib/email-templates";

type CompanyApprovalEmailEligibility = {
  companyRole: string;
  companyVerificationStatus: string;
  verificationRequestStatus: string;
  nextVerificationStatus: string;
  ownerEmail: string | null | undefined;
};

type CompanyApprovalEmailInput = {
  verificationRequestId: string;
  ownerEmail: string;
  preferredLanguage: string | null | undefined;
};

type TransactionalEmailSender = typeof sendTransactionalEmail;

export function shouldSendCompanyApprovalEmail({
  companyRole,
  companyVerificationStatus,
  verificationRequestStatus,
  nextVerificationStatus,
  ownerEmail,
}: CompanyApprovalEmailEligibility) {
  return Boolean(
    ownerEmail?.trim() &&
      companyRole === "seller" &&
      companyVerificationStatus === "pending_review" &&
      verificationRequestStatus === "pending_review" &&
      nextVerificationStatus === "verified",
  );
}

// Approval is already committed before this helper is called. Delivery is best effort.
export async function sendCompanyApprovalEmail(
  { verificationRequestId, ownerEmail, preferredLanguage }: CompanyApprovalEmailInput,
  sendEmail: TransactionalEmailSender = sendTransactionalEmail,
  baseUrl = getEmailBaseUrl(),
) {
  try {
    const locale = preferredLanguage === "ko" ? "ko" : "en";
    const email = companyApprovalEmail({ locale, baseUrl });
    const result = await sendEmail({
      to: ownerEmail.trim(),
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: `trade82-company-approved-${verificationRequestId}`,
    });
    return result.sent;
  } catch (error) {
    console.error("Company approval email send failed.", {
      name: error instanceof Error ? error.name : typeof error,
      verificationRequestId,
    });
    return false;
  }
}
