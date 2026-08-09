/**
 * PMOS plan and operation validation.
 *
 * Validates immutable plans before execution. This module reports safety issues
 * but performs no writes and never changes the supplied plan.
 */

const PMOS_VALIDATION_VERSION = 1;

const PMOS_VALIDATION_SEVERITY = Object.freeze({
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO'
});

const PMOS_VALIDATION_CODE = Object.freeze({
  PLAN_REQUIRED: 'PLAN_REQUIRED',
  PLAN_ID_REQUIRED: 'PLAN_ID_REQUIRED',
  PLAN_PLANNER_REQUIRED: 'PLAN_PLANNER_REQUIRED',
  OPERATIONS_REQUIRED: 'OPERATIONS_REQUIRED',
  OPERATION_ID_REQUIRED: 'OPERATION_ID_REQUIRED',
  DUPLICATE_OPERATION_ID: 'DUPLICATE_OPERATION_ID',
  ACTION_REQUIRED: 'ACTION_REQUIRED',
  ACTION_INVALID: 'ACTION_INVALID',
  ENTITY_REQUIRED: 'ENTITY_REQUIRED',
  ENTITY_ID_REQUIRED: 'ENTITY_ID_REQUIRED',
  PRIORITY_INVALID: 'PRIORITY_INVALID',
  DEPENDENCY_MISSING: 'DEPENDENCY_MISSING',
  DEPENDENCY_SELF_REFERENCE: 'DEPENDENCY_SELF_REFERENCE',
  DEPENDENCY_CYCLE: 'DEPENDENCY_CYCLE',
  CUSTOMER_RECORD_REQUIRED: 'CUSTOMER_RECORD_REQUIRED',
  CUSTOMER_ID_REQUIRED: 'CUSTOMER_ID_REQUIRED',
  CUSTOMER_NAME_REQUIRED: 'CUSTOMER_NAME_REQUIRED',
  CUSTOMER_FREQUENCY_INVALID: 'CUSTOMER_FREQUENCY_INVALID',
  CUSTOMER_ADDRESS_MISSING: 'CUSTOMER_ADDRESS_MISSING',
  CUSTOMER_ROUTE_MISSING: 'CUSTOMER_ROUTE_MISSING',
  CONFLICTING_ENTITY_OPERATIONS: 'CONFLICTING_ENTITY_OPERATIONS'
});

/**
 * Validates a complete PMOS plan.
 *
 * Options:
 *   validateCustomers: defaults to true
 *   requireCustomerAddress: defaults to false
 *   requireCustomerRoute: defaults to false
 *   allowedCustomerFrequencies: optional array
 */
function validatePmosPlan(plan, options) {
  const settings = normalizePmosValidationOptions_(options);
  const issues = [];

  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
      PMOS_VALIDATION_CODE.PLAN_REQUIRED, 'A PMOS plan object is required.');
    return buildPmosValidationReport_(plan, issues, []);
  }

  if (!plan.id) {
    addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
      PMOS_VALIDATION_CODE.PLAN_ID_REQUIRED, 'The plan requires an ID.');
  }
  if (!plan.planner) {
    addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
      PMOS_VALIDATION_CODE.PLAN_PLANNER_REQUIRED, 'The plan requires a planner name.');
  }
  if (!Array.isArray(plan.operations)) {
    addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
      PMOS_VALIDATION_CODE.OPERATIONS_REQUIRED, 'The plan requires an operations array.');
    return buildPmosValidationReport_(plan, issues, []);
  }

  const operationIds = {};
  const entityActions = {};
  const operationReports = plan.operations.map(function (operation, index) {
    const operationIssues = validatePmosOperation_(operation, index, plan, settings);

    if (operation && operation.id) {
      if (operationIds[operation.id]) {
        addPmosValidationIssue_(operationIssues, PMOS_VALIDATION_SEVERITY.ERROR,
          PMOS_VALIDATION_CODE.DUPLICATE_OPERATION_ID,
          'Operation ID is duplicated: ' + operation.id + '.', operation.id);
      }
      operationIds[operation.id] = true;
    }

    if (operation && operation.entity && operation.entityId && isPmosExecutableOperation(operation)) {
      const key = operation.entity + '::' + operation.entityId;
      entityActions[key] = entityActions[key] || [];
      entityActions[key].push(operation);
    }

    Array.prototype.push.apply(issues, operationIssues);
    return buildPmosOperationValidationReport_(operation, index, operationIssues);
  });

  validatePmosDependencies_(plan.operations, operationIds, issues);
  validatePmosDependencyCycles_(plan.operations, issues);
  validatePmosEntityConflicts_(entityActions, issues);

  return buildPmosValidationReport_(plan, issues, operationReports);
}

