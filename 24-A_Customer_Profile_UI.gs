/** Customer Lookup and future direct Edit Customer search entry points. */
function showCustomerLookup(){showPmosCustomerSearchWindow_('LOOKUP')}
function showEditCustomerInformationSearch(){showPmosCustomerSearchWindow_('EDIT_SEARCH')}
function showPmosCustomerSearchWindow_(mode,initialCustomerId){const safeMode=mode==='EDIT_SEARCH'?'EDIT_SEARCH':'LOOKUP';const title=safeMode==='LOOKUP'?'Customer Lookup':'Edit Customer Information';const html=HtmlService.createHtmlOutput(buildPmosCustomerLookupHtml_(safeMode,initialCustomerId)).setWidth(1180).setHeight(780);SpreadsheetApp.getUi().showModelessDialog(html,title)}
function buildPmosCustomerLookupHtml_(mode,initialCustomerId){const modeJson=JSON.stringify(mode),initialJson=JSON.stringify(String(initialCustomerId||''));return `<!doctype html><html><head><base target="_top"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;700;900&display=swap" rel="stylesheet"><style>
*{box-sizing:border-box}body{margin:0;background:#e5eaed;color:#293944;font-family:'Mulish',Arial,sans-serif}.app{height:100vh;display:grid;grid-template-columns:272px 1fr;transition:grid-template-columns .24s ease}.app.sidebar-collapsed{grid-template-columns:42px 1fr}.sidebar{position:relative;display:flex;min-width:0;overflow:hidden;flex-direction:column;background:#566a76;color:#fff;border-right:1px solid #455b67}.sidebar-inner{display:flex;min-width:272px;min-height:0;flex:1;flex-direction:column;transition:opacity .15s ease}.sidebar-collapsed .sidebar-inner{opacity:0;pointer-events:none}.collapse{position:absolute;z-index:3;top:12px;right:9px;width:28px;height:28px;border:1px solid rgba(255,255,255,.24);border-radius:7px;background:rgba(255,255,255,.1);color:#fff;cursor:pointer;font-size:17px;line-height:1}.sidebar-collapsed .collapse{right:7px;border-color:transparent;background:transparent}.collapse .open-icon{display:none}.sidebar-collapsed .collapse .close-icon{display:none}.sidebar-collapsed .collapse .open-icon{display:inline}.brand{padding:18px 48px 13px 17px}.brand-top{display:flex;align-items:center;gap:10px}.brand-logo{width:42px;height:42px;object-fit:contain;filter:drop-shadow(0 3px 7px rgba(0,0,0,.14))}.brand-title{font-weight:900}.brand-mark{margin-top:2px;color:#c4e5f2;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.search-wrap{padding:0 14px 13px}.search{width:100%;border:1px solid rgba(255,255,255,.29);border-radius:8px;background:rgba(255,255,255,.12);color:#fff;padding:11px 12px;font:inherit;outline:none}.search::placeholder{color:#dce4e7}.search:focus{border-color:#75c4e5;box-shadow:0 0 0 3px rgba(1,125,177,.22)}.search-panel{display:flex;min-height:0;flex:1;flex-direction:column;border-top:1px solid rgba(255,255,255,.1);padding-top:10px}.count{padding:0 17px 7px;color:#d0d9dd;font-size:11px}.results{min-height:0;overflow-y:auto;overscroll-behavior:contain;overflow-anchor:none;scroll-behavior:auto;padding:0 8px 16px;scrollbar-color:#91a1aa transparent;scrollbar-width:thin}.results:after{content:'';display:block;height:calc(100% - 118px);min-height:90px}.result{display:block;width:100%;margin:2px 0;padding:10px;border:0;border-left:3px solid transparent;border-radius:7px;background:transparent;color:#fff;text-align:left;cursor:pointer}.result.cursor{border-left-color:#75c4e5;background:rgba(255,255,255,.2);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}.result.active{border-left-color:#00aadb;background:rgba(1,125,177,.29)}.result-name{font-weight:900;font-size:13px}.result-meta{margin-top:3px;color:#dae1e4;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.main{min-width:0;overflow:auto;overscroll-behavior:contain}.empty{height:100%;display:grid;place-items:center;padding:40px;text-align:center}.empty h2{margin:0 0 8px;font-size:28px}.empty p{max-width:450px;margin:0;color:#68747a;line-height:1.6}.profile{display:none}.hero{padding:28px 34px 24px;background:#f2f5f6;border-bottom:1px solid #d2dade}.hero-row{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.identity{display:flex;gap:15px;align-items:center}.avatar{width:58px;height:58px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;background:#d9edf6;color:#0f5470;font-size:19px;font-weight:900}.hero h2{margin:0;font-size:30px;font-weight:900}.subline{display:flex;align-items:center;gap:8px;min-height:23px;margin-top:4px;color:#747f84;font-size:12px}.badge{display:inline-block;padding:4px 8px;border-radius:999px;background:#dcecf3;color:#0f5470;font-size:10px;font-weight:900;text-transform:uppercase}.edit{padding:10px 16px;border:1px solid #0f5470;border-radius:7px;background:#0f5470;color:#fff;font-weight:900;cursor:pointer;box-shadow:0 4px 12px rgba(15,84,112,.16)}.edit:hover{border-color:#017db1;background:#017db1}.content{padding:23px 34px 38px}.contact-grid{display:grid;grid-template-columns:1.55fr .8fr 1.15fr;gap:11px}.card{background:#f9fafb;border:1px solid #d2dade;border-radius:10px;padding:16px;box-shadow:0 4px 14px rgba(46,56,66,.04)}.label{font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#7f898e}.value{margin-top:6px;font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:break-word}.contact-link{display:flex;align-items:flex-start;gap:7px;color:#293944;text-decoration:none}.contact-link:hover{color:#017db1;text-decoration:underline}.contact-icon{width:17px;flex:0 0 auto;color:#017db1}.section-head{margin:24px 2px 9px}.section-head h3{margin:0;font-size:19px;font-weight:900}.summary-card{margin-bottom:9px;padding:0;overflow:hidden}.summary-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border:0;background:#f9fafb;text-align:left;cursor:pointer}.summary-copy{min-width:0}.summary-title{font-size:13px;font-weight:900}.summary-line{margin-top:4px;color:#68747a;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.toggle-label{flex:0 0 auto;color:#0f5470;font-size:11px;font-weight:900}.summary-details{display:none;padding:14px 16px 16px;border-top:1px solid #e5eaed}.summary-card.open .summary-details{display:block}.details-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.detail{padding:10px;border-radius:7px;background:#edf1f3}.detail .value{font-size:12px}.equipment-list{margin-top:12px}.equipment-item{padding:9px 0;border-top:1px solid #e2e7e9;font-size:12px}.notes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.notes.single{grid-template-columns:1fr}.contact-sync{margin-top:11px}.contact-sync-title{font-size:13px;font-weight:900}.contact-sync-status{margin:5px 2px 0;color:#68747a;font-size:11px;line-height:1.45}.household-contact-list{display:grid;gap:8px;margin-top:9px}.household-contact-card{display:grid;grid-template-columns:minmax(145px,.8fr) minmax(0,1fr) minmax(0,1.35fr);align-items:center;gap:12px;padding:11px 13px;background:#f9fafb;border:1px solid #d2dade;border-radius:9px;box-shadow:0 3px 10px rgba(46,56,66,.035)}.household-contact-name{font-size:12px;font-weight:900}.household-contact-card a{min-width:0;color:#0f5470;text-decoration:none;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.household-contact-card a:hover{text-decoration:underline}.manage-contacts{margin-top:9px;padding:8px 12px;border:1px solid #0f5470;border-radius:7px;background:#fff;color:#0f5470;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.contact-manage-body{margin-top:9px;padding:12px;border:1px solid #d2dade;border-radius:9px;background:#f9fafb}.contact-sync-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px}.contact-sync button{padding:8px 11px;border:1px solid #b8c6cd;border-radius:7px;background:#fff;color:#293944;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.contact-sync button.primary{border-color:#0f5470;background:#0f5470;color:#fff}.contact-sync button:disabled{opacity:.55;cursor:wait}.contact-candidate{margin-top:9px;padding:10px;border-radius:7px;background:#edf1f3}.contact-candidate-name{font-size:12px;font-weight:900}.contact-candidate-meta{margin-top:3px;color:#68747a;font-size:10px;line-height:1.4}.error{margin:18px;color:#922f2f;background:#fdecec;border:1px solid #f2c7c7;border-radius:8px;padding:12px}.loading{padding:16px;color:#d5dde1;font-size:12px}.editor-note{margin-top:10px;color:#747f84;font-size:11px}@media(max-width:820px){.app,.app.sidebar-collapsed{grid-template-columns:1fr}.sidebar{max-height:42vh}.sidebar-collapsed .sidebar{max-height:42px}.main{min-height:58vh}.contact-grid,.details-grid,.notes{grid-template-columns:1fr}.household-contact-card{grid-template-columns:1fr}.content,.hero{padding-left:20px;padding-right:20px}}
</style></head><body><div id="app" class="app"><aside id="sidebar" class="sidebar"><button id="collapse" class="collapse" type="button" title="Hide customer list" aria-label="Hide customer list"><span class="close-icon">‹</span><span class="open-icon">⌕</span></button><div class="sidebar-inner"><div class="brand"><div class="brand-top"><img src="https://www.finnpools.ca/images/logo_only.png" class="brand-logo" alt="Finn Pools"><div><div id="windowTitle" class="brand-title"></div><div class="brand-mark">Finn Pools · PMOS</div></div></div></div><div class="search-wrap"><input id="search" class="search" autocomplete="off" placeholder="Find by last name"></div><div class="search-panel"><div id="count" class="count"></div><div id="results" class="results"></div></div></div></aside><main class="main"><div id="empty" class="empty"><div><h2>Find a customer</h2><p>Type a last name or scroll through the customer list.</p></div></div><div id="profile" class="profile"><div class="hero"><div class="hero-row"><div class="identity"><div id="avatar" class="avatar"></div><div><h2 id="profileName"></h2><div class="subline"><span id="profileSubtitle"></span><span id="status" class="badge"></span></div></div></div><button id="edit" class="edit">Edit Customer</button></div></div><div id="content" class="content"></div></div><div id="error"></div></main></div><script>
var mode=${modeJson},initialCustomerId=${initialJson},selectedId='',cursorId='',allRows=[],searchTargetId='',rollFrame=0,rollTarget=0,rollTargetId='',rollDone=null,rollSpeed=0,rollLastTime=0,rollTravel=0,rollSelectionPoint=null,keyFrame=0,keyDirection=0,keySpeed=0,keyLastTime=0,keyStarted=0,keyStartId='',keyHoldTimer=0,keySelectionPoint=null;
function el(id){return document.getElementById(id)}function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}function initials(name){return String(name||'').split(/\\s+/).filter(Boolean).slice(0,2).map(function(part){return part.charAt(0).toUpperCase()}).join('')||'—'}
function icon(name){var paths={map:'<path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11z"/><circle cx="12" cy="10" r="2"/>',phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1z"/>',mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/>'};return '<svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'+paths[name]+'</svg>'}
function showError(error){el('error').className='error';el('error').textContent=error&&error.message?error.message:String(error)}function loadResults(){el('count').textContent='Loading customers…';google.script.run.withSuccessHandler(renderResults).withFailureHandler(showError).searchPmosCustomerProfiles('')}
/* PMOS_ROLODEX_CORE_START */
function normalizeSearch(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\\s+/g,' ').trim()}function searchKey(value){return normalizeSearch(value).replace(/\\s/g,'')}function customerButton(id){return id&&el('results').querySelector('.result[data-id="'+String(id).replace(/"/g,'\\"')+'"]')}function setCursor(id){id=id||'';if(cursorId===id&&customerButton(id)&&customerButton(id).classList.contains('cursor'))return;cursorId=id;Array.prototype.forEach.call(el('results').querySelectorAll('.result'),function(button){button.classList.toggle('cursor',button.getAttribute('data-id')===cursorId)})}
function stopRoll(){if(rollFrame)cancelAnimationFrame(rollFrame);rollFrame=0;rollDone=null;rollSpeed=0;rollLastTime=0;rollTravel=0;rollSelectionPoint=null}function selectionY(list){var first=list.querySelector('.result'),rowHeight=first?first.offsetHeight+2:50,topOffset=Math.min(rowHeight*2,Math.max(0,list.scrollTop));return list.getBoundingClientRect().top+4+topOffset}function visibleButton(list,lockedPoint){var buttons=Array.prototype.slice.call(list.querySelectorAll('.result')),point=typeof lockedPoint==='number'?lockedPoint:selectionY(list);return buttons.reduce(function(best,button){var rect=button.getBoundingClientRect();if(rect.bottom<list.getBoundingClientRect().top||rect.top>list.getBoundingClientRect().bottom)return best;var distance=Math.abs(rect.top-point);return !best||distance<best.distance?{button:button,distance:distance}:best},null)}function highlightVisibleRow(list,lockedPoint){var closest=visibleButton(list,lockedPoint);if(closest&&closest.button)setCursor(closest.button.getAttribute('data-id'))}function ensureCursorVisible(id){var list=el('results'),button=customerButton(id);if(!button)return;var listRect=list.getBoundingClientRect(),buttonRect=button.getBoundingClientRect();if(buttonRect.top<listRect.top)list.scrollTop-=listRect.top-buttonRect.top+4;else if(buttonRect.bottom>listRect.bottom)list.scrollTop+=buttonRect.bottom-listRect.bottom+4;setCursor(id)}function finishRoll(){var done=rollDone;rollFrame=0;rollDone=null;rollSpeed=0;rollLastTime=0;rollTravel=0;rollSelectionPoint=null;el('results').scrollTop=rollTarget;setCursor(rollTargetId);if(done)done()}function continueRoll(now){var list=el('results'),remaining=rollTarget-list.scrollTop,elapsed=Math.min(40,Math.max(1,now-(rollLastTime||now-16))),direction=remaining<0?-1:1,scale=Math.min(1,rollTravel/900),acceleration=.0018+scale*.0008,deceleration=.0048+scale*.0018,maxSpeed=2.8+scale*1.15,currentDirection=rollSpeed<0?-1:rollSpeed>0?1:direction,currentMagnitude=Math.abs(rollSpeed),desiredMagnitude=Math.min(maxSpeed,Math.sqrt(2*deceleration*Math.abs(remaining)));if(currentDirection!==direction)currentMagnitude=Math.max(0,currentMagnitude-deceleration*elapsed);else if(currentMagnitude<desiredMagnitude)currentMagnitude=Math.min(desiredMagnitude,currentMagnitude+acceleration*elapsed);else currentMagnitude=Math.max(desiredMagnitude,currentMagnitude-deceleration*elapsed);rollSpeed=(currentMagnitude?(currentDirection===direction?direction:currentDirection):0)*currentMagnitude;var movement=rollSpeed*elapsed,reaches=((remaining>0&&movement>0)||(remaining<0&&movement<0))&&Math.abs(movement)>=Math.abs(remaining);if(reaches||Math.abs(remaining)<.7){finishRoll();return}list.scrollTop+=movement;highlightVisibleRow(list,rollSelectionPoint);rollLastTime=now;rollFrame=requestAnimationFrame(continueRoll)}function buttonScrollTarget(button,rowsAbove){var list=el('results'),listRect=list.getBoundingClientRect(),buttonRect=button.getBoundingClientRect(),rowHeight=button.offsetHeight+2,current=list.scrollTop,relativeTop=buttonRect.top-listRect.top+current;return Math.min(Math.max(0,relativeTop-4-(rowsAbove||0)*rowHeight),Math.max(0,list.scrollHeight-list.clientHeight))}function rollToButton(button,rowsAbove,instant,done,directionGuard){if(!button){if(done)done();return}var list=el('results'),target=buttonScrollTarget(button,rowsAbove),id=button.getAttribute('data-id');if(directionGuard>0)target=Math.max(list.scrollTop,target);else if(directionGuard<0)target=Math.min(list.scrollTop,target);rollTarget=target;rollTargetId=id;if(done)rollDone=done;if(instant){stopRoll();list.scrollTop=target;setCursor(id);if(done)done();return}if(Math.abs(target-list.scrollTop)<1){finishRoll();return}if(!rollFrame){rollTravel=Math.abs(target-list.scrollTop);rollLastTime=performance.now();rollFrame=requestAnimationFrame(continueRoll)}}
function surnameKey(row){return searchKey(String(row.listName||row.displayName||'').split(',')[0])}function fullListKey(row){return searchKey(row.listName||row.displayName||'')}function resolveSearchMatch(query){var clean=searchKey(query),match;if(!clean)return allRows.find(function(row){return row.customerId===selectedId})||allRows[0];match=allRows.find(function(row){return surnameKey(row).indexOf(clean)===0});if(!match)match=allRows.find(function(row){return fullListKey(row).indexOf(clean)===0});if(!match)match=allRows.find(function(row){return surnameKey(row)>=clean});return match||allRows[allRows.length-1]}function rollToQuery(query,instant){var match=resolveSearchMatch(query),clean=searchKey(query);if(!match)return;el('count').textContent=clean?'Target: '+(match.listName||match.displayName):allRows.length+(allRows.length===1?' customer':' customers')+' · alphabetical by last name';if(match.customerId===searchTargetId)return;searchTargetId=match.customerId;rollSelectionPoint=null;rollToButton(customerButton(match.customerId),clean?2:(selectedId?2:0),instant)}
function cancelKeyMotion(){if(keyHoldTimer)clearTimeout(keyHoldTimer);keyHoldTimer=0;if(keyFrame)cancelAnimationFrame(keyFrame);keyFrame=0;keyDirection=0;keySpeed=0;keySelectionPoint=null}function stopKeyMotion(){if(keyHoldTimer){clearTimeout(keyHoldTimer);keyHoldTimer=0;keyDirection=0;return}keyDirection=0}function continueKeyMotion(now){var list=el('results'),elapsed=Math.min(40,Math.max(1,now-(keyLastTime||now-16))),targetSpeed=keyDirection*.86,change=(keyDirection ? .00055 : .0065)*elapsed;if(keySpeed<targetSpeed)keySpeed=Math.min(targetSpeed,keySpeed+change);else if(keySpeed>targetSpeed)keySpeed=Math.max(targetSpeed,keySpeed-change);if(!keyDirection&&Math.abs(keySpeed)<.03){keySpeed=0;keyFrame=0;highlightVisibleRow(list,keySelectionPoint);keySelectionPoint=null;return}list.scrollTop+=keySpeed*elapsed;if(list.scrollTop<=.5&&keySpeed<0){var first=list.querySelector('.result');list.scrollTop=0;keySelectionPoint=list.getBoundingClientRect().top+4;if(first)setCursor(first.getAttribute('data-id'))}else highlightVisibleRow(list,keySelectionPoint);keyLastTime=now;keyFrame=requestAnimationFrame(continueKeyMotion)}function beginHeldKeyMotion(){var inheritedSpeed=rollSpeed,button=customerButton(cursorId);keyHoldTimer=0;if(!keyDirection||keyFrame)return;keySelectionPoint=button?button.getBoundingClientRect().top:null;stopRoll();keySpeed=inheritedSpeed;keyLastTime=performance.now();keyFrame=requestAnimationFrame(continueKeyMotion)}function startKeyMotion(direction){var baseId=rollFrame&&rollTargetId?rollTargetId:cursorId,startIndex=allRows.findIndex(function(row){return row.customerId===baseId}),next,button=customerButton(cursorId);if(startIndex<0)return;searchTargetId='';cancelKeyMotion();rollSelectionPoint=button?button.getBoundingClientRect().top:null;keyDirection=direction;keyStarted=performance.now();keyStartId=baseId;next=Math.max(0,Math.min(allRows.length-1,startIndex+direction));rollToButton(customerButton(allRows[next].customerId),2,false,null,direction);keyHoldTimer=setTimeout(beginHeldKeyMotion,180)}
/* PMOS_ROLODEX_CORE_END */
function renderResults(rows){allRows=rows||[];el('error').className='';el('error').textContent='';el('count').textContent=allRows.length+(allRows.length===1?' customer':' customers')+' · alphabetical by last name';el('results').innerHTML=allRows.map(function(row){var meta=[row.address,row.phone].filter(Boolean).join(' · ');return '<button class="result'+(row.customerId===selectedId?' active':'')+'" data-id="'+esc(row.customerId)+'"><div class="result-name">'+esc(row.listName||row.displayName)+'</div><div class="result-meta">'+esc(meta)+'</div></button>'}).join('')||'<div class="loading">No customers found.</div>';Array.prototype.forEach.call(el('results').querySelectorAll('.result'),function(button){button.addEventListener('click',function(){openCustomer(this.getAttribute('data-id'))})});rollToQuery(el('search').value,!selectedId)}
function markSelected(id){Array.prototype.forEach.call(el('results').querySelectorAll('.result'),function(button){button.classList.toggle('active',button.getAttribute('data-id')===id)})}function openCustomer(id,instant){if(!id)return;cancelKeyMotion();stopRoll();selectedId=id;cursorId=id;searchTargetId=id;el('search').value='';markSelected(id);rollToButton(customerButton(id),2,!!instant,function(){el('empty').style.display='none';el('profile').style.display='none';google.script.run.withSuccessHandler(renderProfile).withFailureHandler(showError).getPmosCustomerProfile(id)})}
function addressLines(value){var parts=String(value||'').split(',').map(function(part){return part.trim()}).filter(Boolean);if(parts.length<2)return esc(value);return esc(parts[0])+'<br>'+esc(parts.slice(1).join(', '))}function fitContactValues(){requestAnimationFrame(function(){Array.prototype.forEach.call(el('content').querySelectorAll('[data-fit-contact]'),function(link){var text=link.querySelector('span'),size=13;if(!text)return;link.style.fontSize=size+'px';while(text.scrollWidth>text.clientWidth+.5&&size>9.5){size-=.25;link.style.fontSize=size+'px'}})})}function card(label,value,link,linkIcon){if(!value)return '';var isAddress=linkIcon==='map',fit=linkIcon==='phone'||linkIcon==='mail',shown=isAddress?addressLines(value):esc(value),body=link?'<a class="contact-link value"'+(fit?' data-fit-contact="true"':'')+' href="'+esc(link)+'" target="_blank" rel="noopener"'+(fit?' style="white-space:nowrap;word-break:normal"':'')+'>'+icon(linkIcon)+'<span'+(fit?' style="display:block;min-width:0;overflow:hidden;white-space:nowrap"':'')+'>'+shown+'</span></a>':'<div class="value">'+esc(value)+'</div>';return '<div class="card"><div class="label">'+esc(label)+'</div>'+body+'</div>'}function detail(label,value){if(!value)return '';return '<div class="detail"><div class="label">'+esc(label)+'</div><div class="value">'+esc(value)+'</div></div>'}
function describeUnit(unit){if(!unit)return '';return [unit.type,unit.make,unit.model,unit.modelNumber].filter(Boolean).join(' · ')}function equipmentLabel(item){var names={PUMP:'Additional Pump',FILTER:'Filter',HEATER:'Heater',WATER_FEATURE:'Water Feature',CHEMISTRY_AUTOMATION:'Chemistry Automation',EQUIPMENT_AUTOMATION:'Equipment Automation',IONIZER:'Ionizer',OZONATOR:'Ozonator',UV:'UV Light',SALT_SYSTEM:'Salt Chlorine Generator',CHLORINE_FEEDER:'Chlorinator',BROMINE_FEEDER:'Brominator',OTHER_SANITIZER:'Sanitizer',ROBOT:'Robot',OTHER:'Other Equipment'};return names[item.type]||item.type||'Equipment'}function describeEquipment(item){var d=item&&item.details||{};return [d.name||d.purpose||d.robotType||d.sanitizerType||d.equipmentType,d.manufacturer||d.make,d.model,d.modelNumber].filter(Boolean).join(' · ')}
function automationModel(body,type){var item=(body.equipment||[]).find(function(candidate){return candidate.type===type}),d=item&&item.details||{};return [d.manufacturer||d.make,d.model,d.modelNumber].filter(Boolean).join(' · ')}function filterKind(body){var value=[body.filter&&body.filter.type,body.filter&&body.filter.model].filter(Boolean).join(' ').toLowerCase();if(value.indexOf('cartridge')>=0||value.indexOf('clean & clear')>=0||value.indexOf('swimclear')>=0)return 'Cartridge Filter';if(value.indexOf('sand')>=0||value.indexOf('tagelus')>=0)return 'Sand Filter';if(value.indexOf('de')>=0)return 'DE Filter';return ''}function winterCover(body){var value=String(body.cover&&body.cover.winterType||'').toLowerCase();if(!value)return '';if(value.indexOf('lock')>=0)return 'Lock-In Cover';if(value.indexOf('safety')>=0)return 'Safety Cover';if(value.indexOf('tarp')>=0||value.indexOf('tube')>=0||value.indexOf('waterbag')>=0)return 'Tarp and Tube';return body.cover.winterType}
function bodySummary(body){var parts=[],equipmentAutomation=automationModel(body,'EQUIPMENT_AUTOMATION'),chemistryAutomation=automationModel(body,'CHEMISTRY_AUTOMATION'),cover=String(body.cover&&body.cover.type||'');if(body.sanitization)parts.push(body.sanitization);if(equipmentAutomation)parts.push(equipmentAutomation);if(chemistryAutomation)parts.push(chemistryAutomation);if(/auto/i.test(cover))parts.push('Auto Cover');var filter=filterKind(body);if(filter)parts.push(filter);var winter=winterCover(body);if(winter)parts.push(winter);return parts.join(' · ')}
function summaryCard(title,summary,details){return '<div class="card summary-card"><button type="button" class="summary-head"><div class="summary-copy"><div class="summary-title">'+esc(title)+'</div><div class="summary-line">'+esc(summary||'View details')+'</div></div><span class="toggle-label">View details</span></button><div class="summary-details">'+details+'</div></div>'}
function bodyHtml(body,index){body=body||{};var type=[body.type,body.spaType,body.equipmentSetup].filter(Boolean).join(' · '),pump=describeUnit(body.pump),filter=describeUnit(body.filter),heater=describeUnit(body.heater),cover=[body.cover&&body.cover.type,winterCover(body)].filter(Boolean).join(' · '),unit=[body.unitMake,body.unitModel].filter(Boolean).join(' · '),basics=[detail('Body type',type),detail('Primary sanitization',body.sanitization),detail('Pump',pump),detail('Filter',filter),detail('Heater',heater),detail('Cover',cover),detail('Self-contained unit',unit)].filter(Boolean).join(''),items=(body.equipment||[]).map(function(item){return '<div class="equipment-item"><b>'+esc(equipmentLabel(item))+'</b>'+(describeEquipment(item)?' · '+esc(describeEquipment(item)):'')+'</div>'}).join('');return summaryCard(body.name||body.type||('Body '+(index+1)),bodySummary(body),'<div class="details-grid">'+basics+'</div>'+(items?'<div class="equipment-list">'+items+'</div>':''))}
function maintenanceSummary(profile){var routes=profile.routes||[],frequency=String(profile.frequency||''),days=[],weeks=[],areas=[];routes.forEach(function(route){if(route.day&&days.indexOf(route.day)<0)days.push(route.day);if(route.week&&weeks.indexOf(route.week)<0)weeks.push(route.week);if(route.routeArea&&areas.indexOf(route.routeArea)<0)areas.push(route.routeArea)});var middle=[],everyWeek=/weekly/i.test(frequency)&&!/^bi/i.test(frequency);if(!everyWeek){if(weeks.length===1)middle.push('Week '+weeks[0]);else if(weeks.length)middle.push('Weeks '+weeks.join(' & '))}if(days.length)middle.push(days.join(' & '));var line=(frequency||'Maintenance')+': '+middle.join(', ');if(areas.length)line+=' → '+areas.join(' / ');return line.replace(/:\s*$/,'')}
function seasonTitle(profile){var value=String(profile.yearRound||'').toLowerCase();return value==='yes'||value.indexOf('year round')>=0?'Year Round':'Seasonal'}function maintenanceHtml(profile){var routes=profile.routes||[],routeDetails=routes.map(function(route){return [route.day,route.week?'Week '+route.week:'',route.routeArea,route.stop?'Stop '+route.stop:''].filter(Boolean).join(' · ')}).join('\\n');return summaryCard(seasonTitle(profile),maintenanceSummary(profile),'<div class="details-grid">'+detail('Visit frequency',profile.frequency)+detail('Service start',profile.serviceStartDate)+detail('Route assignment',routeDetails)+'</div>')}
function wireSummaries(){Array.prototype.forEach.call(el('content').querySelectorAll('.summary-head'),function(button){button.addEventListener('click',function(){var host=button.parentNode,open=host.classList.toggle('open'),label=button.querySelector('.toggle-label');label.textContent=open?'Hide details':'View details'})})}
function contactSyncButton(label,action,primary){return '<button type="button"'+(primary?' class="primary"':'')+' onclick="'+action+'">'+esc(label)+'</button>'}
function renderGoogleContactPanel(profile){var panel=document.createElement('div'),grid=el('content').querySelector('.contact-grid');panel.id='googleContactPanel';panel.className='card contact-sync';panel.style.padding='0';panel.style.overflow='hidden';panel.innerHTML='<button type="button" onclick="toggleGoogleContactPanel()" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 15px;border:0;border-radius:0;background:#f9fafb;color:#293944;text-align:left"><span><span class="contact-sync-title">Household contacts</span><span id="googleContactStatus" class="contact-sync-status" style="display:block">Checking linked Google Contacts…</span></span><span id="googleContactToggleLabel" class="toggle-label">Manage</span></button><div id="googleContactBody" style="display:none;padding:0 15px 15px;border-top:1px solid #e5eaed"></div>';if(grid&&grid.parentNode)grid.parentNode.insertBefore(panel,grid.nextSibling);else el('content').insertBefore(panel,el('editorNote'));google.script.run.withSuccessHandler(renderGoogleContactState).withFailureHandler(showGoogleContactError).getPmosGoogleContactState(profile.customerId)}
function toggleGoogleContactPanel(){var body=el('googleContactBody'),label=el('googleContactToggleLabel');if(!body)return;var opening=body.style.display==='none';body.style.display=opening?'block':'none';if(label)label.textContent=opening?'Close':'Manage'}
function showGoogleContactError(error){var status=el('googleContactStatus');if(status)status.textContent=error&&error.message?error.message:String(error);setGoogleContactBusy(false)}
function setGoogleContactBusy(busy){var panel=el('googleContactPanel');if(panel)Array.prototype.forEach.call(panel.querySelectorAll('button'),function(button){button.disabled=!!busy})}
function renderGoogleContactState(state){state=state||{};var status=el('googleContactStatus'),body=el('googleContactBody');if(!status||!body)return;setGoogleContactBusy(false);if(state.status==='LINKED'){var contact=state.contact||{},different=(state.differences||[]).length;status.textContent='Linked to '+(contact.displayName||'Google Contact')+(state.lastSynced?' · last synced '+state.lastSynced:'')+(different?' · '+different+' field'+(different===1?' differs':'s differ'):' · information matches');body.innerHTML='<div class="contact-sync-actions">'+contactSyncButton('Pull from Google','pullGoogleContact()',false)+contactSyncButton('Push to Google','pushGoogleContact()',true)+contactSyncButton('Unlink','unlinkGoogleContact()',false)+'</div>';return}if(state.status==='CANDIDATES'){status.textContent=state.message||'Possible contacts found.';body.innerHTML=(state.candidates||[]).map(function(candidate){var meta=[candidate.matchReason,candidate.phone,candidate.email,candidate.address].filter(Boolean).join(' · ');return '<div class="contact-candidate"><div class="contact-candidate-name">'+esc(candidate.displayName)+'</div><div class="contact-candidate-meta">'+esc(meta)+'</div><div class="contact-sync-actions"><button type="button" class="primary" data-resource="'+esc(candidate.resourceName)+'" onclick="linkGoogleContact(this.dataset.resource)">Link this contact</button></div></div>'}).join('');return}if(state.status==='BROKEN_LINK'){status.textContent=state.message||'The saved link is unavailable.';body.innerHTML='<div class="contact-sync-actions">'+contactSyncButton('Remove broken link','unlinkGoogleContact()',false)+'</div>';return}status.textContent=state.message||'No Google Contact is linked.';body.innerHTML='<div class="contact-sync-actions">'+contactSyncButton('Create Google Contact','createGoogleContact()',true)+'</div>'}
function currentCustomerId(){return selectedId}function linkGoogleContact(resourceName){if(!confirm('Link this Google Contact to the selected PMOS customer?'))return;setGoogleContactBusy(true);google.script.run.withSuccessHandler(renderGoogleContactState).withFailureHandler(showGoogleContactError).linkPmosCustomerGoogleContact(currentCustomerId(),resourceName)}function createGoogleContact(){if(!confirm('Create a new Google Contact using this PMOS customer profile?'))return;setGoogleContactBusy(true);google.script.run.withSuccessHandler(renderGoogleContactState).withFailureHandler(showGoogleContactError).createPmosGoogleContact(currentCustomerId())}function pullGoogleContact(){beginGoogleContactSync('PULL')}function pushGoogleContact(){beginGoogleContactSync('PUSH')}
function beginGoogleContactSync(direction){setGoogleContactBusy(true);google.script.run.withSuccessHandler(function(preview){setGoogleContactBusy(false);if(!preview.differences||!preview.differences.length){alert(preview.summary);return}if(!confirm(preview.summary+'\\n\\nContinue?'))return;setGoogleContactBusy(true);google.script.run.withSuccessHandler(function(state){renderGoogleContactState(state);if(direction==='PULL')google.script.run.withSuccessHandler(renderProfile).withFailureHandler(showError).getPmosCustomerProfile(currentCustomerId())}).withFailureHandler(showGoogleContactError).applyPmosGoogleContactSync(preview.customerId,direction,preview.resourceName)}).withFailureHandler(showGoogleContactError).previewPmosGoogleContactSync(currentCustomerId(),direction)}
function unlinkGoogleContact(){if(!confirm('Remove the PMOS link? The Google Contact itself will not be deleted.'))return;setGoogleContactBusy(true);google.script.run.withSuccessHandler(renderGoogleContactState).withFailureHandler(showGoogleContactError).unlinkPmosCustomerGoogleContact(currentCustomerId())}
function renderProfile(profile){el('profile').style.display='block';el('profileName').textContent=profile.displayName;el('profileSubtitle').textContent=profile.calendarTitle&&profile.calendarTitle!==profile.displayName?'Calendar: '+profile.calendarTitle:'';el('status').textContent=profile.status||'Active';el('avatar').textContent=initials(profile.displayName);var contacts='<div class="contact-grid">'+card('Service address',profile.address,'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(profile.address),'map')+card('Phone',profile.phone,'tel:'+String(profile.phone||'').replace(/\\D/g,''),'phone')+card('Email',profile.email,'mailto:'+profile.email,'mail')+'</div>',bodies=(profile.bodiesOfWater||[]).map(bodyHtml).join('')||(profile.equipmentSummary?card('Equipment',profile.equipmentSummary):''),notes=[profile.entryInformation?card('Entry information',profile.entryInformation):'',profile.notes?card('Customer notes',profile.notes):''].filter(Boolean);el('content').innerHTML=contacts+'<div class="section-head"><h3>Maintenance</h3></div>'+maintenanceHtml(profile)+'<div class="section-head"><h3>Bodies of water & equipment</h3></div>'+bodies+(notes.length?'<div class="section-head"><h3>Customer details</h3></div><div class="notes'+(notes.length===1?' single':'')+'">'+notes.join('')+'</div>':'')+'<div id="editorNote" class="editor-note"></div>';wireSummaries();fitContactValues();renderGoogleContactPanel(profile);markSelected(profile.customerId);setCursor(profile.customerId)}
el('search').addEventListener('focus',function(){this.select()});el('search').addEventListener('input',function(){rollToQuery(this.value,false)});el('search').addEventListener('keydown',function(event){if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!event.repeat)startKeyMotion(event.key==='ArrowDown'?1:-1)}else if(event.key==='Enter'){var target=searchKey(this.value)?resolveSearchMatch(this.value):null,id=target&&target.customerId||cursorId;if(id){event.preventDefault();openCustomer(id,!!target)}}else if(event.key==='Escape'){this.value='';this.blur();rollToQuery('',false)}});el('search').addEventListener('keyup',function(event){if(event.key==='ArrowDown'||event.key==='ArrowUp')stopKeyMotion()});window.addEventListener('blur',function(){stopKeyMotion()});el('results').addEventListener('mousemove',function(event){var button=event.target.closest&&event.target.closest('.result');if(button&&this.contains(button)){searchTargetId='';cancelKeyMotion();stopRoll();setCursor(button.getAttribute('data-id'))}});el('results').addEventListener('wheel',function(){searchTargetId='';cancelKeyMotion();stopRoll();requestAnimationFrame(function(){highlightVisibleRow(el('results'))})},{passive:true});el('results').addEventListener('keydown',function(event){if(event.key==='Enter'&&cursorId){event.preventDefault();openCustomer(cursorId)}});el('collapse').addEventListener('click',function(){var collapsed=el('app').classList.toggle('sidebar-collapsed');this.title=collapsed?'Show customer list':'Hide customer list';this.setAttribute('aria-label',this.title);if(!collapsed)setTimeout(function(){el('search').focus()},240)});el('windowTitle').textContent=mode==='LOOKUP'?'Customer Lookup':'Edit Customer Information';if(mode==='EDIT_SEARCH')el('edit').textContent='Open Editor';loadResults();[60,250,700].forEach(function(delay){setTimeout(function(){el('search').focus()},delay)});
function householdContactHtml(contact){var phone=contact.phone?'<a href="tel:'+esc(String(contact.phone).replace(/\\D/g,''))+'" style="color:#0f5470;text-decoration:none">☎ '+esc(contact.phone)+'</a>':'',email=contact.email?'<a href="mailto:'+esc(contact.email)+'" style="color:#0f5470;text-decoration:none">✉ '+esc(contact.email)+'</a>':'',details=[phone,email].filter(Boolean).join('<span style="color:#aab5ba"> · </span>'),notes=contact.notes?'<div style="margin-top:7px;color:#68747a;font-size:11px;line-height:1.45">'+esc(contact.notes)+'</div>':'';return '<div style="padding:11px 0;border-bottom:1px solid #e3e8ea"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div><div style="font-size:12px;font-weight:900">'+esc(contact.displayName||'Unnamed contact')+'</div><div style="margin-top:5px;font-size:11px">'+(details||'<span style="color:#7c898f">No phone or email</span>')+'</div>'+notes+'</div><button type="button" data-resource="'+esc(contact.resourceName)+'" onclick="unlinkGoogleContactPerson(this.dataset.resource)" style="padding:5px 7px;border:1px solid #c7d0d4;border-radius:6px;background:#fff;color:#68747a;font-size:10px">Remove</button></div></div>'}function renderGoogleContactState(state){state=state||{};var status=el('googleContactStatus'),body=el('googleContactBody');if(!status||!body)return;setGoogleContactBusy(false);if(state.status==='LINKED'){var contacts=state.contacts&&state.contacts.length?state.contacts:[state.contact||{}],count=contacts.length;status.textContent=count+' household contact'+(count===1?'':'s')+' linked'+(state.lastSynced?' · updated '+state.lastSynced:'');body.innerHTML='<div>'+contacts.map(householdContactHtml).join('')+'</div>'+(count===1?'<div class="contact-sync-actions">'+contactSyncButton('Pull from Google','pullGoogleContact()',false)+contactSyncButton('Push to Google','pushGoogleContact()',true)+'</div>':'')+'<div class="contact-sync-actions">'+contactSyncButton('Unlink all','unlinkGoogleContact()',false)+'</div>';return}if(state.status==='CANDIDATES'){status.textContent=state.message||'Possible household contacts found.';body.innerHTML=(state.candidates||[]).map(function(candidate){var meta=[candidate.matchReason,candidate.phone,candidate.email,candidate.address].filter(Boolean).join(' · ');return '<div class="contact-candidate"><div class="contact-candidate-name">'+esc(candidate.displayName)+'</div><div class="contact-candidate-meta">'+esc(meta)+'</div><div class="contact-sync-actions"><button type="button" class="primary" data-resource="'+esc(candidate.resourceName)+'" onclick="linkGoogleContact(this.dataset.resource)">Link this person</button></div></div>'}).join('');return}if(state.status==='BROKEN_LINK'){status.textContent=state.message||'The saved links are unavailable.';body.innerHTML='<div class="contact-sync-actions">'+contactSyncButton('Remove broken links','unlinkGoogleContact()',false)+'</div>';return}status.textContent=state.message||'No household contacts are linked.';body.innerHTML='<div class="contact-sync-actions">'+contactSyncButton('Create Google Contact','createGoogleContact()',true)+'</div>'}function unlinkGoogleContactPerson(resourceName){if(!confirm('Remove this person from the household pool profile? The Google Contact will not be deleted.'))return;setGoogleContactBusy(true);google.script.run.withSuccessHandler(renderGoogleContactState).withFailureHandler(showGoogleContactError).unlinkPmosCustomerGoogleContactPerson(currentCustomerId(),resourceName)}
function compactHouseholdContactHtml(contact,index){var phone=contact.phone?'<a href="tel:'+esc(String(contact.phone).replace(/\D/g,''))+'" style="color:#0f5470;text-decoration:none">☎ '+esc(contact.phone)+'</a>':'',email=contact.email?'<a href="mailto:'+esc(contact.email)+'" style="color:#0f5470;text-decoration:none">✉ '+esc(contact.email)+'</a>':'',notes=contact.notes?'<div style="margin-top:7px;color:#68747a;font-size:11px;line-height:1.45">'+esc(contact.notes)+'</div>':'';return '<div style="margin-top:7px;border:1px solid #d8e1e5;border-radius:8px;overflow:hidden"><button type="button" onclick="toggleHouseholdContact('+index+')" style="width:100%;display:flex;justify-content:space-between;align-items:center;padding:10px 11px;border:0;background:#fff;color:#293944;text-align:left;font-weight:900"><span>'+esc(contact.displayName||'Unnamed contact')+'</span><span id="householdContactArrow'+index+'" style="color:#0f5470">View</span></button><div id="householdContactDetails'+index+'" style="display:none;padding:0 11px 11px;background:#fff"><div style="display:flex;flex-wrap:wrap;gap:10px;font-size:11px">'+([phone,email].filter(Boolean).join('')||'<span style="color:#7c898f">No phone or email</span>')+'</div>'+notes+'<button type="button" data-resource="'+esc(contact.resourceName)+'" onclick="unlinkGoogleContactPerson(this.dataset.resource)" style="margin-top:9px;padding:5px 7px;border:1px solid #c7d0d4;border-radius:6px;background:#fff;color:#68747a;font-size:10px">Remove contact</button></div></div>'}function toggleHouseholdContact(index){var details=el('householdContactDetails'+index),arrow=el('householdContactArrow'+index);if(!details)return;var open=details.style.display==='none';details.style.display=open?'block':'none';if(arrow)arrow.textContent=open?'Hide':'View'}function renderGoogleContactState(state){state=state||{};var status=el('googleContactStatus'),body=el('googleContactBody');if(!status||!body)return;setGoogleContactBusy(false);if(state.status==='LINKED'){var contacts=state.contacts&&state.contacts.length?state.contacts:[state.contact||{}],additional=contacts.slice(1);status.textContent=additional.length?additional.length+' additional household contact'+(additional.length===1?'':'s'):'Main contact linked';body.style.display=additional.length?'block':'none';body.innerHTML=additional.map(compactHouseholdContactHtml).join('')+(additional.length?'<div class="contact-sync-actions">'+contactSyncButton('Manage contacts','toggleGoogleContactPanel()',false)+'</div>':'');return}body.style.display='none';if(state.status==='CANDIDATES'){status.textContent=state.message||'Possible contacts found.';body.innerHTML=(state.candidates||[]).map(function(candidate){return '<div class="contact-candidate"><div class="contact-candidate-name">'+esc(candidate.displayName)+'</div><div class="contact-candidate-meta">'+esc([candidate.matchReason,candidate.phone,candidate.email,candidate.address].filter(Boolean).join(' · '))+'</div><div class="contact-sync-actions"><button type="button" class="primary" data-resource="'+esc(candidate.resourceName)+'" onclick="linkGoogleContact(this.dataset.resource)">Link this person</button></div></div>'}).join('');return}if(state.status==='BROKEN_LINK'){status.textContent=state.message||'The saved links are unavailable.';return}status.textContent=state.message||'No household contacts are linked.'}function openCustomer(id,instant){if(!id)return;cancelKeyMotion();stopRoll();selectedId=id;cursorId=id;searchTargetId=id;el('search').value='';markSelected(id);rollToButton(customerButton(id),2,!!instant,function(){if(mode==='EDIT_SEARCH'){el('count').textContent='Opening customer editor…';google.script.run.withSuccessHandler(function(){setTimeout(function(){google.script.host.close()},250)}).withFailureHandler(showError).showPmosCustomerEditor(id,'EDITOR_SEARCH');return}el('empty').style.display='none';el('profile').style.display='none';google.script.run.withSuccessHandler(renderProfile).withFailureHandler(showError).getPmosCustomerProfile(id)})}el('edit').addEventListener('click',function(){if(!selectedId)return;google.script.run.withSuccessHandler(function(){setTimeout(function(){google.script.host.close()},250)}).withFailureHandler(showError).showPmosCustomerEditor(selectedId,'PROFILE')});if(initialCustomerId){var initialOpenTimer=setInterval(function(){if(!allRows.length)return;clearInterval(initialOpenTimer);var id=initialCustomerId;initialCustomerId='';openCustomer(id,true)},50);setTimeout(function(){clearInterval(initialOpenTimer)},5000)}
function householdContactCardHtml(contact){var phone=contact.phone?'<a href="tel:'+esc(String(contact.phone).replace(/\\D/g,''))+'">☎ '+esc(contact.phone)+'</a>':'<span></span>',email=contact.email?'<a href="mailto:'+esc(contact.email)+'">✉ '+esc(contact.email)+'</a>':'<span></span>';return '<div class="household-contact-card"><div class="household-contact-name">'+esc(contact.displayName||'Unnamed contact')+'</div>'+phone+email+'</div>'}
function renderGoogleContactPanel(profile){var panel=document.createElement('div'),grid=el('content').querySelector('.contact-grid');panel.id='googleContactPanel';panel.className='contact-sync';panel.innerHTML='<div class="section-head"><h3>Household contacts</h3></div><div id="googleContactStatus" class="contact-sync-status">Checking linked Google Contacts…</div><div id="googleContactList" class="household-contact-list"></div><button id="googleContactToggleLabel" class="manage-contacts" type="button" onclick="toggleGoogleContactPanel()">Manage Contacts</button><div id="googleContactBody" class="contact-manage-body" style="display:none"></div>';if(grid&&grid.parentNode)grid.parentNode.insertBefore(panel,grid.nextSibling);else el('content').insertBefore(panel,el('editorNote'));google.script.run.withSuccessHandler(renderGoogleContactState).withFailureHandler(showGoogleContactError).getPmosGoogleContactState(profile.customerId)}
function toggleGoogleContactPanel(){var body=el('googleContactBody'),button=el('googleContactToggleLabel');if(!body)return;var opening=body.style.display==='none';body.style.display=opening?'block':'none';if(button)button.textContent=opening?'Close Contact Manager':'Manage Contacts'}
function renderGoogleContactState(state){state=state||{};var status=el('googleContactStatus'),list=el('googleContactList'),body=el('googleContactBody');if(!status||!list||!body)return;setGoogleContactBusy(false);list.innerHTML='';if(state.status==='LINKED'){var contacts=state.contacts&&state.contacts.length?state.contacts:[state.contact||{}],additional=contacts.slice(1);status.textContent=additional.length?additional.length+' additional household contact'+(additional.length===1?'':'s'):'No additional household contacts';list.innerHTML=additional.map(householdContactCardHtml).join('');body.innerHTML='<div>'+contacts.map(householdContactHtml).join('')+'</div><div class="contact-sync-actions">'+contactSyncButton('Pull from Google','pullGoogleContact()',false)+contactSyncButton('Push to Google','pushGoogleContact()',true)+contactSyncButton('Unlink all','unlinkGoogleContact()',false)+'</div>';return}if(state.status==='CANDIDATES'){status.textContent='No linked household contacts';body.innerHTML=(state.candidates||[]).map(function(candidate){return '<div class="contact-candidate"><div class="contact-candidate-name">'+esc(candidate.displayName)+'</div><div class="contact-candidate-meta">'+esc([candidate.matchReason,candidate.phone,candidate.email,candidate.address].filter(Boolean).join(' · '))+'</div><div class="contact-sync-actions"><button type="button" class="primary" data-resource="'+esc(candidate.resourceName)+'" onclick="linkGoogleContact(this.dataset.resource)">Link this person</button></div></div>'}).join('');return}if(state.status==='BROKEN_LINK'){status.textContent='Linked contact needs attention';body.innerHTML='<div class="contact-sync-actions">'+contactSyncButton('Remove broken links','unlinkGoogleContact()',false)+'</div>';return}status.textContent='No linked household contacts';body.innerHTML='<div class="contact-sync-actions">'+contactSyncButton('Create Google Contact','createGoogleContact()',true)+'</div>'}
</script></body></html>`}

