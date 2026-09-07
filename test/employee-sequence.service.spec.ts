import { jest } from '@jest/globals';
import { EmployeeSequenceService } from '../src/modules/employees/services/employee-sequence.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('EmployeeSequenceService (FR-EMP-002 & Architecture Rule 7)', () => {
  let sequenceService: EmployeeSequenceService;
  let mockPrisma: any;

  beforeEach(() => {
    let currentNumber = 0;

    mockPrisma = {
      department: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'dept-eng',
          codePrefix: 'ENG',
        }),
      },
      employeeCodeSequence: {
        upsert: jest.fn().mockImplementation(async () => {
          currentNumber += 1;
          return {
            organizationId: 'org-1',
            departmentId: 'dept-eng',
            lastNumber: currentNumber,
          };
        }),
      },
    };

    sequenceService = new EmployeeSequenceService(mockPrisma as PrismaService);
  });

  it('generates sequential codes with proper 4-digit padding (ENG-0001, ENG-0002)', async () => {
    const code1 = await sequenceService.generateEmployeeCode('org-1', 'dept-eng');
    const code2 = await sequenceService.generateEmployeeCode('org-1', 'dept-eng');
    const code3 = await sequenceService.generateEmployeeCode('org-1', 'dept-eng');

    expect(code1).toBe('ENG-0001');
    expect(code2).toBe('ENG-0002');
    expect(code3).toBe('ENG-0003');
  });

  it('generates unique codes concurrently without race-condition collisions', async () => {
    const parallelRequests = 10;
    const promises = Array.from({ length: parallelRequests }, () =>
      sequenceService.generateEmployeeCode('org-1', 'dept-eng'),
    );

    const generatedCodes = await Promise.all(promises);

    // Verify all generated codes are distinct
    const uniqueCodes = new Set(generatedCodes);
    expect(uniqueCodes.size).toBe(parallelRequests);

    // Verify format of each code
    generatedCodes.forEach((code) => {
      expect(code).toMatch(/^ENG-\d{4}$/);
    });
  });
});
