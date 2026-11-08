/* global Deno */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function stripePost(path: string, params: URLSearchParams, secret: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Stripe could not create the checkout session.");
  }
  return payload;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Sign in before choosing a plan." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    const appUrl = Deno.env.get("APP_URL");
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !stripeSecret || !appUrl) {
      return json({ error: "Billing is not configured. Ask the workspace administrator to finish the Stripe setup." }, 503);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Your session is no longer valid. Please sign in again." }, 401);

    const body = await request.json();
    const planId = body?.planId;
    const billingCycle = body?.billingCycle;
    if (!["pro", "plus", "premium"].includes(planId) || !["monthly", "annual"].includes(billingCycle)) {
      return json({ error: "Choose a valid paid plan and billing cycle." }, 400);
    }

    const priceIds: Record<string, Record<string, string>> = {
      pro: {
        monthly: "price_1UZTJCEP3hMKlBIwIIilnrzC",
        annual: "price_1UZTJEEP3hMKlBIwn5ARqR7j",
      },
      plus: {
        monthly: "price_1UZTJGEP3hMKlBIwtzHPMqfs",
        annual: "price_1UZTJIEP3hMKlBIwEtH6ofUj",
      },
      premium: {
        monthly: "price_1UZTJKEP3hMKlBIw3EazNMVF",
        annual: "price_1UZTJLEP3hMKlBIwbtyQdVv2",
      },
    };
    const priceId = priceIds[planId]?.[billingCycle];
    if (!priceId) return json({ error: "This plan price is not configured." }, 503);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: existing } = await admin
      .from("subscriptions")
      .select("stripe_customer_id,status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.stripe_customer_id && ["active", "trialing", "past_due", "unpaid"].includes(existing.status)) {
      return json({ error: "You already have a subscription. Open Manage billing to change or cancel it." }, 409);
    }

    let customerId = existing?.stripe_customer_id ?? null;
    if (!customerId) {
      const customerParams = new URLSearchParams();
      customerParams.set("email", user.email ?? "");
      customerParams.set("metadata[user_id]", user.id);
      const customer = await stripePost("customers", customerParams, stripeSecret);
      customerId = customer.id as string;
      const { error: saveCustomerError } = await admin.from("subscriptions").upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        plan_id: "free",
        status: "inactive",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (saveCustomerError) throw new Error("Could not save the billing customer. Please try again.");
    }

    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("customer", customerId);
    params.set("client_reference_id", user.id);
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", "1");
    params.set("allow_promotion_codes", "true");
    params.set("success_url", `${appUrl.replace(/\/$/, "")}/settings?billing=success`);
    params.set("cancel_url", `${appUrl.replace(/\/$/, "")}/settings?billing=cancelled`);
    params.set("metadata[user_id]", user.id);
    params.set("metadata[plan_id]", planId);
    params.set("subscription_data[metadata][user_id]", user.id);
    params.set("subscription_data[metadata][plan_id]", planId);

    const session = await stripePost("checkout/sessions", params, stripeSecret);
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return json({ url: session.url });
  } catch (error) {
    console.error("create-checkout-session failed:", error);
    return json({ error: error instanceof Error ? error.message : "Unable to start checkout." }, 500);
  }
});
