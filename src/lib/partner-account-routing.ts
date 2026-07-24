export type PartnerAccountCompanyState = {
  hasBuyerCompany: boolean;
  hasSellerCompany: boolean;
};

export function isPartnerOnlyAccount({
  partnerProfile,
  companyState,
}: {
  partnerProfile: { id: string } | null | undefined;
  companyState: PartnerAccountCompanyState;
}) {
  return (
    partnerProfile != null &&
    !companyState.hasBuyerCompany &&
    !companyState.hasSellerCompany
  );
}
