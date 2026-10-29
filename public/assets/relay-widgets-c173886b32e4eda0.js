
;
// /assets/languages.js
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
function boot(){const holder=document.createElement('div');holder.className='relay-language';holder.innerHTML='<span data-relay-ui>Language</span><select data-relay-language aria-label="Language" dir="ltr"><option value="en" lang="en">English</option><option value="fr" lang="fr">Français</option><option value="es" lang="es">Español</option><option value="ar" lang="ar">العربية</option><option value="pt" lang="pt">Português</option><option value="de" lang="de">Deutsch</option><option value="it" lang="it">Italiano</option><option value="nl" lang="nl">Nederlands</option><option value="zh" lang="zh">简体中文</option><option value="ja" lang="ja">日本語</option><option value="hi" lang="hi">हिन्दी</option></select>';holder.title='Interface labels only. Shipment notes remain as entered.';holder.setAttribute('data-relay-attributes','');const target=document.querySelector('.nav-tools')||document.querySelector('main .topbar .right')||document.querySelector('main .topbar')||document.querySelector('header');(target||document.body).append(holder);holder.querySelector('select').addEventListener('change',e=>setLanguage(e.target.value));
 new MutationObserver(queue).observe(document.body,{childList:true,characterData:true,subtree:true});
 apply();fetch('/assets/languages.json',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('Unavailable');return r.json()}).then(data=>{catalog=data;apply()}).catch(()=>{holder.title='Translations unavailable. English labels remain available.'});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();


