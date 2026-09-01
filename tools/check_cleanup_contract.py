#!/usr/bin/env python3
"""Protect the evidence-backed PMOS cleanup boundary.

The removed names below were proven unreachable from menus, browser endpoints,
runtime builders, triggers, and documented administrator entry points. The
retained names/files are intentionally protected because Apps Script load-time
wrappers and installable triggers are not visible to a simple call graph.
"""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
GS_TEXT = "\n".join(
    path.read_text(encoding="utf-8") for path in sorted(ROOT.glob("*.gs"))
)

REMOVED_FUNCTIONS = {
    "showFeatureLab",
    "ensureFeatureLabSheet_",
    "setFeatureLabStatus",
    "showRouteManagerLink",
    "showTemporaryVisitScheduler",
    "showTemporaryVisitSchedulerV2",
    "scheduleTemporaryVisits",
    "scheduleTemporaryVisits_",
    "buildTemporaryVisitDescription_",
    "openPmosCalendarAuditInJobCenter",
    "updatePmosWebServiceLocationName_",
    "showFreshCalendarAuditTaskWindow",
    "showCustomerLookup",
    "showPmosServiceLocationSearch",
    "showPmosServiceLocationManager",
    "applyPmosAccountContactInput_",
    "getPmosAccountContacts",
    "showPmosAddCustomerLegacy_",
    "savePmosCustomerContextNotes",
    "pmosEquipmentDisplayLabel_",
    "pmosAnnotateAccountContactPrimaryLink_",
    "showPmosAcceptanceTestBot",
}

RETAINED_ENTRY_POINTS = {
    "showPmosCustomerAccountLookupRuntime",
    "showPmosAddCustomerRuntime",
    "showAddMaintenanceCustomerRuntime",
    "showPmosCustomerAccountEditorRuntime",
    "showPmosAddServiceLocationRuntime",
    "showPmosTemporaryMaintenanceRuntime",
    "scheduleTemporaryVisitsV2",
    "showPmosAcceptanceTestBotFromMenu",
    "setPmosWebAppDeploymentId_",
}

RETAINED_TRIGGER_HANDLERS = {
    "runAddedMaintenanceCustomerCalendarSyncWorker_",
    "runPmosWaterMaintenanceRemovalSyncWorker_",
    "runReviewedCalendarSyncWorker_",
}

RETAINED_LOAD_TIME_MODULES = {
    "24-T_Customer_Form_Enhancements.gs",
    "24-U_Customer_Form_Enhancement_Fixes.gs",
    "24-V_Customer_Form_Runtime_Integration.gs",
    "24-W_Customer_Context_Notes_UI.gs",
    "24-X_Add_Maintenance_Contacts.gs",
    "24-Y_Customer_Equipment_Presentation.gs",
    "24-ZZ_Web_Customer_Lifecycle_Aliases.gs",
    "24-ZZZ_Customer_Lifecycle_Runtime_Bridge.gs",
    "24-ZZZZ_Account_Contact_Primary_Link_Integrity.gs",
    "24-ZZZZZ_Account_Contact_Removal_Integrity.gs",
    "24-ZZZZZZ_Sheets_Account_Contact_Lifecycle_UI.gs",
    "24-ZZZZZZZ_Legacy_Account_Contact_Bridge.gs",
}


def declared(name: str) -> bool:
    return bool(re.search(r"\bfunction\s+" + re.escape(name) + r"\s*\(", GS_TEXT))


def main() -> int:
    failures = []

    for name in sorted(REMOVED_FUNCTIONS):
        if declared(name):
            failures.append(f"removed legacy function returned: {name}")

    if (ROOT / "24-B_Pmos_Rolodex_Component.gs").exists():
        failures.append("removed Rolodex prototype file returned")

    primary_integrity = (ROOT / "24-ZZZZ_Account_Contact_Primary_Link_Integrity.gs").read_text(encoding="utf-8")
    removal_integrity = (ROOT / "24-ZZZZZ_Account_Contact_Removal_Integrity.gs").read_text(encoding="utf-8")
    lifecycle_integrity = primary_integrity + "\n" + removal_integrity
    if re.search(r"savePmosCustomerLifecycleEditorData\s*=\s*function", lifecycle_integrity):
        failures.append("account-contact integrity module replaced the canonical lifecycle save")
    if re.search(r"pmosCollectAccountContacts\s*=\s*function", lifecycle_integrity):
        failures.append("account-contact integrity module replaced the canonical contact collector")

    for name in sorted(RETAINED_ENTRY_POINTS | RETAINED_TRIGGER_HANDLERS):
        if not declared(name):
            failures.append(f"required runtime boundary is missing: {name}")

    for filename in sorted(RETAINED_LOAD_TIME_MODULES):
        path = ROOT / filename
        if not path.exists():
            failures.append(f"required load-time module is missing: {filename}")

    if failures:
        print("\n".join(failures))
        return 1

    print(
        f"protected {len(RETAINED_ENTRY_POINTS)} entry points, "
        f"{len(RETAINED_TRIGGER_HANDLERS)} trigger handlers, and "
        f"{len(RETAINED_LOAD_TIME_MODULES)} load-time modules; "
        f"{len(REMOVED_FUNCTIONS)} retired functions remain absent"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
