ALTER TABLE "user" ADD COLUMN "features" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
-- Source and Copy become optional, off by default. Accounts already using them keep them on.
UPDATE "user" u SET "features" = array_remove(ARRAY[
  CASE WHEN EXISTS (SELECT 1 FROM book b WHERE b.user_id = u.id AND coalesce(b.format, '') <> '') THEN 'source' END,
  CASE WHEN EXISTS (SELECT 1 FROM book b WHERE b.user_id = u.id AND b.copy) THEN 'copy' END
], NULL);
