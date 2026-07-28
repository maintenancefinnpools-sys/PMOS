# PMOS Route Intelligence Engine Specification

**Status:** Approved design baseline  
**Branch:** `feature/gps-route-optimization`  
**System:** Pool Maintenance Operating System (PMOS)  
**Component:** Route Intelligence Engine (RIE)

---

## 1. Purpose

The Route Intelligence Engine is a foundational PMOS subsystem for planning, comparing, optimizing, and explaining service routes using actual road travel time and distance.

RIE is not an autonomous dispatcher. It is a decision-support engine that improves the dispatcher’s judgment while preserving user control.

> **RIE recommends, explains, previews, and records. The user decides.**

RIE will initially support:

- Add Maintenance Client suggestions.
- Add Temporary Visit suggestions.
- Optimize Route(s).
- Optimize All Routes.

The same engine will later support:

- Route balancing.
- Technician absence planning.
- Route assignment.
- Multi-technician operations.
- Territory planning.
- Calendar repair intelligence.
- Alternative optimization objectives.

---

## 2. Guiding Principles

1. **The user remains in control.** RIE must not silently rewrite operational routes.
2. **One engine serves many features.** All route-related PMOS functions use shared routing, caching, scoring, constraint, and history services.
3. **Use real roads.** Recommendations are based on directional road travel time and distance rather than straight-line proximity.
4. **Explain recommendations plainly.** Internal scores may exist, but the user interface should emphasize understandable reasons.
5. **Protect user intent.** Locks, exclusions, review, history, and restore take precedence over theoretical optimization.
6. **Separate planning from publication.** Optimization updates the 4-Week Route Template. Calendar Sync remains a separate deliberate action.
7. **Design for provider independence.** GraphHopper may be the first routing provider, but RIE must permit OpenRouteService, Google Maps, or another provider later.
8. **Routes and technicians are separate concepts.** Routes are operational units; technicians are assigned to them.
9. **Derived data must be rebuildable.** Cached coordinates and route legs may be deleted and recreated without loss of primary operational data.
10. **Small improvements may still be useful.** Route optimization suggestions have no minimum time or distance threshold.

---

## 3. Core Domain Model

### 3.1 Route

A route is a recurring operational unit within a specific week and day.

Examples:

- Week 1 — Monday — Route A
- Week 3 — Thursday — Route B
- Week 2 — Friday, where only one route exists

When a day has only one route, the display name may simply be the day name. When multiple routes exist, simple names such as Route A and Route B should be used.

A route owns:

- Week number.
- Day of week.
- Route identifier.
- Ordered customer visits.
- Start location.
- End location.
- Optional constraints.

### 3.2 Technician

A technician is not part of the route’s identity. A technician is assigned to one or more routes through a separate assignment layer.

This allows:

- Route optimization without altering staffing.
- Flexible technician rotation between Route A and Route B.
- Route coverage changes without rebuilding the route structure.
- Independent technician absence planning.

### 3.3 Assignment

An assignment links a technician to a route for an applicable date or recurring schedule.

Example:

| Technician | Monday | Tuesday | Wednesday | Thursday | Friday |
|---|---|---|---|---|---|
| Tech 1 | Route A | Route A | Route B | Route B | Route A |
| Tech 2 | Route B | Route B | — | Route A | Route B |

The assignment system is future work but must remain compatible with RIE from the beginning.

### 3.4 Visit

A visit is a customer stop within a route.

A visit should have a stable internal ID and references to:

- Customer ID.
- Location ID.
- Route membership.
- Position in route.
- Recurrence or actual date.
- Temporary/permanent status.
- Optional lock or exclusion metadata.

---

## 4. Route Duration Model

Pool-service duration varies, so RIE must not claim precise job-duration forecasting.

For comparison and route balancing, PMOS will use a configurable average visit duration.

Default:

```text
Average Visit Duration = 20 minutes
```

Estimated route length:

```text
Estimated Route Length = Total Drive Time + (Route Stops × Average Visit Duration)
```

User-facing display:

```text
Route Stops
18

Estimated Route Length*
5 h 42 min

*Based on an average service time of 20 minutes per visit.
```

The footnote must remain visible wherever estimated route length is shown.

---

## 5. Routing Provider Architecture

