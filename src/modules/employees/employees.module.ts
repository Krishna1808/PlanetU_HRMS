import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeeService } from './services/employee.service';
import { EmployeeSequenceService } from './services/employee-sequence.service';
import { EmployeeRbacService } from './services/employee-rbac.service';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeeService, EmployeeSequenceService, EmployeeRbacService],
  exports: [EmployeeService, EmployeeSequenceService, EmployeeRbacService],
})
export class EmployeesModule {}
