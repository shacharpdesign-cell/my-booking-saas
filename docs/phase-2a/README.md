# Phase 2A: proposed database foundation

Status: local review artifacts only. Preflight and targeted read-only diagnosis
were completed in earlier authorized turns; the proposed migration has never been
executed. This revision performs no live access, SQL execution, database changes,
application changes or Phase 2B implementation. This directory is outside automatic migration
discovery. Applying the proposal requires separate authorization.

## Baseline and scope

The earlier live metadata audit found public.profiles, public.services and
public.appointments, all with RLS enabled but not forced. Appointment IDs are UUID
primary keys, profile/service references independently cascade on deletion, and
unique_appointment_slot enforces only (profile_id, start_time). Status is nullable
text defaulting to scheduled. There are no CHECK/exclusion constraints or custom
booking functions/triggers. Service duration_minutes is a NOT NULL integer.

The repository still calculates end_time in the browser, creates :00/:30 starts,
defaults missing schedules to open, and appends Z to locally selected times.
Anonymous availability reads appointment starts despite owner-only SELECT RLS.
The owner panel displays UTC. Registration inserts a profile after signup. These
are known integration incompatibilities, not changes made by Phase 2A.

The four artifacts are:

| File | Purpose |
| --- | --- |
| preflight.sql | SELECT-only checks; previously executed with approval, unchanged and not rerun in this revision |
| proposed-migration.sql | Exact proposed transactional foundation SQL; not run |
| README.md | Design, gates, integration contract, cutover and rollback |
| TEST-PLAN.md | Future isolated test specification, not executed tests |

## Approved product rules carried forward

- Israel only; Asia/Jerusalem, real elapsed duration, timestamptz storage.
- Service duration comes from the database at creation and explicit rescheduling;
  old appointments retain their verified booked duration.
- Statuses: scheduled, completed, cancelled, no_show. Only cancelled releases
  capacity. All other statuses block over their actual [start,end) interval.
- New bookings are scheduled. The only owner-authorized status transitions are
  scheduled -> completed, scheduled -> cancelled and scheduled -> no_show.
  No public status mutation or cancelled reactivation is offered in initial Phase 2.
- One appointment at a time per business; back-to-back and ending at closing work.
- Per-business slot_interval_minutes is 10, 15, 20 or 30, independent of duration,
  anchored to that day's opening. Existing profiles get 30; new profiles default
  to 30 and may choose any allowed value. This preserves spacing, not necessarily
  the old :00/:30 alignment when a business opens at an offset minute.
- The opening-anchored grid is authoritative for public creation and owner
  rescheduling, not just a display convention. Arbitrary off-grid starts are denied.
- Progress candidate labels in Jerusalem local wall-clock increments. Resolve each
  label to an instant and reject nonexistent or ambiguous labels. Never offer both
  occurrences of a repeated label. Unresolvable opening/closing boundaries close
  the affected opening window for availability and booking.
- No public past bookings, notice period, advance horizon, overnight support,
  employees, or owner override. No historical-booking override is introduced.
- Missing hours mean closed. Legacy working_days/start_hour/end_hour remain but
  are neither fallbacks nor authoritative inputs.
- Hour changes affect new bookings/rescheduling, never existing intervals.
- Deactivate services instead of deleting referenced history.
- No anonymous appointment SELECT; public availability returns safe slots only.

## Preflight and evidence

Run preflight.sql only after separate approval, using a trusted administrative
connection whose RLS scope permits complete aggregate checks. It deliberately
does not query customer_name, customer_phone, Auth emails or contact metadata.
No appointment/customer rows are displayed. Schema definitions are metadata.
Large overlap checks need a staging timing rehearsal.

Checks cover service durations; NULL/unknown/legacy noshow status counts; finite,
positive and integral-minute intervals; tenant mismatches; blocking overlap pairs;
the absence of the proposed slot column; 30-minute backfill count/alignment;
weekly_hours structure; profile-to-Auth ownership; platform, extension, grants,
policies, indexes, triggers and function drift.

