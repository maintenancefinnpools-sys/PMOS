/**
 * Read-only customer matching for unclassified Calendar events.
 *
 * Produces only unique, evidence-backed suggestions. It performs no writes.
 */
function classifyPmosCalendarCustomerMatches_(events) {
  const customers = buildPmosCalendarMatchCustomerIndex_();
  const suggestedMatches = [];
  const unmatchedEvents = [];

  (events || []).forEach(function (event) {
    const ranked = customers.map(function (customer) {
      return scorePmosCalendarCustomerMatch_(event, customer);
    }).filter(function (result) {
      return result.score > 0;
    }).sort(function (left, right) {
      return right.score - left.score;
    });

    const best = ranked[0];
    const second = ranked[1];
    const unique = best && best.score >= 70 &&
      (!second || best.score - second.score >= 20);

    if (!unique) {
      unmatchedEvents.push(event);
      return;
    }

    suggestedMatches.push(Object.freeze({
      operationId: String(event.operationId || ''),
      eventId: String(event.eventId || ''),
      seriesId: String(event.seriesId || ''),
      title: String(event.title || ''),
      start: String(event.start || ''),
      end: String(event.end || ''),
      location: String(event.location || ''),
      recurring: Boolean(event.recurring),
      matchType: event.recurring ? 'RECURRING' : 'ONE_TIME',
      customerId: String(best.customer.customerId || ''),
      customerName: String(best.customer.fullName || best.customer.title || ''),
      customerAddress: String(best.customer.address || ''),
      customerTitle: String(best.customer.title || ''),
      confidence: Math.min(100, best.score),
      matchedFields: best.matchedFields.slice(),
      reason: best.matchedFields.join(', ')
    }));
  });

  return Object.freeze({
    suggestedMatches: Object.freeze(suggestedMatches.slice()),
    unclassifiedEvents: Object.freeze(unmatchedEvents.slice())
  });
}

function buildPmosCalendarMatchCustomerIndex_() {
  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = spreadsheet.getSheetByName(PMOS.CUSTOMERS_SHEET);
  if (!sheet) throw new Error('Missing customer source sheet: ' + PMOS.CUSTOMERS_SHEET + '.');

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(pmosCalendarHeader_);

  return values.slice(1).filter(pmosCalendarRowHasData_).map(function (row) {
    const customer = pmosCalendarRowObject_(headers, row);
    return {
      customerId: String(customer['Customer ID'] || '').trim(),
      fullName: String(customer['Full Name(s)'] || '').trim(),
      title: String(customer['Calendar Title'] || '').trim(),
      address: String(customer['Full Address'] || '').trim(),
      phone: String(customer['Primary Phone'] || '').trim(),
      secondaryPhone: String(customer['Secondary Phone'] || '').trim(),
      email: String(customer.Email || '').trim()
    };
  }).filter(function (customer) {
    return customer.customerId && (customer.fullName || customer.title || customer.address);
  });
}

function scorePmosCalendarCustomerMatch_(event, customer) {
  const title = normalizePmosCalendarMatchText_(event && event.title);
  const location = normalizePmosCalendarMatchText_(event && event.location);
  const searchable = normalizePmosCalendarMatchText_([
    event && event.title,
    event && event.location,
    event && event.description
  ].join(' '));
  const name = normalizePmosCalendarMatchText_(customer.fullName);
  const calendarTitle = normalizePmosCalendarMatchText_(customer.title);
  const address = normalizePmosCalendarMatchText_(customer.address);
  const phone = normalizePmosCalendarMatchPhone_(customer.phone);
  const secondaryPhone = normalizePmosCalendarMatchPhone_(customer.secondaryPhone);
  const email = String(customer.email || '').trim().toLowerCase();

  let score = 0;
  const matchedFields = [];

  if (address && location && (location === address || location.indexOf(address) >= 0 || address.indexOf(location) >= 0)) {
    score += 70;
    matchedFields.push('service address');
  } else if (address && searchable.indexOf(address) >= 0) {
    score += 65;
    matchedFields.push('service address');
  }

  if (calendarTitle && title === calendarTitle) {
    score += 60;
    matchedFields.push('Calendar title');
  } else if (calendarTitle && searchable.indexOf(calendarTitle) >= 0) {
    score += 45;
    matchedFields.push('Calendar title');
  }

  if (name && (title === name || searchable.indexOf(name) >= 0)) {
    score += 45;
    matchedFields.push('customer name');
  }

  const eventDigits = normalizePmosCalendarMatchPhone_(searchable);
  if (phone && eventDigits.indexOf(phone) >= 0) {
    score += 55;
    matchedFields.push('phone');
  } else if (secondaryPhone && eventDigits.indexOf(secondaryPhone) >= 0) {
    score += 50;
    matchedFields.push('secondary phone');
  }

  if (email && searchable.indexOf(email) >= 0) {
    score += 60;
    matchedFields.push('email');
  }

  return { customer: customer, score: score, matchedFields: matchedFields };
}

function normalizePmosCalendarMatchText_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePmosCalendarMatchPhone_(value) {
  return String(value || '').replace(/\D/g, '');
}
