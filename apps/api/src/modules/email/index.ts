export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email Service Stub (Phase 0)
 *
 * Scaffolding for transactional notifications via Resend:
 * - Scan completed notifications
 * - New exposure alerts
 * - Verification reminders
 */
export class EmailService {
  async sendEmail(options: SendEmailOptions): Promise<{ id: string; success: boolean }> {
    if (process.env.RESEND_API_KEY) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || "LeakLens <notifications@leaklens.com>",
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
          }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          return { id: (data as any)?.id || `resend_${Date.now()}`, success: true };
        }
      } catch (err) {
        console.warn("[EmailService] Resend delivery failed, falling back to log:", err);
      }
    }

    console.log(`[EmailService] Notification for ${options.to}: "${options.subject}"`);
    return {
      id: `simulated_msg_${Date.now()}`,
      success: true,
    };
  }

  async sendScanCompletedNotification(to: string, hostname: string, score: number, findingsCount: number) {
    return this.sendEmail({
      to,
      subject: `LeakLens Scan Results: ${hostname} (Score: ${score}/100)`,
      html: `<p>Your read-only scan for <strong>${hostname}</strong> has finished.</p><p>Exposure score: <strong>${score}/100</strong>.</p><p>Findings: ${findingsCount}.</p>`,
    });
  }
}

export const emailService = new EmailService();
