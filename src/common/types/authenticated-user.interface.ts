import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  email: string;
  role: Role;
  employeeId: string | null;
}
