-- PHASE 2A PROPOSAL ONLY. NEVER APPLIED OR EXECUTED BY THIS TASK.
-- Outside supabase/migrations intentionally. Not a deployment-ready release.
-- Read README.md first. This is a one-time, transactional, fail-closed foundation.
-- It DISABLES application appointment writes and public base-table catalog reads.
-- Phase 2B must supply the controlled flow before public booking can reopen.
-- Execute only after explicit authorization, staging rehearsal, a recovery point,
-- provenance review, and a maintenance/write pause. Do not run individual pieces.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = pg_catalog, public, extensions;

-- Prevent changes between the data gates and constraint installation.
-- Lock duration must be measured on staging; do not blindly increase timeouts.
LOCK TABLE public.profiles, public.services, public.appointments IN ACCESS EXCLUSIVE MODE;

-- Only the human-approved experimental profile may be deleted. Its exact UUID
-- was uniquely verified read-only and explicitly confirmed by the user;
-- NEVER discover the deletion target by absence of an Auth user.
CREATE TEMP TABLE phase2a_profile_remediation (
  singleton boolean PRIMARY KEY CHECK (singleton),
  profile_id uuid
) ON COMMIT DROP;
INSERT INTO pg_temp.phase2a_profile_remediation (singleton, profile_id)
VALUES (true, 'a26afa50-4082-4bb9-9883-85b42588c2db'::uuid);

-- Human-confirmed evidence applies ONLY to Appointment A and Appointment B from
-- the diagnosis. Exact UUIDs were uniquely verified read-only and explicitly
-- confirmed by the user. Labels are descriptive; UUIDs identify the targets.
-- Do not select targets by timestamp, status, row ordering, or customer data.
-- expected_* are the ORIGINAL erroneous UTC instants, used as drift guards.
-- intended_local_* are the creator-confirmed Jerusalem wall-clock values.
-- No other historical row is authorized for correction or inferred backfill.
CREATE TEMP TABLE phase2a_history_evidence (
  diagnostic_label text PRIMARY KEY CHECK (diagnostic_label IN ('Appointment A','Appointment B')),
  appointment_id uuid NOT NULL UNIQUE,
  expected_status text NOT NULL,
  verified_duration_minutes integer NOT NULL CHECK (verified_duration_minutes > 0),
  expected_start_time timestamptz NOT NULL,
  expected_end_time timestamptz NOT NULL,
  intended_local_start timestamp without time zone NOT NULL,
  intended_local_end timestamp without time zone NOT NULL,
  evidence_reference text NOT NULL CHECK (length(btrim(evidence_reference)) > 0),
  timestamp_semantics_verified boolean NOT NULL CHECK (timestamp_semantics_verified)
) ON COMMIT DROP;

-- Verified bindings, not executed. Expected statuses preserve the lookup state.
-- A must still have noshow for historical verification/correction. Only afterward
-- does the explicitly approved, UUID-targeted normalization set it to no_show.
INSERT INTO pg_temp.phase2a_history_evidence
  (diagnostic_label, appointment_id, expected_status, verified_duration_minutes,
   expected_start_time, expected_end_time, intended_local_start, intended_local_end,
   evidence_reference, timestamp_semantics_verified)
VALUES
  ('Appointment A', 'ffd6632b-eec0-4f6a-b23a-8297596246f8'::uuid, 'noshow', 30,
   TIMESTAMPTZ '2026-09-30 09:00:00+00', TIMESTAMPTZ '2026-09-30 09:30:00+00',
   TIMESTAMP '2026-09-30 09:00:00', TIMESTAMP '2026-09-30 09:30:00',
   'Creator confirmation supplied by user: A, Jerusalem 2026-09-30 09:00, 30 elapsed minutes; scope A/B only', true),
  ('Appointment B', 'd9ef80a1-10bd-45ca-9e78-55a73154004c'::uuid, 'scheduled', 30,
   TIMESTAMPTZ '2026-09-30 09:30:00+00', TIMESTAMPTZ '2026-09-30 10:00:00+00',
   TIMESTAMP '2026-09-30 09:30:00', TIMESTAMP '2026-09-30 10:00:00',
   'Creator confirmation supplied by user: B, Jerusalem 2026-09-30 09:30, 30 elapsed minutes; scope A/B only', true);

