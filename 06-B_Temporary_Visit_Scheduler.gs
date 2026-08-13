/**
 * PMOS v1.9.0 — Temporary visit scheduling UI and operations.
 * Move-only refactor: public names and operational behavior are preserved.
 */

function showTemporaryVisitScheduler() {
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body{font-family:Arial,sans-serif;padding:18px;color:#1f2937}h2{margin:0 0 6px}.muted{font-size:13px;color:#6b7280;margin-bottom:14px}
    label{display:block;font-weight:600;margin:10px 0 4px}input,textarea{width:100%;box-sizing:border-box;padding:9px;border:1px solid #d1d5db;border-radius:7px}
    textarea{min-height:72px;resize:vertical}.visitCard{border:1px solid #d1d5db;border-radius:10px;padding:12px;margin:9px 0;background:#fff}
    .visitHead{display:flex;justify-content:space-between;align-items:center;gap:8px}.visitTitle{font-weight:700}.visitGrid{display:grid;grid-template-columns:1fr 120px;gap:10px}
    .recommendation{margin-top:10px;padding:10px;border-radius:8px;background:#f3f4f6;white-space:pre-line;font-size:13px}.working{color:#4b5563}.good{background:#dcfce7;color:#166534}.fair{background:#fef3c7;color:#92400e}.poor{background:#fee2e2;color:#991b1b}
    .nearby{margin-top:9px;border-top:1px solid rgba(107,114,128,.25);padding-top:8px}.nearbyTitle{font-weight:700;margin-bottom:5px}.nearbyOption{display:block;width:100%;text-align:left;background:rgba(255,255,255,.75);border:1px solid rgba(107,114,128,.3);margin:5px 0;padding:8px;border-radius:7px}.nearbyOption:hover{background:white}.nearbyMeta{font-size:12px;margin-top:2px}
    .dateSuggestions{display:none;margin-top:10px;border:1px solid #d1d5db;border-radius:10px;padding:10px;background:#f9fafb}.dateSuggestions h3{font-size:14px;margin:0 0 8px}.dateOption{width:100%;text-align:left;background:white;border:1px solid #d1d5db;margin:5px 0;padding:9px;border-radius:8px}.dateOption:hover{background:#eff6ff}.dateMeta{font-size:12px;color:#6b7280;margin-top:2px}.searchMore{width:100%;margin-top:8px;background:#e0e7ff;color:#3730a3}
    .buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}button{border:0;border-radius:8px;padding:10px 14px;font-weight:600;cursor:pointer}.primary{background:#2563eb;color:white}.secondary{background:#e5e7eb}.small{padding:7px 9px}
    button:disabled{opacity:.5;cursor:default}.status{display:none;margin-top:12px;padding:10px;border-radius:8px;background:#f3f4f6;white-space:pre-line}.error{background:#fee2e2;color:#991b1b}.success{background:#dcfce7;color:#166534}
  </style>
</head>
<body>
  <h2>Schedule Temporary Maintenance Visits</h2>
  <div class="muted">Enter an address for the three best dates in the next 6 business days. Extend the timeline only when needed. Selecting a date also checks nearby weekdays.</div>
  <label>Calendar title / surname</label><input id="titleInput" placeholder="Example: Smith">
  <label>Full name</label><input id="fullNameInput" placeholder="Optional">
  <label>Address</label><input id="addressInput" placeholder="Street address, city, province">
  <div id="dateSuggestions" class="dateSuggestions"></div>
  <label>Phone</label><input id="phoneInput" placeholder="Optional">
  <label>Visit dates</label><div id="visitsContainer"></div>
  <button id="addVisitButton" type="button" class="secondary small">+ Add Another Visit</button>
  <label>Entry instructions / notes</label><textarea id="notesInput" placeholder="Gate code, access details, special instructions..."></textarea>
  <div class="buttons"><button id="scheduleButton" type="button" class="primary">Schedule Visit(s)</button><button id="closeButton" type="button" class="secondary">Close</button></div>
  <div id="statusBox" class="status"></div>
<script>
(function(){
  var titleInput=document.getElementById('titleInput'),fullNameInput=document.getElementById('fullNameInput'),addressInput=document.getElementById('addressInput'),phoneInput=document.getElementById('phoneInput'),visitsContainer=document.getElementById('visitsContainer'),notesInput=document.getElementById('notesInput'),statusBox=document.getElementById('statusBox'),dateSuggestions=document.getElementById('dateSuggestions'),scheduleButton=document.getElementById('scheduleButton'),addVisitButton=document.getElementById('addVisitButton');
  var visitCounter=0,placementTimer=null,dateTimer=null,requestSequence=0,dateRequestSequence=0;
  var searchOffset=0,allDateOptions=[],lastQualityMessage='',batchCompleted=0,batchTotal=0,batchErrors=0;


  function showStatus(message,kind){statusBox.style.display='block';statusBox.className='status '+(kind||'');statusBox.textContent=message;}
  function setBusy(value){scheduleButton.disabled=value;addVisitButton.disabled=value;}
  function renumber(){var cards=visitsContainer.querySelectorAll('.visitCard');for(var i=0;i<cards.length;i++){cards[i].querySelector('.visitTitle').textContent='Visit #'+(i+1);cards[i].querySelector('.removeVisit').style.display=cards.length>1?'inline-block':'none';}}
  function addVisit(value){
    visitCounter++;var card=document.createElement('div');card.className='visitCard';card.setAttribute('data-id',String(visitCounter));
    card.innerHTML='<div class="visitHead"><div class="visitTitle"></div><button type="button" class="secondary small removeVisit">Remove</button></div><div class="visitGrid"><div><label>Date</label><input class="visitDate" type="date" value="'+(value||'')+'"></div><div><label>Stop</label><input class="visitStop" type="number" min="1" value="1"></div></div><div class="recommendation working">Enter an address and choose a date to calculate placement.</div>';
    visitsContainer.appendChild(card);
    card.querySelector('.removeVisit').addEventListener('click',function(){card.remove();renumber();queuePlacementSuggestions();});
    card.querySelector('.visitDate').addEventListener('change',function(){card.setAttribute('data-manual','false');queuePlacementSuggestions();});
    card.querySelector('.visitDate').addEventListener('input',function(){card.setAttribute('data-manual','false');queuePlacementSuggestions();});
    card.querySelector('.visitStop').addEventListener('input',function(){card.setAttribute('data-manual','true');updateManualMessage(card);});
    renumber();if(value)queuePlacementSuggestions();return card;
  }
  function updateManualMessage(card){var rec=card.querySelector('.recommendation'),stop=card.querySelector('.visitStop').value||'1';if(card.getAttribute('data-suggested')){rec.firstChild.textContent='Manual placement selected: stop '+stop+'\\nSuggested stop remains '+card.getAttribute('data-suggested')+'. PMOS will respect your manual choice.';rec.className='recommendation fair';}}
  function queuePlacementSuggestions(){clearTimeout(placementTimer);placementTimer=setTimeout(refreshPlacementSuggestions,500);}
  function queueDateRecommendations(){clearTimeout(dateTimer);dateTimer=setTimeout(function(){searchOffset=0;allDateOptions=[];lastQualityMessage='';refreshDateRecommendations(false);},700);queuePlacementSuggestions();}
  function refreshPlacementSuggestions(){var address=addressInput.value.trim(),cards=visitsContainer.querySelectorAll('.visitCard');for(var i=0;i<cards.length;i++){var card=cards[i],date=card.querySelector('.visitDate').value,rec=card.querySelector('.recommendation');if(!address||!date){rec.textContent='Enter an address and choose a date to calculate placement.';rec.className='recommendation working';continue;}requestPlacement(card,address,date);}}
  function requestPlacement(card,address,date){
    var rec=card.querySelector('.recommendation'),token=++requestSequence;card.setAttribute('data-request',String(token));rec.textContent='Calculating placement and checking nearby weekdays…';rec.className='recommendation working';
    google.script.run.withSuccessHandler(function(result){
      if(card.getAttribute('data-request')!==String(token))return;card.setAttribute('data-suggested',String(result.position));if(card.getAttribute('data-manual')!=='true')card.querySelector('.visitStop').value=result.position;
      var lines=[result.dayName+' route',result.customerCount+' scheduled visit(s)','Suggested stop: #'+result.position];if(result.previousName||result.nextName)lines.push('Between: '+(result.previousName||'Route start')+' and '+(result.nextName||'Route end'));if(typeof result.addedDistanceKm==='number')lines.push('Approximate added travel: +'+result.addedDistanceKm.toFixed(1)+' km');lines.push(result.rating+' placement',result.reason||result.explanation||'');
      rec.innerHTML='';var summary=document.createElement('div');summary.textContent=lines.filter(Boolean).join('\\n');rec.appendChild(summary);rec.className='recommendation '+(result.ratingClass||'good');
      renderNearbyAlternatives(card,rec,result);if(card.getAttribute('data-manual')==='true')updateManualMessage(card);
    }).withFailureHandler(function(error){if(card.getAttribute('data-request')!==String(token))return;rec.textContent='Placement could not be calculated. You can still enter a stop manually.\\n'+(error&&error.message?error.message:String(error));rec.className='recommendation poor';}).suggestTemporaryVisitPlacement({address:address,dates:[date],stopPosition:Number(card.querySelector('.visitStop').value||1),includeNearby:true});
  }
  function renderNearbyAlternatives(card,rec,result){
    var alternatives=result.nearbyAlternatives||[],selectedDistance=Number(result.addedDistanceKm||0),better=[];for(var i=0;i<alternatives.length;i++){if(Number(alternatives[i].addedDistanceKm)+0.1<selectedDistance)better.push(alternatives[i]);}
    var box=document.createElement('div');box.className='nearby';var title=document.createElement('div');title.className='nearbyTitle';
    if(!better.length){title.textContent='Your selected date is already the best nearby option.';box.appendChild(title);rec.appendChild(box);return;}
    title.textContent='Better dates near your selection';box.appendChild(title);
    better.slice(0,3).forEach(function(option){var button=document.createElement('button');button.type='button';button.className='nearbyOption';var savings=Math.max(0,selectedDistance-Number(option.addedDistanceKm||0));button.innerHTML='<b>'+option.displayDate+' — save about '+savings.toFixed(1)+' km</b><div class="nearbyMeta">Week '+option.rotationWeek+' • +'+option.addedDistanceKm.toFixed(1)+' km • stop #'+option.position+'</div>';button.addEventListener('click',function(){card.querySelector('.visitDate').value=option.date;card.setAttribute('data-manual','false');queuePlacementSuggestions();});box.appendChild(button);});rec.appendChild(box);
  }
  function applyComparativeRatings(){
    if(!allDateOptions.length)return;var bestDistance=Number(allDateOptions[0].addedDistanceKm||0),bestScore=Number(allDateOptions[0].score||0);
    allDateOptions.forEach(function(option,index){var distance=Number(option.addedDistanceKm||0),gap=distance-bestDistance,scoreGap=bestScore-Number(option.score||0);
      if(index===0){option.displayRating=distance<=8?'Excellent':'Best Available';option.displayClass='good';option.displayReason='Best option found in the searched dates.';}
      else if(index===1){option.displayRating=(gap<=4||scoreGap<=8)?'Very Good':'Good';option.displayClass=gap<=8?'good':'fair';option.displayReason='One of the strongest alternatives found so far.';}
      else {option.displayRating=(gap<=8||scoreGap<=15)?'Good':'Fair';option.displayClass='fair';option.displayReason='Third-best option among the dates searched so far.';}
    });
  }
  function mergeDateOptions(options){var byDate={};allDateOptions.concat(options||[]).forEach(function(option){byDate[option.date]=option;});allDateOptions=Object.keys(byDate).map(function(key){return byDate[key];});allDateOptions.sort(function(a,b){if(Number(a.score||0)!==Number(b.score||0))return Number(b.score||0)-Number(a.score||0);if(a.addedDistanceKm!==b.addedDistanceKm)return a.addedDistanceKm-b.addedDistanceKm;if(a.customerCount!==b.customerCount)return a.customerCount-b.customerCount;return a.date.localeCompare(b.date);});allDateOptions=allDateOptions.slice(0,3);applyComparativeRatings();}
  function finishProgressiveBatch(token,requestedOffset){if(token!==dateRequestSequence||batchCompleted<batchTotal)return;searchOffset=requestedOffset+6;lastQualityMessage=allDateOptions.length?'Recommendations are ranked against the other dates searched, not by a rigid kilometre cutoff.':'';if(batchErrors)lastQualityMessage+=(lastQualityMessage?' ':'')+batchErrors+' day(s) could not be analyzed.';renderDateRecommendations(false);}
  function renderDateRecommendations(working){
    dateSuggestions.innerHTML='<h3>Best upcoming dates</h3>';if(working){dateSuggestions.innerHTML+='<div class="muted">Searching day '+Math.min(batchCompleted+1,batchTotal)+' of '+batchTotal+'. Results update as each day finishes.</div>';}else if(lastQualityMessage){dateSuggestions.innerHTML+='<div class="muted">'+lastQualityMessage+'</div>';}if(!allDateOptions.length){dateSuggestions.innerHTML+='<div class="muted">'+(working?'Checking the first route…':'No weekday routes were available to compare.')+'</div>';}
    allDateOptions.forEach(function(option){var button=document.createElement('button');button.type='button';button.className='dateOption';button.innerHTML='<b>'+option.displayDate+' — '+(option.displayRating||option.rating)+'</b><div class="dateMeta">Week '+option.rotationWeek+' • '+option.customerCount+' visits • +'+option.addedDistanceKm.toFixed(1)+' km • suggested stop #'+option.position+'</div><div class="dateMeta">'+(option.displayReason||option.reason)+'</div>';button.addEventListener('click',function(){selectRecommendedDate(option.date);});dateSuggestions.appendChild(button);});
    var more=document.createElement('button');more.type='button';more.className='searchMore';more.disabled=!!working;more.textContent=working?'Searching '+batchCompleted+' of '+batchTotal+' business days…':'Search 6 More Business Days';more.addEventListener('click',function(){refreshDateRecommendations(true);});dateSuggestions.appendChild(more);
  }
  function refreshDateRecommendations(expand){
    var address=addressInput.value.trim(),token=++dateRequestSequence;if(address.length<6){dateSuggestions.style.display='none';dateSuggestions.innerHTML='';return;}dateSuggestions.style.display='block';var requestedOffset=expand?searchOffset:0;batchCompleted=0;batchTotal=6;batchErrors=0;lastQualityMessage='';renderDateRecommendations(true);
    for(var dayIndex=0;dayIndex<6;dayIndex++)(function(offset){
      google.script.run.withSuccessHandler(function(result){if(token!==dateRequestSequence)return;mergeDateOptions((result&&result.recommendations)||[]);batchCompleted++;renderDateRecommendations(batchCompleted<batchTotal);finishProgressiveBatch(token,requestedOffset);}).withFailureHandler(function(){if(token!==dateRequestSequence)return;batchErrors++;batchCompleted++;renderDateRecommendations(batchCompleted<batchTotal);finishProgressiveBatch(token,requestedOffset);}).recommendTemporaryVisitDates({address:address,startOffsetWorkingDays:requestedOffset+offset,workdayCount:1,maxResults:1});
    })(dayIndex);
  }
  function selectRecommendedDate(date){var cards=visitsContainer.querySelectorAll('.visitCard'),target=null;for(var i=0;i<cards.length;i++){if(!cards[i].querySelector('.visitDate').value){target=cards[i];break;}}if(!target)target=addVisit('');target.querySelector('.visitDate').value=date;target.setAttribute('data-manual','false');queuePlacementSuggestions();}
  function payload(){var cards=visitsContainer.querySelectorAll('.visitCard'),visits=[];for(var i=0;i<cards.length;i++){var date=cards[i].querySelector('.visitDate').value;if(date)visits.push({date:date,stopPosition:Number(cards[i].querySelector('.visitStop').value||1)});}return{title:titleInput.value.trim(),fullName:fullNameInput.value.trim(),address:addressInput.value.trim(),phone:phoneInput.value.trim(),visits:visits,dates:visits.map(function(v){return v.date;}),notes:notesInput.value.trim()};}
  function resetForm(){titleInput.value='';fullNameInput.value='';addressInput.value='';phoneInput.value='';notesInput.value='';visitsContainer.innerHTML='';dateSuggestions.style.display='none';dateSuggestions.innerHTML='';visitCounter=0;searchOffset=0;allDateOptions=[];lastQualityMessage='';batchCompleted=0;batchTotal=0;batchErrors=0;addVisit('');titleInput.focus();}
  function scheduleVisits(){var data=payload();if(!data.title){showStatus('Enter a Calendar title or surname.','error');return;}if(!data.address){showStatus('Enter the service address.','error');return;}if(!data.visits.length){showStatus('Choose at least one visit date.','error');return;}setBusy(true);showStatus('Creating '+data.visits.length+' temporary visit(s) and restaggering the selected route(s)…','');google.script.run.withSuccessHandler(function(result){setBusy(false);showStatus(result.created+' temporary visit(s) created.\\n'+result.adjusted+' event time(s) adjusted.\\n\\nReady for the next customer.','success');resetForm();setTimeout(function(){statusBox.style.display='none';},3000);}).withFailureHandler(function(error){setBusy(false);showStatus('Unable to schedule visits:\\n'+(error&&error.message?error.message:String(error)),'error');}).scheduleTemporaryVisits(data);}
  addVisitButton.addEventListener('click',function(){addVisit('');});scheduleButton.addEventListener('click',scheduleVisits);document.getElementById('closeButton').addEventListener('click',function(){google.script.host.close();});addressInput.addEventListener('input',queueDateRecommendations);addressInput.addEventListener('change',queueDateRecommendations);addVisit('');
})();
</script>
</body>
</html>`).setWidth(700).setHeight(860);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Schedule Temporary Visits');
}

function scheduleTemporaryVisits_(payload) {
  payload = payload || {};


  const title = String(payload.title || '').trim();
  const address = String(payload.address || '').trim();
  const visitRequests = Array.isArray(payload.visits) && payload.visits.length
    ? payload.visits.map(item => ({
        date: String(item.date || '').trim(),
        stopPosition: Math.max(1, Math.floor(Number(item.stopPosition || 1)))
      })).filter(item => item.date)
    : (Array.isArray(payload.dates)
        ? payload.dates.map(value => ({date: String(value || '').trim(), stopPosition: Math.max(1, Math.floor(Number(payload.stopPosition || 1)))})).filter(item => item.date)
        : [String(payload.date1 || '').trim(), String(payload.date2 || '').trim()].filter(Boolean).map(value => ({date:value, stopPosition:Math.max(1, Math.floor(Number(payload.stopPosition || 1)))})));
  const dateStrings = visitRequests.map(item => item.date);


  if (!title) {
    throw new Error('Enter a Calendar title or customer surname.');
  }


  if (!address) {
    throw new Error('Enter the service address.');
  }


  if (!dateStrings.length) {
    throw new Error('Choose at least one visit date.');
  }


  const calendar = getRecurringCalendar_();
  const settings = getRecurringCalendarSettings_();
  let created = 0;
  let adjusted = 0;
  const details = [];


  visitRequests.forEach(visitRequest => {
    const dateString = visitRequest.date;
    const stopPosition = visitRequest.stopPosition;
    const serviceDate = parseTemporaryVisitDate_(dateString);


    if (
      serviceDate.getDay() === 0 ||
      serviceDate.getDay() === 6
    ) {
      throw new Error(
        `${dateString} is a weekend. Temporary maintenance visits currently support Monday–Friday.`
      );
    }


    const dayStart = new Date(serviceDate);
    dayStart.setHours(0, 0, 0, 0);


    const dayEnd = new Date(serviceDate);
    dayEnd.setHours(23, 59, 59, 999);


    const existingEvents = calendar.getEvents(dayStart, dayEnd)
      .filter(event => !event.isAllDayEvent())
      .sort((a, b) =>
        a.getStartTime().getTime() -
        b.getStartTime().getTime()
      );


    const safePosition = Math.min(
      stopPosition,
      existingEvents.length + 1
    );


    const placeholderStart = routeTimeForOrder_(
      serviceDate,
      safePosition,
      settings
    );
    const placeholderEnd = new Date(
      placeholderStart.getTime() +
      settings.eventDurationMinutes * 60000
    );


    const description = buildTemporaryVisitDescription_(payload);


    const newEvent = calendar.createEvent(
      title,
      placeholderStart,
      placeholderEnd,
      {
        location: address,
        description
      }
    );


    const orderedEvents = existingEvents.slice();
    orderedEvents.splice(safePosition - 1, 0, newEvent);


    orderedEvents.forEach((event, index) => {
      const newStart = routeTimeForOrder_(
        serviceDate,
        index + 1,
        settings
      );
      const newEnd = new Date(
        newStart.getTime() +
        settings.eventDurationMinutes * 60000
      );


      if (
        event.getStartTime().getTime() !== newStart.getTime() ||
        event.getEndTime().getTime() !== newEnd.getTime()
      ) {
        event.setTime(newStart, newEnd);
        adjusted++;
      }
    });


    created++;
    details.push(
      `${Utilities.formatDate(serviceDate, PMOS.TIMEZONE, 'EEEE, MMMM d')} — inserted as stop ${safePosition}`
    );
    invalidateTemporaryRouteSnapshot_(serviceDate);
  });


  return {
    created,
    adjusted,
    details
  };
}

function parseTemporaryVisitDate_(value) {
  const match = String(value || '').match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );


  if (!match) {
    throw new Error(`Invalid visit date: ${value}`);
  }


  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0
  );


  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid visit date: ${value}`);
  }


  return date;
}

function buildTemporaryVisitDescription_(payload) {
  const lines = [
    'Temporary / vacation maintenance visit',
    PMOS_TEMP_VISIT_MARKER
  ];


  if (payload.fullName) {
    lines.push(`Customer: ${payload.fullName}`);
  }


  if (payload.phone) {
    lines.push(`Phone: ${payload.phone}`);
  }


  if (payload.notes) {
    lines.push('', String(payload.notes));
  }


  lines.push('', `PMOS_TEMP_VISIT_ID=${Utilities.getUuid()}`);


  return lines.join('\n');
}
