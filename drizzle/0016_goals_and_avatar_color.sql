CREATE TABLE "reading_goal" (
	"user_id" text NOT NULL,
	"year" integer NOT NULL,
	"books" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reading_goal_user_id_year_pk" PRIMARY KEY("user_id","year")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "avatar_color" integer;--> statement-breakpoint
ALTER TABLE "reading_goal" ADD CONSTRAINT "reading_goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;