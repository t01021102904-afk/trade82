"use client";

import { useSyncExternalStore } from "react";

import {
  getBuyerProfiles,
  getCompanyProfiles,
  getMessageThreads,
  getManagedProducts,
  getSavedCompanies,
  getSavedProducts,
  getSellerProfiles,
  getUserProfiles,
  getVerificationSubmissions,
  subscribeToBridgeStorage,
} from "@/lib/storage";
import type {
  BuyerCompanyProfile,
  CompanyProfile,
  ManagedProduct,
  MessageThread,
  SellerCompanyProfile,
  UserProfile,
  VerificationSubmission,
} from "@/lib/types";

const emptyStrings: string[] = [];
const emptyThreads: MessageThread[] = [];
const emptyVerificationSubmissions: VerificationSubmission[] = [];
const emptyUserProfiles: UserProfile[] = [];
const emptyCompanyProfiles: CompanyProfile[] = [];
const emptySellerProfiles: SellerCompanyProfile[] = [];
const emptyBuyerProfiles: BuyerCompanyProfile[] = [];
const emptyManagedProducts: ManagedProduct[] = [];

function createCachedSnapshot<T>(read: () => T, serverValue: T) {
  let cachedValue = serverValue;
  let cachedSignature = "";

  return () => {
    const nextValue = read();
    const nextSignature = JSON.stringify(nextValue);

    if (nextSignature !== cachedSignature) {
      cachedSignature = nextSignature;
      cachedValue = nextValue;
    }

    return cachedValue;
  };
}

const savedProductsSnapshot = createCachedSnapshot(getSavedProducts, emptyStrings);
const savedCompaniesSnapshot = createCachedSnapshot(getSavedCompanies, emptyStrings);
const messageThreadsSnapshot = createCachedSnapshot(getMessageThreads, emptyThreads);
const verificationSubmissionsSnapshot = createCachedSnapshot(
  getVerificationSubmissions,
  emptyVerificationSubmissions,
);
const userProfilesSnapshot = createCachedSnapshot(getUserProfiles, emptyUserProfiles);
const companyProfilesSnapshot = createCachedSnapshot(
  getCompanyProfiles,
  emptyCompanyProfiles,
);
const sellerProfilesSnapshot = createCachedSnapshot(
  getSellerProfiles,
  emptySellerProfiles,
);
const buyerProfilesSnapshot = createCachedSnapshot(
  getBuyerProfiles,
  emptyBuyerProfiles,
);
const managedProductsSnapshot = createCachedSnapshot(
  getManagedProducts,
  emptyManagedProducts,
);

export function useSavedProductIds() {
  return useSyncExternalStore(
    subscribeToBridgeStorage,
    savedProductsSnapshot,
    () => emptyStrings,
  );
}

export function useSavedCompanyIds() {
  return useSyncExternalStore(
    subscribeToBridgeStorage,
    savedCompaniesSnapshot,
    () => emptyStrings,
  );
}

export function useMessageThreads() {
  return useSyncExternalStore(
    subscribeToBridgeStorage,
    messageThreadsSnapshot,
    () => emptyThreads,
  );
}

export function useVerificationSubmissions() {
  return useSyncExternalStore(
    subscribeToBridgeStorage,
    verificationSubmissionsSnapshot,
    () => emptyVerificationSubmissions,
  );
}

export function useUserProfiles() {
  return useSyncExternalStore(
    subscribeToBridgeStorage,
    userProfilesSnapshot,
    () => emptyUserProfiles,
  );
}

export function useCompanyProfiles() {
  return useSyncExternalStore(
    subscribeToBridgeStorage,
    companyProfilesSnapshot,
    () => emptyCompanyProfiles,
  );
}

export function useSellerProfiles() {
  return useSyncExternalStore(
    subscribeToBridgeStorage,
    sellerProfilesSnapshot,
    () => emptySellerProfiles,
  );
}

export function useBuyerProfiles() {
  return useSyncExternalStore(
    subscribeToBridgeStorage,
    buyerProfilesSnapshot,
    () => emptyBuyerProfiles,
  );
}

export function useManagedProducts() {
  return useSyncExternalStore(
    subscribeToBridgeStorage,
    managedProductsSnapshot,
    () => emptyManagedProducts,
  );
}