DO $gate$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = 'Asia/Jerusalem') THEN
    RAISE EXCEPTION 'Phase 2A blocked: Asia/Jerusalem timezone unavailable';
  END IF;
  IF (SELECT count(*) FROM pg_temp.phase2a_profile_remediation) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM pg_temp.phase2a_profile_remediation r JOIN public.profiles p ON p.id=r.profile_id
       WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p.id)
         AND NOT EXISTS (SELECT 1 FROM public.services s WHERE s.profile_id=p.id)
         AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.profile_id=p.id)
     ) THEN
    RAISE EXCEPTION 'Phase 2A blocked: exact experimental profile binding missing, absent, linked or referenced';
  END IF;
  IF (SELECT count(*) FROM pg_temp.phase2a_history_evidence) <> 2
     OR EXISTS (SELECT 1 FROM pg_temp.phase2a_history_evidence WHERE appointment_id IS NULL) THEN
    RAISE EXCEPTION 'Phase 2A blocked: bind exactly two independently verified appointment UUIDs';
  END IF;
  -- Reconfirm pair relationships without deriving history from current duration.
  IF NOT EXISTS (
    SELECT 1 FROM pg_temp.phase2a_history_evidence ea
    JOIN public.appointments a ON a.id = ea.appointment_id
    JOIN pg_temp.phase2a_history_evidence eb ON eb.diagnostic_label = 'Appointment B'
    JOIN public.appointments b ON b.id = eb.appointment_id
    JOIN public.profiles p ON p.id = a.profile_id
    JOIN public.services s ON s.id = a.service_id AND s.profile_id = p.id
    WHERE ea.diagnostic_label = 'Appointment A'
      AND a.id <> b.id AND b.profile_id = a.profile_id AND b.service_id = a.service_id
      AND a.end_time = b.start_time
      AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
  ) THEN
    RAISE EXCEPTION 'Phase 2A blocked: verified pair profile/service/Auth relationship changed';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND
               ((table_name = 'profiles' AND column_name = 'slot_interval_minutes') OR
                (table_name = 'services' AND column_name = 'is_active') OR
                (table_name = 'appointments' AND column_name = 'duration_minutes_snapshot'))) THEN
    RAISE EXCEPTION 'Phase 2A blocked: proposed columns already exist; reconcile schema drift';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p
             JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public') THEN
    RAISE EXCEPTION 'Phase 2A blocked: public functions differ from audited baseline';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
             WHERE t.tgrelid IN ('public.profiles'::regclass, 'public.services'::regclass,
                                 'public.appointments'::regclass) AND NOT t.tgisinternal) THEN
    RAISE EXCEPTION 'Phase 2A blocked: custom triggers differ from audited baseline';
  END IF;
  IF EXISTS (SELECT 1 FROM public.services WHERE duration_minutes IS NULL OR duration_minutes <= 0) THEN
    RAISE EXCEPTION 'Phase 2A blocked: invalid service durations require explicit remediation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.appointments WHERE status IS NULL OR
             (status NOT IN ('scheduled','completed','cancelled','no_show') AND NOT
              (id='ffd6632b-eec0-4f6a-b23a-8297596246f8'::uuid AND status='noshow'))) THEN
    RAISE EXCEPTION 'Phase 2A blocked: unapproved status outside the explicit A-only normalization';
  END IF;
  IF EXISTS (SELECT 1 FROM public.appointments WHERE start_time IS NULL OR end_time IS NULL
             OR NOT isfinite(start_time) OR NOT isfinite(end_time) OR end_time <= start_time) THEN
    RAISE EXCEPTION 'Phase 2A blocked: invalid appointment intervals';
  END IF;
  IF EXISTS (SELECT 1 FROM public.appointments a LEFT JOIN public.services s ON s.id = a.service_id
             LEFT JOIN public.profiles p ON p.id = a.profile_id
             WHERE s.id IS NULL OR p.id IS NULL OR s.profile_id IS DISTINCT FROM a.profile_id) THEN
    RAISE EXCEPTION 'Phase 2A blocked: missing references or service/profile mismatch';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id
             WHERE u.id IS NULL AND NOT EXISTS
               (SELECT 1 FROM pg_temp.phase2a_profile_remediation r WHERE r.profile_id=p.id)) THEN
    RAISE EXCEPTION 'Phase 2A blocked: profile ownership does not match Auth users';
  END IF;
  IF EXISTS (SELECT 1 FROM public.appointments a JOIN public.appointments b
             ON a.profile_id = b.profile_id AND a.id < b.id
             AND a.start_time < b.end_time AND b.start_time < a.end_time
             WHERE a.status <> 'cancelled' AND b.status <> 'cancelled') THEN
    RAISE EXCEPTION 'Phase 2A blocked: existing blocking overlaps require explicit remediation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.appointments a
             LEFT JOIN pg_temp.phase2a_history_evidence e ON e.appointment_id = a.id
             WHERE e.appointment_id IS NULL OR NOT e.timestamp_semantics_verified
               OR e.expected_status IS DISTINCT FROM a.status
               OR e.expected_start_time IS DISTINCT FROM a.start_time
               OR e.expected_end_time IS DISTINCT FROM a.end_time
               OR e.verified_duration_minutes <> 30
               OR ((e.intended_local_start AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem')
                    IS DISTINCT FROM e.intended_local_start
               OR (((e.intended_local_start AT TIME ZONE 'Asia/Jerusalem')
                    + make_interval(mins => e.verified_duration_minutes)) AT TIME ZONE 'Asia/Jerusalem')
                    IS DISTINCT FROM e.intended_local_end
               OR extract(epoch FROM (a.end_time - a.start_time))
                    <> e.verified_duration_minutes::numeric * 60)
     OR EXISTS (SELECT 1 FROM pg_temp.phase2a_history_evidence e
                LEFT JOIN public.appointments a ON a.id = e.appointment_id WHERE a.id IS NULL) THEN
    RAISE EXCEPTION 'Phase 2A blocked: evidence/target drift, additional history, or invalid corrected interval';
  END IF;
END;
$gate$;

-- Require exactly the seven audited policies. Expressions/grants must also be
-- reviewed with preflight; matching names alone do not prove unchanged security.
DO $policies$
BEGIN
  IF EXISTS (
    WITH expected(tablename, policyname) AS (VALUES
      ('profiles','Allow public insert during registration'),
      ('profiles','Profiles are viewable by everyone'),
      ('profiles','Users can update their own profile'),
      ('services','Services are viewable by everyone'),
      ('services','Users can modify their own services'),
      ('appointments','Anyone can book an appointment'),
      ('appointments','Only business owner can view and manage their appointments')
    ), actual AS (
      SELECT tablename::text, policyname::text FROM pg_catalog.pg_policies
      WHERE schemaname = 'public' AND tablename IN ('profiles','services','appointments')
    )
    SELECT 1 FROM expected e FULL JOIN actual a USING (tablename, policyname)
    WHERE e.tablename IS NULL OR a.tablename IS NULL
  ) THEN
    RAISE EXCEPTION 'Phase 2A blocked: RLS policy inventory differs from audited baseline';
  END IF;
END;
$policies$;

-- Install the UUID GiST operator class if required. Do not relocate an existing
-- extension. Its current installation schema is checked during preflight.
DO $extension$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'btree_gist') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'extensions') THEN
      RAISE EXCEPTION 'Phase 2A blocked: extensions schema missing; explicit setup required';
    END IF;
    EXECUTE 'CREATE EXTENSION btree_gist WITH SCHEMA extensions';
  END IF;
