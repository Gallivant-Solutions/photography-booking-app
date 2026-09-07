-- The RLS-bound application role.
--
-- DATABASE_URL must connect as this role (or an equivalent one you create in
-- your provider's console). It must NOT own the tables and must NOT have
-- BYPASSRLS, otherwise the policies in 0000_init.sql are decorative.
--
-- After running this migration, set a real password:
--   ALTER ROLE bookedin_app PASSWORD '<strong-password>';
-- and point DATABASE_URL at it. Keep DATABASE_ADMIN_URL on the owner role.
--
-- On providers where CREATE ROLE is not permitted from SQL (some managed
-- Postgres tiers), create the role in the console instead and re-run the
-- GRANT statements below.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bookedin_app') THEN
    CREATE ROLE bookedin_app LOGIN PASSWORD 'change-me-before-deploy' NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO bookedin_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bookedin_app;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bookedin_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bookedin_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO bookedin_app;--> statement-breakpoint

-- System-only tables: the app role never reads the webhook log, and never
-- touches drizzle's own migration bookkeeping.
REVOKE ALL ON TABLE stripe_events FROM bookedin_app;--> statement-breakpoint
