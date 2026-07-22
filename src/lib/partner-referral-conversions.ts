import "server-only";

type ConversionDb = {
  referralAttribution: {
    findUnique: (args: {
      where: { referredUserId: string };
      select: { id: true; partnerProfileId: true };
    }) => Promise<{
      id: string;
      partnerProfileId: string;
    } | null>;
  };
  referralConversion: {
    upsert: (args: {
      where: {
        referralAttributionId_subjectType: {
          referralAttributionId: string;
          subjectType: "BUYER" | "SELLER";
        };
      };
      create: {
        partnerProfileId: string;
        referralAttributionId: string;
        subjectType: "BUYER" | "SELLER";
        convertedAt: Date;
      };
      update: Record<string, never>;
    }) => Promise<unknown>;
  };
};

export async function recordReferralConversionForCompany(
  db: ConversionDb,
  {
    ownerUserId,
    companyRole,
    companyCreatedAt,
  }: {
    ownerUserId: string;
    companyRole: "seller" | "buyer";
    companyCreatedAt: Date;
  },
) {
  const attribution = await db.referralAttribution.findUnique({
    where: { referredUserId: ownerUserId },
    select: { id: true, partnerProfileId: true },
  });
  if (!attribution) return null;

  return db.referralConversion.upsert({
    where: {
      referralAttributionId_subjectType: {
        referralAttributionId: attribution.id,
        subjectType: companyRole === "seller" ? "SELLER" : "BUYER",
      },
    },
    create: {
      partnerProfileId: attribution.partnerProfileId,
      referralAttributionId: attribution.id,
      subjectType: companyRole === "seller" ? "SELLER" : "BUYER",
      convertedAt: companyCreatedAt,
    },
    update: {},
  });
}