END;
$extension$;

-- NULL/JSON null/{} and missing/null days represent closed schedules.
-- Malformed present data is rejected, never silently repaired.
CREATE FUNCTION public.phase2a_weekly_hours_valid(hours jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog
AS $function$
DECLARE
  day_key text;
  day_value jsonb;
  opens text;
  closes text;
BEGIN
  IF hours IS NULL OR hours = 'null'::jsonb THEN RETURN true; END IF;
  IF jsonb_typeof(hours) <> 'object' THEN RETURN false; END IF;
  FOR day_key, day_value IN SELECT key, value FROM jsonb_each(hours) LOOP
    IF day_key !~ '^[0-6]$' THEN RETURN false; END IF;
    IF day_value = 'null'::jsonb THEN CONTINUE; END IF;
    IF jsonb_typeof(day_value) <> 'object' THEN RETURN false; END IF;
    IF jsonb_typeof(day_value->'is_open') IS DISTINCT FROM 'boolean' THEN RETURN false; END IF;
    opens := day_value->>'start';
    closes := day_value->>'end';
    IF day_value ? 'start' THEN
      IF jsonb_typeof(day_value->'start') IS DISTINCT FROM 'string'
         OR opens !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RETURN false; END IF;
    END IF;
    IF day_value ? 'end' THEN
      IF jsonb_typeof(day_value->'end') IS DISTINCT FROM 'string'
         OR closes !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RETURN false; END IF;
    END IF;
    IF day_value->'is_open' = 'true'::jsonb THEN
      IF opens IS NULL OR closes IS NULL OR opens >= closes THEN RETURN false; END IF;
    END IF;
  END LOOP;
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.phase2a_weekly_hours_valid(jsonb) FROM PUBLIC, anon, authenticated;
-- Authenticated profile writes need to evaluate the pure CHECK helper.
GRANT EXECUTE ON FUNCTION public.phase2a_weekly_hours_valid(jsonb) TO authenticated;

DO $hours$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE NOT public.phase2a_weekly_hours_valid(weekly_hours)) THEN
    RAISE EXCEPTION 'Phase 2A blocked: malformed weekly_hours require explicit remediation';
  END IF;
