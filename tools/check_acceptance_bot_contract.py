#!/usr/bin/env python3
"""Static safety and wiring assertions for the PMOS development acceptance bot."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERVER = (ROOT / "25_Acceptance_Test_Bot.gs").read_text(encoding="utf-8")
CLIENT = (ROOT / "Sheets_Acceptance_Test_Bot.html").read_text(encoding="utf-8")
MENU = (ROOT / "01_Menu.gs").read_text(encoding="utf-8")


def require(text: str, needle: str, message: str) -> None:
    if needle not in text:
        raise SystemExit(message)


require(MENU, "Acceptance Test Bot", "PMOS menu does not expose the Acceptance Test Bot.")
require(MENU, "showPmosAcceptanceTestBot", "PMOS menu is not wired to the Acceptance Test Bot endpoint.")
require(SERVER, "PMOS Acceptance Test Results", "Acceptance results sheet is missing.")
require(SERVER, "PMOS TEST BOT", "Disposable fixture marker is missing.")
require(SERVER, "PMOS_ACCEPTANCE_TEST_ARMED_V1", "Per-spreadsheet arming guard is missing.")
require(SERVER, "Development, Test, or Sandbox", "Development target guard is missing.")
require(SERVER, "'water maintenance routes': true", "Production Calendar name guard is missing.")
require(SERVER, "'1 - water maintenance routes': true", "Numbered production Calendar name guard is missing.")
require(SERVER, "manifest.marker", "Cleanup does not verify the fixture manifest marker.")
require(SERVER, "pmosAcceptanceDiscoverMarkedCustomerIds_", "Partial-run fixture discovery is missing.")
require(SERVER, "PMOS_ACCEPTANCE_SPREADSHEET_RETRY_ATTEMPTS_ = 3", "Transient Spreadsheet failures are not retried.")
require(SERVER, "pmosAcceptanceResetFixturesForRetry_", "Spreadsheet retry does not reset partial fixtures safely.")
require(SERVER, "pmosAcceptanceIsTransientSpreadsheetError_", "Spreadsheet retry is not restricted to transient service failures.")
require(SERVER, "getScriptLock", "Concurrent acceptance-bot runs are not blocked.")
require(SERVER, "createPmosNonMaintenanceAccountServiceLocation_", "Real account transaction coverage is missing.")
require(SERVER, "createMaintenanceCustomer(", "Real maintenance transaction coverage is missing.")
require(SERVER, "nextMaintenanceStopForLayer_", "Test route rows are not constrained to append-only placement.")
require(SERVER, "['Active', 'Paused', 'Inactive']", "All Water Maintenance statuses are not covered.")
require(SERVER, "getPmosCustomerLifecycleProfile", "Shared Sheets/Web profile payload is not covered.")
require(SERVER, "normalizePmosAccountContacts_", "Account Contact validation coverage is missing.")
require(SERVER, "normalizePmosServiceLocationContacts_", "Service Location Contact validation coverage is missing.")
require(CLIENT, "keepFixtures", "Fixture-retention review option is missing from the bot UI.")
require(CLIENT, "Clean Up Test Fixtures", "Explicit cleanup control is missing from the bot UI.")
require(CLIENT, "google.script.host.close()", "Opening results does not reveal the activated Sheet behind the bot dialog.")
require(SERVER, "sheet.getRange('A1').activate()", "Results navigation does not activate a visible cell.")
require(SERVER, "const routeState = getPmosWaterMaintenanceRouteState_(created.customerId);", "Maintenance Route Template assertions do not read the dedicated route state.")

for forbidden in ("CalendarApp.", "People.People", "createMaintenanceCustomerAndAutoSync"):
    if forbidden in SERVER:
        raise SystemExit(f"Acceptance bot must not invoke external mutation path: {forbidden}")

for conflicting_mutable in ("let cleanup =", "let sheet =", "let pass ="):
    if conflicting_mutable in SERVER:
        raise SystemExit(
            "Acceptance bot reintroduced an Apps Script constant-reassignment diagnostic: "
            + conflicting_mutable
        )

print("validated PMOS Acceptance Test Bot wiring and safety contract")
