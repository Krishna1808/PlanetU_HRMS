import { jest } from '@jest/globals';
import { MailService } from '../src/modules/mail/mail.service';
import { MailProcessor } from '../src/modules/mail/mail.processor';
import { renderEmailTemplate } from '../src/modules/mail/templates/email-templates';

describe('Mail Module (Real-Time Email Notifications & Templates)', () => {
  describe('Email Templates (renderEmailTemplate)', () => {
    it('should render Leave Status email with badge, dates, and action button', () => {
      const rendered = renderEmailTemplate({
        recipientName: 'Aarav Patel',
        type: 'LEAVE_STATUS',
        title: 'Leave Request Approved',
        message: 'Your Paid Leave request has been approved by your manager.',
        actionUrl: 'http://localhost:5173/leaves',
        metadata: {
          leaveTypeName: 'Paid Leave',
          startDate: '2026-10-01',
          endDate: '2026-10-05',
          status: 'APPROVED',
        },
      });

      expect(rendered.subject).toBe('[PlanetU HRMS] Leave Request Approved');
      expect(rendered.html).toContain('LEAVE APPROVED');
      expect(rendered.html).toContain('Aarav Patel');
      expect(rendered.html).toContain('Paid Leave');
      expect(rendered.html).toContain('2026-10-01 to 2026-10-05');
      expect(rendered.html).toContain('http://localhost:5173/leaves');
      expect(rendered.text).toContain('[PlanetU HRMS] Leave Request Approved');
    });

    it('should render Payslip Released email with month and year', () => {
      const rendered = renderEmailTemplate({
        recipientName: 'Diya Sharma',
        type: 'PAYSLIP_RELEASED',
        title: 'Payslip Released: 09/2026',
        message: 'Your salary payslip for September 2026 is now available.',
        actionUrl: 'http://localhost:5173/payroll',
        metadata: {
          month: 9,
          year: 2026,
        },
      });

      expect(rendered.subject).toBe('[PlanetU HRMS] Payslip Released: 09/2026');
      expect(rendered.html).toContain('PAYSLIP PUBLISHED');
      expect(rendered.html).toContain('Diya Sharma');
      expect(rendered.html).toContain('9/2026');
    });

    it('should render Termination Notice email with notice period and exit date', () => {
      const rendered = renderEmailTemplate({
        recipientName: 'Vikram Rao',
        type: 'TERMINATION_NOTICE',
        title: 'Official Notice of Termination',
        message: 'This email serves as formal notice regarding your employment status.',
        actionUrl: 'http://localhost:5173/offboarding',
        metadata: {
          noticePeriodDays: 30,
          dateOfExit: '2026-10-25',
        },
      });

      expect(rendered.subject).toBe('[PlanetU HRMS] Official Notice of Termination');
      expect(rendered.html).toContain('OFFICIAL NOTICE');
      expect(rendered.html).toContain('30 Days');
      expect(rendered.html).toContain('2026-10-25');
    });

    it('should render Test Connection email', () => {
      const rendered = renderEmailTemplate({
        recipientName: 'Admin',
        type: 'TEST_EMAIL',
        title: 'Email Delivery Check',
        message: 'Realtime email system connectivity verified.',
      });

      expect(rendered.subject).toBe('[PlanetU HRMS] Email Delivery Check');
      expect(rendered.html).toContain('TEST CONNECTION');
    });
  });

  describe('MailService', () => {
    let service: MailService;

    beforeEach(async () => {
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      service = new MailService();
      await service.onModuleInit();
    });

    it('should log to console and succeed when SMTP credentials are unset (local dev mode)', async () => {
      const result = await service.sendNotificationEmail({
        to: 'employee@example.com',
        recipientName: 'Employee Name',
        type: 'LEAVE_STATUS',
        title: 'Leave Approved',
        message: 'Your leave has been approved.',
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('simulated_envelope');
    });

    it('should send test email in simulation mode when credentials not configured', async () => {
      const result = await service.sendTestEmail('personal@gmail.com');
      expect(result.success).toBe(true);
      expect(result.message).toContain('simulation mode');
    });
  });

  describe('MailProcessor (BullMQ Background Worker)', () => {
    let processor: MailProcessor;
    let mockMailService: any;

    beforeEach(() => {
      mockMailService = {
        sendNotificationEmail: jest.fn().mockResolvedValue({
          success: true,
          mode: 'live_smtp',
          messageId: 'msg-12345',
        } as any),
      };
      processor = new MailProcessor(mockMailService);
    });

    it('should process job from queue and delegate to MailService', async () => {
      const mockJob: any = {
        id: 'job-99',
        name: 'send-notification-email',
        data: {
          to: 'test@gmail.com',
          recipientName: 'Test Recipient',
          type: 'PAYSLIP_RELEASED',
          title: 'Payslip Released',
          message: 'Your payslip is available.',
        },
      };

      const result = await processor.process(mockJob);
      expect(mockMailService.sendNotificationEmail).toHaveBeenCalledWith(mockJob.data);
      expect(result.success).toBe(true);
      expect(result.mode).toBe('live_smtp');
    });

    it('should rethrow error so BullMQ can trigger automatic retry', async () => {
      mockMailService.sendNotificationEmail.mockRejectedValue(new Error('SMTP connection timed out'));

      const mockJob: any = {
        id: 'job-100',
        name: 'send-notification-email',
        data: { to: 'fail@test.com' },
      };

      await expect(processor.process(mockJob)).rejects.toThrow('SMTP connection timed out');
    });
  });
});
