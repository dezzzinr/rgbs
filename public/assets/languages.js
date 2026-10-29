'use strict';
(()=>{
const supported=['en','fr','es','ar','pt','de','it','nl','zh','ja','hi'];let language='en',catalog={},scheduled=false;
try{const saved=localStorage.getItem('relay.language.v1');if(supported.includes(saved))language=saved}catch{}
const sources=new WeakMap(),attributes=new WeakMap();
const safeIDs=['title','subtitle','crumb','loginBtn','workspaceLabel','tableTitle','trackSubmit','refreshStatus'];
function t(text){return catalog[text]?.[language]||text}
function paintText(node){const value=node.nodeValue,old=sources.get(node);let original=old&&value===old.last?old.original:value;const trimmed=original.trim();if(!catalog[trimmed])return;const next=original.replace(trimmed,t(trimmed));sources.set(node,{original,last:next});if(value!==next)node.nodeValue=next}
function apply(){document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';
 document.querySelectorAll('[data-relay-ui],[data-relay-enum],#stats,#opsQueue,#newShipmentBtn,.enhanced-route-info small,.mapbox-map-switch button,'+safeIDs.map(id=>'#'+id).join(',')).forEach(el=>{if(el.closest('[data-relay-no-translate],script,style,textarea'))return;const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode())paintText(node)});
 document.querySelectorAll('[data-relay-attributes]').forEach(el=>{let record=attributes.get(el)||{};for(const name of ['placeholder','aria-label','title']){const current=el.getAttribute(name);if(!current)continue;const old=record[name],original=old&&current===old.last?old.original:current;if(!catalog[original])continue;const next=t(original);record[name]={original,last:next};if(current!==next)el.setAttribute(name,next)}attributes.set(el,record)});
 document.querySelectorAll('[data-relay-language]').forEach(el=>{el.value=language;el.setAttribute('aria-label',t('Language'))});
}
function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply()})}
function setLanguage(value){if(!supported.includes(value))return;language=value;try{localStorage.setItem('relay.language.v1',value)}catch{}apply();window.dispatchEvent(new CustomEvent('relay:language',{detail:{language}}))}
window.RelayI18n={t,apply,setLanguage,get language(){return language}};
function boot(){const holder=document.createElement('div');holder.className='relay-language';holder.innerHTML='<select data-relay-language aria-label="Language" dir="ltr"><option value="en" lang="en">English</option><option value="fr" lang="fr">Français</option><option value="es" lang="es">Español</option><option value="ar" lang="ar">العربية</option><option value="pt" lang="pt">Português</option><option value="de" lang="de">Deutsch</option><option value="it" lang="it">Italiano</option><option value="nl" lang="nl">Nederlands</option><option value="zh" lang="zh">简体中文</option><option value="ja" lang="ja">日本語</option><option value="hi" lang="hi">हिन्दी</option></select>';holder.title='Interface labels only. Shipment notes remain as entered.';holder.setAttribute('data-relay-attributes','');const target=document.querySelector('.nav-tools')||document.querySelector('main .topbar .right')||document.querySelector('main .topbar')||document.querySelector('header');(target||document.body).append(holder);holder.querySelector('select').addEventListener('change',e=>setLanguage(e.target.value));
 new MutationObserver(queue).observe(document.body,{childList:true,characterData:true,subtree:true});
 apply();fetch('/assets/languages.json',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('Unavailable');return r.json()}).then(data=>{catalog=data;apply()}).catch(()=>{holder.title='Translations unavailable. English labels remain available.'});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
