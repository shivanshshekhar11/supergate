import { db, pool } from './client'
import { tenants, apiKeys, users, userTenants } from './schema'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'

/**
 * Seed script: Creates test tenants and API keys
 * Run with: pnpm --filter @llm-gateway/gateway db:seed
 */
async function seed() {
  console.log('🌱 Seeding database...\n')

  try {
    // 1. Create Pro Tier Tenant (uses gateway keys as fallback)
    const existingProTenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.name, 'Test Tenant (Pro)'))
      .limit(1)

    let proTenantId: string

    if (existingProTenant.length > 0) {
      proTenantId = existingProTenant[0].id
      console.log(`✓ Pro tenant already exists (ID: ${proTenantId})`)
    } else {
      const [tenant] = await db
        .insert(tenants)
        .values({
          name: 'Test Tenant (Pro)',
          tier: 'pro',
        })
        .returning()

      proTenantId = tenant.id
      console.log(`✓ Created Pro tenant (ID: ${proTenantId})`)
    }

    // Generate API key for Pro tenant
    const proRawKey = `gw_${randomBytes(24).toString('hex')}`
    const proKeyPrefix = proRawKey.substring(0, 8)
    const proKeyHash = await bcrypt.hash(proRawKey, 10)

    const [proApiKey] = await db
      .insert(apiKeys)
      .values({
        tenantId: proTenantId,
        keyHash: proKeyHash,
        keyPrefix: proKeyPrefix,
        role: 'admin',
        name: 'Pro Admin Key',
        revoked: false,
      })
      .returning()

    console.log(`✓ Created Pro API key (ID: ${proApiKey.id})`)

    // 2. Create Enterprise-Independent Tier Tenant (BYOK only, no fallback)
    const existingIndependentTenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.name, 'Test Tenant (Enterprise-Independent)'))
      .limit(1)

    let independentTenantId: string

    if (existingIndependentTenant.length > 0) {
      independentTenantId = existingIndependentTenant[0].id
      console.log(`✓ Enterprise-Independent tenant already exists (ID: ${independentTenantId})`)
    } else {
      const [tenant] = await db
        .insert(tenants)
        .values({
          name: 'Test Tenant (Enterprise-Independent)',
          tier: 'enterprise-independent',
        })
        .returning()

      independentTenantId = tenant.id
      console.log(`✓ Created Enterprise-Independent tenant (ID: ${independentTenantId})`)
    }

    // Generate API key for Enterprise-Independent tenant
    const independentRawKey = `gw_${randomBytes(24).toString('hex')}`
    const independentKeyPrefix = independentRawKey.substring(0, 8)
    const independentKeyHash = await bcrypt.hash(independentRawKey, 10)

    const [independentApiKey] = await db
      .insert(apiKeys)
      .values({
        tenantId: independentTenantId,
        keyHash: independentKeyHash,
        keyPrefix: independentKeyPrefix,
        role: 'admin',
        name: 'Enterprise-Independent Admin Key',
        revoked: false,
      })
      .returning()

    console.log(`✓ Created Enterprise-Independent API key (ID: ${independentApiKey.id})`)

    // 3. Create test user with Pro tenant access
    const testEmail = 'admin@example.com'
    const testPassword = 'password123'
    
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1)

    let userId: string

    if (existingUser.length > 0) {
      userId = existingUser[0].id
      console.log(`✓ Test user already exists (ID: ${userId})`)
    } else {
      const passwordHash = await bcrypt.hash(testPassword, 10)
      const [user] = await db
        .insert(users)
        .values({
          email: testEmail,
          passwordHash,
          name: 'Test Admin',
        })
        .returning()

      userId = user.id
      console.log(`✓ Created test user (ID: ${userId})`)

      // Link user to Pro tenant as admin
      await db.insert(userTenants).values({
        userId,
        tenantId: proTenantId,
        role: 'admin',
      })

      console.log(`✓ Linked user to Pro tenant as admin`)
    }

    // Print results
    console.log(`\n${'='.repeat(70)}`)
    console.log('🔑 API KEYS (save these - they will not be shown again):')
    console.log(`${'='.repeat(70)}`)
    
    console.log('\n1. PRO TIER (can use gateway keys as fallback):')
    console.log(`   Tenant ID: ${proTenantId}`)
    console.log(`   API Key: ${proRawKey}`)
    console.log(`   Usage: Authorization: Bearer ${proRawKey}`)
    
    console.log('\n2. ENTERPRISE-INDEPENDENT TIER (BYOK only, no fallback):')
    console.log(`   Tenant ID: ${independentTenantId}`)
    console.log(`   API Key: ${independentRawKey}`)
    console.log(`   Usage: Authorization: Bearer ${independentRawKey}`)
    console.log(`   ⚠️  This tenant MUST configure BYOK keys for each provider`)
    console.log(`   ⚠️  Requests will fail if provider key is not configured`)
    
    console.log('\n3. TEST USER (for dashboard login):')
    console.log(`   Email: ${testEmail}`)
    console.log(`   Password: ${testPassword}`)
    console.log(`   Tenant: Test Tenant (Pro)`)
    console.log(`   Role: admin`)
    
    console.log(`\n${'='.repeat(70)}\n`)

    console.log('✅ Seeding complete!\n')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seed()
