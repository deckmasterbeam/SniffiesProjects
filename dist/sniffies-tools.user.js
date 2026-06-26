// ==UserScript==
// @name         Sniffies Tools Userscript
// @namespace    https://sniffies.com
// @author       Beam
// @version      0.1.0
// @description  Recreating and expanding features on top of Sniffies.com
// @match        https://sniffies.com/*
// @match        https://*.sniffies.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

"use strict";(()=>{var S=(t,s)=>{let n=navigator.geolocation;if(!n||n.__sniffiesPatched)return null;let p=n.getCurrentPosition.bind(n),a=n.watchPosition.bind(n),f=n.clearWatch.bind(n),l=new Map,i=r=>{let e=t();if(!e?.enabled)return console.log("[sniffies-geo] override disabled, passing real coords",r.coords),r;let u={coords:{latitude:e.latitude,longitude:e.longitude,accuracy:10,altitude:null,altitudeAccuracy:null,heading:null,speed:null},timestamp:Date.now()};return console.log("[sniffies-geo] applying override",u.coords),u},o=r=>e=>{s?.({latitude:e.coords.latitude,longitude:e.coords.longitude}),r(i(e))};n.getCurrentPosition=(r,e,u)=>{console.log("[sniffies-geo] getCurrentPosition intercepted"),p(o(r),e,u)},n.watchPosition=(r,e,u)=>{console.log("[sniffies-geo] watchPosition intercepted");let g=o(r),m=a(g,e,u);return l.set(m,g),m},n.clearWatch=r=>{l.delete(r),f(r)};let d=()=>{l.size!==0&&p(r=>{for(let e of l.values())e(r)},void 0,{maximumAge:0})};return n.__sniffiesPatched=!0,{nativeGetCurrentPosition:p,nativeWatchPosition:a,refreshWatches:d}};var E=`<details class="section collapsible" id="geo-details">
  <summary><h2>Location Spoofing</h2></summary>
  <div class="collapsible-body">
    <p class="hint">Spoof the coordinates Sniffies sees.</p>
    <label class="row">
      <input id="geo-enabled" type="checkbox" />
      <span>Enable</span>
    </label>
    <div id="geo-fields">
      <label class="field">
        <span>Latitude</span>
        <input id="geo-lat" type="number" step="any" placeholder="47.61477" autocomplete="off" />
      </label>
      <label class="field">
        <span>Longitude</span>
        <input id="geo-lng" type="number" step="any" placeholder="-122.32525" autocomplete="off" />
      </label>
      <button id="geo-fill-current" class="secondary" type="button">Fill with current</button>
      <div class="actions">
        <button id="geo-save" class="primary" type="button">Save</button>
      </div>
      <p id="geo-status" class="hint" aria-live="polite"></p>
    </div>
  </div>
</details>
`;var O=`/* Section shell \u2014 lifted from popup.css .section, details.collapsible, .collapsible-body */

#snp-geo-root .section {
  background: #0e1825;
  border: 1px solid #1c2b3a;
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

#snp-geo-root .section h2 {
  margin: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #7a90a4;
}

#snp-geo-root details.collapsible {
  padding: 0;
  display: block;
}

#snp-geo-root details.collapsible summary {
  list-style: none;
  cursor: pointer;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}

#snp-geo-root details.collapsible summary::-webkit-details-marker {
  display: none;
}

#snp-geo-root details.collapsible summary::after {
  content: "\u203A";
  margin-left: auto;
  font-size: 16px;
  line-height: 1;
  color: #7a90a4;
  transform: rotate(90deg);
  transition: transform 0.15s;
}

#snp-geo-root details.collapsible[open] summary::after {
  transform: rotate(270deg);
}

#snp-geo-root details.collapsible summary h2 {
  margin: 0;
}

#snp-geo-root .collapsible-body {
  padding: 0 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Form fields \u2014 lifted from popup.css .row, .hint, .field, button.primary/secondary, .actions */

#snp-geo-root .row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
  color: #ffffff;
}

#snp-geo-root .row input[type="checkbox"] {
  accent-color: #ff5500;
  width: 14px;
  height: 14px;
}

#snp-geo-root .hint {
  font-size: 11px;
  color: #7a90a4;
  margin: 0;
}

#snp-geo-root button.primary {
  font-size: 12px;
  font-weight: 700;
  padding: 7px 16px;
  border-radius: 20px;
  border: none;
  background: #ff5500;
  color: #fff;
  cursor: pointer;
  letter-spacing: 0.02em;
  transition: background 0.15s;
}

#snp-geo-root button.primary:hover:not(:disabled) {
  background: #e04a00;
}

#snp-geo-root button.primary:disabled {
  background: #1c2b3a;
  color: #7a90a4;
  cursor: not-allowed;
}

#snp-geo-root button.secondary {
  font-size: 12px;
  font-weight: 600;
  padding: 7px 16px;
  border-radius: 20px;
  border: 1px solid #1c2b3a;
  background: transparent;
  color: #7a90a4;
  cursor: pointer;
  transition:
    border-color 0.15s,
    color 0.15s;
}

#snp-geo-root button.secondary:hover:not(:disabled) {
  border-color: #7a90a4;
  color: #ffffff;
}

#snp-geo-root button.secondary:disabled {
  color: #1c2b3a;
  border-color: #1c2b3a;
  cursor: not-allowed;
}

#snp-geo-root .field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: #7a90a4;
}

#snp-geo-root .field input {
  font-size: 13px;
  padding: 7px 10px;
  border-radius: 6px;
  border: 1px solid #1c2b3a;
  background: #080e18;
  color: #ffffff;
  outline: none;
  transition: border-color 0.15s;
}

#snp-geo-root .field input::placeholder {
  color: #3a4f62;
}

#snp-geo-root .field input:focus {
  border-color: #ff5500;
}

#snp-geo-root .actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

#snp-geo-root #geo-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
`;var L=(t,s)=>{let n=c=>t.querySelector(`#${c}`),p=t.querySelector("#geo-details"),a=n("geo-enabled"),f=n("geo-fields"),l=n("geo-lat"),i=n("geo-lng"),o=n("geo-fill-current"),d=n("geo-save"),r=n("geo-status");if(p&&(s.initialOpen!==void 0&&(p.open=s.initialOpen),s.onToggle)){let c=s.onToggle;p.addEventListener("toggle",()=>c(p.open))}let e=c=>{r.textContent=c},u=()=>({enabled:a.checked,latitude:parseFloat(l.value)||0,longitude:parseFloat(i.value)||0}),g=null,m=c=>{let G={aborted:!1};g=G,e("Getting location\u2026"),s.getNativePosition(y=>{G.aborted||(g=null,l.value=String(y.coords.latitude),i.value=String(y.coords.longitude),v(),c())},y=>{G.aborted||(g=null,e(`Could not get location: ${y.message} (code ${y.code})`))},{timeout:1e4})},{initial:b}=s,x={...b},_=()=>{let c=u();return c.enabled===x.enabled&&c.latitude===x.latitude&&c.longitude===x.longitude},v=()=>{let c=l.value.trim()!==""&&i.value.trim()!=="";d.style.display=c&&!_()?"":"none"},k=()=>Promise.resolve(s.onSave(u())).then(()=>{x=u(),e("Saved."),v()});a.checked=b.enabled,f.style.display=b.enabled?"":"none",l.value=b.latitude!==0?String(b.latitude):"",i.value=b.longitude!==0?String(b.longitude):"",v(),a.addEventListener("change",()=>{f.style.display=a.checked?"":"none",v(),a.checked?g&&(g.aborted=!0,g=null,e("")):m(()=>{k()})});for(let c of[l,i])c.addEventListener("input",v);o.addEventListener("click",()=>{m(()=>e(""))}),d.addEventListener("click",()=>{k()})};var h={enabled:!1,latitude:0,longitude:0};var w=`#snp-fab {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 4px 6px;
  opacity: 0.85;
  transition: opacity 0.15s;
}
#snp-fab:hover {
  opacity: 1;
}

#snp-panel {
  position: fixed;
  top: 60px;
  right: 12px;
  z-index: 2147483647;
  width: 280px;
  background: #0e1825;
  border: 1px solid #1c2b3a;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  font-family:
    system-ui,
    -apple-system,
    "Segoe UI",
    sans-serif;
  color: #ffffff;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.snp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.snp-header h1 {
  font-size: 14px;
  font-weight: 700;
  margin: 0;
  letter-spacing: 0.01em;
}

.snp-close {
  background: transparent;
  border: none;
  color: #7a90a4;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  padding: 2px 4px;
  transition: color 0.15s;
}
.snp-close:hover {
  color: #fff;
}
`;var C=`<div class="snp-header">
  <h1>Sniffies Plug-ins</h1>
  <button class="snp-close" id="snp-close" type="button" aria-label="Close">\u2715</button>
</div>
<div id="snp-geo-root"></div>
`;if(!window.__sniffiesInjected){window.__sniffiesInjected=!0;let t=j();document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>P(t),{once:!0}):P(t)}var T="sniffies-geo",F=()=>{try{let t=localStorage.getItem(T);return t?{...h,...JSON.parse(t)}:{...h}}catch{return{...h}}},D=t=>{localStorage.setItem(T,JSON.stringify(t))},z=t=>{let s=document.querySelector('[title="Sitelinks"]');s?.parentElement?s.parentElement.insertBefore(t,s.nextSibling):document.body.appendChild(t)};function j(){let t=F(),s=S(()=>t),n=s?.nativeGetCurrentPosition??navigator.geolocation.getCurrentPosition.bind(navigator.geolocation),p=window.fetch.bind(window),a=null,f=null,l=i=>{let o={lat:i.latitude,lng:i.longitude};if(a)try{let d=JSON.parse(a.init.body??"{}");d.virtualLocation=o,d.physicalLocation=o,p(a.url,{...a.init,body:JSON.stringify(d)});return}catch{}f&&p(`${f}/api/visitor/current/location?state=loaded`,{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({virtualLocation:o,physicalLocation:o,homeDistanceInMiles:null})})};return window.fetch=async(i,o)=>{let d=typeof i=="string"?i:i instanceof URL?i.href:i.url,r=d.match(/^(https?:\/\/[^/]*sniffies\.com)/);if(r&&!f&&(f=r[1]??null),d.includes("/api/visitor/current/location")&&(a={url:d,init:{...o}},t.enabled))try{let e=JSON.parse(o?.body??"{}"),u={lat:t.latitude,lng:t.longitude};e.virtualLocation=u,e.physicalLocation=u,o={...o,body:JSON.stringify(e)}}catch{}return p(i,o)},{currentOverride:t,hook:s,nativeGetCurrentPosition:n,sendLocationUpdate:l}}function P(t){let{hook:s,nativeGetCurrentPosition:n,sendLocationUpdate:p}=t,a=t.currentOverride,f=document.createElement("style");f.textContent=w,document.head.appendChild(f);let l=document.createElement("style");l.textContent=O,document.head.appendChild(l);let i=document.createElement("button");i.id="snp-fab",i.title="Sniffies Tools",i.textContent="\u{1F4CD}",z(i);let o=document.createElement("div");o.id="snp-panel",o.style.display="none",o.innerHTML=C,document.body.appendChild(o);let d=o.querySelector("#snp-geo-root");d.innerHTML=E,L(d,{initial:a,onSave:e=>{D(e),a=e,s?.refreshWatches(),e.enabled&&p(e)},getNativePosition:n});let r=o.querySelector("#snp-close");i.addEventListener("click",()=>{o.style.display=o.style.display==="none"?"block":"none"}),r.addEventListener("click",()=>{o.style.display="none"})}})();
