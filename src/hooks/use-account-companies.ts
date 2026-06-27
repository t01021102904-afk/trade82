"use client";

export type AccountCompanyRecord = Record<string, unknown> & {
  id?: string;
  companyRole?: "seller" | "buyer";
};

const companiesByUserId = new Map<string, AccountCompanyRecord[]>();
const requestsByUserId = new Map<string, Promise<AccountCompanyRecord[]>>();

export function loadAccountCompanies(userId: string) {
  const cached = companiesByUserId.get(userId);
  if (cached) return Promise.resolve(cached);

  const pending = requestsByUserId.get(userId);
  if (pending) return pending;

  const request = fetch("/api/account/company")
    .then(async (response) => {
      if (!response.ok) return [];
      const companies = (await response.json()) as AccountCompanyRecord[];
      if (companies.length) {
        companiesByUserId.set(userId, companies);
      }
      return companies;
    })
    .catch(() => [])
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
  const next = [
    ...current.filter((item) =>
      company.id
        ? item.id !== company.id
        : item.companyRole !== company.companyRole,
    ),
    company,
  ];
  companiesByUserId.set(userId, next);
}
