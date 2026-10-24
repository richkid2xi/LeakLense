import { z } from "zod";

export const DomainStatusSchema = z.enum(["pending_verification", "verified", "failed", "expired"]);
export type DomainStatus = z.infer<typeof DomainStatusSchema>;

export const HostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(253)
  .refine(
    (val) => {
      // Must not contain protocol, port, or path
      if (val.includes("://") || val.includes("/") || val.includes(":") || val.includes("@")) {
        return false;
      }
      // Must contain at least one dot
      if (!val.includes(".")) {
        return false;
      }
      // Reject localhost / loopback addresses
      if (val === "localhost" || val === "127.0.0.1" || val === "::1") {
        return false;
      }
      // Basic RFC 1123 hostname regex
      const hostnameRegex = /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$/;
      return hostnameRegex.test(val);
    },
    { message: "Must be a valid, public hostname without protocol, port, or path (e.g., app.example.com)" }
  );

export const DomainSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  hostname: HostnameSchema,
  status: DomainStatusSchema.default("pending_verification"),
  verifiedAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Domain = z.infer<typeof DomainSchema>;

export const CreateDomainInputSchema = z.object({
  hostname: HostnameSchema,
});

export type CreateDomainInput = z.infer<typeof CreateDomainInputSchema>;
