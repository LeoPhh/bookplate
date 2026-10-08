ALTER TABLE "user" ADD COLUMN "last_seen_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
-- Existing accounts: the last time a session was used, or else sign-up.
UPDATE "user" u SET "last_seen_at" = coalesce((SELECT max(s.updated_at) FROM session s WHERE s.user_id = u.id), u.created_at);
