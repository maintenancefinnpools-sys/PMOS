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
    .twoCol{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .addressWrap{position:relative}.addressList{display:none;position:absolute;left:0;right:0;top:calc(100% + 3px);z-index:20;background:#fff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 10px 24px rgba(15,23,42,.15);max-height:220px;overflow-y:auto}.addressOption{display:block;width:100%;text-align:left;background:#fff;color:#1f2937;border:0;border-bottom:1px solid #e5e7eb;border-radius:0;padding:10px}.addressOption:last-child{border-bottom:0}.addressOption:hover,.addressOption.active{background:#eff6ff}.addressStatus,.addressDetails{display:none;margin-top:6px;padding:8px 10px;border-radius:7px;font-size:12px}.addressStatus{background:#dbeafe;color:#1e40af}.addressDetails{background:#dcfce7;color:#166534}
    textarea{min-height:72px;resize:vertical}.visitCard{border:1px solid #d1d5db;border-radius:10px;padding:12px;margin:9px 0;background:#fff}
    .visitHead{display:flex;justify-content:space-between;align-items:center;gap:8px}.visitTitle{font-weight:700}.visitGrid{display:grid;grid-template-columns:minmax(155px,.72fr) 90px minmax(180px,1fr);gap:10px}.visitGrid.additional{grid-template-columns:minmax(155px,.72fr) 90px}.visitDate{max-width:210px}
    .recommendation{margin-top:10px;padding:10px;border-radius:8px;background:#f3f4f6;white-space:pre-line;font-size:13px}.working{color:#4b5563}.good{background:#dcfce7;color:#166534}.fair{background:#fef3c7;color:#92400e}.poor{background:#fee2e2;color:#991b1b}
    .dateSuggestions{display:none;margin-top:10px;border:1px solid #d1d5db;border-radius:12px;padding:12px;background:#f8fafc}.dateSuggestions h3{font-size:14px;margin:0 0 8px}.dateGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.dateOption{width:100%;min-height:145px;text-align:left;background:white;border:2px solid #dbeafe;margin:0;padding:11px;border-radius:10px;box-shadow:0 2px 5px rgba(15,23,42,.04)}.dateOption:hover{background:#eff6ff;border-color:#60a5fa;transform:translateY(-1px)}.dateRank{color:#2563eb;font-size:11px;font-weight:700;margin-bottom:4px}.dateMeta{font-size:11px;color:#475569;line-height:1.4;margin-top:4px}.searchMore{width:100%;margin-top:10px;background:#e0e7ff;color:#3730a3}
    .buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}button{border:0;border-radius:8px;padding:10px 14px;font-weight:600;cursor:pointer}.primary{background:#2563eb;color:white}.secondary{background:#e5e7eb}.small{padding:7px 9px}
    button:disabled{opacity:.5;cursor:default}.status{display:none;margin-top:12px;padding:10px;border-radius:8px;background:#f3f4f6;white-space:pre-line}.error{background:#fee2e2;color:#991b1b}.success{background:#dcfce7;color:#166534}@media(max-width:620px){.twoCol,.dateGrid,.visitGrid,.visitGrid.additional{grid-template-columns:1fr}.visitDate{max-width:none}}
  </style>
</head>
<body>
  <h2>Schedule Temporary Maintenance Visits</h2>
  <div class="muted">Choose a complete service address to calculate the three best GPS route placements. After choosing a date, PMOS recommends the stop position for that date.</div>
  <label>Service address</label><div class="addressWrap"><input id="addressInput" placeholder="Begin typing address" autocomplete="off"><div id="addressList" class="addressList"></div></div>
  <div id="addressStatus" class="addressStatus"></div><div id="addressDetails" class="addressDetails"></div>
  <div class="twoCol"><label>Last Name<input id="lastNameInput" placeholder="Example: Smith"></label><label>First Name<input id="firstNameInput" placeholder="Example: Sam"></label></div>
  <div class="twoCol"><label>Phone Number<input id="phoneInput" placeholder="Optional"></label><label>Email (optional)<input id="emailInput" type="email" placeholder="name@example.com"></label></div>
  <label>Customer Notes</label><textarea id="customerNotesInput" placeholder="Customer preferences or service notes..."></textarea>
  <label>Entry Information</label><textarea id="entryInformationInput" placeholder="Gate code, access details, special instructions..."></textarea>
  <div id="dateSuggestions" class="dateSuggestions"></div>
  <label>Visit dates</label><div id="visitsContainer"></div>
  <button id="addVisitButton" type="button" class="secondary small">+ Add Another Visit</button>
  <div class="buttons"><button id="scheduleButton" type="button" class="primary">Schedule Visit(s)</button><button id="closeButton" type="button" class="secondary">Close</button></div>
  <div id="statusBox" class="status"></div>
<script>
(function(){
  var lastNameInput=document.getElementById('lastNameInput'),firstNameInput=document.getElementById('firstNameInput'),addressInput=document.getElementById('addressInput'),addressList=document.getElementById('addressList'),addressStatus=document.getElementById('addressStatus'),addressDetails=document.getElementById('addressDetails'),phoneInput=document.getElementById('phoneInput'),emailInput=document.getElementById('emailInput'),customerNotesInput=document.getElementById('customerNotesInput'),entryInformationInput=document.getElementById('entryInformationInput'),visitsContainer=document.getElementById('visitsContainer'),statusBox=document.getElementById('statusBox'),dateSuggestions=document.getElementById('dateSuggestions'),scheduleButton=document.getElementById('scheduleButton'),addVisitButton=document.getElementById('addVisitButton');
  var visitCounter=0,placementTimer=null,requestSequence=0,dateRequestSequence=0;
  var searchOffset=0,allDateOptions=[],batchDateOptions=[],lastQualityMessage='',batchCompleted=0,batchTotal=0,batchErrors=0,selectedAddress=null,addressTimer=null,addressSequence=0,addressOptions=[],addressActive=-1,addressMisses=0,addressGoogleFirst=false,calendarTitleInput=null,calendarTitleEdited=false,lastAutoCalendarTitle='';


  function showStatus(message,kind){statusBox.style.display='block';statusBox.className='status '+(kind||'');statusBox.textContent=message;}
  function formatCustomerNameInput(event){var input=event.target,start=input.selectionStart,end=input.selectionEnd,value=String(input.value||''),formatted=value.replace(/(^|[\\s'-])([a-z])/g,function(match,prefix,letter){return prefix+letter.toUpperCase();});if(formatted===value)return;input.value=formatted;if(start!=null&&input.setSelectionRange)input.setSelectionRange(start,end);}
  function formatPhoneInput(){var digits=String(phoneInput.value||'').replace(/\\D/g,'').slice(0,10),value='';if(digits.length)value='('+digits.slice(0,3);if(digits.length>=3)value+=') '+digits.slice(3,6);if(digits.length>=6)value+=' - '+digits.slice(6,10);phoneInput.value=value;}
  function updateCalendarTitleFromLastName(){if(!calendarTitleInput)return;var next=lastNameInput.value.trim();if(!calendarTitleEdited||calendarTitleInput.value===lastAutoCalendarTitle){calendarTitleInput.value=next;lastAutoCalendarTitle=next;calendarTitleEdited=false;}}
  function movePrimaryFieldOnEnter(event){if(event.key!=='Enter')return;var order=[addressInput,lastNameInput,firstNameInput,phoneInput,emailInput,customerNotesInput],index=order.indexOf(event.target);if(index<0)return;if(event.target===customerNotesInput)return;event.preventDefault();if(event.target===addressInput&&!selectedAddress){if(addressOptions.length)selectAddressOption(addressActive<0?0:addressActive);return;}var next=order[index+1];if(next)next.focus();}
  function showAddressStatus(message){addressStatus.textContent=message||'';addressStatus.style.display=message?'block':'none';}
  function closeAddressList(){addressList.style.display='none';addressList.innerHTML='';addressOptions=[];addressActive=-1;}
  function clearConfirmedAddress(){selectedAddress=null;addressDetails.style.display='none';addressDetails.textContent='';dateSuggestions.style.display='none';dateSuggestions.innerHTML='';allDateOptions=[];searchOffset=0;}
  function renderAddressOptions(options){addressOptions=options||[];addressActive=-1;addressList.innerHTML='';if(!addressOptions.length){closeAddressList();showAddressStatus('No complete nearby addresses found. Continue typing or check the street and postal code.');return;}addressOptions.forEach(function(option,index){var button=document.createElement('button');button.type='button';button.className='addressOption';button.textContent=option.address;button.addEventListener('mousedown',function(event){event.preventDefault();selectAddressOption(index);});addressList.appendChild(button);});addressList.style.display='block';showAddressStatus('Choose the complete service address.');}
  function setAddressActive(index){if(!addressOptions.length)return;addressActive=(index+addressOptions.length)%addressOptions.length;var buttons=addressList.querySelectorAll('.addressOption');for(var i=0;i<buttons.length;i++)buttons[i].classList.toggle('active',i===addressActive);if(buttons[addressActive])buttons[addressActive].scrollIntoView({block:'nearest'});}
  function selectAddressOption(index){var candidate=addressOptions[index];if(!candidate)return;closeAddressList();showAddressStatus('Confirming address…');google.script.run.withSuccessHandler(function(result){selectedAddress=result;addressMisses=0;addressGoogleFirst=false;addressInput.value=result.address;addressDetails.textContent='Confirmed: '+result.address;addressDetails.style.display='block';showAddressStatus('Address confirmed. Calculating GPS route placements…');searchOffset=0;allDateOptions=[];refreshDateRecommendations(false);queuePlacementSuggestions();}).withFailureHandler(function(error){clearConfirmedAddress();showAddressStatus(error&&error.message?error.message:String(error));}).confirmPmosSelectedAddress(candidate);}
  function recordAddressMiss(){addressMisses++;if(addressMisses>=3)addressGoogleFirst=true;}
  function queueAddressSuggestions(){clearTimeout(addressTimer);var query=addressInput.value.trim();if(selectedAddress&&query.toLowerCase()!==String(selectedAddress.address||'').toLowerCase())clearConfirmedAddress();if(query.length<3){closeAddressList();addressMisses=0;addressGoogleFirst=false;showAddressStatus(query?'Keep typing to load address suggestions.':'');return;}var token=++addressSequence;showAddressStatus(addressGoogleFirst?'Checking Google for this address…':'Loading address suggestions…');addressTimer=setTimeout(function(){google.script.run.withSuccessHandler(function(options){if(token!==addressSequence)return;if(options&&options.length){addressMisses=0;renderAddressOptions(options);return;}recordAddressMiss();closeAddressList();showAddressStatus(addressGoogleFirst?'Google is checking the address as you continue typing…':'No complete nearby addresses found yet. Continue typing.');}).withFailureHandler(function(error){if(token!==addressSequence)return;recordAddressMiss();closeAddressList();showAddressStatus(addressGoogleFirst?'Google address lookup is still waiting for a complete address.':'Address suggestions unavailable: '+(error&&error.message?error.message:String(error)));}).suggestPmosAddresses(query,6,addressGoogleFirst);},160);}
  function setBusy(value){scheduleButton.disabled=value;addVisitButton.disabled=value;}
  function renumber(){var cards=visitsContainer.querySelectorAll('.visitCard');for(var i=0;i<cards.length;i++){cards[i].querySelector('.visitTitle').textContent='Visit #'+(i+1);cards[i].querySelector('.removeVisit').style.display=i>0?'inline-block':'none';}}
  function addVisit(value){
    visitCounter++;var card=document.createElement('div');card.className='visitCard';card.setAttribute('data-id',String(visitCounter));
    var primary=visitCounter===1;card.innerHTML='<div class="visitHead"><div class="visitTitle"></div><button type="button" class="secondary small removeVisit">Remove</button></div><div class="visitGrid'+(primary?'':' additional')+'"><div><label>Date</label><input class="visitDate" type="date" value="'+(value||'')+'"></div><div><label>Stop</label><input class="visitStop" type="number" min="1" value="1"></div>'+(primary?'<div><label>Calendar Title</label><input id="calendarTitleInput" class="calendarTitleInput" placeholder="Defaults to Last Name"></div>':'')+'</div><div class="recommendation working">Enter an address and choose a date to calculate placement.</div>';
    visitsContainer.appendChild(card);
    if(primary){calendarTitleInput=card.querySelector('.calendarTitleInput');calendarTitleInput.value=lastNameInput.value.trim();lastAutoCalendarTitle=calendarTitleInput.value;calendarTitleInput.addEventListener('input',function(){calendarTitleEdited=calendarTitleInput.value!==lastAutoCalendarTitle;});}
    card.querySelector('.removeVisit').addEventListener('click',function(){card.remove();renumber();queuePlacementSuggestions();});
    card.querySelector('.visitDate').addEventListener('change',function(){card.setAttribute('data-manual','false');queuePlacementSuggestions();});
    card.querySelector('.visitDate').addEventListener('input',function(){card.setAttribute('data-manual','false');queuePlacementSuggestions();});
    card.querySelector('.visitStop').addEventListener('input',function(){card.setAttribute('data-manual','true');updateManualMessage(card);});
    renumber();if(value)queuePlacementSuggestions();return card;
  }
  function updateManualMessage(card){var rec=card.querySelector('.recommendation'),stop=card.querySelector('.visitStop').value||'1';if(card.getAttribute('data-suggested')){rec.firstChild.textContent='Manual placement selected: stop '+stop+'\\nSuggested stop remains '+card.getAttribute('data-suggested')+'. PMOS will respect your manual choice.';rec.className='recommendation fair';}}
  function queuePlacementSuggestions(){clearTimeout(placementTimer);placementTimer=setTimeout(refreshPlacementSuggestions,500);}
  function refreshPlacementSuggestions(){var address=addressInput.value.trim(),cards=visitsContainer.querySelectorAll('.visitCard');for(var i=0;i<cards.length;i++){var card=cards[i],date=card.querySelector('.visitDate').value,rec=card.querySelector('.recommendation');if(!selectedAddress||!date){rec.textContent='Choose a complete address and a date to calculate placement.';rec.className='recommendation working';continue;}requestPlacement(card,address,date);}}
  function requestPlacement(card,address,date){
    var rec=card.querySelector('.recommendation'),token=++requestSequence;card.setAttribute('data-request',String(token));rec.textContent='Calculating GPS stop placement for this date…';rec.className='recommendation working';
    google.script.run.withSuccessHandler(function(result){
      if(card.getAttribute('data-request')!==String(token))return;card.setAttribute('data-suggested',String(result.position));if(card.getAttribute('data-manual')!=='true')card.querySelector('.visitStop').value=result.position;
      var stopLabel='Stop #'+result.position+(result.position===1?' (first stop)':(result.position===result.customerCount+1?' (last stop)':''));var lines=[result.dayName+' route','Placement: '+stopLabel,'Scheduled stops: '+result.customerCount];if(result.previousName||result.nextName)lines.push('Between: '+(result.previousName||'Route start')+' and '+(result.nextName||'Route end'));if(result.roadDataComplete){lines.push('Drive: '+formatMinutes(result.routeDriveMinutes)+' · '+result.routeDistanceKm.toFixed(1)+' km','Estimated route*: '+formatMinutes(result.estimatedRouteMinutes),'Added: +'+Math.round(result.addedDurationMinutes)+' min · +'+result.addedDistanceKm.toFixed(1)+' km','*20-minute average visits · '+result.routeProvider);}else{lines.push('GPS road routing unavailable: '+(result.roadDataMessage||'No road route was returned.'));}lines.push(result.rating+' placement',result.reason||result.explanation||'');
      rec.innerHTML='';var summary=document.createElement('div');summary.textContent=lines.filter(Boolean).join('\\n');rec.appendChild(summary);rec.className='recommendation '+(result.ratingClass||'good');
      if(card.getAttribute('data-manual')==='true')updateManualMessage(card);
    }).withFailureHandler(function(error){if(card.getAttribute('data-request')!==String(token))return;rec.textContent='Placement could not be calculated. You can still enter a stop manually.\\n'+(error&&error.message?error.message:String(error));rec.className='recommendation poor';}).suggestTemporaryVisitPlacement({address:address,addressVerified:true,addressDetails:selectedAddress,dates:[date],stopPosition:Number(card.querySelector('.visitStop').value||1)});
  }
  function formatMinutes(value){var minutes=Math.max(0,Math.round(Number(value||0))),hours=Math.floor(minutes/60),remainder=minutes%60;return hours?(hours+'h '+remainder+'m'):(remainder+' min');}
  function applyComparativeRatings(){
    if(!allDateOptions.length)return;var bestDistance=Number(allDateOptions[0].addedDistanceKm||0),bestScore=Number(allDateOptions[0].score||0);
    allDateOptions.forEach(function(option,index){var distance=Number(option.addedDistanceKm||0),gap=distance-bestDistance,scoreGap=bestScore-Number(option.score||0);
      if(index===0){option.displayRating=distance<=8?'Excellent':'Best Available';option.displayClass='good';option.displayReason='Best option found in the searched dates.';}
      else if(index===1){option.displayRating=(gap<=4||scoreGap<=8)?'Very Good':'Good';option.displayClass=gap<=8?'good':'fair';option.displayReason='One of the strongest alternatives found so far.';}
      else {option.displayRating=(gap<=8||scoreGap<=15)?'Good':'Fair';option.displayClass='fair';option.displayReason='Alternative #'+(index+1)+' among the dates searched.';}
    });
  }
  function sortDateOptions(options){options.sort(function(a,b){if(Number(a.score||0)!==Number(b.score||0))return Number(b.score||0)-Number(a.score||0);if(a.addedDurationMinutes!==b.addedDurationMinutes)return Number(a.addedDurationMinutes||0)-Number(b.addedDurationMinutes||0);if(a.addedDistanceKm!==b.addedDistanceKm)return a.addedDistanceKm-b.addedDistanceKm;if(a.customerCount!==b.customerCount)return a.customerCount-b.customerCount;return a.date.localeCompare(b.date);});return options;}
  function finishProgressiveBatch(token,requestedOffset,expand){if(token!==dateRequestSequence||batchCompleted<batchTotal)return;var existing={};allDateOptions.forEach(function(option){existing[option.date]=true;});var additions=sortDateOptions(batchDateOptions.filter(function(option){return !existing[option.date];})).slice(0,3);allDateOptions=expand?allDateOptions.concat(additions):additions;applyComparativeRatings();searchOffset=requestedOffset+6;lastQualityMessage=allDateOptions.length?'Recommendations use actual driving time and distance. Expand Search appends three more options.':'';if(batchErrors)lastQualityMessage+=(lastQualityMessage?' ':'')+batchErrors+' day(s) could not be analyzed.';showAddressStatus('GPS route placements ready.');renderDateRecommendations(false);}
  function renderDateRecommendations(working){
    dateSuggestions.innerHTML='<h3>Best upcoming dates</h3>';if(working){dateSuggestions.innerHTML+='<div class="muted">Searching day '+Math.min(batchCompleted+1,batchTotal)+' of '+batchTotal+'. Results update as each day finishes.</div>';}else if(lastQualityMessage){dateSuggestions.innerHTML+='<div class="muted">'+lastQualityMessage+'</div>';}if(!allDateOptions.length){dateSuggestions.innerHTML+='<div class="muted">'+(working?'Checking the first route…':'No weekday routes were available to compare.')+'</div>';}
    var grid=document.createElement('div');grid.className='dateGrid';allDateOptions.forEach(function(option,index){var button=document.createElement('button');button.type='button';button.className='dateOption';var stop='Stop #'+option.position+(option.position===1?' (first stop)':(option.position===option.customerCount+1?' (last stop)':''));var gps=option.roadDataComplete?'<div class="dateMeta"><b>Drive:</b> '+formatMinutes(option.routeDriveMinutes)+' · '+option.routeDistanceKm.toFixed(1)+' km</div><div class="dateMeta"><b>Added:</b> +'+Math.round(option.addedDurationMinutes)+' min · +'+option.addedDistanceKm.toFixed(1)+' km</div>':'<div class="dateMeta"><b>GPS road routing unavailable</b></div>';button.innerHTML='<div class="dateRank">RECOMMENDATION '+(index+1)+'</div><b>'+option.displayDate+'</b><div class="dateMeta"><b>'+(option.displayRating||option.rating)+'</b></div><div class="dateMeta">Week '+option.rotationWeek+' · '+option.customerCount+' stops</div><div class="dateMeta"><b>Placement:</b> '+stop+'</div>'+gps+'<div class="dateMeta">'+(option.displayReason||option.reason)+'</div>';button.addEventListener('click',function(){selectRecommendedDate(option.date);});grid.appendChild(button);});dateSuggestions.appendChild(grid);
    var more=document.createElement('button');more.type='button';more.className='searchMore';more.disabled=!!working;more.textContent=working?'Searching '+batchCompleted+' of '+batchTotal+' business days…':'Expand Search';more.addEventListener('click',function(){refreshDateRecommendations(true);});dateSuggestions.appendChild(more);
  }
  function refreshDateRecommendations(expand){
    var address=addressInput.value.trim(),token=++dateRequestSequence;if(!selectedAddress){dateSuggestions.style.display='none';dateSuggestions.innerHTML='';return;}dateSuggestions.style.display='block';var requestedOffset=expand?searchOffset:0;batchCompleted=0;batchTotal=6;batchErrors=0;batchDateOptions=[];lastQualityMessage='';renderDateRecommendations(true);
    for(var dayIndex=0;dayIndex<6;dayIndex++)(function(offset){
      google.script.run.withSuccessHandler(function(result){if(token!==dateRequestSequence)return;batchDateOptions=batchDateOptions.concat((result&&result.recommendations)||[]);batchCompleted++;renderDateRecommendations(batchCompleted<batchTotal);finishProgressiveBatch(token,requestedOffset,expand);}).withFailureHandler(function(){if(token!==dateRequestSequence)return;batchErrors++;batchCompleted++;renderDateRecommendations(batchCompleted<batchTotal);finishProgressiveBatch(token,requestedOffset,expand);}).recommendTemporaryVisitDates({address:address,addressVerified:true,addressDetails:selectedAddress,startOffsetWorkingDays:requestedOffset+offset,workdayCount:1,maxResults:1});
    })(dayIndex);
  }
  function selectRecommendedDate(date){var cards=visitsContainer.querySelectorAll('.visitCard'),target=null;for(var i=0;i<cards.length;i++){if(!cards[i].querySelector('.visitDate').value){target=cards[i];break;}}if(!target)target=addVisit('');target.querySelector('.visitDate').value=date;target.setAttribute('data-manual','false');queuePlacementSuggestions();}
  function payload(){var cards=visitsContainer.querySelectorAll('.visitCard'),visits=[],firstName=firstNameInput.value.trim(),lastName=lastNameInput.value.trim(),calendarTitle=calendarTitleInput?calendarTitleInput.value.trim():lastName;for(var i=0;i<cards.length;i++){var date=cards[i].querySelector('.visitDate').value;if(date)visits.push({date:date,stopPosition:Number(cards[i].querySelector('.visitStop').value||1)});}return{title:calendarTitle,calendarTitle:calendarTitle,firstName:firstName,lastName:lastName,fullName:[firstName,lastName].filter(Boolean).join(' '),address:addressInput.value.trim(),addressVerified:!!selectedAddress,addressDetails:selectedAddress,phone:phoneInput.value.trim(),email:emailInput.value.trim(),customerNotes:customerNotesInput.value.trim(),entryInformation:entryInformationInput.value.trim(),visits:visits,dates:visits.map(function(v){return v.date;}),notes:[customerNotesInput.value.trim(),entryInformationInput.value.trim()].filter(Boolean).join('\\n\\n')};}
  function resetForm(){lastNameInput.value='';firstNameInput.value='';addressInput.value='';phoneInput.value='';emailInput.value='';customerNotesInput.value='';entryInformationInput.value='';visitsContainer.innerHTML='';dateSuggestions.style.display='none';dateSuggestions.innerHTML='';selectedAddress=null;addressMisses=0;addressGoogleFirst=false;calendarTitleInput=null;calendarTitleEdited=false;lastAutoCalendarTitle='';closeAddressList();showAddressStatus('');addressDetails.style.display='none';addressDetails.textContent='';visitCounter=0;searchOffset=0;allDateOptions=[];batchDateOptions=[];lastQualityMessage='';batchCompleted=0;batchTotal=0;batchErrors=0;addVisit('');addressInput.focus();}
  function scheduleVisits(){var data=payload();if(!data.title){showStatus('Enter a Calendar title or surname.','error');return;}if(!data.addressVerified){showStatus('Choose a complete service address from the suggestions.','error');return;}if(!data.visits.length){showStatus('Choose at least one visit date.','error');return;}setBusy(true);showStatus('Creating '+data.visits.length+' temporary visit(s) and restaggering the selected route(s)…','');google.script.run.withSuccessHandler(function(result){setBusy(false);showStatus(result.created+' temporary visit(s) created.\\n'+result.adjusted+' event time(s) adjusted.\\n\\nReady for the next customer.','success');resetForm();setTimeout(function(){statusBox.style.display='none';},3000);}).withFailureHandler(function(error){setBusy(false);showStatus('Unable to schedule visits:\\n'+(error&&error.message?error.message:String(error)),'error');}).scheduleTemporaryVisits(data);}
  addVisitButton.addEventListener('click',function(){addVisit('');});scheduleButton.addEventListener('click',scheduleVisits);document.getElementById('closeButton').addEventListener('click',function(){google.script.host.close();});addressInput.addEventListener('input',queueAddressSuggestions);lastNameInput.addEventListener('input',formatCustomerNameInput);lastNameInput.addEventListener('input',updateCalendarTitleFromLastName);firstNameInput.addEventListener('input',formatCustomerNameInput);phoneInput.addEventListener('input',formatPhoneInput);[lastNameInput,firstNameInput,phoneInput,emailInput].forEach(function(input){input.addEventListener('keydown',movePrimaryFieldOnEnter);});addressInput.addEventListener('keydown',function(event){var open=addressList.style.display==='block'&&addressOptions.length;if(event.key==='ArrowDown'&&open){event.preventDefault();setAddressActive(addressActive+1);}else if(event.key==='ArrowUp'&&open){event.preventDefault();setAddressActive(addressActive-1);}else if(event.key==='Enter'){event.preventDefault();if(open)selectAddressOption(addressActive<0?0:addressActive);else if(selectedAddress)lastNameInput.focus();}else if(event.key==='Escape'&&open){closeAddressList();}});document.addEventListener('mousedown',function(event){if(!event.target.closest('.addressWrap'))closeAddressList();});google.script.run.preparePmosAddressSuggestions();addVisit('');addressInput.focus();
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

  // Scheduling accepts only the same complete, confirmed address used by the
  // route recommendations. This prevents a typed edit from bypassing routing.
  getVerifiedTemporaryVisitPoint_(payload);


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

  if (payload.email) {
    lines.push(`Email: ${payload.email}`);
  }

  if (payload.customerNotes) {
    lines.push('', 'Customer Notes:', String(payload.customerNotes));
  }

  if (payload.entryInformation) {
    lines.push('', 'Entry Information:', String(payload.entryInformation));
  }

  if (!payload.customerNotes && !payload.entryInformation && payload.notes) {
    lines.push('', String(payload.notes));
  }


  lines.push('', `PMOS_TEMP_VISIT_ID=${Utilities.getUuid()}`);


  return lines.join('\n');
}
