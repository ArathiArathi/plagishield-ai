/* global Deno */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const stripe = new Stripe(stripeSecret, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!stripeSecret || !webhookSecret) return new Response("Webhook is not configured", { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing Stripe signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    if (!event.type.startsWith("customer.subscription.")) {
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.user_id;
    const activePriceId = subscription.items.data[0]?.price.id;
    const configuredPricePlans = [
      ["pro", Deno.env.get("STRIPE_PRICE_PRO_MONTHLY"), Deno.env.get("STRIPE_PRICE_PRO_ANNUAL")],
      ["plus", Deno.env.get("STRIPE_PRICE_PLUS_MONTHLY"), Deno.env.get("STRIPE_PRICE_PLUS_ANNUAL")],
      ["premium", Deno.env.get("STRIPE_PRICE_PREMIUM_MONTHLY"), Deno.env.get("STRIPE_PRICE_PREMIUM_ANNUAL")],
    ] as const;
    const pricePlan = configuredPricePlans.find(([, monthly, annual]) =>
      activePriceId && (activePriceId === monthly || activePriceId === annual)
    )?.[0];
    const planId = pricePlan ?? subscription.metadata?.plan_id;
    if (!userId || !["pro", "plus", "premium"].includes(planId)) {
      console.error("Subscription webhook is missing valid user or plan metadata/price mapping", subscription.id);
      return new Response("Subscription metadata is incomplete", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase service credentials are not configured.");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

    const { error } = await admin.from("subscriptions").upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      plan_id: planId,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (error) throw error;
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
});
