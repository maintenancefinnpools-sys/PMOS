/* ========================================================================== */
/* PMOS READ-ONLY DEVELOPER DIAGNOSTICS                                       */
/* ========================================================================== */

/**
 * Opens a read-only PMOS system-health report.
 *
 * This module deliberately avoids repair actions. It inspects the current
 * spreadsheet, project triggers, persistent properties, Calendar registry,
 * and shared Job Engine status without mutating production state.
 */
function showPmosSystemHealth() {
  const report = getPmosSystemHealth_();
  const html = HtmlService.createHtmlOutput(renderPmosSystemHealthHtml_(report))
    .setWidth(760)
    .setHeight(680);

  SpreadsheetApp.getUi().showModalDialog(html, 'PMOS System Health');
}

/**
 * Returns a serializable health report for testing, logging, or future UI use.
 */
function getPmosSystemHealth() {
  return getPmosSystemHealth_();
}

function getPmosSystemHealth_() {
  const checks = [];
  const details = {};
  let spreadsheet = null;

  try {
    spreadsheet = SpreadsheetApp.getActive();
    addPmosHealthCheck_(checks, 'Spreadsheet', Boolean(spreadsheet), 'Active spreadsheet is available.');
  } catch (error) {
    addPmosHealthCheck_(checks, 'Spreadsheet', false, pmosDiagnosticError_(error));
  }

  inspectPmosSheets_(spreadsheet, checks, details);
  inspectPmosTriggers_(checks, details);
  inspectPmosProperties_(checks, details);
  inspectPmosJobEngine_(checks, details);
  inspectPmosCalendarRegistry_(spreadsheet, checks, details);

  const critical = checks.filter(check => check.status === 'critical').length;
  const warnings = checks.filter(check => check.status === 'warning').length;
  const healthy = checks.filter(check => check.status === 'healthy').length;

  return {
    generatedAt: new Date().toISOString(),
    overallStatus: critical ? 'Critical' : (warnings ? 'Warning' : 'Healthy'),
    counts: { healthy, warnings, critical },
    checks,
    details
  };
}

function inspectPmosSheets_(spreadsheet, checks, details) {
  if (!spreadsheet) return;

  try {
    const sheets = spreadsheet.getSheets();
    details.sheets = sheets.map(sheet => ({
      name: sheet.getName(),
      hidden: sheet.isSheetHidden(),
      rows: sheet.getMaxRows(),
      columns: sheet.getMaxColumns()
    }));

    const duplicateNames = duplicatePmosValues_(details.sheets.map(sheet => sheet.name));
    addPmosHealthCheck_(
      checks,
      'Sheet names',
      duplicateNames.length === 0,
      duplicateNames.length ? `Duplicate names: ${duplicateNames.join(', ')}` : `${sheets.length} sheets detected.`
    );
  } catch (error) {
    addPmosHealthCheck_(checks, 'Sheet inventory', false, pmosDiagnosticError_(error));
  }
}

function inspectPmosTriggers_(checks, details) {
  try {
    const triggers = ScriptApp.getProjectTriggers().map(trigger => ({
      handler: trigger.getHandlerFunction(),
      source: String(trigger.getTriggerSource()),
      eventType: String(trigger.getEventType()),
      uniqueId: trigger.getUniqueId()
    }));
    details.triggers = triggers;

    const duplicateHandlers = duplicatePmosValues_(triggers.map(trigger => trigger.handler));
    if (duplicateHandlers.length) {
      addPmosHealthCheck_(
        checks,
        'Project triggers',
        'warning',
        `Repeated handlers detected: ${duplicateHandlers.join(', ')}. Confirm these are intentional.`
      );
    } else {
      addPmosHealthCheck_(checks, 'Project triggers', true, `${triggers.length} project triggers detected; no repeated handlers.`);
    }
  } catch (error) {
    addPmosHealthCheck_(checks, 'Project triggers', false, pmosDiagnosticError_(error));
  }
}

function inspectPmosProperties_(checks, details) {
  try {
    const documentProperties = PropertiesService.getDocumentProperties().getProperties();
    const userProperties = PropertiesService.getUserProperties().getProperties();

    details.properties = {
      documentKeys: Object.keys(documentProperties).sort(),
      userKeys: Object.keys(userProperties).sort()
    };

    addPmosHealthCheck_(
      checks,
      'Persistent properties',
      true,
      `${details.properties.documentKeys.length} document keys and ${details.properties.userKeys.length} user keys detected.`
    );
  } catch (error) {
    addPmosHealthCheck_(checks, 'Persistent properties', false, pmosDiagnosticError_(error));
  }
}

