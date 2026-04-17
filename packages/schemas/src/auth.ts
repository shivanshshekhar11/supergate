import { z } from 'zod'

/**
 * User registration request schema
 */
export const RegisterRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  tenantName: z.string().min(1, 'Tenant name is required'),
})

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>

/**
 * User login request schema
 */
export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginRequest = z.infer<typeof LoginRequestSchema>

/**
 * User info schema (returned in auth responses)
 */
export const UserInfoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.string().datetime(),
})

export type UserInfo = z.infer<typeof UserInfoSchema>

/**
 * Tenant info schema (returned in auth responses)
 */
export const TenantInfoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  tier: z.enum(['free', 'pro', 'enterprise', 'enterprise-independent']),
  role: z.enum(['admin', 'member', 'guest']),
  createdAt: z.string().datetime(),
})

export type TenantInfo = z.infer<typeof TenantInfoSchema>

/**
 * Auth response schema (login/register)
 */
export const AuthResponseSchema = z.object({
  token: z.string(),
  user: UserInfoSchema,
  tenant: TenantInfoSchema,
})

export type AuthResponse = z.infer<typeof AuthResponseSchema>

/**
 * Me response schema (current user info with all tenants)
 */
export const MeResponseSchema = z.object({
  user: UserInfoSchema,
  tenants: z.array(TenantInfoSchema),
})

export type MeResponse = z.infer<typeof MeResponseSchema>
