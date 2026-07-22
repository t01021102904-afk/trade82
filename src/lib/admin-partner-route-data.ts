import "server-only";

import {
  getAdminPartnerListData,
  parseAdminPartnerDetailQuery,
  parseAdminPartnerListQuery,
  type AdminPartnerDetailQuery,
  type AdminPartnerListData,
  type AdminPartnerListQuery,
} from "@/lib/admin-partners";
import { getAdminPartnerDashboardData } from "@/lib/partner-dashboard";

type RequireAdmin = typeof import("@/lib/authz").requireAdmin;

export type AdminPartnerListRouteData = {
  query: AdminPartnerListQuery;
  data: AdminPartnerListData | null;
  failed: boolean;
};

export type AdminPartnerDetailRouteData = {
  query: AdminPartnerDetailQuery;
  data: Awaited<ReturnType<typeof getAdminPartnerDashboardData>>;
};

export async function loadAdminPartnerListRouteData(
  searchParams: Record<string, string | string[] | undefined>,
  {
    requireAdminFn,
    getListData = getAdminPartnerListData,
  }: {
    requireAdminFn?: RequireAdmin;
    getListData?: typeof getAdminPartnerListData;
  } = {},
): Promise<AdminPartnerListRouteData> {
  await (requireAdminFn ?? (await import("@/lib/authz")).requireAdmin)();
  const query = parseAdminPartnerListQuery(searchParams);
  let data: AdminPartnerListData | null = null;
  let failed = false;
  try {
    data = await getListData(query);
  } catch {
    failed = true;
  }
  return { query, data, failed };
}

export async function loadAdminPartnerDetailRouteData(
  partnerProfileId: string,
  searchParams: Record<string, string | string[] | undefined>,
  {
    requireAdminFn,
    getDashboardData = getAdminPartnerDashboardData,
  }: {
    requireAdminFn?: RequireAdmin;
    getDashboardData?: typeof getAdminPartnerDashboardData;
  } = {},
): Promise<AdminPartnerDetailRouteData> {
  await (requireAdminFn ?? (await import("@/lib/authz")).requireAdmin)();
  const query = parseAdminPartnerDetailQuery(searchParams);
  const data = await getDashboardData({
    partnerProfileId,
    commissionPage: query.commissionPage,
    memberPage: query.memberPage,
    analyticsRange: query.analyticsRange,
  });
  return { query, data };
}
