
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
function boot(){const holder=document.createElement('div');holder.className='relay-language';holder.innerHTML='<select data-relay-language aria-label="Language" dir="ltr"><option value="en" lang="en">English</option><option value="fr" lang="fr">Français</option><option value="es" lang="es">Español</option><option value="ar" lang="ar">العربية</option><option value="pt" lang="pt">Português</option><option value="de" lang="de">Deutsch</option><option value="it" lang="it">Italiano</option><option value="nl" lang="nl">Nederlands</option><option value="zh" lang="zh">简体中文</option><option value="ja" lang="ja">日本語</option><option value="hi" lang="hi">हिन्दी</option></select>';holder.title='Interface labels only. Shipment notes remain as entered.';holder.setAttribute('data-relay-attributes','');const target=document.querySelector('.nav-tools')||document.querySelector('main .topbar .right')||document.querySelector('main .topbar')||document.querySelector('header');(target||document.body).append(holder);holder.querySelector('select').addEventListener('change',e=>setLanguage(e.target.value));
 new MutationObserver(queue).observe(document.body,{childList:true,characterData:true,subtree:true});
 apply();fetch('/assets/languages.json',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('Unavailable');return r.json()}).then(data=>{catalog=data;apply()}).catch(()=>{holder.title='Translations unavailable. English labels remain available.'});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();


