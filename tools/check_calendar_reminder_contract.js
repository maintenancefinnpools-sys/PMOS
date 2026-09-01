#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('04-E_Calendar_Recurring_Helpers.gs', 'utf8');
const context = {
  normalize_: value => String(value || '').trim().toLowerCase(),
  console,
};
vm.createContext(context);
vm.runInContext(source, context, {filename: '04-E_Calendar_Recurring_Helpers.gs'});

function fakeSeries(options = {}) {
  const state = {
    popup: (options.popup || []).slice(),
    email: (options.email || []).slice(),
    sms: (options.sms || []).slice(),
    tags: Object.assign({}, options.tags || {}),
    removed: 0,
    reset: 0,
  };
  return {
    state,
    getTag: key => state.tags[key] || '',
    setTag: (key, value) => { state.tags[key] = value; },
    deleteTag: key => { delete state.tags[key]; },
    getPopupReminders: () => state.popup.slice(),
    getEmailReminders: () => state.email.slice(),
    getSmsReminders: () => state.sms.slice(),
    removeAllReminders: () => {
      state.removed += 1;
      state.popup = [];
      state.email = [];
      state.sms = [];
    },
    addPopupReminder: minutes => { state.popup.push(minutes); },
    resetRemindersToDefault: () => { state.reset += 1; },
  };
}

assert.strictEqual(
  context.pmosRecurringReminderPolicySignature_({frequency: 'Monthly'}),
  'MONTHLY_POPUP_48H_24H_V1'
);
assert.strictEqual(context.pmosRecurringReminderPolicySignature_({frequency: 'Weekly'}), '');
assert.strictEqual(
  context.pmosRecurringReminderPolicySignature_({row: {frequency: 'Monthly'}}),
  'MONTHLY_POPUP_48H_24H_V1'
);

const monthly = fakeSeries({popup: [30], email: [60]});
context.applyPmosRecurringReminderPolicy_(monthly, {frequency: 'Monthly'});
assert.deepStrictEqual(monthly.state.popup.sort((a, b) => a - b), [1440, 2880]);
assert.deepStrictEqual(monthly.state.email, []);
assert.deepStrictEqual(monthly.state.sms, []);
assert.strictEqual(monthly.state.removed, 1);
assert.strictEqual(monthly.state.tags.PMOS_REMINDER_POLICY, 'MONTHLY_POPUP_48H_24H_V1');
assert.strictEqual(context.verifyPmosRecurringReminderPolicy_(monthly, {frequency: 'Monthly'}), true);

const alreadyCorrect = fakeSeries({
  popup: [2880, 1440],
  tags: {PMOS_REMINDER_POLICY: 'MONTHLY_POPUP_48H_24H_V1'},
});
context.applyPmosRecurringReminderPolicy_(alreadyCorrect, {frequency: 'Monthly'});
assert.strictEqual(alreadyCorrect.state.removed, 0);

const weekly = fakeSeries({
  popup: [1440, 2880],
  tags: {PMOS_REMINDER_POLICY: 'MONTHLY_POPUP_48H_24H_V1'},
});
context.applyPmosRecurringReminderPolicy_(weekly, {frequency: 'Weekly'});
assert.strictEqual(weekly.state.reset, 1);
assert.strictEqual(weekly.state.tags.PMOS_REMINDER_POLICY, undefined);
assert.strictEqual(context.verifyPmosRecurringReminderPolicy_(weekly, {frequency: 'Weekly'}), true);

const untouchedWeekly = fakeSeries({popup: [90]});
context.applyPmosRecurringReminderPolicy_(untouchedWeekly, {frequency: 'Weekly'});
assert.strictEqual(untouchedWeekly.state.reset, 0);
assert.deepStrictEqual(untouchedWeekly.state.popup, [90]);

assert(source.includes('applyPmosRecurringReminderPolicy_(series, plan);'));
assert(source.includes('reminderPolicy:pmosRecurringReminderPolicySignature_(plan)'));
const executorSource = fs.readFileSync('23_B_Reviewed_Calendar_Sync_Executor.gs', 'utf8');
assert(executorSource.includes('verifyPmosRecurringReminderPolicy_(series, desired || {})'));
console.log('Calendar reminder contract passed.');