/* PMOS_CONSOLIDATED_ACCOUNT_MODULES */

/* Consolidated from 24-I_Customer_Account_Service_Locations.gs. */
/**
 * Customer Account / Service Location compatibility layer.
 *
 * Each independently serviced property keeps its own Customer ID, so PMOS's
 * existing route, Calendar, status, equipment, and sync identities remain
 * unchanged. Account ID groups those Customer IDs into one customer account.
 */
function ensurePmosCustomerAccountIds_() {
  const sheet = findFirstSheetByName_(SpreadsheetApp.getActive(), [
    PMOS.CUSTOMERS_SHEET, 'Customers', 'Customer Database', 'Customer List'
  ]);
  if (!sheet) throw new Error('Customers sheet was not found.');

  let table = readPmosHeaderTable_(sheet);
  ensureMaintenanceClientHeaders_(sheet, table, [
    'Account ID', 'Service Location Name', 'Primary Service Location'
  ]);
  table = readPmosHeaderTable_(sheet);

  const customerIdIndex = findHeaderIndex_(table.headers, ['Customer ID']);
  const accountIdIndex = findHeaderIndex_(table.headers, ['Account ID']);
  const locationNameIndex = findHeaderIndex_(table.headers, ['Service Location Name']);
  const primaryIndex = findHeaderIndex_(table.headers, ['Primary Service Location']);
  const calendarTitleIndex = findHeaderIndex_(table.headers, ['Calendar Title']);
  const lastNameIndex = findHeaderIndex_(table.headers, ['Last Name', 'Customer Name', 'Name', 'Customer']);
  const fullNameIndex = findHeaderIndex_(table.headers, ['Full Name(s)', 'Full Name']);

  if (customerIdIndex < 0 || accountIdIndex < 0) {
    throw new Error('Customers requires Customer ID and Account ID.');
  }

  let changed = false;
  table.rows.forEach(function(row, index) {
    const customerId = String(row[customerIdIndex] || '').trim();
    if (!customerId) return;
    const rowNumber = table.headerRow + index + 1;

    if (!String(row[accountIdIndex] || '').trim()) {
      sheet.getRange(rowNumber, accountIdIndex + 1).setValue(customerId);
      changed = true;
    }

    let primaryValue = primaryIndex >= 0 ? String(row[primaryIndex] || '').trim() : 'Yes';
    if (primaryIndex >= 0 && !primaryValue) {
      primaryValue = 'Yes';
      sheet.getRange(rowNumber, primaryIndex + 1).setValue(primaryValue);
      changed = true;
    }

    if (locationNameIndex >= 0) {
      const currentName = String(row[locationNameIndex] || '').trim();
      const lastName = lastNameIndex >= 0 ? String(row[lastNameIndex] || '').trim() : '';
      const fullName = fullNameIndex >= 0 ? String(row[fullNameIndex] || '').trim() : '';
      const calendarTitle = calendarTitleIndex >= 0 ? String(row[calendarTitleIndex] || '').trim() : '';
      const isPrimary = String(primaryValue || 'Yes').toLowerCase() !== 'no';
      let defaultName = currentName;

      if (!currentName) {
        defaultName = isPrimary && lastName
          ? lastName + ' Residence'
          : calendarTitle || lastName || fullName || 'Service Location';
      } else if (isPrimary && lastName) {
        const normalizedCurrent = normalize_(currentName);
        const legacyNames = [lastName, fullName, 'Primary'].filter(Boolean).map(normalize_);
        if (normalize_(calendarTitle) === normalize_(lastName)) legacyNames.push(normalize_(calendarTitle));
        if (legacyNames.indexOf(normalizedCurrent) >= 0) defaultName = lastName + ' Residence';
      }

      if (defaultName !== currentName) {
        sheet.getRange(rowNumber, locationNameIndex + 1).setValue(defaultName);
        changed = true;
      }
    }
  });

  if (changed) SpreadsheetApp.flush();
  return readPmosHeaderTable_(sheet);
}

