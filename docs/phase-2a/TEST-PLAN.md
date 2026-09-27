# Phase 2A verification specification

Not executed. This is a test plan, not a claim of SQL validation. Do not run it
against live Supabase. Use a disposable PostgreSQL/Supabase environment, synthetic
Auth identities and fabricated appointments. Never copy customer names/phones into
fixtures, logs, evidence files or repository history. No package/config changes are
needed for this delivery; test tooling integration belongs to a later approved task.

## Foundation migration tests

Reproduce the audited schema/policies first. Each failure scenario gets its own
fresh database/transaction so an earlier gate does not hide a later one. Check that
every failed migration leaves no new columns, functions, indexes, grants or policies.
Require ON_ERROR_STOP in any future runner and verify actual rollback, not merely
an error message. No part of this file authorizes running the migration.

| Scenario | Expected result |
| --- | --- |
| Empty appointments or NULL UUID bindings | Case-specific proposal fails; no guessed targeting or generic empty-data success |
| Any appointment without one of the two verified bindings | Fails with evidence gate; no inferred backfill or timestamp correction |
| Two synthetic A/B fixtures plus the bound safe experimental profile | Exactly two interval/snapshot corrections, one A-only status normalization, one guarded profile deletion; all other preexisting appointment fields unchanged |
| Missing/extra/duplicate evidence, wrong instants, false verification, mismatched duration | Fails safely; no silent correction |
| Fractional-minute historical interval | Cannot match integer-minute evidence; explicit remediation needed |
| Service duration zero or negative | Gate/positive-duration CHECK rejects |
| NULL/arbitrary status or noshow on any UUID other than A | Gate rejects; no bulk status conversion |
| end <= start, nonfinite timestamps | Gate/interval CHECK rejects |
| Service from another profile or missing references | Gate/composite FK rejects |
| Unlinked profile other than exact approved deletion target | Gate rejects; does not delete it |
| Existing overlapping noncancelled intervals | Gate/exclusion installation rejects |
| Back-to-back intervals for same business | Foundation accepts with valid evidence |
| Overlap across different businesses | Foundation accepts |
| Cancelled row overlapping scheduled row, including identical starts | Exclusion accepts after old unique constraint removed; stage this case on the new foundation because the old baseline rejects identical starts |
| Any newly introduced column/function/custom trigger/policy inventory drift | Fails/requires reconciliation; no IF NOT EXISTS masking incompatible objects |
| Extension unavailable, permission denied, lock timeout or statement timeout | Whole transaction rolls back |
| Existing btree_gist in supported schema | Uses existing extension, does not relocate/uninstall it |
| Unexpected inherited anonymous or appointment-write grants | Privilege gate fails; unrelated role memberships are not silently rewritten |

Measure exclusion build/backfill/lock duration with realistic synthetic volumes.
Verify the migration cannot race a writer between evidence checks and constraints.
Use separate isolated foundation fixtures for general constraint/performance cases;
do not broaden the production A/B evidence list to make those fixtures pass.

## Controlled A/B historical correction tests

The user supplied explicit creator confirmation and verified exact UUID bindings
for A/B and the experimental profile. The review SQL contains all three verified
UUIDs; substitute synthetic UUIDs consistently at every occurrence in a
separate isolated test copy, never in the approved binding artifact. No customer
information belongs in fixtures. Current evidence expects noshow/scheduled. Keep
these original values for positive tests; verify historical correction precedes
A-only normalization. Bind a synthetic unlinked, unreferenced experimental profile
in the isolated copy. The live profile binding is verified and no placeholder
remains. Changing A to no_show before execution must fail identity verification.
An intentionally NULL-bound negative test copy must fail. Leave live data untouched.

- Seed A at 2026-09-30 09:00–09:30 UTC and B at 09:30–10:00 UTC. Confirm the proposal
  produces A at 2026-09-30 09:00–09:30 Asia/Jerusalem and B at 09:30–10:00 there.
- Compute expected instants with named Asia/Jerusalem timezone rules for that date,
  never by subtracting a constant offset. Independently confirm these fixed local
  labels are unambiguous. Repeat under UTC and another session timezone: resulting
  instants must be identical. This is not a general DST resolver test.
- Verify end = resolved start + 30 real elapsed minutes; both snapshot values equal
  the human-evidenced 30. Change CURRENT service duration in a fixture and confirm
  it is not used to infer/overwrite these historical snapshots.
- Verify A.end = B.start; no half-open overlap. A finishes no_show, B stays scheduled.
  Profile/service association,
  created_at and all unrelated fields remain unchanged (use synthetic data only).
- Swap bindings, omit a binding, duplicate an ID, bind an unrelated row, alter an
  original timestamp, or start with already-corrected timestamps: fail safely.
  No timestamp/status/order lookup may auto-bind a NULL UUID.
