'use strict';
(()=>{
const T=s=>window.RelayI18n?.t(s)||s;
const planner=document.getElementById('dimensionPlanner');
if(planner){
 const result=document.getElementById('dimensionResult');
 planner.addEventListener('input',()=>{result.textContent=''});
 planner.addEventListener('submit',event=>{
  event.preventDefault();if(!planner.reportValidity())return;
  const values=Object.fromEntries(new FormData(planner));
  const [length,width,height,actual,divisor]=['length','width','height','actual','divisor'].map(k=>Number(values[k]));
  if(![length,width,height,actual,divisor].every(n=>Number.isFinite(n)&&n>0&&n<=1000000)){result.textContent=T('Enter positive, finite measurements and a confirmed divisor.');return}
  const dimensional=length*width*height/divisor,compared=Math.max(actual,dimensional);
  const format=n=>new Intl.NumberFormat(document.documentElement.lang||'en',{maximumFractionDigits:3}).format(n);
  result.textContent=T('Illustrative volume-based weight')+': '+format(dimensional)+' kg\n'+T('Larger of actual and volume-based weight')+': '+format(compared)+' kg\n'+T('Planning arithmetic only. Confirm carrier rules, rounding and charges with operations.');
 });
}
const checklist=document.getElementById('shipmentChecklist');
if(checklist){
 const key='relay.preparation-checklist.v1',boxes=Array.from(checklist.querySelectorAll('input[type=checkbox]')),progress=document.getElementById('checklistProgress'),privacy=document.getElementById('checklistPrivacy');
 const reset=document.getElementById('resetChecklist'),print=document.getElementById('printChecklist');
 function paint(){const n=boxes.filter(b=>b.checked).length;progress.textContent=n+' / '+boxes.length+' — '+T('Preparation steps reviewed');reset.disabled=n===0}
 try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))for(const b of boxes)b.checked=saved.includes(b.name)}catch{}
 function save(){try{localStorage.setItem(key,JSON.stringify(boxes.filter(b=>b.checked).map(b=>b.name)))}catch{privacy.textContent=T('Browser storage is unavailable. Progress remains on this page only.')}paint()}
 checklist.addEventListener('change',save);reset.addEventListener('click',()=>{boxes.forEach(b=>b.checked=false);save()});print.addEventListener('click',()=>window.print());print.disabled=false;paint();window.addEventListener('relay:language',paint);
}
})();