function validatePmosOperation_(operation, index, plan, settings) {
  const issues = [];
  const reference = operation && operation.id ? operation.id : 'operation[' + index + ']';

  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
    addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
      PMOS_VALIDATION_CODE.OPERATION_ID_REQUIRED,
      'Operation ' + index + ' is not a valid object.', reference);
    return issues;
  }

  if (!operation.id) {
    addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
      PMOS_VALIDATION_CODE.OPERATION_ID_REQUIRED, 'Operation requires an ID.', reference);
  }

  const validActions = Object.keys(PMOS_OPERATION).map(function (key) { return PMOS_OPERATION[key]; });
  if (!operation.action) {
    addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
      PMOS_VALIDATION_CODE.ACTION_REQUIRED, 'Operation requires an action.', reference);
  } else if (validActions.indexOf(operation.action) < 0) {
    addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
      PMOS_VALIDATION_CODE.ACTION_INVALID,
      'Unsupported operation action: ' + operation.action + '.', reference);
  }

  if (!operation.entity) {
    addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
      PMOS_VALIDATION_CODE.ENTITY_REQUIRED, 'Operation requires an entity.', reference);
  }

  if (isPmosExecutableOperation(operation) && !operation.entityId) {
    addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
      PMOS_VALIDATION_CODE.ENTITY_ID_REQUIRED,
      'Executable operation requires an entity ID.', reference);
  }

  const validPriorities = Object.keys(PMOS_OPERATION_PRIORITY)
    .map(function (key) { return PMOS_OPERATION_PRIORITY[key]; });
  if (validPriorities.indexOf(operation.priority) < 0) {
    addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
      PMOS_VALIDATION_CODE.PRIORITY_INVALID,
      'Unsupported operation priority: ' + operation.priority + '.', reference);
  }

  if (operation.dependencies && operation.dependencies.indexOf(operation.id) >= 0) {
    addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
      PMOS_VALIDATION_CODE.DEPENDENCY_SELF_REFERENCE,
      'Operation cannot depend on itself.', reference);
  }

  if (settings.validateCustomers && operation.entity === 'CUSTOMER') {
    validatePmosCustomerOperation_(operation, settings, issues);
  }

  return issues;
}

function validatePmosCustomerOperation_(operation, settings, issues) {
  if (!isPmosExecutableOperation(operation) || operation.action === PMOS_OPERATION.DELETE) return;

  const record = operation.payload && (operation.payload.record || operation.payload.customer);
  if (!record || typeof record !== 'object') {
    addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
      PMOS_VALIDATION_CODE.CUSTOMER_RECORD_REQUIRED,
      'Customer operation requires payload.record or payload.customer.', operation.id);
    return;
  }

  if (!record.id) {
    addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
      PMOS_VALIDATION_CODE.CUSTOMER_ID_REQUIRED,
      'Customer record requires an ID.', operation.id, 'payload.record.id');
  }

  if (!record.calendarTitle && !record.fullName) {
    addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
      PMOS_VALIDATION_CODE.CUSTOMER_NAME_REQUIRED,
      'Customer requires a calendar title or full name.', operation.id);
  }

  if (record.frequency && settings.allowedCustomerFrequencies.indexOf(record.frequency) < 0) {
    addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
      PMOS_VALIDATION_CODE.CUSTOMER_FREQUENCY_INVALID,
      'Unsupported customer frequency: ' + record.frequency + '.', operation.id,
      'payload.record.frequency');
  }

  if (!record.address) {
    addPmosValidationIssue_(issues,
      settings.requireCustomerAddress
        ? PMOS_VALIDATION_SEVERITY.ERROR
        : PMOS_VALIDATION_SEVERITY.WARNING,
      PMOS_VALIDATION_CODE.CUSTOMER_ADDRESS_MISSING,
      'Customer address is missing.', operation.id, 'payload.record.address');
  }

  const hasRoute = record.route ||
    (Array.isArray(record.routeDays) && record.routeDays.length) ||
    (Array.isArray(record.rotationWeeks) && record.rotationWeeks.length);
  if (!hasRoute) {
    addPmosValidationIssue_(issues,
      settings.requireCustomerRoute
        ? PMOS_VALIDATION_SEVERITY.ERROR
        : PMOS_VALIDATION_SEVERITY.WARNING,
      PMOS_VALIDATION_CODE.CUSTOMER_ROUTE_MISSING,
      'Customer has no route assignment.', operation.id);
  }
}

