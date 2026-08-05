/**
 * Final Calendar Sync preview for an approved Calendar Review Session.
 *
 * This window displays the exact approved plan. Execution is handed to the
 * shared Job Center only after the user approves the preview.
 */
function openReviewedCalendarSyncPreview() {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  if (!audit.reviewComplete) {
    throw new Error('Calendar review is not complete. Finish all review items before opening Calendar Sync Preview.');
  }

  const preview = audit.preview || previewPmosCalendarSyncPlan();
  const reviewed = (preview.reviewedActions || []).slice();
  const counts = countPmosReviewedCalendarActions_(reviewed);
  const resolutionErrors = Number(preview.reviewResolutionErrors || 0);
  const executorPending = Boolean(preview.reviewExecutorPending);

  const reviewedRows = reviewed.length
    ? reviewed.map(function (item) {
        return '<div class="review-row ' + escapePmosSyncPreviewHtml_(String(item.reviewAction || '').toLowerCase()) + '">' +
          '<div class="review-action">' + escapePmosSyncPreviewHtml_(formatPmosReviewedActionLabel_(item.reviewAction)) + '</div>' +
          '<div class="review-title">' + escapePmosSyncPreviewHtml_(item.title || item.entityId || 'Calendar event') + '</div>' +
          (item.customerName ? '<div class="review-meta">Customer: ' + escapePmosSyncPreviewHtml_(item.customerName) + '</div>' : '') +
          '<div class="review-reason">' + escapePmosSyncPreviewHtml_(item.reason || '') + '</div>' +
        '</div>';
      }).join('')
    : '<div class="empty">No reviewed Calendar event actions are attached to this plan.</div>';

  const blockedText = resolutionErrors > 0
    ? resolutionErrors + ' reviewed action(s) could not be resolved safely.'
    : executorPending
      ? 'Reviewed event execution support is not connected yet. The plan can be inspected, but not approved.'
      : '';

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:18px;color:#1f2937}h2{margin:0 0 4px}.muted{font-size:13px;color:#64748b}.section{margin-top:15px;border:1px solid #e2e8f0;border-radius:10px;padding:13px}.section h3{margin:0 0 10px}.section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.section-head h3{margin:0}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.metric{border:1px solid #e2e8f0;border-radius:8px;padding:9px;background:#f8fafc}.metric span{display:block;font-size:11px;color:#64748b}.metric strong{display:block;margin-top:3px;font-size:17px}.review-list{max-height:205px;overflow:auto;transition:max-height .18s ease}.review-list.expanded{max-height:405px}.review-row{border:1px solid #e2e8f0;border-left:5px solid #64748b;border-radius:9px;padding:10px;margin:8px 0}.review-row.link_customer{border-left-color:#2563eb}.review-row.register_temporary_visit{border-left-color:#d97706}.review-row.preserve_event{border-left-color:#64748b}.review-row.delete_approved_event{border-left-color:#dc2626}.review-action{font-size:11px;font-weight:900;letter-spacing:.2px}.review-title{font-weight:700;margin-top:3px}.review-meta,.review-reason{font-size:12px;color:#475569;margin-top:3px}.toggle{padding:6px 9px;background:#f1f5f9;color:#334155;font-size:12px;white-space:nowrap}.notice{margin-top:14px;padding:11px;border-radius:9px;background:#fef3c7;color:#92400e;font-weight:700}.actions{display:flex;gap:8px;margin-top:14px}button{border:0;border-radius:8px;padding:10px 13px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e2e8f0;color:#1f2937}button:disabled{opacity:.5;cursor:default}.empty{color:#64748b;font-size:13px}
</style></head><body>
<h2>Calendar Sync Preview</h2><div class="muted">Review the approved plan for ${escapePmosSyncPreviewHtml_(preview.calendarName || '')} before sending it to the Job Center.</div>
<div class="section"><h3>Recurring schedule changes</h3><div class="metrics">
<div class="metric"><span>Create</span><strong>${Number(preview.creates || 0)}</strong></div>
<div class="metric"><span>Update</span><strong>${Number(preview.updates || 0)}</strong></div>
<div class="metric"><span>Delete</span><strong>${Number(preview.deletes || 0)}</strong></div>
</div></div>
<div class="section"><div class="section-head"><h3>Reviewed Event Actions</h3>${reviewed.length > 3 ? '<button id="toggleReviewList" class="toggle" type="button" onclick="toggleReviewedEvents()">Show More</button>' : ''}</div><div class="metrics">
<div class="metric"><span>Customer matches</span><strong>${counts.match}</strong></div>
<div class="metric"><span>Temporary Visits</span><strong>${counts.temporary}</strong></div>
<div class="metric"><span>Keep events</span><strong>${counts.keep}</strong></div>
<div class="metric"><span>Approved deletions</span><strong>${counts.delete}</strong></div>
<div class="metric"><span>Total reviewed</span><strong>${counts.total}</strong></div>
<div class="metric"><span>Resolution errors</span><strong>${resolutionErrors}</strong></div>
</div><div id="reviewList" class="review-list">${reviewedRows}</div></div>
${blockedText ? '<div class="notice">' + escapePmosSyncPreviewHtml_(blockedText) + '</div>' : ''}
<div class="actions"><button class="primary" ${executorPending || resolutionErrors ? 'disabled' : ''} onclick="approveSync(this)">Approve</button><button class="secondary" onclick="google.script.host.close()">Close</button></div>
<script>
function toggleReviewedEvents(){var list=document.getElementById('reviewList'),button=document.getElementById('toggleReviewList');if(!list||!button)return;var expanded=list.classList.toggle('expanded');button.textContent=expanded?'Show Less':'Show More';}
function approveSync(button){button.disabled=true;button.textContent='Opening Job Center…';google.script.run.withSuccessHandler(function(){google.script.host.close();}).withFailureHandler(function(e){button.disabled=false;button.textContent='Approve';alert(e&&e.message?e.message:String(e));}).prepareApprovedCalendarSyncAndOpenJobCenter();}
</script></body></html>`).setWidth(860).setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(html, 'Calendar Sync Preview');
  return {
    opened: true,
    reviewSessionId: preview.reviewSessionId || '',
    reviewedActionCount: reviewed.length,
    reviewedActionCounts: counts,
    executorPending: executorPending,
    resolutionErrors: resolutionErrors
  };
}

function prepareApprovedCalendarSyncAndOpenJobCenter() {
  const audit = runVerifiedCalendarPlanAuditReadOnly_();
  if (!audit.canSync) {
    throw new Error('Calendar review is no longer ready for synchronization. Reopen Calendar Plan Audit.');
  }

  const existing = readPmosJobState_();
  if (existing && existing.id) {
    deletePmosJobOperationQueue_(existing.id);
  }
  removePmosJobTrigger_();

  const state = newPmosJobState_('CALENDAR_SYNC');
  state.status = 'Ready';
  state.planId = String(audit.planId || '');
  state.auditedPlanId = String(audit.planId || '');
  state.auditedAt = new Date().toISOString();
  state.calendarOptions = readPmosCalendarAuditOptions_();
  state.reviewSessionId = String(audit.reviewSessionId || '');
  state.operationQueueInitialized = false;
  state.operationProviderFinalized = false;
  state.processedItems = 0;
  state.originalTotal = 0;
  state.remaining = null;
  state.autoEnabled = false;
  state.pauseRequested = false;
  state.lastError = '';
  state.lastSummary = 'Approved Calendar Sync is ready to start.';
  state.nextRunAt = '';
  writePmosJobState_(state);

  openPmosJobEngine('CALENDAR_SYNC');
  return {opened: true, prepared: true, planId: state.planId};
}

function countPmosReviewedCalendarActions_(reviewedActions) {
  const counts = {match: 0, temporary: 0, keep: 0, delete: 0, total: 0};
  (reviewedActions || []).forEach(function (item) {
    switch (String(item && item.reviewAction || '').toUpperCase()) {
      case 'LINK_CUSTOMER': counts.match++; break;
      case 'REGISTER_TEMPORARY_VISIT': counts.temporary++; break;
      case 'PRESERVE_EVENT': counts.keep++; break;
      case 'DELETE_APPROVED_EVENT': counts.delete++; break;
    }
    counts.total++;
  });
  return counts;
}

function formatPmosReviewedActionLabel_(action) {
  switch (String(action || '')) {
    case 'LINK_CUSTOMER': return 'LINK TO CUSTOMER';
    case 'REGISTER_TEMPORARY_VISIT': return 'REGISTER TEMPORARY VISIT';
    case 'PRESERVE_EVENT': return 'KEEP THIS EVENT';
    case 'DELETE_APPROVED_EVENT': return 'DELETE APPROVED EVENT';
    default: return 'REVIEWED ACTION';
  }
}

function escapePmosSyncPreviewHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
