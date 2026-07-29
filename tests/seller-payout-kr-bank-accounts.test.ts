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
  assert.match(onboardingUi, /border border-zinc-300 bg-white/);
  assert.match(settingsUi, /@\/components\/ui\/field/);
  assert.match(settingsUi, /@\/components\/ui\/checkbox/);
  assert.match(settingsUi, /@\/components\/ui\/select/);
  assert.match(settingsUi, /@\/components\/ui\/input/);
  assert.match(settingsUi, /@\/components\/ui\/button/);

  for (const source of [onboardingUi, settingsUi]) {
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

test("settlement account settings use shadcn fields without Stripe onboarding", () => {
  assert.match(settingsUi, /<FieldGroup>/);
  assert.match(settingsUi, /<FieldSet>/);
  assert.match(settingsUi, /<FieldLegend>/);
  assert.match(settingsUi, /<FieldSeparator \/>/);
  assert.match(settingsUi, /<Select/);
  assert.match(settingsUi, /<Checkbox/);
  assert.match(settingsUi, /<Button/);
  assert.doesNotMatch(settingsUi, /StripeConnectOnboardingPanel/);
  assert.doesNotMatch(settingsUi, /payouts\.sellerSettings/);
  assert.doesNotMatch(
    settingsUi,
    /theme-|bm-|#34B386|#34b386|emerald-|green-|zinc-|slate-/,
  );
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

test("settlement bank select maps stored bank ids to visible bank names", () => {
  assert.match(settingsUi, /const bankOptions = banks\.map/);
  assert.match(settingsUi, /items=\{bankOptions\}/);
  assert.match(settingsUi, /bank\.bankNameLocal/);
  assert.match(settingsUi, /bank\.bankNameEnglish/);
  assert.match(settingsUi, /\{bank\.label\}/);
  assert.doesNotMatch(
    settingsUi,
    /<SelectItem key=\{bank\.id\} value=\{bank\.id\}>/,
  );
});

test("all settlement consent rows use the simple Checkbox and Label pattern", () => {
  assert.match(
    settingsUi,
    /import \{ Checkbox \} from "@\/components\/ui\/checkbox"/,
  );
  assert.match(
    settingsUi,
    /import \{ Label \} from "@\/components\/ui\/label"/,
  );
  assert.match(settingsUi, /<div className="flex items-start gap-2">/);
  assert.match(settingsUi, /<Label[\s\S]*htmlFor=\{id\}/);
  assert.match(settingsUi, /<Checkbox[\s\S]*id=\{id\}/);
  assert.doesNotMatch(
    settingsUi,
    /rounded-lg border border-border bg-muted\/40 p-3/,
  );
  assert.doesNotMatch(settingsUi, /<span>\{children\}<\/span>/);
});
