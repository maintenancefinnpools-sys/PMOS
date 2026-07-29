/**
 * PMOS Job Engine.
 *
 * Runtime owns execution safety: deadlines, locks, checkpoints, heartbeats,
 * continuations, completion, and recovery.
 *
 * Job Engine owns job identity and lifecycle: registry, contract validation,
 * planning dispatch, execution dispatch, summaries, and cleanup dispatch.
 *
 * Jobs are added here only after they expose a real planner/executor boundary.
 */

const PMOS_JOB_STATUS = Object.freeze({
  READY: 'READY',
  MIGRATING: 'MIGRATING',
  DISABLED: 'DISABLED'
});

const PMOS_JOB_NAMES = Object.freeze({
  CALENDAR_SYNC: 'CALENDAR_SYNC',
  CALENDAR_REPAIR: 'CALENDAR_REPAIR',
  FUTURE_RECONCILIATION: 'FUTURE_RECONCILIATION',
  CUSTOMER_SYNC: 'CUSTOMER_SYNC'
});

/**
 * Central registry of long-running PMOS jobs.
 *
 * A READY job must expose:
 *   buildPlan(input)
 *   execute(input)
 *   summarize(state)
 *   cleanup(state)
 *
 * The execute method remains responsible for calling Runtime. This keeps the
 * Job Engine independent of any particular checkpoint or continuation format.
 */
function getPmosJobRegistry_() {
  return {
    FUTURE_RECONCILIATION: {
      name: PMOS_JOB_NAMES.FUTURE_RECONCILIATION,
      label: 'Future Calendar Reconciliation',
      status: PMOS_JOB_STATUS.READY,
      planType: 'CALENDAR_RECONCILIATION',
      planVersion: 2,
      buildPlan: function (input) {
        const effectiveDate = parseCalendarEffectiveDate_(
          requirePmosJobInput_(input, 'effectiveDate')
        );
        return buildCalendarReconciliationPlan_(effectiveDate);
      },
      execute: function (input) {
        return reconcileFutureCalendar(
          requirePmosJobInput_(input, 'effectiveDate'),
          input && input.confirmed === true
        );
      },
      summarize: function (state) {
        if (!state) return 'Future Calendar Reconciliation has no status.';
        return state.summary || [
          'Future Calendar Reconciliation',
          'Status: ' + String(state.status || 'Unknown'),
          'Processed: ' + Number(state.processed || 0),
          'Remaining: ' + Number(state.remaining || 0),
          'Errors: ' + Number(state.errors || 0)
        ].join('\n');
      },
      cleanup: function () {
        removeFutureCalendarReconciliationContinuation_();
        deleteCalendarReconciliationPlan_();
      }
    },

    CALENDAR_SYNC: {
      name: PMOS_JOB_NAMES.CALENDAR_SYNC,
      label: 'Calendar Sync',
      status: PMOS_JOB_STATUS.MIGRATING,
      migrationNote: 'Runtime-backed, but not yet adapted to the common Job Engine contract.'
    },

    CALENDAR_REPAIR: {
      name: PMOS_JOB_NAMES.CALENDAR_REPAIR,
      label: 'Calendar Repair',
      status: PMOS_JOB_STATUS.MIGRATING,
      migrationNote: 'Runtime-backed, but not yet adapted to the common Job Engine contract.'
    },

    CUSTOMER_SYNC: {
      name: PMOS_JOB_NAMES.CUSTOMER_SYNC,
      label: 'Customer Sync',
      status: PMOS_JOB_STATUS.MIGRATING,
      migrationNote: 'Planner and executor migration has not started.'
    }
  };
}

/**
 * Public, read-only inventory for diagnostics and future Job Center UI.
 */
function listPmosJobs() {
  const registry = getPmosJobRegistry_();
  return Object.keys(registry).map(function (key) {
    const job = registry[key];
    return {
      name: job.name,
      label: job.label,
      status: job.status,
      planType: job.planType || '',
      planVersion: job.planVersion || null,
      migrationNote: job.migrationNote || ''
    };
  });
}

/**
 * Returns one validated job definition.
 */
function getPmosJobDefinition_(jobName, requireReady) {
  const normalized = String(jobName || '').trim().toUpperCase();
  const registry = getPmosJobRegistry_();
  const job = registry[normalized];

  if (!job) {
    throw new Error('Unknown PMOS job: ' + normalized);
  }

  if (requireReady !== false && job.status !== PMOS_JOB_STATUS.READY) {
    throw new Error(
      job.label + ' is not yet available through the Job Engine. ' +
      String(job.migrationNote || '')
    );
  }

  if (job.status === PMOS_JOB_STATUS.READY) {
    validatePmosJobContract_(job);
  }

  return job;
}

/**
 * Build an immutable, serializable plan without applying it.
 */
function buildPmosJobPlan(jobName, input) {
  const job = getPmosJobDefinition_(jobName, true);
  const plan = job.buildPlan(input || {});
  validatePmosJobPlan_(job, plan);
  return plan;
}

/**
 * Start or resume a registered job through its adapter.
 */
function runPmosJob(jobName, input) {
  const job = getPmosJobDefinition_(jobName, true);
  return job.execute(input || {});
}

/**
 * Produce a job-owned status summary.
 */
function summarizePmosJob(jobName, state) {
  const job = getPmosJobDefinition_(jobName, true);
  return job.summarize(state || null);
}

/**
 * Remove job-owned plan and continuation state.
 * Runtime-owned state remains Runtime's responsibility.
 */
function cleanupPmosJob(jobName, state) {
  const job = getPmosJobDefinition_(jobName, true);
  return job.cleanup(state || null);
}

function validatePmosJobContract_(job) {
  ['buildPlan', 'execute', 'summarize', 'cleanup'].forEach(function (method) {
    if (typeof job[method] !== 'function') {
      throw new Error(
        'PMOS job ' + String(job.name || '') +
        ' is missing required method: ' + method
      );
    }
  });
}

function validatePmosJobPlan_(job, plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error(job.label + ' planner did not return a plan object.');
  }

  if (!Number.isFinite(Number(plan.version))) {
    throw new Error(job.label + ' plan is missing a numeric version.');
  }

  if (job.planVersion && Number(plan.version) !== Number(job.planVersion)) {
    throw new Error(
      job.label + ' returned plan version ' + plan.version +
      '; expected version ' + job.planVersion + '.'
    );
  }

  if (!Array.isArray(plan.operations)) {
    throw new Error(job.label + ' plan is missing its operations array.');
  }

  // Serialization is a required contract. This catches Date objects with
  // circular references, Calendar objects, functions, and other live state.
  const serialized = JSON.stringify(plan);
  if (!serialized) {
    throw new Error(job.label + ' plan could not be serialized.');
  }
}

function requirePmosJobInput_(input, fieldName) {
  const value = input && input[fieldName];
  if (value == null || String(value).trim() === '') {
    throw new Error('Missing required job input: ' + fieldName);
  }
  return value;
}
