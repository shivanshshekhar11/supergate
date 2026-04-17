-- Add tenant_llm_keys table for BYOK (Bring Your Own Key) support
CREATE TABLE IF NOT EXISTS "tenant_llm_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"iv" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key
ALTER TABLE "tenant_llm_keys" ADD CONSTRAINT "tenant_llm_keys_tenant_id_tenants_id_fk" 
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS "tenant_llm_keys_tenant_provider_idx" 
  ON "tenant_llm_keys" ("tenant_id","provider","is_active");

-- Add comment
COMMENT ON TABLE "tenant_llm_keys" IS 'Stores encrypted LLM provider API keys for tenants using BYOK. Gateway falls back to gateway-owned keys if tenant has not provided their own.';
