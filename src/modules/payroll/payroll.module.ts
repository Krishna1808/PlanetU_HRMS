import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PayslipPdfService } from './services/payslip-pdf.service';

@Module({
  imports: [PrismaModule, AttendanceModule],
  controllers: [PayrollController],
  providers: [PayrollService, PayslipPdfService],
  exports: [PayrollService, PayslipPdfService],
})
export class PayrollModule {}

