/**
 * PMOS canonical data normalization.
 *
 * Converts external spreadsheet or object data into predictable, immutable PMOS
 * records. This module does not compare records, enforce operational policy, or
 * write to Sheets, Calendar, Contacts, Drive, or PropertiesService.
 */

const PMOS_DATA_MODEL_VERSION = 1;

const PMOS_CUSTOMER_FIELD_ALIASES = Object.freeze({
  id: ['Customer ID', 'customerId', 'id'],
  calendarTitle: ['Calendar Title', 'calendarTitle', 'title'],
  fullName: ['Full Name(s)', 'Full Name', 'fullName', 'name'],
  address: ['Full Address', 'Address', 'fullAddress', 'address'],
  phone: ['Phone', 'Phone Number', 'Telephone', 'phone'],
  email: ['Email', 'Email Address', 'email'],
  frequency: ['Frequency', 'Service Frequency', 'frequency'],
  routeDays: ['Route Day(s)', 'Route Days', 'routeDays', 'day'],
  rotationWeeks: ['Rotation Week(s)', 'Rotation Weeks', 'rotationWeeks', 'week'],
  route: ['Layer', 'Route', 'Route Layer', 'route', 'layer'],
  stopOrder: ['Stop Order', 'Route Order', 'stopOrder'],
  entryInformation: ['Entry Information', 'Entry Info', 'entryInformation'],
  notes: ['Customer Notes', 'Notes', 'customerNotes', 'notes'],
  status: ['Status', 'Customer Status', 'status'],
  active: ['Active', 'Is Active', 'active'],
  gateCode: ['Gate Code', 'gateCode'],
  waterSource: ['Water Source', 'waterSource'],
  serviceNotes: ['Service Notes', 'serviceNotes']
});

/**
 * Public canonical customer normalizer.
 * Accepts either a header-keyed object or a spreadsheet row plus headers.
 */
function normalizePmosCustomer(source, headers) {
  const raw = pmosNormalizationToObject_(source, headers);
  const consumed = {};

  const customer = {
    modelVersion: PMOS_DATA_MODEL_VERSION,
    type: 'CUSTOMER',
    id: normalizePmosCustomerId_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.id, consumed)
    ),
    calendarTitle: normalizePmosText_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.calendarTitle, consumed)
    ),
    fullName: normalizePmosText_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.fullName, consumed)
    ),
    address: normalizePmosAddress_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.address, consumed)
    ),
    phone: normalizePmosPhone_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.phone, consumed)
    ),
    email: normalizePmosEmail_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.email, consumed)
    ),
    frequency: normalizePmosFrequency_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.frequency, consumed)
    ),
    routeDays: normalizePmosStringList_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.routeDays, consumed),
      normalizePmosWeekday_
    ),
    rotationWeeks: normalizePmosNumberList_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.rotationWeeks, consumed)
    ),
    route: normalizePmosText_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.route, consumed)
    ),
    stopOrder: normalizePmosNumber_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.stopOrder, consumed)
    ),
    entryInformation: normalizePmosMultilineText_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.entryInformation, consumed)
    ),
    notes: normalizePmosMultilineText_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.notes, consumed)
    ),
    status: normalizePmosUpperToken_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.status, consumed)
    ),
    active: normalizePmosBoolean_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.active, consumed)
    ),
    gateCode: normalizePmosText_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.gateCode, consumed)
    ),
    waterSource: normalizePmosText_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.waterSource, consumed)
    ),
    serviceNotes: normalizePmosMultilineText_(
      pmosNormalizationReadAlias_(raw, PMOS_CUSTOMER_FIELD_ALIASES.serviceNotes, consumed)
    ),
    metadata: freezePmosObject_(pmosNormalizationMetadata_(raw, consumed))
  };

  return freezePmosObject_(customer);
}

/**
 * Normalizes every non-empty customer row from a two-dimensional sheet array.
 */
function normalizePmosCustomerRows(values) {
  if (!Array.isArray(values) || !values.length) return [];

  const headers = values[0].map(function (header) {
    return normalizePmosText_(header) || '';
  });

  return Object.freeze(values.slice(1)
    .filter(function (row) {
      return Array.isArray(row) && row.some(function (value) {
        return normalizePmosText_(value) !== null;
      });
    })
    .map(function (row) {
      return normalizePmosCustomer(row, headers);
    }));
}

function pmosNormalizationToObject_(source, headers) {
  if (Array.isArray(source)) {
    if (!Array.isArray(headers)) {
      throw new Error('Headers are required when normalizing a spreadsheet row.');
    }

    const result = {};
    headers.forEach(function (header, index) {
      const key = normalizePmosText_(header);
      if (key) result[key] = source[index];
    });
    return result;
  }

  if (source && typeof source === 'object' && !(source instanceof Date)) {
    return Object.assign({}, source);
  }

  throw new Error('Customer normalization requires an object or spreadsheet row.');
}

