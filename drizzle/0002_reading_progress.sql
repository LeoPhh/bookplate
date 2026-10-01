CREATE TABLE "reading_progress" (
	"user_id" text NOT NULL,
	"book_id" text NOT NULL,
	"date" text NOT NULL,
	"page" integer,
	"percent" real NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reading_progress_user_id_book_id_date_pk" PRIMARY KEY("user_id","book_id","date")
);
--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;