CREATE TABLE "items" (
	"key" text PRIMARY KEY,
	"repo_full_name" text NOT NULL,
	"number" integer,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"html_url" text NOT NULL,
	"thread_id" text,
	"reason" text NOT NULL,
	"unread" boolean DEFAULT true NOT NULL,
	"view" text DEFAULT 'other' NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"state" text,
	"is_draft" boolean DEFAULT false NOT NULL,
	"author" text,
	"labels" text[] DEFAULT '{}'::text[] NOT NULL,
	"additions" integer,
	"deletions" integer,
	"ci_state" text,
	"review_decision" text,
	"review_request" text,
	"approvals" integer DEFAULT 0 NOT NULL,
	"pending_reviewers" integer DEFAULT 0 NOT NULL,
	"requested_at" timestamp with time zone,
	"awaiting_me" boolean DEFAULT false NOT NULL,
	"awaiting_url" text,
	"awaiting_excerpt" text,
	"awaiting_from" text,
	"awaiting_since" timestamp with time zone,
	"ai_urgency" real,
	"ai_confidence" real,
	"ai_question_probability" real,
	"ai_hash" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"priority_reasons" jsonb DEFAULT '[]' NOT NULL,
	"needs_check" boolean DEFAULT false NOT NULL,
	"enriched_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"full_name" text PRIMARY KEY,
	"tracked" boolean DEFAULT true NOT NULL,
	"added_manually" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY,
	"value" jsonb NOT NULL
);
