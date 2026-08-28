# PMOS Automated Acceptance Testing

The **PMOS → PMOS Settings → Acceptance Test Bot** command runs a guarded integration
suite inside the development spreadsheet.

## Safety model

The runner will not start unless all of these conditions are true:

1. App Settings points to a Calendar containing `Development`, `Test`, or `Sandbox`.
2. The exact spreadsheet ID and Calendar name have been explicitly armed in the bot.
3. No earlier fixture manifest is awaiting cleanup.
4. Every row eligible for deletion has both a tracked Customer ID and the exact
   `PMOS TEST BOT <run id>` marker.

If Google temporarily returns a Spreadsheet service access or timeout error, the bot
retries the functional suite up to three times. Before each retry it searches Customers,
the Route Template, and the equipment sheet for the exact run marker and removes only
those partial fixtures. Permission, validation, and PMOS assertion errors are not retried.

The suite does not call Google Contacts, Calendar APIs, or automatic Calendar Sync. It
uses the real spreadsheet-domain customer transactions and the shared lifecycle profile
payload used by Sheets and the Web App.

## Automated coverage

- Customer creation and two-location account grouping
- Primary, Account, and Service Location contact separation
- Service-location-scoped notes
- Equipment, Shape, Volume, filter model, replacement-cartridge and actuator persistence
- `Active`, `Paused`, and `Inactive` Water Maintenance persistence
- Route Template writes for Monthly test fixtures
- Invalid contact email rejection
- Legacy categorized-note decoding
- Cleanup of every disposable fixture created by the run

Each run appends exact expected and actual values to **PMOS Acceptance Test Results**.

## Normal use

1. Confirm App Settings targets the development Calendar.
2. Open **Acceptance Test Bot** and choose **Arm This Development Sheet**.
3. Choose **Run Acceptance Tests**.
4. Open the results sheet if any assertion fails.
5. Leave **Keep fixtures for profile review** off for normal runs. When enabled, inspect
   the generated profiles and then use **Clean Up Test Fixtures**.

## Remaining manual acceptance

Automation does not decide whether the interface looks clean. Before promotion, still
check responsive card layout, the Sheets clipboard fallback, one reviewed development
Calendar synchronization, and one existing complex customer with real historical data.
