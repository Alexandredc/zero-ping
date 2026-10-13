CREATE TABLE "ai_scores" (
	"key" text PRIMARY KEY,
	"hash" text NOT NULL,
	"urgency" real NOT NULL,
	"confidence" real,
	"scored_at" timestamp with time zone NOT NULL
);
