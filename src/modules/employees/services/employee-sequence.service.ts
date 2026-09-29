import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EmployeeSequenceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically generates a unique employee code scoped to (organizationId, departmentId).
   * Format: <DEPT_PREFIX>-<0000> (e.g. ENG-0001)
   * Uses PostgreSQL row locking via atomic increment inside a transaction to prevent race conditions.
   */
  async generateEmployeeCode(
    organizationId: string,
    departmentId: string,
    prismaTx?: Prisma.TransactionClient,
  ): Promise<string> {
    const tx = prismaTx || this.prisma;

    // 1. Fetch department code prefix
    const department = await tx.department.findFirst({
      where: {
        id: departmentId,
        organizationId,
      },
      select: {
        codePrefix: true,
      },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${departmentId} not found in this organization`);
    }

    // 2. Atomically upsert and increment the sequence number
    const sequence = await tx.employeeCodeSequence.upsert({
      where: {
        organizationId_departmentId: {
          organizationId,
          departmentId,
        },
      },
      update: {
        lastNumber: { increment: 1 },
      },
      create: {
        organizationId,
        departmentId,
        lastNumber: 1,
      },
      select: {
        lastNumber: true,
      },
    });

    let currentNumber = sequence.lastNumber;
    let candidateCode = `${department.codePrefix}-${String(currentNumber).padStart(4, '0')}`;

    // 3. Collision guard: Ensure candidateCode is not already taken by any employee
    if (tx.employee?.findUnique) {
      while (true) {
        const existing = await tx.employee.findUnique({
          where: {
            organizationId_employeeCode: {
              organizationId,
              employeeCode: candidateCode,
            },
          },
          select: { id: true },
        });

        if (!existing) {
          break;
        }

        currentNumber += 1;
        candidateCode = `${department.codePrefix}-${String(currentNumber).padStart(4, '0')}`;

        await tx.employeeCodeSequence.update({
          where: {
            organizationId_departmentId: {
              organizationId,
              departmentId,
            },
          },
          data: {
            lastNumber: currentNumber,
          },
        });
      }
    }

    return candidateCode;
  }
}