RIE must access routing services through a provider adapter rather than calling a vendor directly from feature code.

```text
Feature
  ↓
Route Intelligence Engine
  ↓
Routing Provider Interface
  ├── GraphHopper adapter
  ├── OpenRouteService adapter
  └── Google Maps adapter (future)
```

### 5.1 Required provider capabilities

The active provider must support, directly or through adapter logic:

- Address geocoding.
- Directional travel time.
- Directional travel distance.
- Time-and-distance matrices.
- Driving profile selection.
- Error and quota reporting.

### 5.2 Provider-neutral response

Feature code must receive normalized values such as:

```javascript
{
  provider: 'graphhopper',
  profile: 'car',
  originLocationId: 'LOC-001',
  destinationLocationId: 'LOC-002',
  durationSeconds: 428,
  distanceMetres: 5300,
  calculatedAt: '2026-07-28T14:00:00-04:00'
}
```

No feature should depend on vendor-specific response fields.

### 5.3 Configuration

API credentials belong in Apps Script Properties, not spreadsheets or source code.

Settings include:

- Active routing provider.
- API key or credential reference.
- Driving profile.
- Provider timeout.
- Retry limits.
- Cache age.
- Routing-engine schema version.

---

## 6. Cache Architecture

RIE uses two persistent support tables and one short-term memory layer.

### 6.1 PMOS Locations

A hidden support sheet stores normalized locations and coordinates.

Suggested columns:

| Field | Description |
|---|---|
| Location ID | Stable PMOS identifier |
| Entity Type | Customer, depot, temporary visit, custom |
| Entity ID | Related customer or object ID |
| Normalized Address | Address used for geocoding |
| Latitude | Decimal latitude |
| Longitude | Decimal longitude |
| Provider | Geocoder used |
| Geocoded At | Timestamp |
| Address Fingerprint | Detects address changes |
| Status | Valid, stale, error |

### 6.2 PMOS Route Cache

A hidden support sheet stores directional travel legs.

Suggested columns:

| Field | Description |
|---|---|
| Cache Key | Unique directional lookup key |
| Origin Location ID | Starting location |
| Destination Location ID | Ending location |
| Provider | Routing provider |
| Profile | Driving profile |
| Duration Seconds | Travel duration |
| Distance Metres | Travel distance |
| Calculated At | Timestamp |
| Engine Version | Cache compatibility version |
| Status | Valid, stale, error |

A → B and B → A are stored separately because real-road travel is directional.

Example key:

```text
graphhopper|car|LOC-001|LOC-002|v1
```

### 6.3 Apps Script CacheService

Lookup order:

```text
CacheService
  ↓ miss
PMOS Route Cache
  ↓ miss or stale
Routing Provider API
  ↓
Persist result in PMOS Route Cache
  ↓
Store short-term copy in CacheService
```

### 6.4 Cache invalidation

A cache record becomes stale when:

- A location address or coordinates change.
- The active provider changes.
- The driving profile changes.
- The engine schema version changes.
- The configured cache age is exceeded.
- The user requests a refresh.

Default persistent cache age:

```text
90 days
```

Old data may be lazily replaced rather than rebuilt all at once.

---

## 7. Route Intelligence Core Services

RIE should expose shared services rather than feature-specific algorithms.

### 7.1 Location service

Responsibilities:

- Normalize addresses.
- Resolve stable location IDs.
- Geocode missing or stale addresses.
- Validate coordinates.
- Maintain location cache records.

### 7.2 Travel matrix service

Responsibilities:

- Accept a set of locations.
- Reuse cached directional legs.
- Batch missing legs through the provider matrix API.
- Normalize and persist returned results.
- Report incomplete or failed pairs.

### 7.3 Insertion service

For an ordered route:

```text
A → B → C
```

and proposed visit X, test every valid insertion position.

For insertion between A and B:

```text
Added Drive Time = time(A,X) + time(X,B) - time(A,B)
Added Distance   = dist(A,X) + dist(X,B) - dist(A,B)
```

The same calculation applies between the depot and first stop and between the last stop and depot.

### 7.4 Optimization service

Responsibilities:

- Reorder visits within selected routes.
- Move visits between selected routes when permitted by scope.
- Respect locked positions and exclusions.
- Compare original and optimized solutions.
- Return one best solution initially.
- Permit multiple solution objectives later.

