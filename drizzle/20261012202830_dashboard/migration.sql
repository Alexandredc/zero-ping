CREATE TABLE "activity" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activity_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"at" timestamp with time zone NOT NULL,
	"kind" text NOT NULL,
	"view" text NOT NULL,
	"item_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_stats" (
	"date" text PRIMARY KEY,
	"min_pings" integer NOT NULL,
	"max_pings" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "activity_at_index" ON "activity" ("at");--> statement-breakpoint
-- Seeds the trends with what the items already tell.
INSERT INTO "activity" ("at", "kind", "view", "item_key")
SELECT "requested_at", 'entered', 'review', "key" FROM "items" WHERE "requested_at" IS NOT NULL
UNION ALL
SELECT "awaiting_since", 'entered', 'awaiting', "key" FROM "items" WHERE "awaiting_since" IS NOT NULL
UNION ALL
SELECT "reviewed_at", 'left', 'review', "key" FROM "items"
  WHERE "reviewed_at" IS NOT NULL AND "requested_at" IS NOT NULL AND "reviewed_at" >= "requested_at"
UNION ALL
SELECT "done_at", 'left', "view", "key" FROM "items"
  WHERE "done_at" IS NOT NULL AND "auto_done_reason" IS NULL AND "view" IN ('review', 'awaiting')
    AND NOT ("reviewed_at" IS NOT NULL AND "requested_at" IS NOT NULL AND "reviewed_at" >= "requested_at");
