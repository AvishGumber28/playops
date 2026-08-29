import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedRequest } from '../types/authenticated-request';

interface JwtPayload {
  sub: string;
}

/**
 * Verifies the JWT on every protected request. This only checks that the
 * token is valid and attaches the user id to the request - it does NOT
 * check what that user is allowed to do. That's RolesGuard's job, kept
 * separate on purpose (per D-006: scoped checks, not a hierarchy - each
 * guard has one narrow responsibility).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization token.');
    }

    const token = authHeader.slice(7);

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      request.userId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }
}
