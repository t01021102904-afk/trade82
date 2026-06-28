"use client";

export type AccountCompanyRecord = Record<string, unknown> & {
  id?: string;
  companyRole?: "seller" | "buyer";
};

const companiesByUserId = new Map<string, AccountCompanyRecord[]>();
const requestsByUserId = new Map<string, Promise<AccountCompanyRecord[]>>();

function companyCacheDebug(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[company-cache] ${message}`, details);
  }
}

function timestamp(value: unknown) {
  if (typeof value !== "string") return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function logoFields(company: AccountCompanyRecord | undefined) {
  return {
    logoOriginalUrl:
      typeof company?.logoOriginalUrl === "string" ? company.logoOriginalUrl : "",
    logoThumbnailUrl:
      typeof company?.logoThumbnailUrl === "string"
        ? company.logoThumbnailUrl
        : "",
    logoUrl: typeof company?.logoUrl === "string" ? company.logoUrl : "",
    useDefaultLogo:
      typeof company?.useDefaultLogo === "boolean"
        ? company.useDefaultLogo
        : undefined,
  };
}

function hasLogo(company: AccountCompanyRecord | undefined) {
  const logos = logoFields(company);
  return Boolean(logos.logoOriginalUrl || logos.logoThumbnailUrl || logos.logoUrl);
}

function sameCompany(
  left: AccountCompanyRecord,
  right: AccountCompanyRecord,
) {
  if (left.companyRole && right.companyRole) {
    return left.companyRole === right.companyRole;
  }
  if (left.id && right.id) return left.id === right.id;
  return false;
}

function mergeCompanyRecord(
  current: AccountCompanyRecord | undefined,
  incoming: AccountCompanyRecord,
) {
  if (!current) return incoming;

  const currentUpdatedAt = timestamp(current.updatedAt);
  const incomingUpdatedAt = timestamp(incoming.updatedAt);
  const incomingIsOlder =
    currentUpdatedAt > 0 &&
    incomingUpdatedAt > 0 &&
    incomingUpdatedAt < currentUpdatedAt;
  const currentLogo = logoFields(current);
  const incomingLogo = logoFields(incoming);
  const incomingExplicitlyClearsLogo =
    incomingLogo.useDefaultLogo === true && !hasLogo(incoming);
  const shouldPreserveCurrentLogo =
    hasLogo(current) &&
    !hasLogo(incoming) &&
    !incomingExplicitlyClearsLogo &&
    (incomingIsOlder || incomingUpdatedAt <= currentUpdatedAt || !incomingUpdatedAt);

  const merged = incomingIsOlder ? { ...incoming, ...current } : { ...current, ...incoming };
  if (shouldPreserveCurrentLogo) {
    merged.logoOriginalUrl = currentLogo.logoOriginalUrl;
    merged.logoThumbnailUrl = currentLogo.logoThumbnailUrl;
    merged.logoUrl = currentLogo.logoUrl;
    merged.useDefaultLogo = false;
  }

  companyCacheDebug("merged company record", {
    companyId: incoming.id ?? current.id ?? null,
    role: incoming.companyRole ?? current.companyRole ?? null,
    source: incomingIsOlder ? "kept-current-newer-data" : "accepted-incoming-data",
    currentUpdatedAt: current.updatedAt ?? null,
    incomingUpdatedAt: incoming.updatedAt ?? null,
    preservedLogo: shouldPreserveCurrentLogo,
    currentLogo,
    incomingLogo,
    mergedLogo: logoFields(merged),
  });

  return merged;
}

function mergeCompanyList(
  current: AccountCompanyRecord[],
  incoming: AccountCompanyRecord[],
) {
  const next = [...current];

  for (const company of incoming) {
    const index = next.findIndex((item) => sameCompany(item, company));
    if (index >= 0) {
      next[index] = mergeCompanyRecord(next[index], company);
    } else {
      next.push(company);
    }
  }

  return next;
}

export function loadAccountCompanies(
  userId: string,
  options: { force?: boolean } = {},
) {
  const cached = companiesByUserId.get(userId);
  if (cached && !options.force) {
    companyCacheDebug("loaded account companies from cache", {
      userId,
      count: cached.length,
      companies: cached.map((company) => ({
        id: company.id ?? null,
        role: company.companyRole ?? null,
        updatedAt: company.updatedAt ?? null,
        ...logoFields(company),
      })),
    });
    return Promise.resolve(cached);
  }

  const pending = requestsByUserId.get(userId);
  if (pending && !options.force) return pending;

  companyCacheDebug("fetching account companies from API", {
    userId,
    force: Boolean(options.force),
  });

  const request = fetch("/api/account/company", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        companyCacheDebug("account company API failed", {
          userId,
          status: response.status,
        });
        return companiesByUserId.get(userId) ?? [];
      }
      const companies = (await response.json()) as AccountCompanyRecord[];
      const merged = mergeCompanyList(companiesByUserId.get(userId) ?? [], companies);
      companiesByUserId.set(userId, merged);
      companyCacheDebug("loaded account companies from API", {
        userId,
        count: merged.length,
        companies: merged.map((company) => ({
          id: company.id ?? null,
          role: company.companyRole ?? null,
          updatedAt: company.updatedAt ?? null,
          ...logoFields(company),
        })),
      });
      return merged;
    })
    .catch(() => companiesByUserId.get(userId) ?? [])
    .finally(() => {
      requestsByUserId.delete(userId);
    });

  requestsByUserId.set(userId, request);
  return request;
}

export function rememberAccountCompany(
  userId: string,
  company: AccountCompanyRecord,
) {
  if (!company.companyRole) return;

  const current = companiesByUserId.get(userId) ?? [];
  const next = mergeCompanyList(current, [company]);
  companyCacheDebug("remembered account company", {
    userId,
    companyId: company.id ?? null,
    role: company.companyRole ?? null,
    updatedAt: company.updatedAt ?? null,
    ...logoFields(company),
  });
  companiesByUserId.set(userId, next);
}