END;
$hours$;

-- Exact target only; repeat all guards immediately in the deletion predicate.
-- Existing public-table locks prevent concurrent services/appointments appearing.
DO $experimental_profile$
DECLARE deleted_count integer;
BEGIN
  DELETE FROM public.profiles p USING pg_temp.phase2a_profile_remediation r
  WHERE p.id=r.profile_id
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p.id)
    AND NOT EXISTS (SELECT 1 FROM public.services s WHERE s.profile_id=p.id)
    AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.profile_id=p.id);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count <> 1 THEN
    RAISE EXCEPTION 'Phase 2A blocked: expected exactly one guarded experimental profile deletion';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE NOT EXISTS
             (SELECT 1 FROM auth.users u WHERE u.id=p.id)) THEN
    RAISE EXCEPTION 'Phase 2A blocked: another unlinked profile remains; no broader deletion authorized';
  END IF;
END;
$experimental_profile$;

ALTER TABLE public.profiles
  ADD COLUMN slot_interval_minutes integer NOT NULL DEFAULT 30,
  ADD CONSTRAINT profiles_slot_interval_minutes_check CHECK (slot_interval_minutes IN (10,15,20,30)),
  ADD CONSTRAINT profiles_weekly_hours_check CHECK (public.phase2a_weekly_hours_valid(weekly_hours)),
  ADD CONSTRAINT profiles_auth_user_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;
-- This changes only the default for NEW rows, not any existing weekly_hours.
ALTER TABLE public.profiles ALTER COLUMN weekly_hours SET DEFAULT '{}'::jsonb;

ALTER TABLE public.services
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT services_duration_minutes_positive CHECK (duration_minutes > 0),
  ADD CONSTRAINT services_profile_id_id_key UNIQUE (profile_id, id);

-- Replace cascades with restrictive references. No appointment history is deleted.
ALTER TABLE public.services DROP CONSTRAINT services_profile_id_fkey;
ALTER TABLE public.services ADD CONSTRAINT services_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE public.appointments DROP CONSTRAINT appointments_profile_id_fkey;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_profile_service_fkey
  FOREIGN KEY (profile_id, service_id) REFERENCES public.services(profile_id, id)
  ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE public.appointments DROP CONSTRAINT appointments_service_id_fkey;

