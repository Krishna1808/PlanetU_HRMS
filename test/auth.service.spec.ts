import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockOrganization = {
  id: 'org-1',
  name: 'PlanetU Technologies',
  slug: 'planetu',
  isActive: true,
};

const makeUser = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'user-1',
  email: 'john.doe@planetu.com',
  passwordHash: '$2a$10$hashedpassword', // will be replaced in each test
  role: Role.EMPLOYEE,
  isActive: true,
  organizationId: 'org-1',
  employeeId: 'emp-1',
  organization: { ...mockOrganization },
  lastLoginAt: null,
  ...overrides,
});

describe('AuthService (Module 1: Authentication)', () => {
  let service: AuthService;
  let mockPrisma: any;
  let mockJwtService: any;

  const orgId = 'org-1';

  beforeEach(() => {
    mockPrisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    service = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockJwtService as any,
    );
  });

  // -------------------------------------------------------------------------
  // 1. login — happy path
  // -------------------------------------------------------------------------
  describe('login (Happy Path)', () => {
    it('returns accessToken and user info on valid credentials', async () => {
      const plainPassword = 'Secret@123';
      const hash = await bcrypt.hash(plainPassword, 10);
      const mockUser = makeUser({ passwordHash: hash });

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'john.doe@planetu.com',
        password: plainPassword,
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user).toMatchObject({
        id: 'user-1',
        email: 'john.doe@planetu.com',
        role: Role.EMPLOYEE,
        organizationId: orgId,
        organizationName: 'PlanetU Technologies',
        employeeId: 'emp-1',
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { lastLoginAt: expect.any(Date) },
        }),
      );
    });

    it('trims and lowercases email before lookup', async () => {
      const plainPassword = 'Secret@123';
      const hash = await bcrypt.hash(plainPassword, 10);
      const mockUser = makeUser({ passwordHash: hash });

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      await service.login({
        email: '  John.DOE@PlanetU.com  ',
        password: plainPassword,
      });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'john.doe@planetu.com' },
        }),
      );
    });

    it('signs JWT with correct payload fields', async () => {
      const plainPassword = 'Passw0rd!';
      const hash = await bcrypt.hash(plainPassword, 10);
      const mockUser = makeUser({
        passwordHash: hash,
        role: Role.HR_ADMIN,
        employeeId: null,
      });

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      await service.login({ email: mockUser.email, password: plainPassword });

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        organizationId: orgId,
        email: 'john.doe@planetu.com',
        role: Role.HR_ADMIN,
        employeeId: null,
      });
    });
  });

  // -------------------------------------------------------------------------
  // 2. login — failure cases
  // -------------------------------------------------------------------------
  describe('login (Failure Cases)', () => {
    it('throws UnauthorizedException when user email does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@planetu.com', password: 'anyPass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      const correctHash = await bcrypt.hash('CorrectPass', 10);
      const mockUser = makeUser({ passwordHash: correctHash });

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: mockUser.email, password: 'WrongPass!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user account is deactivated (isActive: false)', async () => {
      const hash = await bcrypt.hash('Pass@123', 10);
      const mockUser = makeUser({ passwordHash: hash, isActive: false });

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: mockUser.email, password: 'Pass@123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when organization tenant is inactive', async () => {
      const hash = await bcrypt.hash('Pass@123', 10);
      const mockUser = makeUser({
        passwordHash: hash,
        organization: { ...mockOrganization, isActive: false },
      });

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: mockUser.email, password: 'Pass@123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // -------------------------------------------------------------------------
  // 3. getProfile
  // -------------------------------------------------------------------------
  describe('getProfile (JWT Profile Endpoint)', () => {
    const mockProfileUser = {
      id: 'user-1',
      email: 'john.doe@planetu.com',
      role: Role.EMPLOYEE,
      organizationId: orgId,
      isActive: true,
      lastLoginAt: new Date('2026-09-01T09:00:00.000Z'),
      organization: { id: orgId, name: 'PlanetU Technologies', slug: 'planetu' },
      employee: {
        id: 'emp-1',
        employeeCode: 'ENG-0001',
        firstName: 'John',
        lastName: 'Doe',
        department: { id: 'dept-1', name: 'Engineering', codePrefix: 'ENG' },
        designation: { id: 'des-1', name: 'Software Engineer' },
      },
    };

    it('returns full profile for a valid userId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockProfileUser);

      const result = await service.getProfile('user-1');

      expect(result).toMatchObject({
        id: 'user-1',
        email: 'john.doe@planetu.com',
        role: Role.EMPLOYEE,
        organization: { name: 'PlanetU Technologies' },
        employee: { employeeCode: 'ENG-0001' },
      });
    });

    it('throws UnauthorizedException when userId does not match any user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('non-existent-user')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('queries with the correct field selection projection', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockProfileUser);

      await service.getProfile('user-1');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          select: expect.objectContaining({
            id: true,
            email: true,
            role: true,
            organization: expect.any(Object),
            employee: expect.any(Object),
          }),
        }),
      );
    });
  });
});
