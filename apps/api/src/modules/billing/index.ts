import { PlanTier, PLANS } from "@leaklens/shared";

export interface CreateCheckoutSessionInput {
  userId: string;
  plan: PlanTier;
  provider: "lemon_squeezy" | "paddle" | "paystack";
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  checkoutUrl: string;
  providerSessionId: string;
}

/**
 * Billing Module Stub (Phase 0)
 *
 * Prepared for Lemon Squeezy / Paddle (merchant of record) and Paystack (local cards).
 * Phase 3 will implement provider webhooks and customer portal integration.
 */
export class BillingService {
  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSessionResult> {
    const planConfig = PLANS[input.plan];
    if (!planConfig) {
      throw new Error(`Unknown plan tier: ${input.plan}`);
    }

    // Scaffolding stub
    return {
      checkoutUrl: `https://checkout.placeholder.leaklens.com/${input.provider}?plan=${input.plan}&amount=${planConfig.priceCents}`,
      providerSessionId: `stub_session_${Date.now()}`,
    };
  }

  async handleWebhook(_provider: string, _payload: unknown, _signature: string): Promise<{ received: boolean }> {
    // Webhook verification stub
    return { received: true };
  }
}

export const billingService = new BillingService();
