/**
 * PMOS immutable record comparison helper.
 *
 * Used by pure planners to determine whether canonical records differ. This
 * module performs no Google service calls and owns no persisted state.
 */
function diffPmosRecords(before, after, options) {
  const settings = options || {};
  const left = normalizePmosDiffValue_(before, settings);
  const right = normalizePmosDiffValue_(after, settings);
  const changes = {};
  collectPmosDiffChanges_('', left, right, changes, settings);
  const changedFields = Object.keys(changes).sort();

  return Object.freeze({
    changed: changedFields.length > 0,
    changedFields: changedFields,
    changes: Object.freeze(changes),
    before: left,
    after: right
  });
}

function normalizePmosDiffValue_(value, settings) {
  if (value === undefined) return null;
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) {
    const normalized = value.map(function(item) {
      return normalizePmosDiffValue_(item, settings);
    });
    if (String(settings.arrayMode || '').toUpperCase() === 'UNORDERED') {
      return normalized.slice().sort(function(a, b) {
        return JSON.stringify(a).localeCompare(JSON.stringify(b));
      });
    }
    return normalized;
  }

  const copy = {};
  Object.keys(value).sort().forEach(function(key) {
    if (settings.ignoreMetadata === true && key === 'metadata') return;
    if (settings.ignoreModelVersion === true && key === 'modelVersion') return;
    copy[key] = normalizePmosDiffValue_(value[key], settings);
  });
  return copy;
}

function collectPmosDiffChanges_(path, before, after, changes, settings) {
  if (pmosDiffValuesEqual_(before, after)) return;

  const beforeObject = before && typeof before === 'object';
  const afterObject = after && typeof after === 'object';
  const beforeArray = Array.isArray(before);
  const afterArray = Array.isArray(after);

  if (!beforeObject || !afterObject || beforeArray || afterArray) {
    changes[path || '$'] = Object.freeze({before: before, after: after});
    return;
  }

  const keys = {};
  Object.keys(before).forEach(function(key) { keys[key] = true; });
  Object.keys(after).forEach(function(key) { keys[key] = true; });
  Object.keys(keys).sort().forEach(function(key) {
    const childPath = path ? path + '.' + key : key;
    collectPmosDiffChanges_(childPath, before[key], after[key], changes, settings);
  });
}

function pmosDiffValuesEqual_(left, right) {
  if (left === right) return true;
  if (left == null || right == null) return left === right;
  if (typeof left !== 'object' || typeof right !== 'object') return false;
  return JSON.stringify(left) === JSON.stringify(right);
}
