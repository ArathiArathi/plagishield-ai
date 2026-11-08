# Stripe subscription billing setup

PlagiShield uses Stripe-hosted Checkout and the Stripe customer portal. Paid access is granted only after the signed Stripe webhook confirms the subscription; browser storage and editable user metadata do not grant paid entitlements.

## Stripe test products and prices

The connected Stripe account has these products and active INR recurring prices in **test mode**:

| Plan | Monthly | Annual | Product ID |
| --- | ---: | ---: | --- |
| Pro | ₹1,300 | ₹11,300 | `prod_VaecTO2bcGM2ul` |
| Plus | ₹2,700 | ₹22,600 | `prod_VaecaIarnwnWbb` |
| Premium | ₹4,600 | ₹39,500 | `prod_Vaecu2tn0zrLKb` |

The six Stripe Price IDs are mapped in the server-side Checkout and webhook Edge Functions:

| Plan | Monthly Price ID | Annual Price ID |
| --- | --- | --- |
| Pro | `price_1UZTJCEP3hMKlBIwIIilnrzC` | `price_1UZTJEEP3hMKlBIwn5ARqR7j` |
| Plus | `price_1UZTJGEP3hMKlBIwtzHPMqfs` | `price_1UZTJIEP3hMKlBIwEtH6ofUj` |
| Premium | `price_1UZTJKEP3hMKlBIw3EazNMVF` | `price_1UZTJLEP3hMKlBIwbtyQdVv2` |

These prices preserve the existing plan tiers and approximate their former USD values using a rounded INR conversion. The user confirmed no GST collection for now; Stripe automatic tax is not enabled. Do not enable automatic tax unless the business confirms its tax registrations and collection requirements.

## Supabase Edge Function secrets

Set these values in the Supabase project's Edge Function secrets. Never place secret values in `VITE_*` variables or commit them to Git.

- `STRIPE_SECRET_KEY` — the connected Stripe test-mode secret key (`sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` — signing secret for the webhook endpoint (`whsec_...`)
- `APP_URL` — deployed frontend origin, for example `https://your-domain.example`

Supabase provides the project URL and service credentials to Edge Functions. The service-role / secret key must remain server-side.

Example:

```sh
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set APP_URL=https://your-domain.example
```

The connected Supabase project is `efqiekytujylkcnlxnod`. The database migration and Edge Functions have already been applied/deployed there. Current deployed versions: `create-checkout-session` v2, `create-customer-portal` v1, `stripe-webhook` v4.

## Stripe webhook

Register this endpoint in Stripe Workbench / Developers:

```
https://efqiekytujylkcnlxnod.supabase.co/functions/v1/stripe-webhook
```

Subscribe to:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`. The webhook verifies Stripe's signature and resolves the user through the stored Stripe Customer ID before updating `public.subscriptions`.

## Customer portal

Enable the Stripe customer portal in the Stripe Dashboard. Allow customers to update payment methods, view invoices, and cancel subscriptions. If plan switching is desired, add the six INR recurring Prices to the portal's product catalogue.

## Test checklist

Before enabling live payments, verify in Stripe test mode:

1. A signed-in free user can open Checkout for Pro, Plus, and Premium, monthly and annual.
2. Checkout displays INR prices and no GST/automatic tax.
3. Completing test payment updates exactly one row in `public.subscriptions` through the webhook.
4. A failed or canceled Checkout does not grant a paid plan.
5. The customer portal opens for an existing Stripe customer.
6. Cancellation and failed-payment webhook events update the database and access appropriately.
7. Monthly document quotas (10 / 15 / 25 / 35) are enforced by the database trigger.

The products and recurring Prices exist in test mode, and the Checkout/webhook functions are deployed with their Price IDs. Checkout still requires the three Edge Function secrets above, and the webhook must be registered in Stripe before an end-to-end test payment can be completed.
