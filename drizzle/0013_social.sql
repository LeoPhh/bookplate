CREATE TABLE "block" (
	"blocker" text NOT NULL,
	"blocked" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "block_blocker_blocked_pk" PRIMARY KEY("blocker","blocked"),
	CONSTRAINT "block_not_self" CHECK ("block"."blocker" <> "block"."blocked")
);
--> statement-breakpoint
CREATE TABLE "friend_invite" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"uses_left" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friend_request" (
	"from_user" text NOT NULL,
	"to_user" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "friend_request_from_user_to_user_pk" PRIMARY KEY("from_user","to_user"),
	CONSTRAINT "friend_request_not_self" CHECK ("friend_request"."from_user" <> "friend_request"."to_user")
);
--> statement-breakpoint
CREATE TABLE "friendship" (
	"user_a" text NOT NULL,
	"user_b" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "friendship_user_a_user_b_pk" PRIMARY KEY("user_a","user_b"),
	CONSTRAINT "friendship_order" CHECK ("friendship"."user_a" < "friendship"."user_b")
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"actor_id" text,
	"object_ref" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"bio" text,
	"visibility" text DEFAULT 'friends' NOT NULL,
	"share_reading" boolean DEFAULT true NOT NULL,
	"share_ratings" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation" (
	"id" text PRIMARY KEY NOT NULL,
	"from_user" text NOT NULL,
	"to_user" text NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"isbn" text,
	"ol_work_id" text,
	"work_key" text NOT NULL,
	"note" text,
	"state" text DEFAULT 'new' NOT NULL,
	"added_book_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_blocker_user_id_fk" FOREIGN KEY ("blocker") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_blocked_user_id_fk" FOREIGN KEY ("blocked") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_invite" ADD CONSTRAINT "friend_invite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_request" ADD CONSTRAINT "friend_request_from_user_user_id_fk" FOREIGN KEY ("from_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_request" ADD CONSTRAINT "friend_request_to_user_user_id_fk" FOREIGN KEY ("to_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_user_a_user_id_fk" FOREIGN KEY ("user_a") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_user_b_user_id_fk" FOREIGN KEY ("user_b") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_from_user_user_id_fk" FOREIGN KEY ("from_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_to_user_user_id_fk" FOREIGN KEY ("to_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "block_blocked_idx" ON "block" USING btree ("blocked");--> statement-breakpoint
CREATE INDEX "friend_invite_user_idx" ON "friend_invite" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "friend_request_to_idx" ON "friend_request" USING btree ("to_user");--> statement-breakpoint
CREATE INDEX "friendship_user_b_idx" ON "friendship" USING btree ("user_b");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_handle_idx" ON "profile" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "recommendation_to_idx" ON "recommendation" USING btree ("to_user","created_at");--> statement-breakpoint
CREATE INDEX "recommendation_from_idx" ON "recommendation" USING btree ("from_user");