### 7.5 Explanation service

Translate algorithmic results into plain language.

Examples:

- Shortest additional drive.
- Best insertion point.
- Avoids a backtrack.
- Groups nearby customers.
- Reduces repeated travel to the same area.
- Keeps estimated route lengths similar.

Internal scores should not be the primary user-facing explanation.

---

## 8. Add Maintenance Client

### 8.1 Objective

Return the three best permanent placements for a new maintenance customer.

### 8.2 Evaluation

For every eligible recurring route:

1. Load the ordered route and depot locations.
2. Resolve the new customer’s coordinates.
3. Test every insertion position.
4. Calculate added drive time and distance.
5. Calculate resulting route stops.
6. Calculate estimated route length using 20-minute average visits.
7. Keep the best insertion for that route.
8. Rank all route candidates.
9. Return the top three placements.

Drive time and estimated total route length are primary balancing considerations. Distance remains visible and contributes to ranking.

### 8.3 Suggestion display

```text
#1

Tuesday
Weeks 1 & 3

Insert between
Hordyk
↓
New Customer
↓
Samson

Added Drive Time
+6 min

Added Distance
+3.8 km

Route Stops
18

Estimated Route Length*
5 h 42 min

Why?

*Based on an average service time of 20 minutes per visit.
```

### 8.4 Commit behavior

After user approval, Add Maintenance Client may update both:

- The underlying maintenance customer/route data.
- The live calendar through the established calendar workflow.

This direct calendar update is permitted only for the narrowly scoped Add Maintenance Client operation, with normal validation and error reporting.

---

## 9. Add Temporary Visit

### 9.1 Objective

Return the three best actual dates and insertion positions for a temporary visit.

The calculation uses the visits already scheduled on each actual date, including existing temporary visits.

### 9.2 Display

The placement display follows the same principles as Add Maintenance Client.

Where route-order optimization is proposed, use the compact comparison:

```text
Current Route — 2 h 18 min / 96.4 km
Optimized Route — 1 h 56 min / 79.8 km
Savings — 22 min / 16.6 km
```

### 9.3 Commit behavior

After user approval, Add Temporary Visit may add the event directly to the live calendar because it is a narrow, deliberate operation affecting a known date and visit.

Calendar errors must not leave source data and calendar data in an ambiguous state. The operation requires validation, clear status reporting, and recoverable failure behavior.

---

## 10. Optimize Route(s)

### 10.1 Purpose

Optimize a user-selected scope of recurring routes while preserving a deliberate review step.

Optimization writes only to the 4-Week Route Template. It must not run Calendar Sync directly and must not offer a direct-sync option.

After applying approved changes, PMOS prompts the user to run Calendar Sync separately.

### 10.2 Scope selector

A reusable PMOS Scope Selector should support:

1. **Day(s)**
2. **Week(s)**
3. **Route(s)**
4. **Technician(s)**
5. **Entire Operation**

This order should be used in the interface.

### 10.3 Day(s)

The user selects one or more weeks and one or more days.

A selected day includes every route within that day. If multiple days are selected, visits may move between those selected days.

Example:

```text
Weeks: Week 2
Days: Monday, Tuesday
```

RIE may optimize across all routes on Week 2 Monday and Tuesday.

### 10.4 Week(s)

The user selects one or more weeks.

RIE may move visits between days and routes inside the selected weeks.

### 10.5 Route(s)

Display a grid organized by week and day:

| | Week 1 | Week 2 | Week 3 | Week 4 |
|---|---|---|---|---|
| Monday | Monday | Monday | Monday | Monday |
| Tuesday | Tuesday | Tuesday | Tuesday | Tuesday |
| Wednesday | Wednesday | Wednesday | Wednesday | Wednesday |
| Thursday | Thursday | Thursday | Thursday | Thursday |
| Friday | Friday | Friday | Friday | Friday |

Selecting a day containing multiple routes expands the available route list.

Examples:

```text
Week 2 → Monday
☐ Route A
☐ Route B
```

- One selected route: optimize within that route only.
- Multiple selected routes: optimize across those routes and permit movement between them.
- Multiple routes on different days may be selected and optimized together.

### 10.6 Technician(s)

Technician selection is a convenience scope based on current route assignments.

