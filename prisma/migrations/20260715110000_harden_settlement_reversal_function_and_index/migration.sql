-- Keep the settlement reversal trigger deterministic in the exposed public schema.
ALTER FUNCTION public."checkSettlementReversalLeg"() SET search_path = pg_catalog, public;

-- Cover the composite foreign key used to verify a reversal's settlement leg.
CREATE INDEX "SettlementReversal_settlementId_settlementLegId_idx"
  ON "SettlementReversal"("settlementId", "settlementLegId");
