/**
 * User-facing review for incomplete Calendar registry transactions.
 *
 * This window explains recovery state in operational language. It does not
 * modify Calendar or registry data merely by opening. "Run recovery analysis"
 * applies only deterministic recovery rules; ambiguous items remain blocked.
 */
function showCalendarTransactionRecoveryReview() {
  const report = inspectPmosCalendarTransactionRecovery_();
  const items = report.items || [];
  const body = items.length
    ? items.map(function (item) {
        return '<div class="item ' + escapePmosRecoveryHtml_(item.level) + '">' +
          '<div class="heading">' + escapePmosRecoveryHtml_(item.title) + '</div>' +
          '<div class="details">' + escapePmosRecoveryHtml_(item.explanation) + '</div>' +
          '<div class="meta">Series: ' + escapePmosRecoveryHtml_(item.seriesKey || 'Unknown') + '</div>' +
          '<div class="meta">Operation: ' + escapePmosRecoveryHtml_(item.action || 'Unknown') + '</div>' +
          '<div class="meta">Transaction status: ' + escapePmosRecoveryHtml_(item.transactionStatus || 'Unknown') + '</div>' +
          '<div class="next"><b>Next step:</b> ' + escapePmosRecoveryHtml_(item.nextStep) + '</div>' +
          '</div>';
      }).join('')
    : '<div class="empty">No interrupted Calendar transactions require recovery.</div>';

  const html = HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><base target="_top"><style>' +
    'body{font-family:Arial,sans-serif;padding:18px;color:#1f2937;background:#f8fafc}' +
    'h2{margin:0 0 5px}.muted{color:#64748b;font-size:13px;margin-bottom:14px}' +
    '.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:14px}' +
    '.metric{background:#fff;border:1px solid #e2e8f0;border-radius:9px;padding:10px}' +
    '.metric span{display:block;color:#64748b;font-size:12px}.metric strong{display:block;margin-top:4px}' +
    '.item{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin:10px 0}' +
    '.manual{border-left:5px solid #dc2626}.retry{border-left:5px solid #d97706}.recoverable{border-left:5px solid #2563eb}' +
    '.heading{font-weight:700}.details{margin-top:6px;white-space:pre-wrap}.meta{margin-top:5px;color:#64748b;font-size:12px}' +
    '.next{margin-top:9px;padding:8px;background:#f1f5f9;border-radius:7px}.empty{background:#fff;border-radius:10px;padding:16px}' +
    '.actions{position:sticky;bottom:0;background:#f8fafc;padding-top:12px;display:flex;gap:8px}' +
    'button{border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e2e8f0}' +
    '#message{margin-top:10px;white-space:pre-wrap;color:#334155}' +
    '</style></head><body>' +
    '<h2>Calendar Transaction Recovery</h2>' +
    '<div class="muted">Review interrupted Calendar operations before starting another synchronization.</div>' +
    '<div class="summary">' +
      '<div class="metric"><span>Interrupted</span><strong>' + Number(report.total || 0) + '</strong></div>' +
      '<div class="metric"><span>Safe to retry</span><strong>' + Number(report.retryRequired || 0) + '</strong></div>' +
      '<div class="metric"><span>Manual review</span><strong>' + Number(report.manualReview || 0) + '</strong></div>' +
    '</div>' + body +
    '<div id="message"></div>' +
    '<div class="actions"><button class="primary" id="recover">Run recovery analysis</button><button class="secondary" onclick="google.script.host.close()">Close</button></div>' +
    '<script>' +
      'document.getElementById("recover").onclick=function(){var button=this;button.disabled=true;document.getElementById("message").textContent="Checking Calendar and registry state…";' +
      'google.script.run.withSuccessHandler(function(result){document.getElementById("message").textContent="Recovery analysis complete. Finalized: "+Number(result.finalized||0)+"; safe to retry: "+Number(result.retryRequired||0)+"; manual review: "+Number(result.manualReview||0)+". Close and reopen this window to refresh the list.";button.disabled=false;})' +
      '.withFailureHandler(function(error){document.getElementById("message").textContent=error&&error.message?error.message:String(error);button.disabled=false;})' +
      '.runCalendarTransactionRecoveryAnalysis();};' +
    '</script></body></html>'
  ).setWidth(790).setHeight(690);

  SpreadsheetApp.getUi().showModalDialog(html, 'Calendar Transaction Recovery');
  return report;
}

function runCalendarTransactionRecoveryAnalysis() {
  return recoverPmosCalendarRegistryTransactions_();
}

function inspectPmosCalendarTransactionRecovery_() {
  const transactions = readRecoverablePmosCalendarTransactions_();
  const items = transactions.map(function (transaction) {
    return describePmosCalendarRecoveryItem_(transaction);
  });
  return {
    total: items.length,
    retryRequired: items.filter(function (item) { return item.level === 'retry'; }).length,
    manualReview: items.filter(function (item) { return item.level === 'manual'; }).length,
    items: items
  };
}

function describePmosCalendarRecoveryItem_(transaction) {
  const action = String(transaction.action || '').toUpperCase();
  const failed = transaction.status === 'FAILED';
  const base = {
    transactionId: transaction.transactionId,
    seriesKey: transaction.seriesKey,
    action: action,
    transactionStatus: transaction.status
  };

  if (!transaction.seriesKey || ['CREATE', 'UPDATE', 'DELETE'].indexOf(action) < 0) {
    return Object.assign(base, {
      level: 'manual',
      title: 'Manual review required',
      explanation: transaction.lastError || 'PMOS cannot safely identify this interrupted operation.',
      nextStep: 'Review the Calendar Registry History row before attempting another synchronization.'
    });
  }

  if (failed && /more than one recurring calendar series/i.test(transaction.lastError || '')) {
    return Object.assign(base, {
      level: 'manual',
      title: 'Duplicate recurring series detected',
      explanation: transaction.lastError,
      nextStep: 'Use Calendar Plan Audit deletion review to decide which duplicate should remain.'
    });
  }

  if (failed && transaction.lastError) {
    return Object.assign(base, {
      level: 'manual',
      title: 'Operation failed and needs review',
      explanation: transaction.lastError,
      nextStep: 'Correct the reported problem, then run recovery analysis again.'
    });
  }

  return Object.assign(base, {
    level: 'retry',
    title: 'Interrupted operation can be checked safely',
    explanation: action === 'DELETE'
      ? 'PMOS will verify whether the approved deletion already occurred and will remove only a stale registry link when proven safe.'
      : 'PMOS will verify whether the recurring series already exists. Missing work will remain available for idempotent retry.',
    nextStep: 'Run recovery analysis. PMOS will finalize proven work or leave the operation queued for safe retry.'
  });
}

function escapePmosRecoveryHtml_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
  });
}
