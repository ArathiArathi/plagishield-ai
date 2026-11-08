/* global Deno */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type StripeSubscription = {
  id: string;
  customer: string | { id: string };
  status: string;
  current_period_start?: number;
  current_period_end?: number;
  items: {
    data: Array<{
      price: { id: string };
      current_period_start?: number;
      current_period_end?: number;
    }>;
  };
};

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

const encoder = new TextEncoder();

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  const timestampNumber = Number(timestamp);

  if (
    !timestamp ||
    !Number.isFinite(timestampNumber) ||
    Math.abs(Date.now() / 1000 - timestampNumber) > 300 ||
    signatures.length === 0
  ) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`)),
  );
  const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return signatures.some((signature) => safeEqual(signature, expected));
}

function getPlanFromPrice(priceId: string) {
  const configuredPricePlans: Record<string, string[]> = {
    pro: ["price_1UZTJCEP3hMKlBIwIIilnrzC", "price_1UZTJEEP3hMKlBIwn5ARqR7j"],
    plus: ["price_1UZTJGEP3hMKlBIwtzHPMqfs", "price_1UZTJIEP3hMKlBIwEtH6ofUj"],
    premium: ["price_1UZTJKEP3hMKlBIw3EazNMVF", "price_1UZTJLEP3hMKlBIwbtyQdVv2"],
  };

  return (
    Object.entries(configuredPricePlans).find(([, priceIds]) => priceIds.includes(priceId))?.[0] ??
    null
  );
}

async function retrieveSubscription(
  subscriptionId: string,
  stripeSecret: string,
): Promise<StripeSubscription> {
  const response = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { headers: { Authorization: `Bearer ${stripeSecret}` } },
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Could not retrieve the Stripe subscription.");
  }
  return payload as StripeSubscription;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeSecret || !webhookSecret) {
    return new Response("Webhook is not configured", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing Stripe signature", { status: 400 });

  const rawBody = await request.text();
  let event: StripeEvent;
  try {
    if (!(await verifyStripeSignature(rawBody, signature, webhookSecret))) {
      return new Response("Invalid signature", { status: 400 });
    }
    event = JSON.parse(rawBody) as StripeEvent;
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return new Response("Invalid signature or payload", { status: 400 });
  }

  const subscriptionEvent = event.type.startsWith("customer.subscription.");
  const invoiceEvent = event.type === "invoice.paid" || event.type === "invoice.payment_failed";

  if (!subscriptionEvent && !invoiceEvent) {
    return Response.json({ received: true, ignored: true });
  }

  try {
    let subscription: StripeSubscription;
    if (subscriptionEvent) {
      subscription = event.data.object as unknown as StripeSubscription;
    } else {
      const invoice = event.data.object as {
        subscription?: string | { id: string } | null;
        parent?: {
          subscription_details?: { subscription?: string | { id: string } | null };
        };
      };
      const linkedSubscription =
        invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
      const subscriptionId =
        typeof linkedSubscription === "string" ? linkedSubscription : linkedSubscription?.id;
      if (!subscriptionId) {
        return Response.json({ received: true, ignored: true });
      }
      subscription = await retrieveSubscription(subscriptionId, stripeSecret);
    }

    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const activePriceId = subscription.items.data[0]?.price.id;
    const planId = activePriceId ? getPlanFromPrice(activePriceId) : null;

    if (!customerId || !planId) {
      console.error("Stripe subscription has no mapped customer or configured price.", {
        eventId: event.id,
        subscriptionId: subscription.id,
        priceId: activePriceId,
      });
      return new Response("Subscription customer or price is not configured", {
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase service credentials are not configured.");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Resolve ownership through the Customer ID created and stored during checkout,
    // rather than trusting user-editable Stripe metadata as an authorization claim.
    const { data: owner, error: ownerError } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (ownerError) throw ownerError;
    if (!owner?.user_id) {
      console.error("No application subscription row is linked to Stripe customer.", customerId);
      return new Response("Unknown Stripe customer", { status: 400 });
    }

    const firstItem = subscription.items.data[0];
    const periodStart = subscription.current_period_start ?? firstItem?.current_period_start;
    const periodEnd = subscription.current_period_end ?? firstItem?.current_period_end;

    const { error } = await admin.from("subscriptions").upsert(
      {
        user_id: owner.user_id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        plan_id: planId,
        status: subscription.status,
        current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) throw error;
    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
});
