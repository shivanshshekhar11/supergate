import { db, pool } from './client'
import { tenants, apiKeys, users, userTenants, usageLogs, cacheEntries, tenantLLMKeys } from './schema'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { sql } from 'drizzle-orm'

/**
 * Seed script: Creates test tenants, users, and extensive sample data
 * Run with: pnpm --filter @llm-gateway/gateway db:seed
 * 
 * This script is idempotent - it clears all data and recreates it on every run.
 * Safe for development/testing environments only.
 */
async function seed() {
  console.log('🌱 Seeding database...\n')
  console.log('⚠️  Clearing existing data...')

  try {
    // Clear all existing data (in correct order due to foreign keys)
    await db.delete(cacheEntries)
    await db.delete(usageLogs)
    await db.delete(tenantLLMKeys)
    await db.delete(apiKeys)
    await db.delete(userTenants)
    await db.delete(users)
    await db.delete(tenants)
    console.log('✓ Cleared all existing data\n')

    // 1. Create tenants
    console.log('📦 Creating tenants...')
    
    const [proTenant] = await db
      .insert(tenants)
      .values({
        name: 'Test Tenant (Pro)',
        tier: 'pro',
      })
      .returning()
    console.log(`✓ Created Pro tenant (ID: ${proTenant.id})`)

    const [freeTenant] = await db
      .insert(tenants)
      .values({
        name: 'Test Tenant (Free)',
        tier: 'free',
      })
      .returning()
    console.log(`✓ Created Free tenant (ID: ${freeTenant.id})`)

    const [enterpriseTenant] = await db
      .insert(tenants)
      .values({
        name: 'Test Tenant (Enterprise)',
        tier: 'enterprise',
      })
      .returning()
    console.log(`✓ Created Enterprise tenant (ID: ${enterpriseTenant.id})`)

    const [independentTenant] = await db
      .insert(tenants)
      .values({
        name: 'Test Tenant (Enterprise-Independent)',
        tier: 'enterprise-independent',
      })
      .returning()
    console.log(`✓ Created Enterprise-Independent tenant (ID: ${independentTenant.id})`)

    // 2. Create API keys for each tenant
    console.log('\n🔑 Creating API keys...')
    
    const proRawKey = `gw_${randomBytes(24).toString('hex')}`
    const proKeyHash = await bcrypt.hash(proRawKey, 10)
    const [proApiKey] = await db
      .insert(apiKeys)
      .values({
        tenantId: proTenant.id,
        keyHash: proKeyHash,
        keyPrefix: proRawKey.substring(0, 8),
        role: 'admin',
        name: 'Pro Admin Key',
        revoked: false,
      })
      .returning()
    console.log(`✓ Created Pro API key`)

    const freeRawKey = `gw_${randomBytes(24).toString('hex')}`
    const freeKeyHash = await bcrypt.hash(freeRawKey, 10)
    const [freeApiKey] = await db
      .insert(apiKeys)
      .values({
        tenantId: freeTenant.id,
        keyHash: freeKeyHash,
        keyPrefix: freeRawKey.substring(0, 8),
        role: 'admin',
        name: 'Free Admin Key',
        revoked: false,
      })
      .returning()
    console.log(`✓ Created Free API key`)

    const enterpriseRawKey = `gw_${randomBytes(24).toString('hex')}`
    const enterpriseKeyHash = await bcrypt.hash(enterpriseRawKey, 10)
    const [enterpriseApiKey] = await db
      .insert(apiKeys)
      .values({
        tenantId: enterpriseTenant.id,
        keyHash: enterpriseKeyHash,
        keyPrefix: enterpriseRawKey.substring(0, 8),
        role: 'admin',
        name: 'Enterprise Admin Key',
        revoked: false,
      })
      .returning()
    console.log(`✓ Created Enterprise API key`)

    const independentRawKey = `gw_${randomBytes(24).toString('hex')}`
    const independentKeyHash = await bcrypt.hash(independentRawKey, 10)
    const [independentApiKey] = await db
      .insert(apiKeys)
      .values({
        tenantId: independentTenant.id,
        keyHash: independentKeyHash,
        keyPrefix: independentRawKey.substring(0, 8),
        role: 'admin',
        name: 'Enterprise-Independent Admin Key',
        revoked: false,
      })
      .returning()
    console.log(`✓ Created Enterprise-Independent API key`)

    // 3. Create test users
    console.log('\n👤 Creating users...')
    
    const testPassword = 'password123'
    const passwordHash = await bcrypt.hash(testPassword, 10)
    
    const [adminUser] = await db
      .insert(users)
      .values({
        email: 'admin@example.com',
        passwordHash,
        name: 'Test Admin',
      })
      .returning()
    console.log(`✓ Created admin user (ID: ${adminUser.id})`)

    const [memberUser] = await db
      .insert(users)
      .values({
        email: 'member@example.com',
        passwordHash,
        name: 'Test Member',
      })
      .returning()
    console.log(`✓ Created member user (ID: ${memberUser.id})`)

    // 4. Link users to tenants
    console.log('\n🔗 Linking users to tenants...')
    
    await db.insert(userTenants).values({
      userId: adminUser.id,
      tenantId: proTenant.id,
      role: 'admin',
    })
    console.log(`✓ Linked admin user to Pro tenant as admin`)

    await db.insert(userTenants).values({
      userId: memberUser.id,
      tenantId: proTenant.id,
      role: 'member',
    })
    console.log(`✓ Linked member user to Pro tenant as member`)

    await db.insert(userTenants).values({
      userId: adminUser.id,
      tenantId: freeTenant.id,
      role: 'admin',
    })
    console.log(`✓ Linked admin user to Free tenant as admin`)

    // 5. Generate extensive sample usage data
    console.log('\n📊 Generating extensive sample usage data...')
    
    const models = [
      { model: 'gpt-4-turbo', provider: 'openai', inputCost: 0.01, outputCost: 0.03 },
      { model: 'gpt-3.5-turbo', provider: 'openai', inputCost: 0.0005, outputCost: 0.0015 },
      { model: 'gpt-4', provider: 'openai', inputCost: 0.03, outputCost: 0.06 },
      { model: 'claude-3-opus', provider: 'anthropic', inputCost: 0.015, outputCost: 0.075 },
      { model: 'claude-3-sonnet', provider: 'anthropic', inputCost: 0.003, outputCost: 0.015 },
      { model: 'claude-3-haiku', provider: 'anthropic', inputCost: 0.00025, outputCost: 0.00125 },
    ]

    const statusCodes = [
      { code: 200, weight: 85 },  // 85% success
      { code: 429, weight: 10 },  // 10% rate limited
      { code: 500, weight: 5 },   // 5% errors
    ]

    let totalLogs = 0
    let totalCacheEntries = 0
    const now = new Date()

    // Generate usage logs for the past 30 days (extensive data)
    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      const date = new Date(now)
      date.setDate(date.getDate() - dayOffset)
      date.setHours(0, 0, 0, 0)

      // Generate 50-150 requests per day for realistic volume
      const requestsPerDay = Math.floor(Math.random() * 100) + 50

      for (let i = 0; i < requestsPerDay; i++) {
        const modelInfo = models[Math.floor(Math.random() * models.length)]
        
        // Weighted random status code
        const rand = Math.random() * 100
        let statusCode = 200
        let cumulative = 0
        for (const status of statusCodes) {
          cumulative += status.weight
          if (rand < cumulative) {
            statusCode = status.code
            break
          }
        }

        // Vary token counts based on model
        const baseInputTokens = modelInfo.model.includes('gpt-4') ? 500 : 300
        const baseOutputTokens = modelInfo.model.includes('gpt-4') ? 300 : 150
        
        const inputTokens = Math.floor(Math.random() * baseInputTokens * 2) + baseInputTokens
        const outputTokens = Math.floor(Math.random() * baseOutputTokens * 2) + baseOutputTokens
        const costUsd = (inputTokens / 1000) * modelInfo.inputCost + (outputTokens / 1000) * modelInfo.outputCost
        
        // Latency varies by model and status
        let latencyMs: number | null
        if (statusCode === 200) {
          latencyMs = Math.floor(Math.random() * 2000) + 500
        } else if (statusCode === 429) {
          latencyMs = Math.floor(Math.random() * 100) + 50 // Fast rejection
        } else {
          latencyMs = null // Errors might not have latency
        }
        
        const cached = statusCode === 200 && Math.random() > 0.65 // 35% cache hit rate for successful requests

        // Distribute requests throughout the day
        const requestTime = new Date(date)
        requestTime.setHours(Math.floor(Math.random() * 24))
        requestTime.setMinutes(Math.floor(Math.random() * 60))
        requestTime.setSeconds(Math.floor(Math.random() * 60))

        // Randomly assign to different tenants (mostly Pro, some Free)
        const tenantId = Math.random() > 0.2 ? proTenant.id : freeTenant.id
        const apiKeyId = tenantId === proTenant.id ? proApiKey.id : freeApiKey.id

        await db.insert(usageLogs).values({
          tenantId,
          apiKeyId,
          model: modelInfo.model,
          provider: modelInfo.provider,
          inputTokens,
          outputTokens,
          costUsd: costUsd.toFixed(8),
          latencyMs,
          cached,
          statusCode,
          requestId: `req_${randomBytes(12).toString('hex')}`,
          createdAt: requestTime,
        })

        totalLogs++

        // Create cache entries for some cached requests
        if (cached && Math.random() > 0.6) {
          const embedding = `[${Array(1536).fill(0).map(() => Math.random()).join(',')}]`
          
          await db.insert(cacheEntries).values({
            tenantId,
            model: modelInfo.model,
            promptHash: `hash_${randomBytes(16).toString('hex')}`,
            embedding: embedding as any,
            response: { 
              content: 'Cached response content',
              model: modelInfo.model,
              usage: { input_tokens: inputTokens, output_tokens: outputTokens }
            } as any,
            hitCount: Math.floor(Math.random() * 10) + 1,
          })
          totalCacheEntries++
        }
      }
    }

    console.log(`✓ Generated ${totalLogs} usage logs across 30 days`)
    console.log(`✓ Generated ${totalCacheEntries} cache entries`)

    // Print results
    console.log(`\n${'='.repeat(80)}`)
    console.log('🔑 API KEYS (save these - they will not be shown again):')
    console.log(`${'='.repeat(80)}`)
    
    console.log('\n1. PRO TIER:')
    console.log(`   Tenant ID: ${proTenant.id}`)
    console.log(`   API Key: ${proRawKey}`)
    console.log(`   Usage: Authorization: Bearer ${proRawKey}`)
    
    console.log('\n2. FREE TIER:')
    console.log(`   Tenant ID: ${freeTenant.id}`)
    console.log(`   API Key: ${freeRawKey}`)
    console.log(`   Usage: Authorization: Bearer ${freeRawKey}`)
    
    console.log('\n3. ENTERPRISE TIER:')
    console.log(`   Tenant ID: ${enterpriseTenant.id}`)
    console.log(`   API Key: ${enterpriseRawKey}`)
    console.log(`   Usage: Authorization: Bearer ${enterpriseRawKey}`)
    
    console.log('\n4. ENTERPRISE-INDEPENDENT TIER (BYOK only):')
    console.log(`   Tenant ID: ${independentTenant.id}`)
    console.log(`   API Key: ${independentRawKey}`)
    console.log(`   Usage: Authorization: Bearer ${independentRawKey}`)
    console.log(`   ⚠️  This tenant MUST configure BYOK keys for each provider`)
    
    console.log(`\n${'='.repeat(80)}`)
    console.log('👤 DASHBOARD USERS:')
    console.log(`${'='.repeat(80)}`)
    
    console.log('\n1. ADMIN USER:')
    console.log(`   Email: admin@example.com`)
    console.log(`   Password: password123`)
    console.log(`   Tenants: Pro (admin), Free (admin)`)
    
    console.log('\n2. MEMBER USER:')
    console.log(`   Email: member@example.com`)
    console.log(`   Password: password123`)
    console.log(`   Tenants: Pro (member)`)
    
    console.log(`\n${'='.repeat(80)}`)
    console.log('📊 DATA SUMMARY:')
    console.log(`${'='.repeat(80)}`)
    console.log(`   Tenants: 4`)
    console.log(`   API Keys: 4`)
    console.log(`   Users: 2`)
    console.log(`   Usage Logs: ${totalLogs} (30 days)`)
    console.log(`   Cache Entries: ${totalCacheEntries}`)
    console.log(`${'='.repeat(80)}\n`)

    console.log('✅ Seeding complete!\n')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seed()
