# PMOS Calendar Stabilization

## Operating decisions

- Spreadsheet customer and route data are the operational source of truth.
- Calendar Sync is one reviewed workflow. Its default range is today through Season End.
- Events that already started today are excluded unless the user deliberately selects **Include events that have already started today**.
- Calendar writes require a completed read-only Calendar Plan Audit and Review Session.
- The approved review plan is serialized into a durable queue before Calendar mutation begins.
- Calendar events not represented by a source record are preserved by default and presented for review before any deletion.
- Manually created one-time maintenance events are temporary-visit candidates. PMOS may suggest a customer match, but the user must approve inferred customer links.
- Calendar Repair is a separate explicit recovery workflow. It is not a normal synchronization path.
- Permanent Optimization updates the route template.
- Temporary Optimization creates date-range-specific schedule overrides without changing the route template.
- Optimizer results are approved planning records. Calendar Sync remains the only normal Calendar writer.
- The Job Center uses resumable execution and durable state; legacy Calendar Auto-Continue is retired.

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
Job Center / resumable worker
            |
            v
Google Calendar + Series Registry
```

No Route Manager, customer-creation, legacy task window, or compatibility pathway may bypass this sequence to mutate Calendar.

## Cleanup completed on `pmos-development`

- Retired the old Calendar Sync modal and direct mutation executor.
- Retired legacy Calendar Auto-Continue execution; only legacy-trigger cleanup remains.
- Removed retired/duplicate Job Center and generic Calendar Sync provider pathways.
- Removed obsolete compatibility placeholders and the unused alternate Job Engine registry.
- Removed duplicate address suggestion implementation.
- Removed the legacy Add Maintenance Client path that could automatically launch Calendar synchronization.
- Removed direct Calendar mutation paths from Route Manager.
- Routed all Calendar Plan Audit entry points to the current reviewed Audit window.
- Reduced generic task windows to immediate non-review operations only.
- Restored recurring-series lookup/recovery helpers to the canonical recurring Calendar helper module after provider cleanup.
- Standardized new customer creation on the canonical PMOS customer-ID scheme.

## Remaining merge blockers

1. **Reviewed worker transaction integration** — recurring CREATE/UPDATE/DELETE operations executed by the reviewed Calendar worker must participate in Calendar Registry Transaction History so interruption recovery covers the authoritative sync path, not only retired providers.
2. **Executor consolidation** — reviewed recurring-series mutation helpers should reuse the canonical recurring Calendar helpers where possible so recurrence, metadata, registry and identity logic cannot drift.
3. **Reference sweep** — run a final repository-wide symbol/reference audit after the deleted legacy modules are fully removed.
4. **Documentation sweep** — update architecture documentation and comments that still describe removed Job Engine / Calendar Rebuild behavior.
5. **End-to-end test** — validate Audit → Review → Sync Preview → Queue Preparation → Job Center → Calendar mutation → Registry verification → completion on a disposable Calendar.
6. **Interruption test** — interrupt synchronization after Calendar mutation but before registry/final-state persistence and verify deterministic recovery.
7. **Merge-base reconciliation** — `main` has one independent compatibility commit. Preserve the canonical recurring-series signature implementation when reconciling branches; do not resurrect the removed compatibility module.

## Function ownership rule

Every public function, private helper, trigger handler, and browser callback must have one implementation and one functional home. Compatibility modules may delegate to authoritative implementations but may not contain fallback copies of internal logic.

## Merge gate

`pmos-development` is not ready to merge until all remaining blockers above are resolved or explicitly accepted, and the disposable-Calendar end-to-end test passes without an alternate mutation pathway.
