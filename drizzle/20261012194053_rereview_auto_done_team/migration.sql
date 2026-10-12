CREATE TABLE "team_pulls" (
	"key" text PRIMARY KEY,
	"repo_full_name" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"html_url" text NOT NULL,
	"author" text,
	"is_draft" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"additions" integer DEFAULT 0 NOT NULL,
	"deletions" integer DEFAULT 0 NOT NULL,
	"reviewers" text[] DEFAULT '{}'::text[] NOT NULL,
	"review_decision" text,
	"ci_state" text,
	"mergeable" text,
	"problems" text[] DEFAULT '{}'::text[] NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "subject_type" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "changed_files" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "head_oid" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "reviewed_oid" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "reviewed_state" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "auto_done_reason" text;--> statement-breakpoint
-- Open PRs are enriched again to fill the new review and size columns.
UPDATE "items" SET "enriched_at" = NULL WHERE "state" = 'OPEN' AND "kind" = 'PullRequest';
