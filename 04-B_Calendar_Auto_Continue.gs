/**
 * Legacy Calendar Auto-Continue retirement shim.
 *
 * Calendar Sync is now executed only from the reviewed durable queue in 23_B.
 * This handler remains temporarily so an installable trigger created by an
 * older PMOS build can fire once, clean itself up, and never mutate Calendar.
 */
function runCalendarAutoContinueTrigger() {
  retireLegacyCalendarAutoContinue_();
}

function retireLegacyCalendarAutoContinue_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'runCalendarAutoContinueTrigger') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  PropertiesService.getDocumentProperties()
    .deleteProperty('PMOS_CALENDAR_AUTO_JOB');
}
