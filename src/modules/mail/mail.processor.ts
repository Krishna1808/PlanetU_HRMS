import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MailService, SendNotificationEmailDto } from './mail.service';

/**
 * BullMQ Worker for asynchronous email delivery.
 * Consumes jobs from the 'mail-queue' in Redis without delaying incoming HTTP requests.
 */
@Processor('mail-queue')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  /**
   * Processes a queued email delivery job.
   * If SMTP or network errors occur, throwing causes BullMQ to trigger configured retry attempts.
   */
  async process(job: Job<SendNotificationEmailDto>): Promise<any> {
    this.logger.log(`Processing email job #${job.id} [${job.name}] for recipient: ${job.data.to}`);
    try {
      const result = await this.mailService.sendNotificationEmail(job.data);
      return result;
    } catch (err: any) {
      this.logger.error(`Email job #${job.id} failed: ${err.message}`, err.stack);
      throw err;
    }
  }
}
