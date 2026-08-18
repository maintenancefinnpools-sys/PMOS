/**
 * Modern Temporary Visit dialog. Reuses PMOS address and route intelligence,
 * while keeping the legacy scheduler available during development testing.
 */
function showTemporaryVisitSchedulerV2() {
  const html = HtmlService.createHtmlOutput(`<!doctype html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{margin:0;padding:18px;font-family:Arial,sans-serif;color:#1f2937;background:#f8fafc}h2{margin:0 0 5px}.muted{font-size:12px;color:#64748b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px;margin-top:16px}.full{grid-column:1/-1}label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700}input,textarea{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;background:#fff}textarea{min-height:72px;resize:vertical}.section{grid-column:1/-1;margin-top:5px;padding-top:11px;border-top:1px solid #e2e8f0;font-size:13px;font-weight:700}.address-wrap{position:relative}.address-list{display:none;position:absolute;z-index:50;left:0;right:0;top:100%;max-height:235px;overflow:auto;background:#fff;border:1px solid #94a3b8;border-radius:0 0 8px 8px;box-shadow:0 10px 22px rgba(15,23,42,.18)}.address-option{display:block;width:100%;border:0;border-bottom:1px solid #e2e8f0;background:#fff;padding:10px;text-align:left;cursor:pointer}.address-option:hover,.address-option.active{background:#dbeafe}.address-details,.address-status{display:none;grid-column:1/-1;padding:9px 10px;border-radius:8px;font-size:12px}.address-details{background:#ecfdf5;border:1px solid #86efac;color:#166534}.address-status{background:#eff6ff;color:#1d4ed8}.date-suggestions{display:none;grid-column:1/-1;border:1px solid #dbeafe;border-radius:10px;background:#fff;padding:12px}.date-suggestions h3{font-size:13px;margin:0 0 8px}.date-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.date-option{width:100%;min-height:130px;text-align:left;background:#fff;border:2px solid #dbeafe;padding:10px;border-radius:9px;cursor:pointer}.date-option:hover{background:#eff6ff;border-color:#60a5fa}.date-meta{font-size:11px;color:#475569;line-height:1.4;margin-top:4px}.visit-card{grid-column:1/-1;border:1px solid #d1d5db;border-radius:10px;padding:12px;background:#fff}.visit-head{display:flex;justify-content:space-between;align-items:center}.visit-grid{display:grid;grid-template-columns:minmax(150px,.8fr) 90px minmax(180px,1fr);gap:10px}.recommendation{margin-top:9px;padding:9px;border-radius:8px;background:#f1f5f9;white-space:pre-line;font-size:12px}.good{background:#dcfce7;color:#166534}.fair{background:#fef3c7;color:#92400e}.poor{background:#fee2e2;color:#991b1b}.buttons{display:flex;gap:8px;margin-top:16px}button{padding:9px 13px;border:0;border-radius:8px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e2e8f0;color:#1f2937}.small{padding:7px 9px}.status{display:none;margin-top:12px;padding:10px;border-radius:8px;background:#f1f5f9;white-space:pre-line;font-size:12px}.error{background:#fee2e2;color:#991b1b}.success{background:#dcfce7;color:#166534}@media(max-width:700px){.grid,.date-grid,.visit-grid{grid-template-columns:1fr}.full,.section,.date-suggestions,.visit-card{grid-column:1}}
</style></head><body>
<h2>Add Temporary Visit(s)</h2><div class="muted">Enter the service address first. PMOS will suggest the best upcoming route placements while you complete the customer details.</div>
<div class="grid">
<label class="full">Service address<div class="address-wrap"><input id="address" autocomplete="off" placeholder="Begin typing address"><div id="addressList" class="address-list"></div></div></label><div id="addressStatus" class="address-status"></div><div id="addressDetails" class="address-details"></div>
<div class="section">Customer & contact information</div>
<label>Last name<input id="lastName" autocomplete="family-name"></label><label>First name<input id="firstName" autocomplete="given-name"></label><label>Phone<input id="phone" autocomplete="tel" inputmode="numeric" maxlength="16" placeholder="(___) ___ - ____"></label><label>Email<input id="email" type="email" autocomplete="email"></label>
<div id="dateSuggestions" class="date-suggestions"></div>
<div class="section">Visit placement</div><div id="visits"></div><button id="addVisit" type="button" class="secondary small" style="grid-column:1/-1;justify-self:start">+ Add Another Visit</button>
<div class="section">Visit information</div><label class="full">Entry information<textarea id="entryInformation" placeholder="Gate code, access details, special instructions..."></textarea></label><label class="full">Customer / service notes<textarea id="notes" placeholder="Customer preferences or service notes..."></textarea></label>
</div>
<div class="buttons"><button id="save" class="primary">Schedule Visit(s)</button><button id="close" class="secondary">Close</button></div><div id="status" class="status"></div>
<script>(function(){
var address=document.getElementById('address'),addressList=document.getElementById('addressList'),addressStatus=document.getElementById('addressStatus'),addressDetails=document.getElementById('addressDetails'),lastName=document.getElementById('lastName'),firstName=document.getElementById('firstName'),phone=document.getElementById('phone'),email=document.getElementById('email'),entry=document.getElementById('entryInformation'),notes=document.getElementById('notes'),dateSuggestions=document.getElementById('dateSuggestions'),visits=document.getElementById('visits'),status=document.getElementById('status'),save=document.getElementById('save');
var selectedAddress=null,addressTimer=null,addressToken=0,addressOptions=[],activeAddress=-1,dateToken=0,visitCount=0,calendarTitleEdited=false;
function setStatus(t,k){status.textContent=t||'';status.className='status '+(k||'');status.style.display=t?'block':'none'}
function titleCaseInput(e){var i=e.target,s=i.selectionStart,en=i.selectionEnd,v=String(i.value||''),n=v.replace(/(^|[\\s\'-])([a-z])/g,function(m,p,l){return p+l.toUpperCase()});if(n!==v){i.value=n;if(s!=null)i.setSelectionRange(s,en)}}
function formatPhone(){var d=String(phone.value||'').replace(/\\D/g,'').slice(0,10),v='';if(d.length)v='('+d.slice(0,3);if(d.length>=3)v+=') '+d.slice(3,6);if(d.length>=6)v+=' - '+d.slice(6,10);phone.value=v}
function closeAddresses(){addressList.style.display='none';addressList.innerHTML='';addressOptions=[];activeAddress=-1}
function addressMessage(t){addressStatus.textContent=t||'';addressStatus.style.display=t?'block':'none'}
function clearConfirmed(){selectedAddress=null;addressDetails.style.display='none';dateSuggestions.style.display='none';dateSuggestions.innerHTML=''}
function renderAddresses(items){addressOptions=items||[];activeAddress=-1;addressList.innerHTML='';if(!addressOptions.length){closeAddresses();addressMessage('No complete nearby addresses found. Continue typing or check the address.');return}addressOptions.forEach(function(item,index){var b=document.createElement('button');b.type='button';b.className='address-option';b.textContent=item.address;b.onmousedown=function(e){e.preventDefault();chooseAddress(index)};addressList.appendChild(b)});addressList.style.display='block';addressMessage('Choose the complete service address.')}
function setAddressActive(index){if(!addressOptions.length)return;activeAddress=(index+addressOptions.length)%addressOptions.length;Array.prototype.forEach.call(addressList.querySelectorAll('.address-option'),function(b,i){b.classList.toggle('active',i===activeAddress)});var b=addressList.querySelectorAll('.address-option')[activeAddress];if(b)b.scrollIntoView({block:'nearest'})}
function chooseAddress(index){var item=addressOptions[index];if(!item)return;closeAddresses();addressMessage('Confirming address…');google.script.run.withSuccessHandler(function(result){selectedAddress=result;address.value=result.address;addressDetails.textContent='Confirmed: '+result.address;addressDetails.style.display='block';addressMessage('Address confirmed. Calculating the best upcoming route placements…');loadDateSuggestions()}).withFailureHandler(function(e){clearConfirmed();addressMessage(e&&e.message?e.message:String(e))}).confirmPmosSelectedAddress(item)}
function queueAddress(){clearTimeout(addressTimer);var q=address.value.trim();if(selectedAddress&&q.toLowerCase()!==String(selectedAddress.address||'').toLowerCase())clearConfirmed();if(q.length<3){closeAddresses();addressMessage(q?'Keep typing to load address suggestions.':'');return}var token=++addressToken;addressTimer=setTimeout(function(){google.script.run.withSuccessHandler(function(items){if(token!==addressToken)return;renderAddresses(items)}).withFailureHandler(function(e){if(token!==addressToken)return;closeAddresses();addressMessage('Address suggestions unavailable: '+(e&&e.message?e.message:String(e)))}).suggestPmosAddresses(q,6)},160)}
function loadDateSuggestions(){if(!selectedAddress)return;var token=++dateToken;dateSuggestions.style.display='block';dateSuggestions.innerHTML='<h3>Best upcoming dates</h3><div class="muted">Comparing upcoming weekday routes…</div>';google.script.run.withSuccessHandler(function(result){if(token!==dateToken)return;renderDates((result&&result.recommendations)||[])}).withFailureHandler(function(e){if(token!==dateToken)return;dateSuggestions.innerHTML='<h3>Best upcoming dates</h3><div class="muted">'+(e&&e.message?e.message:String(e))+'</div>'}).recommendTemporaryVisitDates({address:address.value,addressVerified:true,addressDetails:selectedAddress,startOffsetWorkingDays:0,workdayCount:6,maxResults:3})}
function renderDates(items){dateSuggestions.innerHTML='<h3>Best upcoming dates</h3>';if(!items.length){dateSuggestions.innerHTML+='<div class="muted">No weekday route recommendations were available.</div>';return}var grid=document.createElement('div');grid.className='date-grid';items.forEach(function(r,i){var b=document.createElement('button');b.type='button';b.className='date-option';b.innerHTML='<b>'+(i+1)+'. '+r.displayDate+'</b><div class="date-meta"><b>'+r.rating+'</b> · Week '+r.rotationWeek+'</div><div class="date-meta">Stop '+r.position+' of '+(Number(r.customerCount||0)+1)+'</div><div class="date-meta">'+(r.roadDataComplete?('Added: +'+Math.round(r.addedDurationMinutes)+' min · +'+Number(r.addedDistanceKm||0).toFixed(1)+' km'):r.reason)+'</div>';b.onclick=function(){selectSuggestedDate(r.date)};grid.appendChild(b)});dateSuggestions.appendChild(grid)}
function selectSuggestedDate(date){var cards=visits.querySelectorAll('.visit-card'),target=null;for(var i=0;i<cards.length;i++){if(!cards[i].querySelector('.visit-date').value){target=cards[i];break}}if(!target)target=addVisitCard();target.querySelector('.visit-date').value=date;refreshPlacement(target)}
function addVisitCard(){visitCount++;var card=document.createElement('div');card.className='visit-card';card.innerHTML='<div class="visit-head"><b>Visit #'+visitCount+'</b><button type="button" class="secondary small remove">Remove</button></div><div class="visit-grid"><label>Date<input class="visit-date" type="date"></label><label>Stop<input class="visit-stop" type="number" min="1" value="1"></label><label>Calendar title<input class="calendar-title" placeholder="Defaults to last name"></label></div><div class="recommendation">Choose a date to calculate stop placement.</div>';visits.appendChild(card);var title=card.querySelector('.calendar-title');title.value=lastName.value.trim();title.oninput=function(){calendarTitleEdited=true};card.querySelector('.remove').style.display=visitCount===1?'none':'inline-block';card.querySelector('.remove').onclick=function(){card.remove();renumberVisits()};card.querySelector('.visit-date').onchange=function(){refreshPlacement(card)};card.querySelector('.visit-stop').oninput=function(){card.dataset.manual='true'};return card}
function renumberVisits(){var cards=visits.querySelectorAll('.visit-card');Array.prototype.forEach.call(cards,function(c,i){c.querySelector('.visit-head b').textContent='Visit #'+(i+1);c.querySelector('.remove').style.display=i?'inline-block':'none'});visitCount=cards.length}
function refreshPlacement(card){if(!selectedAddress)return;var d=card.querySelector('.visit-date').value;if(!d)return;var rec=card.querySelector('.recommendation');rec.textContent='Calculating GPS stop placement…';google.script.run.withSuccessHandler(function(r){if(card.dataset.manual!=='true')card.querySelector('.visit-stop').value=r.position;rec.textContent=(r.dayName||'Route')+' · Stop '+r.position+' of '+(Number(r.customerCount||0)+1)+'\n'+(r.reason||'');rec.className='recommendation '+(r.ratingClass||'')}).withFailureHandler(function(e){rec.textContent=e&&e.message?e.message:String(e);rec.className='recommendation poor'}).suggestTemporaryVisitPlacement({address:address.value,addressVerified:true,addressDetails:selectedAddress,dates:[d],date:d})}
function nextEmpty(current){var order=[address,lastName,firstName,phone,email];var start=Math.max(-1,order.indexOf(current));for(var i=start+1;i<order.length;i++){if(!String(order[i].value||'').trim()){order[i].focus();return}}var firstDate=visits.querySelector('.visit-date');if(firstDate)firstDate.focus()}
function onEnter(e){if(e.key!=='Enter')return;if(e.target===address){e.preventDefault();if(addressList.style.display==='block'&&addressOptions.length)chooseAddress(activeAddress<0?0:activeAddress);else if(selectedAddress)nextEmpty(address);return}if([lastName,firstName,phone,email].indexOf(e.target)>=0){e.preventDefault();nextEmpty(e.target)}}
function updateTitles(){if(calendarTitleEdited)return;Array.prototype.forEach.call(visits.querySelectorAll('.calendar-title'),function(t){t.value=lastName.value.trim()})}
function payload(){var rows=[];Array.prototype.forEach.call(visits.querySelectorAll('.visit-card'),function(c){var d=c.querySelector('.visit-date').value;if(d)rows.push({date:d,stopPosition:Number(c.querySelector('.visit-stop').value||1)})});var title=(visits.querySelector('.calendar-title')||{}).value||lastName.value;return{title:String(title||'').trim(),calendarTitle:String(title||'').trim(),firstName:firstName.value.trim(),lastName:lastName.value.trim(),fullName:[firstName.value.trim(),lastName.value.trim()].filter(Boolean).join(' '),address:address.value.trim(),addressVerified:!!selectedAddress,addressDetails:selectedAddress,phone:phone.value.trim(),email:email.value.trim(),entryInformation:entry.value.trim(),customerNotes:notes.value.trim(),visits:rows}}
function schedule(){var data=payload();if(!data.addressVerified){setStatus('Choose a complete service address from the suggestions.','error');return}if(!data.title){setStatus('Enter a surname or Calendar title.','error');return}if(!data.visits.length){setStatus('Choose at least one visit date.','error');return}save.disabled=true;setStatus('Creating temporary visit(s) and restaggering the selected route(s)…');google.script.run.withSuccessHandler(function(r){save.disabled=false;setStatus(r.created+' temporary visit(s) created.\n'+r.adjusted+' event time(s) adjusted.','success');setTimeout(function(){google.script.host.close()},1200)}).withFailureHandler(function(e){save.disabled=false;setStatus(e&&e.message?e.message:String(e),'error')}).scheduleTemporaryVisitsV2(data)}
address.addEventListener('input',queueAddress);address.addEventListener('keydown',function(e){if(e.key==='ArrowDown'&&addressOptions.length){e.preventDefault();setAddressActive(activeAddress+1)}else if(e.key==='ArrowUp'&&addressOptions.length){e.preventDefault();setAddressActive(activeAddress-1)}else onEnter(e)});lastName.addEventListener('input',titleCaseInput);lastName.addEventListener('input',updateTitles);firstName.addEventListener('input',titleCaseInput);phone.addEventListener('input',formatPhone);[lastName,firstName,phone,email].forEach(function(i){i.addEventListener('keydown',onEnter)});document.getElementById('addVisit').onclick=addVisitCard;document.getElementById('save').onclick=schedule;document.getElementById('close').onclick=function(){google.script.host.close()};document.addEventListener('mousedown',function(e){if(!e.target.closest('.address-wrap'))closeAddresses()});google.script.run.preparePmosAddressSuggestions();addVisitCard();address.focus();
})();</script></body></html>`).setWidth(760).setHeight(860);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Add Temporary Visit(s)');
}

