CREATE TABLE "pull_insights" (
	"item_key" text PRIMARY KEY,
	"hash" text NOT NULL,
	"insights" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summary_reads" (
	"item_key" text PRIMARY KEY,
	"read_at" timestamp with time zone NOT NULL
);
