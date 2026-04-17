import { FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken, JWTPayload } from '../lib/jwt'

/**
 * User context attached to request after JWT verification
 */
export interface UserContext {
  userId: string
  tenantId: string
  role: 'admin' | 'member' | 'guest'
}

/**
 * Extend Fastify request type to include userContext
 */
declare module 'fastify' {
  interface FastifyRequest {
    userContext?: UserContext
  }
}

/**
 * Dashboard authentication middleware
 * Validates JWT token from Authorization header
 * Separate from API key auth - used for dashboard-facing endpoints
 * 
 * @param request - Fastify request
 * @param reply - Fastify reply
 */
export async function dashboardAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization

  if (!authHeader) {
    return reply.status(401).send({
      error: {
        code: 'missing_authorization',
        message: 'Authorization header is required',
      },
    })
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return reply.status(401).send({
      error: {
        code: 'invalid_authorization_format',
        message: 'Authorization header must be in format: Bearer <token>',
      },
    })
  }

  const token = parts[1]

  try {
    const payload: JWTPayload = verifyToken(token)

    // Attach user context to request
    request.userContext = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid token'
    return reply.status(401).send({
      error: {
        code: 'invalid_token',
        message,
      },
    })
  }
}

/**
 * Require specific role(s) for a route
 * Must be used after dashboardAuthMiddleware
 * 
 * @param allowedRoles - Array of allowed roles
 * @returns Middleware function
 */
export function requireRole(...allowedRoles: Array<'admin' | 'member' | 'guest'>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.userContext) {
      return reply.status(401).send({
        error: {
          code: 'unauthorized',
          message: 'Authentication required',
        },
      })
    }

    if (!allowedRoles.includes(request.userContext.role)) {
      return reply.status(403).send({
        error: {
          code: 'forbidden',
          message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        },
      })
    }
  }
}
