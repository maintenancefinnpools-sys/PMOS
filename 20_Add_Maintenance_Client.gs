/**
 * Add Maintenance Client workflow.
 * Customers is the source of truth. Route recommendations resolve addresses
 * through readRoutesInPhysicalOrder_ instead of requiring duplicate route columns.
 */

function showAddMaintenanceClient() {
  const today = Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{margin:0;padding:18px;font-family:Arial,sans-serif;color:#1f2937}h2{margin:0 0 5px}.muted{font-size:12px;color:#6b7280;line-height:1.45}.grid{display:grid;grid-template-columns:1fr 1fr;gap:11px 14px;margin-top:15px}.full{grid-column:1/-1}label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700}input,select,textarea{width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:7px;font:inherit}textarea{min-height:68px;resize:vertical}.section{grid-column:1/-1;margin-top:6px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:13px;font-weight:700}.note{grid-column:1/-1;padding:9px 10px;background:#eff6ff;border-radius:8px;font-size:12px;line-height:1.45}.recommendations{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.rec{padding:11px;text-align:left;background:#fff;border:2px solid #dbeafe;border-radius:10px;cursor:pointer}.rec:hover{border-color:#60a5fa;background:#f8fbff}.rec.selected{border-color:#2563eb;background:#eff6ff}.rec-title{display:flex;justify-content:space-between;gap:8px;font-size:13px;font-weight:700}.rating{font-size:11px}.rec-route{margin-top:7px;font-size:12px;font-weight:700}.rec-detail{margin-top:5px;color:#4b5563;font-size:11px;line-height:1.4}.manual{grid-column:1/-1;padding:10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:9px}.manual-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.buttons{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}button{padding:9px 13px;border:0;border-radius:8px;font-weight:700;cursor:pointer}.primary{color:#fff;background:#2563eb}.secondary{background:#e5e7eb}.status{min-height:52px;margin-top:12px;padding:10px;background:#f3f4f6;border-radius:8px;white-space:pre-wrap;font-size:12px}.error{color:#991b1b;background:#fee2e2}.address-wrap{position:relative}.address-list{display:none;position:absolute;z-index:20;left:0;right:0;top:100%;max-height:220px;overflow:auto;background:#fff;border:1px solid #cbd5e1;border-radius:0 0 8px 8px;box-shadow:0 8px 18px rgba(15,23,42,.12)}.address-option{display:block;width:100%;padding:9px 10px;text-align:left;background:#fff;border:0;border-bottom:1px solid #e5e7eb;font-weight:400}.address-option:hover{background:#eff6ff}button:disabled{opacity:.45}@media(max-width:760px){.grid{grid-template-columns:1fr}.full,.section,.note,.recommendations,.manual{grid-column:1}.recommendations{grid-template-columns:1fr}.manual-grid{grid-template-columns:1fr}}
</style></head><body>
<h2>Add Maintenance Client</h2><div class="muted">Begin with the address. Weekly is assumed by default; frequency changes recalculate the best weekday and rotation. Recommendations never lock the manual fields.</div>
<div class="grid"><div class="section">Customer information</div>
<label>Customer name<input id="name"></label><label>Service address<div class="address-wrap"><input id="address" autocomplete="off"><div id="addressList" class="address-list"></div></div></label><label>Phone<input id="phone"></label><label>Email<input id="email" type="email"></label><label class="full">Notes<textarea id="notes"></textarea></label>
<div class="section">Maintenance schedule</div><label>Frequency<select id="frequency"><option>Weekly</option><option>Biweekly</option><option>Monthly</option><option>Twice Weekly</option></select></label><label>Effective date<input id="effectiveDate" type="date" value="${today}"></label>
<div id="recommendationStatus" class="note">Enter a service address to calculate recommended weekdays and rotations.</div><div id="recommendations" class="recommendations"></div>
<div class="manual"><div class="muted" style="margin-bottom:8px"><b>Manual placement</b> — selecting a recommendation fills these fields; every value remains editable.</div><div class="manual-grid"><label>Primary service day<select id="day"><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option></select></label><label id="secondDayLabel" style="display:none">Second service day<select id="secondDay"><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option></select></label><label id="weekLabel">Rotation week<select id="week"><option value="1">Week 1</option><option value="2">Week 2</option><option value="3">Week 3</option><option value="4">Week 4</option></select></label><label>Stop position<input id="stop" type="number" min="1" placeholder="Add at end of route"></label><label>Calendar title<input id="calendarTitle" placeholder="Defaults to customer name"></label></div></div></div>
<div class="buttons"><button id="refreshButton" class="secondary">Refresh Recommendations</button><button id="saveButton" class="primary">Create Client and Sync Calendar</button><button id="cancelButton" class="secondary">Cancel</button></div><div id="status" class="status">Ready.</div>
<script>
var recommendationTimer=null,addressTimer=null,recommendationRequest=0,addressRequest=0,currentRecommendations=[];
function byId(id){return document.getElementById(id)}
function escapeHtml(s){return String(s==null?'':s).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})}
function values(){return{name:byId('name').value,address:byId('address').value,phone:byId('phone').value,email:byId('email').value,notes:byId('notes').value,frequency:byId('frequency').value,effectiveDate:byId('effectiveDate').value,week:Number(byId('week').value),day:byId('day').value,secondDay:byId('secondDay').value,stop:byId('stop').value,calendarTitle:byId('calendarTitle').value}}
function scheduleChanged(){var f=byId('frequency').value;byId('secondDayLabel').style.display=f==='Twice Weekly'?'flex':'none';byId('weekLabel').style.display=(f==='Weekly'||f==='Twice Weekly')?'none':'flex';queueRecommendations(true)}
function queueRecommendations(immediate){clearTimeout(recommendationTimer);recommendationTimer=setTimeout(loadRecommendations,immediate?50:650)}
function loadRecommendations(){var d=values(),address=d.address.trim();if(!address){currentRecommendations=[];byId('recommendations').innerHTML='';byId('recommendationStatus').textContent='Enter a service address to calculate recommended weekdays and rotations.';return}var request=++recommendationRequest;byId('recommendationStatus').textContent='Calculating the best route placements…';google.script.run.withSuccessHandler(function(r){if(request!==recommendationRequest)return;currentRecommendations=(r&&r.recommendations)||[];byId('recommendationStatus').textContent=(r&&r.qualityMessage)||'Recommendations calculated.';renderRecommendations()}).withFailureHandler(function(e){if(request!==recommendationRequest)return;currentRecommendations=[];byId('recommendations').innerHTML='';byId('recommendationStatus').textContent='Recommendations could not be calculated. Manual placement remains available.\n'+(e&&e.message?e.message:String(e))}).recommendMaintenanceClientRotations(d)}
function renderRecommendations(){var box=byId('recommendations');box.innerHTML='';currentRecommendations.forEach(function(r,i){var b=document.createElement('button');b.type='button';b.className='rec';b.addEventListener('click',function(){applyRecommendation(i,b)});var between=r.previousName||r.nextName?(r.previousName||'Start of route')+' → New client → '+(r.nextName||'End of route'):'New client at route start';b.innerHTML='<div class="rec-title"><span>'+(i+1)+'. '+escapeHtml(r.label)+'</span><span class="rating">'+escapeHtml(r.rating)+' · '+Math.round(r.score)+'</span></div><div class="rec-route">'+escapeHtml(r.rotationLabel)+'</div><div class="rec-detail">'+escapeHtml(between)+'</div><div class="rec-detail">Added travel: '+Number(r.addedDistanceKm||0).toFixed(1)+' km · Average route: '+Number(r.customerCount||0).toFixed(1)+' stops</div><div class="rec-detail">'+escapeHtml(r.reason||'')+'</div>';box.appendChild(b)})}
function applyRecommendation(i,button){var r=currentRecommendations[i];if(!r)return;Array.prototype.forEach.call(document.getElementsByClassName('rec'),function(x){x.classList.remove('selected')});button.classList.add('selected');byId('day').value=r.day;if(r.secondDay)byId('secondDay').value=r.secondDay;if(r.week)byId('week').value=String(r.week);if(r.position)byId('stop').value=String(r.position);byId('recommendationStatus').textContent='Recommendation selected. Manual fields remain editable.'}
function queueAddressSuggestions(){clearTimeout(addressTimer);var q=byId('address').value.trim();queueRecommendations(false);if(q.length<4){hideAddresses();return}addressTimer=setTimeout(function(){var request=++addressRequest;google.script.run.withSuccessHandler(function(items){if(request!==addressRequest)return;renderAddresses(items||[])}).withFailureHandler(function(){hideAddresses()}).suggestPmosAddresses(q,6)},350)}
function renderAddresses(items){var list=byId('addressList');list.innerHTML='';if(!items.length){hideAddresses();return}items.forEach(function(item){var b=document.createElement('button');b.type='button';b.className='address-option';b.textContent=item.address;b.addEventListener('click',function(){byId('address').value=item.address;hideAddresses();queueRecommendations(true)});list.appendChild(b)});list.style.display='block'}
function hideAddresses(){byId('addressList').style.display='none';byId('addressList').innerHTML=''}
function saveClient(){var d=values();if(!d.name.trim()||!d.address.trim()){byId('status').className='status error';byId('status').textContent='Customer name and service address are required.';return}if(d.frequency==='Twice Weekly'&&d.day===d.secondDay){byId('status').className='status error';byId('status').textContent='Twice-weekly service requires two different weekdays.';return}byId('saveButton').disabled=true;byId('status').className='status';byId('status').textContent='Creating customer, route records, and Calendar Sync job…';google.script.run.withSuccessHandler(function(r){byId('status').textContent=r.summary;byId('saveButton').textContent='Created'}).withFailureHandler(function(e){byId('saveButton').disabled=false;byId('status').className='status error';byId('status').textContent=e&&e.message?e.message:String(e)}).createMaintenanceClient(d)}
byId('frequency').addEventListener('change',scheduleChanged);byId('address').addEventListener('input',queueAddressSuggestions);byId('address').addEventListener('blur',function(){setTimeout(hideAddresses,180)});byId('refreshButton').addEventListener('click',loadRecommendations);byId('saveButton').addEventListener('click',saveClient);byId('cancelButton').addEventListener('click',function(){google.script.host.close()});scheduleChanged();
</script></body></html>`).setWidth(900).setHeight(840);
  SpreadsheetApp.getUi().showModalDialog(html, 'Add Maintenance Client');
}

function recommendMaintenanceClientRotations(input) {
  input = input || {};
  const address = String(input.address || '').trim();
  if (!address) throw new Error('Enter the service address.');
  const frequency = normalizeMaintenanceFrequency_(input.frequency || 'Weekly');
  const geocoder = Maps.newGeocoder().setRegion('ca');
  const target = geocodePmosAddress_(geocoder, address);
  const routes = readRoutesInPhysicalOrder_();
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const candidates = [];
  if (frequency === 'Weekly') days.forEach(day => candidates.push({day,weeks:[1,2,3,4]}));
  else if (frequency === 'Biweekly') days.forEach(day => { candidates.push({day,weeks:[1,3]}); candidates.push({day,weeks:[2,4]}); });
  else if (frequency === 'Monthly') days.forEach(day => [1,2,3,4].forEach(week => candidates.push({day,weeks:[week]})));
  else for (let a=0;a<days.length;a++) for (let b=a+1;b<days.length;b++) candidates.push({day:days[a],secondDay:days[b],weeks:[1,2,3,4]});
  const scored = candidates.map(candidate => scoreMaintenanceRotationCandidate_(routes, geocoder, target, candidate)).filter(Boolean);
  scored.sort((a,b) => b.score-a.score || a.addedDistanceKm-b.addedDistanceKm || a.customerCount-b.customerCount || a.day.localeCompare(b.day));
  const recommendations = scored.slice(0,3).map(item => {
    item.label = item.secondDay ? `${item.day} + ${item.secondDay}` : item.day;
    item.rotationLabel = item.weeks.length===4 ? 'Every rotation week' : item.weeks.length===2 ? `Weeks ${item.weeks[0]} & ${item.weeks[1]}` : `Week ${item.weeks[0]}`;
    item.week = item.weeks[0];
    item.rating = item.score>=90?'Excellent':item.score>=80?'Very Good':item.score>=70?'Good':item.score>=55?'Fair':'Last Resort';
    item.reason = item.addedDistanceKm<=3?'Adds very little travel to the current route structure.':item.addedDistanceKm<=8?'A practical route fit with only a modest detour.':item.addedDistanceKm<=15?'Adds some travel but remains a reasonable placement.':'This is one of the best available placements, but it adds substantial travel.';
    return item;
  });
  return {recommendations, qualityMessage: recommendations.length ? `Best ${frequency.toLowerCase()} placements based primarily on geographic route fit.` : 'No usable route placements were found. Manual placement remains available.'};
}

function scoreMaintenanceRotationCandidate_(routes, geocoder, target, candidate) {
  const serviceDays = candidate.secondDay ? [candidate.day,candidate.secondDay] : [candidate.day];
  const placements = [];
  candidate.weeks.forEach(week => serviceDays.forEach(day => placements.push(maintenanceLayerInsertion_(routes, geocoder, target, `Week ${week} - ${day}`))));
  if (!placements.length) return null;
  const averageAdded = placements.reduce((s,p)=>s+p.addedDistanceKm,0)/placements.length;
  const averageCentroid = placements.reduce((s,p)=>s+p.centroidDistanceKm,0)/placements.length;
  const averageCount = placements.reduce((s,p)=>s+p.customerCount,0)/placements.length;
  const routeScale = Math.max(12,Math.min(80,averageCount*4));
  const distanceScore = Math.max(0,100-Math.min(75,(averageAdded/routeScale)*100));
  const continuityScore = Math.max(0,100-Math.min(50,averageCentroid*1.6));
  const loadPenalty = Math.max(0,averageCount-15)*0.7;
  const primary = placements[0];
  return {day:candidate.day,secondDay:candidate.secondDay||'',weeks:candidate.weeks.slice(),position:primary.position,previousName:primary.previousName,nextName:primary.nextName,addedDistanceKm:averageAdded,centroidDistanceKm:averageCentroid,customerCount:averageCount,score:Math.max(0,Math.min(100,Math.round(distanceScore*.7+continuityScore*.3-loadPenalty)))};
}

function maintenanceLayerInsertion_(routes, geocoder, target, layerName) {
  const rows = routes.filter(row => normalize_(row.layer) === normalize_(layerName)).sort((a,b)=>Number(a.order||0)-Number(b.order||0));
  const points = rows.map(row => row.address ? geocodePmosAddress_(geocoder,row.address,true) : null);
  const valid = points.filter(Boolean);
  if (!rows.length || !valid.length) return {position:1,previousName:'',nextName:'',addedDistanceKm:0,centroidDistanceKm:0,customerCount:rows.length};
  let bestPosition=1,bestAdded=Number.POSITIVE_INFINITY;
  for(let position=0;position<=rows.length;position++){
    const previous=position>0?points[position-1]:null,next=position<points.length?points[position]:null;
    let added=0;if(previous)added+=pmosHaversineKm_(previous,target);if(next)added+=pmosHaversineKm_(target,next);if(previous&&next)added-=pmosHaversineKm_(previous,next);
    if(added<bestAdded){bestAdded=added;bestPosition=position+1;}
  }
  const centroid={lat:valid.reduce((s,p)=>s+p.lat,0)/valid.length,lng:valid.reduce((s,p)=>s+p.lng,0)/valid.length};
  return {position:bestPosition,previousName:bestPosition>1?String(rows[bestPosition-2].title||''):'',nextName:bestPosition<=rows.length?String(rows[bestPosition-1].title||''):'',addedDistanceKm:bestAdded,centroidDistanceKm:pmosHaversineKm_(target,centroid),customerCount:rows.length};
}

function createMaintenanceClient(input) {
  input = input || {};
  const name = String(input.name || '').trim();
  const address = String(input.address || '').trim();
  const phone = String(input.phone || '').trim();
  const email = String(input.email || '').trim();
  const notes = String(input.notes || '').trim();
  const frequency = normalizeMaintenanceFrequency_(input.frequency);
  const day = normalizeMaintenanceDay_(input.day);
  const secondDay = frequency === 'Twice Weekly' ? normalizeMaintenanceDay_(input.secondDay) : '';
  const effectiveDate = parseMaintenanceStartDate_(input.effectiveDate || input.startDate);
  const firstWeek = Math.max(1, Math.min(4, Number(input.week || 1)));
  const requestedStop = Math.max(0, Math.floor(Number(input.stop || 0)));
  const calendarTitle = String(input.calendarTitle || name).trim() || name;
  if (!name) throw new Error('Customer name is required.');
  if (!address) throw new Error('Service address is required.');
  if (frequency === 'Twice Weekly' && day === secondDay) throw new Error('Twice-weekly service requires two different weekdays.');

  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) throw new Error('Another PMOS operation is running.');
  let result;
  const appended = [];
  try {
    const ss = SpreadsheetApp.getActive();
    const customersSheet = findFirstSheetByName_(ss, ['Customers','Customer Database','Customer List']);
    const routeSheet = findFirstSheetByName_(ss, ['4-Week Route Template','PMOS 4-Week Route Template','Route Template']);
    if (!customersSheet || !routeSheet) throw new Error('Customers or 4-Week Route Template sheet was not found.');
    let ct = readHeaderTable_(customersSheet);
    let rt = readHeaderTable_(routeSheet);
    ensureMaintenanceClientHeaders_(customersSheet, ct, ['Customer ID','Calendar Title','Full Address','Primary Phone','Email','Frequency','Service Start Date','Customer Notes']);
    ensureMaintenanceClientHeaders_(routeSheet, rt, ['Customer ID','Calendar Title','Layer','Stop Order']);
    ct = readHeaderTable_(customersSheet);
    rt = readHeaderTable_(routeSheet);
    assertMaintenanceClientNotDuplicate_(ct, name, address, email);

    const customerId = 'CUS-' + Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase();
    const sharedValues = {'Customer ID':customerId,'Customer Name':name,'Name':name,'Customer':name,'Full Name(s)':name,'Calendar Title':calendarTitle,'Address':address,'Full Address':address,'Service Address':address,'Street Address':address,'Phone':phone,'Phone Number':phone,'Primary Phone':phone,'Email':email,'Email Address':email,'Frequency':frequency,'Service Frequency':frequency,'Service Start Date':effectiveDate,'Start Date':effectiveDate,'Notes':notes,'Customer Notes':notes,'Details':notes,'Status':'Active'};
    const customerRow = appendMappedMaintenanceRow_(customersSheet, ct, sharedValues);
    appended.push({sheet:customersSheet,row:customersSheet.getLastRow()});

    const weeks = maintenanceWeeksForFrequency_(frequency, firstWeek);
    const days = frequency === 'Twice Weekly' ? [day,secondDay] : [day];
    const routeRows = [];
    weeks.forEach(week => days.forEach(serviceDay => {
      const layer = `Week ${week} - ${serviceDay}`;
      const stop = requestedStop || nextMaintenanceStopForLayer_(rt, layer);
      if (requestedStop) makeRoomForMaintenanceStop_(routeSheet, rt, layer, stop);
      const rowValues = Object.assign({}, sharedValues, {'Layer':layer,'Route Layer':layer,'Week':week,'Rotation Week':week,'Day':serviceDay,'Weekday':serviceDay,'Stop':stop,'Stop Order':stop,'Order':stop});
      const row = appendMappedMaintenanceRow_(routeSheet, rt, rowValues);
      appended.push({sheet:routeSheet,row:routeSheet.getLastRow()});
      routeRows.push({layer,stop});
      rt.rows.push(row);
    }));
    SpreadsheetApp.flush();

    let databaseSync = '';
    try {
      const sync = synchronizeCustomerDatabaseSmart_();
      databaseSync = `${sync.routeRowsUpdated} route row(s) refreshed.`;
    } catch (error) {
      databaseSync = `Database Sync warning: ${error.message || error}`;
    }
    result = {customerId,routeRows,summary:['Maintenance client created.',`Customer: ${name}`,`Customer ID: ${customerId}`,`Frequency: ${frequency}`,`Effective date: ${Utilities.formatDate(effectiveDate,PMOS.TIMEZONE,'yyyy-MM-dd')}`,`Route placement: ${routeRows.map(r=>`${r.layer}, stop ${r.stop}`).join('; ')}`,databaseSync].join('\n')};
  } catch (error) {
    rollbackMaintenanceClientRows_(appended);
    throw error;
  } finally {
    lock.releaseLock();
  }

  let calendarSummary;
  try {
    if (typeof startCalendarAutoContinue !== 'function') throw new Error('Calendar Auto-Continue is unavailable.');
    const status = startCalendarAutoContinue();
    calendarSummary = Number(status && status.remaining || 0) > 0
      ? `Calendar Sync queued with ${status.remaining} pending change(s).`
      : 'Calendar is already synchronized.';
  } catch (error) {
    calendarSummary = `Client was created, but automatic Calendar Sync reported: ${error.message || error}`;
  }
  result.summary += '\n\n' + calendarSummary;
  return result;
}

function makeRoomForMaintenanceStop_(sheet, table, layer, stop) {
  const values = sheet.getDataRange().getValues();
  const layerIndex = findHeaderIndex_(table.headers, ['Layer','Route Layer','Route Assignment']);
  const stopIndex = findHeaderIndex_(table.headers, ['Stop Order','Stop','Order']);
  if (layerIndex < 0 || stopIndex < 0) return;
  for (let row = values.length - 1; row >= table.headerRow; row--) {
    if (normalizeSyncValue_(values[row][layerIndex]) !== normalizeSyncValue_(layer)) continue;
    const current = Number(values[row][stopIndex] || 0);
    if (Number.isFinite(current) && current >= stop) sheet.getRange(row + 1, stopIndex + 1).setValue(current + 1);
  }
  table.rows.forEach(row => {
    if (normalizeSyncValue_(row[layerIndex]) !== normalizeSyncValue_(layer)) return;
    const current = Number(row[stopIndex] || 0);
    if (Number.isFinite(current) && current >= stop) row[stopIndex] = current + 1;
  });
}

function rollbackMaintenanceClientRows_(appended) {
  appended.slice().reverse().forEach(item => {
    try { if (item.sheet && item.row <= item.sheet.getLastRow()) item.sheet.deleteRow(item.row); } catch (ignored) {}
  });
}

function normalizeMaintenanceFrequency_(value){const text=String(value||'').trim().toLowerCase();if(text==='weekly')return'Weekly';if(text==='biweekly'||text==='bi-weekly'||text==='every other week')return'Biweekly';if(text==='monthly')return'Monthly';if(text==='twice weekly'||text==='twice-weekly'||text==='2x weekly')return'Twice Weekly';throw new Error('Frequency must be Weekly, Biweekly, Monthly, or Twice Weekly.');}
function normalizeMaintenanceDay_(value){const text=String(value||'').trim();const days=['Monday','Tuesday','Wednesday','Thursday','Friday'];const match=days.find(day=>day.toLowerCase()===text.toLowerCase());if(!match)throw new Error('Service day must be Monday through Friday.');return match;}
function parseMaintenanceStartDate_(value){const text=String(value||'').trim(),match=text.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)throw new Error('Service start date must use YYYY-MM-DD.');const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),date=new Date(year,month-1,day,0,0,0,0);if(!Number.isFinite(date.getTime())||date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day)throw new Error('Service start date is invalid.');return date;}
function maintenanceWeeksForFrequency_(frequency,firstWeek){if(frequency==='Weekly'||frequency==='Twice Weekly')return[1,2,3,4];if(frequency==='Biweekly')return firstWeek%2?[1,3]:[2,4];return[firstWeek];}
function ensureMaintenanceClientHeaders_(sheet,table,required){const normalized=table.headers.map(normalizeSyncHeader_),missing=required.filter(header=>normalized.indexOf(normalizeSyncHeader_(header))<0);if(!missing.length)return;sheet.getRange(table.headerRow,table.headers.length+1,1,missing.length).setValues([missing]);}
function assertMaintenanceClientNotDuplicate_(table,name,address,email){const nameIndex=findHeaderIndex_(table.headers,['Customer Name','Full Name(s)','Name','Customer','Calendar Title']),addressIndex=findHeaderIndex_(table.headers,['Full Address','Address','Service Address','Street Address']),emailIndex=findHeaderIndex_(table.headers,['Email','Email Address']),targetName=normalizeSyncValue_(name),targetAddress=normalizeSyncValue_(address),targetEmail=normalizeSyncValue_(email),duplicate=table.rows.find(row=>{const rowName=nameIndex>=0?normalizeSyncValue_(row[nameIndex]):'',rowAddress=addressIndex>=0?normalizeSyncValue_(row[addressIndex]):'',rowEmail=emailIndex>=0?normalizeSyncValue_(row[emailIndex]):'';return(targetEmail&&rowEmail===targetEmail)||(rowName===targetName&&rowAddress===targetAddress)});if(duplicate)throw new Error('A matching customer already exists. No new records were created.');}
function mappedMaintenanceRow_(headers,valuesByHeader){const normalizedValues={};Object.keys(valuesByHeader).forEach(key=>normalizedValues[normalizeSyncHeader_(key)]=valuesByHeader[key]);return headers.map(header=>{const key=normalizeSyncHeader_(header);return Object.prototype.hasOwnProperty.call(normalizedValues,key)?normalizedValues[key]:''});}
function appendMappedMaintenanceRow_(sheet,table,valuesByHeader){const row=mappedMaintenanceRow_(table.headers,valuesByHeader);sheet.getRange(sheet.getLastRow()+1,1,1,table.headers.length).setValues([row]);return row;}
function nextMaintenanceStopForLayer_(routeTable,layer){const layerIndex=findHeaderIndex_(routeTable.headers,['Layer','Route Layer','Route Assignment']),stopIndex=findHeaderIndex_(routeTable.headers,['Stop Order','Stop','Order']);let maximum=0;routeTable.rows.forEach(row=>{if(layerIndex<0||normalizeSyncValue_(row[layerIndex])!==normalizeSyncValue_(layer))return;const value=stopIndex>=0?Number(row[stopIndex]||0):0;if(Number.isFinite(value))maximum=Math.max(maximum,value)});return maximum+1;}