function inspectPmosJobEngine_(checks, details) {
  try {
    if (typeof getPmosJobStatus !== 'function') {
      addPmosHealthCheck_(checks, 'Job Engine', 'warning', 'getPmosJobStatus() is not available in this deployment.');
      return;
    }

    const status = getPmosJobStatus();
    details.job = status;

    const failed = status && /error/i.test(String(status.status || ''));
    const paused = status && /paused/i.test(String(status.status || ''));
    const message = `${status.label || 'No active job'} — ${status.status || 'Idle'}`;

    if (failed) {
      addPmosHealthCheck_(checks, 'Job Engine', false, `${message}${status.lastError ? `: ${status.lastError}` : ''}`);
    } else if (paused) {
      addPmosHealthCheck_(checks, 'Job Engine', 'warning', message);
    } else {
      addPmosHealthCheck_(checks, 'Job Engine', true, message);
    }
  } catch (error) {
    addPmosHealthCheck_(checks, 'Job Engine', false, pmosDiagnosticError_(error));
  }
}

function inspectPmosCalendarRegistry_(spreadsheet, checks, details) {
  if (!spreadsheet) return;

  try {
    const possibleNames = ['Calendar Series Registry', 'PMOS Calendar Series Registry'];
    const registry = possibleNames
      .map(name => spreadsheet.getSheetByName(name))
      .filter(Boolean)[0];

    if (!registry) {
      addPmosHealthCheck_(checks, 'Calendar registry', 'warning', 'No recognized Calendar Series Registry sheet was found.');
      return;
    }

    const lastRow = registry.getLastRow();
    const lastColumn = registry.getLastColumn();
    details.calendarRegistry = {
      sheetName: registry.getName(),
      rows: Math.max(0, lastRow - 1),
      columns: lastColumn,
      hidden: registry.isSheetHidden()
    };

    addPmosHealthCheck_(
      checks,
      'Calendar registry',
      true,
      `${details.calendarRegistry.rows} registry records detected in ${registry.getName()}.`
    );
  } catch (error) {
    addPmosHealthCheck_(checks, 'Calendar registry', false, pmosDiagnosticError_(error));
  }
}

function addPmosHealthCheck_(checks, name, result, message) {
  let status;
  if (result === 'warning') status = 'warning';
  else if (result === true) status = 'healthy';
  else status = 'critical';

  checks.push({ name, status, message: String(message || '') });
}

function duplicatePmosValues_(values) {
  const seen = Object.create(null);
  const duplicates = Object.create(null);

  values.forEach(value => {
    const key = String(value || '').trim();
    if (!key) return;
    if (seen[key]) duplicates[key] = true;
    seen[key] = true;
  });

  return Object.keys(duplicates).sort();
}

function pmosDiagnosticError_(error) {
  return String(error && error.message ? error.message : error);
}

function renderPmosSystemHealthHtml_(report) {
  const escape = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const rows = report.checks.map(check => {
    const icon = check.status === 'healthy' ? '✓' : (check.status === 'warning' ? '⚠' : '✕');
    return `<tr class="${escape(check.status)}"><td class="icon">${icon}</td><td><strong>${escape(check.name)}</strong><div>${escape(check.message)}</div></td></tr>`;
  }).join('');

  const details = escape(JSON.stringify(report.details, null, 2));

  return `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body{font-family:Arial,sans-serif;color:#1f2937;margin:0;padding:20px;background:#f8fafc}
    h2{margin:0 0 5px}.muted{color:#64748b;font-size:13px}.summary{display:flex;gap:10px;margin:16px 0}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;min-width:110px}
    .card strong{display:block;font-size:22px}.overall{font-weight:700}
    table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
    td{padding:11px;border-bottom:1px solid #e2e8f0;vertical-align:top}tr:last-child td{border-bottom:0}.icon{width:24px;font-weight:700}
    .healthy .icon{color:#166534}.warning .icon{color:#a16207}.critical .icon{color:#b91c1c}
    td div{margin-top:3px;color:#475569;font-size:13px;line-height:1.4}
    details{margin-top:14px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px}
    pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;color:#334155}
  </style>
</head>
<body>
  <h2>PMOS System Health</h2>
  <div class="muted">Read-only report generated ${escape(report.generatedAt)}</div>
  <div class="summary">
    <div class="card"><span>Overall</span><strong class="overall">${escape(report.overallStatus)}</strong></div>
    <div class="card"><span>Healthy</span><strong>${escape(report.counts.healthy)}</strong></div>
    <div class="card"><span>Warnings</span><strong>${escape(report.counts.warnings)}</strong></div>
    <div class="card"><span>Critical</span><strong>${escape(report.counts.critical)}</strong></div>
  </div>
  <table>${rows}</table>
  <details><summary>Technical details</summary><pre>${details}</pre></details>
</body>
</html>`;
}
