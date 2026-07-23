UPDATE "PartnerProfile"
SET "status" = 'ACTIVE'::"PartnerProfileStatus"
WHERE "status" = 'PENDING_REVIEW'::"PartnerProfileStatus"
  AND "deletedAt" IS NULL;
