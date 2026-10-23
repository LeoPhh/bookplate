-- One showcase per reader: keep each reader's most recently saved one; the
-- others' addresses stop working.
DELETE FROM "showcase" s USING "showcase" newer
  WHERE newer.user_id = s.user_id
    AND (newer.updated_at, newer.id) > (s.updated_at, s.id);--> statement-breakpoint
DROP INDEX "showcase_user_year_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "showcase_user_idx" ON "showcase" USING btree ("user_id");