;
// /assets/livechat.js
'use strict';
(()=>{
let config,loaded=false,loading=false,tools,launcher,status,statusMessage;
const initialChatOff=new URL(location.href).searchParams.get('relay_chat')==='off';
const T=text=>window.RelayI18n?.t(text)||text;
const admin=()=>location.pathname.startsWith('/admin');
function message(text){statusMessage=text;status.hidden=false;status.textContent=T(text)}
function settings(){const dialog=document.createElement('dialog');dialog.className='relay-chat-dialog';dialog.innerHTML='<h2 data-relay-ui>Chat settings</h2><p data-relay-ui>Smartsupp is an external chat service. Loading it shares browser and page information with that provider. Do not send passwords or payment credentials.</p><div class="chat-actions"><button data-chat-close data-relay-ui>Close</button><button data-chat-disable data-relay-ui>Disable chat and reload</button></div>';document.body.append(dialog);dialog.querySelector('[data-chat-close]').onclick=()=>dialog.close();dialog.querySelector('[data-chat-disable]').onclick=()=>{try{sessionStorage.setItem('relay.chat.disabled.v1','1')}catch{}const url=new URL(location.href);url.searchParams.set('relay_chat','off');location.replace(url)};dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();window.RelayI18n?.apply()}
function load(){if(loaded||loading)return;loading=true;launcher.disabled=true;message('Loading live chat…');
 window._smartsupp={...(window._smartsupp||{}),key:config.smartsupp_key};
 if(!window.smartsupp){const stub=function(){stub._.push(arguments)};stub._=[];window.smartsupp=stub}
 // Optional analytics/marketing are not granted by this integration. Disable recording in the dashboard too.
 window.smartsupp('analyticsConsent',false);window.smartsupp('marketingConsent',false);
 const script=document.createElement('script');script.src='https://www.smartsuppchat.com/loader.js?';script.async=true;script.charset='utf-8';script.referrerPolicy='origin';let timer;
 const fail=()=>{if(!loading)return;loading=false;launcher.disabled=false;message('Chat unavailable. Please try again later.');script.remove();delete window.smartsupp;};
 timer=setTimeout(fail,20000);script.onerror=()=>{clearTimeout(timer);fail()};script.onload=()=>{clearTimeout(timer);if(!loading)return;loading=false;loaded=true;launcher.disabled=false;launcher.textContent=T('Chat settings');message('Chat loaded');};document.head.append(script);
}
async function boot(){try{const r=await fetch('/api/site-tools',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;config=await r.json();if(!config.smartsupp_key||admin()&&!config.smartsupp_admin_enabled)return;
 tools=document.createElement('div');tools.className='relay-chat-tools';tools.setAttribute('data-relay-no-translate','');tools.innerHTML='<button type="button" class="relay-chat-launch">'+T('Live chat')+'</button><span class="relay-chat-status" role="status" hidden></span>';document.body.append(tools);launcher=tools.querySelector('button');status=tools.querySelector('[role=status]');launcher.onclick=()=>{status.hidden=false;if(loaded){settings();return}try{sessionStorage.removeItem('relay.chat.disabled.v1')}catch{}const url=new URL(location.href);url.searchParams.delete('relay_chat');history.replaceState(null,'',url);load()};window.addEventListener('relay:language',()=>{launcher.textContent=T(loaded?'Chat settings':'Live chat');if(statusMessage)message(statusMessage)});let optedOut=initialChatOff;try{optedOut=optedOut||sessionStorage.getItem('relay.chat.disabled.v1')==='1'}catch{}if(!optedOut)load();}catch{/* Optional chat must never prevent tracking or sign-in. */}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();


;
// /assets/quote-admin.js
'use strict';
(()=>{
const $=id=>document.getElementById(id),T=s=>window.RelayI18n?.t(s)||s,E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let offset=0,total=0,current=null,seq=0;
async function api(path,options={}){const r=await fetch('/api/admin/quotes'+path,{credentials:'same-origin',cache:'no-store',...options,headers:{'Content-Type':'application/json','X-Relay-Client':'web',...options.headers}});const data=await r.json();if(!r.ok)throw Error(r.status===401?'Administrator sign-in required. Open the admin workspace and sign in.':typeof data.detail==='string'?data.detail:'Check your changes and try again.');return data}
function notice(text){$('quoteAdminMessage').textContent=T(text)}
async function load(){const ticket=++seq;$('quoteInboxRefresh').disabled=true;notice('Loading quote requests…');try{const result=await api('?offset='+offset+'&limit=25&status='+encodeURIComponent($('quoteStatusFilter').value));if(ticket!==seq)return;total=result.total;$('quoteRows').innerHTML=result.items.map(q=>`<tr><td><button class="text-button" data-review="${E(q.id)}">${E(q.reference)}</button><small>${E(new Date(q.created_at).toLocaleString())}</small></td><td>${E(q.name)}<small>${E(q.email)}</small></td><td>${E(q.origin)} → ${E(q.destination)}</td><td>${E(q.mode)} · ${E(q.weight)} kg</td><td><span data-relay-enum>${E(q.status==='new'?'New':q.status==='reviewing'?'Reviewing':q.status==='quoted'?'Quoted':'Closed')}</span></td></tr>`).join('');$('quoteRows').querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>detail(b.dataset.review));$('quotePage').textContent=(offset+1)+'–'+Math.min(offset+25,total)+' / '+total;$('quotePrev').disabled=offset===0;$('quoteNext').disabled=offset+25>=total;notice(result.items.length?'':'No quote requests found.')}catch(e){notice(e.message)}finally{$('quoteInboxRefresh').disabled=false}}
async function detail(id){notice('Loading quote request…');try{current=await api('/'+id);const q=current;$('quoteDetail').hidden=false;$('quoteDetail').innerHTML=`<h2>${E(q.reference)}</h2><dl>${[['Name',q.name],['Email',q.email],['Phone',q.phone||'—'],['Origin',q.origin],['Destination',q.destination],['Shipping method',q.mode],['Type of shipment',q.category],['Weight (kg)',q.weight]].map(([k,v])=>`<dt data-relay-ui>${E(k)}</dt><dd>${E(v)}</dd>`).join('')}</dl><h3 data-relay-ui>Customer notes</h3><pre>${E(q.notes||'—')}</pre><form id="quoteReview"><label><span data-relay-ui>Status</span><select name="status">${['new','reviewing','quoted','closed'].map(s=>`<option value="${s}" ${s===q.status?'selected':''} data-relay-enum>${s==='new'?'New':s==='reviewing'?'Reviewing':s==='quoted'?'Quoted':'Closed'}</option>`).join('')}</select></label><label><span data-relay-ui>Amount</span><input name="amount" type="number" min="0" step="0.01" value="${E(q.amount??'')}"></label><label><span data-relay-ui>Currency</span><select name="currency">${['USD','GBP','EUR','NGN','CAD','AUD','AED','CNY','JPY','CHF','ZAR','SGD','GHS','KES','INR','BRL'].map(c=>`<option ${c===q.currency?'selected':''}>${c}</option>`).join('')}</select></label><label><span data-relay-ui>Internal review note</span><textarea name="admin_note" rows="4" maxlength="2000">${E(q.admin_note)}</textarea></label><p data-relay-ui>Review records are private. Saving a quote does not email the customer, book a shipment or create a payment request.</p><div><button type="submit" class="button primary" data-relay-ui>Save review</button> <button type="button" class="button ghost" id="closeQuoteDetail" data-relay-ui>Close</button></div><div id="quoteReviewMessage" role="status"></div></form><h3 data-relay-ui>Review history</h3>${q.history.map(a=>`<article><strong data-relay-enum>${E(a.status)}</strong> · ${E(new Date(a.created_at).toLocaleString())}<pre>${E(a.note)}</pre></article>`).join('')}`;$('closeQuoteDetail').onclick=()=>{$('quoteDetail').hidden=true};$('quoteReview').onsubmit=save;notice('');$('quoteDetail').scrollIntoView({block:'start'});window.RelayI18n?.apply()}catch(e){notice(e.message)}}
async function save(e){e.preventDefault();const form=e.target,b=form.querySelector('button[type=submit]');b.disabled=true;const values=Object.fromEntries(new FormData(form));values.amount=values.amount===''?null:values.amount;values.expected_version=current.version;try{await api('/'+current.id,{method:'PUT',body:JSON.stringify(values)});await load();await detail(current.id);$('quoteReviewMessage').textContent=T('Review saved. Contact the customer separately to share your quotation.')}catch(error){$('quoteReviewMessage').textContent=error.message}finally{b.disabled=false}}
$('quoteInboxRefresh').onclick=load;$('quoteStatusFilter').onchange=()=>{offset=0;load()};$('quotePrev').onclick=()=>{offset=Math.max(0,offset-25);load()};$('quoteNext').onclick=()=>{offset+=25;load()};load();
})();