Selecting a technician means:

> Optimize the routes presently assigned to this technician.

The routes remain independent operational objects. Changing the technician assignment later does not redefine the route.

### 10.7 Entire Operation

Optimize All Routes is the large-scale form of route optimization.

RIE may consider movement between:

- Routes.
- Days.
- Weeks.
- Biweekly splits.
- Technician-assigned route groups.

Its primary objective is total operational efficiency, including reducing unnecessary repeated travel to the same area during a week or biweekly cycle.

Route balancing is a future mode using the same engine with different objective weights.

---

## 11. Preview and Route Comparison

Before applying changes, RIE presents:

- Current route data.
- Optimized route data.
- Time savings.
- Distance savings.
- Route confidence.
- A plain-language Why explanation.
- Expandable route order comparison.

Compact summary:

```text
Current Route — 2 h 18 min / 96.4 km
Optimized Route — 1 h 56 min / 79.8 km
Savings — 22 min / 16.6 km

[Show Route]
```

The initial implementation may use either:

- Inline expansion within the existing window.
- A modal/text popup that can be closed after review.

Both should be prototyped before the final presentation choice is fixed.

### 11.1 Side-by-side comparison

When Show Route is opened, current and optimized orders should appear side by side.

| Current Route | Optimized Route |
|---|---|
| Shop | Shop |
| Customer A | Customer A |
| Customer B | Customer D |
| Customer C | Customer B |
| Customer D | Customer C |
| Shop | Shop |

Changed rows should be visually highlighted.

---

## 12. Interactive Locks and Exceptions

### 12.1 Customer locks

Users may lock a customer from either side of the comparison.

Lock on current side:

> Preserve this customer’s current route and/or position.

Lock on optimized side:

> Preserve this proposed placement while recalculating the remaining solution.

After a lock changes, RIE should recalculate the optimized column and update time/distance totals.

### 12.2 Broader exclusions

The constraint model must later support exclusions such as:

- Exclude a route.
- Exclude a selected day.
- Exclude Monday Week 1.
- Exclude a technician’s assigned routes.
- Exclude a customer from cross-route movement.

The first implementation may focus on customer locks, provided the data model allows broader constraints later.

### 12.3 Reverse route

Each route should support:

```text
Reverse Route
```

This flips the visit order, then allows RIE to re-optimize around that new direction. RIE must not assume the exact reverse is optimal because one-way streets, highway ramps, turn restrictions, and asymmetric travel may change the best order.

---

## 13. Accepting and Declining Suggestions

### 13.1 Apply

Applying an optimization:

1. Creates a history snapshot.
2. Writes approved changes to the 4-Week Route Template.
3. Records the accepted solution.
4. Prompts the user to run Calendar Sync.

No calendar synchronization occurs inside Optimize Route(s).

### 13.2 Keep current route

The default decline action is quick:

```text
[Keep Current Route]
```

No reason is requested.

### 13.3 Do not show again

Optional checkbox:

```text
☐ Don’t show this optimization again
```

Only when selected does the optional reason section appear:

- Negligible difference.
- Access restrictions.
- Customer preference.
- Personal preference.
- Other.

Selecting Other opens a manual text field.

The reason is optional and primarily historical. PMOS should not infer detailed constraints from these broad categories without a later explicit design decision.

A suppressed suggestion is identified by a signature of the current route configuration and proposed solution. If the route materially changes, the signature changes and RIE may evaluate it again.

---

## 14. Route Confidence

RIE may display a concise confidence label to communicate the scale and clarity of an improvement.

Examples:

```text
★★★★★ Excellent improvement
★★★★ Good improvement
★★★ Minor improvement
```

Confidence is a presentation aid, not a substitute for the actual time, distance, and route comparison.

---

## 15. Optimization Summary

Before applying a multi-route optimization, RIE displays an operation summary.

Example:

```text
Routes Analyzed
48

Routes Improved
19

Estimated Weekly Savings
1 h 47 min / 54.8 km

Customer Moves
31

History Snapshot
Will be created on apply

[Apply Changes]
[Cancel]
```

For changed routes, the user must be able to inspect route comparisons and add locks before applying.

---

## 16. History and Restore

Every applied optimization creates a snapshot before modifying the route template.

History metadata should include:

- Snapshot ID.
- Timestamp.
- User.
- Optimization scope.
- Original route data.
- Applied route data.
- Estimated time and distance difference.
- Locks and exclusions.
- Provider and engine version.
- Optional notes.

Restore should return the 4-Week Route Template to the selected snapshot state. Calendar Sync remains a separate action after restoration.

History should favor whole-snapshot restoration over attempting to mathematically reverse individual moves.

---

## 17. Settings

Initial Route Intelligence settings:

- Active routing provider.
- Start location.
- End location.
- Average visit duration.
- Driving profile.
- Cache expiration.
- Route-engine version.
- Suggestion count for insertion features.

Defaults:

```text
Start: Shop
End: Shop
Average Visit Duration: 20 minutes
Insertion Suggestions: 3
Cache Expiration: 90 days
```

Future settings:

- Per-technician start/end locations.
- Optimization objective.
- Conservative/balanced/aggressive behavior.
- Provider comparison mode.
- Maximum estimated route length.
- Technician availability.

---

## 18. Job Engine Integration

The Job Engine should expose distinct RIE operations:

- Add Maintenance Client.
- Add Temporary Visit.
- Optimize Route(s).
- Optimize All Routes, if retained as a direct shortcut into Entire Operation scope.
- Technician Absence Planner, future.

### 18.1 Batching

Add Maintenance Client and Add Temporary Visit should normally complete in one operation.

Optimize Route(s) should also normally complete in one operation when it only analyzes and updates the route template.

The Job Engine’s resumable batching infrastructure should remain available for:

- Very large route matrices.
- Provider rate limits.
- Full-operation optimization.
- Future multi-technician scale.
- Calendar work performed by separate Calendar Sync.

The implementation should not force batching where it adds unnecessary complexity.

---

## 19. Technician Absence Planner — Future Module

Technician absence planning should be a separate PMOS tool using RIE with a disruption-recovery objective.

Example inputs:

- Unavailable technician.
- Date or date range.
- Remaining available technicians.
- Whether visits may move to later days.
- Maximum delay.

Possible output plans:

- Complete all visits today with redistributed routes.
- Move selected visits to tomorrow.
- Spread visits across two or three days.
- Minimize overtime.
- Minimize customer movement.

This function uses route assignments to identify affected routes, then uses RIE to restructure the selected period. It does not redefine routes as technician-owned objects.

---

## 20. Multiple Solutions — Future Capability

Version 1 may return one best solution.

The architecture should later support several viable plans, such as:

- Fastest.
- Shortest distance.
- Best workload balance.
- Least customer movement.
- No delayed visits.

Every plan must use the same constraint and explanation framework.

---

## 21. Reusable Scope Selector

The scope selector should be implemented as a reusable PMOS UI and data component, not embedded only in RIE.

Potential future consumers:

- Calendar Verification.
- Calendar Repair.
- Map Export.
- Route Reporting.
- Customer Audits.
- Technician assignment.

Normalized output example:

```javascript
{
  scopeType: 'ROUTES',
  weeks: [1, 3],
  days: ['MONDAY', 'WEDNESDAY'],
  routeIds: ['W1-MON-A', 'W3-WED-B'],
  technicianIds: [],
  includeAllRoutesWithinSelectedDays: false
}
```

---

## 22. Data Integrity and Failure Handling

RIE must distinguish between:

- Source operational data.
- Derived cache data.
- Proposed optimization data.
- Applied template data.
- Live calendar data.

Required safeguards:

- Validate all route and customer IDs before optimization.
- Do not apply partial route-template changes.
- Create snapshots before mutation.
- Report provider failures clearly.
- Allow cached fallback where safe.
- Fall back to existing straight-line logic only when explicitly indicated in the UI.
- Never present fallback output as road-based routing.
- Keep Calendar Sync separate from route optimization.

---

## 23. Proposed Module Structure

Tentative Apps Script modules:

```text
RIE_00_Config.gs
RIE_01_Provider_Interface.gs
RIE_02_Provider_GraphHopper.gs
RIE_03_Locations.gs
RIE_04_Cache.gs
RIE_05_Matrix.gs
RIE_06_Insertion.gs
RIE_07_Optimization.gs
RIE_08_Constraints.gs
RIE_09_Explanations.gs
RIE_10_History.gs
RIE_11_Scope_Selector.gs
RIE_12_UI.gs
RIE_13_Maintenance_Client.gs
RIE_14_Temporary_Visit.gs
RIE_15_Job_Definitions.gs
```

