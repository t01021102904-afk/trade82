# Stripe Connect onboarding foundation

This onboarding foundation uses the Stripe **Accounts v1 API with controller
properties**, not the deprecated `type: "express"` shortcut and not Accounts
v2. The repository's Stripe SDK (`stripe` 22.3.0) and configured API version
(`2026-06-24.dahlia`) support the V1 `accounts` and `accountLinks` resources.

The V1 controller model is selected for this bounded rollout because it gives
the existing platform a single, explicit configuration for the future Separate
Charges and Transfers model without introducing an Accounts v2 recipient and
configuration migration before any transfer code exists:

- `controller.fees.payer = "application"`
- `controller.losses.payments = "application"`
- `controller.requirement_collection = "stripe"`
- `controller.stripe_dashboard.type = "express"`
- `capabilities.transfers.requested = true`

This gives account holders Stripe-hosted onboarding and Express Dashboard
access, while the platform is configured as responsible for fees and negative
balance losses. Only the future transfer capability is requested. This PR does
not create transfers, payouts, reversal records, or alter settlement release.

`STRIPE_CONNECT_ONBOARDING_MODE` is disabled unless its raw value is exactly
`on`. The separate `STRIPE_CONNECT_SETTLEMENT_MODE` flag remains unchanged.
