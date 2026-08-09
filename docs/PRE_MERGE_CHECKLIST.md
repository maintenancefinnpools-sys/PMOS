# PMOS Pre-Merge Checklist

Use a disposable Google Calendar and a copy of the production spreadsheet for mutation tests. Do not run destructive validation against the live maintenance Calendar.

## 1. Repository / deployment sanity

- [ ] Pull `pmos-development` into Apps Script successfully with no duplicate global declaration or syntax error.
- [ ] Open the spreadsheet and confirm `onOpen()` builds the PMOS menu.
- [ ] Open PMOS Operations and switch through every operation without a client-side error.
- [ ] Confirm no installable trigger references a deleted function.
- [ ] Confirm any legacy `runCalendarAutoContinueTrigger`, `runPmosJobTrigger_`, `runFutureCalendarReconciliationContinuation`, or `continueBatchedCalendarReconcile` trigger removes/retire state and performs no Calendar mutation.

## 2. Read-only Audit

- [ ] Open Calendar Plan Audit while no Sync queue is active.
- [ ] Verify Calendar selector and audit date range are correct.
- [ ] Run an audit with no planned changes.
- [ ] Run an audit with at least one create proposal.
- [ ] Run an audit with at least one update proposal.
- [ ] Run an audit containing an unclassified Calendar event.
- [ ] Confirm opening/running Audit does not change Google Calendar.
- [ ] Confirm unknown/unclassified events are preserved unless explicitly reviewed for another action.

## 3. Review Session

- [ ] Open and resolve Suggested Matches when present.
- [ ] Open and resolve Unclassified Events when present.
- [ ] Open and resolve Suggested Deletions when present.
- [ ] Verify a delete cannot reach the executable plan without explicit approval and exact event/series identity.
- [ ] Confirm Sync Preview exactly reflects the saved review decisions.

## 4. Queue preparation

- [ ] Prepare Calendar Sync from the reviewed plan.
- [ ] Verify `Reviewed Calendar Sync Queue` contains the expected operation count and immutable operation IDs.
- [ ] Confirm starting Sync does not rebuild or silently replace the reviewed plan.
- [ ] Confirm attempting to start a fresh Audit while an unfinished reviewed Sync queue exists is handled safely before merge.

## 5. Normal Calendar Sync

- [ ] Start Sync from PMOS Operations.
- [ ] Verify CREATE produces one recurring series and one correct registry row.
- [ ] Verify UPDATE modifies the exact intended series and preserves PMOS object identity.
- [ ] Verify an approved series-key identity migration does not append a duplicate registry row for the same Calendar Series ID.
- [ ] Verify DELETE removes only the explicitly approved exact target.
- [ ] Verify MERGE is executed/counts as UPDATE.
- [ ] Confirm queue rows advance Pending → Running → Complete in order.
- [ ] Confirm Calendar Registry History records recurring mutations.
- [ ] Confirm completion verification reaches 100% with zero remaining operations.
- [ ] Run a second Audit/Sync with unchanged source data and verify it is idempotent (no duplicate recurring series).

## 6. Pause / Resume

- [ ] Start a queue with multiple operations.
- [ ] Pause while work remains.
- [ ] Confirm no later continuation mutates Calendar while status is Paused.
- [ ] Resume and confirm the same immutable queue continues from the next incomplete operation.

## 7. Interruption recovery

Test with a deliberately instrumented/disposable setup.

- [ ] Interrupt after a recurring Calendar mutation but before registry finalization.
- [ ] Run Transaction Recovery Review / recovery analysis.
- [ ] Confirm proven completed work is finalized without duplicate mutation.
- [ ] Confirm uncertain/ambiguous state blocks instead of guessing.
- [ ] Confirm an interrupted queue row left Running is returned to Pending only after recovery analysis and then replays idempotently.

## 8. Error retry

- [ ] Cause one recoverable operation to fail.
- [ ] Confirm Sync enters `Paused on error` and retains the immutable queue.
- [ ] Correct the cause of the error.
- [ ] Select **Retry After Recovery**.
- [ ] Confirm recovery analysis runs before the Error row is returned to Pending.
- [ ] Confirm the same operation completes without creating a duplicate Calendar series or registry row.

## 9. Customer creation / Route Manager boundaries

- [ ] Create a maintenance customer.
- [ ] Confirm Customers and route-template rows are created correctly.
- [ ] Confirm customer creation does not directly mutate Calendar or auto-start Calendar Sync.
- [ ] Confirm the new Calendar change appears in the next Plan Audit.
- [ ] Reorder a route in Route Manager.
- [ ] Confirm Stop Order / Map Label and pending-change state update.
- [ ] Confirm Route Manager does not directly mutate Calendar.

## 10. Calendar Repair

- [ ] Preview a disposable repair range.
- [ ] Open the combined repair board.
- [ ] Confirm existing route/PMOS events appear as fixed green anchors.
- [ ] Add, remove, and reposition blue repair cards and save the preview.
- [ ] Apply Repair and confirm the combined day is semi-staggered from 6:00 AM.
- [ ] Confirm existing relevant route events are repositioned but not deleted.
- [ ] Confirm repair items are created once and are recognized on retry.
- [ ] Test a repair range large enough to require continuation and confirm checkpoint/resume at day boundaries.

## 11. Legacy pathways

- [ ] `showCalendarPlanAudit()` opens the current Audit flow.
- [ ] `previewRouteChangesFromSheet()` opens the current Audit flow.
- [ ] `applyCalendarChangesFromSheet()` opens the current Audit flow and does not apply Calendar changes.
- [ ] direct `applyCalendarChanges()` fails explicitly.
- [ ] Calendar Rebuild entry points fail/redirect safely and cannot delete/recreate the Calendar.
- [ ] future/date-based reconciliation entry points fail/redirect safely and cannot delete/recreate future Calendar state.

## 12. Baseline promotion

- [x] Remove the accidental independent `main` compatibility commit.
- [x] Confirm `main` is no longer ahead of `pmos-development`.
- [ ] Confirm the canonical `recurringSeriesSignature_` remains owned only by `04-E_Calendar_Recurring_Helpers.gs`.
- [ ] Complete the final duplicate/reference sweep on `pmos-development`.
- [ ] After all runtime checks pass, promote the cleaned `pmos-development` commit directly as the new `main` baseline without restoring retired compatibility code.

## Merge gate

Promote `pmos-development` to `main` only when the repository loads successfully in Apps Script, the duplicate/reference sweep is clean, and all Calendar Sync safety tests above pass on disposable data.