;
// /assets/livechat.js
"use strict";
(() => {
  // Smartsupp supplies its own chat widget. No custom launcher/settings UI.
  const initialChatOff =
    new URL(location.href).searchParams.get("relay_chat") === "off";
  async function boot() {
    try {
      let optedOut = initialChatOff;
      try {
        optedOut ||= sessionStorage.getItem("relay.chat.disabled.v1") === "1";
      } catch {}
      if (optedOut || window.__relaySmartsuppStarted) return;
      const response = await fetch("/api/site-tools", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) return;
      const config = await response.json();
      if (
        !config.smartsupp_key ||
        (location.pathname.startsWith("/admin") &&
          !config.smartsupp_admin_enabled) ||
        window.__relaySmartsuppStarted
      )
        return;
      window.__relaySmartsuppStarted = true;
      window._smartsupp = {
        ...(window._smartsupp || {}),
        key: config.smartsupp_key,
      };
      if (!window.smartsupp) {
        const stub = function () {
          stub._.push(arguments);
        };
        stub._ = [];
        window.smartsupp = stub;
      }
      window.smartsupp("analyticsConsent", false);
      window.smartsupp("marketingConsent", false);
      // Recording/privacy settings still require review in the provider dashboard.
      const script = document.createElement("script");
      script.src = "https://www.smartsuppchat.com/loader.js?";
      script.async = true;
      script.charset = "utf-8";
      script.referrerPolicy = "origin";
      script.dataset.relaySmartsupp = "true";
      script.onerror = () => {
        script.remove();
        console.warn("Optional live chat could not load.");
      };
      document.head.append(script);
    } catch {
      /* Optional chat must never prevent tracking or administrator sign-in. */
    }
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();


;
// /assets/business.js
'use strict';
(()=>{
const T=s=>window.RelayI18n?.t(s)||s;
async function support(){const target=document.getElementById('businessSupport');if(!target)return;try{const r=await fetch('/api/config',{cache:'no-store'});const data=await r.json();if(data.support_email){const a=document.createElement('a');a.href='mailto:'+data.support_email;a.textContent=data.support_email;target.append(a)}}catch{}}
async function quotes(){const form=document.getElementById('quoteForm');if(!form)return;const button=document.getElementById('quoteSubmit'),message=document.getElementById('quoteMessage'),availability=document.getElementById('quoteAvailability');let requestId=crypto.randomUUID(),token='',widget=null,busy=false,accepted=false;
 const say=s=>message.textContent=T(s);
 const activate=()=>{button.disabled=busy||accepted||Boolean(config.turnstile_site_key&&!token)};let config;
 try{const r=await fetch('/api/quote-config',{cache:'no-store'});if(!r.ok)throw Error('Unavailable');config=await r.json();if(!config.accepting_requests){availability.textContent=T('Online quote requests are temporarily unavailable. Please contact your shipping contact.');return}
 if(config.turnstile_site_key){availability.textContent=T('Complete the security check before sending your request.');window.relayQuoteChallengeReady=()=>{if(!form.isConnected)return;widget=turnstile.render('#quoteChallenge',{sitekey:config.turnstile_site_key,action:'quote',theme:'light',callback:value=>{token=value;activate()},'expired-callback':()=>{token='';activate()},'error-callback':()=>{token='';activate();say('Security check unavailable. Please retry later.')}})};const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=relayQuoteChallengeReady&render=explicit';script.async=true;script.defer=true;script.onerror=()=>say('Security check unavailable. Please retry later.');document.head.append(script)}else{availability.textContent=T('Development-only quote submission. Not a confirmed booking.');activate()}
 form.addEventListener('input',()=>{if(accepted){accepted=false;requestId=crypto.randomUUID();activate()}});
 form.onsubmit=async e=>{e.preventDefault();if(busy||accepted||!form.reportValidity())return;busy=true;activate();say('Sending your request…');const values=Object.fromEntries(new FormData(form));values.consent=form.elements.consent.checked;values.request_id=requestId;values.turnstile_token=token;
 try{const response=await fetch('/api/quotes',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Relay-Client':'web'},body:JSON.stringify(values)});let data;try{data=await response.json()}catch{throw Error('Unable to submit the request. Please try again.')}if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'Check the form details and try again.');accepted=true;message.replaceChildren();message.className='quote-wide quote-success';const title=document.createElement('p');title.textContent=T('Request received. Keep this reference:');const ref=document.createElement('strong');ref.textContent=data.reference;const detail=document.createElement('p');detail.textContent=T('Operations will review your request. This is not a booking or a confirmed price.');message.append(title,ref,detail);availability.textContent=T('Your request has been saved. No email confirmation is sent automatically.');}
 catch(error){say(error.message)}finally{busy=false;token='';if(widget!==null&&window.turnstile)turnstile.reset(widget);activate()}}
 }catch{availability.textContent=T('Online quote requests are temporarily unavailable. Please contact your shipping contact.')}
}
support();quotes();
})();


;
// /assets/public-menu.js
"use strict";
(() => {
  const button = document.getElementById("publicMenuToggle"),
    panel = document.getElementById("publicMobileNav");
  if (!button || !panel) return;
  const T = (text) => window.RelayI18n?.t(text) || text;
  const heading = document.createElement("div");
  heading.className = "public-drawer-heading";
  const title = document.createElement("span");
  title.textContent = "Navigation";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "public-drawer-close";
  closeButton.setAttribute("aria-label", T("Close navigation"));
  closeButton.textContent = "×";
  heading.append(title, closeButton);
  panel.prepend(heading);
  const backdrop = document.createElement("div");
  backdrop.className = "public-menu-backdrop";
  backdrop.hidden = true;
  backdrop.setAttribute("aria-hidden", "true");
  panel.parentElement.append(backdrop);
  let timer,
    inerted = [];
  const isOpen = () => button.getAttribute("aria-expanded") === "true";
  function lock() {
    let node = panel;
    while (
      node.parentElement &&
      node.parentElement !== document.documentElement
    ) {
      for (const sibling of node.parentElement.children) {
        if (
          sibling !== node &&
          sibling !== backdrop &&
          !["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)
        ) {
          inerted.push([sibling, sibling.inert]);
          sibling.inert = true;
        }
      }
      node = node.parentElement;
    }
  }
  function close(returnFocus = false) {
    const wasOpen = isOpen();
    clearTimeout(timer);
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", T("Open navigation"));
    panel.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    panel.inert = true;
    panel.removeAttribute("aria-modal");
    panel.removeAttribute("role");
    document.body.classList.remove("public-drawer-open");
    for (const [node, previous] of inerted) node.inert = previous;
    inerted = [];
    const hide = () => {
      panel.hidden = true;
      backdrop.hidden = true;
    };
    if (!wasOpen || matchMedia("(prefers-reduced-motion: reduce)").matches)
      hide();
    else timer = setTimeout(hide, 240);
    if (returnFocus && wasOpen) button.focus();
  }
  function open() {
    clearTimeout(timer);
    panel.hidden = false;
    panel.inert = false;
    backdrop.hidden = false;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", T("Close navigation"));
    lock();
    document.body.classList.add("public-drawer-open");
    void panel.offsetWidth;
    panel.classList.add("is-open");
    backdrop.classList.add("is-open");
    closeButton.focus();
  }
  button.addEventListener("click", () => (isOpen() ? close(true) : open()));
  closeButton.addEventListener("click", () => close(true));
  backdrop.addEventListener("click", () => close(true));
  document.addEventListener("keydown", (event) => {
    if (!isOpen()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      const items = [
        ...panel.querySelectorAll("a[href],button:not([disabled])"),
      ];
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  panel.addEventListener("click", (event) => {
    if (event.target.closest("a")) close();
  });
  matchMedia("(min-width:1201px)").addEventListener("change", (event) => {
    if (event.matches) close();
  });
  window.addEventListener("relay:language", () => {
    button.setAttribute(
      "aria-label",
      T(isOpen() ? "Close navigation" : "Open navigation"),
    );
    closeButton.setAttribute("aria-label", T("Close navigation"));
  });
})();
