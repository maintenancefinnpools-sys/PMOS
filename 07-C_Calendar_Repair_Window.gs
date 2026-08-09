/**
 * Calendar Repair window and compatibility entry.
 *
 * Calendar Sync belongs exclusively to the reviewed Audit -> Review Session ->
 * durable queue -> Job Center workflow. This module owns only the explicit
 * historical Calendar Repair launcher/UI.
 */
function showIntegratedPmosJobEngine(initialType) {
  if (initialType && String(initialType) !== 'CALENDAR_REPAIR') {
    return openPmosJobEngine(initialType);
  }

  const today = Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
  const userProperties = PropertiesService.getUserProperties();
  const savedStart = userProperties.getProperty('PMOS_LAST_REPAIR_START') || today;
  const savedEnd = userProperties.getProperty('PMOS_LAST_REPAIR_END') || today;

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{margin:0;padding:18px;font-family:Arial,sans-serif;color:#1f2937;background:#fff}h2{margin:0 0 5px}.muted{font-size:13px;color:#6b7280;line-height:1.45}.fields{margin-top:16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;display:flex;gap:12px;flex-wrap:wrap}.field{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700}.field input{padding:8px;border:1px solid #cbd5e1;border-radius:7px;font:inherit}.status{margin-top:14px;min-height:130px;padding:12px;background:#f3f4f6;border-radius:9px;white-space:pre-wrap;font-size:13px;line-height:1.45}.error{display:none;margin-top:10px;padding:10px;background:#fee2e2;color:#991b1b;border-radius:8px;white-space:pre-wrap}.buttons{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}button{border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e2e8f0;color:#1f2937}button:disabled{opacity:.5;cursor:default}
</style></head><body>
<h2>Calendar Repair</h2>
<div class="muted">Repair is an explicit historical recovery tool. It does not replace Calendar Plan Audit or the reviewed Calendar Sync workflow.</div>
<div class="fields"><label class="field">Begin date<input id="start" type="date" value="${savedStart}"></label><label class="field">End date<input id="end" type="date" value="${savedEnd}"></label></div>
<div id="status" class="status">Choose a date range, preview the repair plan, and review it before applying changes.</div>
<div id="error" class="error"></div>
<div class="buttons"><button id="preview" class="secondary">Preview Repair</button><button id="edit" class="secondary">Expand Preview / Edit Route Order</button><button id="apply" class="primary">Apply Previewed Repair</button><button id="close" class="secondary">Close</button></div>
<script>
(function(){
var busy=false;
function el(id){return document.getElementById(id);}
function dates(){return{start:el('start').value,end:el('end').value};}
function validate(){var d=dates();if(!d.start||!d.end)throw new Error('Choose both a begin date and an end date.');if(d.start>d.end)throw new Error('Begin date cannot be after end date.');return d;}
function setBusy(value){busy=value;['preview','edit','apply'].forEach(function(id){el(id).disabled=value;});}
function fail(error){setBusy(false);el('error').style.display='block';el('error').textContent=error&&error.message?error.message:String(error);}
function success(result){setBusy(false);el('error').style.display='none';el('status').textContent=result&&result.summary?result.summary:JSON.stringify(result||{},null,2);}
function remember(d){google.script.run.withFailureHandler(function(){}).rememberCalendarRepairDates(d.start,d.end);}
el('preview').onclick=function(){try{var d=validate();remember(d);setBusy(true);el('status').textContent='Building repair preview…';google.script.run.withSuccessHandler(success).withFailureHandler(fail).previewCalendarRepairPlan(d.start,d.end);}catch(error){fail(error);}};
el('edit').onclick=function(){try{var d=validate();remember(d);setBusy(true);el('status').textContent='Opening editable repair board…';google.script.run.withSuccessHandler(success).withFailureHandler(fail).openCalendarRepairBoard(d.start,d.end);}catch(error){fail(error);}};
el('apply').onclick=function(){try{var d=validate();if(!confirm('Apply the currently previewed Calendar repair plan?'))return;remember(d);setBusy(true);el('status').textContent='Applying reviewed Calendar repair…';google.script.run.withSuccessHandler(success).withFailureHandler(fail).applyCalendarRepairPlan(d.start,d.end);}catch(error){fail(error);}};
el('close').onclick=function(){google.script.host.close();};
})();
</script></body></html>`).setWidth(680).setHeight(500);

  SpreadsheetApp.getUi().showModalDialog(html, 'Calendar Repair');
  return {opened:true};
}

function rememberCalendarRepairDates(start, end) {
  const properties = PropertiesService.getUserProperties();
  if (start) properties.setProperty('PMOS_LAST_REPAIR_START', String(start));
  if (end) properties.setProperty('PMOS_LAST_REPAIR_END', String(end));
  return {start:String(start || ''), end:String(end || '')};
}
