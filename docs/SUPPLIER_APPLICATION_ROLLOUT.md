# Supplier Application rollout

`SUPPLIER_APPLICATIONS_ENABLED` is a server-only, fail-closed feature flag. Only
the exact value `true` enables queries to Supplier Application tables. It must
not use a `NEXT_PUBLIC_` name.

Roll out in this order:

1. Apply all additive migrations to a disposable or staging database.
2. Verify staging private Storage, MIME/size policy, signed URLs, and encryption
   variables.
3. Set `SUPPLIER_APPLICATIONS_ENABLED=true` in staging only.
4. Run applicant and Admin browser flows with staging-only identities and files.
5. Run the legacy backfill in dry-run mode and review every classification.
6. Apply the staging backfill with the explicit staging confirmation variable.
7. Re-run legacy seller product, inventory, order, shipping, and payout access.
8. Obtain approval and apply the additive migration to Production before any
   feature activation.
9. Keep the Production flag off and verify all existing seller workflows.
10. Enable the Production flag only after the migration and environment checks.
11. Expose applications gradually to a small cohort of new suppliers.

This PR does not apply a Production migration, enable the Production flag, run
the backfill, or deploy to Production.
