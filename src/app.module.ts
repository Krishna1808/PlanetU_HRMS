import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MastersModule } from './modules/masters/masters.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { EssModule } from './modules/ess/ess.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { OffboardingModule } from './modules/offboarding/offboarding.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MastersModule,
    EmployeesModule,
    ShiftsModule,
    LeavesModule,
    AttendanceModule,
    PayrollModule,
    EssModule,
    OnboardingModule,
    OffboardingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
