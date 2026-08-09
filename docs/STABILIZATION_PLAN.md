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
- Removed the obsolete generic Job runtime/state-machine module. Current Operations callbacks and Job History helpers now live in `07-A_Operations_Shared.gs`; the old generic Job trigger name survives only in the cleanup shim so stale installable triggers can remove themselves safely.
- Removed obsolete generic Job constants; the shared Job History sheet remains because current Operations still uses it.
- Removed both future delete-and-recreate Calendar reconciliation engines. Their old continuation handlers now only clean obsolete trigger/state and cannot mutate Calendar.
- Removed the destructive Calendar Rebuild pathway.
- Centralized cleanup of old Auto Continue, Rebuild, reconciliation, and generic Job properties/triggers in the legacy execution retirement shim.
- Removed duplicate address suggestion implementation.
- Removed the legacy Add Maintenance Client path that could automatically launch Calendar synchronization.
- Removed the obsolete web-app Add Customer pathway that wrote directly to the route template without first creating the authoritative Customers record.
- Removed direct Calendar mutation paths from Route Manager; remaining legacy route-navigation wrappers are being evaluated for deletion during the final reference sweep.
- Removed obsolete Calendar Audit/Sync compatibility redirect files and redundant Audit wrappers.
- Reduced generic task windows to the immediate Operations dispatcher actually used by the current Job Center.
- Updated spreadsheet lifecycle/update messaging and Feature Lab terminology so they no longer advertise retired direct Sync/Rebuild paths.
- Removed the alternate Smart Customer Database Sync engine that generated a competing `CUS-...` identity format.
- Removed unused prototype data-normalization and generic diff-engine modules that had no current callers.
- Integrated the authoritative reviewed recurring-series worker with Calendar Registry Transaction History and recovery.
- Added deterministic replay of interrupted `Running` queue rows after transaction recovery.
- Added an explicit **Retry After Recovery** path for jobs paused on an operation error; ambiguous transaction state remains blocked.
- Consolidated recurring-series create/update/lookup/registry logic into the canonical recurring Calendar helpers.
- Made canonical registry upsert preserve PMOS object identity when an approved series-key migration keeps the same Calendar Series ID.
- Consolidated Calendar Repair ownership: safety/planning in `15-B`, editor persistence in `16`, combined-board UI in `19`, resumable combined-day execution in `18`.
- Retained `15_Runtime_Safety_Foundation.gs` because Calendar Repair actively depends on its checkpoint, lock, heartbeat, and yield helpers.
- Renamed the old integrated Job Engine module to a Calendar Repair-specific window module and removed unused integrated-job state.
- Removed duplicate Calendar Repair safety/UI implementations.
- Separated geographic placement into its own module; Calendar Repair no longer depends on loading-order overrides from a mixed-purpose geography/repair file.
- Standardized new customer creation on the canonical PMOS customer-ID scheme.
- Rewrote architecture documentation around the reviewed queue / transaction model.
- Removed the accidental independent `main` compatibility commit. `main` now points to the common base and is no longer ahead of `pmos-development`.

## Remaining merge blockers

1. **Final repository reference sweep** — remove remaining dead compatibility wrappers and verify there are no calls to deleted legacy functions or duplicate global function definitions.
2. **Temporary Visit Calendar ownership** — the current Temporary Visit scheduler still creates a Calendar event directly and retimes that day's existing events. Decide/refactor this so it cannot bypass the reviewed Calendar mutation architecture while preserving the simple scheduling workflow.
3. **Repair-path verification** — exercise Preview → combined board → Save → Apply → continuation on a disposable date range after the Repair module consolidation.
4. **End-to-end Calendar Sync test** — validate Audit → Review → Sync Preview → Queue Preparation → Job Center → Calendar mutation → Registry verification → completion on a disposable Calendar.
5. **Interruption test** — interrupt recurring synchronization after Calendar mutation but before registry/final-state persistence and verify deterministic transaction recovery and queue replay.
6. **Retry-on-error test** — force a recoverable Calendar operation error, correct the cause, use **Retry After Recovery**, and confirm the same immutable operation resumes without duplication.
7. **Legacy-trigger cleanup test** — confirm old Auto Continue, generic Job Engine, and reconciliation triggers only remove themselves and never mutate Calendar.

## Function ownership rule

Every public function, private helper, trigger handler, and browser callback must have one implementation and one functional home. Compatibility modules may delegate to authoritative implementations only while a real compatibility requirement remains; dead wrappers should be removed before promotion to `main`.

Current Calendar ownership:

- recurring planning/settings: `04-D` / `04-E`
- recurring registry identity/versioning: `04-E` / `04-F` / `04-G`
- legacy Calendar trigger/state retirement: `04-B`
- current Operations callbacks + shared Job History helpers: `07-A_Operations_Shared.gs`
- current Operations / Job Center UI: `07-B_Job_Center.gs`
- immediate Operations dispatcher: `07-B_Job_Task_Windows.gs`
- Calendar Repair window: `07-C_Calendar_Repair_Window.gs`
- transaction history/recovery: `07-F`–`07-H`
- Calendar Repair safety/plan: `15-B`
- Calendar Repair runtime/checkpoint support: `15_Runtime_Safety_Foundation.gs`
- Calendar Repair editor persistence: `16_Calendar_Repair_Editor.gs`
- Calendar Repair combined execution: `18_Calendar_Repair_Combined_Stagger.gs`
- Calendar Repair combined board UI: `19_Calendar_Repair_Existing_Visits_Editor.gs`
- reviewed audit/review: `20`–`22`
- maintenance geographic placement: `22_Geographic_Suggestions.gs`
- reviewed Sync preparation/execution/status/Job Center adapter: `23_A`–`23_J`

## Merge gate

`pmos-development` is not ready to promote until the remaining reference sweep, Temporary Visit ownership fix, and disposable-Calendar tests pass. No unintended Calendar writer should remain reachable before promotion. Once those checks pass, the cleaned `pmos-development` state becomes the new `main` baseline without reintroducing old `main` compatibility code.
