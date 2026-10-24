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
  async sendEmail(_options: SendEmailOptions): Promise<{ id: string; success: boolean }> {
    // Phase 0 stub: log to console or return simulated delivery
    return {
      id: `stub_resend_msg_${Date.now()}`,
      success: true,
    };
  }

  async sendScanCompletedNotification(to: string, hostname: string, score: number, findingsCount: number) {
    return this.sendEmail({
      to,
      subject: `LeakLens Scan Results: ${hostname} (Score: ${score}/100)`,
      html: `<p>Your read-only scan for <strong>${hostname}</strong> has finished. Exposure score: ${score}/100. Findings: ${findingsCount}.</p>`,
    });
  }
}

export const emailService = new EmailService();
