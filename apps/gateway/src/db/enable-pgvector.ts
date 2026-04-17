/**
 * Enable pgvector extension
 * Run this before pushing schema to database in development
 */

import { db } from './client'
import { sql } from 'drizzle-orm'

async function enablePgVector() {
  try {
    console.log('Enabling pgvector extension...')
    
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
    
    console.log('✅ pgvector extension enabled successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Failed to enable pgvector extension:', error)
    process.exit(1)
  }
}

enablePgVector()
