import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationEventBusService } from './notification-event-bus.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationEventBusService],
  exports: [NotificationService, NotificationEventBusService],
})
export class NotificationModule {}
