CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" uuid,
	"target_user_id" uuid,
	"metadata" json DEFAULT 'null'::json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
