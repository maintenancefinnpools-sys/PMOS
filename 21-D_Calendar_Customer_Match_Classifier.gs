/**
 * Read-only customer matching for unclassified Calendar events.
 *
 * A clear customer name, Calendar title, or service-address match is sufficient
 * to create a suggestion. Phone, email, and additional matching fields increase
 * confidence. Ambiguous results remain unclassified. This performs no writes.
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
    const hasPrimaryEvidence = Boolean(best && best.primaryEvidence);
    const clearlyAhead = !second || best.score - second.score >= 10;
    const unique = Boolean(best && hasPrimaryEvidence && best.score >= 65 && clearlyAhead);

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
  const description = normalizePmosCalendarMatchText_(event && event.description);
  const searchable = normalizePmosCalendarMatchText_([title, location, description].join(' '));
  const name = normalizePmosCalendarMatchText_(customer.fullName);
  const calendarTitle = normalizePmosCalendarMatchText_(customer.title);
  const address = normalizePmosCalendarMatchText_(customer.address);
  const phone = normalizePmosCalendarMatchPhone_(customer.phone);
  const secondaryPhone = normalizePmosCalendarMatchPhone_(customer.secondaryPhone);
  const email = String(customer.email || '').trim().toLowerCase();

  let score = 0;
  let primaryEvidence = false;
  const matchedFields = [];

  if (address && textContainsEitherPmosCalendarMatch_(location, address)) {
    score += 85;
    primaryEvidence = true;
    matchedFields.push('service address');
  } else if (address && textContainsEitherPmosCalendarMatch_(searchable, address)) {
    score += 75;
    primaryEvidence = true;
    matchedFields.push('service address');
  }

  if (calendarTitle && title === calendarTitle) {
    score += 85;
    primaryEvidence = true;
    matchedFields.push('Calendar title');
  } else if (calendarTitle && textContainsEitherPmosCalendarMatch_(title, calendarTitle)) {
    score += 75;
    primaryEvidence = true;
    matchedFields.push('Calendar title');
  } else if (calendarTitle && searchable.indexOf(calendarTitle) >= 0) {
    score += 65;
    primaryEvidence = true;
    matchedFields.push('Calendar title');
  }

  if (name && title === name) {
    score += 85;
    primaryEvidence = true;
    matchedFields.push('customer name');
  } else if (name && textContainsEitherPmosCalendarMatch_(title, name)) {
    score += 75;
    primaryEvidence = true;
    matchedFields.push('customer name');
  } else if (name && searchable.indexOf(name) >= 0) {
    score += 65;
    primaryEvidence = true;
    matchedFields.push('customer name');
  }

  const eventDigits = normalizePmosCalendarMatchPhone_([
    event && event.title,
    event && event.location,
    event && event.description
  ].join(' '));
  if (phone && phone.length >= 7 && eventDigits.indexOf(phone) >= 0) {
    score += 25;
    matchedFields.push('phone');
  } else if (secondaryPhone && secondaryPhone.length >= 7 && eventDigits.indexOf(secondaryPhone) >= 0) {
    score += 20;
    matchedFields.push('secondary phone');
  }

  if (email && searchable.indexOf(email) >= 0) {
    score += 25;
    matchedFields.push('email');
  }

  return {
    customer: customer,
    score: score,
    primaryEvidence: primaryEvidence,
    matchedFields: matchedFields
  };
}

function textContainsEitherPmosCalendarMatch_(left, right) {
  const a = String(left || '').trim();
  const b = String(right || '').trim();
  if (!a || !b) return false;
  return a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
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
