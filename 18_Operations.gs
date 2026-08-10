/**
 * PMOS shared operation and immutable plan model.
 *
 * Planners use this module to describe desired work. This module performs no
 * Google service calls and executes no operations.
 */

const PMOS_OPERATION_MODEL_VERSION = 1;
const PMOS_PLAN_MODEL_VERSION = 1;

const PMOS_OPERATION = Object.freeze({
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  SKIP: 'SKIP',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  MERGE: 'MERGE'
});

const PMOS_OPERATION_PRIORITY = Object.freeze({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
});

/**
 * Creates one immutable operation.
 *
 * Required input:
 *   id, planner, action, entity
 *
 * Common optional input:
 *   entityId, destination, priority, reason, payload, metadata, dependencies
 */
function createPmosOperation(input) {
  const source = input || {};
  const operation = {
    modelVersion: PMOS_OPERATION_MODEL_VERSION,
    id: normalizePmosOperationToken_(source.id),
    planner: normalizePmosOperationToken_(source.planner),
    action: normalizePmosOperationEnum_(source.action, PMOS_OPERATION),
    entity: normalizePmosOperationToken_(source.entity),
    entityId: normalizePmosOperationText_(source.entityId),
    destination: normalizePmosOperationToken_(source.destination),
    priority: normalizePmosOperationEnum_(
      source.priority || PMOS_OPERATION_PRIORITY.NORMAL,
      PMOS_OPERATION_PRIORITY
    ),
    reason: normalizePmosOperationText_(source.reason),
    payload: clonePmosOperationValue_(source.payload || {}),
    metadata: clonePmosOperationValue_(source.metadata || {}),
    dependencies: normalizePmosOperationDependencies_(source.dependencies)
  };

  return freezePmosOperationValue_(operation);
}

/**
 * Creates one immutable plan from already-created operations or operation input.
 */
function createPmosPlan(input) {
  const source = input || {};
  const planId = normalizePmosOperationToken_(source.id);
  const rawOperations = Array.isArray(source.operations) ? source.operations : [];

  const operations = rawOperations.map(function (operation, index) {
    const operationInput = Object.assign({}, operation);
    if (!operationInput.id && planId) {
      operationInput.id = buildPmosOperationId(planId, index + 1);
    }
    if (!operationInput.planner && source.planner) {
      operationInput.planner = source.planner;
    }
    return createPmosOperation(operationInput);
  });

  const plan = {
    modelVersion: PMOS_PLAN_MODEL_VERSION,
    id: planId,
    type: normalizePmosOperationToken_(source.type || source.planner),
    planner: normalizePmosOperationToken_(source.planner),
    createdAt: normalizePmosOperationTimestamp_(source.createdAt),
    sourceVersion: normalizePmosOperationText_(source.sourceVersion),
    operations: operations,
    metadata: clonePmosOperationValue_(source.metadata || {})
  };

  return freezePmosOperationValue_(plan);
}

/** Creates a stable operation ID from a plan ID and one-based sequence. */
function buildPmosOperationId(planId, sequence) {
  const normalizedPlanId = normalizePmosOperationToken_(planId);
  const number = Number(sequence);
  if (!normalizedPlanId) throw new Error('A plan ID is required to build an operation ID.');
  if (!isFinite(number) || number < 1 || Math.floor(number) !== number) {
    throw new Error('Operation sequence must be a positive integer.');
  }
  return normalizedPlanId + '-OP-' + String(number).padStart(5, '0');
}

/** Returns true for actions intended to reach an executor. */
function isPmosExecutableOperation(operation) {
  if (!operation) return false;
  return [
    PMOS_OPERATION.CREATE,
    PMOS_OPERATION.UPDATE,
    PMOS_OPERATION.DELETE,
    PMOS_OPERATION.MERGE
  ].indexOf(operation.action) >= 0;
}

/** Returns an immutable action-count summary for a plan. */
function summarizePmosPlan(plan) {
  const counts = {};
  Object.keys(PMOS_OPERATION).forEach(function (key) {
    counts[PMOS_OPERATION[key]] = 0;
  });

  const operations = plan && Array.isArray(plan.operations) ? plan.operations : [];
  operations.forEach(function (operation) {
    const action = operation && operation.action;
    if (Object.prototype.hasOwnProperty.call(counts, action)) counts[action]++;
  });

  return freezePmosOperationValue_({
    planId: plan && plan.id ? plan.id : null,
    total: operations.length,
    executable: operations.filter(isPmosExecutableOperation).length,
    counts: counts
  });
}

function normalizePmosOperationDependencies_(value) {
  const items = value == null ? [] : (Array.isArray(value) ? value : [value]);
  const seen = {};
  const result = [];

  items.forEach(function (item) {
    const dependency = normalizePmosOperationToken_(item);
    if (!dependency || seen[dependency]) return;
    seen[dependency] = true;
    result.push(dependency);
  });

  return result;
}

function normalizePmosOperationEnum_(value, enumObject) {
  const token = normalizePmosOperationToken_(value);
  if (!token) return null;
  const values = Object.keys(enumObject).map(function (key) { return enumObject[key]; });
  return values.indexOf(token) >= 0 ? token : null;
}

function normalizePmosOperationToken_(value) {
  const text = normalizePmosOperationText_(value);
  return text ? text.toUpperCase().replace(/[^A-Z0-9_-]+/g, '_') : null;
}

function normalizePmosOperationText_(value) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text || null;
}

function normalizePmosOperationTimestamp_(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

function clonePmosOperationValue_(value) {
  if (value === undefined) return null;
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) return value.map(clonePmosOperationValue_);

  const copy = {};
  Object.keys(value).sort().forEach(function (key) {
    copy[key] = clonePmosOperationValue_(value[key]);
  });
  return copy;
}

function freezePmosOperationValue_(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) {
    freezePmosOperationValue_(value[key]);
  });
  return Object.freeze(value);
}
