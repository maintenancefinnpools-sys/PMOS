#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const server = read('12-A_Web_Operations.gs');
const client = read('Web_Pmos_Operations.html');
const repair = read('Web_Calendar_Repair.html');
const tasks = read('07-B_Job_Task_Windows.gs');

const expected = [
  'CALENDAR_STATUS',
  'VERIFY_CALENDAR',
  'CALENDAR_AUDIT',
  'CALENDAR_SYNC',
  'CUSTOMER_SYNC',
  'MAP_EXPORT',
  'CALENDAR_REPAIR'
];

const failures = [];
function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) failures.push(message);
}

expected.forEach(type => {
  requireMatch(client, new RegExp("type:'" + type + "'"), 'Client menu is missing ' + type);
  requireMatch(server, new RegExp("type:'" + type + "'"), 'Server bootstrap is missing ' + type);
});

['CALENDAR_STATUS', 'VERIFY_CALENDAR', 'CUSTOMER_SYNC', 'MAP_EXPORT'].forEach(type => {
  requireMatch(tasks, new RegExp("case\\s+'" + type + "'"), 'Task engine is missing ' + type);
});

[
  'getPmosWebOperationsBootstrap',
  'runPmosWebOperationTask',
  'getPmosWebCalendarReviewState',
  'runFreshPmosWebCalendarAudit',
  'savePmosWebCalendarReviewStep',
  'getPmosWebCalendarSyncStatus',
  'startPmosWebCalendarSync',
  'resumePmosWebCalendarSync',
  'retryPmosWebCalendarSync',
  'pausePmosWebCalendarSync',
  'getPmosWebJobHistory',
  'getPmosWebCalendarRecoverySummary'
].forEach(name => {
  requireMatch(server, new RegExp('function\\s+' + name + '\\s*\\('), 'Server endpoint is missing ' + name);
  requireMatch(client, new RegExp("(?:call\\('" + name + "'|['\"]" + name + "['\"])") , 'Client does not reference ' + name);
});

requireMatch(
  server,
  /syncStatus:\s*unwrapPmosWebOperationEndpoint_\(getReviewedCalendarSyncJobCenterStatus\(\)\)/,
  'Bootstrap Calendar Sync status is not unwrapped for the Web App'
);
['get', 'start', 'resume', 'retry', 'pause'].forEach(action => {
  const name = action + 'PmosWebCalendarSync';
  requireMatch(
    server,
    new RegExp('function\\s+' + name + '[\\s\\S]*?unwrapPmosWebOperationEndpoint_\\('),
    name + ' does not return an unwrapped status object'
  );
});
requireMatch(server, /response\.ok\s*===\s*false[\s\S]*?throw new Error/, 'Web endpoint errors are not propagated');
requireMatch(server, /readPmosCalendarAuditSnapshot_\(\)/, 'Opening Calendar Audit does not use the saved snapshot');
requireMatch(server, /reviewState:\s*buildPmosWebCalendarReviewState_\(result\)/, 'Fresh audit does not return its review state');
requireMatch(server, /auditOptions:\s*\{[\s\S]*?calendarName:/, 'Fresh audit does not return its selected Calendar');
if (/result:\s*clonePmosWebValue_\(result/.test(server)) {
  failures.push('Fresh audit still returns the oversized planner graph');
}
requireMatch(client, /state\.auditOptions=Object\.assign\(\{\},state\.auditOptions,options\)/, 'Client does not retain submitted audit options');
requireMatch(client, /Audit results — /, 'Client does not render a persistent audit-results summary');
requireMatch(repair, /data-cr-open=['"]repair['"]|dataset\.crOpen=['"]repair['"]/, 'Calendar Repair launch control is missing');
requireMatch(repair, /data-cr-recovery|dataset\.crRecovery/, 'Transaction Recovery launch control is missing');

if (failures.length) {
  console.error('Web Operations contract failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('Web Operations contract passed for all 7 menu operations.');
