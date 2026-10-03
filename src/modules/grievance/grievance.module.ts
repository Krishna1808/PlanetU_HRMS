import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notifications/notification.module';
import { MailModule } from '../mail/mail.module';
import { GrievanceService } from './grievance.service';
import { GrievanceController } from './grievance.controller';

@Module({
  imports: [PrismaModule, NotificationModule, MailModule],
  controllers: [GrievanceController],
  providers: [GrievanceService],
  exports: [GrievanceService],
})
export class GrievanceModule {}
