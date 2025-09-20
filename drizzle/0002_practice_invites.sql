CREATE TABLE "practice_invites" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "practice_id" uuid NOT NULL,
    "email" text NOT NULL,
    "role" member_role DEFAULT 'member' NOT NULL,
    "invited_by_user_id" uuid,
    "supabase_user_id" uuid,
    "token" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "accepted_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "practice_invites_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "practice_invites_invited_by_user_id_profiles_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "profiles"("user_id") ON DELETE set null ON UPDATE no action,
    CONSTRAINT "practice_invites_token_key" UNIQUE ("token")
);