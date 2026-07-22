# PMOS Architecture

## Status

This document describes the architecture observed in PMOS v1.9.0. It is intentionally descriptive: it does not change runtime behavior.

## Source of truth

The spreadsheet route and customer data are the operational source of truth. PMOS derives a recurring-series plan from the route template, compares that plan with the Calendar Series Registry, and reconciles Google Calendar through the Calendar Sync or Calendar Rebuild jobs.

```text
Customers / Route Template
          |
          v
Calendar Plan + Audit
          |
          v
Calendar Series Registry
          |
          v
Google Calendar
```

Google Calendar is an output and verification target. Temporary visits are standalone exceptions created directly for selected dates and do not become recurring route-template series.

## Major subsystems

### Core

Responsibilities:

- initialization and updates
- schema migrations
- document and user properties
- installable spreadsheet triggers
- support-sheet creation
- backups before initialization and upgrades

### Routes

Responsibilities:

- physical-row route ordering
- calculated Stop Order and Map Label values
- route signatures and change detection
- pending-change records
- route version snapshots and restoration
- Route Manager web-app operations

Route invariants:

1. Rows belonging to one layer remain in physical service order.
2. Stop Order is sequential within each layer.
3. Map Label is derived from Stop Order and Calendar Title.
4. Customer ID is preferred as the stable row key; Calendar Title is a fallback.
5. Route changes create a recoverable snapshot before mutation.
6. Changed layers are marked pending until downstream Calendar and map work is completed.

### Calendar

Responsibilities:

- build the expected recurring-series plan
- audit route and series inputs
- compare expected series with the registry
- create, update, and remove recurring Google Calendar series
- rebuild the managed Calendar in batches
- verify plan, registry, and Calendar consistency
- create and restagger standalone temporary visits

Calendar Sync and Calendar Rebuild are blocked by audit errors. This is a critical safety boundary.

### Job Engine

The shared Job Engine provides:

- one active persistent job state
- batch execution
- processed and remaining counts
- automatic continuation for supported jobs
- pause and resume
- trigger-based continuation
- error finalization
- job history

Registered managed jobs:

- Calendar Sync
- Calendar Rebuild
- Verify Calendar
- Customer Database Sync
- Map Export

Calendar Status is presented in the Job Engine interface but intentionally runs as an immediate task rather than a persistent managed job.

### Temporary visits

Temporary visits are standalone Calendar events. The scheduler:

- searches business-day windows
- loads the actual route scheduled for each candidate date
- geocodes route stops and the temporary address
- estimates the added route distance for each insertion point
- recommends dates and positions
- creates events and restaggers that date's visit times
- invalidates the route snapshot cache after changes

### UI

The UI currently consists of:

- spreadsheet menus
- modal task windows
- embedded HTML and JavaScript
- the Route Manager web app

Public Apps Script wrapper functions are required for browser calls through `google.script.run`; underscore-suffixed private helpers cannot be called directly from HTML service.

## Persistent stores

### Document properties

Known categories include:

- initialization and schema version
- route signatures
- active Job Engine state
- Calendar rebuild state
- Calendar synchronization state
- cached or remembered operational state

### User properties

Used for user-specific UI preferences, including the most recently selected Job Engine task.

### Support sheets

Observed or referenced support sheets include:

- Update Center
- Feature Lab
- System Backups
- PMOS Job History
- Calendar Series Registry
- route history/version support
- pending-change and synchronization support
- Chemical Products
- Chemical Usage

Some support sheets are hidden because they are internal persistence rather than user-maintained business data.

## Trigger model

PMOS installs spreadsheet change and edit triggers. The Job Engine separately creates a time-driven continuation trigger when an auto-capable job is active. Trigger creation must remain idempotent so updates do not accumulate duplicate handlers.

## Principal risks

1. **Monolithic source file** — production logic, UI HTML, release history, and all subsystems are combined in `Code.gs`.
2. **High coupling** — route edits affect calculated columns, signatures, history, pending changes, Calendar planning, and map exports.
3. **Browser payload integrity** — route rewrite functions must reject incomplete, duplicate, or stale customer-key lists before replacing sheet contents.
4. **Registry consistency** — Calendar reconciliation depends on the plan, registry, and Calendar agreeing on stable series identity.
5. **State finalization** — Apps Script work may finish but fail while saving final job status; error reporting must distinguish these outcomes.
6. **Protection duplication** — calculated-column protection setup should reuse or remove existing PMOS protections before creating replacements.
7. **Embedded HTML scale** — large template strings make browser/server boundaries difficult to test and review.

## Refactoring sequence

1. Add read-only diagnostics and architecture documentation.
2. Add integrity assertions around destructive route and Calendar mutations.
3. Make trigger and protection installation explicitly idempotent.
4. Extract constants and configuration.
5. Extract the Job Engine without renaming public entry points.
6. Extract Calendar planning, audit, registry, sync, rebuild, verification, and temporary visits.
7. Extract Routes, Customers, Chemistry, and UI.
8. Move embedded HTML into dedicated Apps Script HTML files.
9. Add automated tests for pure planning, ordering, identity, date-rotation, and state-transition logic.

## Developer diagnostics principles

Diagnostics must be read-only by default. They may inspect configuration, properties, triggers, sheets, active jobs, and registry health, but repair actions should be separate explicit commands. This prevents a troubleshooting screen from silently changing production state.
