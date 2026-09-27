-- PHASE 2A / READ-ONLY PREFLIGHT / NOT EXECUTED
-- Run only after separate authorization, preferably first on a restored staging copy.
-- SELECT statements only. No customer_name/customer_phone, customer records, or
-- contact fields are selected. Results are aggregate findings or schema metadata.
-- Use a trusted administrative connection: RLS-filtered counts are not a complete
-- audit. Auth access below inspects IDs only, solely for aggregate ownership checks.
-- These queries do not prove historical duration or intended timestamp semantics.

-- 1. Platform and extension prerequisites.
SELECT current_setting('server_version') AS postgres_version,
       current_setting('TimeZone') AS session_timezone,
       EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names
               WHERE name = 'Asia/Jerusalem') AS jerusalem_timezone_available;

SELECT name, default_version, installed_version
FROM pg_catalog.pg_available_extensions WHERE name = 'btree_gist';

SELECT n.nspname AS extension_schema, e.extname, e.extversion
FROM pg_catalog.pg_extension e
JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'btree_gist';

-- 2. Invalid service durations. No arbitrary maximum is proposed.
SELECT count(*) AS services_total,
       count(*) FILTER (WHERE duration_minutes IS NULL OR duration_minutes <= 0)
         AS invalid_duration_count
FROM public.services;

-- 3. Status validity. Do not print arbitrary existing status text.
SELECT count(*) AS appointments_total,
       count(*) FILTER (WHERE status IS NULL) AS null_status_count,
       count(*) FILTER (WHERE status IS NOT NULL AND status NOT IN
         ('scheduled', 'completed', 'cancelled', 'no_show')) AS unknown_status_count,
       count(*) FILTER (WHERE status = 'noshow') AS legacy_noshow_count,
       count(*) FILTER (WHERE status = 'cancelled') AS cancelled_count
FROM public.appointments;

-- 4. Invalid intervals and duration evidence gaps.
-- Equality with the CURRENT service duration is diagnostic, never historical proof.
SELECT count(*) FILTER (WHERE a.start_time IS NULL OR a.end_time IS NULL)
         AS missing_timestamp_count,
       count(*) FILTER (WHERE NOT isfinite(a.start_time) OR NOT isfinite(a.end_time))
         AS nonfinite_timestamp_count,
       count(*) FILTER (WHERE a.end_time <= a.start_time) AS nonpositive_interval_count,
       count(*) FILTER (WHERE isfinite(a.start_time) AND isfinite(a.end_time)
         AND a.end_time > a.start_time
         AND mod(extract(epoch FROM (a.end_time - a.start_time)), 60) <> 0)
         AS nonintegral_minute_interval_count,
       count(*) FILTER (WHERE isfinite(a.start_time) AND isfinite(a.end_time)
         AND a.end_time > a.start_time
         AND extract(epoch FROM (a.end_time - a.start_time))
             <> s.duration_minutes::numeric * 60) AS differs_from_current_service_count,
       count(*) AS historical_duration_provenance_required_count
FROM public.appointments a
LEFT JOIN public.services s ON s.id = a.service_id;

-- 5. Tenant consistency and orphan references.
SELECT count(*) FILTER (WHERE s.id IS NULL) AS missing_service_count,
       count(*) FILTER (WHERE p.id IS NULL) AS missing_profile_count,
       count(*) FILTER (WHERE s.id IS NOT NULL
         AND a.profile_id IS DISTINCT FROM s.profile_id) AS service_profile_mismatch_count
FROM public.appointments a
LEFT JOIN public.services s ON s.id = a.service_id
LEFT JOIN public.profiles p ON p.id = a.profile_id;

-- 6. Existing blocking overlaps, [start,end). NULL/unknown statuses are treated
-- conservatively as blocking here; the migration separately rejects them.
-- Counts PAIRS, not customers or appointments. This may be expensive on large data.
SELECT count(*) AS blocking_overlap_pair_count
FROM public.appointments a
JOIN public.appointments b
  ON a.profile_id = b.profile_id AND a.id < b.id
 AND a.start_time < b.end_time AND b.start_time < a.end_time
WHERE a.status IS DISTINCT FROM 'cancelled'
  AND b.status IS DISTINCT FROM 'cancelled'
  AND isfinite(a.start_time) AND isfinite(a.end_time) AND a.end_time > a.start_time
  AND isfinite(b.start_time) AND isfinite(b.end_time) AND b.end_time > b.start_time;

-- 7. Proposed slot setting: audited schema has no slot_interval_minutes column.
-- If it now exists, stop and reconcile drift before using the proposed migration.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name = 'slot_interval_minutes';

SELECT count(*) AS businesses_to_receive_30_minute_setting
FROM public.profiles;

