import type { PaymentProviderName } from "./core";

export type PaymentMode = "test" | "live";

export interface PaymentRuntimeConfig {
  mode: PaymentMode;
  provider: PaymentProviderName;
  configured: boolean;
  missing: string[];
  callbackUrl: string | null;
  webhookUrl: string | null;
  paystackSecret: string | null;
  pesapalBaseUrl: string | null;
  pesapalConsumerKey: string | null;
  pesapalConsumerSecret: string | null;
  pesapalIpnId: string | null;
  pesapalIpnUrl: string | null;
  pesapalUsername: string | null;
}

function present(value: string | undefined): string | null {
  const clean = value?.trim();
  if (!clean || /^(replace_me|your[-_]|example|change[-_]?me)/i.test(clean)) return null;
  return clean;
}

function publicHttpsUrl(value: string | undefined): string | null {
  const candidate = present(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (["example.com", "www.example.com", "localhost"].includes(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function getPaymentRuntimeConfig(env: Record<string, string | undefined> = process.env): PaymentRuntimeConfig {
  // Missing PAYMENT_TEST_MODE means test mode. Only an explicit false opts into live.
  const mode: PaymentMode = env.PAYMENT_TEST_MODE?.trim().toLowerCase() === "false" ? "live" : "test";
  const provider: PaymentProviderName = env.PAYMENT_PROVIDER?.trim().toLowerCase() === "pesapal" ? "pesapal" : "paystack";
  const callbackUrl = publicHttpsUrl(provider === "paystack" ? env.PAYSTACK_CALLBACK_URL : env.PESAPAL_CALLBACK_URL);
  const webhookUrl = provider === "paystack" ? publicHttpsUrl(env.PAYSTACK_WEBHOOK_URL) : null;
  const missing: string[] = [];
  let paystackSecret: string | null = null;
  let pesapalConsumerKey: string | null = null;
  let pesapalConsumerSecret: string | null = null;
  let pesapalIpnId: string | null = null;
  let pesapalIpnUrl: string | null = null;
  let pesapalUsername: string | null = null;
  let pesapalBaseUrl: string | null = null;

  if (provider === "paystack") {
    paystackSecret = present(env.PAYSTACK_SECRET_KEY);
    const validPrefix = mode === "test" ? "sk_test_" : "sk_live_";
    if (!paystackSecret || !paystackSecret.startsWith(validPrefix)) missing.push("PAYSTACK_SECRET_KEY");
    if (!callbackUrl) missing.push("PAYSTACK_CALLBACK_URL (public HTTPS URL)");
    if (mode === "live" && !webhookUrl) missing.push("PAYSTACK_WEBHOOK_URL (public HTTPS URL configured with Paystack)");
  } else {
    pesapalConsumerKey = present(env.PESAPAL_CONSUMER_KEY);
    pesapalConsumerSecret = present(env.PESAPAL_CONSUMER_SECRET);
    pesapalIpnId = present(env.PESAPAL_IPN_ID);
    pesapalIpnUrl = publicHttpsUrl(env.PESAPAL_IPN_URL);
    const environment = env.PESAPAL_ENVIRONMENT?.trim().toLowerCase();
    const expectedEnvironment = mode === "test" ? "sandbox" : "production";
    if (!pesapalConsumerKey) missing.push("PESAPAL_CONSUMER_KEY");
    if (!pesapalConsumerSecret) missing.push("PESAPAL_CONSUMER_SECRET");
    if (!pesapalIpnId) missing.push("PESAPAL_IPN_ID (registered merchant IPN)");
    if (!callbackUrl) missing.push("PESAPAL_CALLBACK_URL (public HTTPS URL)");
    if (mode === "live" && !pesapalIpnUrl) missing.push("PESAPAL_IPN_URL (registered public HTTPS IPN endpoint)");
    if (environment !== expectedEnvironment) missing.push(`PESAPAL_ENVIRONMENT=${expectedEnvironment}`);
    pesapalUsername = present(env.PESAPAL_USERNAME);
    pesapalBaseUrl = mode === "test" ? "https://pay.pesapal.com/v3" : "https://pay.pesapal.com/v3";
    if (mode === "test") pesapalBaseUrl = "https://cybqa.pesapal.com/pesapalv3";
  }

  return {
    mode,
    provider,
    configured: missing.length === 0,
    missing,
    callbackUrl,
    webhookUrl,
    paystackSecret,
    pesapalBaseUrl,
    pesapalConsumerKey,
    pesapalConsumerSecret,
    pesapalIpnId,
    pesapalIpnUrl,
    pesapalUsername,
  };
}

export function paymentsUnavailableResponse(): Response {
  return Response.json(
    { error: "Payments are not configured. Contact the school administrator." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
