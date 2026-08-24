# PMOS Customer-System Cleanup Audit

## Scope and baseline

- Branch: `pmos-development`
- Starting audit baseline: `b61c25b14d03106ccdc1bec7ed1d6e96ed5ab235`
- Integrated current branch head before commit: `78233754c58d7d9672962b36824d70844cdf3eb2`
- Production branch: not modified
- Scope: customer accounts, service locations, customer forms, customer profile/editor lifecycle, shared equipment/notes/contact layers, route UI integration, and Temporary Maintenance compatibility
- Runtime limitation: repository checks are static; the Google Sheets development copy still requires the manual regression checklist below

## Active entry-point graph

| User flow | Active entry point | Authoritative payload/service path |
| --- | --- | --- |
| Sheets Customer Lookup | `showPmosCustomerAccountLookupRuntime` | account lookup builder → runtime HTML finalizer → customer lifecycle profile |
| Sheets Add Customer | `showPmosAddCustomerRuntime` | Add Customer builder → runtime bridge → `createPmosCustomerAccountRuntime` |
| Sheets Add Maintenance Customer | `showAddMaintenanceCustomerRuntime` | Add Maintenance builder → runtime bridge → `createMaintenanceCustomerAndAutoSyncRuntime` |
| Sheets Customer Editor | `showPmosCustomerAccountEditorRuntime` | account editor builder → runtime editor adapters → lifecycle read bridge and account-aware storage wrappers |
| Sheets Add Service Location | `showPmosAddServiceLocationRuntime` | service-location builder → `createPmosAdditionalServiceLocationRuntime` |
| Sheets Temporary Maintenance | `showPmosTemporaryMaintenanceRuntime` | V3 UI → `scheduleTemporaryVisitsV2` backend |
| Web customer profile | `getPmosWebCustomerProfile` | customer lifecycle profile |
| Web customer editor | `getPmosWebCustomerEditorData` / `savePmosWebCustomerEditorData` | customer lifecycle editor read/save |
| Web Add Customer | `createPmosCustomerAccountRuntime` | account/service-location transaction plus explicit notes/equipment persistence |
| Web Add Maintenance | `createMaintenanceCustomerAndAutoSyncRuntime` | maintenance transaction plus explicit notes/equipment persistence |
| Web Add Service Location | `createPmosWebAdditionalServiceLocation` | Web lifecycle adapter → account-aware runtime transaction plus explicit notes/equipment persistence |

## Module classification

### Active domain modules

- `24-I_Customer_Account_Service_Locations.gs`: Account ID and service-location data model.
- `24-O_Customer_Service_Location_Contacts.gs`: contacts owned by one service location.
- `24-P_Customer_Account_Contact_Addresses.gs`: optional account-holder billing address.
- `24-Q_Customer_Account_Contacts.gs`: additional account-level contacts.
- `24-R_Add_Customer.gs`: non-maintenance account/customer creation workflow.
- `24-S_Customer_Water_Maintenance_Editor.gs`: location-specific maintenance enrollment, status, and removal safety.
- `24-V_Customer_Context_Notes.gs`: authoritative contextual-note storage.
- `24-Z_Customer_Profile_Editor_Lifecycle.gs`: complete profile/editor payload contract shared by Sheets and Web.
- `24-F_Customer_Equipment_Editor_Component.gs`: shared bodies-of-water and equipment editor.
- `03-B_Route_Recommendation_UI.gs`: shared route recommendation card assets.

### Active compatibility/integration modules

- `24-J_Customer_Account_Editor_Compatibility.gs`: legacy editor entry-point compatibility.
- `24-N_Customer_Account_Terminology.gs`: legacy Household terminology cleanup and defensive HTML finalization.
- `24-T_Customer_Form_Enhancements.gs`: remaining UI and data compatibility layer.
- `24-U_Customer_Form_Enhancement_Fixes.gs`: remaining maintenance normalization and late Maintenance Notes repair.
- `24-V_Customer_Form_Runtime_Integration.gs`: deterministic Sheets entry points and explicit runtime adapters.
- `24-ZZ_Web_Customer_Lifecycle_Aliases.gs`: thin Web lifecycle adapters for service-location actions.
- `24-ZZZ_Customer_Lifecycle_Runtime_Bridge.gs`: newer Sheets lifecycle read bridge and lifecycle equipment-note hydration.
- `24-ZZZZ_Account_Contact_Primary_Link_Integrity.gs`: preserves Google People resource identity while Account Contacts are reordered.
- `24-ZZZZZ_Account_Contact_Removal_Integrity.gs`: detaches removed Account Contact links from the PMOS account without deleting the underlying Google Contact.
- `24-ZZZZZZ_Sheets_Account_Contact_Lifecycle_UI.gs`: gives the Sheets editor the ordered Account Contact lifecycle and lifecycle save endpoint.
- `24-ZZZZZZZ_Legacy_Account_Contact_Bridge.gs`: surfaces legacy linked household contacts in the Account Contacts model without mutating Google Contacts during reads.
- `24-W_Customer_Context_Notes_UI.gs`, `24-X_Add_Maintenance_Contacts.gs`, and `24-Y_Customer_Equipment_Presentation.gs`: still-active presentation/persistence wrappers that need later consolidation into their domain modules.