The two timestamp interpretations in the heuristic are deliberately diagnostic:
Jerusalem display versus the old UTC-wall convention, compared with CURRENT
hours. Schedules may have changed. Matching current service duration, matching
current hours, and integral end-start differences are NOT historical evidence.
Stored timestamps alone cannot prove the intended instant or historical service
duration. Do not shift all data by a fixed offset or infer origin from a date.

### Verified human evidence: two appointments only

After the read-only diagnosis, the user relayed explicit confirmation from the
person who created these two test appointments. On 2026-09-30, the selected
Jerusalem-local start was 09:00 for Appointment A and 09:30 for Appointment B;
each was intended to last 30 real elapsed minutes. The old UI stored these local
labels as UTC values. This is human-provided evidence, not an inference from the
current service duration or the schedule diagnostics.

| Label | Expected original stored UTC interval | Verified intended Asia/Jerusalem local interval | Verified elapsed minutes |
| --- | --- | --- | --- |
| Appointment A | 2026-09-30 09:00–09:30 UTC | 2026-09-30 09:00–09:30 | 30 |
| Appointment B | 2026-09-30 09:30–10:00 UTC | 2026-09-30 09:30–10:00 | 30 |

The evidence applies to THESE TWO records only, not other records, all test data,
the whole business or future bookings. Existing database observations corroborate
30-minute elapsed intervals but do not independently prove historical intent.

The proposal now seeds a transaction-local evidence table with these two explicit
cases, intended local boundaries, original UTC drift guards, 30-minute duration
and a non-personal reference to the creator confirmation. Exact UUID bindings were
subsequently established by an authorized read-only lookup with exactly one complete
non-PII identity match per record, then explicitly confirmed by the user for this
local artifact. The SQL now contains A = ffd6632b-eec0-4f6a-b23a-8297596246f8 and
B = d9ef80a1-10bd-45ca-9e78-55a73154004c as NOT NULL UNIQUE UUIDs. No live access
occurred during this binding revision. Neither customer data nor timestamp/status
selection is used to target the UPDATE.

The gate rejects unbound/duplicate/missing targets, changed original timestamps/status,
missing or additional appointments, mismatched elapsed duration and invalid local
round trips. It rechecks that A/B are distinct, back-to-back, share one existing
Auth-backed profile and one service belonging to that profile. This checks relationship
validity; original profile/service UUIDs were not retained as separate immutable
evidence. UUID joins and original-value predicates narrowly target the correction;
an exact two-row affected-count assertion guards the UPDATE. Even an empty database
fails this case-specific proposal until an independently reviewed empty-data variant
is prepared. An additional appointment requires separate evidence and a new review,
not automatic inclusion or copying this correction rule.

For each bound row, resolve intended_local_start AT TIME ZONE 'Asia/Jerusalem' to
a timestamptz, then add the verified 30 elapsed minutes for end_time. Assert that
the result displays as the confirmed local end. No fixed offset is subtracted and
the server session timezone does not define the intended instant. The fixed labels
must be verified unambiguous in isolated tests; this case-specific correction is
not a general DST candidate resolver. The same 30-minute human evidence populates
duration_minutes_snapshot, independent of the current service value.

### Explicitly approved remediation, not executed

The human owner confirmed the previously diagnosed unlinked profile is experimental
data and may be removed, and confirmed A's noshow means no_show. These approvals
apply to that one profile and Appointment A only. They authorize this local draft,
not live execution. No broader deletion or status normalization is included.

The profile UUID is now verified and explicitly bound in the transaction-local
remediation table: a26afa50-4082-4bb9-9883-85b42588c2db. The authorized read-only
lookup found exactly one match: created_at 2026-09-26 21:37:19.200535 UTC, configured
weekly_hours, no Auth match, zero services and zero appointments. The user confirmed
this binding and authorized this local update only. No NULL binding remains.
The DELETE targets that UUID, never a profile discovered merely by lacking Auth.
The initial gate requires that target to exist, have no Auth user, zero services and
zero appointments. The DELETE repeats every predicate and requires exactly one
affected row. Any other unlinked profile blocks migration rather than being deleted.

