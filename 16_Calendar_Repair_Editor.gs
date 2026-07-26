/**
 * Calendar Repair editor extensions.
 * The repair plan is temporary and does not rewrite the permanent route plan.
 */

function getCalendarRepairCustomerPool_() {
  const seen = {};
  return readRoutesInPhysicalOrder_().filter(row => {
    const key = String(row.customerId || normalize_(row.title));
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  }).map(row => ({
    customerId: row.customerId || '',
    title: row.title,
    layer: row.layer,
    order: Number(row.order || 1),
    address: row.address || '',
    description: buildRouteDescription_(row, parseLayer_(row.layer)),
    frequency: row.frequency || '',
    color: calendarColorForFrequency_(row.frequency)
  })).sort((a, b) => String(a.title).localeCompare(String(b.title)));
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
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head><base target="_top"><style>
*{box-sizing:border-box}body{font-family:Arial;margin:0;padding:14px;color:#1f2937}h2{margin:0 0 4px}.muted{font-size:12px;color:#6b7280;line-height:1.4}.workspace{display:grid;grid-template-columns:270px 1fr;gap:12px;margin-top:14px}.sidebar{border:1px solid #cbd5e1;border-radius:9px;padding:10px;background:#fff}.sidebar label{display:block;font-size:12px;font-weight:700;margin:8px 0 4px}.sidebar select{width:100%;padding:7px;border:1px solid #cbd5e1;border-radius:7px}.board{display:flex;gap:10px;overflow:auto;padding-bottom:10px}.lane{min-width:220px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:9px;padding:8px;min-height:420px}.lane h3{font-size:13px;margin:0 0 7px}.stop{position:relative;padding:8px 29px 8px 8px;margin:6px 0;background:#eff6ff;border:1px solid #bfdbfe;border-radius:7px;cursor:grab;font-size:12px}.stop.dragging{opacity:.45}.stop-number{display:inline-block;min-width:22px;font-weight:700;color:#1d4ed8}.remove{position:absolute;right:5px;top:4px;border:0;background:transparent;color:#991b1b;font-size:16px;cursor:pointer}.buttons{display:flex;gap:8px;margin-top:12px}button{border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.secondary{background:#e5e7eb}.danger-note{margin-top:10px;padding:8px;background:#fff7ed;border-radius:7px;font-size:12px}.status{margin-top:10px;white-space:pre-wrap}
</style></head><body>
<h2>Calendar Repair Preview</h2>
<div class="muted">This is a temporary repair plan for the selected date range. Drag visits between dates or vertically to change stop order. Add customers who should appear during this transition week, and remove visits that should not be recreated. The permanent route plan is not changed.</div>
<div class="workspace">
  <div class="sidebar">
    <b>Add a customer</b>
    <label for="customerSelect">Customer</label><select id="customerSelect"></select>
    <label for="dateSelect">Repair date</label><select id="dateSelect"></select>
    <button class="primary" style="margin-top:10px;width:100%" onclick="addCustomer()">Add to Preview</button>
    <div class="danger-note">Use the × button on a visit to exclude it from this repair. This does not delete an existing Calendar event.</div>
  </div>
  <div id="board" class="board"></div>
</div>
<div class="buttons"><button class="primary" onclick="save()">Save Edited Preview</button><button class="secondary" onclick="google.script.host.close()">Close</button></div><div id="status" class="status"></div>
<script>
const lanes=${JSON.stringify(lanes)};const customers=${JSON.stringify(customers)};let items=${JSON.stringify(plan.items)};let dragged=null;
function option(value,text){const o=document.createElement('option');o.value=value;o.textContent=text;return o}
function setup(){customers.forEach((c,i)=>customerSelect.appendChild(option(i,c.title)));lanes.forEach(l=>dateSelect.appendChild(option(l.date,l.day+' — '+l.date)));render()}
function renumberStops(){document.querySelectorAll('.lane').forEach(lane=>lane.querySelectorAll('.stop').forEach((stop,index)=>{const number=stop.querySelector('.stop-number');if(number)number.textContent=(index+1)+'.'}))}
function getInsertBefore(lane,y){const cards=Array.from(lane.querySelectorAll('.stop:not(.dragging)'));let closest={offset:Number.NEGATIVE_INFINITY,element:null};cards.forEach(card=>{const box=card.getBoundingClientRect();const offset=y-box.top-box.height/2;if(offset<0&&offset>closest.offset)closest={offset,element:card}});return closest.element}
function positionDragged(lane,y){if(!dragged)return;const before=getInsertBefore(lane,y);if(before)lane.insertBefore(dragged,before);else lane.appendChild(dragged);renumberStops()}
function card(item){const c=document.createElement('div');c.className='stop';c.draggable=true;c.dataset.id=item.id;c.dataset.customerId=item.customerId||'';const number=document.createElement('span');number.className='stop-number';const title=document.createElement('span');title.className='stop-title';title.textContent=item.title;c.appendChild(number);c.appendChild(title);const x=document.createElement('button');x.className='remove';x.type='button';x.textContent='×';x.title='Remove from this repair preview';x.onclick=e=>{e.stopPropagation();c.remove();renumberStops()};c.appendChild(x);c.ondragstart=e=>{dragged=c;c.classList.add('dragging');e.dataTransfer.effectAllowed='move'};c.ondragend=()=>{c.classList.remove('dragging');dragged=null;renumberStops()};return c}
function render(){board.innerHTML='';lanes.forEach(l=>{const lane=document.createElement('div');lane.className='lane';lane.dataset.date=l.date;lane.innerHTML='<h3>'+l.day+'<br>'+l.date+'</h3>';lane.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move';positionDragged(lane,e.clientY)};lane.ondrop=e=>{e.preventDefault();positionDragged(lane,e.clientY)};items.filter(i=>i.date===l.date).sort((a,b)=>a.order-b.order).forEach(i=>lane.appendChild(card(i)));board.appendChild(lane)});renumberStops()}
function addCustomer(){const customer=customers[Number(customerSelect.value)];const lane=document.querySelector('.lane[data-date="'+dateSelect.value+'"]');if(!customer||!lane)return;const item={id:'added-'+Date.now()+'-'+Math.random().toString(16).slice(2),customerId:customer.customerId||'',title:customer.title};lane.appendChild(card(item));renumberStops();status.textContent=customer.title+' added to the preview.'}
function save(){const changes=[];document.querySelectorAll('.lane').forEach(l=>l.querySelectorAll('.stop').forEach((c,index)=>changes.push({id:c.dataset.id,customerId:c.dataset.customerId||'',date:l.dataset.date,order:index+1})));status.textContent='Saving edited preview…';google.script.run.withSuccessHandler(r=>status.textContent=r.summary).withFailureHandler(e=>status.textContent=e.message||String(e)).saveCalendarRepairBoardPlan(changes)}
setup();
</script></body></html>`).setWidth(1280).setHeight(760);
  SpreadsheetApp.getUi().showModalDialog(html, 'Calendar Repair Preview');
  return {summary: `Expanded repair preview opened with ${plan.items.length} proposed repair visit(s).`};
}

function saveCalendarRepairBoardPlan(changes) {
  if (!Array.isArray(changes)) throw new Error('Edited repair data is missing.');
  const plan = readRepairPlan_();
  if (!plan) throw new Error('Run Calendar Repair Preview first.');

  const existingById = {};
  plan.items.forEach(item => existingById[String(item.id)] = item);
  const pool = getCalendarRepairCustomerPool_();
  const poolByCustomer = {};
  pool.forEach(item => {
    const key = String(item.customerId || normalize_(item.title));
    poolByCustomer[key] = item;
  });
  const settings = getRecurringCalendarSettings_();

  plan.items = changes.map(change => {
    let item = existingById[String(change.id)];
    if (!item) {
      const template = poolByCustomer[String(change.customerId || '')];
      if (!template) throw new Error('An added customer could not be matched to the route database.');
      item = Object.assign({id: String(change.id || Utilities.getUuid())}, template);
    } else {
      item = Object.assign({}, item);
    }
    const date = parseRepairDate_(change.date, 'Repair date');
    const order = Math.max(1, Number(change.order || 1));
    const start = routeTimeForOrder_(date, order, settings);
    item.date = Utilities.formatDate(date, PMOS.TIMEZONE, 'yyyy-MM-dd');
    item.order = order;
    item.start = start.toISOString();
    item.end = new Date(start.getTime() + settings.eventDurationMinutes * 60000).toISOString();
    return item;
  });

  saveRepairPlan_(plan);
  return {summary: `Edited repair preview saved. ${plan.items.length} visit(s) will be created when Apply Previewed Repair is selected. Removed visits are excluded from this repair only.`};
}