### Legacy UI retained only as compatibility aliases

- `showTemporaryVisitScheduler()` now delegates to V3.
- `showTemporaryVisitSchedulerV2()` now delegates to V3.
- `06-C_Temporary_Visit_UI_V2.gs` must remain because it owns the active `scheduleTemporaryVisitsV2()` backend and description builder.

## Consolidation completed in this pass

1. Categorized-note ensure/read/save functions now delegate to the context-notes storage module instead of maintaining three separate spreadsheet implementations.
2. The obsolete late override of `savePmosCustomerCategorizedNotes_` was removed.
3. The customer lifecycle profile script is composed explicitly by the profile enhancement builder; the lifecycle module no longer monkey-patches that builder at Apps Script load time.
4. Web profile and create flows now call the explicit lifecycle/runtime endpoints instead of older base handlers.
5. The newer upstream Sheets lifecycle bridge, Web lifecycle adapters, and Google Contact link-integrity layer were incorporated without being overwritten by this cleanup.
6. Temporary Maintenance manual-placement behavior now lives with the V3 UI instead of being appended by both `24-U` and the runtime wrapper.
7. Duplicate legacy and V2 Temporary Maintenance UI bodies were replaced with compatibility aliases; scheduling code was preserved.

## Remaining consolidation candidates

These are not safe to remove until the development spreadsheet passes the relevant manual tests.

1. Fold the remaining `24-T` account/profile/editor backend wrappers into `24-I`, `24-L`, `24-R`, and `24-S`.
2. Move the remaining maintenance request normalization from `24-U` into the authoritative Add Maintenance transaction normalizer.
3. Fold the late Maintenance Notes UI repair from `24-U` into the shared form/notes component.
4. Consolidate `24-W` contextual-note form wrappers into the lifecycle and form builders.
5. Consolidate `24-X` maintenance contact wrappers into account-contact and location-contact modules.
6. Fold `24-Y` equipment hydration and readable labels into `24-F` and profile rendering.
7. Remove `24-N` defensive runtime finalization only after every active entry point directly renders finalized HTML.
8. Evaluate `24-J` only after both legacy editor entry points and all generated `google.script.run` calls have been manually verified.
9. Fold `24-ZZ` through `24-ZZZZZZZ` into the authoritative Web/lifecycle/contact modules after their newest runtime behavior is manually verified.
10. Keep Feature Lab infrastructure unless a separate audit confirms it is intentionally abandoned; it is hidden from the menu but not proven dead.

## Manual regression gate

Run in the Google Sheets development copy before considering the compatibility layers removable:

1. Customer Lookup, account search, service-location switching, profile names, contacts, billing address, categorized notes, and equipment display.
2. Add Customer with additional Account Contact, billing address, location contact, multiple bodies, Solar, equipment notes, and General/Opening/Closing notes.
3. Add Maintenance Customer with route recommendations, manual placement, contacts, equipment, and Calendar scoped sync.
4. Add Service Location with Water Maintenance both off and on.
5. Customer Editor save with account contacts, location contacts, billing address, equipment, and notes.
6. Water Maintenance OFF → confirm → ON before Save; OFF → confirm → Cancel; OFF → confirm → Save.
7. Existing non-maintenance location → Water Maintenance ON → placement → Save.
8. Active, Paused, and Inactive maintenance states.
9. Temporary Maintenance recommended placement, Select manually, multiple visits, and Calendar event creation.
10. Google Contacts address behavior for primary account holder, account contacts, and location-specific contacts.

No promotion to `main` should occur until this manual gate passes.
