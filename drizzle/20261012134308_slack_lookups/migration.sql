CREATE TABLE "slack_lookups" (
	"item_key" text PRIMARY KEY,
	"status" text NOT NULL,
	"discussions" jsonb DEFAULT '[]' NOT NULL,
	"error" text,
	"agent" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone
);