function getPmosCustomerAccount_(customerId) {
  const table = ensurePmosCustomerAccountIds_();
  const idIndex = findHeaderIndex_(table.headers, ['Customer ID']);
  const accountIndex = findHeaderIndex_(table.headers, ['Account ID']);
  const locationNameIndex = findHeaderIndex_(table.headers, ['Service Location Name']);
  const primaryIndex = findHeaderIndex_(table.headers, ['Primary Service Location']);
  const addressIndex = findHeaderIndex_(table.headers, ['Full Address', 'Service Address', 'Address']);
  const titleIndex = findHeaderIndex_(table.headers, ['Calendar Title']);
  const statusIndex = findHeaderIndex_(table.headers, ['Status']);
  const frequencyIndex = findHeaderIndex_(table.headers, ['Frequency', 'Service Frequency']);
  const firstNameIndex = findHeaderIndex_(table.headers, ['First Name']);
  const lastNameIndex = findHeaderIndex_(table.headers, ['Last Name', 'Customer Name', 'Name', 'Customer']);
  const phoneIndex = findHeaderIndex_(table.headers, ['Primary Phone', 'Phone Number', 'Phone']);
  const emailIndex = findHeaderIndex_(table.headers, ['Email', 'Email Address']);

  const requestedId = String(customerId || '').trim().toUpperCase();
  let selected = null;
  table.rows.forEach(function(row) {
    if (String(row[idIndex] || '').trim().toUpperCase() === requestedId) selected = row;
  });
  if (!selected) throw new Error('Customer ID ' + customerId + ' was not found.');

  const accountId = String(selected[accountIndex] || selected[idIndex] || '').trim();
  const locations = table.rows.filter(function(row) {
    return String(row[accountIndex] || row[idIndex] || '').trim() === accountId;
  }).map(function(row) {
    return {
      customerId: String(row[idIndex] || '').trim(),
      accountId: accountId,
      locationName: locationNameIndex >= 0 ? String(row[locationNameIndex] || '').trim() : '',
      primary: primaryIndex < 0 || String(row[primaryIndex] || '').trim().toLowerCase() !== 'no',
      calendarTitle: titleIndex >= 0 ? String(row[titleIndex] || '').trim() : '',
      address: addressIndex >= 0 ? String(row[addressIndex] || '').trim() : '',
      status: statusIndex >= 0 ? String(row[statusIndex] || 'Active').trim() || 'Active' : 'Active',
      frequency: frequencyIndex >= 0 ? String(row[frequencyIndex] || '').trim() : ''
    };
  });

  locations.sort(function(a, b) {
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    return String(a.locationName || a.calendarTitle || '').localeCompare(
      String(b.locationName || b.calendarTitle || '')
    );
  });

  const firstName = firstNameIndex >= 0 ? String(selected[firstNameIndex] || '').trim() : '';
  const lastName = lastNameIndex >= 0 ? String(selected[lastNameIndex] || '').trim() : '';
  const accountName = lastName && firstName
    ? lastName + ', ' + firstName
    : lastName || firstName || accountId;
  return {
    accountId: accountId,
    accountName: accountName,
    selectedCustomerId: String(selected[idIndex] || '').trim(),
    firstName: firstName,
    lastName: lastName,
    phone: phoneIndex >= 0 ? String(selected[phoneIndex] || '').trim() : '',
    email: emailIndex >= 0 ? String(selected[emailIndex] || '').trim() : '',
    locations: locations
  };
}

