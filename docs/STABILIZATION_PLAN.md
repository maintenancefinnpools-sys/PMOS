# PMOS Calendar Stabilization

## Operating decisions

- `pmos-development` is the behavioral baseline for the next stable release. Cleanup must preserve currently working PMOS behavior unless a defect is explicitly being corrected.
- Spreadsheet customer and route data are the operational source of truth.
- Calendar Sync is one reviewed workflow. Its default range is today through Season End.
- Events that already started today are excluded unless the user deliberately selects **Include events that have already started today**.
- Calendar writes require a completed read-only Calendar Plan Audit and Review Session.
- The approved review plan is serialized into a durable queue before Calendar mutation begins.
- Calendar events not represented by a source record are preserved by default and presented for review before any deletion.
- Manually created one-time maintenance events are temporary-visit candidates. PMOS may suggest a customer match, but the user must approve inferred customer links.
- Calendar Repair is a separate explicit recovery workflow. It is not a normal synchronization path.
- The Job Center uses the reviewed resumable Calendar worker; legacy generic Job Engine and Auto Continue execution are retired.

## Authoritative Calendar flow

```text
Customers / 4-Week Route Template
            |
            v
Fresh Calendar Plan Audit
            |
            v
Review Session decisions
            |
            v
Validated immutable Sync plan
            |
            v
Reviewed Calendar Sync Queue
            |
            v
Reviewed resumable worker
            |
            +------------------+
            |                  |
            v                  v
      Google Calendar   Series Registry
            \                  /
             \                /
              v              v
          Transaction History / Verification
```

No Route Manager, customer-creation, legacy task window, compatibility pathway, or alternate reconciliation job may bypass this sequence to perform normal Calendar synchronization.

## Cleanup completed on `pmos-development`

- Retired the old Calendar Sync modal and direct mutation executor.
- Removed the old Calendar Auto-Continue engine; legacy trigger/state cleanup is centralized in one non-mutating retirement shim.
- Removed retired/duplicate Job Center and generic Calendar Sync provider pathways.
- Removed the obsolete generic Job runtime worker, operation-provider framework, runtime activation override, and persisted generic Job state machine. Legacy public Job functions are now stateless redirects/cleanup adapters only.
- Removed obsolete generic Job constants; the shared Job History sheet remains because current Operations still uses it.
- Removed both future delete-and-recreate Calendar reconciliation engines. Their old continuation handlers now only clean obsolete trigger/state and cannot mutate Calendar.
- Removed the destructive Calendar Rebuild pathway; only non-mutating compatibility adapters remain where still needed by older callers.
- Centralized cleanup of old Auto Continue, Rebuild, reconciliation, and generic Job properties/triggers in the legacy execution retirement shim.
- Removed duplicate address suggestion implementation.
- Removed the legacy Add Maintenance Client path that could automatically launch Calendar synchronization.
- Removed direct Calendar mutation paths from Route Manager.
- Consolidated old Calendar Audit/Sync public navigation names into one redirect-only module and removed the redundant Audit compatibility file.
- Routed all Calendar Plan Audit entry points to the current reviewed Audit window.
- Reduced generic task windows to immediate non-review operations only.
- Updated spreadsheet lifecycle/update messaging and Feature Lab terminology so they no longer advertise retired direct Sync/Rebuild paths.
- Integrated the authoritative reviewed recurring-series worker with Calendar Registry Transaction History and recovery.
- Added deterministic replay of interrupted `Running` queue rows after transaction recovery.
- Added an explicit **Retry After Recovery** path for jobs paused on an operation error; ambiguous transaction state remains blocked.
- Consolidated recurring-series create/update/lookup/registry logic into the canonical recurring Calendar helpers.
- Made canonical registry upsert preserve PMOS object identity when an approved series-key migration keeps the same Calendar Series ID.
- Consolidated Calendar Repair ownership: safety/planning in `15-B`, editor persistence in `16`, combined-board UI in `19`, resumable combined-day execution in `18`.
- Renamed the old integrated Job Engine module to a Calendar Repair-specific window module and removed unused integrated-job state.
- Removed duplicate Calendar Repair safety/UI implementations.
- Separated geographic placement into its own module; Calendar Repair no longer depends on loading-order overrides from a mixed-purpose geography/repair file.
- Standardized new customer creation on the canonical PMOS customer-ID scheme.
- Rewrote architecture documentation around the reviewed queue / transaction model.
- Removed the accidental independent `main` compatibility commit. `main` now points to the common base and is no longer ahead of `pmos-development`.

## Remaining merge blockers

1. **Final repository reference sweep** — verify there are no remaining calls to deleted legacy functions or duplicate global function definitions.
2. **Repair-path verification** — exercise Preview → combined board → Save → Apply → continuation on a disposable date range after the Repair module consolidation.
3. **End-to-end Calendar Sync test** — validate Audit → Review → Sync Preview → Queue Preparation → Job Center → Calendar mutation → Registry verification → completion on a disposable Calendar.
4. **Interruption test** — interrupt recurring synchronization after Calendar mutation but before registry/final-state persistence and verify deterministic transaction recovery and queue replay.
5. **Retry-on-error test** — force a recoverable Calendar operation error, correct the cause, use **Retry After Recovery**, and confirm the same immutable operation resumes without duplication.
6. **Legacy-trigger cleanup test** — confirm old Auto Continue, generic Job Engine, and reconciliation triggers only remove themselves and never mutate Calendar.

## Function ownership rule

Every public function, private helper, trigger handler, and browser callback must have one implementation and one functional home. Compatibility modules may delegate to authoritative implementations but may not contain fallback copies of internal logic.

Current Calendar ownership:

- recurring planning/settings: `04-D` / `04-E`
- recurring registry identity/versioning: `04-E` / `04-F` / `04-G`
- legacy Calendar trigger/state retirement: `04-B`
- legacy Job public adapters + shared history helpers: `07-A`
- Calendar Repair window: `07-C_Calendar_Repair_Window.gs`
- transaction history/recovery: `07-F`–`07-H`
- Calendar Repair safety/plan: `15-B`
- Calendar Repair editor persistence: `16_Calendar_Repair_Editor.gs`
- Calendar Repair combined execution: `18_Calendar_Repair_Combined_Stagger.gs`
- Calendar Repair combined board UI: `19_Calendar_Repair_Existing_Visits_Editor.gs`
- reviewed audit/review: `20`–`22`
- maintenance geographic placement: `22_Geographic_Suggestions.gs`
- reviewed Sync preparation/execution/status/Job Center adapter: `23_A`–`23_J`
- legacy Audit/Sync navigation redirects: `23_Audit_Sync_And_All_Calendar_Events.gs`

## Merge gate

`pmos-development` is not ready to merge until the remaining reference sweep and disposable-Calendar tests pass. No legacy Calendar writer should remain reachable before merge. Once those checks pass, the cleaned `pmos-development` state becomes the new `main` baseline without reintroducing old `main` compatibility code.