-- 8. weekly_hours shape. NULL/{} and absent/null days mean CLOSED. Present day
-- objects must contain boolean is_open. Open days require HH:MM start/end with
-- start < end. Closed days may omit times; supplied times must still be valid.
-- Extra day-object fields are ignored; top-level keys must be 0..6 (Sunday = 0).
WITH schedules AS (
  SELECT id, weekly_hours,
         weekly_hours IS NULL OR weekly_hours = 'null'::jsonb AS missing_schedule,
         CASE WHEN jsonb_typeof(weekly_hours) = 'object'
              THEN weekly_hours ELSE '{}'::jsonb END AS safe_hours
  FROM public.profiles
), days AS (
  SELECT p.id, d.key, d.value,
         coalesce(d.value->>'start' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$', false) AS start_ok,
         coalesce(d.value->>'end' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$', false) AS end_ok
  FROM schedules p CROSS JOIN LATERAL jsonb_each(p.safe_hours) d
), invalid_days AS (
  SELECT DISTINCT id FROM days
  WHERE key !~ '^[0-6]$'
     OR (value <> 'null'::jsonb AND (
       jsonb_typeof(value) <> 'object'
       OR jsonb_typeof(value->'is_open') IS DISTINCT FROM 'boolean'
       OR (value ? 'start' AND NOT (start_ok AND jsonb_typeof(value->'start') = 'string'))
       OR (value ? 'end' AND NOT (end_ok AND jsonb_typeof(value->'end') = 'string'))
       OR (value->'is_open' = 'true'::jsonb AND
           (NOT start_ok OR NOT end_ok OR value->>'start' >= value->>'end'))
     ))
)
SELECT count(*) FILTER (WHERE missing_schedule OR safe_hours = '{}'::jsonb)
         AS missing_or_empty_or_nonobject_schedule_count,
       count(*) FILTER (WHERE NOT missing_schedule
         AND jsonb_typeof(weekly_hours) <> 'object') AS invalid_top_level_count,
       count(*) FILTER (WHERE id IN (SELECT id FROM invalid_days))
         AS businesses_with_invalid_day_count
FROM schedules;

-- 9. Legacy UTC-wall-clock heuristic and slot-backfill implications.
-- Compare each existing start against CURRENT hours in both interpretations.
-- Current hours may have changed; neither match nor mismatch proves correctness.
-- Do not print timestamps, appointment IDs, business IDs, or personal fields.
WITH finite_appointments AS MATERIALIZED (
  SELECT a.profile_id, a.start_time
  FROM public.appointments a WHERE isfinite(a.start_time)
), interpretations AS (
  SELECT a.profile_id, z.label, a.start_time AT TIME ZONE z.zone AS wall_start
  FROM finite_appointments a
  CROSS JOIN (VALUES ('intended_jerusalem', 'Asia/Jerusalem'),
                     ('legacy_utc_wall', 'UTC')) z(label, zone)
), configs AS (
  SELECT i.*, p.weekly_hours -> extract(dow FROM i.wall_start)::int::text AS day
  FROM interpretations i JOIN public.profiles p ON p.id = i.profile_id
), boundaries AS (
  SELECT *, CASE WHEN day->>'start' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                      THEN (day->>'start')::time END AS opens,
            CASE WHEN day->>'end' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                      THEN (day->>'end')::time END AS closes
  FROM configs
)
SELECT label, count(*) AS finite_start_count,
       count(*) FILTER (WHERE day->'is_open' = 'true'::jsonb AND opens < closes
         AND wall_start::time >= opens AND wall_start::time < closes)
         AS starts_inside_current_hours,
       count(*) FILTER (WHERE day->'is_open' = 'true'::jsonb AND opens < closes
         AND wall_start::time >= opens AND wall_start::time < closes
         AND mod(extract(epoch FROM (wall_start::time - opens)), 1800) = 0)
         AS starts_on_opening_anchored_30_minute_grid
FROM boundaries GROUP BY label ORDER BY label;

-- Current opening times not aligned to the old :00/:30 convention: setting 30
-- preserves spacing, but opening-anchored starts intentionally differ here.
WITH days AS (
  SELECT d.value
  FROM public.profiles p CROSS JOIN LATERAL jsonb_each(
    CASE WHEN jsonb_typeof(p.weekly_hours) = 'object'
         THEN p.weekly_hours ELSE '{}'::jsonb END) d
)
SELECT count(*) FILTER (WHERE value->'is_open' = 'true'::jsonb
         AND value->>'start' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         AND right(value->>'start', 2) NOT IN ('00','30'))
         AS open_days_whose_new_30_minute_grid_differs
FROM days;

-- 10. Ownership assumptions; no Auth emails or metadata are selected.
SELECT count(*) AS profile_count,
       count(*) FILTER (WHERE u.id IS NULL) AS profiles_without_auth_user
FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id;

SELECT count(*) FILTER (WHERE p.id IS NULL) AS services_without_profile
FROM public.services s LEFT JOIN public.profiles p ON p.id = s.profile_id;

-- 11. Reconfirm structure, policy, grant and function drift before any cutover.
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS table_owner
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('profiles','services','appointments');

SELECT c.relname, con.conname, con.contype, pg_get_constraintdef(con.oid) AS definition
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('profiles','services','appointments')
ORDER BY c.relname, con.conname;

SELECT tablename, indexname, indexdef FROM pg_catalog.pg_indexes
WHERE schemaname = 'public' AND tablename IN ('profiles','services','appointments');

SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public' AND tablename IN ('profiles','services','appointments');

SELECT table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND table_name IN ('profiles','services','appointments');

SELECT table_name, column_name, grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name IN ('profiles','services','appointments');

SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef, p.proacl
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public';

SELECT c.relname, t.tgname, pg_get_triggerdef(t.oid) AS definition
FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('profiles','services','appointments')
  AND NOT t.tgisinternal;
