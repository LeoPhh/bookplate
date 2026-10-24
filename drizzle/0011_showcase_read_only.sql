-- Showcases only ever show finished books now, so the choice of what to
-- show goes.
ALTER TABLE "showcase" DROP COLUMN "include";
