ALTER TABLE "practice_invites" ADD COLUMN "last_sent_at" timestamp with time zone DEFAULT now() NOT NULL;
