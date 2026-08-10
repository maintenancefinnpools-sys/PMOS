/**
 * Shared resumable-runtime safety helpers used by Calendar Repair.
 *
 * This module contains no Calendar business logic. It supplies locking,
 * execution deadlines, checkpoints, heartbeat state, and safe cleanup for
 * time-limited resumable operations.
 */

const PMOS_RUNTIME_CHECKPOINT_PREFIX = 'PMOS_RUNTIME_CHECKPOINT_V1_';
const PMOS_RUNTIME_ACTIVE_OPERATION_KEY = 'PMOS_RUNTIME_ACTIVE_OPERATION_V1';
const PMOS_RUNTIME_DEFAULT_LIMIT_MS = 45 * 1000;
const PMOS_RUNTIME_DEFAULT_SAFETY_MS = 3 * 1000;
const PMOS_RUNTIME_STALE_OPERATION_MS = 30 * 60 * 1000;

function createPmosRuntimeContext_(operationType, options) {
  options = options || {};
  const startedAtMs = Date.now();
  const limitMs = Math.max(5000, Number(options.limitMs || PMOS_RUNTIME_DEFAULT_LIMIT_MS));
  const safetyMs = Math.max(1000, Number(options.safetyMs || PMOS_RUNTIME_DEFAULT_SAFETY_MS));

  return {
    operationType: String(operationType || 'UNKNOWN'),
    operationId: String(options.operationId || Utilities.getUuid()),
    startedAtMs,
    startedAt: new Date(startedAtMs).toISOString(),
    deadlineMs: startedAtMs + Math.max(1000, limitMs - safetyMs),
    limitMs,
    safetyMs
  };
}

function pmosRuntimeTimeRemainingMs_(context) {
  if (!context || !Number(context.deadlineMs)) return 0;
  return Math.max(0, Number(context.deadlineMs) - Date.now());
}

function pmosRuntimeShouldYield_(context) {
  return pmosRuntimeTimeRemainingMs_(context) <= 0;
}

function acquirePmosRuntimeLock_(context, waitMs) {
  const lock = LockService.getDocumentLock();
  const timeout = Math.max(0, Number(waitMs == null ? 5000 : waitMs));
  if (!lock.tryLock(timeout)) {
    throw new Error('Another PMOS operation is running. Try again after it completes.');
  }

  try {
    recoverStalePmosRuntimeOperation_();
    const props = PropertiesService.getDocumentProperties();
    const active = readPmosRuntimeActiveOperation_();
    if (active && active.operationId !== context.operationId) {
      throw new Error(
        'Another PMOS operation is active: ' +
        String(active.operationType || 'UNKNOWN') + '.'
      );
    }

    props.setProperty(PMOS_RUNTIME_ACTIVE_OPERATION_KEY, JSON.stringify({
      operationId: context.operationId,
      operationType: context.operationType,
      startedAt: context.startedAt,
      heartbeatAt: new Date().toISOString()
    }));

    return lock;
  } catch (error) {
    lock.releaseLock();
    throw error;
  }
}

function heartbeatPmosRuntimeOperation_(context) {
  const props = PropertiesService.getDocumentProperties();
  const active = readPmosRuntimeActiveOperation_();
  if (!active || active.operationId !== context.operationId) return;
  active.heartbeatAt = new Date().toISOString();
  props.setProperty(PMOS_RUNTIME_ACTIVE_OPERATION_KEY, JSON.stringify(active));
}

function releasePmosRuntimeLock_(lock, context) {
  try {
    const props = PropertiesService.getDocumentProperties();
    const active = readPmosRuntimeActiveOperation_();
    if (!active || !context || active.operationId === context.operationId) {
      props.deleteProperty(PMOS_RUNTIME_ACTIVE_OPERATION_KEY);
    }
  } finally {
    if (lock) lock.releaseLock();
  }
}

function readPmosRuntimeActiveOperation_() {
  const text = PropertiesService.getDocumentProperties()
    .getProperty(PMOS_RUNTIME_ACTIVE_OPERATION_KEY);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function recoverStalePmosRuntimeOperation_() {
  const active = readPmosRuntimeActiveOperation_();
  if (!active) return false;

  const heartbeatMs = Date.parse(active.heartbeatAt || active.startedAt || '');
  if (!Number.isFinite(heartbeatMs) || Date.now() - heartbeatMs > PMOS_RUNTIME_STALE_OPERATION_MS) {
    PropertiesService.getDocumentProperties().deleteProperty(PMOS_RUNTIME_ACTIVE_OPERATION_KEY);
    return true;
  }
  return false;
}

function pmosRuntimeCheckpointKey_(operationType) {
  return PMOS_RUNTIME_CHECKPOINT_PREFIX + String(operationType || 'UNKNOWN');
}

function savePmosRuntimeCheckpoint_(operationType, checkpoint) {
  const payload = Object.assign({}, checkpoint || {}, {
    operationType: String(operationType || 'UNKNOWN'),
    savedAt: new Date().toISOString()
  });
  PropertiesService.getDocumentProperties().setProperty(
    pmosRuntimeCheckpointKey_(operationType),
    JSON.stringify(payload)
  );
  return payload;
}

function readPmosRuntimeCheckpoint_(operationType) {
  const text = PropertiesService.getDocumentProperties()
    .getProperty(pmosRuntimeCheckpointKey_(operationType));
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function clearPmosRuntimeCheckpoint_(operationType) {
  PropertiesService.getDocumentProperties()
    .deleteProperty(pmosRuntimeCheckpointKey_(operationType));
}

function completePmosRuntimeOperation_(operationType, lock, context) {
  clearPmosRuntimeCheckpoint_(operationType);
  releasePmosRuntimeLock_(lock, context);
}

function abandonPmosRuntimeOperation_(lock, context) {
  releasePmosRuntimeLock_(lock, context);
}
