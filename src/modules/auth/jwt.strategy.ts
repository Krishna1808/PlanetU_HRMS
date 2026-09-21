import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

export interface JwtPayload {
  sub: string;
  organizationId: string;
  email: string;
  role: string;
  employeeId?: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Extract from httpOnly cookie (browser sessions)
        (request: Request) => request?.cookies?.planetu_token || null,
        // 2. Extract from Authorization Bearer header (Postman, tests, scripts)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev_secret_key_planetu_change_in_prod',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        organizationId: true,
        email: true,
        role: true,
        employeeId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is inactive or no longer exists');
    }

    let employeeId = user.employeeId;
    if (!employeeId) {
      const matching = await this.prisma.employee.findFirst({
        where: {
          organizationId: user.organizationId,
          personalEmail: { equals: user.email, mode: 'insensitive' },
          deletedAt: null,
        },
      });
      if (matching) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { employeeId: matching.id },
        });
        employeeId = matching.id;
      }
    }

    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
      employeeId,
    };
  }
}
