/**
 * PMOS Calendar repair preview board UI.
 */
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
    if (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].indexOf(day) >= 0) {
      lanes.push({
        date: Utilities.formatDate(cursor, PMOS.TIMEZONE, 'yyyy-MM-dd'),
        day: day
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    *{box-sizing:border-box}body{font-family:Arial;margin:0;padding:14px;color:#1f2937}
    h2{margin:0 0 4px}.muted{font-size:12px;color:#6b7280}
    .board{display:flex;gap:10px;overflow:auto;margin-top:14px;padding-bottom:10px}
    .lane{min-width:220px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:9px;padding:8px;min-height:420px}
    .lane h3{font-size:13px;margin:0 0 7px}
    .stop{padding:8px;margin:6px 0;background:#eff6ff;border:1px solid #bfdbfe;border-radius:7px;cursor:grab;font-size:12px}
    .buttons{display:flex;gap:8px;margin-top:12px}
    button{border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer}
    .primary{background:#2563eb;color:#fff}.secondary{background:#e5e7eb}
    .status{margin-top:10px;white-space:pre-wrap}
  </style>
</head>
<body>
  <h2>Calendar Repair Preview</h2>
  <div class="muted">Drag customers between dates or vertically within a date. Their order becomes the stop order for that repair date.</div>
  <div id="board" class="board"></div>
  <div class="buttons">
    <button class="primary" onclick="save()">Save Edited Preview</button>
    <button class="secondary" onclick="google.script.host.close()">Close</button>
  </div>
  <div id="status" class="status"></div>
  <script>
    const lanes=${JSON.stringify(lanes)};
    const items=${JSON.stringify(plan.items)};
    let dragged=null;

    function render(){
      board.innerHTML='';
      lanes.forEach(function(laneData){
        const lane=document.createElement('div');
        lane.className='lane';
        lane.dataset.date=laneData.date;
        lane.innerHTML='<h3>'+laneData.day+'<br>'+laneData.date+'</h3>';
        lane.ondragover=function(event){event.preventDefault();};
        lane.ondrop=function(event){event.preventDefault();if(dragged)lane.appendChild(dragged);};
        items.filter(function(item){return item.date===laneData.date;})
          .sort(function(a,b){return a.order-b.order;})
          .forEach(function(item){
            const card=document.createElement('div');
            card.className='stop';
            card.draggable=true;
            card.dataset.id=item.id;
            card.textContent=item.title;
            card.ondragstart=function(){dragged=card;};
            card.ondragend=function(){dragged=null;};
            lane.appendChild(card);
          });
        board.appendChild(lane);
      });
    }

    function save(){
      const changes=[];
      document.querySelectorAll('.lane').forEach(function(lane){
        lane.querySelectorAll('.stop').forEach(function(card,index){
          changes.push({id:card.dataset.id,date:lane.dataset.date,order:index+1});
        });
      });
      status.textContent='Saving edited preview…';
      google.script.run
        .withSuccessHandler(function(result){status.textContent=result.summary;})
        .withFailureHandler(function(error){status.textContent=error.message||String(error);})
        .saveCalendarRepairBoardPlan(changes);
    }

    render();
  </script>
</body>
</html>`).setWidth(1200).setHeight(700);

  SpreadsheetApp.getUi().showModalDialog(html, 'Calendar Repair Preview');
  return {
    summary: 'Expanded repair preview opened with ' +
      plan.items.length + ' missing visit(s).'
  };
}
