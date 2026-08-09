/**
 * PMOS shared canonical diff engine.
 *
 * Compares normalized PMOS records and returns an immutable description of the
 * exact changes. This module does not normalize source data, make business
 * decisions, or write to external systems.
 */

const PMOS_DIFF_VERSION = 1;

const PMOS_DIFF_CHANGE_TYPE = Object.freeze({
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  NONE: 'NONE'
});

/**
 * Compare two canonical records.
 *
 * Options:
 *   includeFields: top-level fields or dotted paths to compare exclusively
 *   excludeFields: top-level fields or dotted paths to ignore
 *   ignoreModelVersion: defaults to true
 *   ignoreMetadata: defaults to false
 *   arrayMode: 'ORDERED' (default) or 'SET'
 */
function diffPmosRecords(before, after, options) {
  const settings = normalizePmosDiffOptions_(options);
  const beforeExists = before !== null && before !== undefined;
  const afterExists = after !== null && after !== undefined;

  if (!beforeExists && !afterExists) {
    return freezePmosDiffResult_({
      version: PMOS_DIFF_VERSION,
      type: PMOS_DIFF_CHANGE_TYPE.NONE,
      changed: false,
      changedFields: [],
      changes: {},
      before: null,
      after: null
    });
  }

  if (!beforeExists) {
    return freezePmosDiffResult_({
      version: PMOS_DIFF_VERSION,
      type: PMOS_DIFF_CHANGE_TYPE.CREATE,
      changed: true,
      changedFields: ['$record'],
      changes: {
        '$record': { before: null, after: clonePmosDiffValue_(after) }
      },
      before: null,
      after: clonePmosDiffValue_(after)
    });
  }

  if (!afterExists) {
    return freezePmosDiffResult_({
      version: PMOS_DIFF_VERSION,
      type: PMOS_DIFF_CHANGE_TYPE.DELETE,
      changed: true,
      changedFields: ['$record'],
      changes: {
        '$record': { before: clonePmosDiffValue_(before), after: null }
      },
      before: clonePmosDiffValue_(before),
      after: null
    });
  }

  validatePmosDiffRecord_(before, 'before');
  validatePmosDiffRecord_(after, 'after');

  const changes = {};
  collectPmosDiffChanges_(before, after, '', changes, settings);
  const changedFields = Object.keys(changes).sort();

  return freezePmosDiffResult_({
    version: PMOS_DIFF_VERSION,
    type: changedFields.length
      ? PMOS_DIFF_CHANGE_TYPE.UPDATE
      : PMOS_DIFF_CHANGE_TYPE.NONE,
    changed: changedFields.length > 0,
    changedFields: changedFields,
    changes: changes,
    before: clonePmosDiffValue_(before),
    after: clonePmosDiffValue_(after)
  });
}

function diffPmosCustomers(before, after, options) {
  if (before != null && before.type && before.type !== 'CUSTOMER') {
    throw new Error('Before record is not a canonical CUSTOMER.');
  }
  if (after != null && after.type && after.type !== 'CUSTOMER') {
    throw new Error('After record is not a canonical CUSTOMER.');
  }
  return diffPmosRecords(before, after, options);
}

function arePmosValuesEqual(left, right, options) {
  const settings = normalizePmosDiffOptions_(options);
  return pmosDiffValuesEqual_(left, right, settings, '');
}

function normalizePmosDiffOptions_(options) {
  const source = options || {};
  const includeFields = normalizePmosDiffPathList_(source.includeFields);
  const excludeFields = normalizePmosDiffPathList_(source.excludeFields);
  if (source.ignoreModelVersion !== false) excludeFields.push('modelVersion');
  if (source.ignoreMetadata === true) excludeFields.push('metadata');
  return {
    includeFields: includeFields,
    excludeFields: Array.from(new Set(excludeFields)),
    arrayMode: String(source.arrayMode || 'ORDERED').toUpperCase() === 'SET' ? 'SET' : 'ORDERED'
  };
}