- Change B's status to another approved value, change the stored elapsed interval,
  break service/profile validity, split A/B across profiles/services, remove Auth
  backing or break adjacency: fail before correction. Neither historical snapshot
  nor end_time may be derived from current service duration.
- Add a third appointment even if it has the same legacy pattern: the whole proposal
  must fail, leaving it and A/B unchanged. No evidence is generalized beyond A/B.
- Give any other appointment noshow: reject rather than normalize it. Give A any
  status other than noshow, including already-normalized no_show: fail closed.
- Inject a failure after correction (for example a later privilege assertion): the
  original A/B instants and all other changes must roll back. Successful completion
  asserts exactly two corrected rows; the migration is not idempotent.

## Guarded experimental profile and status remediation

- Unknown/NULL/missing target UUID fails before application-data changes. Exact
  approved target with no Auth match, services or appointments deletes once only.
- Auth linkage, one service or one appointment on the target blocks deletion. Test
  each independently; no existing cascade may remove a dependent row.
- A second unlinked profile is never swept up: migration fails and preserves both.
  Verify the deletion SQL joins the bound UUID, not an orphan-discovery query.
- A normalization requires its exact ID, current noshow, corrected interval and
  30-minute snapshot. It affects exactly one row and leaves B unchanged. A zero-row
  normalization or unexpected final status aborts the whole transaction.
- Inject a failure after deletion, after correction, after normalization and during
  final constraints/privilege assertions. Rollback must restore the deleted profile,
  original A/B instants, A's noshow and all preexisting schema/grants.
- Confirm row-count assertions: profile deletion = 1, corrected appointments = 2,
  normalized appointments = 1. Expected historical status must remain noshow until
  original identity has been checked and timezone correction has completed.
- Ready for isolated synthetic testing: all three evidence bindings are populated.
  The fixture must reproduce the reviewed baseline and identities (or consistently
  substitute synthetic IDs in an isolated test copy). No live lookup, SQL
  execution or testing is authorized by this document update.

## Schedule and setting tests

- NULL, JSON null, {}, missing days and null days are valid closed representations.
- Reject array/scalar schedules, keys outside 0..6, malformed present day objects,
  nonboolean is_open, malformed time strings and open days missing a boundary.
- Reject equal/reversed hours, overnight windows, 24:00, invalid minutes and empty
  strings. Accept minute-precise ordinary daytime boundaries.
- Closed days may omit times; any supplied times still need valid syntax.
- Confirm preflight malformed-count semantics and migration helper agree on all
  fixtures, including JSON null values and arrays/scalars nested as day data.
- Existing weekly_hours is unchanged, including explicitly configured schedules;
  new profile default is {}. Legacy working_days/start_hour/end_hour survive and
  are never read by the foundation validator or future availability.
- Existing profiles receive slot interval 30; accept 10/15/20/30 and reject NULL,
  zero, negative, 5, 25 and 60. Existing appointments are not grid-revalidated.
- Changed service duration/hours/slot interval/is_active do not rewrite an existing
  appointment's interval or duration snapshot.

## Foundation access and history tests

Exercise actual anon and authenticated roles with synthetic JWT identities, not
only an administrative connection. Record schema/error codes rather than personal
row values. Test role inheritance and column-level grants as well as table grants.

- Anon cannot SELECT any appointment column or read tables through the old paths.
- Anon cannot INSERT/UPDATE/DELETE/TRUNCATE appointments, profiles or services.
- Owner A reads only A's base rows; cannot SELECT/update B's private business data.
- Owner A cannot create a profile for another Auth ID, reassign ownership, insert
  a service into B, or change service profile_id/id.
- Authenticated self-profile onboarding works; unauthenticated signup profile
  insertion fails until Phase 2B handles confirmed sessions.
- Owners can edit their approved profile/service columns and deactivate services;
  no appointment mutation is available during the foundation phase.
- Test that preexisting column grants are removed; only explicit new grants remain.
- On PostgreSQL 17, assert no effective MAINTAIN privilege for anon/authenticated
  on any of the three tables. An inherited MAINTAIN grant must fail the final gate.
  Retain and verify the existing REVOKE ALL PRIVILEGES behavior.
- Normal privileged appointment INSERT/UPDATE/DELETE hits the write barrier too.
  Administrative trigger disabling/TRUNCATE is outside public threat guarantees.
- Restrictive FKs prevent deleting referenced services/profiles/Auth users. Verify
  the FK behavior in an isolated synthetic setup separate from the write barrier;
  application DELETE is independently denied by privileges.
- Pure JSON validator has no data access/elevation and only intended execute grants;
  write-barrier function has no public RPC execution grant.

## Exclusion constraint tests (isolated foundation verification)

