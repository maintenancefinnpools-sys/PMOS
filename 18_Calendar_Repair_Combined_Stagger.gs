/**
 * Authoritative Calendar Repair executor.
 *
 * Repair combines surviving PMOS/route events and reviewed repair items into
 * one ordered day, applies the repair semi-stagger from 6:00 AM, and
 * checkpoints at day boundaries so large repair ranges can resume safely.
 */

function repairCalendarDayBounds_(dateText) {
  const start = parseRepairDate_(dateText, 'Repair date');
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {start:start, end:end};
}

function repairCalendarManagedDayEvents_(calendar, dateText) {
  const bounds = repairCalendarDayBounds_(dateText);
  const identities = repairRouteIdentityPool_();
  return calendar.getEvents(bounds.start, bounds.end)
    .filter(function(event) { return !event.isAllDayEvent(); })
    .filter(function(event) {
      return isPmosManagedCalendarEvent_(event) ||
        repairEventMatchesRoute_(event, identities);
    })
    .sort(function(a, b) {
      return a.getStartTime().getTime() - b.getStartTime().getTime();
    });
}

function repairCalendarCombinedSequence_(existingEvents, repairItems) {
  const sequence = existingEvents.map(function(event) {
    return {kind:'existing', event:event};
  });

  repairItems.slice()
    .sort(function(a, b) {
      return Number(a.order || 1) - Number(b.order || 1);
    })
    .forEach(function(item) {
      const requestedIndex = Math.max(0, Number(item.order || 1) - 1);
      const insertIndex = Math.min(requestedIndex, sequence.length);
      sequence.splice(insertIndex, 0, {kind:'repair', item:item});
    });

  return sequence;
}

function repairCalendarEventAlreadyRepresentsItem_(event, item) {
  const description = String(event.getDescription() || '');
  if (
    item.customerId &&
    description.indexOf('PMOS_CUSTOMER_ID=' + item.customerId) >= 0
  ) {
    return true;
  }
  return normalize_(event.getTitle()) === normalize_(item.title);
}

/** Preserve normal alternating route intervals while anchoring Repair at 6 AM. */
function repairCalendarSixAmTimeForOrder_(visitDate, order, settings) {
  const normalFirst = routeTimeForOrder_(visitDate, 1, settings);
  const normalTarget = routeTimeForOrder_(visitDate, order, settings);
  const sixAm = new Date(visitDate);
  sixAm.setHours(6, 0, 0, 0);
  return new Date(
    sixAm.getTime() + (normalTarget.getTime() - normalFirst.getTime())
  );
}

function repairCalendarApplyDay_(calendar, dateText, repairItems, settings) {
  let existingEvents = repairCalendarManagedDayEvents_(calendar, dateText);
  const pendingItems = [];
  let skipped = 0;

  repairItems.forEach(function(item) {
    if (existingEvents.some(function(event) {
      return repairCalendarEventAlreadyRepresentsItem_(event, item);
    })) {
      skipped++;
    } else {
      pendingItems.push(item);
    }
  });

  const sequence = repairCalendarCombinedSequence_(existingEvents, pendingItems);
  const visitDate = parseRepairDate_(dateText, 'Repair date');
  assertCalendarMutationIsSafe_(visitDate, true);

  let created = 0;
  let repositioned = 0;
  const errors = [];

  sequence.forEach(function(entry, index) {
    const combinedOrder = index + 1;
    const targetStart = repairCalendarSixAmTimeForOrder_(
      visitDate,
      combinedOrder,
      settings
    );
    const targetEnd = new Date(
      targetStart.getTime() + settings.eventDurationMinutes * 60000
    );

    try {
      if (entry.kind === 'existing') {
        const event = entry.event;
        const startChanged =
          event.getStartTime().getTime() !== targetStart.getTime();
        const endChanged =
          event.getEndTime().getTime() !== targetEnd.getTime();
        if (startChanged || endChanged) {
          event.setTime(targetStart, targetEnd);
          repositioned++;
        }
        return;
      }

      const item = entry.item;
      const description = [
        item.description,
        '',
        'PMOS_HISTORY_REPAIR=true',
        item.customerId ? 'PMOS_CUSTOMER_ID=' + item.customerId : '',
        'PMOS_REPAIR_ORIGINAL_LAYER=' + String(item.layer || ''),
        'PMOS_REPAIR_APPLIED_DATE=' + item.date,
        'PMOS_REPAIR_STOP_ORDER=' + combinedOrder
      ].filter(Boolean).join('\n');

      const event = calendar.createEvent(
        item.title,
        targetStart,
        targetEnd,
        {description:description, location:item.address || ''}
      );
      if (item.color) event.setColor(item.color);
      created++;
      existingEvents.push(event);
    } catch (error) {
      const label = entry.kind === 'existing'
        ? entry.event.getTitle()
        : entry.item.title;
      errors.push(dateText + ' ' + label + ': ' + String(error));
    }
  });

  return {
    created:created,
    skipped:skipped,
    repositioned:repositioned,
    errors:errors
  };
}

function applyCalendarRepairPlan(startValue, endValue) {
  const start = parseRepairDate_(startValue, 'Begin date');
  const end = parseRepairDate_(endValue, 'End date');
  if (end.getTime() < start.getTime()) {
    throw new Error('End date must be on or after begin date.');
  }

  const startText = Utilities.formatDate(start, PMOS.TIMEZONE, 'yyyy-MM-dd');
  const endText = Utilities.formatDate(end, PMOS.TIMEZONE, 'yyyy-MM-dd');
  let plan = readRepairPlan_();

  if (!plan || plan.start !== startText || plan.end !== endText) {
    plan = saveRepairPlan_(buildCalendarRepairPlan_(start, end));
  }

  const dateKeys = repairCalendarPlanDateKeys_(plan);
  savePmosRuntimeCheckpoint_(PMOS_CALENDAR_REPAIR_OPERATION, {
    dateIndex:0,
    dateKeys:dateKeys,
    created:0,
    skipped:0,
    repositioned:0,
    errors:[],
    start:startText,
    end:endText
  });
  removeCalendarRepairContinuation_();
  return runCalendarRepairContinuation();
}

