# PMOS Architecture

## Status

This document describes the stabilized PMOS v1.9.0 architecture on `pmos-development` after removal of the competing Calendar execution pathways.

## Core principle

The spreadsheet is the operational source of truth. Google Calendar, maps, route-history views, registries, and support sheets are derived operational views or persistence used to apply and verify approved work.

Human review wins over inferred automation. PMOS may propose changes, matches, and deletions. Normal recurring Calendar synchronization follows one reviewed workflow. The currently working Temporary Visit scheduler is a narrow, documented one-day exception pending its optimizer-backed redesign.

## Authoritative recurring data flow

```text
Customers
   |
   v
4-Week Route Template
   |
   v
Canonical Calendar planner
   |
   v
Fresh read-only Calendar Plan Audit
   |
   v
Review Session decisions
   |
   v
Validated immutable Calendar Sync plan
   |
   v
Reviewed Calendar Sync Queue
   |
   v
Reviewed resumable worker
   |
   +--------------------+
   |                    |
   v                    v
Google Calendar   Calendar Series Registry
   |                    |
   +---------+----------+
             v
   Transaction verification/history
```

No Route Manager action, compatibility entry point, or legacy Job Engine path is allowed to bypass the Audit / Review Session / durable queue boundary for normal recurring Calendar synchronization.

## Routes

The `4-Week Route Template` is maintained in physical service order. PMOS derives Stop Order and Map Label from that order and records pending route changes for downstream review.

Route invariants:

1. Spreadsheet row order is the human-controlled route order.
2. Stop Order is sequential inside each layer.
3. Map Label is derived from Stop Order and Calendar Title.
4. Customer ID is the stable customer identity; title matching is only a fallback where explicitly supported.
5. Route mutations create recoverable route-history state before destructive rewrites.
6. Route changes do not directly mutate Google Calendar.

## Calendar planning and audit

Calendar planning is read-only. The planner combines current PMOS route/customer data with the configured Calendar and registry state to build immutable operations.

The Calendar Plan Audit is the required entry to ordinary recurring synchronization. It:

- reads the selected Calendar/date range;
- compares PMOS desired state with current Calendar state;
- identifies blocking errors and warnings;
- classifies unmatched or unclassified Calendar events;
- proposes customer matches where confidence is sufficient;
- preserves unknown Calendar events by default;
- requires explicit review for potentially destructive decisions;
- persists Review Session decisions used to resolve the final Sync plan.

## Reviewed Calendar Sync

After review is complete, PMOS builds the exact immutable Sync plan and serializes each executable operation into `Reviewed Calendar Sync Queue` before mutation begins.

The reviewed worker:

- executes a bounded number of operations per Apps Script invocation;
- persists queue state before and after each operation;
- supports Pause between operations;
- schedules continuation when work remains;
- verifies completion against the durable queue ledger;
- uses exact Calendar identities for reviewed one-time-event actions;
- uses canonical recurring-series helpers for recurring CREATE/UPDATE/DELETE operations.

### Recurring-series transactions

Recurring CREATE/UPDATE/DELETE operations are recorded in `Calendar Registry History`.

Transaction stages distinguish:

1. operation started;
2. Calendar mutation applied;
3. registry mutation applied;
4. live state verified;
5. transaction complete.

On a later worker invocation, incomplete transactions are reconciled before queue execution resumes. PMOS verifies live Calendar and registry state instead of guessing. Ambiguous recovery blocks synchronization for explicit recovery review.

Interrupted queue rows left in `Running` may be returned to `Pending` only after transaction recovery because authoritative operations are designed to be idempotent.

## Calendar Series Registry

`Calendar Series Registry` is an active current-state index rather than the source of truth. It stores the relationship between PMOS series identity and Google Calendar series identity, including:

- Series Key
- Customer ID
- Layer
- Calendar Series ID
- Calendar Name
- signature
- PMOS Object ID
- current object version
- last verification
- last transaction ID

A Calendar Series ID match preserves PMOS object identity during an approved series-key migration. Duplicate active rows for the same real Calendar Series ID are not permitted.

The registry can be reconstructed from authoritative PMOS/Calendar metadata when necessary; transaction history is retained separately for recovery evidence.

## Reviewed one-time Calendar operations

Review adapters handle exceptional Calendar events separately from recurring-series registry mutations.

Supported reviewed actions include:

- link an exact Calendar event/series to an approved customer;
- classify an exact one-time event as a Temporary Visit;
- preserve an event;
- delete an exact event/series only when that deletion was explicitly approved.

These adapters verify the exact target after mutation and are designed to be safe to replay after an interrupted worker.

## Calendar Repair

Calendar Repair is intentionally separate from normal Calendar Sync. It is an explicit historical/recovery tool for previewing and repairing missing or damaged visits in a selected date range.

