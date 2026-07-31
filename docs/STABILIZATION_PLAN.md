# PMOS Calendar Stabilization

## Operating decisions

- Calendar Sync is one workflow. Its default range is today through Season End.
- Events that already started today are excluded unless the user deliberately selects **Include events that have already started today**.
- Calendar Sync always begins with a read-only review plan. Calendar writes require explicit approval.
- Calendar Sync compares the route template, persisted temporary visits, approved temporary optimizations, the Calendar registry, and Google Calendar.
- Calendar events not represented by a source record are preserved by default and presented for review before any deletion.
- Manually created one-time maintenance events are temporary-visit candidates. PMOS may suggest a customer match, but the user must approve inferred customer links.
- Calendar Repair primarily restores missing historical events in their former order. It may also identify duplicates and damaged metadata, but it is not the normal route-ordering workflow.
- Permanent Optimization updates the route template.
- Temporary Optimization creates date-range-specific schedule overrides without changing the route template.
- Optimizer results are approved planning records. Calendar Sync remains the only normal Calendar writer.
- The optimizer includes all relevant Calendar events by default. Events may be position-locked or excluded from the current calculation after confirmation. Exclusion never deletes the event.
- The Job Engine uses time-limited resumable execution, not fixed-size batching.

## Stabilization phases

1. Establish one authoritative implementation for every global function.
2. Separate immutable planning and validation from all state-changing work.
3. Define canonical event identities and persist temporary visits.
4. Build reviewed unknown-event and deletion decisions into the sync plan.
5. Stage registry changes and retain recovery manifests until verification succeeds.
6. Execute operations through time-limited resumable Job Engine segments with operation-level retries.
7. Restore historical Calendar Repair around route snapshots and a preview editor.
8. Add Permanent and Temporary Optimization with optimizer-to-sync handoff.
9. Run syntax, reference, browser-script, idempotency, interruption, and disposable-calendar tests.

## Function ownership rule

Every public function, private helper, trigger handler, and browser callback must have one implementation and one functional home. Compatibility modules may delegate to authoritative implementations but may not contain fallback copies of internal logic.
