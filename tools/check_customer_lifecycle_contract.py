#!/usr/bin/env python3
"""Static regression contract for PMOS customer/account/service-location workflows."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def require(text: str, needle: str, label: str, failures: list[str]) -> None:
    if needle not in text:
        failures.append(f"missing {label}: {needle}")


def forbid(text: str, needle: str, label: str, failures: list[str]) -> None:
    if needle in text:
        failures.append(f"unexpected {label}: {needle}")


def ordered(text: str, needles: list[str], label: str, failures: list[str]) -> None:
    positions = [text.find(needle) for needle in needles]
    if any(position < 0 for position in positions) or positions != sorted(positions):
        failures.append(f"incorrect {label}: {' -> '.join(needles)}")


def main() -> None:
    failures: list[str] = []
    index = read("Index.html")
    add = read("Web_Add_Customer.html")
    maintenance = read("Web_Add_Maintenance.html")
    editor = read("Web_Customer_Edit.html")
    location = read("Web_Add_Service_Location.html")
    profile = read("Web_Customers.html")
    account_contacts = read("24-Q_Customer_Account_Contacts.gs")
    location_contacts = read("24-O_Customer_Service_Location_Contacts.gs")
    billing = read("24-P_Customer_Account_Contact_Addresses.gs")
    equipment = read("24-T_Customer_Form_Enhancements.gs")
    equipment_fixes = read("24-U_Customer_Form_Enhancement_Fixes.gs")
    maintenance_contacts = read("24-X_Add_Maintenance_Contacts.gs")
    account_model = read("24-I_Customer_Account_Service_Locations.gs")
    account_editor = read("24-L_Customer_Profile_Account_Integration.gs")
    water = read("24-S_Customer_Water_Maintenance_Editor.gs")
    notes_bridge = read("24-W_Customer_Context_Notes_UI.gs")

    ordered(index, ["Customer Look-Up", "Add Customer", "Add Maintenance Client"], "Customers menu order", failures)
    ordered(index, ["Temporary Maintenance", "Service Call", "Opening / Closing"], "Scheduling menu order", failures)
    require(index, "pmosRouteRecommendationCardStyles_()", "shared route-card styles", failures)
    require(index, "pmosRouteRecommendationCardScript_()", "shared route-card script", failures)

    require(add, "Customer Contact Info", "combined customer-contact card", failures)
    forbid(add, "Customer Identity", "separate Customer Identity card", failures)
    require(add, "last+' Residence'", "Last Name Residence default", failures)
    require(add, "formatName($('acLastName'))", "last-name capitalization", failures)
    require(add, "formatName($('acFirstName'))", "first-name capitalization", failures)
    require(add, "formatPhone($('acPhone'))", "primary-phone formatting", failures)
    require(add, "+ Add Account Contact", "Add Account Contact control", failures)
    require(add, "+ Add Service Location Contact", "Add Service Location Contact control", failures)
    require(add, "+ Add Body of Water", "Add Body of Water wording", failures)
    forbid(add, "Add Another Body of Water", "old body button wording", failures)
    require(add, "textContent='Creating…'", "Create Customer working state", failures)
    require(add, "createPmosCustomerAccountRuntime", "account-aware create endpoint", failures)
    require(add, "inlineHostId:'acAdditionalLocationHost'", "inline Add Customer location editor", failures)
    for label in ("Entry Information", "General Notes", "Opening Notes", "Closing Notes"):
        require(add, label, f"Add Customer {label}", failures)

    require(maintenance, "amMaintenanceNotes", "maintenance-form Maintenance Notes", failures)
    require(maintenance, "amAccountContacts", "maintenance Account Contacts", failures)
    require(maintenance, "amLocationContacts", "maintenance Service Location Contacts", failures)
    require(maintenance, "amBillingHost", "maintenance account billing address", failures)
    require(maintenance, "pmosCollectAccountContacts('amAccountContacts')", "maintenance Account Contact payload", failures)
    require(maintenance, "pmosCollectLocationContacts('amLocationContacts')", "maintenance Service Location Contact payload", failures)
    require(maintenance, "am-hidden", "hidden manual placement", failures)
    require(maintenance, "Hide Manual Placement", "manual placement toggle state", failures)
    require(maintenance, "inlineHostId:'amAdditionalLocationHost'", "inline maintenance location editor", failures)
    require(maintenance, "Creating the maintenance client", "maintenance create working state", failures)

    require(editor, "ce-toggle-track", "sliding Water Maintenance toggle", failures)
    require(editor, "maintenanceRemovalConfirmed", "pending maintenance-removal confirmation", failures)
    require(editor, "Saving…", "editor save working state", failures)
    require(editor, "inlineHostId:'ceAdditionalLocationHost'", "inline editor location form", failures)
    require(editor, "<label class=\"ce-full\">Maintenance Notes<textarea id=\"ceMaintenanceNotes\"", "Maintenance Notes in maintenance section", failures)
    for form in (maintenance, editor, location):
        require(form, "pmosRouteRecommendationHtml", "shared detailed route cards", failures)

    require(location, "sl-toggle-track", "added-location sliding maintenance toggle", failures)
    require(location, "slMaintenanceNotesWrap", "conditional added-location Maintenance Notes", failures)
    require(location, "if(id&&!wasInline)", "nested location stays in parent editor", failures)
    require(profile, "inlineHostId:'customerInlineLocationHost'", "inline profile location form", failures)

    require(account_contacts, "Last name</label><input data-account-contact=\"lastName\"", "Account Contact last-name-first layout", failures)
    require(location_contacts, "Last name</label><input data-location-contact=\"lastName\"", "Service Location Contact last-name-first layout", failures)
    require(account_contacts, "formatPmosPhoneInput", "Account Contact phone formatting", failures)
    require(location_contacts, "formatPmosPhoneInput", "Service Location Contact phone formatting", failures)
    require(location_contacts, "Service Location Contacts JSON", "location-contact storage", failures)
    require(location_contacts, "getPmosServiceLocationContactIdentity_", "location-specific Google Contact identity", failures)
    require(location_contacts, "addresses: identity.address", "location-specific Google Contact address", failures)

    require(billing, "+ Add account holder billing address", "optional billing-address control", failures)
    require(billing, "Use primary service location instead", "billing-address reset", failures)
    require(account_model, "Account ID", "account/service-location grouping", failures)
    require(account_model, "Primary Service Location", "primary-location identity", failures)

    require(equipment, "Solar heating equipment", "Solar equipment UI", failures)
    require(equipment, "data-body-equipment-notes", "body-specific Equipment Notes", failures)
    require(equipment_fixes, "clean.equipmentNotes", "Equipment Notes normalization", failures)
    require(equipment_fixes, "solarEquipment", "Solar normalization", failures)

    ordered(account_editor, ["const account = getPmosCustomerAccount_(customerId);", "const data = getPmosCustomerEditorData(customerId);"], "editor-token initialization order", failures)
    require(water, "maintenanceRemovalConfirmed !== true", "backend removal guard", failures)
    require(water, "removePmosWaterMaintenanceRouteRows_", "scoped maintenance-route removal", failures)
    require(water, "schedulePmosWaterMaintenanceRemovalCalendarSync_", "scoped maintenance Calendar cleanup", failures)
    require(notes_bridge, "scope.matches('#view-addcustomer,#view-addmaintenance,#ceBackdrop,#slBackdrop')", "no duplicate Web note injection", failures)
    require(maintenance_contacts, "data-pmos-native-maint-contacts", "no duplicate maintenance contact injection", failures)
    require(maintenance_contacts, "savePmosAccountBillingAddress_", "maintenance billing persistence", failures)

    if failures:
        print("PMOS customer lifecycle contract failed:")
        for failure in failures:
            print(" -", failure)
        raise SystemExit(1)
    print("PMOS customer lifecycle contract clean: customer, account, service-location, notes, equipment, and maintenance safeguards present.")


if __name__ == "__main__":
    main()
