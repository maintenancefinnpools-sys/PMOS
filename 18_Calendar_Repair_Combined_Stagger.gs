/**
 * Calendar Repair combined-day scheduling.
 *
 * This file intentionally supplies the active applyCalendarRepairPlan()
 * implementation after the safety-foundation module. Calendar Repair now
 * merges surviving PMOS events and repaired visits into one ordered day before
 * applying the normal route-time semi-stagger.
 */

function repairCalendarDayBounds_(dateText) {
  const start = parseRepairDate_(dateText, 'Repair date');
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {start, end};
}

function repairCalendarManagedDayEvents_(calendar, dateText) {
  const bounds = repairCalendarDayBounds_(dateText);
  return calendar.getEvents(bounds.start, bounds.end)
    .filter(event => !event.isAllDayEvent())
    .filter(isPmosManagedCalendarEvent_)
    .sort((a, b) => a.getStartTime().getTime() - b.getStartTime().getTime());
}

function repairCalendarCombinedSequence_(existingEvents, repairItems) {
  const sequence = existingEvents.map(event => ({kind: 'existing', event}));

  repairItems
    .slice()
    .sort((a, b) => Number(a.order || 1) - Number(b.order || 1))
    .forEach(item => {
      const requestedIndex = Math.max(0, Number(item.order || 1) - 1);
      const insertIndex = Math.min(requestedIndex, sequence.length);
      sequence.splice(insertIndex, 0, {kind: 'repair', item});
    });

  return sequence;
}

function repairCalendarEventAlreadyRepresentsItem_(event, item) {
  const description = String(event.getDescription() || '');
  if (item.customerId && description.indexOf(`PMOS_CUSTOMER_ID=${item.customerId}`) >= 0) return true;
  return normalize_(event.getTitle()) === normalize_(item.title);
}

function repairCalendarApplyDay_(calendar, dateText, repairItems, settings) {
  let existingEvents = repairCalendarManagedDayEvents_(calendar, dateText);
  const pendingItems = [];
  let skipped = 0;

  repairItems.forEach(item => {
    if (existingEvents.some(event => repairCalendarEventAlreadyRepresentsItem_(event, item))) {
      skipped++;
    } else {
      pendingItems.push(item);
    }
  });

  const sequence = repairCalendarCombinedSequence_(existingEvents, pendingItems);
  const visitDate = parseRepairDate_(dateText, 'Repair date');
  let created = 0;
  let repositioned = 0;
  const errors = [];

  sequence.forEach((entry, index) => {
    const combinedOrder = index + 1;
    const targetStart = routeTimeForOrder_(visitDate, combinedOrder, settings);
    const targetEnd = new Date(targetStart.getTime() + settings.eventDurationMinutes * 60000);

    try {
      if (entry.kind === 'existing') {
        const event = entry.event;
        const startChanged = event.getStartTime().getTime() !== targetStart.getTime();
        const endChanged = event.getEndTime().getTime() !== targetEnd.getTime();
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
        item.customerId ? `PMOS_CUSTOMER_ID=${item.customerId}` : '',
        `PMOS_REPAIR_ORIGINAL_LAYER=${item.layer || ''}`,
        `PMOS_REPAIR_APPLIED_DATE=${item.date}`,
        `PMOS_REPAIR_STOP_ORDER=${combinedOrder}`
      ].filter(Boolean).join('\n');

      const event = calendar.createEvent(item.title, targetStart, targetEnd, {
        description,
        location: item.address || ''
      });
      if (item.color) event.setColor(item.color);
      created++;
      existingEvents.push(event);
    } catch (error) {
      const label = entry.kind === 'existing' ? entry.event.getTitle() : entry.item.title;
      errors.push(`${dateText} ${label}: ${error}`);
    }
  });

  return {created, skipped, repositioned, errors};
}

function applyCalendarRepairPlan(startValue, endValue) {
  const start = parseRepairDate_(startValue, 'Begin date');
  const end = parseRepairDate_(endValue, 'End date');
  const startText = Utilities.formatDate(start, PMOS.TIMEZONE, 'yyyy-MM-dd');
  const endText = Utilities.formatDate(end, PMOS.TIMEZONE, 'yyyy-MM-dd');
  let plan = readRepairPlan_();

  if (!plan || plan.start !== startText || plan.end !== endText) {
    plan = saveRepairPlan_(buildCalendarRepairPlan_(start, end));
  }

  const calendar = getRecurringCalendar_();
  const settings = getRecurringCalendarSettings_();
  const itemsByDate = {};
  plan.items.forEach(item => {
    if (!itemsByDate[item.date]) itemsByDate[item.date] = [];
    itemsByDate[item.date].push(item);
  });

  let created = 0;
  let skipped = 0;
  let repositioned = 0;
  const errors = [];

  Object.keys(itemsByDate).sort().forEach(dateText => {
    const result = repairCalendarApplyDay_(calendar, dateText, itemsByDate[dateText], settings);
    created += result.created;
    skipped += result.skipped;
    repositioned += result.repositioned;
    Array.prototype.push.apply(errors, result.errors);
  });

  if (!errors.length) {
    PropertiesService.getDocumentProperties().deleteProperty(PMOS_CALENDAR_REPAIR_PLAN_KEY);
  }

  return {
    summary: [
      'Calendar repair complete.',
      `Date range: ${plan.start} through ${plan.end}`,
      `Visits created: ${created}`,
      `Existing PMOS visits repositioned into the combined semi-stagger: ${repositioned}`,
      `Already present and skipped: ${skipped}`,
      `Errors: ${errors.length}`,
      errors.length ? 'The repair preview was retained so the failed items can be retried.' : '',
      errors.length ? `First error: ${errors[0]}` : ''
    ].filter(Boolean).join('\n')
  };
}
