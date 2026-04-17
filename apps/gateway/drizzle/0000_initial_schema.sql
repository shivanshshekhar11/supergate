-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create tenants table
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create api_keys table
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"name" text,
	"revoked" boolean DEFAULT false NOT NULL,
	"last_used" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);

-- Create usage_logs table
CREATE TABLE IF NOT EXISTS "usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"api_key_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost_usd" numeric(12, 8) NOT NULL,
	"latency_ms" integer,
	"cached" boolean DEFAULT false NOT NULL,
	"request_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create cache_entries table
CREATE TABLE IF NOT EXISTS "cache_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"model" text NOT NULL,
	"prompt_hash" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"response" jsonb NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign keys
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "cache_entries" ADD CONSTRAINT "cache_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;

-- Create indexes
CREATE INDEX IF NOT EXISTS "usage_logs_tenant_created_idx" ON "usage_logs" ("tenant_id","created_at");
CREATE INDEX IF NOT EXISTS "usage_logs_tenant_model_idx" ON "usage_logs" ("tenant_id","model","created_at");
CREATE INDEX IF NOT EXISTS "cache_exact_match_idx" ON "cache_entries" ("tenant_id","model","prompt_hash");

-- Create HNSW index for vector similarity search
CREATE INDEX IF NOT EXISTS "cache_embedding_hnsw_idx" ON "cache_entries" 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Enable Row Level Security on usage_logs
ALTER TABLE "usage_logs" ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for tenant isolation
CREATE POLICY "tenant_isolation_usage_logs" ON "usage_logs"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Enable Row Level Security on api_keys
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for tenant isolation
CREATE POLICY "tenant_isolation_api_keys" ON "api_keys"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
