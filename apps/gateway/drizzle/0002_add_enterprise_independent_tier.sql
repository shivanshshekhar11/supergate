-- Migration: Add enterprise-independent tier
-- This tier enforces BYOK-only (no gateway key fallback)

-- Update tier column comment to include new tier
COMMENT ON COLUMN tenants.tier IS 'Tenant tier: free | pro | enterprise | enterprise-independent';

-- No schema changes needed - tier is already a text field
-- The new tier value will be enforced at application level
