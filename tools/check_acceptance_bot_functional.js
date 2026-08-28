#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, '25_Acceptance_Test_Bot.gs'), 'utf8');
const properties = new Map();
const sleeps = [];
const dialogCalls = [];
let settingsCalendarName = '2 - PMOS Development Calendar';

function settingsSheet() {
  return {
    getLastRow: () => 2,
    getDataRange: () => ({
      getValues: () => [
        ['Setting', 'Value'],
        ['Calendar Name', settingsCalendarName]
      ]
    })
  };
}

const spreadsheet = {
  getId: () => 'development-spreadsheet-id',
  getName: () => 'PMOS Development',
  getSheetByName: name => name === 'App Settings' ? settingsSheet() : null,
  setActiveSheet: () => spreadsheet
};

const ui = {
  showModelessDialog: (html, title) => dialogCalls.push({html, title})
};

const context = {
  console,
  Date,
  JSON,
  Math,
  Number,
  Object,
  RegExp,
  String,
  Array,
  encodeURIComponent,
  isNaN,
  PMOS: {
    SETTINGS_SHEET: 'App Settings',
    CALENDAR_NAME: '2 - PMOS Development Calendar',
    TIMEZONE: 'America/Toronto'
  },
  HtmlService: {
    createHtmlOutputFromFile: fileName => ({
      fileName,
      width: 0,
      height: 0,
      setWidth(value) { this.width = value; return this; },
      setHeight(value) { this.height = value; return this; }
    })
  },
  SpreadsheetApp: {
    getActive: () => spreadsheet,
    getUi: () => ui,
    flush: () => {}
  },
  PropertiesService: {
    getDocumentProperties: () => ({
      getProperty: key => properties.has(key) ? properties.get(key) : null,
      setProperty: (key, value) => { properties.set(key, String(value)); },
      deleteProperty: key => { properties.delete(key); }
    })
  },
  Session: {
    getActiveUser: () => ({getEmail: () => 'acceptance@example.com'})
  },
  Utilities: {
    sleep: milliseconds => sleeps.push(milliseconds),
    getUuid: () => 'ABCDEF12-3456-7890-ABCD-EF1234567890',
    formatDate: () => '2026-08-28'
  },
  LockService: {
    getScriptLock: () => ({tryLock: () => true, releaseLock: () => {}})
  },
  ScriptApp: {
    getProjectTriggers: () => []
  }
};

vm.createContext(context);
vm.runInContext(source + `
  globalThis.__bot = {
    showPmosAcceptanceTestBot,
    showPmosAcceptanceTestBotFromMenu,
    getPmosAcceptanceTestBotState,
    armPmosAcceptanceTestBot,
    disarmPmosAcceptanceTestBot,
    runPmosAcceptanceTestBot_,
    pmosAcceptanceEnvironment_,
    pmosAcceptanceRetryTransientSpreadsheetOperation_,
    pmosAcceptanceRunCoreTestsWithSpreadsheetRetry_,
    pmosAcceptanceIsTransientSpreadsheetError_,
    pmosAcceptanceRecord_,
    pmosAcceptanceExpectError_,
    pmosAcceptanceSummarize_,
    pmosAcceptanceRemoveExistingResultRows_,
    pmosAcceptanceManifestHasValidMarker_
  };
`, context, {filename: '25_Acceptance_Test_Bot.gs'});

const bot = context.__bot;

// The exact Sheets menu entry point must build and display the expected dialog.
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(bot.showPmosAcceptanceTestBotFromMenu())),
  {opened: true}
);
assert.strictEqual(dialogCalls.length, 1);
assert.strictEqual(dialogCalls[0].title, 'PMOS Acceptance Test Bot');
assert.strictEqual(dialogCalls[0].html.fileName, 'Sheets_Acceptance_Test_Bot');
assert.strictEqual(dialogCalls[0].html.width, 760);
assert.strictEqual(dialogCalls[0].html.height, 700);

// The legacy public endpoint must remain compatible and use the same dialog path.
bot.showPmosAcceptanceTestBot();
assert.strictEqual(dialogCalls.length, 2);

// A wrong host must fail with a useful instruction instead of the raw getUi exception.
context.SpreadsheetApp.getUi = () => { throw new Error('Cannot call getUi from this context.'); };
assert.throws(
  () => bot.showPmosAcceptanceTestBotFromMenu(),
  /must be opened from PMOS.*development Google Sheet/i
);
context.SpreadsheetApp.getUi = () => ui;

// Arming is bound to the exact development spreadsheet and Calendar configuration.
const initialState = bot.getPmosAcceptanceTestBotState();
assert.strictEqual(initialState.developmentTarget, true);
assert.strictEqual(initialState.armed, false);
const armedState = bot.armPmosAcceptanceTestBot();
assert.strictEqual(armedState.armed, true);
settingsCalendarName = '1 - Water Maintenance Routes';
assert.strictEqual(bot.pmosAcceptanceEnvironment_().developmentTarget, false);
assert.throws(() => bot.armPmosAcceptanceTestBot(), /only when App Settings points/i);
settingsCalendarName = '2 - PMOS Development Calendar';
assert.strictEqual(bot.disarmPmosAcceptanceTestBot().armed, false);

