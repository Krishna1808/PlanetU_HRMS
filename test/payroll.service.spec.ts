import { jest } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PayrollBatchStatus, Role } from '@prisma/client';
import { PayrollService } from '../src/modules/payroll/payroll.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AttendanceService } from '../src/modules/attendance/attendance.service';
import { AuthenticatedUser } from '../src/common/types/authenticated-user.interface';

describe('PayrollService (Module 6: Payroll Engine & Statutory Compliance)', () => {
  let service: PayrollService;
  let mockPrisma: any;
  let mockAttendanceService: any;

  const orgId = 'org-test-123';
  const empId = 'emp-456';
  const userId = 'user-finance-789';

  const defaultPayrollConfig = {
    id: 'config-1',
    organizationId: orgId,
    pfCeilingAmount: 15000.0,
    applyPfCeiling: true,
    pfEmployeeRate: 12.0,
    pfEmployerRate: 12.0,
    applyEsi: true,
    esiThresholdAmount: 21000.0,
    esiEmployeeRate: 0.75,
    esiEmployerRate: 3.25,
    ptAmount: 200.0,
    ptSalaryThreshold: 10000.0,
    roundToWholeRupee: true,
    basicPercentage: 50.0,
    hraPercentage: 25.0,
    specialAllowancePercentage: 25.0,
  };

  beforeEach(() => {
    mockPrisma = {
      payrollConfiguration: {
        findUnique: jest.fn().mockResolvedValue(defaultPayrollConfig),
        create: jest.fn().mockImplementation(async (args: any) => ({
          id: 'config-new',
          ...args.data,
        })),
        update: jest.fn().mockImplementation(async (args: any) => ({
          ...defaultPayrollConfig,
          ...args.data,
        })),
      },
      payrollAdjustment: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async (args: any) => ({
          id: 'adj-new',
          ...args.data,
        })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn().mockImplementation(async (args: any) => ({
          id: args.where.id,
        })),
      },
      salaryStructure: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async (args: any) => ({
          id: 'sal-new',
          ...args.data,
        })),
        update: jest.fn().mockImplementation(async (args: any) => ({
          id: args.where.id,
          ...args.data,
        })),
      },
      payrollBatch: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async (args: any) => ({
          id: 'batch-new',
          ...args.data,
        })),
        update: jest.fn().mockImplementation(async (args: any) => ({
          id: args.where.id,
          ...args.data,
        })),
      },
      payslip: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: empId,
          organizationId: orgId,
          employeeCode: 'ENG-0001',
          firstName: 'John',
          lastName: 'Doe',
          bankName: 'HDFC Bank',
          accountNumber: '1234567890',
          ifscOrRouting: 'HDFC0001234',
          panNumber: 'ABCDE1234F',
          uanNumber: '100012345678',
          deletedAt: null,
          department: { name: 'Engineering' },
          designation: { name: 'Senior Software Engineer' },
          organization: { name: 'PlanetU Tech' },
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: empId,
            organizationId: orgId,
            employeeCode: 'ENG-0001',
            firstName: 'John',
            lastName: 'Doe',
            salaryStructures: [
              {
                id: 'sal-struct-1',
                organizationId: orgId,
                employeeId: empId,
                annualCtc: 600000.0,
                monthlyGross: 50000.0,
                basicSalary: 25000.0,
                hra: 12500.0,
                specialAllowance: 12500.0,
                effectiveFrom: new Date('2026-01-01'),
                effectiveTo: null,
              },
            ],
          },
        ]),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
    };

    mockAttendanceService = {
      getFinalizedPayableDays: jest.fn().mockResolvedValue({
        employeeId: empId,
        employeeCode: 'ENG-0001',
        employeeName: 'John Doe',
        year: 2026,
        month: 9, // September (30 days)
        totalMonthDays: 30,
        presentDays: 22,
        weeklyOffDays: 8,
        paidLeaveDays: 0,
        halfDays: 0,
        unexcusedAbsenceDays: 0,
        lwpDays: 0,
        payableDays: 30,
      }),
    };

    service = new PayrollService(
      mockPrisma as unknown as PrismaService,
      mockAttendanceService as unknown as AttendanceService,
    );
  });

  // ---------------------------------------------------------------------------
  // 1. Append-Only Salary Structure Ledger
  // ---------------------------------------------------------------------------
  describe('setSalaryStructure (Append-Only Ledger per Rule 4)', () => {
    it('should split annual CTC into 50% Basic, 25% HRA, 25% Special Allowance and create initial structure', async () => {
      mockPrisma.salaryStructure.findFirst.mockResolvedValue(null);

      const result = await service.setSalaryStructure(
        orgId,
        {
          employeeId: empId,
          annualCtc: 600000.0, // 50,000/mo
          effectiveFrom: '2026-01-01',
          revisionReason: 'Initial Joining',
        },
        userId,
      );

      expect(mockPrisma.salaryStructure.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: orgId,
          employeeId: empId,
          annualCtc: 600000.0,
          monthlyGross: 50000.0,
          basicSalary: 25000.0,
          hra: 12500.0,
          specialAllowance: 12500.0,
          effectiveTo: null,
          revisedByUserId: userId,
        }),
      });
      expect(result).toBeDefined();
    });

    it('should close previous active structure by setting effectiveTo and create new structure', async () => {
      const existingActive = {
        id: 'sal-old',
        organizationId: orgId,
        employeeId: empId,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
      };
      mockPrisma.salaryStructure.findFirst.mockResolvedValue(existingActive);

      await service.setSalaryStructure(
        orgId,
        {
          employeeId: empId,
          annualCtc: 720000.0, // 60,000/mo
          effectiveFrom: '2026-07-01',
          revisionReason: 'Mid-Year Promotion',
        },
        userId,
      );

      expect(mockPrisma.salaryStructure.update).toHaveBeenCalledWith({
        where: { id: 'sal-old' },
        data: { effectiveTo: new Date('2026-07-01') },
      });

      expect(mockPrisma.salaryStructure.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          annualCtc: 720000.0,
          monthlyGross: 60000.0,
          basicSalary: 30000.0,
          hra: 15000.0,
          specialAllowance: 15000.0,
          effectiveFrom: new Date('2026-07-01'),
          effectiveTo: null,
        }),
      });
    });

    it('should reject backdated revision where new effectiveFrom is before or equal to current active structure', async () => {
      mockPrisma.salaryStructure.findFirst.mockResolvedValue({
        id: 'sal-current',
        organizationId: orgId,
        employeeId: empId,
        effectiveFrom: new Date('2026-06-01'),
        effectiveTo: null,
      });

      await expect(
        service.setSalaryStructure(
          orgId,
          {
            employeeId: empId,
            annualCtc: 700000.0,
            effectiveFrom: '2026-05-01', // Before existing
          },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Attendance as Authoritative Single Source of Truth
  // ---------------------------------------------------------------------------
  describe('Attendance Single Source of Truth & Unexcused Absence Deduction', () => {
    it('should consume AttendanceService.getFinalizedPayableDays and deduct unexcused absences', async () => {
      // 10 unexcused absences in September (30 days total) -> 20 payable days
      mockAttendanceService.getFinalizedPayableDays.mockResolvedValue({
        employeeId: empId,
        employeeCode: 'ENG-0001',
        employeeName: 'John Doe',
        year: 2026,
        month: 9,
        totalMonthDays: 30,
        presentDays: 14,
        weeklyOffDays: 6,
        paidLeaveDays: 0,
        halfDays: 0,
        unexcusedAbsenceDays: 10,
        lwpDays: 0,
        payableDays: 20,
      });

      await service.calculateBatch(orgId, { year: 2026, month: 9 }, userId);

      expect(mockAttendanceService.getFinalizedPayableDays).toHaveBeenCalledWith(
        orgId,
        empId,
        2026,
        9,
      );

      expect(mockPrisma.payslip.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            employeeId: empId,
            totalMonthDays: 30,
            payableDays: 20,
            unexcusedAbsenceDays: 10,
            // Nominal basic = 25,000. Earned basic = 25,000 * (20/30) = 16,666.67
            nominalBasic: 25000.0,
            earnedBasic: 16666.67,
            nominalGross: 50000.0,
            earnedGross: 33333.33, // (16666.67 + 8333.33 + 8333.33)
          }),
        ],
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Prorated-then-PF Order of Operations (EPF Act compliant)
  // ---------------------------------------------------------------------------
  describe('Prorated-then-PF Order of Operations', () => {
    it('should compute PF strictly on earned basic wages rather than nominal full-month basic', async () => {
      // Nominal basic = 25,000. Payable days = 15/30.
      // Earned basic = 12,500.
      // Since 12,500 < 15,000 ceiling, PF basis is 12,500.
      // 12% of 12,500 = 1,500.00 (NOT 12% of 25,000 which would be 1,800 or 3,000).
      mockAttendanceService.getFinalizedPayableDays.mockResolvedValue({
        employeeId: empId,
        employeeCode: 'ENG-0001',
        employeeName: 'John Doe',
        year: 2026,
        month: 9,
        totalMonthDays: 30,
        presentDays: 11,
        weeklyOffDays: 4,
        paidLeaveDays: 0,
        halfDays: 0,
        unexcusedAbsenceDays: 15,
        lwpDays: 0,
        payableDays: 15,
      });

      await service.calculateBatch(orgId, { year: 2026, month: 9 }, userId);

      expect(mockPrisma.payslip.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            earnedBasic: 12500.0,
            employeePf: 1500.0,
            employerPf: 1500.0,
          }),
        ],
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Configurable PF Ceiling
  // ---------------------------------------------------------------------------
  describe('Configurable PF Ceiling (applyPfCeiling flag)', () => {
    it('with applyPfCeiling: true, should cap PF calculation basis at pfCeilingAmount (15,000)', async () => {
      // High earner: Nominal basic = 50,000 (Monthly gross 100,000)
      mockPrisma.employee.findMany.mockResolvedValue([
        {
          id: empId,
          organizationId: orgId,
          employeeCode: 'ENG-0001',
          salaryStructures: [
            {
              id: 'sal-high',
              organizationId: orgId,
              employeeId: empId,
              annualCtc: 1200000.0,
              monthlyGross: 100000.0,
              basicSalary: 50000.0,
              hra: 25000.0,
              specialAllowance: 25000.0,
              effectiveFrom: new Date('2026-01-01'),
              effectiveTo: null,
            },
          ],
        },
      ]);

      mockAttendanceService.getFinalizedPayableDays.mockResolvedValue({
        employeeId: empId,
        year: 2026,
        month: 9,
        totalMonthDays: 30,
        payableDays: 30,
        unexcusedAbsenceDays: 0,
        lwpDays: 0,
      });

      // Ceiling is 15,000. Cap applies. PF = 12% of 15,000 = 1,800.00
      await service.calculateBatch(orgId, { year: 2026, month: 9 }, userId);

      expect(mockPrisma.payslip.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            earnedBasic: 50000.0,
            employeePf: 1800.0,
            employerPf: 1800.0,
          }),
        ],
      });
    });

    it('with applyPfCeiling: false, should compute PF on full earned basic without cap', async () => {
      mockPrisma.payrollConfiguration.findUnique.mockResolvedValue({
        ...defaultPayrollConfig,
        applyPfCeiling: false, // Tenant opted to calculate PF on full uncapped basic
      });

      mockPrisma.employee.findMany.mockResolvedValue([
        {
          id: empId,
          organizationId: orgId,
          employeeCode: 'ENG-0001',
          salaryStructures: [
            {
              id: 'sal-high',
              organizationId: orgId,
              employeeId: empId,
              annualCtc: 1200000.0,
              monthlyGross: 100000.0,
              basicSalary: 50000.0,
              hra: 25000.0,
              specialAllowance: 25000.0,
              effectiveFrom: new Date('2026-01-01'),
              effectiveTo: null,
            },
          ],
        },
      ]);

      mockAttendanceService.getFinalizedPayableDays.mockResolvedValue({
        employeeId: empId,
        year: 2026,
        month: 9,
        totalMonthDays: 30,
        payableDays: 30,
        unexcusedAbsenceDays: 0,
        lwpDays: 0,
      });

      // No ceiling cap: 12% of 50,000 = 6,000.00
      await service.calculateBatch(orgId, { year: 2026, month: 9 }, userId);

      expect(mockPrisma.payslip.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            earnedBasic: 50000.0,
            employeePf: 6000.0,
            employerPf: 6000.0,
          }),
        ],
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Professional Tax (PT) Threshold
  // ---------------------------------------------------------------------------
  describe('Professional Tax (PT) Threshold Check', () => {
    it('should deduct flat 200 INR PT when earned gross >= ptSalaryThreshold (10,000)', async () => {
      // Full month: earned gross = 50,000 >= 10,000 -> PT = 200.00
      await service.calculateBatch(orgId, { year: 2026, month: 9 }, userId);

      expect(mockPrisma.payslip.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            professionalTax: 200.0,
          }),
        ],
      });
    });

    it('should deduct 0 INR PT when earned gross is below ptSalaryThreshold (10,000)', async () => {
      // Employee worked only 4 days out of 30:
      // Earned gross = 50,000 * (4/30) = 6,666.67 < 10,000 threshold -> PT = 0.00
      mockAttendanceService.getFinalizedPayableDays.mockResolvedValue({
        employeeId: empId,
        year: 2026,
        month: 9,
        totalMonthDays: 30,
        payableDays: 4,
        unexcusedAbsenceDays: 26,
        lwpDays: 0,
      });

      await service.calculateBatch(orgId, { year: 2026, month: 9 }, userId);

      expect(mockPrisma.payslip.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            professionalTax: 0.0,
          }),
        ],
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Net Pay Rounding Rule (Strictly at Final Net Pay)
  // ---------------------------------------------------------------------------
  describe('Net Pay Rounding Policy', () => {
    it('should maintain double precision on intermediate figures and round strictly at final Net Pay', async () => {
      // Let's create an odd payable days scenario to produce fractions:
      // 23 payable days out of 30
      mockAttendanceService.getFinalizedPayableDays.mockResolvedValue({
        employeeId: empId,
        year: 2026,
        month: 9,
        totalMonthDays: 30,
        payableDays: 23,
        unexcusedAbsenceDays: 7,
        lwpDays: 0,
      });

      await service.calculateBatch(orgId, { year: 2026, month: 9 }, userId);

      expect(mockPrisma.payslip.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            // Net pay must be an integer rupee (roundToWholeRupee: true)
            netPay: expect.any(Number),
          }),
        ],
      });

      const calledData = mockPrisma.payslip.createMany.mock.calls[0][0].data[0];
      expect(Number.isInteger(calledData.netPay)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Employer PF Contribution Tracking
  // ---------------------------------------------------------------------------
  describe('Employer PF Contribution Tracking', () => {
    it('should record employer PF on payslip without deducting it from employee Net Pay', async () => {
      // Full month: earned basic = 25,000 capped at 15,000.
      // Employee PF = 1,800. Employer PF = 1,800. PT = 200.
      // Total deductions from employee = 1,800 + 200 = 2,000.
      // Net pay = 50,000 - 2,000 = 48,000.
      await service.calculateBatch(orgId, { year: 2026, month: 9 }, userId);

      expect(mockPrisma.payslip.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            earnedGross: 50000.0,
            employeePf: 1800.0,
            professionalTax: 200.0,
            totalDeductions: 2000.0,
            netPay: 48000.0,
            employerPf: 1800.0, // Tracked for CTC reporting, not subtracted from Net Pay
          }),
        ],
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Immutability Barrier & Lifecycle Transitions (DRAFT -> LOCKED -> DISBURSED)
  // ---------------------------------------------------------------------------
  describe('Batch Lifecycle & Immutability Barrier', () => {
    it('should transition DRAFT batch to LOCKED with audit timestamp and user id', async () => {
      mockPrisma.payrollBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        organizationId: orgId,
        status: PayrollBatchStatus.DRAFT,
      });

      await service.lockBatch(orgId, 'batch-1', userId);

      expect(mockPrisma.payrollBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: expect.objectContaining({
          status: PayrollBatchStatus.LOCKED,
          lockedByUserId: userId,
          lockedAt: expect.any(Date),
        }),
      });
    });

    it('should reject locking a batch that is not in DRAFT status', async () => {
      mockPrisma.payrollBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        organizationId: orgId,
        status: PayrollBatchStatus.LOCKED,
      });

      await expect(service.lockBatch(orgId, 'batch-1', userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should transition LOCKED batch to DISBURSED with payment reference', async () => {
      mockPrisma.payrollBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        organizationId: orgId,
        status: PayrollBatchStatus.LOCKED,
      });

      await service.disburseBatch(
        orgId,
        'batch-1',
        { paymentReference: 'NEFT-20260930-9988' },
        userId,
      );

      expect(mockPrisma.payrollBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: expect.objectContaining({
          status: PayrollBatchStatus.DISBURSED,
          disbursedByUserId: userId,
          disbursedAt: expect.any(Date),
          paymentReference: 'NEFT-20260930-9988',
        }),
      });
    });

    it('should reject recalculation of a LOCKED or DISBURSED batch', async () => {
      mockPrisma.payrollBatch.findUnique.mockResolvedValue({
        id: 'batch-locked',
        organizationId: orgId,
        year: 2026,
        month: 9,
        status: PayrollBatchStatus.LOCKED,
      });

      await expect(
        service.calculateBatch(orgId, { year: 2026, month: 9 }, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Bank Payment Advice & Printable Payslip View
  // ---------------------------------------------------------------------------
  describe('Corporate Bank Payment Advice & Printable View', () => {
    it('should generate structured bank advice records with account number and IFSC', async () => {
      mockPrisma.payrollBatch.findFirst.mockResolvedValue({
        id: 'batch-1',
        organizationId: orgId,
        year: 2026,
        month: 9,
        status: PayrollBatchStatus.LOCKED,
        totalEmployees: 1,
        totalNetPay: 48000.0,
        payslips: [
          {
            netPay: 48000.0,
            employee: {
              employeeCode: 'ENG-0001',
              firstName: 'John',
              lastName: 'Doe',
              bankName: 'HDFC Bank',
              accountNumber: '1234567890',
              ifscOrRouting: 'HDFC0001234',
            },
          },
        ],
      });

      const adviceJson = await service.getBankAdvice(orgId, 'batch-1', 'json');
      expect(adviceJson).toEqual(
        expect.objectContaining({
          batchId: 'batch-1',
          totalDisbursement: 48000.0,
          records: [
            {
              employeeCode: 'ENG-0001',
              employeeName: 'John Doe',
              bankName: 'HDFC Bank',
              accountNumber: '1234567890',
              ifscCode: 'HDFC0001234',
              netPay: 48000.0,
            },
          ],
        }),
      );

      const adviceCsv = await service.getBankAdvice(orgId, 'batch-1', 'csv');
      expect(typeof adviceCsv).toBe('string');
      expect(adviceCsv).toContain('"ENG-0001","John Doe","HDFC Bank","1234567890","HDFC0001234",48000');
    });

    it('should generate clean printable HTML payslip view', async () => {
      mockPrisma.payslip.findFirst.mockResolvedValue({
        id: 'ps-1',
        organizationId: orgId,
        employeeId: empId,
        totalMonthDays: 30,
        payableDays: 30,
        lwpDays: 0,
        unexcusedAbsenceDays: 0,
        nominalGross: 50000.0,
        nominalBasic: 25000.0,
        nominalHra: 12500.0,
        nominalSpecialAllowance: 12500.0,
        earnedBasic: 25000.0,
        earnedHra: 12500.0,
        earnedSpecialAllowance: 12500.0,
        earnedGross: 50000.0,
        employeePf: 1800.0,
        professionalTax: 200.0,
        totalDeductions: 2000.0,
        netPay: 48000.0,
        employerPf: 1800.0,
        payrollBatch: { year: 2026, month: 9 },
        employee: {
          employeeCode: 'ENG-0001',
          firstName: 'John',
          lastName: 'Doe',
          panNumber: 'ABCDE1234F',
          uanNumber: '100012345678',
          accountNumber: '1234567890',
          department: { name: 'Engineering' },
          designation: { name: 'Lead Engineer' },
          organization: { name: 'PlanetU Technologies' },
        },
      });

      const currentUser: AuthenticatedUser = {
        id: 'u-1',
        organizationId: orgId,
        email: 'john@planetu.com',
        role: Role.EMPLOYEE,
        employeeId: empId,
      };

      const html = await service.renderPrintablePayslip(orgId, 'ps-1', currentUser);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('PlanetU Technologies');
      expect(html).toContain('ENG-0001');
      expect(html).toContain('September 2026');
      expect(html).toContain('Net Take-Home Pay');
    });

    it('should block employee from viewing other employee payslip', async () => {
      mockPrisma.payslip.findFirst.mockResolvedValue({
        id: 'ps-other',
        organizationId: orgId,
        employeeId: 'other-emp',
      });

      const unauthorizedEmployee: AuthenticatedUser = {
        id: 'u-emp',
        organizationId: orgId,
        email: 'attacker@planetu.com',
        role: Role.EMPLOYEE,
        employeeId: 'my-emp-id',
      };

      await expect(
        service.getPayslipById(orgId, 'ps-other', unauthorizedEmployee),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Statutory Compliance — ESI (Employee State Insurance)
  // ---------------------------------------------------------------------------
  describe('ESI Statutory Deductions', () => {
    it('should compute zero ESI for employees earning above the Rs 21,000 threshold', async () => {
      // Default mock has Gross = 50,000 > 21,000 threshold
      await service.calculateBatch(orgId, { year: 2026, month: 9 }, userId);

      const payslipCalls = mockPrisma.payslip.createMany.mock.calls;
      expect(payslipCalls.length).toBeGreaterThan(0);
      const createdPayslips = payslipCalls[0][0].data;
      expect(createdPayslips[0].employeeEsi).toBe(0);
      expect(createdPayslips[0].employerEsi).toBe(0);
    });

    it('should compute 0.75% employee and 3.25% employer ESI when gross is <= Rs 21,000', async () => {
      // Set employee with monthly gross = 20,000 <= 21,000 threshold
      mockPrisma.employee.findMany.mockResolvedValue([
        {
          id: empId,
          organizationId: orgId,
          employeeCode: 'ENG-0002',
          firstName: 'Jane',
          lastName: 'Smith',
          salaryStructures: [
            {
              id: 'sal-low',
              organizationId: orgId,
              employeeId: empId,
              annualCtc: 240000.0,
              monthlyGross: 20000.0,
              basicSalary: 10000.0,
              hra: 5000.0,
              specialAllowance: 5000.0,
              effectiveFrom: new Date('2026-01-01'),
              effectiveTo: null,
            },
          ],
        },
      ]);

      await service.calculateBatch(orgId, { year: 2026, month: 9 }, userId);

      const payslipCalls = mockPrisma.payslip.createMany.mock.calls;
      const createdPayslip = payslipCalls[0][0].data[0];

      // 20000 * 0.0075 = 150.00
      expect(createdPayslip.employeeEsi).toBe(150.0);
      // 20000 * 0.0325 = 650.00
      expect(createdPayslip.employerEsi).toBe(650.0);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. One-Time Payroll Adjustments & Bonuses
  // ---------------------------------------------------------------------------
  describe('One-Time Payroll Adjustments & Bonuses', () => {
    it('should create an adjustment in the ledger', async () => {
      const dto = {
        employeeId: empId,
        year: 2026,
        month: 9,
        type: 'BONUS' as any,
        amount: 5000,
        reason: 'Q3 Performance Bonus',
      };

      const result = await service.createAdjustment(orgId, userId, dto);
      expect(mockPrisma.payrollAdjustment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgId,
            employeeId: empId,
            year: 2026,
            month: 9,
            type: 'BONUS',
            amount: 5000,
            description: 'Q3 Performance Bonus',
            createdByUserId: userId,
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('should include pending bonuses in batch calculation and net pay', async () => {
      // Mock adjustment for the month
      mockPrisma.payrollAdjustment.findMany.mockResolvedValue([
        {
          id: 'adj-bonus-1',
          employeeId: empId,
          type: 'BONUS',
          amount: 5000.0,
          year: 2026,
          month: 9,
          isProcessed: false,
        },
      ]);

      await service.calculateBatch(orgId, { year: 2026, month: 9 }, userId);

      const payslipCalls = mockPrisma.payslip.createMany.mock.calls;
      const createdPayslip = payslipCalls[0][0].data[0];

      expect(createdPayslip.bonusAmount).toBe(5000.0);
      // Earned gross (50000) + bonus (5000) - PF (1800) - PT (200) = 53000
      expect(createdPayslip.netPay).toBe(53000.0);
      // Adjustments should be marked processed
      expect(mockPrisma.payrollAdjustment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isProcessed: true }),
        }),
      );
    });

    it('should allow deleting an adjustment if the batch is in DRAFT', async () => {
      mockPrisma.payrollAdjustment.findFirst.mockResolvedValue({
        id: 'adj-1',
        organizationId: orgId,
        payrollBatch: { status: PayrollBatchStatus.DRAFT },
      });

      await service.deleteAdjustment(orgId, 'adj-1');
      expect(mockPrisma.payrollAdjustment.delete).toHaveBeenCalledWith({
        where: { id: 'adj-1' },
      });
    });

    it('should reject deleting an adjustment if the batch is LOCKED', async () => {
      mockPrisma.payrollAdjustment.findFirst.mockResolvedValue({
        id: 'adj-1',
        organizationId: orgId,
        payrollBatch: { status: PayrollBatchStatus.LOCKED },
      });

      await expect(
        service.deleteAdjustment(orgId, 'adj-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
