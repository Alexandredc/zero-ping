CREATE TABLE "item_chats" (
	"item_key" text PRIMARY KEY,
	"messages" jsonb DEFAULT '[]' NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