function scheduleTemporaryVisitsV2(payload) {
  payload = payload || {};
  const title = String(payload.title || '').trim();
  const address = String(payload.address || '').trim();
  let requests = (Array.isArray(payload.visits) ? payload.visits : []).map(function(item) {
    return {date: String(item.date || '').trim(), stopPosition: Math.max(1, Math.floor(Number(item.stopPosition || 1)))};
  }).filter(function(item) { return item.date; });
  if (!requests.length && Array.isArray(payload.dates)) {
    const stops = Array.isArray(payload.stopPositions) ? payload.stopPositions : [];
    requests = payload.dates.map(function(date, index) {
      return {date: String(date || '').trim(), stopPosition: Math.max(1, Math.floor(Number(stops[index] || 1)))};
    }).filter(function(item) { return item.date; });
  }
  if (!title) throw new Error('Enter a Calendar title or customer surname.');
  if (!address) throw new Error('Enter the service address.');
  getVerifiedTemporaryVisitPoint_(payload);
  if (!requests.length) throw new Error('Choose at least one visit date.');

  const calendar = getRecurringCalendar_();
  const settings = getRecurringCalendarSettings_();
  let created = 0;
  let adjusted = 0;
  const details = [];
  requests.forEach(function(request) {
    const serviceDate = parseTemporaryVisitDate_(request.date);
    if (serviceDate.getDay() === 0 || serviceDate.getDay() === 6) throw new Error(request.date + ' is a weekend. Temporary maintenance visits currently support Monday–Friday.');
    const dayStart = new Date(serviceDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(serviceDate); dayEnd.setHours(23, 59, 59, 999);
    const existing = calendar.getEvents(dayStart, dayEnd).filter(function(event) { return !event.isAllDayEvent(); }).sort(function(a, b) { return a.getStartTime() - b.getStartTime(); });
    const position = Math.min(request.stopPosition, existing.length + 1);
    const start = routeTimeForOrder_(serviceDate, position, settings);
    const end = new Date(start.getTime() + settings.eventDurationMinutes * 60000);
    const event = calendar.createEvent(title, start, end, {location: address, description: buildTemporaryVisitDescriptionV2_(payload)});
    const ordered = existing.slice(); ordered.splice(position - 1, 0, event);
    ordered.forEach(function(item, index) {
      const newStart = routeTimeForOrder_(serviceDate, index + 1, settings);
      const newEnd = new Date(newStart.getTime() + settings.eventDurationMinutes * 60000);
      if (item.getStartTime().getTime() !== newStart.getTime() || item.getEndTime().getTime() !== newEnd.getTime()) { item.setTime(newStart, newEnd); adjusted++; }
    });
    created++;
    details.push(Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'EEEE, MMMM d') + ' — inserted as stop ' + position);
    invalidateTemporaryRouteSnapshot_(serviceDate);
  });
  return {created: created, adjusted: adjusted, details: details};
}

function buildTemporaryVisitDescriptionV2_(payload) {
  const parts = [];
  if (payload.entryInformation) parts.push('ENTRY INFORMATION', String(payload.entryInformation));
  if (payload.customerNotes) parts.push(parts.length ? '' : null, 'CUSTOMER NOTES', String(payload.customerNotes));
  const service = [];
  if (payload.fullName) service.push(String(payload.fullName));
  service.push('Temporary maintenance visit');
  if (payload.phone) service.push('PHONE: ' + String(payload.phone));
  if (payload.email) service.push('EMAIL: ' + String(payload.email));
  parts.push(parts.length ? '' : null, 'SERVICE DETAILS', service.join('\n'));
  parts.push('', PMOS_TEMP_VISIT_MARKER, 'PMOS_TEMP_VISIT_ID=' + Utilities.getUuid());
  return parts.filter(function(part) { return part !== null; }).join('\n').trim();
}