The sequence within the single locked transaction is:

1. Verify profile target safety and both appointments' original identities, including
   A.status = noshow and B.status = scheduled. The initial status vocabulary gate
   makes an exception ONLY for A's exact UUID with noshow, pending normalization.
2. Verify remaining baseline policies/schedules, then delete the one guarded profile
   before installing the Auth ownership FK. No service or appointment is deleted.
3. Apply both timezone corrections and human-confirmed 30-minute snapshots while
   requiring their original statuses; assert exactly two corrected appointments.
4. Normalize ONLY A's exact UUID from noshow to no_show. Require noshow immediately
   in the UPDATE predicate plus the corrected timestamps/snapshot; assert one row.
5. Recheck the final vocabulary and install status, interval and overlap constraints,
   followed by the write barrier, RLS/grants and final privilege assertions.

Expected historical status remains noshow; do not change it to no_show. An already
normalized A fails original-identity verification rather than being silently accepted.
B remains scheduled. A later failure rolls back the profile deletion, both historical
corrections, A's status normalization and all schema/security changes together.

## Foundation changes and the weaknesses they address

| Proposed change | Current weakness and resulting behavior |
| --- | --- |
| services.duration_minutes > 0 | NOT NULL alone allows unusable nonpositive lengths; no invented maximum |
| appointments.duration_minutes_snapshot | Current interval was browser-written and no historical source is recorded; new NOT NULL positive snapshot is populated only from reviewed evidence |
| Finite timestamps, end > start, elapsed seconds = snapshot * 60 | Prevents invalid intervals and inconsistent stored duration; uses elapsed time, not local wall-clock arithmetic |
| Composite service FK plus services UNIQUE(profile_id,id) | Separate FKs allow a business to book another business's service |
| NOT NULL status with approved vocabulary | Removes arbitrary text/NULL ambiguity; retains scheduled default |
| GiST exclusion on business and tstzrange(...,'[)'), WHERE status <> cancelled | Exact-start uniqueness misses partial overlap and races; exclusion authoritatively protects capacity on inserts/updates |
| Remove unique_appointment_slot after exclusion exists | Allows cancelled history and a new blocking booking at the same start |
| slot_interval_minutes default 30, NOT NULL, allowed-value CHECK | Makes interval business-specific; existing rows receive approved compatibility value |
| services.is_active default true, NOT NULL | Minimal deactivation capability; no general archival framework |
| Restrictive profile/service/appointment/Auth FKs, no owner DELETE grants | Prevents cascaded history loss, service/profile ownership reassignment and orphan ownership assumptions |
| Validated weekly_hours and new default {} | Rejects malformed configured schedules; new profiles start closed; existing schedules are not rewritten |
| Owner-only base-table RLS, least grants | Removes public INSERT true and broad owner ALL write paths; public catalog must use future safe interface |
| Temporary appointment write barrier | Prevents the old browser flow or old privileged integrations from bypassing missing Phase 2B checks |
| Owner/time and composite-reference B-tree indexes | Supports owner history and service-reference operations, separately from partial GiST overlap index |

The snapshot equality CHECK does not prove that a caller used the current service
duration. The complete authority guarantee requires Phase 2B database logic; Phase
2A therefore permits NO appointment mutation via the application, and installs a
trigger barrier for ordinary privileged DML as well. This is intentionally a
maintenance foundation, not a partially safe production booking release. It does
not promise protection against a superuser deliberately disabling triggers or
performing administrative TRUNCATE. Production administrative credentials must
never be supplied to public clients.

All existing appointments, including cancelled history, must satisfy the snapshot
and interval rules. Cancelled rows are excluded only from overlap checks. Existing
bookings are not checked against today's hours, slot grid, service active state,
or today's time; doing so would wrongly invalidate legitimate history.