assert.strictEqual(bot.pmosAcceptanceManifestHasValidMarker_({
  runId: 'ABCDEF1234',
  marker: 'PMOS TEST BOT ABCDEF1234'
}), true);
assert.strictEqual(bot.pmosAcceptanceManifestHasValidMarker_({
  runId: 'ABCDEF1234',
  marker: 'PMOS TEST BOT DIFFERENT'
}), false);

// Only the known transient Spreadsheet service failures are retried.
let transientAttempts = 0;
const recovered = bot.pmosAcceptanceRetryTransientSpreadsheetOperation_(() => {
  transientAttempts += 1;
  if (transientAttempts < 3) {
    throw new Error('Service Spreadsheets failed while accessing document with id test.');
  }
  return 'recovered';
});
assert.strictEqual(recovered, 'recovered');
assert.strictEqual(transientAttempts, 3);
assert.deepStrictEqual(sleeps.slice(-2), [1000, 2000]);

let permanentAttempts = 0;
assert.throws(() => bot.pmosAcceptanceRetryTransientSpreadsheetOperation_(() => {
  permanentAttempts += 1;
  throw new Error('Permission denied.');
}), /Permission denied/);
assert.strictEqual(permanentAttempts, 1);

// The complete core suite retries only after the marker-owned reset path runs.
let validationRuns = 0;
let resetRuns = 0;
context.pmosAcceptanceRunValidationTests_ = results => {
  validationRuns += 1;
  if (validationRuns === 1) {
    throw new Error('Service timed out: Spreadsheets');
  }
  bot.pmosAcceptanceRecord_(results, 'Validation', 'Recovered suite', true, true);
};
context.pmosAcceptanceRunAccountTests_ = () => {};
context.pmosAcceptanceRunMaintenanceStatusTests_ = () => {};
context.pmosAcceptanceResetFixturesForRetry_ = () => { resetRuns += 1; };
const retriedResults = [];
bot.pmosAcceptanceRunCoreTestsWithSpreadsheetRetry_(retriedResults, {customerIds: []});
assert.strictEqual(validationRuns, 2);
assert.strictEqual(resetRuns, 1);
assert.strictEqual(retriedResults.some(row => row.test === 'Recovered suite' && row.result === 'PASS'), true);

// Result comparisons, expected errors, summaries, and idempotent row replacement work.
const results = [];
assert.strictEqual(bot.pmosAcceptanceRecord_(results, 'Area', 'Equal', 2, 2), true);
bot.pmosAcceptanceExpectError_(results, 'Area', 'Expected error', /invalid/i, () => {
  throw new Error('Invalid value');
});
const summary = bot.pmosAcceptanceSummarize_(
  'RUN1',
  new Date('2026-08-28T10:00:00Z'),
  new Date('2026-08-28T10:00:05Z'),
  results,
  {customerIds: []},
  {cleaned: true},
  false
);
assert.strictEqual(summary.status, 'PASSED');
assert.strictEqual(summary.passed, 2);
assert.strictEqual(summary.durationSeconds, 5);

const resultRows = [['Run ID'], ['RUN1'], ['OTHER'], ['RUN1']];
const resultSheet = {
  getLastRow: () => resultRows.length,
  getRange: (row, column, rowCount) => ({
    getValues: () => resultRows.slice(row - 1, row - 1 + rowCount).map(item => [item[0]])
  }),
  deleteRow: row => { resultRows.splice(row - 1, 1); }
};
bot.pmosAcceptanceRemoveExistingResultRows_(resultSheet, 'RUN1');
assert.deepStrictEqual(resultRows, [['Run ID'], ['OTHER']]);

// A complete runner lifecycle records safety, executes checks, cleans fixtures,
// writes one summary, stores the last run, and clears the completed manifest.
let writtenRun = null;
context.pmosAcceptanceRequireSafeEnvironment_ = () => ({
  spreadsheetId: 'development-spreadsheet-id',
  spreadsheetName: 'PMOS Development',
  calendarName: '2 - PMOS Development Calendar',
  developmentTarget: true,
  armed: true
});
context.pmosAcceptanceTriggerHandlers_ = () => [];
context.pmosAcceptanceRunCoreTestsWithSpreadsheetRetry_ = lifecycleResults => {
  bot.pmosAcceptanceRecord_(lifecycleResults, 'Lifecycle', 'Core checks executed', true, true);
};
context.pmosAcceptanceDiscoverMarkedCustomerIds_ = () => {};
context.pmosAcceptanceCleanupManifest_ = manifest => ({
  cleaned: true,
  removedCustomerIds: manifest.customerIds.slice(),
  skippedCustomerIds: []
});
context.pmosAcceptanceWriteResults_ = (runSummary, runResults) => {
  writtenRun = {summary: runSummary, results: runResults.slice()};
};
const lifecycleSummary = bot.runPmosAcceptanceTestBot_({keepFixtures: false});
assert.strictEqual(lifecycleSummary.status, 'PASSED');
assert.strictEqual(lifecycleSummary.fixturesRetained, false);
assert.strictEqual(writtenRun.summary.runId, lifecycleSummary.runId);
assert.strictEqual(writtenRun.results.some(row => row.test === 'Core checks executed'), true);
assert.strictEqual(properties.has('PMOS_ACCEPTANCE_TEST_FIXTURES_V1'), false);
assert.strictEqual(properties.has('PMOS_ACCEPTANCE_TEST_LAST_RUN_V1'), true);

console.log('PMOS Acceptance Test Bot functional checks passed.');
