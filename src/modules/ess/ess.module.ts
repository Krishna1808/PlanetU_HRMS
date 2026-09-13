import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmployeesModule } from '../employees/employees.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { LeavesModule } from '../leaves/leaves.module';
import { PayrollModule } from '../payroll/payroll.module';
import { EssController } from './ess.controller';
import { EssService } from './ess.service';

@Module({
  imports: [
    PrismaModule,
    EmployeesModule,
    ShiftsModule,
    AttendanceModule,
    LeavesModule,
    PayrollModule,
  ],
  controllers: [EssController],
  providers: [EssService],
  exports: [EssService],
})
export class EssModule {}
