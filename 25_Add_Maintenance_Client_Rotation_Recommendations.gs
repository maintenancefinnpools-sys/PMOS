/**
 * Automatic rotation-based recommendations for Add Maintenance Client.
 * Loaded after the earlier workflow modules so these public functions become
 * the active implementation without deleting the preserved earlier versions.
 */

function showAddMaintenanceClient() {
  const today = Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{margin:0;padding:18px;font-family:Arial,sans-serif;color:#1f2937}h2{margin:0 0 5px}.muted{font-size:12px;color:#6b7280;line-height:1.45}.grid{display:grid;grid-template-columns:1fr 1fr;gap:11px 14px;margin-top:15px}.full{grid-column:1/-1}label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700}input,select,textarea{width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:7px;font:inherit}textarea{min-height:68px;resize:vertical}.section{grid-column:1/-1;margin-top:6px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:13px;font-weight:700}.note{grid-column:1/-1;padding:9px 10px;background:#eff6ff;border-radius:8px;font-size:12px;line-height:1.45}.recommendations{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.rec{padding:11px;text-align:left;background:#fff;border:2px solid #dbeafe;border-radius:10px;cursor:pointer}.rec:hover{border-color:#60a5fa;background:#f8fbff}.rec.selected{border-color:#2563eb;background:#eff6ff}.rec-title{display:flex;justify-content:space-between;gap:8px;font-size:13px;font-weight:700}.rating{font-size:11px}.rec-route{margin-top:7px;font-size:12px;font-weight:700}.rec-detail{margin-top:5px;color:#4b5563;font-size:11px;line-height:1.4}.manual{grid-column:1/-1;padding:10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:9px}.manual-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.buttons{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}button{padding:9px 13px;border:0;border-radius:8px;font-weight:700;cursor:pointer}.primary{color:#fff;background:#2563eb}.secondary{background:#e5e7eb}.status{min-height:52px;margin-top:12px;padding:10px;background:#f3f4f6;border-radius:8px;white-space:pre-wrap;font-size:12px}.error{color:#991b1b;background:#fee2e2}button:disabled{opacity:.45}@media(max-width:760px){.grid{grid-template-columns:1fr}.full,.section,.note,.recommendations,.manual{grid-column:1}.recommendations{grid-template-columns:1fr}.manual-grid{grid-template-columns:1fr}}
</style></head><body>
<h2>Add Maintenance Client</h2><div class="muted">Enter the service address to see the best route placements. Weekly is assumed initially. Changing frequency automatically recalculates the recommendations. Any recommended value can still be manually overridden.</div>
<div class="grid"><div class="section">Customer information</div>
<label>Customer name<input id="name"></label><label>Service address<input id="address" oninput="queueRecommendations()"></label><label>Phone<input id="phone"></label><label>Email<input id="email" type="email"></label><label class="full">Notes<textarea id="notes"></textarea></label>
<div class="section">Maintenance schedule</div>
<label>Frequency<select id="frequency" onchange="scheduleChanged()"><option>Weekly</option><option>Biweekly</option><option>Monthly</option><option>Twice Weekly</option></select></label>
<label>Effective date<input id="effectiveDate" type="date" value="${today}"></label>
<div id="recommendationStatus" class="note">Enter a service address to calculate recommended weekdays and rotations.</div>
<div id="recommendations" class="recommendations"></div>
<div class="manual"><div class="muted" style="margin-bottom:8px"><b>Manual placement</b> — selecting a recommendation fills these fields, but you may change any of them.</div><div class="manual-grid">
<label>Primary service day<select id="day"><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option></select></label>
<label id="secondDayLabel" style="display:none">Second service day<select id="secondDay"><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option></select></label>
<label id="weekLabel">Rotation week<select id="week"><option value="1">Week 1</option><option value="2">Week 2</option><option value="3">Week 3</option><option value="4">Week 4</option></select></label>
<label>Stop position<input id="stop" type="number" min="1" placeholder="Add at end of route"></label><label>Calendar title<input id="calendarTitle" placeholder="Defaults to customer name"></label>
</div></div></div>
<div class="buttons"><button class="secondary" onclick="loadRecommendations()">Refresh Recommendations</button><button id="saveButton" class="primary" onclick="saveClient()">Create Client and Sync Calendar</button><button class="secondary" onclick="google.script.host.close()">Cancel</button></div><div id="status" class="status">Ready.</div>
<script>
let recommendationTimer=null,recommendationRequest=0,currentRecommendations=[];
function byId(id){return document.getElementById(id)}
function values(){return{name:byId('name').value,address:byId('address').value,phone:byId('phone').value,email:byId('email').value,notes:byId('notes').value,frequency:byId('frequency').value,effectiveDate:byId('effectiveDate').value,week:Number(byId('week').value),day:byId('day').value,secondDay:byId('secondDay').value,stop:byId('stop').value,calendarTitle:byId('calendarTitle').value}}
function scheduleChanged(){const f=byId('frequency').value;byId('secondDayLabel').style.display=f==='Twice Weekly'?'flex':'none';byId('weekLabel').style.display=(f==='Weekly'||f==='Twice Weekly')?'none':'flex';queueRecommendations(true)}
function queueRecommendations(immediate){clearTimeout(recommendationTimer);recommendationTimer=setTimeout(loadRecommendations,immediate?50:650)}
function loadRecommendations(){const d=values(),address=d.address.trim();if(!address){currentRecommendations=[];byId('recommendations').innerHTML='';byId('recommendationStatus').textContent='Enter a service address to calculate recommended weekdays and rotations.';return}const request=++recommendationRequest;byId('recommendationStatus').textContent='Calculating the best route placements…';google.script.run.withSuccessHandler(r=>{if(request!==recommendationRequest)return;currentRecommendations=(r&&r.recommendations)||[];byId('recommendationStatus').textContent=(r&&r.qualityMessage)||'Recommendations calculated.';renderRecommendations()}).withFailureHandler(e=>{if(request!==recommendationRequest)return;currentRecommendations=[];byId('recommendations').innerHTML='';byId('recommendationStatus').textContent=e&&e.message?e.message:String(e)}).recommendMaintenanceClientRotations(d)}
function renderRecommendations(){const box=byId('recommendations');box.innerHTML='';currentRecommendations.forEach((r,i)=>{const b=document.createElement('button');b.type='button';b.className='rec';b.onclick=()=>applyRecommendation(i,b);const between=r.previousName||r.nextName?((r.previousName||'Start of route')+' → New client → '+(r.nextName||'End of route')):'New client at route start';b.innerHTML='<div class="rec-title"><span>'+(i+1)+'. '+escapeHtml(r.label)+'</span><span class="rating">'+escapeHtml(r.rating)+' · '+Math.round(r.score)+'</span></div><div class="rec-route">'+escapeHtml(r.rotationLabel)+'</div><div class="rec-detail">'+escapeHtml(between)+'</div><div class="rec-detail">Added travel: '+Number(r.addedDistanceKm||0).toFixed(1)+' km · Average route: '+Number(r.customerCount||0).toFixed(1)+' stops</div><div class="rec-detail">'+escapeHtml(r.reason||'')+'</div>';box.appendChild(b)})}
function applyRecommendation(i,button){const r=currentRecommendations[i];if(!r)return;Array.from(document.getElementsByClassName('rec')).forEach(x=>x.classList.remove('selected'));button.classList.add('selected');byId('day').value=r.day;if(r.secondDay)byId('secondDay').value=r.secondDay;if(r.week)byId('week').value=String(r.week);if(r.position)byId('stop').value=String(r.position);byId('recommendationStatus').textContent='Recommendation selected. Manual fields remain editable.'}
function escapeHtml(s){return String(s==null?'':s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function saveClient(){const d=values();if(!d.name.trim()||!d.address.trim()){byId('status').className='status error';byId('status').textContent='Customer name and service address are required.';return}if(d.frequency==='Twice Weekly'&&d.day===d.secondDay){byId('status').className='status error';byId('status').textContent='Twice-weekly service requires two different weekdays.';return}byId('saveButton').disabled=true;byId('status').className='status';byId('status').textContent='Creating customer, route records, and Calendar Sync job…';google.script.run.withSuccessHandler(r=>{byId('status').textContent=r.summary;byId('saveButton').textContent='Created'}).withFailureHandler(e=>{byId('saveButton').disabled=false;byId('status').className='status error';byId('status').textContent=e&&e.message?e.message:String(e)}).createMaintenanceClient(d)}
scheduleChanged();
</script></body></html>`).setWidth(900).setHeight(820);
  SpreadsheetApp.getUi().showModalDialog(html, 'Add Maintenance Client');
}

function recommendMaintenanceClientRotations(input) {
  input = input || {};
  const address = String(input.address || '').trim();
  if (!address) throw new Error('Enter the service address.');
  const frequency = normalizeMaintenanceFrequency_(input.frequency || 'Weekly');
  const ss = SpreadsheetApp.getActive();
  const routeSheet = findFirstSheetByName_(ss, ['4-Week Route Template','PMOS 4-Week Route Template','Route Template']);
  if (!routeSheet) throw new Error('4-Week Route Template sheet was not found.');
  const table = readHeaderTable_(routeSheet);
  const geocoder = Maps.newGeocoder();
  const target = geocodePmosAddress_(geocoder, address);
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const candidates = [];

  if (frequency === 'Weekly') {
    days.forEach(day => candidates.push({day, weeks:[1,2,3,4]}));
  } else if (frequency === 'Biweekly') {
    days.forEach(day => { candidates.push({day,weeks:[1,3]}); candidates.push({day,weeks:[2,4]}); });
  } else if (frequency === 'Monthly') {
    days.forEach(day => [1,2,3,4].forEach(week => candidates.push({day,weeks:[week]})));
  } else {
    for (let a=0;a<days.length;a++) for (let b=a+1;b<days.length;b++) candidates.push({day:days[a],secondDay:days[b],weeks:[1,2,3,4]});
  }

  const scored = candidates.map(candidate => scoreMaintenanceRotationCandidate_(table, geocoder, target, candidate)).filter(Boolean);
  scored.sort((a,b) => b.score-a.score || a.addedDistanceKm-b.addedDistanceKm || a.customerCount-b.customerCount || a.day.localeCompare(b.day));
  const recommendations = scored.slice(0,3).map((item,index) => {
    item.label = item.secondDay ? `${item.day} + ${item.secondDay}` : item.day;
    item.rotationLabel = item.weeks.length===4 ? 'Every rotation week' : item.weeks.length===2 ? `Weeks ${item.weeks[0]} & ${item.weeks[1]}` : `Week ${item.weeks[0]}`;
    item.week = item.weeks[0];
    item.rating = item.score>=90?'Excellent':item.score>=80?'Very Good':item.score>=70?'Good':item.score>=55?'Fair':'Last Resort';
    item.reason = item.addedDistanceKm<=3?'Adds very little travel to the current route structure.':item.addedDistanceKm<=8?'A practical route fit with only a modest detour.':item.addedDistanceKm<=15?'Adds some travel but remains a reasonable placement.':'This is one of the best available placements, but it adds substantial travel.';
    return item;
  });
  return {recommendations, qualityMessage: recommendations.length ? `Best ${frequency.toLowerCase()} placements based primarily on geographic route fit.` : 'No usable route placements were found.'};
}

function scoreMaintenanceRotationCandidate_(table, geocoder, target, candidate) {
  const days = candidate.secondDay ? [candidate.day,candidate.secondDay] : [candidate.day];
  const placements = [];
  candidate.weeks.forEach(week => days.forEach(day => {
    const layer = `Week ${week} - ${day}`;
    const placement = maintenanceLayerInsertion_(table, geocoder, target, layer);
    if (placement) placements.push(placement);
  }));
  if (!placements.length) return null;
  const averageAdded = placements.reduce((s,p)=>s+p.addedDistanceKm,0)/placements.length;
  const averageCentroid = placements.reduce((s,p)=>s+p.centroidDistanceKm,0)/placements.length;
  const averageCount = placements.reduce((s,p)=>s+p.customerCount,0)/placements.length;
  const routeScale = Math.max(12,Math.min(80,averageCount*4));
  const distanceScore = Math.max(0,100-Math.min(75,(averageAdded/routeScale)*100));
  const continuityScore = Math.max(0,100-Math.min(50,averageCentroid*1.6));
  const loadPenalty = Math.max(0,averageCount-15)*0.7;
  const score = Math.max(0,Math.min(100,Math.round(distanceScore*0.7+continuityScore*0.3-loadPenalty)));
  const primary = placements[0];
  return {day:candidate.day,secondDay:candidate.secondDay||'',weeks:candidate.weeks.slice(),position:primary.position,previousName:primary.previousName,nextName:primary.nextName,addedDistanceKm:averageAdded,centroidDistanceKm:averageCentroid,customerCount:averageCount,score};
}

function maintenanceLayerInsertion_(table, geocoder, target, layerName) {
  const layerIndex = findHeaderIndex_(table.headers,['Layer','Route Layer','Route Assignment']);
  const addressIndex = findHeaderIndex_(table.headers,['Address','Service Address','Street Address']);
  const nameIndex = findHeaderIndex_(table.headers,['Customer Name','Name','Customer','Calendar Title']);
  const stopIndex = findHeaderIndex_(table.headers,['Stop Order','Stop','Order']);
  if (layerIndex<0 || addressIndex<0) throw new Error('The route template requires Layer and Address columns.');
  const rows = table.rows.filter(row=>String(row[layerIndex]||'').trim().toLowerCase()===layerName.toLowerCase()).sort((a,b)=>Number(a[stopIndex]||0)-Number(b[stopIndex]||0));
  const points = rows.map(row=>geocodePmosAddress_(geocoder,String(row[addressIndex]||'').trim(),true));
  const valid = points.filter(Boolean);
  if (!rows.length || !valid.length) return {position:1,previousName:'',nextName:'',addedDistanceKm:0,centroidDistanceKm:0,customerCount:rows.length};
  let bestPosition=1,bestAdded=Number.POSITIVE_INFINITY;
  for(let position=0;position<=rows.length;position++){
    const previous=position>0?points[position-1]:null,next=position<points.length?points[position]:null;
    let added=0;if(previous)added+=pmosHaversineKm_(previous,target);if(next)added+=pmosHaversineKm_(target,next);if(previous&&next)added-=pmosHaversineKm_(previous,next);
    if(added<bestAdded){bestAdded=added;bestPosition=position+1;}
  }
  const centroid={lat:valid.reduce((s,p)=>s+p.lat,0)/valid.length,lng:valid.reduce((s,p)=>s+p.lng,0)/valid.length};
  return {position:bestPosition,previousName:bestPosition>1?String(rows[bestPosition-2][nameIndex]||''):'',nextName:bestPosition<=rows.length?String(rows[bestPosition-1][nameIndex]||''):'',addedDistanceKm:bestAdded,centroidDistanceKm:pmosHaversineKm_(target,centroid),customerCount:rows.length};
}
