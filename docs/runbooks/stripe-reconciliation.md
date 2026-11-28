# Stripe subscription reconciliation

Request Indexing rehearses subscription reconciliation with a Stripe sandbox and local D1. gscdump owns and enforces every Free allowance.

## Start the local receiver

1. Select the Request Indexing sandbox in your Stripe CLI project profile. Use that same sandbox for each fixture and key.
2. In one terminal, start the listener. If you run Nuxt on a different port, use that port in `--forward-to`.

   ```sh
   stripe --project-name request-indexing-rehearsal listen --events-from @self \
     --events customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.subscription.paused,customer.subscription.resumed \
     --forward-to http://localhost:3000/api/webhooks/stripe
   ```

3. For `pnpm dev`, add the following variables to the ignored `.env` at the repository root. Fill in the blanks locally.

   ```dotenv
   NUXT_APP_SECRET=
   NUXT_STRIPE_RECONCILIATION_ENABLED=true
   NUXT_STRIPE_SECRET_KEY=
   NUXT_STRIPE_WEBHOOK_SECRET=
   ```

   - If `NUXT_APP_SECRET` is empty, generate a local value with `openssl rand -base64 32`.
   - Use a sandbox key with subscription read access for `NUXT_STRIPE_SECRET_KEY`.
   - Use the listener's signing secret for `NUXT_STRIPE_WEBHOOK_SECRET`.

4. In another terminal, apply the migrations to local D1 and start Nuxt.

   ```sh
   pnpm db:migrate:local
   pnpm dev
   ```

## Bind a sandbox subscription

1. Create a sandbox customer and subscription in Stripe.
2. Visit `/api/_dev/login?email=stripe-review@example.test&onboarding=0` on the local server to seed the fixture account.
3. Replace both placeholder IDs, then run this command from the repository root.

   ```sh
   pnpm exec wrangler d1 execute DB --local --command "
     INSERT INTO stripe_billing_accounts (id, user_id, customer_id, subscription_id)
     SELECT lower(hex(randomblob(16))), user_id, 'cus_REPLACE', 'sub_REPLACE'
     FROM users WHERE email = 'stripe-review@example.test';
   "
   ```

## Check reconciliation

1. Update the bound subscription in Stripe. Wait for the listener to show a 200 response.
2. Check the subscription state and its receipt in local D1.

   ```sh
   pnpm exec wrangler d1 execute DB --local --command "
     SELECT b.stripe_status, b.stripe_collection_method, b.stripe_collection_paused,
       b.last_reconciled_event_id, (
         SELECT COUNT(*) FROM stripe_webhook_receipts AS r WHERE r.event_id = b.last_reconciled_event_id
       ) AS matching_receipts
     FROM stripe_billing_accounts AS b
     WHERE b.subscription_id = 'sub_REPLACE';
   "
   ```

3. Confirm the status and collection method match Stripe. The pause column reads 1 when collection is paused. The receipt count should be 1.
4. Pause collection on an active subscription. Check that the pause column changes and the status remains `active`.
5. Cancel that subscription. Check that Stripe reports `canceled`, D1 mirrors it, and the last event has one receipt.
6. Change an unbound sandbox subscription. Check that the bound row and its receipt remain unchanged.

The receiver returns 404 when disabled or given a live key. It rejects invalid signatures. A concurrent write asks Stripe to retry.

If you rehearse on a registered sandbox HTTPS endpoint, use that endpoint's signing secret. To test duplicates there, resend the same event with `stripe events resend <event-id> --webhook-endpoint <endpoint-id>`. Check that D1 still has one receipt for that event. [Stripe event retries](https://docs.stripe.com/webhooks#manual-retries)

Request Indexing uses subscription events to update its mirror. Paid usage requires a partner payment protocol. [gscdump ADR-0014 section 6](https://github.com/harlan-zw/gscdump.com/blob/main/docs/adr/0014-partner-billing-modes.md#6-payment-later)
