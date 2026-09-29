import { PrismaClient, Role, LeaveAccrualFrequency, LeaveTransactionType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export async function autoSeedDatabase(prisma: PrismaClient): Promise<void> {
  console.log('🌱 Starting automatic database seed for PlanetU HRMS...');

  // 1. Seed Organization
  const organization = await prisma.organization.upsert({
    where: { slug: 'planetu-internal' },
    update: {},
    create: {
      name: 'PlanetU (Internal Prototype)',
      slug: 'planetu-internal',
      planTier: 'internal',
      isActive: true,
    },
  });

  // 2. Seed Master Departments
  const departmentsData = [
    { name: 'Engineering', codePrefix: 'ENG', description: 'Product and Software Engineering' },
    { name: 'Human Resources', codePrefix: 'HR', description: 'People Operations and Talent' },
    { name: 'Operations', codePrefix: 'OPS', description: 'Business Operations & Management' },
    { name: 'Sales & Marketing', codePrefix: 'SLS', description: 'Revenue and Growth' },
  ];

  const departments: Record<string, string> = {};
  for (const dept of departmentsData) {
    const record = await prisma.department.upsert({
      where: {
        organizationId_codePrefix: {
          organizationId: organization.id,
          codePrefix: dept.codePrefix,
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        name: dept.name,
        codePrefix: dept.codePrefix,
        description: dept.description,
      },
    });
    departments[dept.codePrefix] = record.id;
  }

  // 3. Seed Master Designations
  const designationsData = [
    'Junior Software Engineer',
    'Software Engineer',
    'Senior Software Engineer',
    'Engineering Lead',
    'HR Associate',
    'HR Manager',
  ];

  const designationMap: Record<string, string> = {};
  for (const desName of designationsData) {
    const des = await prisma.designation.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: desName,
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        name: desName,
      },
    });
    designationMap[desName] = des.id;
  }

  // 4. Seed Master Grades
  const gradesData = [
    { name: 'L1', level: 1, description: 'Associate / Entry Level' },
    { name: 'L2', level: 2, description: 'Mid Level' },
    { name: 'L3', level: 3, description: 'Senior Level' },
    { name: 'M1', level: 4, description: 'Management / Lead' },
  ];

  for (const gr of gradesData) {
    await prisma.grade.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: gr.name,
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        name: gr.name,
        level: gr.level,
        description: gr.description,
      },
    });
  }

  // 5. Seed Master Location
  await prisma.location.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: 'Mumbai HQ',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: 'Mumbai HQ',
      city: 'Mumbai',
      country: 'India',
    },
  });

  // 6. Seed Default General Shift
  const defaultShift = await prisma.shift.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'GEN',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: 'General Day Shift',
      code: 'GEN',
      startTime: '09:00',
      endTime: '18:00',
      isOvernight: false,
      gracePeriodMinutes: 15,
      breakDurationMinutes: 60,
      halfDayThresholdMinutes: 240,
      fullDayThresholdMinutes: 480,
      isDefault: true,
      isActive: true,
    },
  });

  // 7. Seed Default Master Leave Types
  const leaveTypesData = [
    {
      name: 'Casual Leave',
      code: 'CL',
      description: 'Casual leave for unforeseen personal matters',
      isPaid: true,
      daysAllowedPerYear: 12,
      accrualFrequency: LeaveAccrualFrequency.MONTHLY,
      carryForwardLimit: 0,
      requiresApproval: true,
    },
    {
      name: 'Sick Leave',
      code: 'SL',
      description: 'Medical and sick leave for health recovery',
      isPaid: true,
      daysAllowedPerYear: 12,
      accrualFrequency: LeaveAccrualFrequency.MONTHLY,
      carryForwardLimit: 5,
      requiresApproval: true,
    },
    {
      name: 'Paid Privilege Leave',
      code: 'PL',
      description: 'Annual earned leave for planned vacations',
      isPaid: true,
      daysAllowedPerYear: 15,
      accrualFrequency: LeaveAccrualFrequency.MONTHLY,
      carryForwardLimit: 10,
      requiresApproval: true,
    },
    {
      name: 'Leave Without Pay',
      code: 'LWP',
      description: 'Unpaid absence that directly deducts from payroll payable days',
      isPaid: false,
      daysAllowedPerYear: 0,
      accrualFrequency: LeaveAccrualFrequency.NONE,
      carryForwardLimit: 0,
      requiresApproval: true,
    },
  ];

  const createdLeaveTypes: any[] = [];
  for (const lt of leaveTypesData) {
    const record = await prisma.leaveType.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: lt.code,
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        name: lt.name,
        code: lt.code,
        description: lt.description,
        isPaid: lt.isPaid,
        daysAllowedPerYear: lt.daysAllowedPerYear,
        accrualFrequency: lt.accrualFrequency,
        carryForwardLimit: lt.carryForwardLimit,
        requiresApproval: lt.requiresApproval,
        isActive: true,
      },
    });
    createdLeaveTypes.push(record);
  }

  // 8. Seed Default Payroll Configuration
  await prisma.payrollConfiguration.upsert({
    where: { organizationId: organization.id },
    update: {},
    create: {
      organizationId: organization.id,
      pfCeilingAmount: 15000.0,
      applyPfCeiling: true,
      pfEmployeeRate: 12.0,
      pfEmployerRate: 12.0,
      ptAmount: 200.0,
      ptSalaryThreshold: 10000.0,
      roundToWholeRupee: true,
      basicPercentage: 50.0,
      hraPercentage: 25.0,
      specialAllowancePercentage: 25.0,
    },
  });

  // 9. Seed ALL Organisation Personas as Employees with User Logins & ESS
  const defaultPassword = 'DevPassword123!';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultPassword, salt);

  const personas = [
    {
      email: 'admin@planetu.com',
      role: Role.CLIENT_SUPER_ADMIN,
      code: 'ADM-0001',
      firstName: 'Super',
      lastName: 'Admin',
      deptCode: 'OPS',
      designationId: designationMap['Engineering Lead'],
    },
    {
      email: 'hr@planetu.com',
      role: Role.HR_ADMIN,
      code: 'HR-0001',
      firstName: 'Ananya',
      lastName: 'Deshmukh',
      deptCode: 'HR',
      designationId: designationMap['HR Manager'],
    },
    {
      email: 'manager@planetu.com',
      role: Role.MANAGER,
      code: 'MGR-0001',
      firstName: 'Vikram',
      lastName: 'Singhania',
      deptCode: 'ENG',
      designationId: designationMap['Engineering Lead'],
    },
    {
      email: 'finance@planetu.com',
      role: Role.FINANCE,
      code: 'FIN-0001',
      firstName: 'Ramesh',
      lastName: 'Iyer',
      deptCode: 'OPS',
      designationId: designationMap['HR Manager'],
    },
    {
      email: 'employee@planetu.com',
      role: Role.EMPLOYEE,
      code: 'ENG-0001',
      firstName: 'Rahul',
      lastName: 'Sharma',
      deptCode: 'ENG',
      designationId: designationMap['Senior Software Engineer'],
    },
    {
      email: 'john.doe@planetu.com',
      role: Role.EMPLOYEE,
      code: 'ENG-0002',
      firstName: 'John',
      lastName: 'Doe',
      deptCode: 'ENG',
      designationId: designationMap['Senior Software Engineer'],
    },
  ];

  const employeeRecords: Record<string, any> = {};

  for (const p of personas) {
    let emp = await prisma.employee.findFirst({
      where: { organizationId: organization.id, employeeCode: p.code },
    });

    if (!emp) {
      emp = await prisma.employee.create({
        data: {
          organizationId: organization.id,
          employeeCode: p.code,
          firstName: p.firstName,
          lastName: p.lastName,
          personalEmail: p.email,
          departmentId: departments[p.deptCode],
          designationId: p.designationId,
          dateOfJoining: new Date('2024-01-01'),
          employmentStatus: 'ACTIVE',
          employmentType: 'FULL_TIME',
        },
      });
    }
    employeeRecords[p.email] = emp;

    const user = await prisma.user.upsert({
      where: {
        organizationId_email: {
          organizationId: organization.id,
          email: p.email,
        },
      },
      update: {
        employeeId: emp.id,
        role: p.role,
        passwordHash,
        isActive: true,
      },
      create: {
        organizationId: organization.id,
        email: p.email,
        passwordHash,
        role: p.role,
        employeeId: emp.id,
        isActive: true,
      },
    });

    const shiftAssign = await prisma.employeeShiftAssignment.findFirst({
      where: { employeeId: emp.id },
    });
    if (!shiftAssign) {
      await prisma.employeeShiftAssignment.create({
        data: {
          organizationId: organization.id,
          employeeId: emp.id,
          shiftId: defaultShift.id,
          effectiveFrom: new Date('2024-01-01'),
          weeklyOffDays: ['SATURDAY', 'SUNDAY'],
        },
      });
    }

    for (const lt of createdLeaveTypes) {
      if (lt.daysAllowedPerYear > 0) {
        const txCount = await prisma.leaveTransaction.count({
          where: { employeeId: emp.id, leaveTypeId: lt.id },
        });
        if (txCount === 0) {
          await prisma.leaveTransaction.create({
            data: {
              organizationId: organization.id,
              employeeId: emp.id,
              leaveTypeId: lt.id,
              transactionType: LeaveTransactionType.CREDIT_ADJUSTMENT,
              days: Number(lt.daysAllowedPerYear),
              balanceAfter: Number(lt.daysAllowedPerYear),
              effectiveDate: new Date('2024-01-01'),
              notes: `Annual quota credit (${lt.name})`,
              createdByUserId: user.id,
            },
          });
        }
      }
    }
  }

  const managerEmp = employeeRecords['manager@planetu.com'];
  const devEmp = employeeRecords['employee@planetu.com'];
  if (managerEmp && devEmp) {
    await prisma.employee.update({
      where: { id: devEmp.id },
      data: { reportingManagerId: managerEmp.id },
    });
  }

  // 10. Synchronize Employee Code Sequences so next created employees receive new unique codes
  await syncAllEmployeeCodeSequences(prisma);

  console.log('✅ Automatic database seed completed successfully! All demo accounts initialized.');
}

