import { db, pool } from './client'
import { tenants, apiKeys } from './schema'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'

/**
 * Seed script: Creates a test tenant and API key
 * Run with: pnpm --filter @llm-gateway/gateway db:seed
 */
async function seed() {
  console.log('🌱 Seeding database...\n')

  try {
    // Check if test tenant already exists
    const existingTenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.name, 'Test Tenant'))
      .limit(1)

    let tenantId: string

    if (existingTenant.length > 0) {
      tenantId = existingTenant[0].id
      console.log(`✓ Test tenant already exists (ID: ${tenantId})`)
    } else {
      // Create test tenant
      const [tenant] = await db
        .insert(tenants)
        .values({
          name: 'Test Tenant',
          tier: 'pro',
        })
        .returning()

      tenantId = tenant.id
      console.log(`✓ Created test tenant (ID: ${tenantId})`)
    }

    // Generate API key
    const rawKey = `gw_${randomBytes(24).toString('hex')}` // gw_ + 48 hex chars
    const keyPrefix = rawKey.substring(0, 8) // "gw_abc12"
    const keyHash = await bcrypt.hash(rawKey, 10)

    // Insert API key
    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        tenantId,
        keyHash,
        keyPrefix,
        role: 'admin',
        name: 'Test Admin Key',
        revoked: false,
      })
      .returning()

    console.log(`✓ Created API key (ID: ${apiKey.id})`)
    console.log(`\n${'='.repeat(60)}`)
    console.log('🔑 API KEY (save this - it will not be shown again):')
    console.log(`${'='.repeat(60)}`)
    console.log(`\n${rawKey}\n`)
    console.log(`${'='.repeat(60)}`)
    console.log('\nUse this key in the Authorization header:')
    console.log(`Authorization: Bearer ${rawKey}`)
    console.log(`${'='.repeat(60)}\n`)

    console.log('✅ Seeding complete!\n')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seed()
