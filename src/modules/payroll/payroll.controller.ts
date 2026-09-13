import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Header,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { PayrollService } from './payroll.service';
import { SetSalaryStructureDto } from './dto/set-salary-structure.dto';
import { UpdatePayrollConfigDto } from './dto/update-payroll-config.dto';
import { CalculatePayrollBatchDto } from './dto/calculate-payroll-batch.dto';
import { DisburseBatchDto } from './dto/disburse-batch.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@Controller('api/v1/payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // ---------------------------------------------------------------------------
  // 1. Compliance Configuration Endpoints
  // ---------------------------------------------------------------------------

  /**
   * GET /api/v1/payroll/configuration
   * View tenant statutory and compliance configurations
   */
  @Get('configuration')
  @Roles(Role.FINANCE, Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async getConfiguration(@CurrentUser() user: AuthenticatedUser) {
    return this.payrollService.getConfiguration(user.organizationId);
  }

  /**
   * PATCH /api/v1/payroll/configuration
   * Update compliance configuration parameters (FINANCE only)
   */
  @Patch('configuration')
  @Roles(Role.FINANCE)
  async updateConfiguration(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePayrollConfigDto,
  ) {
    return this.payrollService.updateConfiguration(user.organizationId, dto);
  }

  // ---------------------------------------------------------------------------
  // 2. Salary Structure Endpoints
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/payroll/salary-structures
   * Define or revise an employee's salary structure (FINANCE only)
   */
  @Post('salary-structures')
  @Roles(Role.FINANCE)
  async setSalaryStructure(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetSalaryStructureDto,
  ) {
    return this.payrollService.setSalaryStructure(user.organizationId, dto, user.id);
  }

  /**
   * GET /api/v1/payroll/salary-structures/:employeeId
   * Retrieve salary structure revision history for an employee
   */
  @Get('salary-structures/:employeeId')
  @Roles(Role.FINANCE, Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async getSalaryHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('employeeId') employeeId: string,
  ) {
    return this.payrollService.getSalaryHistory(user.organizationId, employeeId);
  }

  // ---------------------------------------------------------------------------
  // 3. Payroll Batch Calculation & Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/payroll/batches/calculate
   * Compute or recalculate a monthly DRAFT payroll batch (FINANCE only)
   */
  @Post('batches/calculate')
  @Roles(Role.FINANCE)
  async calculateBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CalculatePayrollBatchDto,
  ) {
    return this.payrollService.calculateBatch(user.organizationId, dto, user.id);
  }

  /**
   * GET /api/v1/payroll/batches
   * List all payroll batches for organization
   */
  @Get('batches')
  @Roles(Role.FINANCE, Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async getBatches(@CurrentUser() user: AuthenticatedUser) {
    return this.payrollService.getBatches(user.organizationId);
  }

  /**
   * GET /api/v1/payroll/batches/:id
   * View details of a specific payroll batch including all payslips
   */
  @Get('batches/:id')
  @Roles(Role.FINANCE, Role.CLIENT_SUPER_ADMIN, Role.HR_ADMIN)
  async getBatchById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.payrollService.getBatchById(user.organizationId, id);
  }

  /**
   * PATCH /api/v1/payroll/batches/:id/lock
   * Lock a draft batch to prevent further modifications (FINANCE only)
   */
  @Patch('batches/:id/lock')
  @Roles(Role.FINANCE)
  async lockBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.payrollService.lockBatch(user.organizationId, id, user.id);
  }

  /**
   * POST /api/v1/payroll/batches/:id/disburse
   * Disburse a locked batch with transaction reference (FINANCE only)
   */
  @Post('batches/:id/disburse')
  @Roles(Role.FINANCE)
  async disburseBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DisburseBatchDto,
  ) {
    return this.payrollService.disburseBatch(user.organizationId, id, dto, user.id);
  }

  /**
   * GET /api/v1/payroll/batches/:id/bank-advice
   * Export corporate bank payment advice in JSON or CSV format (FINANCE only)
   */
  @Get('batches/:id/bank-advice')
  @Roles(Role.FINANCE)
  async getBankAdvice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('format') format: 'json' | 'csv' = 'json',
    @Res() res: Response,
  ) {
    const result = await this.payrollService.getBankAdvice(user.organizationId, id, format);
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="bank_advice_${id}.csv"`,
      );
      return res.send(result);
    }
    return res.json(result);
  }

  // ---------------------------------------------------------------------------
  // 4. Employee Self-Service (ESS) & Payslip Viewing
  // ---------------------------------------------------------------------------

  /**
   * GET /api/v1/payroll/my-payslips
   * ESS endpoint: Retrieve personal payslips for current logged-in employee
   */
  @Get('my-payslips')
  async getMyPayslips(@CurrentUser() user: AuthenticatedUser) {
    const empId = user.employeeId;
    if (!empId) {
      return [];
    }
    return this.payrollService.getMyPayslips(user.organizationId, empId);
  }

  /**
   * GET /api/v1/payroll/payslips/:id
   * View individual payslip by ID (with authorization check)
   */
  @Get('payslips/:id')
  async getPayslipById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.payrollService.getPayslipById(user.organizationId, id, user);
  }

  /**
   * GET /api/v1/payroll/payslips/:id/view
   * View printable HTML representation of payslip (zero external binary dependencies)
   */
  @Get('payslips/:id/view')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async renderPrintablePayslip(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.payrollService.renderPrintablePayslip(user.organizationId, id, user);
  }
}
