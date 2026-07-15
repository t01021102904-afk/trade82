import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rules = await import(
  new URL("../src/lib/seller-payout-profile-rules.ts", import.meta.url).href,
);

const [profileRoute, bankRoute, bankDirectory, onboardingUi, settingsUi] = await Promise.all([
  readFile(new URL("../src/app/api/account/payout-profile/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/api/account/payout-banks/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/seller-payout-bank-directory.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/seller-payout-onboarding-step.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/payout-information-client.tsx", import.meta.url), "utf8"),
]);

test("Korean seller payout API only accepts KR local KRW configuration", () => {
  const valid = {
    country: "KR",
    accountType: "LOCAL",
    payoutCurrency: "krw",
    supportedCurrencies: ["krw"],
  };

  assert.doesNotThrow(() => rules.assertKoreanPayoutConfiguration(valid));
  assert.throws(() => rules.assertKoreanPayoutConfiguration({ ...valid, country: "US" }));
  assert.throws(() => rules.assertKoreanPayoutConfiguration({ ...valid, accountType: "IBAN" }));
  assert.throws(() => rules.assertKoreanPayoutConfiguration({ ...valid, payoutCurrency: "usd" }));
  assert.throws(() => rules.assertKoreanPayoutConfiguration({ ...valid, supportedCurrencies: ["krw", "usd"] }));
  assert.match(profileRoute, /assertKoreanPayoutConfiguration/);
  assert.match(profileRoute, /termsAccepted !== true \|\| body\.privacyAccepted !== true/);
});

test("account numbers are numeric and normalized before encryption", () => {
  assert.equal(rules.normalizeKoreanAccountNumber("1234-5678 9012"), "123456789012");
  assert.throws(() => rules.normalizeKoreanAccountNumber("ABCD-1234"));
  assert.throws(() => rules.normalizeKoreanAccountNumber("123"));
});

test("seller payout bank list is restricted to active Korean BankDirectory entries", () => {
  assert.match(bankRoute, /requireSeller\(\)/);
  assert.doesNotMatch(bankRoute, /api\/admin\/banks/);
  assert.match(bankDirectory, /countryCode: KOREAN_PAYOUT_COUNTRY, isActive: true/);
  assert.match(profileRoute, /findActiveKoreanSellerPayoutBank/);
  assert.doesNotMatch(profileRoute, /"bankName"/);
});

test("payout screens remove account-type, IBAN, optional bank details, and manual bank entry", () => {
  for (const source of [onboardingUi, settingsUi]) {
    assert.match(source, /border border-zinc-300 bg-white/);
    assert.match(source, /inputMode="numeric"/);
    assert.match(source, /pattern="\[0-9-\]\*"/);
    assert.match(source, /onlyAccountNumberCharacters/);
    assert.match(source, /country: "KR"/);
    assert.match(source, /accountType: "LOCAL"/);
    assert.match(source, /payoutCurrency: "krw"/);
    assert.doesNotMatch(source, /payouts\.accountType/);
    assert.doesNotMatch(source, /IBAN/);
    assert.doesNotMatch(source, /manualBankOverride/);
    assert.doesNotMatch(source, /swiftBic/);
    assert.doesNotMatch(source, /intermediaryBank/);
  }
});

test("payout screens require ownership, terms, and privacy acknowledgements with localized links", () => {
  for (const source of [onboardingUi, settingsUi]) {
    assert.match(source, /accountBelongsToCompany/);
    assert.match(source, /termsAccepted/);
    assert.match(source, /privacyAccepted/);
    assert.match(source, /target="_blank" rel="noopener noreferrer"/);
    assert.match(source, /withLocale\("\/terms", locale\)/);
    assert.match(source, /withLocale\("\/privacy", locale\)/);
    assert.match(source, /I agree to the/);
    assert.match(source, /I acknowledge the/);
    assert.match(source, /이용약관/);
    assert.match(source, /개인정보처리방침/);
  }
});
