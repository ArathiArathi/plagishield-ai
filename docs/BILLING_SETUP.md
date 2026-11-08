# Stripe subscription billing setup

The application now uses Stripe-hosted Checkout and the Stripe customer portal. A paid plan is **not** granted by changing browser storage or editable user metadata. The database is updated only after a verified Stripe subscription webhook.

## 1. Create Stripe products and recurring prices

Create three products in Stripe for Pro, Plus, and Premium. For each product, create both a monthly and an annual recurring Price. The displayed amounts in the app are USD examples; make sure the Price IDs you configure match the amounts, currency, tax treatment, and billing interval you intend to sell.

Copy the six Stripe Price IDs.

## 2. Configure Supabase secrets

Set these in the Supabase project used by this app. Do not put secret values in `VITE_*` variables or commit them to Git.

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_ANNUAL`
- `STRIPE_PRICE_PLUS_MONTHLY`
- `STRIPE_PRICE_PLUS_ANNUAL`
- `STRIPE_PRICE_PREMIUM_MONTHLY`
- `STRIPE_PRICE_PREMIUM_ANNUAL`
- `APP_URL` (the deployed app origin, for example `https://your-domain.example`)

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY` / publishable key, and `SUPABASE_SERVICE_ROLE_KEY` / secret key to Edge Functions. The service-role key must remain server-side.

Example:

```sh
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_PRO_MONTHLY=price_...
supabase secrets set STRIPE_PRICE_PRO_ANNUAL=price_...
supabase secrets set STRIPE_PRICE_PLUS_MONTHLY=price_...
supabase secrets set STRIPE_PRICE_PLUS_ANNUAL=price_...
supabase secrets set STRIPE_PRICE_PREMIUM_MONTHLY=price_...
supabase secrets set STRIPE_PRICE_PREMIUM_ANNUAL=price_...
supabase secrets set APP_URL=https://your-domain.example
```

Use Stripe test-mode keys and test Price IDs until the complete purchase and cancellation lifecycle has been verified.

## 3. Apply the database migration and deploy functions

From the repository root:

```sh
supabase link --project-ref efqiekytujylkcnlxnod
supabase db push
supabase functions deploy create-checkout-session
supabase functions deploy create-customer-portal
supabase functions deploy stripe-webhook
```

The migration creates a subscription table with row-level security. Signed-in users can read only their own subscription. Client roles cannot write billing state.

## 4. Register the Stripe webhook

In Stripe Workbench / Developers, add an endpoint:

```
https://efqiekytujylkcnlxnod.supabase.co/functions/v1/stripe-webhook
```

Subscribe to:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.

## 5. Configure the customer portal

Enable the Stripe customer portal in the Stripe Dashboard. Allow customers to update payment methods, view invoices, cancel subscriptions, and (if desired) switch between the Pro, Plus, and Premium products. If plan switching is enabled, add all six recurring Prices to the portal's product catalogue.

## 6. Test before enabling live payments

Use Stripe test mode and test cards. Verify:

1. A signed-in free user can open Checkout for each paid plan and billing interval.
2. Completing payment creates or updates exactly one row in `public.subscriptions`.
3. Refreshing the app shows the paid plan only after the webhook has been received.
4. A failed or canceled Checkout does not grant a paid plan.
5. The customer portal can update payment details and cancel a subscription.
6. A cancellation or subscription status change updates the database through the webhook.

The frontend code and server endpoints are committed here, but live payments cannot run until the Stripe products, Price IDs, secrets, database migration, webhook, and Edge Functions have been configured in the Supabase and Stripe dashboards.
