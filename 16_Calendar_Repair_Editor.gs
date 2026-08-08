/**
 * Calendar Repair editor backend.
 *
 * The combined existing/repair visit board UI is owned by
 * 19_Calendar_Repair_Existing_Visits_Editor.gs. This module owns the customer
 * pool and persistence of user-edited repair items only.
 */

function getCalendarRepairCustomerPool_() {
  const seen = {};
  return readRoutesInPhysicalOrder_()
    .filter(function(row) {
      const key = String(row.customerId || normalize_(row.title));
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    })
    .map(function(row) {
      return {
        customerId: row.customerId || '',
        title: row.title,
        layer: row.layer,
        order: Number(row.order || 1),
        address: row.address || '',
        description: buildRouteDescription_(row, parseLayer_(row.layer)),
        frequency: row.frequency || '',
        color: calendarColorForFrequency_(row.frequency)
      };
    })
    .sort(function(a, b) {
      return String(a.title).localeCompare(String(b.title));
    });
}

function saveCalendarRepairBoardPlan(changes) {
  if (!Array.isArray(changes)) {
    throw new Error('Edited repair data is missing.');
  }

  const plan = readRepairPlan_();
  if (!plan) throw new Error('Run Calendar Repair Preview first.');

  const existingById = {};
  plan.items.forEach(function(item) {
    existingById[String(item.id)] = item;
  });

  const poolByCustomer = {};
  getCalendarRepairCustomerPool_().forEach(function(item) {
    const idKey = String(item.customerId || '');
    const titleKey = normalize_(item.title);
    if (idKey) poolByCustomer[idKey] = item;
    if (titleKey) poolByCustomer['title:' + titleKey] = item;
  });

  const settings = getRecurringCalendarSettings_();
  plan.items = changes.map(function(change) {
    let item = existingById[String(change.id)];

    if (!item) {
      const template =
        poolByCustomer[String(change.customerId || '')] ||
        poolByCustomer['title:' + normalize_(change.title)];
      if (!template) {
        throw new Error(
          'An added customer could not be matched to the route database.'
        );
      }
      item = Object.assign(
        {id:String(change.id || Utilities.getUuid())},
        template
      );
    } else {
      item = Object.assign({}, item);
    }

    const date = parseRepairDate_(change.date, 'Repair date');
    const order = Math.max(1, Math.floor(Number(change.order || 1)));
    const start = routeTimeForOrder_(date, order, settings);

    item.date = Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd');
    item.order = order;
    item.start = start.toISOString();
    item.end = new Date(
      start.getTime() + settings.eventDurationMinutes * 60000
    ).toISOString();
    return item;
  });

  saveRepairPlan_(plan);
  clearPmosRuntimeCheckpoint_(PMOS_CALENDAR_REPAIR_OPERATION);
  return {
    summary:
      'Edited repair preview saved. ' + plan.items.length +
      ' visit(s) will be created when Apply Repair is selected. ' +
      'Removed repair cards are excluded from this repair only.'
  };
}

function saveCalendarRepairBoardAndReturn(changes) {
  const result = saveCalendarRepairBoardPlan(changes);
  showIntegratedPmosJobEngine('CALENDAR_REPAIR');
  return result;
}

function discardCalendarRepairBoardChanges(originalChanges) {
  const result = saveCalendarRepairBoardPlan(originalChanges);
  showIntegratedPmosJobEngine('CALENDAR_REPAIR');
  return {
    summary:
      'Repair preview changes were discarded. ' +
      'The previous saved preview has been restored.',
    result:result
  };
}

function returnToCalendarRepairJobEngine() {
  showIntegratedPmosJobEngine('CALENDAR_REPAIR');
  return {
    summary:
      'Returned to Calendar Repair. The most recently saved preview remains available.'
  };
}

function saveAndApplyCalendarRepairBoard(changes, startValue, endValue) {
  saveCalendarRepairBoardPlan(changes);
  const result = applyCalendarRepairPlan(startValue, endValue);
  showIntegratedPmosJobEngine('CALENDAR_REPAIR');
  return result;
}
