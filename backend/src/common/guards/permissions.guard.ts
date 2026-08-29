import {
  SetMetadata,
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Marks an endpoint as requiring a specific scoped permission, matching a
 * row in docs/roles-permissions.md - e.g. @RequirePermission('tournament:create').
 * There is deliberately no role hierarchy here (per D-006) - this guard
 * only ever checks "does this specific permission exist on this user's
 * resolved context," never a role-rank comparison.
 */
export const RequirePermission = (permission: string) =>
  SetMetadata('permission', permission);

/**
 * Reads `request.userContext.permissions` - a list populated by the real
 * role-resolution logic once the database exists (Phase 9). Until then,
 * this guard's logic is fully unit-testable with a mocked context, which
 * is exactly what the spec file next to this one does.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<string>(
      'permission',
      context.getHandler(),
    );
    if (!required) return true; // no permission required on this route

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userPermissions: string[] = request.userContext?.permissions ?? [];

    if (!userPermissions.includes(required)) {
      throw new ForbiddenException(`Missing required permission: ${required}`);
    }
    return true;
  }
}
