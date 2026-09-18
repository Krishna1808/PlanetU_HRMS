import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { LeavesModule } from '../leaves/leaves.module';
import { PayrollModule } from '../payroll/payroll.module';
import { OffboardingService } from './offboarding.service';
import { OffboardingController } from './offboarding.controller';

@Module({
  imports: [PrismaModule, AttendanceModule, LeavesModule, PayrollModule],
  controllers: [OffboardingController],
  providers: [OffboardingService],
  exports: [OffboardingService],
})
export class OffboardingModule {}