function pmosNormalizationReadAlias_(raw, aliases, consumed) {
  for (let index = 0; index < aliases.length; index++) {
    const alias = aliases[index];
    if (Object.prototype.hasOwnProperty.call(raw, alias)) {
      consumed[alias] = true;
      return raw[alias];
    }
  }
  return null;
}

function pmosNormalizationMetadata_(raw, consumed) {
  const metadata = {};
  Object.keys(raw).sort().forEach(function (key) {
    if (consumed[key]) return;
    metadata[key] = normalizePmosMetadataValue_(raw[key]);
  });
  return metadata;
}

function normalizePmosMetadataValue_(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) {
    return Object.freeze(value.map(normalizePmosMetadataValue_));
  }
  if (typeof value === 'object') {
    const copy = {};
    Object.keys(value).sort().forEach(function (key) {
      copy[key] = normalizePmosMetadataValue_(value[key]);
    });
    return freezePmosObject_(copy);
  }
  if (typeof value === 'string') return normalizePmosText_(value);
  return value;
}

function normalizePmosText_(value) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text || null;
}

function normalizePmosMultilineText_(value) {
  if (value == null) return null;
  const lines = String(value).replace(/\r\n?/g, '\n').split('\n')
    .map(function (line) { return line.replace(/[ \t]+/g, ' ').trim(); });
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines.length ? lines.join('\n') : null;
}

function normalizePmosAddress_(value) {
  return normalizePmosText_(value);
}

function normalizePmosEmail_(value) {
  const text = normalizePmosText_(value);
  return text ? text.toLowerCase() : null;
}

function normalizePmosPhone_(value) {
  const text = normalizePmosText_(value);
  if (!text) return null;

  const extensionMatch = text.match(/(?:ext\.?|x)\s*(\d+)$/i);
  const extension = extensionMatch ? extensionMatch[1] : null;
  const base = extensionMatch ? text.slice(0, extensionMatch.index) : text;
  const digits = base.replace(/\D/g, '');

  let formatted;
  if (digits.length === 10) {
    formatted = '(' + digits.slice(0, 3) + ') ' +
      digits.slice(3, 6) + '-' + digits.slice(6);
  } else if (digits.length === 11 && digits.charAt(0) === '1') {
    formatted = '+1 (' + digits.slice(1, 4) + ') ' +
      digits.slice(4, 7) + '-' + digits.slice(7);
  } else {
    formatted = text;
  }

  return extension ? formatted + ' ext. ' + extension : formatted;
}

function normalizePmosCustomerId_(value) {
  const text = normalizePmosText_(value);
  return text ? text.toUpperCase() : null;
}

function normalizePmosFrequency_(value) {
  const text = normalizePmosUpperToken_(value);
  if (!text) return null;

  const aliases = {
    WEEK: 'WEEKLY',
    WEEKLY: 'WEEKLY',
    BIWEEK: 'BIWEEKLY',
    BIWEEKLY: 'BIWEEKLY',
    'BI-WEEKLY': 'BIWEEKLY',
    FORTNIGHTLY: 'BIWEEKLY',
    MONTH: 'MONTHLY',
    MONTHLY: 'MONTHLY',
    ONCE: 'ONCE',
    'ONE-TIME': 'ONCE',
    TEMPORARY: 'TEMPORARY'
  };

  return aliases[text] || text;
}

function normalizePmosUpperToken_(value) {
  const text = normalizePmosText_(value);
  return text ? text.toUpperCase() : null;
}

function normalizePmosBoolean_(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const text = String(value).trim().toLowerCase();
  if (['true', 'yes', 'y', '1', 'active', 'enabled'].indexOf(text) >= 0) return true;
  if (['false', 'no', 'n', '0', 'inactive', 'disabled'].indexOf(text) >= 0) return false;
  return null;
}

function normalizePmosNumber_(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return isFinite(number) ? number : null;
}

function normalizePmosStringList_(value, itemNormalizer) {
  if (value == null || value === '') return Object.freeze([]);
  const rawItems = Array.isArray(value)
    ? value
    : String(value).split(/[,;|\n]+/);
  const seen = {};
  const items = [];

  rawItems.forEach(function (item) {
    const normalized = itemNormalizer ? itemNormalizer(item) : normalizePmosText_(item);
    if (normalized == null) return;
    const key = String(normalized);
    if (seen[key]) return;
    seen[key] = true;
    items.push(normalized);
  });

  return Object.freeze(items);
}

function normalizePmosNumberList_(value) {
  return normalizePmosStringList_(value, function (item) {
    const text = normalizePmosText_(item);
    if (!text) return null;
    const match = text.match(/\d+/);
    return match ? Number(match[0]) : null;
  }).sort(function (left, right) { return left - right; });
}

function normalizePmosWeekday_(value) {
  const text = normalizePmosText_(value);
  if (!text) return null;
  const key = text.slice(0, 3).toLowerCase();
  const weekdays = {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday'
  };
  return weekdays[key] || null;
}

function freezePmosObject_(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) {
    freezePmosObject_(value[key]);
  });
  return Object.freeze(value);
}
