# PMOS Calendar Safety

This branch adds a future-only calendar workflow and separates future reconciliation from historical repair.

## Reconcile Future Calendar

- Uses an explicit effective date.
- Removes only PMOS-managed event occurrences on or after that date.
- Recreates future recurring series from the verified route plan.
- Does not intentionally edit events before the effective date.
- Creates route snapshots before and after reconciliation.

## Route snapshots

- Stored in the hidden `PMOS Route Snapshots` sheet.
- Duplicate route plans are suppressed.
- Snapshots older than 30 days are removed when snapshots are maintained.

## Repair Calendar History

- Detects expected route visits missing from the selected historical date range.
- Uses the latest route snapshot when available, otherwise the current route sheet.
- Creates standalone events rather than recurring series.
- Preserves PMOS frequency colours.
- Runs in batches and resumes through a time-based trigger.

## Visual Repair Board

- Displays rotation weeks as columns and weekdays as lanes.
- Supports drag-and-drop ordering, weekday moves, and rotation-week moves.
- Preserves complete route rows when saving.
- Refreshes stop order and map labels after save.
- Creates snapshots before and after route-board changes.

## Deployment note

The old destructive Calendar Job Engine entry point is no longer exposed in the PMOS menu. The underlying legacy code remains for compatibility until the new workflow has been tested in the bound Apps Script project.
