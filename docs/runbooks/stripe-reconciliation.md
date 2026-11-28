# Stripe subscription reconciliation

Request Indexing rehearses Stripe reconciliation in a sandbox. gscdump still owns and enforces every Free allowance. Request Indexing discards Stripe events that have no explicit local account binding.

## Rehearse in a sandbox

1. Use the Request Indexing Stripe sandbox and a separate local or preview database.
2. Set the private `NUXT_STRIPE_SECRET_KEY` to a sandbox secret key with subscription read access.
3. Run `stripe listen --events customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.subscription.paused,customer.subscription.resumed --forward-to http://localhost:3000/api/webhooks/stripe` in sandbox mode.
4. Set `NUXT_STRIPE_WEBHOOK_SECRET` to the signing secret from the listener. Set `NUXT_STRIPE_RECONCILIATION_ENABLED=true` in the rehearsal environment.
5. Bind a sandbox Customer and subscription to an existing test account in local D1. Insert the test account's internal `user_id`, a new random `id`, the Stripe `customer_id`, and the Stripe `subscription_id` into `stripe_billing_accounts`.
6. Change that subscription in Stripe. Confirm the local status matches the current Stripe status and that D1 records one receipt per event.

The endpoint returns 404 when the switch is off or the key belongs to live mode. Each accepted event re-reads the bound subscription. D1 commits the status and receipt together. An overlapping update asks Stripe to retry.

Paid usage requires a partner payment protocol. See [gscdump ADR-0014 section 6](https://github.com/harlan-zw/gscdump.com/blob/main/docs/adr/0014-partner-billing-modes.md#6-payment-later).
