'use strict';
(()=>{
const paths={
'menu':'<path d="M4 6h16M4 12h16M4 18h16"/>',
'x':'<path d="m6 6 12 12M6 18 18 6"/>',
'layout':'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
'package':'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V8M12 13v10M7 6l10 6"/>',
'globe':'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
'alert':'<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3v1"/>',
'wallet':'<path d="M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v11H5a3 3 0 0 1-3-3V6m14 6h5v5h-5v-5Z"/>',
'bank':'<path d="m3 8 9-5 9 5H3Zm1 13h16M6 11v6m6-6v6m6-6v6M2 21h20"/>',
'credit-card':'<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 10h20m-15 6h3"/>',
'check':'<path d="m5 12 4 4L19 6"/>',
'check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
'pause':'<path d="M8 5v14M16 5v14"/>',
'customs':'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2m-6 7h6m-6 4 2 2 4-4"/>',
'arrow-up-right':'<path d="M7 17 17 7M7 7h10v10"/>',
'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
'arrow-left':'<path d="M20 12H4m6-6-6 6 6 6"/>',
'chevron-down':'<path d="m6 9 6 6 6-6"/>',
'plus':'<path d="M12 4v16M4 12h16"/>',
'download':'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
'file':'<path d="M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 13h8m-8 4h6"/>',
'search':'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
'shield':'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
'help':'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v1"/>',
'plane':'<path d="m22 2-7 20-4-9-9-4L22 2ZM11 13l6-6"/>',
'ship':'<path d="M5 13V6h14v7M9 6V3h6v3m-3 4v10M2 14l10-4 10 4-4 6H6l-4-6Zm0 8c2-2 4-2 6 0 2-2 4-2 6 0 2-2 4-2 6 0"/>',
 'truck':'<path d="M2 5h12v12H2V5Zm12 5h4l4 4v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
'route':'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h9"/>',
'activity':'<path d="M2 12h5l3-9 4 18 3-9h5"/>',
'copy':'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
'refresh':'<path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3"/>'
};
window.relayIcon=(name,size=18)=>`<svg class="relay-icon" width="${Number(size)||18}" height="${Number(size)||18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.package}</svg>`;
function paint(){document.querySelectorAll('[data-icon]').forEach(el=>{const name=el.getAttribute('data-icon');el.removeAttribute('data-icon');el.innerHTML=window.relayIcon(name)})}
let queued=false;new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;paint()})}}).observe(document.documentElement,{childList:true,subtree:true});
paint();
let previousFocus=null,oldOverflow='';
const mobile=window.matchMedia('(max-width: 800px)');
function drawer(open){const aside=document.getElementById('adminSidebar'),toggle=document.getElementById('mobileMenu');if(!aside||!toggle)return;open=Boolean(open&&mobile.matches);if(open&&!document.body.classList.contains('drawer-open')){previousFocus=document.activeElement;oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden'}document.body.classList.toggle('drawer-open',open);toggle.setAttribute('aria-expanded',String(open));const backdrop=document.getElementById('sidebarBackdrop');if(backdrop)backdrop.hidden=!open;const main=document.querySelector('body:not([data-page]) main');if(main)main.inert=open;if(open){aside.setAttribute('role','dialog');aside.setAttribute('aria-modal','true');aside.setAttribute('aria-label','Admin navigation');aside.removeAttribute('inert');document.getElementById('closeSidebar')?.focus()}else{aside.removeAttribute('role');aside.removeAttribute('aria-modal');aside.removeAttribute('aria-label');if(mobile.matches)aside.setAttribute('inert','');else aside.removeAttribute('inert');document.body.style.overflow=oldOverflow;if(previousFocus&&document.contains(previousFocus))previousFocus.focus();previousFocus=null}}
window.relayDrawer=drawer;
function setup(){document.getElementById('mobileMenu')?.addEventListener('click',()=>drawer(!document.body.classList.contains('drawer-open')));document.getElementById('closeSidebar')?.addEventListener('click',()=>drawer(false));document.getElementById('sidebarBackdrop')?.addEventListener('click',()=>drawer(false));document.getElementById('adminSidebar')?.addEventListener('click',e=>{if(e.target.closest('button.nav,a,.help button'))drawer(false)});if(mobile.matches)document.getElementById('adminSidebar')?.setAttribute('inert','');}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
mobile.addEventListener('change',()=>drawer(false));
document.addEventListener('keydown',e=>{if(!document.body.classList.contains('drawer-open'))return;if(e.key==='Escape'){e.preventDefault();drawer(false)}if(e.key==='Tab'){const elements=Array.from(document.querySelectorAll('#adminSidebar button:not([disabled]),#adminSidebar a[href]')).filter(el=>el.getClientRects().length);if(!elements.length)return;const first=elements[0],last=elements[elements.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
})();