The old Calendar Rebuild and future delete-and-recreate reconciliation workflows are retired. Remaining retirement handlers clean obsolete state/triggers and never perform those old mutations.

## Temporary visits

Temporary Visits are one-time Calendar events rather than recurring route-template series. PMOS currently recommends dates and insertion positions and, after final user approval, writes the selected visit directly to Calendar and retimes only that selected service day.

That direct one-day writer is intentionally preserved during stabilization because the workflow is functioning and will be redesigned together with the route optimizer. The eventual Temporary Visit architecture should retain the same simple final action while adding optimizer-backed suggestions and an appropriate durable execution/recovery model. It does not need to be forced through the recurring Sync engine if a cleaner purpose-built execution path is preferable.

Reviewed conversion of an already-existing one-time Calendar event remains part of the normal Audit/Review workflow and preserves exact event identity.

## Customer creation

The authoritative Add Maintenance Customer workflow must write the Customers record and route-template structure first. Customer IDs use the canonical PMOS identity scheme shared with the rest of the customer subsystem.

The intended user experience is a single final approval. After that approval, PMOS should automatically perform the required future Calendar synchronization without asking the user to launch Calendar Sync separately. The implementation may internally reuse the reviewed recurring worker, provided it preserves the same safety, durability, identity, and recovery guarantees and does not resurrect retired direct-sync/rebuild code.

During stabilization, existing working customer-creation behavior is preserved; the automatic post-create synchronization is deferred feature work.

## Operations / Job Center

`07-B_Job_Center.gs` owns the authoritative Operations window.

It exposes:

- Calendar Status
- Calendar Plan Audit
- Verify Calendar
- Calendar Sync
- Calendar Repair
- Customer Database Sync
- Map Export

Calendar Sync status/start/pause/resume is routed exclusively to the reviewed queue adapter. Calendar Audit opens the dedicated reviewed Audit window. Calendar Repair opens the dedicated repair-only window.

The old generic Job Engine, generic operation-provider framework, Calendar Auto-Continue, Calendar Rebuild, and future reconciliation executors are retired. Small retirement shims remain only where necessary to clean stale state/triggers.

## Persistent stores

### Business data

- `Customers`
- `4-Week Route Template`
- App Settings and user-maintained operational sheets

### Derived / operational state

- Calendar Series Registry
- Calendar Registry History
- Reviewed Calendar Sync Queue
- Review Session state
- route signatures
- Pending Route Changes
- Route Versions / history
- Sync Status
- PMOS Job History

Internal persistence sheets may be hidden because they are system state, not user-maintained business data.

## Trigger model

PMOS uses installable spreadsheet triggers for spreadsheet changes and time-driven triggers for resumable operations that still own valid continuation logic.

The authoritative recurring Calendar Sync worker creates only its reviewed-sync continuation trigger. Calendar Repair owns its repair continuation trigger. Legacy Auto-Continue, generic Job Engine, and future-reconciliation trigger handlers are retirement shims that remove obsolete triggers rather than execute Calendar mutations.

Trigger creation/removal must remain idempotent.

## Safety boundaries

The most important invariants are:

1. Spreadsheet customer/route data remains authoritative.
2. Planning/audit is read-only.
3. Normal recurring Calendar Sync requires completed review decisions.
4. The exact recurring executable plan is persisted before writes begin.
5. Calendar deletions require explicit reviewed identity/approval.
6. Recurring mutations are transaction-backed and verified.
7. Ambiguous recovery stops rather than guesses.
8. One function has one authoritative implementation/home.
9. Compatibility/retirement code does not duplicate business logic.
10. Initialization, updates, migrations, and cleanup must not destroy customer or operational source data.
11. Temporary Visit direct mutation is limited to its selected day and is an explicit deferred exception, not a general Calendar-sync bypass.
12. Future Add Maintenance Customer automation must start safe recurring synchronization automatically after final approval rather than requiring a second manual action.

## Pre-merge validation

Before promoting `pmos-development` to `main`, validate on disposable data:

1. fresh Audit with no changes;
2. Audit with create/update/delete proposals;
3. review of suggested matches/unclassified/deletion candidates;
4. Sync Preview exactly matches reviewed decisions;
5. queue preparation is durable and immutable;
6. Start/Pause/Resume completes without rebuilding the plan;
7. interrupt after Calendar mutation but before registry completion and verify transaction recovery;
8. repeat completed synchronization and confirm idempotency/no duplicate series;
9. confirm Route Manager cannot write Calendar directly;
10. smoke-test the existing Temporary Visit workflow and confirm it changes only the selected day;
11. confirm legacy triggers only self-remove and cannot mutate Calendar.