The barrier intentionally masks appointment DML. Test the constraint separately
in a disposable test copy by explicitly removing only the barrier as a test-admin
fixture operation; never do this in production. Keep ordinary application grants
revoked. This does NOT test the future creation workflow.

- Concurrent same-business [09:00,09:45) and [09:15,10:00): only one commits.
- Identical, enclosing, enclosed and partially overlapping intervals reject.
- [09:00,09:45) and [09:45,10:30) both commit; different businesses both commit.
- completed/no_show block just like scheduled over their stored interval.
- cancelled does not block; a new scheduled replacement at the same start can
  coexist with cancelled history. This does not authorize changing cancelled status.
- Cancellation vs new booking concurrent transactions: outcome follows committed
  constraint state, no two blocking overlaps can commit; retries may be needed.
- Reschedule vs insert races remain protected. Reversed, empty and infinite ranges
  fail interval checks; NULL/unknown statuses cannot escape the partial predicate.

## Required Phase 2B acceptance tests (deferred; not implemented)

These tests must pass before the barrier can be replaced and bookings reopened.

| Area | Cases |
| --- | --- |
| Authority | Tampered browser duration/end/status ignored or rejected; DB reads active service in requested business; 20/45/75-minute services |
| Snapshot history | Existing snapshot survives service edit; explicit reschedule uses current duration; a new replacement uses current service duration while cancelled history stays unchanged |
| Slot alignment | 09:10 opening and 15-minute grid gives 09:10/09:25/09:40/09:55; reject otherwise-free 09:17, off-grid seconds/fractions and direct API bypass for both public creation and owner rescheduling; 45-minute duration needs full capacity; no midnight or global-30 assumption |
| Full interval | Existing appointment starts before queried boundary; containment, partial overlap, end exactly closing, one minute past closing |
| Closed hours | Missing/null/malformed hours return no availability; no legacy fallback; reject overnight configuration |
| Time | DB rejects past starts including after lock wait; no notice period or max horizon; browser clock/timezone does not control acceptance |
| DST | Jerusalem wall-clock label progression from opening; nonexistent/ambiguous candidates omitted and rejected even with explicit offsets; no duplicate repeated labels; either unresolved opening/closing boundary closes the affected window; real elapsed duration, no hardcoded offsets |
| Concurrency | Booking vs booking, service edit/deactivation, hours/slot edit, reschedule and cancellation; competing owner terminal-status transitions allow only one transition from scheduled; deterministic lock order and final exclusion authority |
| Privacy | Safe catalog/slot DTOs only; no appointment IDs/customer data in availability, errors, logs, caches or raw RPC responses |
| Owner | Cross-tenant IDs denied in every mutation; no outside-hours/conflict/past-creation override |
| Status | New bookings scheduled; owner-only scheduled -> completed/cancelled/no_show; reject every other transition including cancelled -> scheduled; deny all public status mutation and ID/phone-only authorization; allowed historical status edit does not incorrectly rerun future-time check |
| App integration | Old tabs fail safely; stale slots refresh on conflict; Jerusalem display; signup confirmation path; notification failure cannot duplicate booking |

For DST fixtures, use transition dates from the test environment's Asia/Jerusalem
timezone data. Cover candidates before, inside and after missing/repeated periods;
an explicit instant for either occurrence of an ambiguous local label must still
be rejected. Test opening and closing ambiguity/nonexistence independently, both
in availability and mutation validation. A round-trip-only ambiguity detector must
fail the tests. Confirm local label progression resumes on the original opening-
anchored wall-clock grid after rejected candidates, while service duration is
measured in real elapsed minutes. Include winter/summer, local midnight and
non-24-hour dates without fixed UTC offsets or 24-hour-day assumptions.

Test every pair of distinct approved statuses: only the three owner-authorized
transitions out of scheduled succeed. Cancellation preserves the original interval
and snapshot and releases capacity for a separately validated replacement. No API
or rescheduling shortcut may reset the cancelled row to scheduled. Reactivation
support and its former positive/conflict acceptance tests are excluded from initial
Phase 2; it is only a possible future feature. Rejection of unauthorized transitions
remains a required security test.

## Cutover/rollback rehearsal

Rehearse full migration failure/rollback, a successful foundation with writes closed,
and the separately reviewed Phase 2B atomic replacement. Verify no time window
permits both old direct writes and an unguarded booking path. After cutover, rollback
must preserve history and retain privacy/conflict defenses. Include a case with a
cancelled and scheduled appointment sharing an exact start: the old unique constraint
cannot be blindly restored. Recovery must never erase either record to force success.

Deployment evidence should identify PostgreSQL/Supabase versions, role setup,
synthetic fixture version, outcomes and measured locking behavior. Do not describe
this plan or source review as a passing database test suite.