/**
 * Ensures all departments have their employeeCodeSequence set to at least
 * the highest existing sequential employee code in the database.
 */
export async function syncAllEmployeeCodeSequences(prisma: PrismaClient) {
  try {
    const departments = await prisma.department.findMany({ select: { id: true, organizationId: true } });
    for (const dept of departments) {
      const employees = await prisma.employee.findMany({
        where: { organizationId: dept.organizationId, departmentId: dept.id },
        select: { employeeCode: true },
      });

      let maxNum = 0;
      for (const e of employees) {
        const parts = e.employeeCode.split('-');
        if (parts.length === 2) {
          const num = parseInt(parts[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }

      if (maxNum > 0) {
        await prisma.employeeCodeSequence.upsert({
          where: {
            organizationId_departmentId: {
              organizationId: dept.organizationId,
              departmentId: dept.id,
            },
          },
          update: {},
          create: {
            organizationId: dept.organizationId,
            departmentId: dept.id,
            lastNumber: maxNum,
          },
        });

        const current = await prisma.employeeCodeSequence.findUnique({
          where: {
            organizationId_departmentId: {
              organizationId: dept.organizationId,
              departmentId: dept.id,
            },
          },
          select: { lastNumber: true },
        });

        if (current && current.lastNumber < maxNum) {
          await prisma.employeeCodeSequence.update({
            where: {
              organizationId_departmentId: {
                organizationId: dept.organizationId,
                departmentId: dept.id,
              },
            },
            data: { lastNumber: maxNum },
          });
        }
      }
    }
  } catch (err: any) {
    // Non-fatal background sync
  }
}