function getPmosCustomerAccount(customerId) {
  return getPmosCustomerAccount_(customerId);
}

function createPmosAdditionalServiceLocation(input) {
  const request = input || {};
  const parentCustomerId = String(request.parentCustomerId || '').trim();
  if (!parentCustomerId) {
    throw new Error('Select the customer account before adding a service location.');
  }

  const account = getPmosCustomerAccount_(parentCustomerId);
  const primary = account.locations.filter(function(location) { return location.primary; })[0] || account.locations[0];
  if (!primary) throw new Error('The customer account has no primary service location.');

  const locationName = String(request.locationName || request.calendarTitle || '').trim();
  if (!locationName) throw new Error('Additional service locations require a location name.');
  if (account.locations.some(function(location) {
    return normalize_(location.locationName || location.calendarTitle) === normalize_(locationName);
  })) {
    throw new Error('This account already has a service location named ' + locationName + '.');
  }

  const address = String(request.address || '').trim();
  if (!address) throw new Error('Enter the service address.');
  if (account.locations.some(function(location) {
    return normalizePmosAddressSearch_(location.address) === normalizePmosAddressSearch_(address);
  })) {
    throw new Error('That service address is already attached to this customer account.');
  }

  const primaryRecord = getPmosCustomerEditorRow_(primary.customerId);
  const firstIndex = findHeaderIndex_(primaryRecord.headers, ['First Name']);
  const lastIndex = findHeaderIndex_(primaryRecord.headers, ['Last Name', 'Customer Name', 'Name']);
  const phoneIndex = findHeaderIndex_(primaryRecord.headers, ['Primary Phone', 'Phone Number', 'Phone']);
  const emailIndex = findHeaderIndex_(primaryRecord.headers, ['Email', 'Email Address']);

  const payload = Object.assign({}, request, {
    firstName: String(request.firstName || (firstIndex >= 0 ? primaryRecord.values[firstIndex] : '') || '').trim(),
    lastName: String(request.lastName || (lastIndex >= 0 ? primaryRecord.values[lastIndex] : '') || '').trim(),
    phone: String(request.phone || (phoneIndex >= 0 ? primaryRecord.values[phoneIndex] : '') || '').trim(),
    email: String(request.email || (emailIndex >= 0 ? primaryRecord.values[emailIndex] : '') || '').trim(),
    address: address,
    calendarTitle: locationName,
    serviceLocationName: locationName,
    accountId: account.accountId,
    primaryServiceLocation: false
  });

  if ((!Array.isArray(payload.recommendedPlacements) || !payload.recommendedPlacements.length) && request.manualRoute) {
    payload.recommendedPlacements = buildPmosCustomerEditorManualPlacements_(
      payload.frequency || 'Weekly',
      request.manualRoute
    );
    payload.day = request.manualRoute.day;
    payload.secondDay = request.manualRoute.secondDay || '';
    payload.week = request.manualRoute.week || 1;
    payload.stop = request.manualRoute.stop || 1;
  }

  const result = createMaintenanceCustomerAndAutoSync(payload);
  result.account = getPmosCustomerAccount_(result.customerId);
  return result;
}