function runCalendarRepairContinuation() {
  const plan = readRepairPlan_();
  if (!plan) throw new Error('No Calendar repair plan is available.');

  const context = createPmosRuntimeContext_(PMOS_CALENDAR_REPAIR_OPERATION);
  const lock = acquirePmosRuntimeLock_(context, 1000);

  try {
    const calendar = getRecurringCalendar_();
    const settings = getRecurringCalendarSettings_();
    const itemsByDate = repairCalendarItemsByDate_(plan);
    const checkpoint = readPmosRuntimeCheckpoint_(
      PMOS_CALENDAR_REPAIR_OPERATION
    ) || {
      dateIndex:0,
      dateKeys:repairCalendarPlanDateKeys_(plan),
      created:0,
      skipped:0,
      repositioned:0,
      errors:[],
      start:plan.start,
      end:plan.end
    };

    const dateKeys = Array.isArray(checkpoint.dateKeys)
      ? checkpoint.dateKeys
      : repairCalendarPlanDateKeys_(plan);

    while (
      Number(checkpoint.dateIndex || 0) < dateKeys.length &&
      !pmosRuntimeShouldYield_(context)
    ) {
      const dateText = dateKeys[Number(checkpoint.dateIndex || 0)];
      const result = repairCalendarApplyDay_(
        calendar,
        dateText,
        itemsByDate[dateText] || [],
        settings
      );

      checkpoint.created = Number(checkpoint.created || 0) + result.created;
      checkpoint.skipped = Number(checkpoint.skipped || 0) + result.skipped;
      checkpoint.repositioned =
        Number(checkpoint.repositioned || 0) + result.repositioned;
      Array.prototype.push.apply(checkpoint.errors, result.errors || []);
      checkpoint.dateIndex = Number(checkpoint.dateIndex || 0) + 1;

      savePmosRuntimeCheckpoint_(PMOS_CALENDAR_REPAIR_OPERATION, checkpoint);
      heartbeatPmosRuntimeOperation_(context);
    }

    if (Number(checkpoint.dateIndex || 0) < dateKeys.length) {
      scheduleCalendarRepairContinuation_(2000);
      releasePmosRuntimeLock_(lock, context);
      return calendarRepairCombinedStatus_(checkpoint, plan, dateKeys, 'Waiting');
    }

    removeCalendarRepairContinuation_();
    const status = checkpoint.errors.length ? 'Complete with errors' : 'Complete';
    if (!checkpoint.errors.length) {
      PropertiesService.getDocumentProperties()
        .deleteProperty(PMOS_CALENDAR_REPAIR_PLAN_KEY);
    }
    completePmosRuntimeOperation_(
      PMOS_CALENDAR_REPAIR_OPERATION,
      lock,
      context
    );
    return calendarRepairCombinedStatus_(checkpoint, plan, dateKeys, status);
  } catch (error) {
    abandonPmosRuntimeOperation_(lock, context);
    throw error;
  }
}

function repairCalendarItemsByDate_(plan) {
  const result = {};
  (plan && Array.isArray(plan.items) ? plan.items : []).forEach(function(item) {
    const date = String(item.date || '');
    if (!date) return;
    if (!result[date]) result[date] = [];
    result[date].push(item);
  });
  return result;
}

function repairCalendarPlanDateKeys_(plan) {
  return Object.keys(repairCalendarItemsByDate_(plan)).sort();
}

function calendarRepairCombinedStatus_(checkpoint, plan, dateKeys, status) {
  const totalDays = dateKeys.length;
  const processedDays = Math.min(
    totalDays,
    Number(checkpoint.dateIndex || 0)
  );
  const errors = Array.isArray(checkpoint.errors) ? checkpoint.errors : [];
  return {
    status:status,
    created:Number(checkpoint.created || 0),
    skipped:Number(checkpoint.skipped || 0),
    repositioned:Number(checkpoint.repositioned || 0),
    errors:errors.length,
    remaining:Math.max(0, totalDays - processedDays),
    summary:[
      status === 'Waiting'
        ? 'Calendar repair saved and will continue automatically.'
        : 'Calendar repair complete.',
      'Date range: ' + plan.start + ' through ' + plan.end,
      'Repair days processed: ' + processedDays + ' of ' + totalDays,
      'Visits created: ' + Number(checkpoint.created || 0),
      'Existing PMOS/route visits repositioned: ' +
        Number(checkpoint.repositioned || 0),
      'Already present and skipped: ' + Number(checkpoint.skipped || 0),
      'Errors: ' + errors.length,
      errors.length
        ? 'The repair preview was retained so failed work can be reviewed.'
        : '',
      errors.length ? 'First error: ' + errors[0] : ''
    ].filter(Boolean).join('\n')
  };
}

function scheduleCalendarRepairContinuation_(delayMs) {
  removeCalendarRepairContinuation_();
  ScriptApp.newTrigger(PMOS_CALENDAR_REPAIR_TRIGGER_HANDLER)
    .timeBased()
    .after(Math.max(1000, Number(delayMs || 0)))
    .create();
}

function removeCalendarRepairContinuation_() {
  ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return trigger.getHandlerFunction() === PMOS_CALENDAR_REPAIR_TRIGGER_HANDLER;
    })
    .forEach(function(trigger) {
      ScriptApp.deleteTrigger(trigger);
    });
}
