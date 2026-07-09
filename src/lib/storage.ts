"use client";

import type {
  BuyerCompanyProfile,
  CompanyProfile,
  ManagedProduct,
  MessageReply,
  MessageThread,
  SellerCompanyProfile,
  UserProfile,
  VerificationStatus,
  VerificationSubmission,
} from "@/lib/types";

const messageKey = "bridgemarket:message-threads";
const savedProductsKey = "bridgemarket:saved-products";
const buyerOnboardingKey = "bridgemarket:onboarding-buyer";
const sellerOnboardingKey = "bridgemarket:onboarding-seller";
const verificationSubmissionsKey = "bridgemarket:verification-submissions";
const userProfilesKey = "bridgemarket:user-profiles";
const companyProfilesKey = "bridgemarket:company-profiles";
const sellerProfilesKey = "bridgemarket:seller-profiles";
const buyerProfilesKey = "bridgemarket:buyer-profiles";
const managedProductsKey = "bridgemarket:managed-products";
const storageEventName = "bridgemarket:storage-change";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(storageEventName));
}

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getMessageThreads() {
  return readJson<MessageThread[]>(messageKey, []).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function saveMessageThread(thread: MessageThread) {
  const threads = getMessageThreads();
  writeJson(messageKey, [thread, ...threads]);
}

export function addReply(threadId: string, body: string) {
  const threads = getMessageThreads();
  const reply: MessageReply = {
    id: createId("reply"),
    body,
    sender: "You",
    createdAt: new Date().toISOString(),
  };

  const nextThreads = threads.map((thread) =>
    thread.id === threadId
      ? {
          ...thread,
          replies: [...thread.replies, reply],
          updatedAt: reply.createdAt,
        }
      : thread,
  );

  writeJson(messageKey, nextThreads);
  return nextThreads;
}

export function getSavedProducts() {
  return readJson<string[]>(savedProductsKey, []);
}

function toggleId(key: string, id: string) {
  const current = readJson<string[]>(key, []);
  const next = current.includes(id)
    ? current.filter((storedId) => storedId !== id)
    : [...current, id];
  writeJson(key, next);
  return next.includes(id);
}

export function toggleSavedProduct(id: string) {
  return toggleId(savedProductsKey, id);
}

export function saveOnboarding(kind: "buyer" | "seller", payload: Record<string, string>) {
  writeJson(kind === "buyer" ? buyerOnboardingKey : sellerOnboardingKey, {
    ...payload,
    submittedAt: new Date().toISOString(),
  });
}

export function getOnboarding(kind: "buyer" | "seller") {
  return readJson<Record<string, string> | null>(
    kind === "buyer" ? buyerOnboardingKey : sellerOnboardingKey,
    null,
  );
}

export function getVerificationSubmissions() {
  return readJson<VerificationSubmission[]>(verificationSubmissionsKey, []);
}

export function saveVerificationSubmission(submission: VerificationSubmission) {
  const current = getVerificationSubmissions();
  const withoutPrevious = current.filter(
    (item) =>
      item.userId !== submission.userId ||
      item.accountType !== submission.accountType,
  );
  writeJson(verificationSubmissionsKey, [submission, ...withoutPrevious]);
}

export function updateVerificationStatus(
  id: string,
  verificationStatus: VerificationStatus,
) {
  const next = getVerificationSubmissions().map((submission) =>
    submission.id === id
      ? { ...submission, verificationStatus }
      : submission,
  );
  writeJson(verificationSubmissionsKey, next);
  return next;
}

function upsertBy<T>(
  key: string,
  value: T,
  matches: (item: T) => boolean,
) {
  const current = readJson<T[]>(key, []);
  writeJson(key, [value, ...current.filter((item) => !matches(item))]);
}

export function getUserProfiles() {
  return readJson<UserProfile[]>(userProfilesKey, []);
}

export function saveUserProfile(profile: UserProfile) {
  upsertBy(userProfilesKey, profile, (item) => item.clerkUserId === profile.clerkUserId);
}

export function getCompanyProfiles() {
  return readJson<CompanyProfile[]>(companyProfilesKey, []);
}

export function saveCompanyProfile(profile: CompanyProfile) {
  upsertBy(companyProfilesKey, profile, (item) => item.id === profile.id);
}

export function getSellerProfiles() {
  return readJson<SellerCompanyProfile[]>(sellerProfilesKey, []);
}

export function saveSellerProfile(profile: SellerCompanyProfile) {
  upsertBy(sellerProfilesKey, profile, (item) => item.companyId === profile.companyId);
}

export function getBuyerProfiles() {
  return readJson<BuyerCompanyProfile[]>(buyerProfilesKey, []);
}

export function saveBuyerProfile(profile: BuyerCompanyProfile) {
  upsertBy(buyerProfilesKey, profile, (item) => item.companyId === profile.companyId);
}

export function getManagedProducts() {
  return readJson<ManagedProduct[]>(managedProductsKey, []);
}

export function saveManagedProduct(product: ManagedProduct) {
  upsertBy(managedProductsKey, product, (item) => item.id === product.id);
}

export function deleteManagedProduct(id: string) {
  writeJson(
    managedProductsKey,
    getManagedProducts().filter((product) => product.id !== id),
  );
}

export function subscribeToBridgeStorage(callback: () => void) {
  if (!canUseStorage()) {
    return () => {};
  }

  window.addEventListener("storage", callback);
  window.addEventListener(storageEventName, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(storageEventName, callback);
  };
}
