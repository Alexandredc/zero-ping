CREATE TABLE "summaries" (
	"item_key" text PRIMARY KEY,
	"content" jsonb NOT NULL,
	"model" text NOT NULL,
	"source_updated_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