ALTER TABLE public.appointments ADD COLUMN duration_minutes_snapshot integer;
-- Explicit one-time correction of ONLY the UUID-bound A/B rows. Convert confirmed
-- local start using named timezone rules; derive end by verified elapsed minutes.
-- No fixed UTC offset, broad timestamp rewrite, service-derived historical value,
-- profile change or status normalization. This is not a general DST resolver;
-- isolated testing must validate the two fixed, unambiguous 2026-09-30 labels.
DO $historical_correction$
DECLARE
  corrected_count integer;
BEGIN
  UPDATE public.appointments a
  SET duration_minutes_snapshot = e.verified_duration_minutes,
      start_time = e.intended_local_start AT TIME ZONE 'Asia/Jerusalem',
      end_time = (e.intended_local_start AT TIME ZONE 'Asia/Jerusalem')
                 + make_interval(mins => e.verified_duration_minutes)
  FROM pg_temp.phase2a_history_evidence e
  WHERE e.appointment_id = a.id
    AND a.start_time = e.expected_start_time AND a.end_time = e.expected_end_time
    AND a.status = e.expected_status
    AND extract(epoch FROM (a.end_time - a.start_time)) = 1800
    AND EXISTS (SELECT 1 FROM public.services s JOIN public.profiles p ON p.id = s.profile_id
                WHERE s.id = a.service_id AND p.id = a.profile_id);
  GET DIAGNOSTICS corrected_count = ROW_COUNT;
  IF corrected_count <> 2 THEN
    RAISE EXCEPTION 'Phase 2A blocked: expected exactly two controlled historical corrections';
  END IF;
END;
$historical_correction$;

-- Historical checks above consumed A's original noshow identity. Do not change
-- expected_status to no_show or normalize before those checks/corrections.
DO $approved_status_normalization$
DECLARE normalized_count integer;
BEGIN
  UPDATE public.appointments a SET status='no_show'
  FROM pg_temp.phase2a_history_evidence e
  WHERE a.id='ffd6632b-eec0-4f6a-b23a-8297596246f8'::uuid
    AND e.appointment_id=a.id AND e.diagnostic_label='Appointment A'
    AND e.expected_status='noshow' AND a.status='noshow'
    AND a.start_time=(e.intended_local_start AT TIME ZONE 'Asia/Jerusalem')
    AND a.end_time=(e.intended_local_start AT TIME ZONE 'Asia/Jerusalem')
                    + make_interval(mins => e.verified_duration_minutes)
    AND a.duration_minutes_snapshot=30;
  GET DIAGNOSTICS normalized_count = ROW_COUNT;
  IF normalized_count <> 1 THEN
    RAISE EXCEPTION 'Phase 2A blocked: A no longer matches the approved noshow normalization';
  END IF;
  IF EXISTS (SELECT 1 FROM public.appointments WHERE status IS NULL OR
             status NOT IN ('scheduled','completed','cancelled','no_show')) THEN
    RAISE EXCEPTION 'Phase 2A blocked: invalid status remains after A-only normalization';
  END IF;
END;
$approved_status_normalization$;

ALTER TABLE public.appointments
  ALTER COLUMN duration_minutes_snapshot SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'scheduled',
  ADD CONSTRAINT appointments_status_check CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  ADD CONSTRAINT appointments_finite_times_check CHECK (isfinite(start_time) AND isfinite(end_time)),
  ADD CONSTRAINT appointments_positive_interval_check CHECK (end_time > start_time),
  ADD CONSTRAINT appointments_duration_snapshot_positive CHECK (duration_minutes_snapshot > 0),
  ADD CONSTRAINT appointments_duration_integrity_check CHECK (
    extract(epoch FROM (end_time - start_time)) = duration_minutes_snapshot::numeric * 60),
  ADD CONSTRAINT appointments_no_overlap EXCLUDE USING gist (
    profile_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status <> 'cancelled');

-- Only after the stronger exclusion constraint exists. Its GiST index is created
-- by PostgreSQL; do not create a duplicate range index.
ALTER TABLE public.appointments DROP CONSTRAINT unique_appointment_slot;

-- Performance indexes for owner history and composite FK/service operations.
CREATE INDEX appointments_profile_start_idx ON public.appointments (profile_id, start_time);
CREATE INDEX appointments_profile_service_idx ON public.appointments (profile_id, service_id);