## weekly_hours validation contract

Use the existing JSONB column as the sole schedule source. Keys are strings 0..6,
with Sunday = 0. SQL NULL, JSON null, {}, missing days and null days represent
closed time. A present day object needs boolean is_open. Open days need both
HH:MM boundaries with opening < closing. Closed days may omit boundaries; supplied
boundaries must have valid minute-accurate 00:00..23:59 syntax. Unknown fields
inside a day are ignored, but unknown day keys or malformed shapes fail validation.

Missing boundaries never produce availability: malformed attempted configuration
is rejected at write time, and future availability must fail closed if it encounters
incomplete data. No automatic repair or legacy fallback. The current one-window
per-day structure remains; split shifts, holidays and exceptions are not added.

Opening/slot changes do not cause appointment updates. Changing this immutable
validation helper in the future requires deliberate revalidation of its CHECK;
do not replace its semantics without rechecking stored profiles.

## RLS/grants and foundation function boundary

The proposal drops exactly the seven audited policies, after checking inventory.
New policies are explicitly TO authenticated, matching auth.uid() to profile ID.
Profiles/services have owner SELECT, INSERT, UPDATE with appropriate USING and
WITH CHECK. Ownership identifiers are not update-granted. Appointments have owner
SELECT only. Public INSERT true is removed. Public catalog SELECT is removed from
base tables, including for owners looking at another business; that catalog will
be available solely through the safe Phase 2B operation.

Table and column privileges are both revoked for PUBLIC/anon/authenticated before
narrow grants are added. The proposal checks for unexpected inherited appointment
write/anonymous access. Do not assume policy names imply unchanged expressions:
preflight review of grants, policy definitions, role membership, table ownership,
and any other integration roles is mandatory. Keep existing RLS enabled; forcing
RLS is not used as a replacement for correctly scoped grants and function owners.

Profile onboarding requires an authenticated UID matching the inserted ID and an
existing Auth user. The future app must handle signup without an immediate session
(email confirmation). Anonymous profile insertion is no longer permitted.

Only two functions are added in Phase 2A: a pure IMMUTABLE JSON validator and a
write-blocking trigger function. Both have fixed search_path; neither is SECURITY
DEFINER. Only authenticated receives EXECUTE on the pure validator to support its
profile CHECK. The trigger function has no public execution grant.

Service deactivation changes only is_active. It never cancels or edits appointments.
Existing services default active for compatibility. Referenced deletion is RESTRICT;
there is no application DELETE grant even for unreferenced services. Profile/Auth
account deletion with references is likewise deliberately blocked. A full account
erasure/retention workflow is outside Phase 2 and must not be inferred from this.

## Phase 2B contract (design only; not implemented here)

Before replacing the write barrier, a separately reviewed database/API integration
must provide these operations:

| Operation | Required contract |
| --- | --- |
| Public catalog | Explicit safe business/service fields; active services only; no raw tables or future accidental column exposure |
| Availability | Business, service and Jerusalem local date in; safe start/end instants and timezone display data out; no appointments/IDs/customer details out |
| Public create | Business slug, service ID, selected instant and required customer inputs; derive business, current service duration, end_time and scheduled status in database |
| Owner reschedule | Authenticate and check ownership; same capacity, active-service, duration, hours, future-time and slot validations as creation |
| Owner status operation | Authenticate ownership; allow only scheduled -> completed/cancelled/no_show; preserve interval/snapshot; no public status mutation or reactivation |

Use atomic database transactions, a deterministic profile-then-service locking
order and the exclusion constraint as final authority. Lock profile/service rows
before reading mutable hours, slot settings, duration and activation. Direct owner
row updates then wait on those same locks; any future operation touching both must
honor lock order. Recheck database time after waiting, immediately before insertion.
Map exclusion SQLSTATE 23P01 to a safe conflict response; do not expose raw error
DETAIL that could reveal an existing record. Never rely on check-then-insert alone.