function applyPmosAccountIdentityToCustomerRow_(customerId, accountId, locationName, primary) {
  const record = getPmosCustomerEditorRow_(customerId);
  const accountIndex = findHeaderIndex_(record.headers, ['Account ID']);
  const nameIndex = findHeaderIndex_(record.headers, ['Service Location Name']);
  const primaryIndex = findHeaderIndex_(record.headers, ['Primary Service Location']);
  const values = record.values.slice();
  if (accountIndex >= 0) values[accountIndex] = String(accountId || customerId).trim();
  if (nameIndex >= 0) values[nameIndex] = String(locationName || '').trim();
  if (primaryIndex >= 0) values[primaryIndex] = primary === false ? 'No' : 'Yes';
  record.sheet.getRange(record.rowNumber, 1, 1, values.length).setValues([values]);
  SpreadsheetApp.flush();
}


/* Consolidated from 24-K_Customer_Account_Service_Locations_UI.gs. */
/** Customer Account / Service Location UI. */
function listPmosCustomerAccountsForServiceLocations(query) {
  const table = ensurePmosCustomerAccountIds_();
  const value = function(row, aliases) {
    const index = findHeaderIndex_(table.headers, aliases);
    return index >= 0 ? row[index] : '';
  };
  const cleanQuery = normalizePmosCustomerSearch_(query);
  const accounts = {};
  table.rows.forEach(function(row) {
    const customerId = String(value(row, ['Customer ID']) || '').trim();
    if (!customerId) return;
    const accountId = String(value(row, ['Account ID']) || customerId).trim();
    const primary = String(value(row, ['Primary Service Location']) || 'Yes').trim().toLowerCase() !== 'no';
    const firstName = String(value(row, ['First Name']) || '').trim();
    const lastName = String(value(row, ['Last Name', 'Customer Name', 'Name', 'Customer']) || '').trim();
    const fullName = String(value(row, ['Full Name(s)', 'Full Name']) || '').trim();
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || fullName || customerId;
    const listName = lastName && firstName ? lastName + ', ' + firstName : lastName || firstName || fullName || customerId;
    const address = String(value(row, ['Full Address', 'Service Address', 'Address']) || '').trim();
    const phone = String(value(row, ['Primary Phone', 'Phone Number', 'Phone']) || '').trim();
    if (!accounts[accountId] || primary) {
      accounts[accountId] = {
        accountId: accountId,
        customerId: customerId,
        displayName: displayName,
        listName: listName,
        address: address,
        phone: phone,
        serviceLocationCount: accounts[accountId] ? accounts[accountId].serviceLocationCount : 0
      };
    }
    accounts[accountId].serviceLocationCount = Number(accounts[accountId].serviceLocationCount || 0) + 1;
  });
  return Object.keys(accounts).map(function(key) { return accounts[key]; }).filter(function(account) {
    if (!cleanQuery) return true;
    return normalizePmosCustomerSearch_([
      account.listName, account.displayName, account.address, account.phone, account.accountId
    ].join(' ')).indexOf(cleanQuery) >= 0;
  }).sort(function(left, right) {
    return left.listName.localeCompare(right.listName) || left.accountId.localeCompare(right.accountId);
  });
}

