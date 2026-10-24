import { z } from "zod";

export const PlanTierSchema = z.enum(["free", "pro", "pay_per_scan", "agency"]);
export type PlanTier = z.infer<typeof PlanTierSchema>;

export const PlanConfigSchema = z.object({
  id: PlanTierSchema,
  name: z.string(),
  description: z.string(),
  priceCents: z.number().int().nonnegative(),
  billingInterval: z.enum(["one_time", "month"]).default("month"),
  limits: z.object({
    maxVerifiedDomains: z.number().int().nonnegative(),
    scansPerMonth: z.number().int().nonnegative(),
    scheduledRescans: z.boolean(),
    alertsEnabled: z.boolean(),
    brandedReports: z.boolean(),
  }),
});

export type PlanConfig = z.infer<typeof PlanConfigSchema>;

export const PLANS: Record<PlanTier, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    description: "Essential passive exposure checks for solo builders.",
    priceCents: 0,
    billingInterval: "month",
    limits: {
      maxVerifiedDomains: 1,
      scansPerMonth: 3,
      scheduledRescans: false,
      alertsEnabled: false,
      brandedReports: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Continuous passive monitoring, scheduled rescans, and instant alerts.",
    priceCents: 1900, // $19 / mo
    billingInterval: "month",
    limits: {
      maxVerifiedDomains: 5,
      scansPerMonth: 50,
      scheduledRescans: true,
      alertsEnabled: true,
      brandedReports: false,
    },
  },
  pay_per_scan: {
    id: "pay_per_scan",
    name: "Single Scan Pass",
    description: "One-off comprehensive scan with 7-day recheck window.",
    priceCents: 900, // $9 one-off
    billingInterval: "one_time",
    limits: {
      maxVerifiedDomains: 1,
      scansPerMonth: 1,
      scheduledRescans: false,
      alertsEnabled: false,
      brandedReports: false,
    },
  },
  agency: {
    id: "agency",
    name: "Agency / Freelancer",
    description: "Manage multiple client apps with branded remediation reports.",
    priceCents: 7900, // $79 / mo
    billingInterval: "month",
    limits: {
      maxVerifiedDomains: 25,
      scansPerMonth: 500,
      scheduledRescans: true,
      alertsEnabled: true,
      brandedReports: true,
    },
  },
};
