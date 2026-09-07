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
    // PostgreSQL row locks the row during update, ensuring serialized sequential IDs under high concurrency
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

    const sequentialPadded = String(sequence.lastNumber).padStart(4, '0');
    return `${department.codePrefix}-${sequentialPadded}`;
  }
}
