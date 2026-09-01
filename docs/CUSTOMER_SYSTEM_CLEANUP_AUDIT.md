# PMOS Development Cleanup Audit

## Protected baseline

- Audited branch: `pmos-development`
- Pre-cleanup commit: `6c1425c331d001822a3da950fd75c58c31b45702`
- Immutable recovery branch: `backup/pmos-development-pre-cleanup-2026-08-28`
- Production branch: `main` was not modified.
- Baseline validation: the complete repository static suite passed before cleanup.
- Live acceptance baseline: the development Acceptance Test Bot passed all 48 checks before this audit began.

The recovery branch and the cleanup starting commit have the same Git tree. No cleanup
change is allowed onto `main` until the development bot and the remaining manual
Sheets/Web/Calendar checks pass.

## Audit method

Every root Apps Script declaration, HTML client, browser endpoint, menu action, runtime
builder, installable-trigger handler, administrator API, load-time wrapper, workflow
check, and documentation path was inventoried before deletion.

A function was removed only when all of these were true:

1. It had no menu, HTML, server, trigger, test, or documented administrator caller.
2. It was not an Apps Script special entry point.
3. It was not installed or retired by trigger-handler name.
4. It did not participate in a top-level load-time wrapper.
5. A current authoritative runtime path replaced its behavior.
6. The complete baseline suite still had a preserved test path for the replacement.

Names that merely look old were not treated as dead code.

## Active runtime entry points

| User flow | Active entry point | Shared service path |
| --- | --- | --- |
| Sheets Customer Lookup | `showPmosCustomerAccountLookupRuntime` | finalized lookup HTML → lifecycle profile |
| Sheets Add Customer | `showPmosAddCustomerRuntime` | shared form → `createPmosCustomerAccountRuntime` |
| Sheets Add Maintenance | `showAddMaintenanceCustomerRuntime` | shared form → `createMaintenanceCustomerAndAutoSyncRuntime` |
| Sheets Customer Editor | `showPmosCustomerAccountEditorRuntime` | lifecycle read/save bridge |
| Sheets Add Service Location | `showPmosAddServiceLocationRuntime` | account-aware service-location transaction |
| Sheets Temporary Maintenance | `showPmosTemporaryMaintenanceRuntime` | V3 UI → `scheduleTemporaryVisitsV2` |
| Acceptance Test Bot | `showPmosAcceptanceTestBotFromMenu` | development-only fixture runner |
| Web profile/editor | Web lifecycle endpoints | the same profile/editor service layer |
| Web create flows | Web runtime endpoints | the same customer transaction layer |

## Removed in the evidence-backed pass

- Hidden Feature Lab menu, provisioning, migration, and update messaging. No flags were
  read by any runtime. Existing live sheets are left untouched rather than deleted.
- Obsolete Sheets Route Manager launcher; Route Manager is a Web operation.
- Legacy Temporary Maintenance V1/V2 launch aliases and the unused pre-V2 scheduler.
  The V3 UI and `scheduleTemporaryVisitsV2` remain active.
- Old standalone Calendar Audit window and unused Job Center alias. Current
  Sheets/Web Operations use the reviewed Job Center endpoints.
- Old Customer Lookup and Service Location search/manager launch aliases.
- Unused Rolodex prototype module.
- Legacy embedded Add Customer dialog replaced by the shared Sheets/Web form.
- Unused public/private contact, note, equipment-label, and link-annotation helpers.
- Legacy Acceptance Bot alias; the menu-specific entry point remains authoritative.

## Deliberately retained

The following modules still provide active runtime composition, persistence repairs,
terminology normalization, browser adapters, or Google Contact link integrity:

- `24-T_Customer_Form_Enhancements.gs`
- `24-U_Customer_Form_Enhancement_Fixes.gs`
- `24-V_Customer_Form_Runtime_Integration.gs`
- `24-W_Customer_Context_Notes_UI.gs`
- `24-X_Add_Maintenance_Contacts.gs`
- `24-Y_Customer_Equipment_Presentation.gs`
- `24-ZZ_Web_Customer_Lifecycle_Aliases.gs` through
  `24-ZZZZZZZ_Legacy_Account_Contact_Bridge.gs`

Installable-trigger workers and trigger-retirement handlers are retained even where a
plain text call graph cannot find a caller. The manual
`setPmosWebAppDeploymentId_` administrator API is also retained because deployment
configuration occurs outside the ordinary UI.

## Permanent regression boundaries

- `tools/check_cleanup_contract.py` rejects the return of retired declarations and
  protects current runtime entry points, trigger workers, and compatibility modules.
- `tools/report_unused_apps_script_globals.py` now fails CI for any new unexplained
  self-only global instead of producing an advisory report.
- The Web Operations contract is now part of the GitHub static workflow.
- Existing lifecycle, equipment, navigation, formatter, Acceptance Bot, combined
  Apps Script, browser JavaScript, endpoint, and template checks remain required.

## Live regression gate

After syncing and deploying the cleanup branch:

1. Run the Acceptance Test Bot and require a complete pass.
2. Verify Sheets Lookup, Add, Edit, Add Maintenance, Add Service Location, cancel
   transitions, contacts, notes, equipment, and all three maintenance statuses.
3. Verify Web Lookup, profile, editor, responsive equipment cards, navigation, and
   Operations.
4. Run one reviewed development Calendar audit/sync and inspect actual operations.
5. Inspect one simple and one complex existing customer.
6. Confirm Google Contact ordering/link behavior with a development fixture.

Only subjective layout checks and Google-host interaction remain manual; domain
transactions and shared payloads are covered by the bot.