New creation/rescheduling derives snapshot and end_time from current service data;
browser values are not accepted as authoritative. Scheduling-field writes must be
guarded at the database level, not solely at the API. Keep direct appointment DML
revoked; introduce tightly scoped function owners, explicit execution grants,
fixed search paths and no uncontrolled SECURITY DEFINER helper exposure. Routines
must explicitly authorize owners even if running with elevated privileges. No
service-role credential goes to the browser. Public callers never get SELECT on
appointments, including via views, raw RPC returns or error messages.

Generate candidate local labels from that Jerusalem-local day's opening using
wall-clock increments of slot_interval_minutes. For opening 09:10 and interval 15,
the labels are 09:10, 09:25, 09:40, 09:55, and so on. Resolve each label through
Asia/Jerusalem timezone rules and accept it only when exactly one instant maps to
that label. Reject both nonexistent and ambiguous labels; do not silently normalize
them or select an offset. Never hardcode UTC+2/UTC+3. A simple conversion round trip
alone is insufficient to detect repeated labels: uniqueness must be established.

Resolve the day's opening and closing boundaries with the same uniqueness rule.
If either boundary is nonexistent or ambiguous, fail closed for that opening window
in both availability and booking, including owner rescheduling. This is date-specific
validation in Phase 2B, not a permanent rejection of a weekly schedule in Phase 2A.

Public creation and owner rescheduling must enforce membership in this exact grid
inside the database/backend operation. Convert the requested instant to its local
label, check opening-anchored alignment, require unique resolution, and compare the
resolved instant to the submitted instant. Reject seconds/fractions not present in
the grid and explicit-offset requests for either occurrence of an ambiguous label.
For the example above, an otherwise-free 09:17 is invalid. The browser cannot bypass
the rule by skipping availability or submitting a different timestamp.

After resolving a start, derive end_time using the service's real elapsed minutes.
Test the FULL [start,end) against the resolved opening/closing and all blocking
intervals, including those starting before a query boundary. start >= opening and
end <= closing; back-to-back and ending exactly at closing remain valid. Derive local
date query boundaries using timezone rules rather than assuming 24-hour days.
Availability is advisory and creation/rescheduling must revalidate against current
settings after a stale response. No arbitrary advance horizon or notice buffer;
paginated/per-date requests can bound workloads.

New service durations use elapsed minutes. Completed/no_show block only their
stored intervals, not an entire day. Cancelling a past appointment needs no
future-time check; an unrelated historical status edit must not be rejected merely
because its time is past. No historical creation/rescheduling override is allowed.

Enforce status transitions atomically against the current stored status and verified
owner identity: scheduled -> completed, scheduled -> cancelled, or scheduled ->
no_show only. No transitions out of completed, cancelled or no_show are authorized.
Knowing an appointment ID or phone number does not authorize any mutation. Public
status mutation is not exposed. A cancelled row remains cancelled and retains its
history; replacement must use the normal authoritative booking/rescheduling flow,
never reactivation or a status-reset shortcut. Reactivation is only a possible
future feature requiring an explicit future product decision, outside initial
Phase 2 implementation and acceptance requirements.

Phase 2B also includes Next.js endpoints, public booking UI replacement, Jerusalem
date/display conversion, owner service/settings integration, session-aware signup,
safe error handling and removal of personal-data notification logging. It must
atomically replace the write barrier with full validation, never just drop it.

## Remaining migration blockers

Migration blockers and deployment prerequisites:

1. Historical UUID binding is resolved: the exact user-confirmed A/B UUIDs are now
   bound. Human evidence establishes intended times and 30-minute durations. The
   migration still rechecks original identity and relationship conditions at execution.
2. A-only noshow -> no_show normalization is now explicitly approved and included
   after original-identity verification/correction. No status decision remains.
3. Experimental profile binding is resolved: the exact verified UUID is recorded,
   with the approved single-profile deletion and all existence/dependency guards.
   No ownership reassignment is proposed. No known product/data decisions remain.
