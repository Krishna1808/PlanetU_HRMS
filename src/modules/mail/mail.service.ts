import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  renderEmailTemplate,
  EmailRenderInput,
  RenderedEmail,
} from './templates/email-templates';

export interface SendNotificationEmailDto extends EmailRenderInput {
  to: string;
}

function parseSenderAddress(fromHeader?: string): { name: string; email: string } {
  const defaultEmail = process.env.SMTP_USER || 'notifications@planetu.com';
  if (!fromHeader) {
    return { name: 'PlanetU HRMS', email: defaultEmail };
  }
  const match = fromHeader.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    return {
      name: match[1].replace(/['"]/g, '').trim() || 'PlanetU HRMS',
      email: match[2].trim(),
    };
  }
  return { name: 'PlanetU HRMS', email: fromHeader.trim() };
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private isConfigured = false;

  async onModuleInit() {
    // Non-blocking initialization so external network delays never block server port binding
    this.initializeTransporter().catch((err: any) => {
      this.logger.warn(`SMTP initialization warning: ${err.message}`);
    });
  }

  private async initializeTransporter() {
    const brevoApiKey = process.env.BREVO_API_KEY?.trim();
    if (brevoApiKey) {
      this.isConfigured = true;
      this.logger.log('Brevo HTTPS REST API active (Port 443 - Bypasses Render free tier SMTP blocks, sends to ANY recipient).');
      return;
    }

    const resendApiKey = process.env.RESEND_API_KEY || (process.env.SMTP_PASS?.startsWith('re_') ? process.env.SMTP_PASS.trim() : null);
    if (resendApiKey) {
      this.isConfigured = true;
      this.logger.log('Resend HTTPS REST API active (Port 443 - Bypasses Render free tier SMTP blocks).');
      return;
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 465;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();

    if (user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 10000,
          tls: {
            rejectUnauthorized: false,
          },
        });

        // Verify with 5-second timeout so it never hangs server startup
        await Promise.race([
          this.transporter.verify(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SMTP connection verification timed out after 5s')), 5000),
          ),
        ]);

        this.isConfigured = true;
        this.logger.log(`SMTP transporter verified successfully for ${host}:${port} (${user})`);
      } catch (err: any) {
        this.logger.warn(
          `SMTP verification failed: ${err.message}. Email dispatch will log to console until valid credentials are provided.`,
        );
        this.transporter = null;
        this.isConfigured = false;
      }
    } else {
      this.logger.log(
        `No live email provider API key or SMTP set. Operating in Zero-Cost Local Simulation mode.`,
      );
      this.isConfigured = false;
    }
  }

  /**
   * Dispatches an email notification using pre-rendered HTML templates.
   */
  async sendNotificationEmail(dto: SendNotificationEmailDto): Promise<{ success: boolean; messageId?: string; mode: string }> {
    const rendered: RenderedEmail = renderEmailTemplate(dto);

    // 1. Brevo HTTPS REST API (Port 443 - Can send to ANY recipient in the world without a domain!)
    const brevoApiKey = process.env.BREVO_API_KEY?.trim();
    if (brevoApiKey) {
      try {
        const sender = parseSenderAddress(process.env.MAIL_FROM);
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoApiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            sender,
            to: [{ email: dto.to, name: dto.recipientName || dto.to.split('@')[0] }],
            subject: rendered.subject,
            htmlContent: rendered.html,
            textContent: rendered.text,
          }),
        });

        const data: any = await response.json();
        if (response.ok && data.messageId) {
          this.logger.log(`Email dispatched via Brevo HTTPS API to ${dto.to} [Subject: ${rendered.subject}] (ID: ${data.messageId})`);
          return { success: true, messageId: data.messageId, mode: 'brevo_https' };
        } else {
          const errMsg = data.message || JSON.stringify(data);
          this.logger.error(`Brevo HTTPS API error (${response.status}): ${errMsg}`);
          this.logSimulatedEmail(dto, rendered);
          return { success: false, mode: 'brevo_api_error', messageId: errMsg };
        }
      } catch (err: any) {
        this.logger.error(`Failed to dispatch email via Brevo HTTPS API to ${dto.to}: ${err.message}`);
        this.logSimulatedEmail(dto, rendered);
        return { success: false, mode: 'brevo_api_failed' };
      }
    }

    // 2. Resend HTTPS REST API (Port 443)
    const resendApiKey = process.env.RESEND_API_KEY || (process.env.SMTP_PASS?.startsWith('re_') ? process.env.SMTP_PASS.trim() : null);
    if (resendApiKey) {
      try {
        const from = process.env.MAIL_FROM || 'PlanetU HRMS <onboarding@resend.dev>';
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [dto.to],
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
          }),
        });

        const data: any = await response.json();
        if (response.ok && data.id) {
          this.logger.log(`Email dispatched via Resend HTTPS API to ${dto.to} [Subject: ${rendered.subject}] (ID: ${data.id})`);
          return { success: true, messageId: data.id, mode: 'resend_https' };
        } else {
          const errMsg = data.message || JSON.stringify(data);
          this.logger.error(`Resend HTTPS API returned error (${response.status}): ${errMsg}`);
          this.logSimulatedEmail(dto, rendered);
          return { success: false, mode: 'resend_api_error', messageId: errMsg };
        }
      } catch (err: any) {
        this.logger.error(`Failed to dispatch email via Resend HTTPS API to ${dto.to}: ${err.message}`);
        this.logSimulatedEmail(dto, rendered);
        return { success: false, mode: 'resend_api_failed' };
      }
    }

    // 3. Nodemailer SMTP (For environments where ports 465/587 are not blocked)
    const from = process.env.MAIL_FROM || `PlanetU HRMS <${process.env.SMTP_USER || 'notifications@planetu.com'}>`;
    if (this.isConfigured && this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from,
          to: dto.to,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
        });

        this.logger.log(
          `Email dispatched to ${dto.to} [Subject: ${rendered.subject}] (MessageId: ${info.messageId})`,
        );
        return { success: true, messageId: info.messageId, mode: 'live_smtp' };
      } catch (err: any) {
        this.logger.error(`Failed to send real-time email to ${dto.to}: ${err.message}`, err.stack);
        this.logSimulatedEmail(dto, rendered);
        return { success: false, mode: 'smtp_failed' };
      }
    }

    // 4. Otherwise, use zero-cost console simulation mode
    this.logSimulatedEmail(dto, rendered);
    return { success: true, mode: 'simulated_envelope' };
  }

  /**
   * Helper method to send a test email directly to verify connectivity.
   */
  async sendTestEmail(toEmail: string): Promise<{ success: boolean; message: string; details?: any }> {
    if (!this.isConfigured) {
      await this.initializeTransporter();
    }

    const testPayload: SendNotificationEmailDto = {
      to: toEmail,
      recipientName: 'PlanetU Tester',
      type: 'TEST_EMAIL',
      title: 'Realtime Email Notification System Active',
      message: 'Your PlanetU HRMS real-time email notification engine is working successfully over HTTPS! All employee leave updates, payslip releases, and critical alerts will now arrive instantly.',
      actionUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
      metadata: {
        timestamp: new Date().toISOString(),
        host: process.env.BREVO_API_KEY ? 'api.brevo.com' : (process.env.SMTP_HOST || 'api.resend.com'),
        user: process.env.BREVO_API_KEY ? '(brevo_api_key)' : (process.env.SMTP_USER || '(api_key)'),
      },
    };

    const result = await this.sendNotificationEmail(testPayload);

    if (result.success && result.mode === 'brevo_https') {
      return {
        success: true,
        message: `Live test email dispatched successfully to ${toEmail} via Brevo HTTPS API (Port 443)! Check your inbox.`,
        details: result,
      };
    }

    if (result.success && result.mode === 'resend_https') {
      return {
        success: true,
        message: `Live test email dispatched successfully to ${toEmail} via Resend HTTPS API (Port 443)! Check your inbox.`,
        details: result,
      };
    }

    if (result.success && result.mode === 'live_smtp') {
      return {
        success: true,
        message: `Live test email dispatched successfully to ${toEmail} via SMTP! Check your inbox.`,
        details: result,
      };
    }

    if (!result.success && result.mode === 'brevo_api_error') {
      return {
        success: false,
        message: `Brevo error: ${result.messageId || 'Request rejected'}. (Tip: Ensure your sender email in MAIL_FROM is verified in your Brevo account).`,
        details: result,
      };
    }

    if (!result.success && result.mode === 'resend_api_error') {
      return {
        success: false,
        message: `Resend error: ${result.messageId || 'Request rejected'}. (Note: Resend free sandbox only sends to your registered Resend email address until a domain is added at resend.com/domains).`,
        details: result,
      };
    }

    return {
      success: true,
      message: `Test email logged in local simulation mode (MessageId: ${result.messageId || 'local-sim'}). To send real emails, set BREVO_API_KEY in Render.`,
      details: result,
    };
  }

  /**
   * Zero-cost visual terminal representation of the email.
   */
  private logSimulatedEmail(dto: SendNotificationEmailDto, rendered: RenderedEmail) {
    const border = '═'.repeat(68);
    const line = '─'.repeat(68);

    const logEnvelope = `
╔${border}╗
║ [EMAIL ENGINE - SIMULATED DELIVERY]                                 ║
╠${border}╣
║ To:         ${dto.to.padEnd(54)}║
║ Subject:    ${rendered.subject.substring(0, 52).padEnd(54)}║
║ Type:       ${dto.type.padEnd(54)}║
║ Time:       ${new Date().toISOString().padEnd(54)}║
╠${line}╣
║ Message:                                                           ║
║ ${dto.message.padEnd(67)}║
╚${border}╝`;

    this.logger.log(logEnvelope);
  }
}
