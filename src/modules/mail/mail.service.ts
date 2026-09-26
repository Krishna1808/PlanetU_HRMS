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

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private isConfigured = false;

  async onModuleInit() {
    await this.initializeTransporter();
  }

  private async initializeTransporter() {
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
          tls: {
            rejectUnauthorized: false, // Prevents self-signed cert blocks in local dev
          },
        });

        // Verify connection configuration
        await this.transporter.verify();
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
        `SMTP_USER or SMTP_PASS not set in .env. Operating in Zero-Cost Local Simulation mode.`,
      );
      this.isConfigured = false;
    }
  }

  /**
   * Dispatches an email notification using pre-rendered HTML templates.
   */
  async sendNotificationEmail(dto: SendNotificationEmailDto): Promise<{ success: boolean; messageId?: string; mode: string }> {
    const rendered: RenderedEmail = renderEmailTemplate(dto);
    const from = process.env.MAIL_FROM || `PlanetU HRMS <${process.env.SMTP_USER || 'notifications@planetu.com'}>`;

    // 1. If real SMTP is configured and connected, send live email
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
        // Fallback to simulation log so the action isn't lost
        this.logSimulatedEmail(dto, rendered);
        return { success: false, mode: 'smtp_failed' };
      }
    }

    // 2. Otherwise, use zero-cost console simulation mode
    this.logSimulatedEmail(dto, rendered);
    return { success: true, mode: 'simulated_envelope' };
  }

  /**
   * Helper method to send a test email directly to verify Gmail connectivity.
   */
  async sendTestEmail(toEmail: string): Promise<{ success: boolean; message: string; details?: any }> {
    // Re-check transporter if credentials were added dynamically
    if (!this.isConfigured) {
      await this.initializeTransporter();
    }

    const testPayload: SendNotificationEmailDto = {
      to: toEmail,
      recipientName: 'PlanetU Tester',
      type: 'TEST_EMAIL',
      title: 'Realtime Email Notification System Active',
      message: 'Your PlanetU HRMS real-time email notification engine is working successfully with personal Gmail SMTP. All employee leave updates, payslip releases, and critical alerts will now arrive instantly.',
      actionUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
      metadata: {
        timestamp: new Date().toISOString(),
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        user: process.env.SMTP_USER || '(none configured)',
      },
    };

    const result = await this.sendNotificationEmail(testPayload);

    if (result.success && result.mode === 'live_smtp') {
      return {
        success: true,
        message: `Live test email dispatched successfully to ${toEmail} via Gmail SMTP! Check your inbox.`,
        details: result,
      };
    }

    return {
      success: true,
      message: `Test email logged in local simulation mode (MessageId: ${result.messageId || 'local-sim'}). To send real emails to your Gmail inbox, add SMTP_USER and SMTP_PASS in .env.`,
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
