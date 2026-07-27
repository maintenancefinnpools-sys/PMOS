/**
 * Refined Add Maintenance Client scheduling workflow.
 * Effective date controls service commencement; route rotation remains explicit
 * but PMOS can suggest the least-loaded valid rotation pattern.
 */

function showAddMaintenanceClient() {
  const today = Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{margin:0;padding:18px;font-family:Arial,sans-serif;color:#1f2937}h2{margin:0 0 5px}.muted{font-size:12px;color:#6b7280;line-height:1.45}.grid{display:grid;grid-template-columns:1fr 1fr;gap:11px 14px;margin-top:15px}.full{grid-column:1/-1}label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700}input,select,textarea{width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:7px;font:inherit}textarea{min-height:70px;resize:vertical}.section{grid-column:1/-1;margin-top:6px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:13px;font-weight:700}.note{grid-column:1/-1;padding:9px 10px;background:#eff6ff;border-radius:8px;font-size:12px;line-height:1.45}.suggest{background:#f0fdf4;border:1px solid #bbf7d0}.buttons{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}button{padding:9px 13px;border:0;border-radius:8px;font-weight:700;cursor:pointer}.primary{color:#fff;background:#2563eb}.secondary{background:#e5e7eb}.status{min-height:52px;margin-top:12px;padding:10px;background:#f3f4f6;border-radius:8px;white-space:pre-wrap;font-size:12px}.error{color:#991b1b;background:#fee2e2}button:disabled{opacity:.45}@media(max-width:700px){.grid{grid-template-columns:1fr}.full,.section,.note{grid-column:1}}</style></head><body>
<h2>Add Maintenance Client</h2><div class="muted">Creates the customer, places the route stops, and starts Calendar Sync automatically. The effective date controls when service begins; rotation week controls which route cycle is used.</div>
<div class="grid"><div class="section">Customer information</div>
<label>Customer name<input id="name"></label><label>Service address<input id="address"></label><label>Phone<input id="phone"></label><label>Email<input id="email" type="email"></label><label class="full">Notes<textarea id="notes"></textarea></label>
<div class="section">Maintenance schedule</div>
<label>Frequency<select id="frequency" onchange="scheduleChanged()"><option>Weekly</option><option>Biweekly</option><option>Monthly</option><option>Twice Weekly</option></select></label>
<label>Effective date<input id="effectiveDate" type="date" value="${today}" onchange="scheduleChanged()"></label>
<label>Primary service day<select id="day" onchange="scheduleChanged()"><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option></select></label>
<label id="secondDayLabel" style="display:none">Second service day<select id="secondDay"><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option></select></label>
<label id="weekLabel">Rotation week<select id="week"><option value="1">Week 1</option><option value="2">Week 2</option><option value="3">Week 3</option><option value="4">Week 4</option></select></label>
<label>Stop position<input id="stop" type="number" min="1" placeholder="Add at end of route"></label><label>Calendar title<input id="calendarTitle" placeholder="Defaults to customer name"></label>
<div id="help" class="note"></div><div id="suggestion" class="note suggest">Select a frequency and day, then request a balanced suggestion.</div></div>
<div class="buttons"><button class="secondary" onclick="suggestPlacement()">Suggest Balanced Placement</button><button id="saveButton" class="primary" onclick="saveClient()">Create Client and Sync Calendar</button><button class="secondary" onclick="google.script.host.close()">Cancel</button></div><div id="status" class="status">Ready.</div>
<script>
function byId(id){return document.getElementById(id)}
function scheduleChanged(){const f=byId('frequency').value;byId('secondDayLabel').style.display=f==='Twice Weekly'?'flex':'none';byId('weekLabel').style.display=(f==='Weekly'||f==='Twice Weekly')?'none':'flex';byId('help').textContent=f==='Weekly'?'Weekly creates one stop in all four rotation weeks.':f==='Biweekly'?'Biweekly uses either Weeks 1 & 3 or Weeks 2 & 4. PMOS can suggest the lighter pair.':f==='Monthly'?'Monthly uses one rotation week. PMOS can suggest the lightest week.':'Twice Weekly creates both selected weekdays in all four rotation weeks.'}
function data(){return{name:byId('name').value,address:byId('address').value,phone:byId('phone').value,email:byId('email').value,notes:byId('notes').value,frequency:byId('frequency').value,effectiveDate:byId('effectiveDate').value,week:Number(byId('week').value),day:byId('day').value,secondDay:byId('secondDay').value,stop:byId('stop').value,calendarTitle:byId('calendarTitle').value}}
function suggestPlacement(){byId('suggestion').textContent='Calculating route balance…';google.script.run.withSuccessHandler(r=>{if(r.week)byId('week').value=String(r.week);byId('suggestion').textContent=r.summary}).withFailureHandler(e=>byId('suggestion').textContent=e.message||String(e)).suggestMaintenanceClientPlacement(data())}
function saveClient(){const d=data();if(!d.name.trim()||!d.address.trim()){byId('status').className='status error';byId('status').textContent='Customer name and service address are required.';return}if(d.frequency==='Twice Weekly'&&d.day===d.secondDay){byId('status').className='status error';byId('status').textContent='Twice-weekly service requires two different weekdays.';return}byId('saveButton').disabled=true;byId('status').className='status';byId('status').textContent='Creating customer, route records, and Calendar Sync job…';google.script.run.withSuccessHandler(r=>{byId('status').textContent=r.summary;byId('saveButton').textContent='Created'}).withFailureHandler(e=>{byId('saveButton').disabled=false;byId('status').className='status error';byId('status').textContent=e.message||String(e)}).createMaintenanceClient(d)}
scheduleChanged();
</script></body></html>`).setWidth(780).setHeight(760);
  SpreadsheetApp.getUi().showModalDialog(html, 'Add Maintenance Client');
}

function suggestMaintenanceClientPlacement(input) {
  input = input || {};
  const frequency = normalizeMaintenanceFrequency_(input.frequency);
  const day = normalizeMaintenanceDay_(input.day);
  const ss = SpreadsheetApp.getActive();
  const routeSheet = findFirstSheetByName_(ss, ['4-Week Route Template','PMOS 4-Week Route Template','Route Template']);
  if (!routeSheet) throw new Error('4-Week Route Template sheet was not found.');
  const table = readHeaderTable_(routeSheet);
  const layerIndex = findHeaderIndex_(table.headers, ['Layer','Route Layer','Route Assignment']);
  if (layerIndex < 0) throw new Error('The route template has no Layer column.');
  const counts = {1:0,2:0,3:0,4:0};
  table.rows.forEach(row => { const layer=String(row[layerIndex]||''); const m=layer.match(/week\s*(\d)/i); if(m&&layer.toLowerCase().indexOf(day.toLowerCase())>=0) counts[Number(m[1])]++; });
  if (frequency === 'Biweekly') {
    const odd = counts[1] + counts[3], even = counts[2] + counts[4];
    const week = odd <= even ? 1 : 2;
    return {week, summary:`Suggested ${day} rotation: Weeks ${week} and ${week+2}. Current combined load: ${Math.min(odd,even)} stops versus ${Math.max(odd,even)} on the alternate pair.`};
  }
  if (frequency === 'Monthly') {
    const week = [1,2,3,4].sort((a,b)=>counts[a]-counts[b]||a-b)[0];
    return {week, summary:`Suggested ${day} rotation: Week ${week}, currently the lightest with ${counts[week]} stop(s). Week loads: 1=${counts[1]}, 2=${counts[2]}, 3=${counts[3]}, 4=${counts[4]}.`};
  }
  return {week:1, summary: frequency === 'Twice Weekly' ? 'Twice-weekly service uses both selected weekdays in all four rotation weeks, so no rotation choice is required.' : 'Weekly service uses all four rotation weeks, so no rotation choice is required.'};
}

function normalizeMaintenanceFrequency_(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'weekly') return 'Weekly';
  if (text === 'biweekly' || text === 'bi-weekly' || text === 'every other week') return 'Biweekly';
  if (text === 'monthly') return 'Monthly';
  if (text === 'twice weekly' || text === 'twice-weekly' || text === '2x weekly') return 'Twice Weekly';
  throw new Error('Frequency must be Weekly, Biweekly, Monthly, or Twice Weekly.');
}

function maintenanceWeeksForFrequency_(frequency, firstWeek) {
  if (frequency === 'Weekly' || frequency === 'Twice Weekly') return [1,2,3,4];
  if (frequency === 'Biweekly') return firstWeek % 2 ? [1,3] : [2,4];
  return [firstWeek];
}

function createMaintenanceClient(input) {
  input = input || {};
  const name=String(input.name||'').trim(),address=String(input.address||'').trim(),phone=String(input.phone||'').trim(),email=String(input.email||'').trim(),notes=String(input.notes||'').trim();
  const frequency=normalizeMaintenanceFrequency_(input.frequency),day=normalizeMaintenanceDay_(input.day),secondDay=frequency==='Twice Weekly'?normalizeMaintenanceDay_(input.secondDay):'';
  const effectiveDate=parseMaintenanceStartDate_(input.effectiveDate||input.startDate),firstWeek=Math.max(1,Math.min(4,Number(input.week||1))),requestedStop=Math.max(0,Math.floor(Number(input.stop||0))),calendarTitle=String(input.calendarTitle||name).trim()||name;
  if(!name)throw new Error('Customer name is required.'); if(!address)throw new Error('Service address is required.'); if(frequency==='Twice Weekly'&&day===secondDay)throw new Error('Twice-weekly service requires two different weekdays.');
  const lock=LockService.getDocumentLock(); if(!lock.tryLock(10000))throw new Error('Another PMOS operation is running.');
  let result;
  try {
    const ss=SpreadsheetApp.getActive(),customersSheet=findFirstSheetByName_(ss,['Customers','Customer Database','Customer List']),routeSheet=findFirstSheetByName_(ss,['4-Week Route Template','PMOS 4-Week Route Template','Route Template']);
    if(!customersSheet||!routeSheet)throw new Error('Customers or 4-Week Route Template sheet was not found.');
    let ct=readHeaderTable_(customersSheet),rt=readHeaderTable_(routeSheet);
    ensureMaintenanceClientHeaders_(customersSheet,ct,['Customer ID','Customer Name','Address','Phone','Email','Frequency','Service Start Date','Calendar Title','Notes']);
    ensureMaintenanceClientHeaders_(routeSheet,rt,['Customer ID','Customer Name','Address','Phone','Email','Frequency','Service Start Date','Calendar Title','Layer','Stop Order']);
    ct=readHeaderTable_(customersSheet);rt=readHeaderTable_(routeSheet);assertMaintenanceClientNotDuplicate_(ct,name,address,email);
    const customerId='CUS-'+Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase();
    const values={'Customer ID':customerId,'Customer Name':name,'Name':name,'Customer':name,'Address':address,'Service Address':address,'Phone':phone,'Email':email,'Frequency':frequency,'Service Frequency':frequency,'Service Start Date':effectiveDate,'Start Date':effectiveDate,'Calendar Title':calendarTitle,'Notes':notes,'Details':notes,'Status':'Active'};
    appendMappedMaintenanceRow_(customersSheet,ct,values);
    const weeks=maintenanceWeeksForFrequency_(frequency,firstWeek),days=frequency==='Twice Weekly'?[day,secondDay]:[day],routeRows=[];
    weeks.forEach(week=>days.forEach(serviceDay=>{const layer=`Week ${week} - ${serviceDay}`,stop=requestedStop||nextMaintenanceStopForLayer_(rt,layer),rowValues=Object.assign({},values,{'Layer':layer,'Route Layer':layer,'Week':week,'Rotation Week':week,'Day':serviceDay,'Weekday':serviceDay,'Stop':stop,'Stop Order':stop,'Order':stop});appendMappedMaintenanceRow_(routeSheet,rt,rowValues);routeRows.push({layer,stop});rt.rows.push(mappedMaintenanceRow_(rt.headers,rowValues));}));
    SpreadsheetApp.flush();
    let databaseSync='';try{const s=synchronizeCustomerDatabaseSmart_();databaseSync=`${s.routeRowsUpdated} route row(s) refreshed.`}catch(e){databaseSync=`Database Sync warning: ${e}`}
    result={customerId,routeRows,summary:['Maintenance client created.',`Customer: ${name}`,`Customer ID: ${customerId}`,`Frequency: ${frequency}`,`Effective date: ${Utilities.formatDate(effectiveDate,PMOS.TIMEZONE,'yyyy-MM-dd')}`,`Route placement: ${routeRows.map(r=>`${r.layer}, stop ${r.stop}`).join('; ')}`,databaseSync].join('\n')};
  } finally { lock.releaseLock(); }
  let calendarSummary='Calendar Sync was not available.';
  try { if(typeof startPmosJob==='function'){const job=startPmosJob('CALENDAR_SYNC',true,false);calendarSummary=job&&job.summary?job.summary:'Calendar Sync started automatically.';} } catch(error){calendarSummary=`Client was created, but automatic Calendar Sync reported: ${error}`;}
  result.summary += '\n\n' + calendarSummary;
  return result;
}
