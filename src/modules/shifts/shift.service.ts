import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DayOfWeek } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { AssignShiftDto } from './dto/assign-shift.dto';
import { BulkAssignShiftDto } from './dto/bulk-assign-shift.dto';

@Injectable()
export class ShiftService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Helper: Shift Duration & Overnight Math
  // ---------------------------------------------------------------------------

  /**
   * Calculates net working minutes between 24-hour 'HH:mm' strings after deducting break minutes.
   * Handles overnight shifts (e.g. 22:00 to 06:00 = 8h span - break = net minutes).
   */
  calculateNetWorkMinutes(
    startTime: string,
    endTime: string,
    breakDurationMinutes: number = 0,
    isOvernight?: boolean,
  ): number {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    let spanMinutes: number;

    // If marked overnight or end is numerically before start, the shift spans across midnight (1440 minutes in a day)
    if (isOvernight || endTotal < startTotal) {
      spanMinutes = 1440 - startTotal + endTotal;
    } else {
      spanMinutes = endTotal - startTotal;
    }

    const netMinutes = spanMinutes - breakDurationMinutes;
    return Math.max(0, netMinutes);
  }

  // ---------------------------------------------------------------------------
  // Shift Template Management
  // ---------------------------------------------------------------------------

  /**
   * Create a new shift template within the organization.
   * Ensures code uniqueness and validates thresholds against net work minutes.
   */
  async createShift(organizationId: string, dto: CreateShiftDto) {
    const normalizedCode = dto.code.trim().toUpperCase();

    // Check for unique code or name within this tenant
    const existingCode = await this.prisma.shift.findFirst({
      where: {
        organizationId,
        code: normalizedCode,
      },
    });

    if (existingCode) {
      throw new ConflictException(
        `Shift with code '${normalizedCode}' already exists for this organization`,
      );
    }

    const existingName = await this.prisma.shift.findFirst({
      where: {
        organizationId,
        name: { equals: dto.name.trim(), mode: 'insensitive' },
      },
    });

    if (existingName) {
      throw new ConflictException(
        `Shift with name '${dto.name}' already exists for this organization`,
      );
    }

    // Auto-detect overnight if not explicitly provided
    const [startH, startM] = dto.startTime.split(':').map(Number);
    const [endH, endM] = dto.endTime.split(':').map(Number);
    const isOvernight =
      dto.isOvernight !== undefined
        ? dto.isOvernight
        : startH * 60 + startM > endH * 60 + endM;

    // Validate thresholds against calculated net duration
    const breakMinutes = dto.breakDurationMinutes ?? 60;
    const netWorkMinutes = this.calculateNetWorkMinutes(
      dto.startTime,
      dto.endTime,
      breakMinutes,
      isOvernight,
    );

    const fullDayThreshold = dto.fullDayThresholdMinutes ?? 480;
    const halfDayThreshold = dto.halfDayThresholdMinutes ?? 240;

    if (fullDayThreshold > netWorkMinutes) {
      throw new BadRequestException(
        `Full-day threshold (${fullDayThreshold} mins) cannot exceed net shift work duration (${netWorkMinutes} mins)`,
      );
    }

    if (halfDayThreshold >= fullDayThreshold) {
      throw new BadRequestException(
        `Half-day threshold (${halfDayThreshold} mins) must be strictly less than full-day threshold (${fullDayThreshold} mins)`,
      );
    }

    // If this shift is marked as default, unset any existing default shift in this org
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.shift.updateMany({
          where: { organizationId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.shift.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          code: normalizedCode,
          startTime: dto.startTime,
          endTime: dto.endTime,
          isOvernight,
          gracePeriodMinutes: dto.gracePeriodMinutes ?? 15,
          breakDurationMinutes: breakMinutes,
          halfDayThresholdMinutes: halfDayThreshold,
          fullDayThresholdMinutes: fullDayThreshold,
          isDefault: dto.isDefault ?? false,
          isActive: dto.isActive ?? true,
        },
      });
    });
  }

  /**
   * List all shifts for the organization.
   */
  async listShifts(organizationId: string, includeInactive = false) {
    return this.prisma.shift.findMany({
      where: {
        organizationId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Get a single shift template by ID.
   */
  async getShiftById(organizationId: string, shiftId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, organizationId },
    });

    if (!shift) {
      throw new NotFoundException(`Shift with ID '${shiftId}' not found`);
    }

    return shift;
  }

  /**
   * Update an existing shift template.
   */
  async updateShift(organizationId: string, shiftId: string, dto: UpdateShiftDto) {
    const existing = await this.getShiftById(organizationId, shiftId);

    const normalizedCode = dto.code ? dto.code.trim().toUpperCase() : undefined;

    // Check code uniqueness if changing code
    if (normalizedCode && normalizedCode !== existing.code) {
      const codeConflict = await this.prisma.shift.findFirst({
        where: { organizationId, code: normalizedCode, NOT: { id: shiftId } },
      });
      if (codeConflict) {
        throw new ConflictException(
          `Shift with code '${normalizedCode}' already exists for this organization`,
        );
      }
    }

    // Check name uniqueness if changing name
    if (dto.name && dto.name.trim() !== existing.name) {
      const nameConflict = await this.prisma.shift.findFirst({
        where: {
          organizationId,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          NOT: { id: shiftId },
        },
      });
      if (nameConflict) {
        throw new ConflictException(
          `Shift with name '${dto.name}' already exists for this organization`,
        );
      }
    }

    // Recalculate duration validation if times/thresholds are updated
    const startTime = dto.startTime ?? existing.startTime;
    const endTime = dto.endTime ?? existing.endTime;
    const breakMinutes = dto.breakDurationMinutes ?? existing.breakDurationMinutes;
    const isOvernight =
      dto.isOvernight !== undefined ? dto.isOvernight : existing.isOvernight;

    const netWorkMinutes = this.calculateNetWorkMinutes(
      startTime,
      endTime,
      breakMinutes,
      isOvernight,
    );

    const fullDayThreshold =
      dto.fullDayThresholdMinutes ?? existing.fullDayThresholdMinutes;
    const halfDayThreshold =
      dto.halfDayThresholdMinutes ?? existing.halfDayThresholdMinutes;

    if (fullDayThreshold > netWorkMinutes) {
      throw new BadRequestException(
        `Full-day threshold (${fullDayThreshold} mins) cannot exceed net shift work duration (${netWorkMinutes} mins)`,
      );
    }

    if (halfDayThreshold >= fullDayThreshold) {
      throw new BadRequestException(
        `Half-day threshold (${halfDayThreshold} mins) must be strictly less than full-day threshold (${fullDayThreshold} mins)`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.shift.updateMany({
          where: { organizationId, isDefault: true, NOT: { id: shiftId } },
          data: { isDefault: false },
        });
      }

      return tx.shift.update({
        where: { id: shiftId },
        data: {
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(normalizedCode ? { code: normalizedCode } : {}),
          ...(dto.startTime ? { startTime: dto.startTime } : {}),
          ...(dto.endTime ? { endTime: dto.endTime } : {}),
          ...(dto.isOvernight !== undefined ? { isOvernight: dto.isOvernight } : {}),
          ...(dto.gracePeriodMinutes !== undefined
            ? { gracePeriodMinutes: dto.gracePeriodMinutes }
            : {}),
          ...(dto.breakDurationMinutes !== undefined
            ? { breakDurationMinutes: dto.breakDurationMinutes }
            : {}),
          ...(dto.halfDayThresholdMinutes !== undefined
            ? { halfDayThresholdMinutes: dto.halfDayThresholdMinutes }
            : {}),
          ...(dto.fullDayThresholdMinutes !== undefined
            ? { fullDayThresholdMinutes: dto.fullDayThresholdMinutes }
            : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    });
  }

  /**
   * Soft-deactivate a shift template.
   * Default shift cannot be deactivated without designating a replacement first.
   */
  async deactivateShift(organizationId: string, shiftId: string) {
    const shift = await this.getShiftById(organizationId, shiftId);

    if (shift.isDefault) {
      throw new BadRequestException(
        'Cannot deactivate the organization default shift. Please designate another shift as default first.',
      );
    }

    return this.prisma.shift.update({
      where: { id: shiftId },
      data: { isActive: false },
    });
  }

  // ---------------------------------------------------------------------------
  // Append-Only Shift Assignment Ledger (Architecture Rule #4)
  // ---------------------------------------------------------------------------

  /**
   * Assign an employee to a shift schedule with an effective start date.
   * Closes the active assignment (setting effectiveTo = effectiveFrom) and creates a new active row.
   */
  async assignShift(
    organizationId: string,
    dto: AssignShiftDto,
    assignedByUserId?: string,
  ) {
    // 1. Verify shift exists and is active
    const shift = await this.prisma.shift.findFirst({
      where: { id: dto.shiftId, organizationId, isActive: true },
    });

    if (!shift) {
      throw new NotFoundException(
        `Active shift with ID '${dto.shiftId}' not found in this organization`,
      );
    }

    // 2. Verify employee exists and is not deleted
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId, deletedAt: null },
    });

    if (!employee) {
      throw new NotFoundException(
        `Active employee with ID '${dto.employeeId}' not found in this organization`,
      );
    }

    const effectiveFrom = new Date(dto.effectiveFrom);
    if (isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('Invalid effectiveFrom date string');
    }

    const weeklyOffDays = dto.weeklyOffDays ?? [
      DayOfWeek.SATURDAY,
      DayOfWeek.SUNDAY,
    ];

    // 3. Atomic transaction: close current active assignment, insert new active assignment
    return this.prisma.$transaction(async (tx) => {
      // Find currently active assignment (effectiveTo is null)
      const currentActive = await tx.employeeShiftAssignment.findFirst({
        where: {
          organizationId,
          employeeId: dto.employeeId,
          effectiveTo: null,
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (currentActive) {
        // Set the previous assignment's effectiveTo to the start of the new assignment
        await tx.employeeShiftAssignment.update({
          where: { id: currentActive.id },
          data: { effectiveTo: effectiveFrom },
        });
      }

      // Create new active assignment
      return tx.employeeShiftAssignment.create({
        data: {
          organizationId,
          employeeId: dto.employeeId,
          shiftId: dto.shiftId,
          effectiveFrom,
          effectiveTo: null,
          weeklyOffDays,
          assignedByUserId,
          notes: dto.notes,
        },
        include: {
          shift: true,
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });
  }

  /**
   * Bulk assign shift to either all employees in a department or a specific list of employee IDs.
   */
  async bulkAssignShift(
    organizationId: string,
    dto: BulkAssignShiftDto,
    assignedByUserId?: string,
  ) {
    // 1. Verify shift
    const shift = await this.prisma.shift.findFirst({
      where: { id: dto.shiftId, organizationId, isActive: true },
    });

    if (!shift) {
      throw new NotFoundException(
        `Active shift with ID '${dto.shiftId}' not found in this organization`,
      );
    }

    // 2. Determine target employees
    if (!dto.departmentId && (!dto.employeeIds || dto.employeeIds.length === 0)) {
      throw new BadRequestException(
        'Either departmentId or a non-empty employeeIds array must be provided for bulk assignment',
      );
    }

    const whereClause: any = {
      organizationId,
      deletedAt: null,
    };

    if (dto.departmentId) {
      whereClause.departmentId = dto.departmentId;
    } else if (dto.employeeIds) {
      whereClause.id = { in: dto.employeeIds };
    }

    const targetEmployees = await this.prisma.employee.findMany({
      where: whereClause,
      select: { id: true },
    });

    if (targetEmployees.length === 0) {
      throw new BadRequestException(
        'No active employees found matching the specified criteria',
      );
    }

    const effectiveFrom = new Date(dto.effectiveFrom);
    const weeklyOffDays = dto.weeklyOffDays ?? [
      DayOfWeek.SATURDAY,
      DayOfWeek.SUNDAY,
    ];

    // 3. Atomically update all employees in transaction
    await this.prisma.$transaction(async (tx) => {
      for (const emp of targetEmployees) {
        // Close current active assignment
        const currentActive = await tx.employeeShiftAssignment.findFirst({
          where: {
            organizationId,
            employeeId: emp.id,
            effectiveTo: null,
          },
          orderBy: { effectiveFrom: 'desc' },
        });

        if (currentActive) {
          await tx.employeeShiftAssignment.update({
            where: { id: currentActive.id },
            data: { effectiveTo: effectiveFrom },
          });
        }

        // Create new active assignment
        await tx.employeeShiftAssignment.create({
          data: {
            organizationId,
            employeeId: emp.id,
            shiftId: dto.shiftId,
            effectiveFrom,
            effectiveTo: null,
            weeklyOffDays,
            assignedByUserId,
            notes: dto.notes,
          },
        });
      }
    });

    return {
      success: true,
      assignedCount: targetEmployees.length,
      shiftCode: shift.code,
      effectiveFrom,
      message: `Successfully assigned shift '${shift.name}' to ${targetEmployees.length} employees`,
    };
  }

  /**
   * Retrieve full shift assignment history for an employee (ordered newest to oldest).
   */
  async getEmployeeShiftAssignments(organizationId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID '${employeeId}' not found`);
    }

    const assignments = await this.prisma.employeeShiftAssignment.findMany({
      where: {
        organizationId,
        employeeId,
      },
      include: {
        shift: true,
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    return {
      employee,
      assignments,
    };
  }

  /**
   * Retrieve the active shift for an employee on a given date.
   * If no custom assignment exists, returns the organization's default fallback shift.
   */
  async getEmployeeShiftForDate(
    organizationId: string,
    employeeId: string,
    date: Date = new Date(),
  ) {
    // 1. Look for explicit assignment covering the target date
    const assignment = await this.prisma.employeeShiftAssignment.findFirst({
      where: {
        organizationId,
        employeeId,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      include: { shift: true },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (assignment) {
      return {
        isDefaultFallback: false,
        shift: assignment.shift,
        weeklyOffDays: assignment.weeklyOffDays,
        effectiveFrom: assignment.effectiveFrom,
        effectiveTo: assignment.effectiveTo,
      };
    }

    // 2. Fall back to organization default shift
    const defaultShift = await this.prisma.shift.findFirst({
      where: { organizationId, isDefault: true, isActive: true },
    });

    if (!defaultShift) {
      throw new NotFoundException(
        'No active shift assignment found and no default shift configured for this organization',
      );
    }

    return {
      isDefaultFallback: true,
      shift: defaultShift,
      weeklyOffDays: [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY],
      effectiveFrom: null,
      effectiveTo: null,
    };
  }
}
