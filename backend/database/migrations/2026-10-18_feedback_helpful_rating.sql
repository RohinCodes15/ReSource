-- Existing Supabase projects: apply manually after the base schema, only after review.
-- New projects get the same columns and checks from schema.sql.
-- Adds the "was this helpful?" rating to feedback. Like the rest of feedback, it has no owner_hash.
begin;

alter table public.feedback drop constraint if exists feedback_kind_check;
alter table public.feedback add constraint feedback_kind_check
  check (kind in ('problem', 'idea', 'data_error', 'helpful_rating'));

alter table public.feedback add column if not exists was_helpful boolean;
alter table public.feedback add column if not exists context text;
alter table public.feedback drop constraint if exists feedback_context_check;
alter table public.feedback add constraint feedback_context_check check (char_length(context) <= 40);

-- No grant or policy changes: admins already read every feedback column, and only the API inserts.
commit;
