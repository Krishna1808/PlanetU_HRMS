import { PrismaClient, Role, LeaveAccrualFrequency } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed for PlanetU HRMS...');

  // 1. Seed Organization (Internal Prototype Tenant)
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
  console.log(`✅ Organization created/verified: ${organization.name} (${organization.id})`);

  // 2. Seed Master Departments
  const departmentsData = [
    { name: 'Engineering', codePrefix: 'ENG', description: 'Product and Software Engineering' },
    { name: 'Human Resources', codePrefix: 'HR', description: 'People Operations and Talent' },
    { name: 'Operations', codePrefix: 'OPS', description: 'Business Operations' },
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
  console.log(`✅ Seeded ${departmentsData.length} master departments`);

  // 3. Seed Master Designations
  const designationsData = [
    'Junior Software Engineer',
    'Software Engineer',
    'Senior Software Engineer',
    'Engineering Lead',
    'HR Associate',
    'HR Manager',
  ];

  for (const desName of designationsData) {
    await prisma.designation.upsert({
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
  }
  console.log(`✅ Seeded master designations`);

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
  console.log(`✅ Seeded master grades`);

  // 5. Seed Master Locations
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
  console.log(`✅ Seeded master location`);

  // 6. Seed Client Super Admin User
  const adminEmail = 'admin@planetu.com';
  const defaultPassword = 'DevPassword123!';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultPassword, salt);

  const adminUser = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: organization.id,
        email: adminEmail,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      email: adminEmail,
      passwordHash: passwordHash,
      role: Role.CLIENT_SUPER_ADMIN,
      isActive: true,
    },
  });

  console.log(`✅ Seeded Super Admin: ${adminUser.email} (default password: ${defaultPassword})`);

  // 7. Seed Default General Shift (Module 3)
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
      halfDayThresholdMinutes: 240, // 4 hours
      fullDayThresholdMinutes: 480, // 8 hours
      isDefault: true,
      isActive: true,
    },
  });
  console.log(`✅ Seeded default shift: ${defaultShift.name} (${defaultShift.code}: 09:00 - 18:00)`);

  // 8. Seed Default Master Leave Types (Module 5)
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

  for (const lt of leaveTypesData) {
    await prisma.leaveType.upsert({
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
  }
  console.log(`✅ Seeded ${leaveTypesData.length} master leave types (CL, SL, PL, LWP)`);
  console.log('🌱 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