-- Explicit maintenance barrier, not a booking validator. It prevents accidental
-- writes through privileged old integrations too (unless deliberately bypassed
-- by an administrator). Phase 2B must replace this trigger atomically with real
-- authoritative creation/rescheduling/status validation before reopening writes.
CREATE FUNCTION public.phase2a_block_appointment_writes()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000',
    MESSAGE = 'Appointment writes are closed pending controlled booking cutover';
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.phase2a_block_appointment_writes() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER phase2a_appointment_write_barrier
BEFORE INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.phase2a_block_appointment_writes();

-- Remove table AND separately held column privileges before granting the narrow
-- foundation access. Retaining column grants would bypass a table-level REVOKE.
REVOKE ALL PRIVILEGES ON TABLE public.profiles, public.services, public.appointments
FROM PUBLIC, anon, authenticated;
DO $column_grants$
DECLARE
  table_name text;
  columns_sql text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['profiles','services','appointments'] LOOP
    SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum) INTO columns_sql
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = format('public.%I', table_name)::regclass
      AND a.attnum > 0 AND NOT a.attisdropped;
    EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      columns_sql, columns_sql, columns_sql, columns_sql, table_name);
  END LOOP;
END;
$column_grants$;

DROP POLICY "Anyone can book an appointment" ON public.appointments;
DROP POLICY "Only business owner can view and manage their appointments" ON public.appointments;
DROP POLICY "Allow public insert during registration" ON public.profiles;
DROP POLICY "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY "Users can update their own profile" ON public.profiles;
DROP POLICY "Services are viewable by everyone" ON public.services;
DROP POLICY "Users can modify their own services" ON public.services;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY phase2a_profiles_owner_select ON public.profiles
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
CREATE POLICY phase2a_profiles_owner_insert ON public.profiles
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY phase2a_profiles_owner_update ON public.profiles
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY phase2a_services_owner_select ON public.services
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = profile_id);
CREATE POLICY phase2a_services_owner_insert ON public.services
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = profile_id);
CREATE POLICY phase2a_services_owner_update ON public.services
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = profile_id)
  WITH CHECK ((SELECT auth.uid()) = profile_id);
CREATE POLICY phase2a_appointments_owner_select ON public.appointments
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = profile_id);

GRANT SELECT ON public.profiles, public.services, public.appointments TO authenticated;
GRANT INSERT (id, business_name, slug, weekly_hours, address, instagram, gallery_urls,
              slot_interval_minutes) ON public.profiles TO authenticated;
GRANT UPDATE (business_name, slug, weekly_hours, address, instagram, gallery_urls,
              slot_interval_minutes) ON public.profiles TO authenticated;
GRANT INSERT (profile_id, name, duration_minutes, price, is_active) ON public.services TO authenticated;
GRANT UPDATE (name, duration_minutes, price, is_active) ON public.services TO authenticated;
-- No DELETE, TRUNCATE, appointment mutation, anonymous table access, or public
-- catalog/booking RPC grants. is_active is the entire Phase 2 archival mechanism.

-- Catch inherited privileges/custom role memberships that would undermine the
-- stated access boundary. Unexpected access aborts rather than changing roles.
DO $privileges$
DECLARE
  t text;
  r text;
  privilege_name text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','services','appointments'] LOOP
    IF has_table_privilege('anon', format('public.%I', t), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
       OR has_any_column_privilege('anon', format('public.%I', t), 'SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'Phase 2A blocked: anonymous privileges persist via role inheritance';
    END IF;
    IF has_table_privilege('authenticated', format('public.%I', t), 'MAINTAIN') THEN
      RAISE EXCEPTION 'Phase 2A blocked: authenticated MAINTAIN privilege persists';
    END IF;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH privilege_name IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
      IF has_table_privilege(r, 'public.appointments', privilege_name) THEN
        RAISE EXCEPTION 'Phase 2A blocked: unexpected appointment mutation privilege';
      END IF;
    END LOOP;
    IF has_any_column_privilege(r, 'public.appointments', 'INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'Phase 2A blocked: appointment column mutation privileges persist';
    END IF;
  END LOOP;
END;
$privileges$;

COMMIT;