4. Earlier preflight found no invalid durations/intervals, blocking overlaps,
   service/profile mismatches or malformed schedules. Diagnosis established complete
   read visibility (BYPASSRLS), broad direct anon/authenticated ACLs, and available
   btree_gist 1.7 with an existing extensions schema. It remains uninstalled.
   postgres has metadata-supported install prerequisites; confirm the actual
   deployment role and recheck drift only under separate authorization.
5. Application incompatibility is deliberate: public catalog/direct booking stop.
   A maintenance window and tested Phase 2B release are required before reopening.
6. SQL remains unexecuted/unvalidated against PostgreSQL. Rehearse exact SQL,
   evidence staging, locks/timeouts, privileges, constraints and rollback in an
   isolated disposable database before deployment.

No PRODUCT DECISION REQUIRED items remain for the initial Phase 2 contract. Grid
enforcement, DST label/boundary rejection, wall-clock progression and status
transitions are resolved above. Reactivation is excluded, not a pending initial
release requirement. Evidence-dependent remediation decisions may still arise if
preflight finds incompatible or unverifiable history; these remain deployment
blockers rather than unresolved booking product rules.

preflight.sql is unchanged. The proposed migration now contains the two-case
historical correction and PostgreSQL 17 MAINTAIN assertions. REVOKE ALL PRIVILEGES
is unchanged; final checks reject residual MAINTAIN for both anon and authenticated
on all three tables, including inherited privileges. The preflight diagnoses
existing history without applying current rules retroactively.
The foundation already stores the approved statuses/slot settings and blocks ALL
appointment writes. Date-specific DST resolution, grid membership and authorized
status-transition enforcement belong to the future controlled Phase 2B routines.
Neither the status CHECK nor the exclusion constraint alone enforces transitions.

No additional approval is needed for the already approved 30-minute compatibility
setting, positive durations, capacity one, cancellation capacity release, or closed
missing hours. No max duration, notice period, horizon or owner override is added.

## Cutover and rollback

1. Use the completed read-only findings, authorize any necessary recheck/remediation, and
   rehearse using synthetic data. Secure a tested recovery point and baseline DDL,
   policies/grants. Keep production evidence outside source control.
2. Review the verified experimental profile UUID and the incorporated explicit
   remediations/evidence; do not run fixes as part of preflight. Pause all writers.
3. Reconfirm metadata and privileges, apply the reviewed transaction only during
   an authorized maintenance window. Locks close the check/install race. Failure
   must roll back the entire transaction; do not continue a failed transaction.
4. The exclusion constraint is immediately validated and is not a concurrent or
   NOT VALID rollout. Correct two UUID-bound intervals/snapshots, then normalize only
   A's status; delete only the UUID-bound unreferenced experimental profile. Verify
   affected counts 2, 1 and 1 respectively. No appointment DELETE occurs.
5. Keep booking closed while Phase 2B is not ready. Deploy its code and authoritative
   database routines through a separately reviewed cutover; verify roles/privacy
   before reopening. Old clients must fail safely.

On an error before COMMIT, ROLLBACK the whole transaction. After successful commit,
prefer keeping writes closed and forward-fixing over reverting protections. Do not
restore public INSERT true or UTC-wall-clock clients. Once cancellation releases
capacity, old exact-start uniqueness may be impossible to reinstall. Do not drop
duration snapshots or new bookings to force a downgrade. Preserve legacy schedule
columns, evidence and a schema-aware recovery plan. Do not automatically uninstall
btree_gist, which may be shared by other objects. A broader history/account deletion
workflow or destructive down migration is outside this proposal.

Technical references: PostgreSQL [range constraints](https://www.postgresql.org/docs/current/rangetypes.html),
[function security](https://www.postgresql.org/docs/current/sql-createfunction.html),
[DST interpretation](https://www.postgresql.org/docs/current/datetime-invalid-input.html),
and Supabase [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
