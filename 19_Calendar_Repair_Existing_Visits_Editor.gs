/**
 * Calendar Repair editor with surviving Calendar visits shown as fixed anchors.
 * Repair cards remain draggable; their saved order is their position within the
 * full combined day, including existing PMOS visits.
 */

function getCalendarRepairExistingVisitCards_(start, end) {
  const calendar = getRecurringCalendar_();
  const queryEnd = new Date(end);
  queryEnd.setDate(queryEnd.getDate() + 1);
  return calendar.getEvents(start, queryEnd)
    .filter(event => !event.isAllDayEvent())
    .filter(isPmosManagedCalendarEvent_)
    .map(event => ({
      id: 'existing-' + event.getId(),
      title: event.getTitle(),
      date: Utilities.formatDate(event.getStartTime(), PMOS.TIMEZONE, 'yyyy-MM-dd'),
      startMs: event.getStartTime().getTime(),
      existing: true
    }));
}

function openCalendarRepairBoard(startValue, endValue) {
  const start = parseRepairDate_(startValue, 'Begin date');
  const end = parseRepairDate_(endValue, 'End date');
  let plan = readRepairPlan_();
  const startText = Utilities.formatDate(start, PMOS.TIMEZONE, 'yyyy-MM-dd');
  const endText = Utilities.formatDate(end, PMOS.TIMEZONE, 'yyyy-MM-dd');
  if (!plan || plan.start !== startText || plan.end !== endText) {
    plan = saveRepairPlan_(buildCalendarRepairPlan_(start, end));
  }

  const lanes = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const day = Utilities.formatDate(cursor, PMOS.TIMEZONE, 'EEEE');
    if (['Monday','Tuesday','Wednesday','Thursday','Friday'].indexOf(day) >= 0) {
      lanes.push({date: Utilities.formatDate(cursor, PMOS.TIMEZONE, 'yyyy-MM-dd'), day});
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const customers = getCalendarRepairCustomerPool_();
  const existingVisits = getCalendarRepairExistingVisitCards_(start, end);
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{font-family:Arial;margin:0;padding:14px;color:#1f2937}h2{margin:0 0 4px}.muted{font-size:12px;color:#6b7280;line-height:1.4}.workspace{display:grid;grid-template-columns:270px minmax(0,1fr);gap:12px;margin-top:14px}.sidebar{border:1px solid #cbd5e1;border-radius:9px;padding:10px;background:#fff}.sidebar label{display:block;font-size:12px;font-weight:700;margin:8px 0 4px}.sidebar select,.sidebar input{width:100%;padding:7px;border:1px solid #cbd5e1;border-radius:7px}.route-area{min-width:0}.top-scroll{overflow-x:auto;overflow-y:hidden;height:18px;margin-bottom:4px}.top-scroll-inner{height:1px}.board{display:flex;gap:10px;overflow-x:auto;overflow-y:visible;padding-bottom:10px}.lane{min-width:220px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:9px;padding:8px;min-height:420px}.lane h3{font-size:13px;margin:0 0 7px}.stop{position:relative;padding:8px 29px 8px 8px;margin:6px 0;border-radius:7px;font-size:12px}.stop.repair{background:#eff6ff;border:1px solid #93c5fd;cursor:grab}.stop.existing{background:#ecfdf5;border:1px solid #86efac;cursor:default}.stop.dragging{opacity:.45}.stop-number{display:inline-block;min-width:22px;font-weight:700;color:#1d4ed8}.existing .stop-number{color:#166534}.tag{display:block;margin:3px 0 0 22px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#166534}.remove{position:absolute;right:5px;top:4px;border:0;background:transparent;color:#991b1b;font-size:16px;cursor:pointer}.legend{margin-top:10px;padding:8px;background:#f8fafc;border-radius:7px;font-size:12px;line-height:1.5}.legend span{display:block}.buttons{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}button{border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e5e7eb}.apply{background:#166534;color:#fff}.discard{background:#fee2e2;color:#991b1b}.danger-note{margin-top:10px;padding:8px;background:#fff7ed;border-radius:7px;font-size:12px}.status{margin-top:10px;white-space:pre-wrap}
</style></head><body>
<h2>Calendar Repair Preview</h2>
<div class="muted">The board shows the complete combined route. Green visits already exist in Google Calendar and remain fixed. Blue repair visits can be dragged around them; the displayed stop number becomes the final semi-stagger position.</div>
<div class="workspace">
  <div class="sidebar">
    <b>Add a customer</b>
    <label for="customerSelect">Customer</label><select id="customerSelect"></select>
    <label for="dateSelect">Repair date</label><select id="dateSelect"></select>
    <label for="stopInput">Combined stop (optional)</label><input id="stopInput" type="number" min="1" step="1" placeholder="Add at end">
    <button class="primary" style="margin-top:10px;width:100%" onclick="addCustomer()">Add to Preview</button>
    <div class="legend"><span><b>Green:</b> already in Calendar</span><span><b>Blue:</b> repair visit</span></div>
    <div class="danger-note">The × button removes only a blue repair visit from this repair. Existing green Calendar visits are not deleted.</div>
  </div>
  <div class="route-area"><div id="topScroll" class="top-scroll"><div id="topScrollInner" class="top-scroll-inner"></div></div><div id="board" class="board"></div></div>
</div>
<div class="buttons"><button class="discard" onclick="discardChanges()">Discard Changes</button><button class="secondary" onclick="savePreview()">Save Preview</button><button class="apply" onclick="applyRepair()">Apply Repair</button></div>
<div id="status" class="status"></div>
<script>
const lanes=${JSON.stringify(lanes)};
const customers=${JSON.stringify(customers)};
const existingVisits=${JSON.stringify(existingVisits)};
const repairStart=${JSON.stringify(startText)};
const repairEnd=${JSON.stringify(endText)};
const originalItems=${JSON.stringify(plan.items)};
let items=${JSON.stringify(plan.items)};
let dragged=null,working=false,syncingScroll=false,autoScrollFrame=null,dragPointerX=0,dragPointerY=0;
function byId(id){return document.getElementById(id)}
function option(value,text){const o=document.createElement('option');o.value=value;o.textContent=text;return o}
function setWorking(value,message){working=Boolean(value);document.querySelectorAll('button').forEach(button=>button.disabled=working);if(message)byId('status').textContent=message}
function syncScrollWidth(){const board=byId('board');byId('topScrollInner').style.width=board.scrollWidth+'px'}
function setupScrollSync(){const top=byId('topScroll'),board=byId('board');top.addEventListener('scroll',()=>{if(syncingScroll)return;syncingScroll=true;board.scrollLeft=top.scrollLeft;syncingScroll=false});board.addEventListener('scroll',()=>{if(syncingScroll)return;syncingScroll=true;top.scrollLeft=board.scrollLeft;syncingScroll=false});syncScrollWidth()}
function edgeScrollSpeed(distance,zone,maxSpeed){const strength=Math.max(0,Math.min(1,(zone-distance)/zone));return Math.ceil(maxSpeed*strength*strength)}
function stopAutoScroll(){if(autoScrollFrame!==null){cancelAnimationFrame(autoScrollFrame);autoScrollFrame=null}}
function autoScrollTick(){if(!dragged){stopAutoScroll();return}const zone=160,maxV=22,maxH=24;if(dragPointerY<zone)window.scrollBy(0,-edgeScrollSpeed(dragPointerY,zone,maxV));else if(dragPointerY>window.innerHeight-zone)window.scrollBy(0,edgeScrollSpeed(window.innerHeight-dragPointerY,zone,maxV));const board=byId('board'),box=board.getBoundingClientRect();if(dragPointerX>=box.left-zone&&dragPointerX<box.left+zone)board.scrollLeft-=edgeScrollSpeed(Math.max(0,dragPointerX-box.left),zone,maxH);else if(dragPointerX<=box.right+zone&&dragPointerX>box.right-zone)board.scrollLeft+=edgeScrollSpeed(Math.max(0,box.right-dragPointerX),zone,maxH);const lane=document.elementFromPoint(Math.max(0,Math.min(window.innerWidth-1,dragPointerX)),Math.max(0,Math.min(window.innerHeight-1,dragPointerY)));const target=lane&&lane.closest?lane.closest('.lane'):null;if(target)positionDragged(target,dragPointerY);autoScrollFrame=requestAnimationFrame(autoScrollTick)}
function updateAutoScrollPointer(e){if(!dragged)return;dragPointerX=e.clientX;dragPointerY=e.clientY;if(autoScrollFrame===null)autoScrollFrame=requestAnimationFrame(autoScrollTick)}
function renumberStops(){document.querySelectorAll('.lane').forEach(lane=>lane.querySelectorAll('.stop').forEach((stop,index)=>{const n=stop.querySelector('.stop-number');if(n)n.textContent=(index+1)+'.'}))}
function getInsertBefore(lane,y){const cards=Array.from(lane.querySelectorAll('.stop:not(.dragging)'));let closest={offset:Number.NEGATIVE_INFINITY,element:null};cards.forEach(card=>{const box=card.getBoundingClientRect(),offset=y-box.top-box.height/2;if(offset<0&&offset>closest.offset)closest={offset,element:card}});return closest.element}
function positionDragged(lane,y){if(!dragged)return;const before=getInsertBefore(lane,y);if(before)lane.insertBefore(dragged,before);else lane.appendChild(dragged);renumberStops()}
function existingCard(item){const c=document.createElement('div');c.className='stop existing';c.dataset.kind='existing';const n=document.createElement('span');n.className='stop-number';const t=document.createElement('span');t.textContent=item.title;const tag=document.createElement('span');tag.className='tag';tag.textContent='Already in Calendar';c.appendChild(n);c.appendChild(t);c.appendChild(tag);return c}
function repairCard(item){const c=document.createElement('div');c.className='stop repair';c.draggable=true;c.dataset.kind='repair';c.dataset.id=item.id;c.dataset.customerId=item.customerId||'';c.dataset.title=item.title||'';const n=document.createElement('span');n.className='stop-number';const t=document.createElement('span');t.textContent=item.title;c.appendChild(n);c.appendChild(t);const x=document.createElement('button');x.className='remove';x.type='button';x.textContent='×';x.onclick=e=>{e.stopPropagation();c.remove();renumberStops()};c.appendChild(x);c.ondragstart=e=>{dragged=c;dragPointerX=e.clientX;dragPointerY=e.clientY;c.classList.add('dragging');e.dataTransfer.effectAllowed='move';if(autoScrollFrame===null)autoScrollFrame=requestAnimationFrame(autoScrollTick)};c.ondragend=()=>{c.classList.remove('dragging');dragged=null;stopAutoScroll();renumberStops()};return c}
function combinedForDate(date){const sequence=existingVisits.filter(i=>i.date===date).sort((a,b)=>a.startMs-b.startMs).map(i=>({kind:'existing',value:i}));items.filter(i=>i.date===date).sort((a,b)=>Number(a.order||1)-Number(b.order||1)).forEach(item=>{const index=Math.min(Math.max(0,Number(item.order||1)-1),sequence.length);sequence.splice(index,0,{kind:'repair',value:item})});return sequence}
function render(){byId('board').innerHTML='';lanes.forEach(l=>{const lane=document.createElement('div');lane.className='lane';lane.dataset.date=l.date;lane.innerHTML='<h3>'+l.day+'<br>'+l.date+'</h3>';lane.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move';updateAutoScrollPointer(e);positionDragged(lane,e.clientY)};lane.ondrop=e=>{e.preventDefault();positionDragged(lane,e.clientY);stopAutoScroll()};combinedForDate(l.date).forEach(entry=>lane.appendChild(entry.kind==='existing'?existingCard(entry.value):repairCard(entry.value)));byId('board').appendChild(lane)});renumberStops();requestAnimationFrame(syncScrollWidth)}
function setup(){customers.forEach((c,i)=>byId('customerSelect').appendChild(option(i,c.title)));lanes.forEach(l=>byId('dateSelect').appendChild(option(l.date,l.day+' — '+l.date)));render();setupScrollSync();document.addEventListener('dragover',updateAutoScrollPointer);document.addEventListener('drop',stopAutoScroll);window.addEventListener('resize',syncScrollWidth)}
function addCustomer(){const customer=customers[Number(byId('customerSelect').value)],lane=document.querySelector('.lane[data-date="'+byId('dateSelect').value+'"]');if(!customer||!lane)return;const item={id:'added-'+Date.now()+'-'+Math.random().toString(16).slice(2),customerId:customer.customerId||'',title:customer.title};const c=repairCard(item),requested=Math.floor(Number(byId('stopInput').value||0)),all=lane.querySelectorAll('.stop');if(requested>0&&requested<=all.length)lane.insertBefore(c,all[requested-1]);else lane.appendChild(c);renumberStops();byId('stopInput').value='';byId('status').textContent=customer.title+' added to the combined preview.'}
function collectChanges(){const changes=[];document.querySelectorAll('.lane').forEach(l=>l.querySelectorAll('.stop').forEach((c,index)=>{if(c.dataset.kind==='repair')changes.push({id:c.dataset.id,customerId:c.dataset.customerId||'',title:c.dataset.title||'',date:l.dataset.date,order:index+1})}));return changes}
function originalChanges(){return originalItems.map(item=>({id:item.id,customerId:item.customerId||'',title:item.title||'',date:item.date,order:item.order}))}
function savePreview(){setWorking(true,'Saving preview and returning to Job Engine…');google.script.run.withSuccessHandler(()=>{}).withFailureHandler(e=>setWorking(false,e.message||String(e))).saveCalendarRepairBoardAndReturn(collectChanges())}
function discardChanges(){if(!confirm('Discard all changes made since this repair preview was opened?\\n\\nThe preview will be restored to its previous saved state.'))return;setWorking(true,'Discarding changes and returning to Job Engine…');google.script.run.withSuccessHandler(()=>{}).withFailureHandler(e=>setWorking(false,e.message||String(e))).discardCalendarRepairBoardChanges(originalChanges())}
function applyRepair(){if(!confirm('Save this combined preview and apply the Calendar repair now?'))return;setWorking(true,'Saving and applying Calendar repair…');google.script.run.withSuccessHandler(()=>{}).withFailureHandler(e=>setWorking(false,e.message||String(e))).saveAndApplyCalendarRepairBoard(collectChanges(),repairStart,repairEnd)}
setup();
</script></body></html>`).setWidth(1280).setHeight(760);
  SpreadsheetApp.getUi().showModalDialog(html, 'Calendar Repair Preview');
  return {summary: `Combined repair preview opened with ${existingVisits.length} existing visit(s) and ${plan.items.length} proposed repair visit(s).`};
}