Final file names should follow the repository’s established naming conventions after the architecture audit is complete.

---

## 24. Implementation Roadmap

### Phase 0 — Confirm development environment

- Test canonical Job Engine entry point.
- Confirm development spreadsheet and calendar isolation.
- Confirm branch-to-Apps-Script deployment workflow.

### Phase 1 — Data foundations

- Define route IDs and location IDs.
- Create PMOS Locations support sheet.
- Create PMOS Route Cache support sheet.
- Add Route Intelligence settings.
- Add secure provider credential storage.

### Phase 2 — Provider and cache

- Implement provider interface.
- Implement first provider adapter.
- Add geocoding.
- Add matrix requests.
- Add persistent and memory caches.
- Add validation and retry handling.

### Phase 3 — Insertion engine

- Implement directional insertion calculations.
- Rank candidate routes.
- Return top three results.
- Add plain-language explanations.

### Phase 4 — Add Maintenance Client

- Integrate top-three placement suggestions.
- Display Route Stops above Estimated Route Length.
- Add Why panel.
- Add approved calendar update workflow.

### Phase 5 — Add Temporary Visit

- Evaluate actual dates and existing temporary visits.
- Add top-three date/position suggestions.
- Add compact route comparison.
- Add approved calendar update workflow.

### Phase 6 — Scope Selector

- Implement reusable selector.
- Support Day(s), Week(s), Route(s), Technician(s), and Entire Operation.
- Support multiple selections.

### Phase 7 — Route optimization

- Optimize within one route.
- Optimize across selected routes.
- Add side-by-side comparison.
- Add highlighting.
- Add locks on both current and optimized sides.
- Add reverse-and-refine action.
- Add Why and confidence displays.

### Phase 8 — Template apply and history

- Create pre-change snapshots.
- Apply approved changes atomically to the 4-Week Route Template.
- Add restore workflow.
- Prompt for separate Calendar Sync.

### Phase 9 — Entire-operation optimization

- Optimize across selected days and weeks.
- Support biweekly split refinement.
- Add full summary and customer-move review.
- Use resumable processing only if required by runtime or provider limits.

### Future phases

- Technician route assignments.
- Technician Absence Planner.
- Route balancing mode.
- Multiple alternative solutions.
- Google Maps provider.
- Multi-depot and per-technician start/end locations.

---

## 25. Explicitly Deferred Decisions

The following are intentionally deferred until working prototypes exist:

- Inline route comparison versus modal popup.
- Header/value layout for current, optimized, and savings summaries.
- Exact highlight styling.
- Detailed exception-management UI beyond customer locks.
- Exact route-confidence calculation.
- Multiple-solution ranking.
- Route balancing objective weights.

These are presentation or advanced-optimization decisions and do not block the foundational implementation.

---

## 26. Acceptance Criteria for the Initial RIE Release

The initial release is successful when:

1. PMOS obtains directional road time and distance through a provider adapter.
2. Coordinates and route legs are cached persistently and in memory.
3. Add Maintenance Client returns three road-based placement suggestions.
4. Add Temporary Visit returns three actual-date placement suggestions.
5. Both insertion workflows show Route Stops and Estimated Route Length with the 20-minute footnote.
6. Optimize Route(s) supports at least one route and multiple selected routes.
7. The user can compare current and optimized orders side by side.
8. The user can lock customers from either comparison side and recalculate.
9. Applied optimizations update only the 4-Week Route Template.
10. A history snapshot is created before every applied optimization.
11. The user is prompted to run Calendar Sync separately.
12. No route change is made without explicit approval.

---

## 27. Authoritative Design Statement

The Route Intelligence Engine is intended to amplify, not replace, dispatcher judgment.

Its architecture must remain:

- Explainable.
- Reversible.
- Provider-independent.
- Route-centred rather than technician-centred.
- Compatible with future staffing and operational growth.
- Strictly separated from automatic publication of broad route changes to live calendars.

This document is the approved baseline for future RIE design and implementation. Material departures should be recorded here before they are implemented.
