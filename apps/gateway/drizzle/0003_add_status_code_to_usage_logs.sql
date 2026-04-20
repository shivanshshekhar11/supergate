-- Add status_code column to usage_logs table
ALTER TABLE "usage_logs" ADD COLUMN "status_code" integer DEFAULT 200 NOT NULL;