function validatePmosDependencies_(operations, operationIds, issues) {
  operations.forEach(function (operation) {
    if (!operation || !Array.isArray(operation.dependencies)) return;
    operation.dependencies.forEach(function (dependencyId) {
      if (!operationIds[dependencyId]) {
        addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
          PMOS_VALIDATION_CODE.DEPENDENCY_MISSING,
          'Dependency does not exist in the plan: ' + dependencyId + '.', operation.id);
      }
    });
  });
}

function validatePmosDependencyCycles_(operations, issues) {
  const graph = {};
  operations.forEach(function (operation) {
    if (operation && operation.id) graph[operation.id] = operation.dependencies || [];
  });

  const visiting = {};
  const visited = {};

  function visit(id, trail) {
    if (visiting[id]) {
      addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.ERROR,
        PMOS_VALIDATION_CODE.DEPENDENCY_CYCLE,
        'Dependency cycle detected: ' + trail.concat([id]).join(' -> ') + '.', id);
      return;
    }
    if (visited[id] || !graph[id]) return;

    visiting[id] = true;
    graph[id].forEach(function (dependency) { visit(dependency, trail.concat([id])); });
    delete visiting[id];
    visited[id] = true;
  }

  Object.keys(graph).forEach(function (id) { visit(id, []); });
}

function validatePmosEntityConflicts_(entityActions, issues) {
  Object.keys(entityActions).forEach(function (key) {
    const operations = entityActions[key];
    if (operations.length < 2) return;

    const actions = Array.from(new Set(operations.map(function (operation) {
      return operation.action;
    })));

    if (actions.length > 1 || actions[0] !== PMOS_OPERATION.UPDATE) {
      addPmosValidationIssue_(issues, PMOS_VALIDATION_SEVERITY.WARNING,
        PMOS_VALIDATION_CODE.CONFLICTING_ENTITY_OPERATIONS,
        'Multiple executable operations target ' + key + ': ' + actions.join(', ') + '.',
        operations[0].id);
    }
  });
}

function normalizePmosValidationOptions_(options) {
  const source = options || {};
  const defaultFrequencies = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'ONCE', 'TEMPORARY'];
  return {
    validateCustomers: source.validateCustomers !== false,
    requireCustomerAddress: source.requireCustomerAddress === true,
    requireCustomerRoute: source.requireCustomerRoute === true,
    allowedCustomerFrequencies: Array.isArray(source.allowedCustomerFrequencies)
      ? source.allowedCustomerFrequencies.map(function (value) {
          return String(value).trim().toUpperCase();
        })
      : defaultFrequencies
  };
}

function addPmosValidationIssue_(issues, severity, code, message, operationId, path) {
  issues.push({
    severity: severity,
    code: code,
    message: message,
    operationId: operationId || null,
    path: path || null
  });
}

function buildPmosValidationReport_(plan, issues, operationReports) {
  const errors = issues.filter(function (issue) {
    return issue.severity === PMOS_VALIDATION_SEVERITY.ERROR;
  });
  const warnings = issues.filter(function (issue) {
    return issue.severity === PMOS_VALIDATION_SEVERITY.WARNING;
  });

  return freezePmosValidationValue_({
    version: PMOS_VALIDATION_VERSION,
    planId: plan && plan.id ? plan.id : null,
    valid: errors.length === 0,
    executable: errors.length === 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    issues: issues.slice(),
    operations: operationReports
  });
}

function buildPmosOperationValidationReport_(operation, index, issues) {
  const errors = issues.filter(function (issue) {
    return issue.severity === PMOS_VALIDATION_SEVERITY.ERROR;
  });
  return freezePmosValidationValue_({
    index: index,
    operationId: operation && operation.id ? operation.id : null,
    valid: errors.length === 0,
    executable: errors.length === 0 && isPmosExecutableOperation(operation),
    issues: issues.slice()
  });
}

function freezePmosValidationValue_(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) {
    freezePmosValidationValue_(value[key]);
  });
  return Object.freeze(value);
}
