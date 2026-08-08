/**
 * Authoritative Calendar Repair combined-board UI.
 *
 * Existing Calendar visits that match current PMOS route identity are fixed
 * green anchors. Proposed repair visits are blue draggable cards whose saved
 * position becomes their combined-day stop order.
 */

function getCalendarRepairExistingVisitCards_(start, end) {
  const calendar = getRecurringCalendar_();
  const queryEnd = new Date(end);
  queryEnd.setDate(queryEnd.getDate() + 1);
  const identities = repairRouteIdentityPool_();

  return calendar.getEvents(start, queryEnd)
    .filter(function(event) { return !event.isAllDayEvent(); })
    .filter(function(event) {
      return isPmosManagedCalendarEvent_(event) ||
        repairEventMatchesRoute_(event, identities);
    })
    .map(function(event) {
      return {
        id: 'existing-' + event.getId(),
        title: event.getTitle(),
        date: Utilities.formatDate(
          event.getStartTime(),
          PMOS.TIMEZONE,
          'yyyy-MM-dd'
        ),
        startMs: event.getStartTime().getTime(),
        existing: true
      };
    });
}

function openCalendarRepairBoard(startValue, endValue) {
  const start = parseRepairDate_(startValue, 'Begin date');
  const end = parseRepairDate_(endValue, 'End date');
  if (end.getTime() < start.getTime()) {
    throw new Error('End date must be on or after begin date.');
  }

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
      lanes.push({
        date: Utilities.formatDate(cursor, PMOS.TIMEZONE, 'yyyy-MM-dd'),
        day: day
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const customers = getCalendarRepairCustomerPool_();
  const existingVisits = getCalendarRepairExistingVisitCards_(start, end);
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{font-family:Arial;margin:0;padding:14px;color:#1f2937}h2{margin:0 0 4px}.muted{font-size:12px;color:#6b7280;line-height:1.4}.workspace{display:grid;grid-template-columns:270px minmax(0,1fr);gap:12px;margin-top:14px}.sidebar{border:1px solid #cbd5e1;border-radius:9px;padding:10px;background:#fff}.sidebar label{display:block;font-size:12px;font-weight:700;margin:8px 0 4px}.sidebar select,.sidebar input{width:100%;padding:7px;border:1px solid #cbd5e1;border-radius:7px}.route-area{min-width:0}.board{display:flex;gap:10px;overflow:auto;padding-bottom:10px}.lane{min-width:220px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:9px;padding:8px;min-height:430px}.lane h3{font-size:13px;margin:0 0 7px}.stop{position:relative;padding:8px 29px 8px 8px;margin:6px 0;border-radius:7px;font-size:12px}.stop.repair{background:#eff6ff;border:1px solid #93c5fd;cursor:grab}.stop.existing{background:#ecfdf5;border:1px solid #86efac;cursor:default}.stop.dragging{opacity:.45}.stop-number{display:inline-block;min-width:24px;font-weight:700;color:#1d4ed8}.existing .stop-number{color:#166534}.tag{display:block;margin:3px 0 0 24px;font-size:10px;font-weight:700;text-transform:uppercase;color:#166534}.remove{position:absolute;right:5px;top:4px;border:0;background:transparent;color:#991b1b;font-size:16px;cursor:pointer}.legend{margin-top:10px;padding:8px;background:#f8fafc;border-radius:7px;font-size:12px;line-height:1.5}.buttons{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}button{border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e5e7eb}.apply{background:#166534;color:#fff}.discard{background:#fee2e2;color:#991b1b}.note{margin-top:10px;padding:8px;background:#fff7ed;border-radius:7px;font-size:12px}.status{margin-top:10px;white-space:pre-wrap}button:disabled{opacity:.5;cursor:default}
</style></head><body>
<h2>Calendar Repair Preview</h2>
<div class="muted">Green visits already exist in Google Calendar and remain fixed. Blue repair visits can be dragged around them or between dates. Their displayed position becomes the final semi-stagger order. The permanent route template is not changed.</div>
<div class="workspace"><div class="sidebar"><b>Add a customer</b><label>Customer</label><select id="customer"></select><label>Repair date</label><select id="date"></select><label>Combined stop (optional)</label><input id="stop" type="number" min="1" step="1" placeholder="Add at end"><button id="add" class="primary" style="margin-top:10px;width:100%">Add to Preview</button><div class="legend"><b>Green:</b> already in Calendar<br><b>Blue:</b> repair visit</div><div class="note">The × button removes only a blue repair visit from this repair. Existing Calendar visits are never deleted by the board.</div></div><div class="route-area"><div id="board" class="board"></div></div></div>
<div class="buttons"><button id="discard" class="discard">Discard Changes</button><button id="save" class="secondary">Save Preview</button><button id="apply" class="apply">Apply Repair</button></div><div id="status" class="status"></div>
<script>
(function(){
const lanes=${JSON.stringify(lanes)},customers=${JSON.stringify(customers)},existingVisits=${JSON.stringify(existingVisits)},repairStart=${JSON.stringify(startText)},repairEnd=${JSON.stringify(endText)},originalItems=${JSON.stringify(plan.items)};
let items=${JSON.stringify(plan.items)},dragged=null,working=false;
const $=id=>document.getElementById(id);
function option(value,text){const node=document.createElement('option');node.value=value;node.textContent=text;return node;}
function setWorking(value,message){working=Boolean(value);document.querySelectorAll('button').forEach(button=>button.disabled=working);if(message)$('status').textContent=message;}
function renumber(){document.querySelectorAll('.lane').forEach(lane=>lane.querySelectorAll('.stop').forEach((card,index)=>{card.querySelector('.stop-number').textContent=(index+1)+'.';}));}
function existingCard(item){const card=document.createElement('div');card.className='stop existing';card.dataset.kind='existing';const number=document.createElement('span');number.className='stop-number';const title=document.createElement('span');title.textContent=item.title;const tag=document.createElement('span');tag.className='tag';tag.textContent='Already in Calendar';card.append(number,title,tag);return card;}
function repairCard(item){const card=document.createElement('div');card.className='stop repair';card.draggable=true;card.dataset.kind='repair';card.dataset.id=item.id;card.dataset.customerId=item.customerId||'';card.dataset.title=item.title||'';const number=document.createElement('span');number.className='stop-number';const title=document.createElement('span');title.textContent=item.title;const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='×';remove.onclick=event=>{event.stopPropagation();card.remove();renumber();};card.append(number,title,remove);card.ondragstart=()=>{dragged=card;card.classList.add('dragging');};card.ondragend=()=>{card.classList.remove('dragging');dragged=null;renumber();};return card;}
function combined(date){const sequence=existingVisits.filter(item=>item.date===date).sort((a,b)=>a.startMs-b.startMs).map(item=>({kind:'existing',item:item}));items.filter(item=>item.date===date).sort((a,b)=>Number(a.order||1)-Number(b.order||1)).forEach(item=>{const index=Math.min(Math.max(0,Number(item.order||1)-1),sequence.length);sequence.splice(index,0,{kind:'repair',item:item});});return sequence;}
function insertAtPointer(lane,event){if(!dragged)return;const cards=Array.from(lane.querySelectorAll('.stop:not(.dragging)'));let before=null;for(const card of cards){const box=card.getBoundingClientRect();if(event.clientY<box.top+box.height/2){before=card;break;}}if(before)lane.insertBefore(dragged,before);else lane.appendChild(dragged);renumber();}
function render(){const board=$('board');board.innerHTML='';lanes.forEach(laneData=>{const lane=document.createElement('div');lane.className='lane';lane.dataset.date=laneData.date;lane.innerHTML='<h3>'+laneData.day+'<br>'+laneData.date+'</h3>';lane.ondragover=event=>{event.preventDefault();insertAtPointer(lane,event);};lane.ondrop=event=>{event.preventDefault();insertAtPointer(lane,event);};combined(laneData.date).forEach(entry=>lane.appendChild(entry.kind==='existing'?existingCard(entry.item):repairCard(entry.item)));board.appendChild(lane);});renumber();}
function collect(){const changes=[];document.querySelectorAll('.lane').forEach(lane=>lane.querySelectorAll('.stop').forEach((card,index)=>{if(card.dataset.kind==='repair')changes.push({id:card.dataset.id,customerId:card.dataset.customerId||'',title:card.dataset.title||'',date:lane.dataset.date,order:index+1});}));return changes;}
function originals(){return originalItems.map(item=>({id:item.id,customerId:item.customerId||'',title:item.title||'',date:item.date,order:item.order}));}
function addCustomer(){const customer=customers[Number($('customer').value)],lane=document.querySelector('.lane[data-date="'+$('date').value+'"]');if(!customer||!lane)return;const item={id:'added-'+Date.now()+'-'+Math.random().toString(16).slice(2),customerId:customer.customerId||'',title:customer.title};const card=repairCard(item),requested=Math.floor(Number($('stop').value||0)),all=lane.querySelectorAll('.stop');if(requested>0&&requested<=all.length)lane.insertBefore(card,all[requested-1]);else lane.appendChild(card);$('stop').value='';renumber();$('status').textContent=customer.title+' added to the repair preview.';}
function fail(error){setWorking(false,error&&error.message?error.message:String(error));}
function save(){setWorking(true,'Saving preview…');google.script.run.withSuccessHandler(()=>{}).withFailureHandler(fail).saveCalendarRepairBoardAndReturn(collect());}
function discard(){if(!confirm('Discard all changes made since this repair preview was opened?'))return;setWorking(true,'Discarding changes…');google.script.run.withSuccessHandler(()=>{}).withFailureHandler(fail).discardCalendarRepairBoardChanges(originals());}
function apply(){if(!confirm('Save this combined preview and apply the Calendar repair now?'))return;setWorking(true,'Saving and applying Calendar repair…');google.script.run.withSuccessHandler(()=>{}).withFailureHandler(fail).saveAndApplyCalendarRepairBoard(collect(),repairStart,repairEnd);}
customers.forEach((customer,index)=>$('customer').appendChild(option(index,customer.title)));lanes.forEach(lane=>$('date').appendChild(option(lane.date,lane.day+' — '+lane.date)));$('add').onclick=addCustomer;$('save').onclick=save;$('discard').onclick=discard;$('apply').onclick=apply;render();
})();
</script></body></html>`).setWidth(1280).setHeight(760);

  SpreadsheetApp.getUi().showModalDialog(html, 'Calendar Repair Preview');
  return {
    summary:
      'Combined repair preview opened with ' + existingVisits.length +
      ' existing visit(s) and ' + plan.items.length +
      ' proposed repair visit(s).'
  };
}
