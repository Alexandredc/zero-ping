ALTER TABLE "items" ADD COLUMN "merge_state_status" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "readiness" jsonb;--> statement-breakpoint
ALTER TABLE "team_pulls" ADD COLUMN "readiness" jsonb;