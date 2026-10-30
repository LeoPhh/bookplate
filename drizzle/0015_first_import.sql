ALTER TABLE "user" ADD COLUMN "first_import_at" timestamp;--> statement-breakpoint
-- Imports weren't noted before now. Goodreads and StoryGraph books keep ids
-- only an import gives them, so those readers can be filled in. Others who
-- imported a Bookplate export left no trace.
UPDATE "user" u SET "first_import_at" = now()
WHERE EXISTS (SELECT 1 FROM "book" b WHERE b."user_id" = u."id" AND (b."id" LIKE 'gr-%' OR b."id" LIKE 'sg-%'));
