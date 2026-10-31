ALTER TABLE "profile" ALTER COLUMN "visibility" SET DEFAULT 'private';--> statement-breakpoint
UPDATE "profile" SET "visibility" = 'private' WHERE "visibility" = 'friends';