function showPmosServiceLocationSearch() {
  const html = HtmlService.createHtmlOutput(`<!doctype html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{margin:0;padding:18px;background:#edf1f3;color:#293944;font-family:Arial,sans-serif}h2{margin:0 0 4px}.muted{color:#6d7c84;font-size:12px}.search{width:100%;margin-top:15px;padding:11px 12px;border:1px solid #b8c6cc;border-radius:8px;background:#fff;font:inherit;outline:none}.search:focus{border-color:#1a6b8e;box-shadow:0 0 0 3px rgba(26,107,142,.12)}.list{margin-top:10px;max-height:475px;overflow:auto;border:1px solid #d1dade;border-radius:9px;background:#fff}.row{display:block;width:100%;padding:11px 12px;border:0;border-bottom:1px solid #e2e8ea;background:#fff;color:#293944;text-align:left;cursor:pointer}.row:last-child{border-bottom:0}.row:hover{background:#eaf4f8}.name{font-weight:700}.meta{margin-top:3px;color:#6d7c84;font-size:11px}.count{float:right;color:#1a6b8e;font-size:10px;font-weight:700}
</style></head><body><h2>Service Locations</h2><div class="muted">Choose the customer account whose properties you want to manage.</div><input id="q" class="search" autocomplete="off" placeholder="Search by customer name"><div id="list" class="list"></div><script>
var rows=[];function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}function render(){var q=document.getElementById('q').value;google.script.run.withSuccessHandler(function(items){rows=items||[];var box=document.getElementById('list');box.innerHTML=rows.map(function(r){return '<button type="button" class="row" data-id="'+esc(r.customerId)+'"><span class="count">'+r.serviceLocationCount+' location'+(r.serviceLocationCount===1?'':'s')+'</span><div class="name">'+esc(r.listName||r.displayName)+'</div><div class="meta">'+esc([r.address,r.phone].filter(Boolean).join(' · '))+'</div></button>'}).join('')||'<div class="muted" style="padding:14px">No customer accounts found.</div>';Array.prototype.forEach.call(box.querySelectorAll('.row'),function(button){button.onclick=function(){google.script.run.showPmosServiceLocationManager(this.dataset.id);setTimeout(function(){google.script.host.close()},250)}})}).listPmosCustomerAccountsForServiceLocations(q)}var timer;document.getElementById('q').oninput=function(){clearTimeout(timer);timer=setTimeout(render,120)};render();document.getElementById('q').focus();
</script></body></html>`).setWidth(570).setHeight(640);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Service Locations');
}

function showPmosServiceLocationManager(customerId) {
  const id = String(customerId || '').trim();
  if (!id) throw new Error('Select a customer account first.');
  const html = HtmlService.createHtmlOutput(buildPmosServiceLocationManagerHtml_(id))
    .setWidth(980).setHeight(820);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Service Locations');
}

