/**
 * Reusable PMOS Rolodex scrolling component.
 *
 * The Customer Lookup implementation is deliberately the canonical source. Its
 * marked client-code block is returned verbatim here so another PMOS window can
 * reuse the exact proven behavior without maintaining a drifting copy.
 */
function getPmosRolodexComponent_() {
  const html = buildPmosCustomerLookupHtml_('LOOKUP');
  const startMarker = '/* PMOS_ROLODEX_CORE_START */';
  const endMarker = '/* PMOS_ROLODEX_CORE_END */';
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('The canonical PMOS Rolodex client-code markers are missing.');
  }

  return {
    name: 'PMOS Rolodex Scroller',
    version: '1.0.0',
    clientSource: html.slice(start + startMarker.length, end).trim(),
    requiredState: "selectedId='',cursorId='',allRows=[],searchTargetId='',rollFrame=0,rollTarget=0,rollTargetId='',rollDone=null,rollSpeed=0,rollLastTime=0,rollTravel=0,rollSelectionPoint=null,keyFrame=0,keyDirection=0,keySpeed=0,keyLastTime=0,keyStarted=0,keyStartId='',keyHoldTimer=0,keySelectionPoint=null",
    requiredElements: ['search', 'count', 'results'],
    rowContract: ['customerId', 'listName or displayName'],
    hostFunctions: ['el(id)'],
    principles: getPmosRolodexPrinciples_()
  };
}

function getPmosRolodexPrinciples_() {
  return [
    'Typed search resolves by normalized last-name prefix; spaces and punctuation do not change the match.',
    'A running typed search retargets continuously without restarting its velocity curve.',
    'Long typed searches use distance-aware top speed with gradual acceleration and smooth deceleration.',
    'The visible Target is authoritative; Enter interrupts animation and opens that target immediately.',
    'A quick arrow tap responds immediately and advances exactly one customer.',
    'Rapid arrow taps advance from the requested destination rather than a transient animation frame.',
    'Held arrows inherit the tap velocity, accelerate very gradually, and decelerate smoothly.',
    'Manual movement locks the highlighter screen position while names roll beneath it.',
    'Arrow movement is direction-safe: Down never scrolls upward and Up never scrolls downward.',
    'Top and bottom boundaries keep the highlighted customer visible and selectable.',
    'At the physical top boundary, upward movement completes on the first customer.',
    'Mouse movement overrides keyboard highlighting; wheel input cancels programmatic motion safely.',
    'Customer opening rolls into position before loading unless the user invokes the Enter shortcut.'
  ];
}
