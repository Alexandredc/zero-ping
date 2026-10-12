ALTER TABLE "summaries" ADD COLUMN "length" text DEFAULT 'detailed';--> statement-breakpoint
ALTER TABLE "summaries" DROP CONSTRAINT "summaries_pkey";--> statement-breakpoint
ALTER TABLE "summaries" ADD PRIMARY KEY ("item_key","length");