function buildPmosServiceLocationManagerHtml_(customerId) {
  const idJson = JSON.stringify(customerId);
  const today = Utilities.formatDate(new Date(), PMOS.TIMEZONE, 'yyyy-MM-dd');
  return `<!doctype html><html><head><base target="_top"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;700;900&display=swap" rel="stylesheet"><style>
*{box-sizing:border-box}body{margin:0;background:#e7ecef;color:#293944;font-family:Mulish,Arial,sans-serif}.top{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;background:#5e717c;color:#fff}.title{font-size:20px;font-weight:900}.sub{margin-top:3px;color:#dae3e7;font-size:11px}.layout{height:704px;display:grid;grid-template-columns:300px 1fr}.side{overflow:auto;padding:14px;background:#eef2f4;border-right:1px solid #cbd6db}.side-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.side-head b{font-size:13px}.add{padding:7px 9px;border:1px solid #155b79;border-radius:7px;background:#155b79;color:#fff;font-weight:900;cursor:pointer}.loc{display:block;width:100%;margin-bottom:8px;padding:11px;border:1px solid #d2dade;border-radius:9px;background:#fff;color:#293944;text-align:left;cursor:pointer}.loc:hover,.loc.selected{border-color:#2a7b9e;background:#eaf5f9}.loc-name{font-size:12px;font-weight:900}.loc-meta{margin-top:4px;color:#6d7c84;font-size:10px;line-height:1.45}.main{overflow:auto;padding:16px 19px 100px}.section{margin-bottom:13px;border:1px solid #d0dade;border-radius:10px;background:#fafbfc}.section-head{padding:11px 14px;border-bottom:1px solid #e2e8ea}.section-head h3{margin:0;font-size:13px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;padding:14px}.wide{grid-column:1/-1}.field label{display:block;margin-bottom:5px;color:#6d7c84;font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.field input,.field select,.field textarea{width:100%;padding:9px 10px;border:1px solid #becbd1;border-radius:7px;background:#fff;color:#293944;font:inherit}.field textarea{min-height:76px;resize:vertical}.address-wrap{position:relative}.address-list{display:none;position:absolute;z-index:40;left:0;right:0;top:100%;max-height:220px;overflow:auto;border:1px solid #9db0b9;border-radius:0 0 8px 8px;background:#fff;box-shadow:0 9px 20px rgba(30,45,55,.16)}.address-option{display:block;width:100%;padding:9px;border:0;border-bottom:1px solid #e2e8ea;background:#fff;text-align:left;cursor:pointer}.address-option:hover{background:#e7f3f8}.confirmed{display:none;margin-top:7px;padding:7px 9px;border:1px solid #9ad6af;border-radius:7px;background:#eef9f2;color:#2e6845;font-size:11px}.route-status{padding:10px 14px;color:#60717a;font-size:11px}.recommendations{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:0 14px 14px}.rec{padding:10px;border:2px solid #d5e5ec;border-radius:9px;background:#fff;color:#293944;text-align:left;cursor:pointer}.rec.selected{border-color:#19749b;background:#eaf5f9}.rec-title{display:flex;justify-content:space-between;gap:6px;font-size:11px;font-weight:900}.rec-meta{margin-top:5px;color:#60717a;font-size:10px;line-height:1.45}.link{padding:0;border:0;background:transparent;color:#176b90;font-weight:900;cursor:pointer}.manual{display:none;margin:0 14px 14px;padding:11px;border:1px solid #cfdae0;border-radius:8px;background:#fff}.manual-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.actions{position:fixed;left:300px;right:0;bottom:0;display:flex;align-items:center;gap:9px;padding:13px 19px;border-top:1px solid #cbd6db;background:rgba(248,250,251,.98)}.button{padding:9px 13px;border:1px solid #155b79;border-radius:7px;background:#fff;color:#155b79;font-weight:900;cursor:pointer}.primary{background:#155b79;color:#fff}.primary.working{background:#a9d0e0;border-color:#a9d0e0;color:#315668}.primary.complete{background:#d3eadb;border-color:#d3eadb;color:#355f46}.status{margin-left:auto;color:#687880;font-size:11px}.error{color:#9b3030}.empty{padding:45px 20px;text-align:center;color:#6d7c84}.summary-card{padding:13px 14px}.summary-name{font-size:15px;font-weight:900}.summary-address{margin-top:5px;color:#60717a;font-size:11px}.edit-location{margin-top:10px}@media(max-width:760px){.layout{grid-template-columns:1fr}.side{max-height:210px}.actions{left:0}.grid,.recommendations,.manual-grid{grid-template-columns:1fr}}
</style></head><body><div class="top"><div><div class="title">Service Locations</div><div id="heading" class="sub">Loading account…</div></div><img src="https://www.finnpools.ca/images/logo_only.png" alt="Finn Pools" style="width:39px;height:39px;object-fit:contain"></div><div class="layout"><aside class="side"><div class="side-head"><b>Properties</b><button id="addLocation" class="add" type="button">+ Add Service Location</button></div><div id="locations"></div></aside><main class="main"><div id="empty" class="empty">Select a property, or add another service location to this customer account.</div><div id="summary" style="display:none"><div class="section"><div class="section-head"><h3>Service location</h3></div><div id="summaryCard" class="summary-card"></div></div></div><div id="form" style="display:none"><div class="section"><div class="section-head"><h3>Add service location</h3></div><div class="grid"><div class="field"><label>Location name</label><input id="locationName" placeholder="e.g. Cottage, Rental, Parents' House"></div><div class="field"><label>Frequency</label><select id="frequency"><option>Weekly</option><option>Biweekly</option><option>Monthly</option><option>Twice Weekly</option></select></div><div class="field wide"><label>Service address</label><div class="address-wrap"><input id="address" autocomplete="off" placeholder="Begin typing address"><div id="addressList" class="address-list"></div></div><div id="confirmed" class="confirmed"></div></div><div class="field"><label>Effective date</label><input id="effectiveDate" type="date" value="${today}"></div><div class="field"><label>Service season</label><select id="yearRound"><option value="No">Seasonal</option><option value="Yes">Year Round</option></select></div></div></div><div class="section"><div class="section-head"><h3>Route placement</h3></div><div id="routeStatus" class="route-status">Select and confirm the complete service address to calculate route placement.</div><div id="recommendations" class="recommendations"></div><div style="padding:0 14px 13px"><button id="manualToggle" class="link" type="button">Select route placement manually</button></div><div id="manual" class="manual"><div class="manual-grid"><div class="field"><label>Primary day</label><select id="manualDay"><option value="">Select</option><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option></select></div><div id="secondDayField" class="field" style="display:none"><label>Second day</label><select id="manualSecondDay"><option value="">Select</option><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option></select></div><div id="weekField" class="field"><label>Rotation week</label><select id="manualWeek"><option value="1">Week 1</option><option value="2">Week 2</option><option value="3">Week 3</option><option value="4">Week 4</option></select></div><div class="field"><label>Stop position</label><input id="manualStop" type="number" min="1" value="1"></div></div></div></div><div class="section"><div class="section-head"><h3>Property information</h3></div><div class="grid"><div class="field"><label>Entry information</label><textarea id="entryInformation"></textarea></div><div class="field"><label>Customer / service notes</label><textarea id="notes"></textarea></div></div></div><div style="padding:0 2px 15px;color:#6d7c84;font-size:11px">After this location is created, PMOS will open it in Edit Customer Information so its bodies of water and equipment can be completed independently.</div></div></main></div><div class="actions"><button id="create" class="button primary" type="button" style="display:none">Create Service Location</button><button id="close" class="button" type="button">Close</button><span id="status" class="status"></span></div><script>
var parentCustomerId=${idJson},account=null,selectedAddress=null,addressTimer=null,addressRequest=0,routeRequest=0,selectedPlacements=[],selectedRoute=null,manualRoute=null;function el(id){return document.getElementById(id)}function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}function setStatus(t,error){el('status').textContent=t||'';el('status').className='status'+(error?' error':'')}
function displayFrequency(v){return String(v||'').replace(/^Biweekly$/i,'Bi-Weekly')}function renderLocations(){var box=el('locations');box.innerHTML=(account.locations||[]).map(function(loc){return '<button type="button" class="loc" data-id="'+esc(loc.customerId)+'"><div class="loc-name">'+esc((loc.primary?'Primary · ':'')+(loc.locationName||loc.calendarTitle||'Service Location'))+'</div><div class="loc-meta">'+esc(loc.address||'')+'</div><div class="loc-meta">'+esc([displayFrequency(loc.frequency),loc.status].filter(Boolean).join(' · '))+'</div></button>'}).join('');Array.prototype.forEach.call(box.querySelectorAll('.loc'),function(button){button.onclick=function(){showLocation((account.locations||[]).find(function(loc){return loc.customerId===button.dataset.id}))}})}function showLocation(loc){el('empty').style.display='none';el('form').style.display='none';el('summary').style.display='block';el('create').style.display='none';el('summaryCard').innerHTML='<div class="summary-name">'+esc((loc.primary?'Primary · ':'')+(loc.locationName||loc.calendarTitle||'Service Location'))+'</div><div class="summary-address">'+esc(loc.address||'')+'</div><div class="summary-address">'+esc([displayFrequency(loc.frequency),loc.status].filter(Boolean).join(' · '))+'</div><button id="editSelected" class="button edit-location" type="button">Edit This Location</button>';el('editSelected').onclick=function(){google.script.run.showPmosCustomerEditor(loc.customerId,'PROFILE')}}function showAdd(){el('empty').style.display='none';el('summary').style.display='none';el('form').style.display='block';el('create').style.display='inline-block';selectedAddress=null;selectedPlacements=[];selectedRoute=null;manualRoute=null;el('locationName').value='';el('address').value='';el('frequency').value='Weekly';el('effectiveDate').value='${today}';el('yearRound').value='No';el('entryInformation').value='';el('notes').value='';el('confirmed').style.display='none';el('recommendations').innerHTML='';el('routeStatus').textContent='Select and confirm the complete service address to calculate route placement.';configureManual();setTimeout(function(){el('locationName').focus()},0)}
function hideAddresses(){el('addressList').style.display='none';el('addressList').innerHTML=''}function queueAddress(){clearTimeout(addressTimer);var q=el('address').value.trim(),token=++addressRequest;selectedAddress=null;selectedPlacements=[];selectedRoute=null;manualRoute=null;el('confirmed').style.display='none';el('recommendations').innerHTML='';if(q.length<3){hideAddresses();return}addressTimer=setTimeout(function(){google.script.run.withSuccessHandler(function(items){if(token!==addressRequest)return;var box=el('addressList');box.innerHTML='';(items||[]).forEach(function(item){var b=document.createElement('button');b.type='button';b.className='address-option';b.textContent=item.address;b.onmousedown=function(event){event.preventDefault();confirmAddress(item)};box.appendChild(b)});box.style.display=items&&items.length?'block':'none'}).withFailureHandler(function(e){setStatus(e&&e.message?e.message:String(e),true)}).suggestPmosAddresses(q,6)},160)}function confirmAddress(item){hideAddresses();el('routeStatus').textContent='Confirming address…';google.script.run.withSuccessHandler(function(result){selectedAddress=result;el('address').value=result.address;el('confirmed').textContent='Confirmed: '+result.address;el('confirmed').style.display='block';loadRoutes()}).withFailureHandler(function(e){setStatus(e&&e.message?e.message:String(e),true)}).confirmPmosSelectedAddress(item)}
function routeShards(frequency){var f=String(frequency||'').toLowerCase();if(f.indexOf('monthly')>=0)return[{start:0,count:5},{start:5,count:5},{start:10,count:5},{start:15,count:5}];if(f.indexOf('bi')>=0)return[{start:0,count:5},{start:5,count:5}];if(f.indexOf('twice')>=0)return[{start:0,count:2},{start:2,count:2},{start:4,count:2},{start:6,count:2},{start:8,count:2}];return[{start:0,count:1},{start:1,count:1},{start:2,count:1},{start:3,count:1},{start:4,count:1}]}function compareRoutes(a,b){if(!!a.roadDataComplete!==!!b.roadDataComplete)return a.roadDataComplete?-1:1;var ad=a.addedDurationMinutes==null?1e9:Number(a.addedDurationMinutes),bd=b.addedDurationMinutes==null?1e9:Number(b.addedDurationMinutes);return ad-bd||Number(a.addedDistanceKm||0)-Number(b.addedDistanceKm||0)||Number(b.score||0)-Number(a.score||0)}function loadRoutes(){if(!selectedAddress)return;var token=++routeRequest,shards=routeShards(el('frequency').value),finished=0,errors=0,results=[];selectedPlacements=[];selectedRoute=null;manualRoute=null;el('recommendations').innerHTML='';el('routeStatus').textContent='Comparing 0 of '+shards.length+' route groups…';function finish(){if(token!==routeRequest)return;finished++;el('routeStatus').textContent='Comparing '+finished+' of '+shards.length+' route groups…';if(finished<shards.length)return;results.sort(compareRoutes);renderRoutes(results.slice(0,3),errors)}shards.forEach(function(shard){google.script.run.withSuccessHandler(function(result){if(token!==routeRequest)return;results=results.concat((result&&result.recommendations)||[]);finish()}).withFailureHandler(function(){if(token!==routeRequest)return;errors++;finish()}).recommendMaintenanceClientRotations({address:el('address').value,addressVerified:true,addressDetails:selectedAddress,frequency:el('frequency').value,candidateStart:shard.start,candidateCount:shard.count})})}function renderRoutes(rows,errors){el('recommendations').innerHTML='';el('routeStatus').textContent=rows.length?(errors?'Best available placements calculated; '+errors+' group(s) could not be completed.':'Best route placements calculated.'):'No automatic placement was available. Select route placement manually.';(rows||[]).forEach(function(r,i){var b=document.createElement('button');b.type='button';b.className='rec';b.innerHTML='<div class="rec-title"><span>'+(i+1)+'. '+esc(r.label)+'</span><span>'+esc(r.rating)+'</span></div><div class="rec-meta">'+esc(r.rotationLabel||'')+' · '+((r.placements||[]).length)+' route layer(s)'+(r.roadDataComplete?'<br>Added: +'+Number(r.addedDurationMinutes||0).toFixed(0)+' min · +'+Number(r.addedDistanceKm||0).toFixed(1)+' km':'')+'</div>';b.onclick=function(){Array.prototype.forEach.call(el('recommendations').querySelectorAll('.rec'),function(x){x.classList.remove('selected')});b.classList.add('selected');selectedRoute=r;selectedPlacements=(r.placements||[]).map(function(p){return{week:p.week,day:p.day,layer:p.layer,position:p.position}});manualRoute=null;el('routeStatus').textContent='Route recommendation selected.'};el('recommendations').appendChild(b)})}
function configureManual(){var f=el('frequency').value;el('secondDayField').style.display=f==='Twice Weekly'?'block':'none';el('weekField').style.display=(f==='Weekly'||f==='Twice Weekly')?'none':'block';if(f==='Biweekly')el('manualWeek').innerHTML='<option value="1">Weeks 1 &amp; 3</option><option value="2">Weeks 2 &amp; 4</option>';else el('manualWeek').innerHTML='<option value="1">Week 1</option><option value="2">Week 2</option><option value="3">Week 3</option><option value="4">Week 4</option>'}function collect(){var result={parentCustomerId:parentCustomerId,locationName:el('locationName').value.trim(),address:el('address').value.trim(),addressVerified:!!selectedAddress,addressDetails:selectedAddress,frequency:el('frequency').value,effectiveDate:el('effectiveDate').value,yearRound:el('yearRound').value,entryInformation:el('entryInformation').value.trim(),notes:el('notes').value.trim(),recommendedPlacements:selectedPlacements};if(selectedRoute){result.day=selectedRoute.day||'';result.secondDay=selectedRoute.secondDay||'';result.week=selectedRoute.week||1;result.stop=(selectedRoute.placements&&selectedRoute.placements[0]&&selectedRoute.placements[0].position)||selectedRoute.position||1}if(manualRoute)result.manualRoute=manualRoute;return result}function createLocation(){var data=collect();if(!data.locationName){setStatus('Enter a location name.',true);return}if(!data.addressVerified){setStatus('Choose and confirm the complete service address.',true);return}if(!data.recommendedPlacements.length&&!data.manualRoute){setStatus('Choose a route recommendation or manual route placement.',true);return}var button=el('create');button.disabled=true;button.textContent='Creating…';button.classList.add('working');setStatus('Creating the service location and scheduling Calendar synchronization…');google.script.run.withSuccessHandler(function(result){button.classList.remove('working');button.classList.add('complete');button.textContent='Complete';setStatus('Service location created. Opening its Customer Editor…');setTimeout(function(){google.script.run.showPmosCustomerEditor(result.customerId,'PROFILE');google.script.host.close()},750)}).withFailureHandler(function(e){button.disabled=false;button.classList.remove('working');button.textContent='Create Service Location';setStatus(e&&e.message?e.message:String(e),true)}).createPmosAdditionalServiceLocation(data)}
function loadAccount(data){account=data;el('heading').textContent=[data.firstName,data.lastName].filter(Boolean).join(' ')+' · '+data.locations.length+' service location'+(data.locations.length===1?'':'s');renderLocations();if(data.locations.length)showLocation(data.locations[0])}el('addLocation').onclick=showAdd;el('address').addEventListener('input',queueAddress);el('address').addEventListener('paste',function(){setTimeout(queueAddress,0)});el('address').addEventListener('blur',function(){setTimeout(hideAddresses,180)});el('frequency').onchange=function(){selectedPlacements=[];selectedRoute=null;manualRoute=null;configureManual();if(selectedAddress)loadRoutes()};el('manualToggle').onclick=function(){var show=el('manual').style.display!=='block';el('manual').style.display=show?'block':'none';this.textContent=show?'Hide manual route placement':'Select route placement manually';configureManual()};['manualDay','manualSecondDay','manualWeek','manualStop'].forEach(function(id){el(id).onchange=function(){var day=el('manualDay').value,second=el('manualSecondDay').value;if(!day)return;manualRoute={day:day,secondDay:second,week:Number(el('manualWeek').value||1),stop:Math.max(1,Number(el('manualStop').value||1))};selectedPlacements=[];selectedRoute=null;Array.prototype.forEach.call(el('recommendations').querySelectorAll('.rec'),function(x){x.classList.remove('selected')});el('routeStatus').textContent='Manual route placement selected.'}});el('create').onclick=createLocation;el('close').onclick=function(){google.script.host.close()};google.script.run.preparePmosAddressSuggestions();google.script.run.withSuccessHandler(loadAccount).withFailureHandler(function(e){setStatus(e&&e.message?e.message:String(e),true)}).getPmosCustomerAccount(parentCustomerId);
</script></body></html>`;
}


/* Consolidated from 24-L_Customer_Profile_Account_Integration.gs. */
/**
 * Integrates Customer Accounts / Service Locations into the normal Customer Lookup flow.
 * Customer Lookup is the single customer entry point; editing and adding service locations
 * are launched from the selected account/profile rather than separate menu searches.
 */
