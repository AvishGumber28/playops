import { Request } from 'express';

/**
 * Populated progressively as a request passes through guards:
 * JwtAuthGuard sets userId, and (once built in Phase 9) a role-resolution
 * step sets userContext for PermissionsGuard to read.
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;
  userContext?: {
    permissions: string[];
  };
}