function normalizePmosDiffPathList_(value) {
  if (value == null || value === '') return [];
  const items = Array.isArray(value) ? value : [value];
  return items.map(function (item) {
    return String(item == null ? '' : item).trim();
  }).filter(Boolean);
}

function validatePmosDiffRecord_(record, label) {
  if (!isPmosDiffPlainObject_(record)) {
    throw new Error('The ' + label + ' PMOS diff record must be an object.');
  }
}

function collectPmosDiffChanges_(before, after, path, changes, settings) {
  if (path && !shouldComparePmosDiffPath_(path, settings)) return;
  if (pmosDiffValuesEqual_(before, after, settings, path)) return;
  if (isPmosDiffPlainObject_(before) && isPmosDiffPlainObject_(after)) {
    Array.from(new Set(Object.keys(before).concat(Object.keys(after)))).sort().forEach(function (key) {
      const childPath = path ? path + '.' + key : key;
      collectPmosDiffChanges_(before[key], after[key], childPath, changes, settings);
    });
    return;
  }
  const changePath = path || '$record';
  changes[changePath] = {
    before: clonePmosDiffValue_(before),
    after: clonePmosDiffValue_(after)
  };
}

function shouldComparePmosDiffPath_(path, settings) {
  const excluded = settings.excludeFields.some(function (candidate) {
    return path === candidate || path.indexOf(candidate + '.') === 0;
  });
  if (excluded) return false;
  if (!settings.includeFields.length) return true;
  return settings.includeFields.some(function (candidate) {
    return path === candidate || path.indexOf(candidate + '.') === 0 || candidate.indexOf(path + '.') === 0;
  });
}

function pmosDiffValuesEqual_(left, right, settings, path) {
  if (left === right) return true;
  if (typeof left === 'number' && typeof right === 'number' && isNaN(left) && isNaN(right)) return true;
  if (left == null || right == null) return false;
  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    return settings.arrayMode === 'SET'
      ? pmosDiffArraysEqualAsSets_(left, right, settings, path)
      : pmosDiffArraysEqualOrdered_(left, right, settings, path);
  }
  if (isPmosDiffPlainObject_(left) || isPmosDiffPlainObject_(right)) {
    if (!isPmosDiffPlainObject_(left) || !isPmosDiffPlainObject_(right)) return false;
    const keys = Array.from(new Set(Object.keys(left).concat(Object.keys(right)))).sort().filter(function (key) {
      const childPath = path ? path + '.' + key : key;
      return shouldComparePmosDiffPath_(childPath, settings);
    });
    return keys.every(function (key) {
      const childPath = path ? path + '.' + key : key;
      return pmosDiffValuesEqual_(left[key], right[key], settings, childPath);
    });
  }
  return false;
}

function pmosDiffArraysEqualOrdered_(left, right, settings, path) {
  if (left.length !== right.length) return false;
  return left.every(function (value, index) {
    return pmosDiffValuesEqual_(value, right[index], settings, path);
  });
}

function pmosDiffArraysEqualAsSets_(left, right, settings, path) {
  if (left.length !== right.length) return false;
  const unmatched = right.slice();
  return left.every(function (leftValue) {
    const matchIndex = unmatched.findIndex(function (rightValue) {
      return pmosDiffValuesEqual_(leftValue, rightValue, settings, path);
    });
    if (matchIndex < 0) return false;
    unmatched.splice(matchIndex, 1);
    return true;
  });
}

function isPmosDiffPlainObject_(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function clonePmosDiffValue_(value) {
  if (value === undefined) return null;
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(clonePmosDiffValue_);
  const copy = {};
  Object.keys(value).sort().forEach(function (key) {
    copy[key] = clonePmosDiffValue_(value[key]);
  });
  return copy;
}

function freezePmosDiffResult_(result) {
  return freezePmosDiffValue_(result);
}

function freezePmosDiffValue_(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) {
    freezePmosDiffValue_(value[key]);
  });
  return Object.freeze(value);
}