(function () {
  if (typeof showEditCustomerInformationSearch === 'function') {
    showEditCustomerInformationSearch = function() {
      showCustomerLookup();
    };
  }

  if (typeof searchPmosCustomerProfiles === 'function') {
    const baseSearchPmosCustomerProfiles = searchPmosCustomerProfiles;
    searchPmosCustomerProfiles = function(query) {
      const baseRows = baseSearchPmosCustomerProfiles('');
      const byCustomerId = {};
      baseRows.forEach(function(row) {
        byCustomerId[String(row.customerId || '').trim()] = row;
      });

      const accountTable = ensurePmosCustomerAccountIds_();
      const accountIdIndex = findHeaderIndex_(accountTable.headers, ['Account ID']);
      const customerIdIndex = findHeaderIndex_(accountTable.headers, ['Customer ID']);
      const locationNameIndex = findHeaderIndex_(accountTable.headers, ['Service Location Name']);
      const titleIndex = findHeaderIndex_(accountTable.headers, ['Calendar Title']);
      const addressIndex = findHeaderIndex_(accountTable.headers, ['Full Address', 'Service Address', 'Address']);
      const accountTerms = {};
      accountTable.rows.forEach(function(row) {
        const customerId = customerIdIndex >= 0 ? String(row[customerIdIndex] || '').trim() : '';
        if (!customerId) return;
        const accountId = accountIdIndex >= 0 ? String(row[accountIdIndex] || customerId).trim() : customerId;
        if (!accountTerms[accountId]) accountTerms[accountId] = [];
        [locationNameIndex, titleIndex, addressIndex].forEach(function(index) {
          if (index >= 0 && String(row[index] || '').trim()) accountTerms[accountId].push(String(row[index]).trim());
        });
      });

      const cleanQuery = normalizePmosCustomerSearch_(query);
      return listPmosCustomerAccountsForServiceLocations('').map(function(account) {
        const primary = byCustomerId[account.customerId] || {};
        const locationCount = Number(account.serviceLocationCount || 1);
        return {
          customerId: account.customerId,
          displayName: primary.displayName || account.displayName,
          listName: account.listName || primary.listName,
          calendarTitle: primary.calendarTitle || '',
          address: primary.address || account.address,
          phone: primary.phone || account.phone,
          email: primary.email || '',
          status: primary.status || 'Active',
          serviceLocationCount: locationCount,
          sidebarMeta: locationCount > 1 ? locationCount + ' service locations' : '',
          accountSearchText: normalizePmosCustomerSearch_([
            primary.displayName, account.listName, primary.phone, primary.email,
            account.address, account.phone, (accountTerms[account.accountId] || []).join(' ')
          ].join(' '))
        };
      }).filter(function(row) {
        return !cleanQuery || row.accountSearchText.indexOf(cleanQuery) >= 0;
      }).sort(function(left, right) {
        return String(left.listName || left.displayName || '').localeCompare(
          String(right.listName || right.displayName || '')
        ) || String(left.customerId).localeCompare(String(right.customerId));
      });
    };
  }

  if (typeof getPmosCustomerProfile === 'function') {
    const baseGetPmosCustomerProfile = getPmosCustomerProfile;
    getPmosCustomerProfile = function(customerId) {
      const profile = baseGetPmosCustomerProfile(customerId);
      const account = getPmosCustomerAccount_(customerId);
      const primary = account.locations.filter(function(location) { return location.primary; })[0] || account.locations[0] || null;
      const selected = account.locations.filter(function(location) {
        return String(location.customerId) === String(profile.customerId);
      })[0] || null;
      profile.accountId = account.accountId;
      profile.accountName = account.accountName;
      profile.accountPrimaryCustomerId = primary ? primary.customerId : profile.customerId;
      profile.serviceLocations = account.locations;
      profile.selectedServiceLocation = selected;
      profile.locationName = selected ? (selected.locationName || selected.calendarTitle || '') : '';
      profile.isPrimaryServiceLocation = selected ? selected.primary : true;
      return profile;
    };
  }

  if (typeof buildPmosCustomerLookupHtml_ === 'function') {
    const baseBuildPmosCustomerLookupHtml = buildPmosCustomerLookupHtml_;
    buildPmosCustomerLookupHtml_ = function(mode, initialCustomerId) {
      let html = baseBuildPmosCustomerLookupHtml('LOOKUP', initialCustomerId);
      html = html.replace(
        '<button id="edit" class="edit">Edit Customer</button>',
        '<div class="profile-actions"><button id="addServiceLocation" class="profile-secondary" type="button">+ Add Service Location</button><button id="edit" class="edit" type="button">Edit Location</button></div>'
      );
      html = html.replace(
        '</style>',
        '.profile-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}.profile-secondary{padding:10px 14px;border:1px solid #0f5470;border-radius:7px;background:#fff;color:#0f5470;font:inherit;font-weight:900;cursor:pointer}.profile-secondary:hover{background:#eaf5f9}.service-location-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 2px 9px}.service-location-head h3{margin:0;font-size:19px;font-weight:900}.service-location-hint{color:#758289;font-size:10px}.service-location-grid{display:grid;gap:8px}.service-location-card{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(100px,.55fr) minmax(86px,.45fr);align-items:center;gap:12px;width:100%;padding:12px 14px;border:1px solid #d2dade;border-left:4px solid #9cb0b9;border-radius:9px;background:#f9fafb;color:#293944;text-align:left;cursor:pointer}.service-location-card:hover{background:#edf5f8;border-left-color:#4e8aa3}.service-location-card.selected{border-color:#8fc4da;border-left-color:#017db1;background:#eaf6fb}.service-location-name{font-size:12px;font-weight:900}.service-location-address{margin-top:3px;color:#68747a;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.service-location-meta{font-size:10px;color:#68747a}.service-location-meta b{display:block;margin-top:2px;color:#293944;font-size:11px}.primary-location-badge{display:inline-block;margin-left:6px;padding:2px 6px;border-radius:999px;background:#dcefdc;color:#356443;font-size:8px;font-weight:900;text-transform:uppercase}@media(max-width:820px){.profile-actions{justify-content:flex-start}.service-location-card{grid-template-columns:1fr}}\n</style>'
      );
      html = html.replace(
        '</script></body></html>',
        `
var baseAccountResolveSearchMatch=resolveSearchMatch;
resolveSearchMatch=function(query){var clean=normalizeSearch(query);if(clean){var accountMatch=allRows.find(function(row){return String(row.accountSearchText||'').indexOf(clean)>=0});if(accountMatch)return accountMatch}return baseAccountResolveSearchMatch(query)};
var baseAccountRenderResults=renderResults;
renderResults=function(rows){baseAccountRenderResults(rows);(rows||[]).forEach(function(row){if(!row.sidebarMeta)return;var button=customerButton(row.customerId),meta=button&&button.querySelector('.result-meta');if(meta)meta.textContent=[meta.textContent,row.sidebarMeta].filter(Boolean).join(' · ')})};
var baseAccountRenderProfile=renderProfile;
renderProfile=function(profile){
  baseAccountRenderProfile(profile);
  var locations=profile.serviceLocations||[],selected=profile.selectedServiceLocation||{},block='';
  el('profileName').textContent=profile.accountName||profile.displayName;
  el('avatar').textContent=initials(profile.accountName||profile.displayName);
  if(locations.length){
    block='<div class="service-location-head"><div><h3>Service locations</h3><div class="service-location-hint">Select a property to view its schedule, notes and equipment.</div></div></div><div class="service-location-grid">'+locations.map(function(location){var chosen=String(location.customerId)===String(profile.customerId),name=location.locationName||location.calendarTitle||'Service Location',primary=location.primary?'<span class="primary-location-badge">Primary</span>':'';return '<button type="button" class="service-location-card'+(chosen?' selected':'')+'" data-location-id="'+esc(location.customerId)+'"><div><div class="service-location-name">'+esc(name)+primary+'</div><div class="service-location-address">'+esc(location.address||'')+'</div></div><div class="service-location-meta">Frequency<b>'+esc(String(location.frequency||'').replace(/^Biweekly$/i,'Bi-Weekly')||'—')+'</b></div><div class="service-location-meta">Status<b>'+esc(location.status||'Active')+'</b></div></button>'}).join('')+'</div>';
    el('content').insertAdjacentHTML('afterbegin','<div id="accountServiceLocations">'+block+'</div>');
    Array.prototype.forEach.call(el('accountServiceLocations').querySelectorAll('.service-location-card'),function(button){button.onclick=function(){selectAccountServiceLocation(this.dataset.locationId)}});
  }
  el('profileSubtitle').textContent=selected&&selected.locationName?(selected.primary?'Primary · ':'')+selected.locationName:(profile.calendarTitle&&profile.calendarTitle!==profile.displayName?'Calendar: '+profile.calendarTitle:'');
  el('edit').textContent='Edit Location';
  markSelected(profile.accountPrimaryCustomerId||profile.customerId);
  setCursor(profile.accountPrimaryCustomerId||profile.customerId);
};
function selectAccountServiceLocation(customerId){if(!customerId||String(customerId)===String(selectedId))return;selectedId=customerId;el('profile').style.display='none';google.script.run.withSuccessHandler(renderProfile).withFailureHandler(showError).getPmosCustomerProfile(customerId)}
var addLocationButton=el('addServiceLocation');if(addLocationButton)addLocationButton.addEventListener('click',function(){if(!selectedId)return;this.disabled=true;google.script.run.withSuccessHandler(function(){setTimeout(function(){google.script.host.close()},250)}).withFailureHandler(function(error){addLocationButton.disabled=false;showError(error)}).showPmosAddServiceLocation(selectedId)});
</script></body></html>`
      );
      return html;
    };
  }

  if (typeof buildPmosCustomerEditorHtml_ === 'function') {
    const baseBuildPmosCustomerEditorHtml = buildPmosCustomerEditorHtml_;
    buildPmosCustomerEditorHtml_ = function(customerId, returnContext) {
      let html = baseBuildPmosCustomerEditorHtml(customerId, returnContext);
      const idJson = JSON.stringify(String(customerId || ''));
      html = html.replace(
        '<div class="section"><div class="section-head"><h3>Maintenance</h3>',
        '<div style="display:flex;justify-content:flex-end;margin:0 0 10px"><button id="addServiceLocationFromEditor" type="button" class="route-change">+ Add Service Location</button></div><div class="section"><div class="section-head"><h3>Maintenance</h3>'
      );
      html = html.replace(
        '</script></body></html>',
        `
var addServiceLocationFromEditor=document.getElementById('addServiceLocationFromEditor');if(addServiceLocationFromEditor)addServiceLocationFromEditor.onclick=function(){this.disabled=true;google.script.run.withSuccessHandler(function(){setTimeout(function(){google.script.host.close()},250)}).withFailureHandler(function(error){addServiceLocationFromEditor.disabled=false;alert(error&&error.message?error.message:String(error))}).showPmosAddServiceLocation(${idJson})};
</script></body></html>`
      );
      return html;
    };
  }
})();

function showPmosAddServiceLocation(customerId) {
  const id = String(customerId || '').trim();
  if (!id) throw new Error('Select a customer before adding a service location.');
  let htmlText = buildPmosServiceLocationManagerHtml_(id);
  htmlText = htmlText.replace(
    'if(data.locations.length)showLocation(data.locations[0])',
    'showAdd()'
  );
  const html = HtmlService.createHtmlOutput(htmlText).setWidth(980).setHeight(820);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Add Service Location');
}


/* Consolidated from 24-N_Customer_Account_Terminology.gs. */
/** User-facing terminology compatibility for Customer Accounts. */
function pmosAccountTerminologyText_(value) {
  if (value == null) return value;
  return String(value)
    .replace(/household pool profile/gi, 'customer account')
    .replace(/household contacts/gi, 'additional contacts')
    .replace(/household contact/gi, 'additional contact')
    .replace(/household name/gi, 'account name')
    .replace(/relink this household/gi, 'relink this account')
    .replace(/this household/gi, 'this account');
}

function pmosAccountTerminologyState_(value) {
  if (!value || typeof value !== 'object') return value;
  ['message', 'matchReason', 'explanation', 'summary', 'contactStatus'].forEach(function(key) {
    if (typeof value[key] === 'string') value[key] = pmosAccountTerminologyText_(value[key]);
  });
  if (Array.isArray(value.rows)) {
    value.rows.forEach(function(row) { pmosAccountTerminologyState_(row); });
  }
  if (Array.isArray(value.candidates)) {
    value.candidates.forEach(function(candidate) { pmosAccountTerminologyState_(candidate); });
  }
  if (Array.isArray(value.results)) {
    value.results.forEach(function(result) { pmosAccountTerminologyState_(result); });
  }
  return value;
}

(function () {
  if (typeof buildPmosCustomerLookupHtml_ === 'function') {
    const baseBuildCustomerLookupAccountTerminology = buildPmosCustomerLookupHtml_;
    buildPmosCustomerLookupHtml_ = function() {
      return pmosAccountTerminologyText_(baseBuildCustomerLookupAccountTerminology.apply(this, arguments));
    };
  }

  if (typeof buildPmosCustomerEditorHtml_ === 'function') {
    const baseBuildCustomerEditorAccountTerminology = buildPmosCustomerEditorHtml_;
    buildPmosCustomerEditorHtml_ = function() {
      return pmosAccountTerminologyText_(baseBuildCustomerEditorAccountTerminology.apply(this, arguments));
    };
  }

  if (typeof buildPmosGoogleContactsMassSyncHtml_ === 'function') {
    const baseBuildGoogleContactsMassAccountTerminology = buildPmosGoogleContactsMassSyncHtml_;
    buildPmosGoogleContactsMassSyncHtml_ = function() {
      return pmosAccountTerminologyText_(baseBuildGoogleContactsMassAccountTerminology.apply(this, arguments));
    };
  }

  if (typeof getPmosGoogleContactState === 'function') {
    const baseGetGoogleContactStateAccountTerminology = getPmosGoogleContactState;
    getPmosGoogleContactState = function() {
      return pmosAccountTerminologyState_(baseGetGoogleContactStateAccountTerminology.apply(this, arguments));
    };
  }

  if (typeof previewPmosGoogleContactsMassSync === 'function') {
    const basePreviewGoogleContactsMassAccountTerminology = previewPmosGoogleContactsMassSync;
    previewPmosGoogleContactsMassSync = function() {
      return pmosAccountTerminologyState_(basePreviewGoogleContactsMassAccountTerminology.apply(this, arguments));
    };
  }

  if (typeof savePmosCustomerEditorData === 'function') {
    const baseSaveCustomerEditorAccountTerminology = savePmosCustomerEditorData;
    savePmosCustomerEditorData = function() {
      try {
        return pmosAccountTerminologyState_(baseSaveCustomerEditorAccountTerminology.apply(this, arguments));
      } catch (error) {
        if (error && error.message) error.message = pmosAccountTerminologyText_(error.message);
        throw error;
      }
    };
  }

  if (typeof savePmosCustomerEditorExistingHouseholdContacts === 'function') {
    const baseSaveExistingAccountContacts = savePmosCustomerEditorExistingHouseholdContacts;
    savePmosCustomerEditorExistingHouseholdContacts = function() {
      try {
        return baseSaveExistingAccountContacts.apply(this, arguments);
      } catch (error) {
        if (error && error.message) error.message = pmosAccountTerminologyText_(error.message);
        throw error;
      }
    };
  }
})();
