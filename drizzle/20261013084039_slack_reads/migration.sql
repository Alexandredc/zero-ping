CREATE TABLE "slack_reads" (
	"permalink" text PRIMARY KEY,
	"read_through" text NOT NULL,
	"read_at" timestamp with time zone NOT NULL
);
