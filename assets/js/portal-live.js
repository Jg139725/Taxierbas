(() => {
"use strict";
const db=window.taxiSupabase; console.info("Taxi Erbas Portal Version 13.8 geladen");
let mobileSyncTimer=null;
let realtimeWatchdogTimer=null;
let mobileSyncStarted=false;
let dataLoadInFlight=null;
let session=null,profile=null,rides=[],fleet=[],drivers=[],series=[],ridePassengers=[],rideConfirmations=[],realtimeChannel=null,clockTimer=null;
let calendarCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1),selectedCalendarDate=null,knownRideIds=new Set();
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const isoDate=d=>{const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)};
const formatDate=d=>!d?"–":new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(d+"T12:00:00"));
const canDispatch=()=>["admin","dispatcher"].includes(profile?.role);
const rideDriverIds=r=>Array.isArray(r.assigned_drivers)&&r.assigned_drivers.length?r.assigned_drivers:(r.assigned_driver?[r.assigned_driver]:[]);
const rideDriverNames=r=>Array.isArray(r.driver_names)&&r.driver_names.length?r.driver_names:(r.driver_name?[r.driver_name]:[]);
const driverLabel=r=>rideDriverNames(r).length?rideDriverNames(r).join(" + "):"Fahrer offen";
const officeConfirmationFor=(rideId,driverId)=>
  (rideConfirmations||[]).find(c=>c.ride_id===rideId&&c.driver_id===driverId);

function officeConfirmationInfo(rideId,driverId){
  const c=officeConfirmationFor(rideId,driverId);
  if(!c)return {label:"Noch offen",className:"pending"};
  if(c.status==="confirmed")return {label:"Bestätigt",className:"confirmed"};
  if(c.status==="declined")return {label:"Abgelehnt",className:"declined"};
  return {label:"Noch offen",className:"pending"};
}

function officeConfirmationList(ride){
  const ids=rideDriverIds(ride);
  if(!ids.length)return '<span class="office-confirm-empty">Kein Fahrer zugewiesen</span>';

  return `<div class="office-confirm-list">${ids.map(id=>{
    const d=drivers.find(x=>x.id===id);
    const info=officeConfirmationInfo(ride.id,id);
    return `<span class="office-confirm-item ${info.className}">
      <strong>${escapeHtml(d?.full_name||"Fahrer")}</strong>
      <em>${info.label}</em>
    </span>`;
  }).join("")}</div>`;
}

function officeOverallConfirmation(ride){
  const ids=rideDriverIds(ride);
  if(!ids.length)return {label:"Ohne Fahrer",className:"neutral"};
  const states=ids.map(id=>officeConfirmationInfo(ride.id,id).className);
  if(states.includes("declined"))return {label:"Fahrer abgelehnt",className:"declined"};
  if(states.every(s=>s==="confirmed"))return {label:"Alle bestätigt",className:"confirmed"};
  return {label:"Bestätigung offen",className:"pending"};
}

const isMine=r=>profile?.role!=="driver"||rideDriverIds(r).includes(profile.id);
const myConfirmation=r=>rideConfirmations.find(c=>c.ride_id===r.id&&c.driver_id===profile?.id);
const confirmationLabel=r=>{
  const c=myConfirmation(r);
  if(!c)return "Noch nicht bestätigt";
  if(c.status==="confirmed")return "Bestätigt";
  if(c.status==="declined")return "Abgelehnt";
  return "Noch nicht bestätigt";
};
const driverTodayRides=()=>{
  const today=isoDate(new Date());
  return rides.filter(r=>isMine(r)&&r.ride_date===today)
    .sort((a,b)=>String(a.ride_time||"").localeCompare(String(b.ride_time||"")));
};
const driverVehiclesToday=()=>{
  const ids=new Set(driverTodayRides().map(r=>r.vehicle_id).filter(Boolean));
  return fleet.filter(v=>ids.has(v.id));
};

let selectedDriverDetailRideId=null;

async function confirmDriverRide(rideId){
  const {error}=await db.from("ride_confirmations").upsert({
    ride_id:rideId,
    driver_id:profile.id,
    status:"confirmed",
    confirmed_at:new Date().toISOString()
  },{onConflict:"ride_id,driver_id"});
  if(error){alert("Fahrt konnte nicht bestätigt werden: "+error.message);return false}

  await new Promise(resolve=>setTimeout(resolve,250));
  await loadData();

  return true
}


function encodeMapsPoint(value){
  return encodeURIComponent(String(value||"").trim())
}

function buildGoogleMapsRoute(ride,coords){
  const passengers=ridePassengers
    .filter(p=>p.ride_id===ride.id)
    .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));

  const origin=coords?`${coords.latitude},${coords.longitude}`:"";
  let destination=ride.destination||"";
  let waypoints=[];

  if(ride.ride_mode==="group"&&passengers.length){
    const points=[];
    passengers.forEach(p=>{
      if(p.pickup)points.push(p.pickup);
      if(p.destination)points.push(p.destination)
    });

    if(points.length){
      destination=points[points.length-1];
      waypoints=points.slice(0,-1)
    }
  }else{
    if(ride.pickup)waypoints=[ride.pickup]
  }

  const params=new URLSearchParams({
    api:"1",
    travelmode:"driving",
    destination
  });

  if(origin)params.set("origin",origin);
  if(waypoints.length)params.set("waypoints",waypoints.join("|"));

  return `https://www.google.com/maps/dir/?${params.toString()}`
}

function openGoogleMapsNavigation(ride){
  if(!ride)return;

  const openRoute=coords=>{
    const url=buildGoogleMapsRoute(ride,coords);
    window.open(url,"_blank","noopener,noreferrer")
  };

  if(!navigator.geolocation){
    openRoute(null);
    return
  }

  navigator.geolocation.getCurrentPosition(
    position=>{
      openRoute({
        latitude:position.coords.latitude,
        longitude:position.coords.longitude
      })
    },
    ()=>{
      const proceed=confirm(
        "Dein aktueller Standort konnte nicht gelesen werden. Soll die Route trotzdem in Google Maps geöffnet werden? Google Maps kann deinen Standort dort selbst verwenden."
      );
      if(proceed)openRoute(null)
    },
    {
      enableHighAccuracy:true,
      timeout:10000,
      maximumAge:60000
    }
  )
}

function openDriverRideDetail(ride){
  if(!ride)return;
  selectedDriverDetailRideId=ride.id;
  const c=myConfirmation(ride);
  const confirmed=c?.status==="confirmed";
  const passengers=ridePassengers.filter(p=>p.ride_id===ride.id).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));

  $("#driver-detail-title").textContent=`${(ride.ride_time||"").slice(0,5)} Uhr · ${ride.customer_name||"Fahrt"}`;
  $("#driver-detail-content").innerHTML=`
    <div class="driver-detail-status">
      <span class="${badgeClass(ride.status)}">${escapeHtml(ride.status)}</span><span class="office-overall-confirm ${officeOverallConfirmation(ride).className}">${officeOverallConfirmation(ride).label}</span>
      <span class="confirmation-pill ${confirmed?"confirmed":c?.status==="declined"?"declined":"pending"}">${escapeHtml(confirmationLabel(ride))}</span>
    </div>

    <div class="driver-detail-grid">
      <div class="driver-detail-card"><small>Datum & Uhrzeit</small><strong>${formatDate(ride.ride_date)} · ${(ride.ride_time||"").slice(0,5)} Uhr</strong></div>
      <div class="driver-detail-card"><small>Fahrtart</small><strong>${escapeHtml(ride.ride_type||"Taxifahrt")}</strong></div>
      <div class="driver-detail-card full"><small>Kunde / Fahrgast</small><strong>${escapeHtml(ride.customer_name||"–")}</strong>${ride.customer_phone?`<span>📞 ${escapeHtml(ride.customer_phone)}</span>`:""}</div>
      <div class="driver-detail-card full"><small>Route</small><strong>📍 ${escapeHtml(ride.pickup||"–")}</strong><span class="route-down">↓</span><strong>🏁 ${escapeHtml(ride.destination||"–")}</strong></div>
      <div class="driver-navigation-card full">
        <div>
          <small>Navigation</small>
          <strong>Aktueller Standort → Abholung → Ziel</strong>
          <span>${ride.ride_mode==="group"?"Alle eingetragenen Personen und Stopps werden der Reihe nach übernommen.":"Google Maps übernimmt Abholort und Ziel automatisch."}</span>
        </div>
        <button type="button" class="maps-navigation-btn" data-start-google-navigation="${ride.id}">
          🗺️ Navigation starten
        </button>
      </div>
      <div class="driver-detail-card"><small>Fahrzeug</small><strong>${escapeHtml(ride.vehicle_name||"Noch offen")}</strong></div>
      <div class="driver-detail-card"><small>Fahrer</small><strong>${escapeHtml(driverLabel(ride))}</strong></div>
      ${ride.note?`<div class="driver-detail-card full"><small>Hinweis</small><strong>${escapeHtml(ride.note)}</strong></div>`:""}
    </div>

    ${passengers.length?`
      <div class="driver-detail-card full">
        <small>Personen dieser Mehrpersonenfahrt</small>
        <div class="driver-passenger-list">
          ${passengers.map((p,i)=>`
            <div class="driver-passenger-row">
              <strong>${i+1}. ${escapeHtml(p.name||p.customer_name||"Person")}</strong>
              ${p.phone?`<span>📞 ${escapeHtml(p.phone)}</span>`:""}
              <span>📍 ${escapeHtml(p.pickup)} → ${escapeHtml(p.destination)}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `:""}
  `;


  const mapsBtn=$("[data-start-google-navigation]");
  if(mapsBtn){
    mapsBtn.onclick=()=>{
      const currentRide=rides.find(r=>r.id===mapsBtn.dataset.startGoogleNavigation);
      openGoogleMapsNavigation(currentRide)
    }
  }

  const btn=$("#driver-detail-confirm");
  btn.style.display=confirmed?"none":"";
  btn.disabled=false;
  btn.textContent="✓ Fahrt bestätigen";
  $("#driver-ride-detail-dialog").showModal()
}

function bindDriverRideDetails(){
  $$("[data-driver-ride-detail]").forEach(el=>{
    el.onclick=e=>{
      if(e.target.closest("[data-confirm-ride]")||e.target.closest("[data-quick-navigation]")||e.target.closest("select"))return;
      openDriverRideDetail(rides.find(r=>r.id===el.dataset.driverRideDetail))
    }
  })
}

function showError(m){$("#login-error").textContent=m||"Es ist ein Fehler aufgetreten."}
function badgeClass(v){if(["Werkstatt","Nicht verfügbar","Reinigung erforderlich","Reserve"].includes(v))return"badge danger";if(["Unterwegs","Leicht verschmutzt","¼ voll","Halbvoll","Offen"].includes(v))return"badge warn";return"badge"}
async function loadProfile(){const{data,error}=await db.from("profiles").select("id,full_name,role,active").eq("id",session.user.id).single();if(error)throw new Error("Mitarbeiterprofil konnte nicht geladen werden.");if(!data.active)throw new Error("Dieser Mitarbeiterzugang wurde deaktiviert.");profile=data}
async function refreshRecurring(){if(!canDispatch())return;try{await db.rpc("refresh_recurring_occurrences",{p_until:isoDate(new Date(Date.now()+365*86400000))})}catch(e){console.warn("Serienfahrten konnten nicht aktualisiert werden",e)}}
async function coreLoadData(){
await refreshRecurring();
const calls=[
  db.from("rides").select("*").order("ride_date").order("ride_time"),
  db.from("vehicles").select("*").order("name"),
  db.from("ride_passengers").select("*").order("sort_order"),
  db.from("ride_confirmations").select("*")
];
if(canDispatch()){
  calls.push(
    db.from("profiles").select("id,full_name,role,active").eq("role","driver").order("full_name"),
    db.from("recurring_series").select("*").order("title")
  )
}
const results=await Promise.all(calls);
if(results[0].error)throw results[0].error;
if(results[1].error)throw results[1].error;
rides=results[0].data||[];
fleet=results[1].data||[];
ridePassengers=results[2].error?[]:(results[2].data||[]);
if(results[3].error){
  console.error("Bestätigungsstatus konnte nicht geladen werden:",results[3].error);
  rideConfirmations=[];
}else{
  rideConfirmations=results[3].data||[];
}
drivers=canDispatch()&&!results[4]?.error?(results[4].data||[]):[];
series=canDispatch()&&!results[5]?.error?(results[5].data||[]):[];
knownRideIds=new Set(rides.map(r=>r.id));
renderAll()
}
async function loadData(){
  if(dataLoadInFlight)return dataLoadInFlight;
  dataLoadInFlight=coreLoadData().catch(error=>{
    console.error("Taxi Erbas Daten-Sync fehlgeschlagen:",error);
    throw error;
  }).finally(()=>{dataLoadInFlight=null});
  return dataLoadInFlight;
}
function subscribeRealtime(){
  if(realtimeChannel)db.removeChannel(realtimeChannel);

  const refresh=()=>loadData().catch(error=>console.warn("Realtime-Nachladen fehlgeschlagen",error));

  realtimeChannel=db.channel("taxi-erbas-live-13-8")
    .on("postgres_changes",{event:"*",schema:"public",table:"rides"},payload=>{notifyRide(payload);refresh()})
    .on("postgres_changes",{event:"*",schema:"public",table:"vehicles"},refresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"profiles"},refresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"recurring_series"},refresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"ride_confirmations"},refresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"ride_passengers"},refresh)
    .subscribe(status=>{
      console.info("Taxi Erbas Realtime:",status);

      if(status==="SUBSCRIBED"){
        refresh();
        return;
      }

      if(status==="CHANNEL_ERROR" || status==="TIMED_OUT" || status==="CLOSED"){
        console.warn("Realtime getrennt – erneuter Verbindungsversuch läuft.");
        clearTimeout(realtimeWatchdogTimer);
        realtimeWatchdogTimer=setTimeout(()=>{
          if(session && navigator.onLine)subscribeRealtime();
        },3000);
      }
    });
}

function startMobileSync(){
  if(mobileSyncStarted)return;
  mobileSyncStarted=true;

  if(mobileSyncTimer)clearInterval(mobileSyncTimer);
  mobileSyncTimer=setInterval(()=>{
    if(session && document.visibilityState==="visible" && navigator.onLine){
      loadData().catch(()=>{});
    }
  },5000);

  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible" && session){
      loadData().catch(()=>{});
    }
  });

  window.addEventListener("focus",()=>{
    if(session)loadData().catch(()=>{});
  });

  window.addEventListener("pageshow",()=>{
    if(session)loadData().catch(()=>{});
  });

  window.addEventListener("online",()=>{
    document.body.classList.remove("portal-offline");
    if(session){
      subscribeRealtime();
      loadData().catch(()=>{});
    }
  });

  window.addEventListener("offline",()=>{
    document.body.classList.add("portal-offline");
  });
}
function startClock(){const f=()=>{const n=new Date();if($("#dispatch-clock"))$("#dispatch-clock").textContent=n.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});if($("#dispatch-date"))$("#dispatch-date").textContent=n.toLocaleDateString("de-DE",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"})};f();clearInterval(clockTimer);clockTimer=setInterval(f,30000)}
function updateNotificationUI(){const b=$("#notification-button"),s=$("#notification-state");if(!b||!s)return;const state=Notification.permission;s.textContent=state==="granted"?"aktiv":state==="denied"?"im Browser blockiert":"nicht aktiviert";b.classList.toggle("notification-on",state==="granted")}
async function enableNotifications(){if(!("Notification"in window)){alert("Dieser Browser unterstützt Benachrichtigungen nicht.");return}const p=await Notification.requestPermission();updateNotificationUI();if(p==="granted"){const reg=await navigator.serviceWorker?.ready;reg?.showNotification("Taxi Erbas",{body:"Benachrichtigungen sind aktiviert.",icon:"assets/images/taxi-erbas-original-logo.png"})}}
async function openDashboard(){
startMobileSync();
document.body.dataset.portalRole=profile?.role||"";
document.body.classList.toggle("driver-portal",profile?.role==="driver");
document.body.classList.toggle("dispatch-portal",canDispatch());
$("#login-screen").classList.add("hidden");$("#dashboard").classList.remove("hidden");$("#role-label").textContent={admin:"Administrator",dispatcher:"Disponent",driver:"Fahrer"}[profile.role]||profile.role;$("#user-name").textContent=profile.full_name||session.user.email;$$('[data-open-ride],[data-open-vehicle],#open-recurring').forEach(b=>b.style.display=canDispatch()?"":"none");const dn=$(".dispatch-nav"),rn=$(".recurring-nav");if(!canDispatch()){dn.style.display="none";rn.style.display="none";$$('.nav-button').forEach(b=>b.classList.remove('active'));$$('.view').forEach(v=>v.classList.remove('active'));$('[data-view="overview"]').classList.add('active');$('#view-overview').classList.add('active');$('#page-title').textContent='Übersicht'}else startClock();updateNotificationUI();subscribeRealtime();await loadData()}
async function initialize(){
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("portal-sw.js").catch(console.warn);
  }

  try{
    const {data,error}=await db.auth.getSession();
    if(error)console.warn("Gespeicherte Sitzung konnte nicht gelesen werden:",error);
    session=data?.session||null;

    if(!session){
      $("#login-screen").classList.remove("hidden");
      $("#dashboard").classList.add("hidden");
      return;
    }

    // Wichtig: Bei einem kurzen Netzfehler NICHT automatisch ausloggen.
    try{
      await loadProfile();
      await openDashboard();
    }catch(error){
      console.error("Portal konnte mit gespeicherter Sitzung noch nicht vollständig geladen werden:",error);
      $("#login-screen").classList.add("hidden");
      $("#dashboard").classList.remove("hidden");
      setTimeout(async()=>{
        try{
          const check=await db.auth.getSession();
          if(check.data?.session){
            session=check.data.session;
            await loadProfile();
            await openDashboard();
          }
        }catch(retryError){console.warn("Portal-Retry fehlgeschlagen:",retryError)}
      },2000);
    }
  }catch(error){
    console.error("Initialisierung fehlgeschlagen:",error);
    $("#login-screen").classList.remove("hidden");
    $("#dashboard").classList.add("hidden");
  }
}
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();showError('');const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent='Anmeldung läuft …';const{data,error}=await db.auth.signInWithPassword({email:$('#login-user').value.trim(),password:$('#login-password').value});btn.disabled=false;btn.textContent='Portal öffnen';if(error){showError('Anmeldung fehlgeschlagen. Bitte E-Mail-Adresse und Passwort prüfen.');return}session=data.session;try{await loadProfile();await openDashboard()}catch(x){await db.auth.signOut();showError(x.message)}});
$('#logout-button').addEventListener('click',async()=>{if(realtimeChannel)await db.removeChannel(realtimeChannel);await db.auth.signOut();location.reload()});
$('#reset-demo').addEventListener('click',loadData);$('#notification-button').addEventListener('click',enableNotifications);$('#mobile-menu').addEventListener('click',()=>$('.sidebar').classList.toggle('open'));
$$('.nav-button').forEach(btn=>btn.addEventListener('click',()=>{$$('.nav-button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');$$('.view').forEach(v=>v.classList.remove('active'));$('#view-'+btn.dataset.view).classList.add('active');$('#page-title').textContent=btn.textContent;$('.sidebar').classList.remove('open');if(btn.dataset.view==='calendar')renderCalendar()}));
function driverState(d){const ar=rides.find(r=>rideDriverIds(r).includes(d.id)&&["Zugewiesen","Unterwegs"].includes(r.status));if(!d.active)return{label:'Deaktiviert',className:'offline',ride:null};if(ar?.status==='Unterwegs')return{label:'Unterwegs',className:'busy',ride:ar};if(ar)return{label:'Zugewiesen',className:'reserved',ride:ar};return{label:'Frei',className:'free',ride:null}}

function dispatchDriverConfirmation(ride){
  const ids=rideDriverIds(ride);
  if(!ids.length)return '<span class="dispatch-driver-confirm neutral">Kein Fahrer</span>';
  return ids.map(id=>{
    const d=drivers.find(x=>x.id===id);
    const index=rideDriverIds(ride).indexOf(id);
    const fallbackName=Array.isArray(ride.driver_names)?ride.driver_names[index]:null;
    const info=officeConfirmationInfo(ride.id,id);
    const icon=info.className==="confirmed"?"✓":info.className==="declined"?"✕":"•";
    return `<span class="dispatch-driver-confirm ${info.className}"><strong>${escapeHtml(d?.full_name||fallbackName||ride.driver_name||"Fahrer")}</strong><em>${icon} ${info.label}</em></span>`;
  }).join("");
}

function renderDispatch(){if(!canDispatch()||!$('#dispatch-rides'))return;const open=rides.filter(r=>r.status!=='Abgeschlossen'),active=rides.filter(r=>r.status==='Unterwegs'),freeV=fleet.filter(v=>v.status==='Verfügbar'),freeD=drivers.filter(d=>driverState(d).label==='Frei');$('#dispatch-open-count').textContent=open.length;$('#dispatch-free-vehicles').textContent=freeV.length;$('#dispatch-free-drivers').textContent=freeD.length;$('#dispatch-active-count').textContent=active.length;$('#dispatch-vehicles').innerHTML=fleet.length?fleet.map(v=>`<button class="dispatch-item dispatch-vehicle-item ${v.status==='Verfügbar'?'free':v.status==='Unterwegs'?'busy':'offline'}" data-edit-vehicle="${v.id}"><span class="vehicle-icon">🚕</span><span class="dispatch-item-copy"><strong>${escapeHtml(v.name)}</strong><small>${escapeHtml(v.plate)}</small><em>${escapeHtml(v.location)} · ${escapeHtml(v.fuel_level)}</em></span><span class="visual-status ${v.status==='Verfügbar'?'free':v.status==='Unterwegs'?'busy':'offline'}"><i></i>${escapeHtml(v.status)}</span></button>`).join(''):'<div class="empty">Noch keine Fahrzeuge.</div>';$('#dispatch-rides').innerHTML=open.length?open.map(r=>`<article class="dispatch-ride ${r.status==='Unterwegs'?'ride-active':r.status==='Zugewiesen'?'ride-assigned':'ride-open'}"><div class="dispatch-ride-time"><strong>${escapeHtml((r.ride_time||'').slice(0,5)||'–')}</strong><span>${formatDate(r.ride_date)}</span></div><div class="dispatch-route"><div class="route-point pickup"><i></i><span><small>Abholung</small><strong>${escapeHtml(r.pickup)}</strong></span></div><div class="route-line"></div><div class="route-point destination"><i></i><span><small>Ziel</small><strong>${escapeHtml(r.destination)}</strong></span></div></div><div class="dispatch-ride-copy"><strong>${escapeHtml(r.customer_name)}</strong><div><span>👨‍✈️ ${escapeHtml(driverLabel(r))}</span><span>🚕 ${escapeHtml(r.vehicle_name||'Fahrzeug offen')}</span>${r.is_recurring?'<span>↻ Serie</span>':''}</div></div><div class="dispatch-confirmation-line">${dispatchDriverConfirmation(r)}</div><div class="dispatch-ride-actions"><span class="${badgeClass(r.status)}">${escapeHtml(r.status)}</span><button data-edit-ride="${r.id}">Bearbeiten</button></div></article>`).join(''):'<div class="empty">Keine offenen Fahrten.</div>';$('#dispatch-drivers').innerHTML=drivers.length?drivers.map(d=>{const st=driverState(d);return`<article class="dispatch-item driver-item ${st.className}"><span class="driver-avatar">${escapeHtml((d.full_name||'?').charAt(0).toUpperCase())}</span><span class="dispatch-item-copy"><strong>${escapeHtml(d.full_name)}</strong><small>${st.ride?'Aktuell: '+escapeHtml(st.ride.destination):'Bereit für neue Fahrt'}</small></span><span class="visual-status ${st.className}"><i></i>${st.label}</span></article>`}).join(''):'<div class="empty">Noch keine Fahrer.</div>';bindEditButtons()}
function renderStats(){
const today=isoDate(new Date());
if(profile?.role==="driver"){
  const mine=driverTodayRides();
  $("#stat-today").textContent=mine.length;
  $("#stat-open").textContent=mine.filter(r=>r.status==="Offen"||r.status==="Zugewiesen").length;
  $("#stat-active").textContent=mine.filter(r=>r.status==="Unterwegs").length;
  $("#stat-available").textContent=driverVehiclesToday().length;
  return
}
$("#stat-today").textContent=rides.filter(r=>r.ride_date===today).length;
$("#stat-open").textContent=rides.filter(r=>r.status==="Offen").length;
$("#stat-active").textContent=rides.filter(r=>r.status==="Unterwegs").length;
$("#stat-available").textContent=fleet.filter(v=>v.status==="Verfügbar").length
}
function renderOverview(){
if(profile?.role==="driver"){
  const mine=driverTodayRides();
  const vehicles=driverVehiclesToday();

  $("#upcoming-rides").innerHTML=mine.length?mine.map(r=>{
    const c=myConfirmation(r);
    return `<button type="button" class="compact-item driver-overview-ride" data-driver-ride-detail="${r.id}">
      <div><strong>${escapeHtml((r.ride_time||"").slice(0,5))} · ${escapeHtml(r.customer_name)}</strong><small>${escapeHtml(r.pickup)} → ${escapeHtml(r.destination)}</small></div>
      <span class="confirmation-pill ${c?.status==="confirmed"?"confirmed":c?.status==="declined"?"declined":"pending"}">${escapeHtml(confirmationLabel(r))}</span>
    </button>`
  }).join(""):'<div class="empty">Für heute sind dir keine Fahrten zugewiesen.</div>';

  $("#fleet-summary").innerHTML=vehicles.length?vehicles.map(v=>`
    <div class="compact-item"><div><strong>${escapeHtml(v.name)}</strong><small>${escapeHtml(v.plate||"")} · ${escapeHtml(v.location||"Standort offen")}</small></div><span class="${badgeClass(v.status)}">${escapeHtml(v.status)}</span></div>
  `).join(""):'<div class="empty">Für deine heutigen Fahrten ist noch kein Fahrzeug eingetragen.</div>';

  const panel=$("#fleet-summary")?.closest(".panel");
  if(panel?.querySelector("h3"))panel.querySelector("h3").textContent="Meine Fahrzeuge heute";
  if(panel?.querySelector(".panel-head span"))panel.querySelector(".panel-head span").textContent="Nur deine zugewiesenen Fahrzeuge";

  bindDriverRideDetails();
  return
}

const upcoming=rides.filter(r=>r.status!=="Abgeschlossen").slice(0,5);
$("#upcoming-rides").innerHTML=upcoming.length?upcoming.map(r=>`<div class="compact-item"><div><strong>${escapeHtml((r.ride_time||"").slice(0,5))} · ${escapeHtml(r.customer_name)}</strong><small>${escapeHtml(r.pickup)} → ${escapeHtml(r.destination)}</small></div><span class="${badgeClass(r.status)}">${escapeHtml(r.status)}</span></div>`).join(""):'<div class="empty">Keine kommenden Fahrten.</div>';
$("#fleet-summary").innerHTML=fleet.map(v=>`<div class="compact-item"><div><strong>${escapeHtml(v.name)}</strong><small>${escapeHtml(v.location)} · ${escapeHtml(v.fuel_level)}</small></div><span class="${badgeClass(v.status)}">${escapeHtml(v.status)}</span></div>`).join("")
}
function renderRides(){
if(profile?.role==="driver"){
  const visible=driverTodayRides();

  $("#rides-list").innerHTML=visible.length?visible.map(r=>{
    const c=myConfirmation(r),confirmed=c?.status==="confirmed";
    return `<article class="ride-card driver-day-ride-card" data-driver-ride-detail="${r.id}">
      <div class="ride-time"><strong>${escapeHtml((r.ride_time||"").slice(0,5))}</strong><span>${formatDate(r.ride_date)}</span></div>
      <div class="ride-main">
        <h3>${escapeHtml(r.customer_name)}</h3>
        <p>${escapeHtml(r.pickup)} → ${escapeHtml(r.destination)}</p>
        <div class="ride-meta">${canDispatch()?`<div class="office-ride-confirm-line">${dispatchDriverConfirmation(r)}</div>`:""}
          <span class="pill">🚕 ${escapeHtml(r.vehicle_name||"Fahrzeug offen")}</span>
          <span class="pill">${escapeHtml(r.ride_type||"Taxifahrt")}</span>
          <span class="confirmation-pill ${confirmed?"confirmed":c?.status==="declined"?"declined":"pending"}">${escapeHtml(confirmationLabel(r))}</span>
        </div>
      </div>
      <div class="ride-actions">
        ${!confirmed?`<button class="confirm-ride-btn" data-confirm-ride="${r.id}">✓ Bestätigen</button>`:""}
        <button class="driver-details-btn" data-driver-ride-detail="${r.id}">Details ansehen</button><button class="maps-quick-btn" data-quick-navigation="${r.id}">🗺️ Route</button>
        ${confirmed?`<select data-ride-status="${r.id}">${["Zugewiesen","Unterwegs","Abgeschlossen"].map(st=>`<option ${st===r.status?"selected":""}>${st}</option>`).join("")}</select>`:""}
      </div>
    </article>`
  }).join(""):'<div class="empty">Für heute sind dir keine Fahrten zugewiesen.</div>';

  $$("[data-confirm-ride]").forEach(btn=>btn.addEventListener("click",async e=>{
    e.stopPropagation();
    await confirmDriverRide(btn.dataset.confirmRide)
  }));


  $$("[data-quick-navigation]").forEach(btn=>btn.addEventListener("click",e=>{
    e.stopPropagation();
    openGoogleMapsNavigation(rides.find(r=>r.id===btn.dataset.quickNavigation))
  }));

  $$("[data-ride-status]").forEach(sel=>sel.addEventListener("change",async e=>{
    e.stopPropagation();
    const {error}=await db.from("rides").update({status:sel.value}).eq("id",sel.dataset.rideStatus);
    if(error){alert(error.message);await loadData()}
  }));

  bindDriverRideDetails();
  return
}

const visible=rides;
$("#rides-list").innerHTML=visible.length?visible.map(r=>`<article class="ride-card"><div class="ride-time"><strong>${escapeHtml((r.ride_time||"").slice(0,5))}</strong><span>${formatDate(r.ride_date)}</span></div><div class="ride-main"><h3>${escapeHtml(r.customer_name)} ${r.is_recurring?'<small class="series-chip">↻ Serie</small>':""}</h3><p>${escapeHtml(r.pickup)} → ${escapeHtml(r.destination)}</p><div class="ride-meta"><span class="pill">${escapeHtml(driverLabel(r))}</span>${canDispatch()?`<div class="office-confirmation-box">${officeConfirmationList(r)}</div><span class="office-overall-confirm ${officeOverallConfirmation(r).className}">${officeOverallConfirmation(r).label}</span>`:""}<span class="pill">${escapeHtml(r.vehicle_name||"Fahrzeug offen")}</span><span class="pill">${escapeHtml(r.ride_type)}</span></div></div><div class="ride-actions"><select data-ride-status="${r.id}">${["Offen","Zugewiesen","Unterwegs","Abgeschlossen"].map(st=>`<option ${st===r.status?"selected":""}>${st}</option>`).join("")}</select><button data-edit-ride="${r.id}">Bearbeiten</button><button data-delete-ride="${r.id}">${r.is_recurring?"Einmal aussetzen":"Löschen"}</button></div></article>`).join(""):'<div class="empty">Noch keine Fahrten.</div>';
$$("[data-ride-status]").forEach(el=>el.addEventListener("change",async()=>{const{error}=await db.from("rides").update({status:el.value}).eq("id",el.dataset.rideStatus);if(error)alert(error.message)}));
$$("[data-delete-ride]").forEach(b=>b.addEventListener("click",()=>deleteRide(b.dataset.deleteRide)));
bindEditButtons()
}
async function deleteRide(id){const r=rides.find(x=>x.id===id);if(!r)return;if(r.is_recurring&&r.series_id){if(!confirm('Nur diesen einzelnen Termin der Wiederholungsfahrt aussetzen? Die Serie bleibt bestehen.'))return;const{error}=await db.rpc('cancel_recurring_occurrence',{p_series:r.series_id,p_date:r.occurrence_date||r.ride_date});if(error)alert(error.message)}else{if(!confirm('Diese Fahrt wirklich löschen?'))return;const{error}=await db.from('rides').delete().eq('id',id);if(error)alert(error.message)}}
function renderFleet(){
const source=profile?.role==="driver"?driverVehiclesToday():fleet;
$("#fleet-list").innerHTML=source.length?source.map(v=>`<article class="vehicle-card"><div class="vehicle-head"><div><h3>${escapeHtml(v.name)}</h3><span>${escapeHtml(v.plate)}</span></div><span class="${badgeClass(v.status)}">${escapeHtml(v.status)}</span></div><div class="vehicle-status"><div><small>Standort</small><strong>${escapeHtml(v.location)}</strong></div><div><small>Tank</small><strong>${escapeHtml(v.fuel_level)}</strong></div><div><small>Sauberkeit</small><strong>${escapeHtml(v.cleanliness)}</strong></div><div><small>Kilometer</small><strong>${Number(v.mileage||0).toLocaleString("de-DE")} km</strong></div></div><p class="vehicle-note">${escapeHtml(v.note||"Keine Notiz")}</p>${canDispatch()?`<div class="vehicle-actions"><button data-edit-vehicle="${v.id}">Status ändern</button><button data-delete-vehicle="${v.id}">Löschen</button></div>`:""}</article>`).join(""):`<div class="empty">${profile?.role==="driver"?"Für deine heutigen Fahrten ist kein Fahrzeug eingetragen.":"Noch keine Fahrzeuge."}</div>`;
if(canDispatch()){
  $$("[data-delete-vehicle]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Fahrzeug wirklich entfernen?"))return;const{error}=await db.from("vehicles").delete().eq("id",b.dataset.deleteVehicle);if(error)alert(error.message)}));
  bindEditButtons()
}
}
function driverCheckboxes(target,selected=[]){const el=$(target);el.innerHTML=drivers.filter(d=>d.active).map(d=>`<label><input type="checkbox" value="${d.id}" ${selected.includes(d.id)?'checked':''}><span>${escapeHtml(d.full_name)}</span></label>`).join('')||'<small>Keine Fahrer angelegt.</small>'}
function selectedDrivers(target){const ids=$$(`${target} input:checked`).map(i=>i.value);return{ids,names:ids.map(id=>drivers.find(d=>d.id===id)?.full_name).filter(Boolean)}}
function refreshVehicleOptions(select,selected=''){select.innerHTML='<option value="">Noch offen</option>'+fleet.map(v=>`<option value="${v.id}" ${v.id===selected?'selected':''}>${escapeHtml(v.name)} (${escapeHtml(v.plate)})</option>`).join('')}

let groupDriverSelection=[];

function passengersForRide(rideId){
  return ridePassengers
    .filter(p=>p.ride_id===rideId)
    .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))
}

function setRideMode(mode){
  $('#ride-mode-value').value=mode;
  $$('[data-ride-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.rideMode===mode));
  $('#single-customer-section').classList.toggle('hidden-mode-section',mode!=='single');
  $('#group-customer-section').classList.toggle('hidden-mode-section',mode!=='group');
  $('#single-driver-section').classList.toggle('hidden-mode-section',mode!=='single');
  $('#group-driver-section').classList.toggle('hidden-mode-section',mode!=='group');

  const f=$('#ride-form');
  f.elements.customer.required=mode==='single';
  f.elements.pickup.required=mode==='single';
  f.elements.destination.required=mode==='single';

  if(mode==='group'&&!$('#group-passenger-list').children.length){
    addPassengerRow()
  }
}

function renderSingleDriverOptions(selected=''){
  $('#single-driver-select').innerHTML=
    '<option value="">Noch offen</option>'+
    drivers.filter(d=>d.active).map(d=>
      `<option value="${d.id}" ${d.id===selected?'selected':''}>${escapeHtml(d.full_name)}</option>`
    ).join('')
}

function renderGroupDriverSelect(){
  $('#group-driver-select').innerHTML=
    '<option value="">Fahrer auswählen …</option>'+
    drivers.filter(d=>d.active&&!groupDriverSelection.includes(d.id)).map(d=>
      `<option value="${d.id}">${escapeHtml(d.full_name)}</option>`
    ).join('')
}

function renderGroupDriverChips(){
  $('#group-driver-chips').innerHTML=groupDriverSelection.map(id=>{
    const d=drivers.find(x=>x.id===id);
    return d
      ? `<span class="driver-chip">${escapeHtml(d.full_name)}<button type="button" data-remove-group-driver="${id}">×</button></span>`
      : ''
  }).join('');

  $$('[data-remove-group-driver]').forEach(btn=>{
    btn.onclick=()=>{
      groupDriverSelection=groupDriverSelection.filter(id=>id!==btn.dataset.removeGroupDriver);
      renderGroupDriverChips();
      renderGroupDriverSelect()
    }
  })
}

function addPassengerRow(data={}){
  const list=$('#group-passenger-list');
  const index=list.children.length;

  list.insertAdjacentHTML('beforeend',`
    <article class="group-passenger-card">
      <span class="group-passenger-number">${index+1}</span>
      <button type="button" class="remove-group-passenger">×</button>
      <div class="group-passenger-fields">
        <label>
          <span>Name</span>
          <input data-passenger-field="name" value="${escapeHtml(data.name||'')}" placeholder="Vor- und Nachname" required>
        </label>
        <label>
          <span>Telefon</span>
          <input data-passenger-field="phone" value="${escapeHtml(data.phone||'')}" placeholder="Telefonnummer">
        </label>
        <label class="full">
          <span>Abholort</span>
          <input data-passenger-field="pickup" value="${escapeHtml(data.pickup||'')}" placeholder="Straße, Hausnummer, Ort" required>
        </label>
        <label class="full">
          <span>Zielort</span>
          <input data-passenger-field="destination" value="${escapeHtml(data.destination||'')}" placeholder="Straße, Hausnummer, Ort" required>
        </label>
      </div>
    </article>
  `);

  renumberPassengerRows()
}

function renumberPassengerRows(){
  $$('#group-passenger-list .group-passenger-card').forEach((card,index)=>{
    card.querySelector('.group-passenger-number').textContent=index+1;
    card.querySelector('.remove-group-passenger').onclick=()=>{
      if($('#group-passenger-list').children.length<=1){
        alert('Mindestens eine Person muss eingetragen bleiben.');
        return
      }
      card.remove();
      renumberPassengerRows()
    }
  })
}

function collectGroupPassengers(){
  return $$('#group-passenger-list .group-passenger-card').map((card,index)=>({
    sort_order:index,
    name:card.querySelector('[data-passenger-field="name"]').value.trim(),
    phone:card.querySelector('[data-passenger-field="phone"]').value.trim(),
    pickup:card.querySelector('[data-passenger-field="pickup"]').value.trim(),
    destination:card.querySelector('[data-passenger-field="destination"]').value.trim()
  }))
}

async function openRide(r=null,presetDate=null){
const f=$('#ride-form');
if(!f) throw new Error('ride-form fehlt in portal.html');
if(!$('#ride-dialog')) throw new Error('ride-dialog fehlt in portal.html');
if(!$('#ride-mode-value')) throw new Error('ride-mode-value fehlt in portal.html');
if(!$('#group-passenger-list')) throw new Error('group-passenger-list fehlt in portal.html');
if(!$('#single-driver-select')) throw new Error('single-driver-select fehlt in portal.html');
f.reset();
f.elements.id.value=r?.id||'';
f.elements.date.value=r?.ride_date||presetDate||isoDate(new Date());
f.elements.time.value=(r?.ride_time||'').slice(0,5);
f.elements.status.value=r?.status||'Offen';
f.elements.type.value=r?.ride_type||'Taxifahrt';
f.elements.note.value=r?.note||'';
refreshVehicleOptions($('#ride-vehicle-select'),r?.vehicle_id||'');

$('#group-passenger-list').innerHTML='';
groupDriverSelection=[];

const mode=r?.ride_mode||'single';

if(mode==='group'){
  const pax=passengersForRide(r?.id);
  (pax.length?pax:[{
    name:r?.customer_name||'',
    phone:r?.customer_phone||'',
    pickup:r?.pickup||'',
    destination:r?.destination||''
  }]).forEach(p=>addPassengerRow(p));

  groupDriverSelection=rideDriverIds(r||{});
  renderGroupDriverChips();
  renderGroupDriverSelect()
}else{
  f.elements.customer.value=r?.customer_name||'';
  f.elements.phone.value=r?.customer_phone||'';
  f.elements.pickup.value=r?.pickup||'';
  f.elements.destination.value=r?.destination||'';
  renderSingleDriverOptions(rideDriverIds(r||{})[0]||'')
}

setRideMode(mode);
$('#series-occurrence-info').hidden=!r?.is_recurring;
$('#ride-dialog').showModal()
}
function openVehicle(v=null){const f=$('#vehicle-form');f.reset();f.elements.id.value=v?.id||'';f.elements.name.value=v?.name||'';f.elements.plate.value=v?.plate||'';f.elements.location.value=v?.location||'Betriebshof';f.elements.status.value=v?.status||'Verfügbar';f.elements.fuel.value=v?.fuel_level||'Voll';f.elements.cleanliness.value=v?.cleanliness||'Sauber';f.elements.mileage.value=v?.mileage||'';f.elements.driver.value=v?.current_driver_name||'';f.elements.note.value=v?.note||'';$('#vehicle-dialog').showModal()}
$("#driver-detail-confirm")?.addEventListener("click",async()=>{
  if(!selectedDriverDetailRideId)return;
  const btn=$("#driver-detail-confirm");
  btn.disabled=true;
  btn.textContent="Wird bestätigt …";
  if(await confirmDriverRide(selectedDriverDetailRideId)){
    const ride=rides.find(r=>r.id===selectedDriverDetailRideId);
    if(ride)openDriverRideDetail(ride)
  }
});
function bindEditButtons(){$$('[data-edit-ride]').forEach(b=>b.onclick=()=>openRide(rides.find(r=>r.id===b.dataset.editRide)));$$('[data-edit-vehicle]').forEach(b=>b.onclick=()=>openVehicle(fleet.find(v=>v.id===b.dataset.editVehicle)))}
$$('[data-ride-mode]').forEach(btn=>btn.addEventListener('click',()=>setRideMode(btn.dataset.rideMode)));
$('#add-group-passenger')?.addEventListener('click',()=>addPassengerRow());
$('#add-group-driver')?.addEventListener('click',()=>{
  const id=$('#group-driver-select').value;
  if(!id)return;
  if(!groupDriverSelection.includes(id))groupDriverSelection.push(id);
  renderGroupDriverChips();
  renderGroupDriverSelect()
});
document.addEventListener('click',e=>{
  const rideButton=e.target.closest('[data-open-ride]');
  if(rideButton){
    if(!canDispatch()){e.preventDefault();console.warn('Fahrer dürfen keine Fahrten anlegen.');return;}
    e.preventDefault();
    openRide().catch(err=>{
      console.error('Neue Fahrt konnte nicht geöffnet werden:',err);
      alert('Die Fahrtmaske konnte nicht geöffnet werden. Bitte die Seite einmal vollständig neu laden.');
    });
    return;
  }

  const vehicleButton=e.target.closest('[data-open-vehicle]');
  if(vehicleButton){
    e.preventDefault();
    openVehicle();
  }
});$$('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog')?.close()));$$('dialog').forEach(d=>{d.addEventListener('click',e=>{if(e.target===d)d.close()});d.addEventListener('cancel',e=>{e.preventDefault();d.close()})});
$('#ride-form').addEventListener('submit',async e=>{
e.preventDefault();
if(!canDispatch())return;

const f=e.currentTarget;
const raw=Object.fromEntries(new FormData(f));
const mode=$('#ride-mode-value').value||'single';
const vehicle=fleet.find(v=>v.id===raw.vehicle);

let ids=[],names=[],customerName='',customerPhone=null,pickup='',destination='',passengers=[];

if(mode==='single'){
  const driverId=$('#single-driver-select').value;
  if(driverId){
    ids=[driverId];
    names=[drivers.find(d=>d.id===driverId)?.full_name].filter(Boolean)
  }

  customerName=(raw.customer||'').trim();
  customerPhone=(raw.phone||'').trim()||null;
  pickup=(raw.pickup||'').trim();
  destination=(raw.destination||'').trim();

  if(!customerName||!pickup||!destination){
    alert('Bitte Kunde, Abholort und Zielort ausfüllen.');
    return
  }
}else{
  passengers=collectGroupPassengers();

  if(!passengers.length||passengers.some(p=>!p.name||!p.pickup||!p.destination)){
    alert('Bitte bei allen Personen Name, Abholort und Zielort ausfüllen.');
    return
  }

  ids=[...groupDriverSelection];
  names=ids.map(id=>drivers.find(d=>d.id===id)?.full_name).filter(Boolean);

  customerName=`Mehrpersonenfahrt (${passengers.length} Personen)`;
  customerPhone=passengers[0]?.phone||null;
  pickup=passengers[0]?.pickup||'Mehrere Abholorte';
  destination=passengers[0]?.destination||'Mehrere Ziele'
}

const payload={
  ride_mode:mode,
  customer_name:customerName,
  customer_phone:customerPhone,
  pickup,
  destination,
  ride_date:raw.date,
  ride_time:raw.time,
  assigned_driver:ids[0]||null,
  driver_name:names[0]||null,
  assigned_drivers:ids,
  driver_names:names,
  vehicle_id:raw.vehicle||null,
  vehicle_name:vehicle?.name||null,
  status:raw.status,
  ride_type:raw.type,
  note:raw.note||null
};

let rideId=raw.id||null;

if(rideId){
  const {error}=await db.from('rides').update(payload).eq('id',rideId);
  if(error){
    alert('Fahrt konnte nicht gespeichert werden: '+error.message);
    return
  }
}else{
  const {data,error}=await db.from('rides').insert(payload).select('id').single();
  if(error){
    alert('Fahrt konnte nicht gespeichert werden: '+error.message);
    return
  }
  rideId=data.id
}

await db.from('ride_passengers').delete().eq('ride_id',rideId);

if(mode==='group'&&passengers.length){
  const rows=passengers.map(p=>({...p,ride_id:rideId}));
  const {error}=await db.from('ride_passengers').insert(rows);

  if(error){
    alert('Fahrt gespeichert, aber Personendaten konnten nicht vollständig gespeichert werden: '+error.message);
    return
  }
}

$('#ride-dialog').close();
await loadData()
});

$('#vehicle-form').addEventListener('submit',async e=>{e.preventDefault();const raw=Object.fromEntries(new FormData(e.currentTarget));const payload={name:raw.name,plate:raw.plate.toUpperCase(),location:raw.location,status:raw.status,fuel_level:raw.fuel,cleanliness:raw.cleanliness,mileage:Number(raw.mileage||0),current_driver_name:raw.driver||null,note:raw.note||null};const result=raw.id?await db.from('vehicles').update(payload).eq('id',raw.id):await db.from('vehicles').insert(payload);if(result.error)alert(result.error.message);else $('#vehicle-dialog').close()});
function renderCalendar(){const grid=$('#calendar-grid');if(!grid)return;const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();$('#calendar-title').textContent=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(calendarCursor);grid.innerHTML='';let first=new Date(y,m,1),offset=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate();for(let i=0;i<offset;i++)grid.insertAdjacentHTML('beforeend','<span class="calendar-blank"></span>');for(let day=1;day<=days;day++){const d=isoDate(new Date(y,m,day)),list=rides.filter(r=>r.ride_date===d),today=d===isoDate(new Date());grid.insertAdjacentHTML('beforeend',`<button class="calendar-day ${today?'today':''} ${list.length?'has-rides':''}" data-calendar-date="${d}"><span>${day}</span><strong>${list.length?list.length+' Fahrt'+(list.length===1?'':'en'):''}</strong><div>${list.slice(0,3).map(r=>`<i>${escapeHtml((r.ride_time||'').slice(0,5))} ${escapeHtml(r.customer_name)}</i>`).join('')}</div></button>`)}$$('[data-calendar-date]').forEach(b=>b.addEventListener('click',()=>openDay(b.dataset.calendarDate)))}
function openDay(date){
selectedCalendarDate=date;
$("#day-dialog-title").textContent=`Fahrten am ${formatDate(date)}`;

if(profile?.role==="driver"){
  const list=rides.filter(r=>isMine(r)&&r.ride_date===date).sort((a,b)=>String(a.ride_time||"").localeCompare(String(b.ride_time||"")));
  $("#day-rides-list").innerHTML=list.length?list.map(r=>{
    const c=myConfirmation(r),confirmed=c?.status==="confirmed";
    return `<article class="day-ride driver-calendar-ride" data-driver-ride-detail="${r.id}">
      <div><strong>${escapeHtml((r.ride_time||"").slice(0,5))} · ${escapeHtml(r.customer_name)}</strong><span>${escapeHtml(r.pickup)} → ${escapeHtml(r.destination)}</span><small>🚕 ${escapeHtml(r.vehicle_name||"Fahrzeug offen")}</small></div>
      <div class="driver-calendar-actions">
        <span class="confirmation-pill ${confirmed?"confirmed":c?.status==="declined"?"declined":"pending"}">${escapeHtml(confirmationLabel(r))}</span>
        ${!confirmed?`<button class="confirm-ride-btn" data-confirm-ride="${r.id}">✓ Bestätigen</button>`:""}
        <button class="driver-details-btn" data-driver-ride-detail="${r.id}">Übersicht</button><button class="maps-quick-btn" data-quick-navigation="${r.id}">🗺️ Route</button>
      </div>
    </article>`
  }).join(""):'<div class="empty">An diesem Tag sind dir keine Fahrten zugewiesen.</div>';

  $("#day-new-ride").style.display="none";

  $$("[data-confirm-ride]").forEach(btn=>btn.addEventListener("click",async e=>{
    e.stopPropagation();
    if(await confirmDriverRide(btn.dataset.confirmRide))openDay(date)
  }));


  $$("[data-quick-navigation]").forEach(btn=>btn.addEventListener("click",e=>{
    e.stopPropagation();
    openGoogleMapsNavigation(rides.find(r=>r.id===btn.dataset.quickNavigation))
  }));

  bindDriverRideDetails();
  $("#day-dialog").showModal();
  return
}

$("#day-new-ride").style.display="";
const list=rides.filter(r=>r.ride_date===date);
$("#day-rides-list").innerHTML=list.length?list.map(r=>`<article class="day-ride"><div><strong>${escapeHtml((r.ride_time||"").slice(0,5))} · ${escapeHtml(r.customer_name)}</strong><span>${escapeHtml(r.pickup)} → ${escapeHtml(r.destination)}</span><small>${escapeHtml(driverLabel(r))}${r.is_recurring?" · ↻ Wiederholung":""}</small>${canDispatch()?`<div class="office-calendar-confirm">${officeConfirmationList(r)}</div>`:""}</div><div><button data-day-edit="${r.id}">Bearbeiten</button>${r.is_recurring&&canDispatch()?`<button class="danger-link" data-day-skip="${r.id}">Nur heute aussetzen</button>`:""}</div></article>`).join(""):'<div class="empty">An diesem Tag sind keine Fahrten eingetragen.</div>';
$$("[data-day-edit]").forEach(b=>b.onclick=()=>{$("#day-dialog").close();openRide(rides.find(r=>r.id===b.dataset.dayEdit))});
$$("[data-day-skip]").forEach(b=>b.onclick=async()=>{$("#day-dialog").close();await deleteRide(b.dataset.daySkip)});
$("#day-dialog").showModal()
}
$('#calendar-prev').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar()});$('#calendar-next').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar()});$('#calendar-today').addEventListener('click',()=>{calendarCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderCalendar()});$('#day-new-ride').addEventListener('click',()=>{if(profile?.role==='driver')return;$('#day-dialog').close();openRide(null,selectedCalendarDate)});
function renderRecurring(){if(!canDispatch()||!$('#recurring-list'))return;$('#recurring-list').innerHTML=series.length?series.map(s=>`<article class="recurring-card ${s.active?'':'inactive'}"><div class="recurring-card-top"><span class="series-icon">↻</span><div><small>${escapeHtml(s.title)}</small><h3>${escapeHtml(s.passenger_name)}</h3></div><span class="${s.active?'badge':'badge danger'}">${s.active?'Aktiv':'Pausiert'}</span></div><div class="series-route"><span>${escapeHtml(s.pickup)}</span><b>→</b><span>${escapeHtml(s.destination)}</span></div><div class="series-meta"><span>🕒 ${(s.ride_time||'').slice(0,5)}</span><span>📅 ${weekdayNames(s.weekdays)}</span><span>👨‍✈️ ${escapeHtml((s.driver_names||[]).join(' + ')||'Fahrer offen')}</span></div><div class="series-actions"><button data-edit-series="${s.id}">Bearbeiten</button><button data-toggle-series="${s.id}">${s.active?'Pausieren':'Aktivieren'}</button></div></article>`).join(''):'<div class="empty">Noch keine Wiederholungsfahrten angelegt.</div>';$$('[data-edit-series]').forEach(b=>b.onclick=()=>openRecurring(series.find(s=>s.id===b.dataset.editSeries)));$$('[data-toggle-series]').forEach(b=>b.onclick=()=>toggleSeries(b.dataset.toggleSeries))}
function weekdayNames(a=[]){const n=['So','Mo','Di','Mi','Do','Fr','Sa'];return a.map(x=>n[x]).join(', ')}
function openRecurring(s=null){const f=$('#recurring-form');f.reset();f.elements.id.value=s?.id||'';f.elements.title.value=s?.title||'';f.elements.passenger.value=s?.passenger_name||'';f.elements.phone.value=s?.customer_phone||'';f.elements.time.value=(s?.ride_time||'').slice(0,5);f.elements.pickup.value=s?.pickup||'';f.elements.destination.value=s?.destination||'';f.elements.start_date.value=s?.start_date||isoDate(new Date());f.elements.end_date.value=s?.end_date||'';f.elements.type.value=s?.ride_type||'Taxifahrt';f.elements.note.value=s?.note||'';$$('#recurring-weekdays input').forEach(i=>i.checked=(s?.weekdays||[]).includes(Number(i.value)));driverCheckboxes('#recurring-driver-list',s?.assigned_drivers||[]);refreshVehicleOptions($('#recurring-vehicle-select'),s?.vehicle_id||'');$('#recurring-dialog').showModal()}
$('#open-recurring').addEventListener('click',()=>{if(!canDispatch())return;openRecurring()});
$('#recurring-form').addEventListener('submit',async e=>{e.preventDefault();if(!canDispatch())return;const f=e.currentTarget,raw=Object.fromEntries(new FormData(f)),weekdays=$$('#recurring-weekdays input:checked').map(i=>Number(i.value)),sel=selectedDrivers('#recurring-driver-list'),vehicle=fleet.find(v=>v.id===raw.vehicle);if(!weekdays.length){alert('Bitte mindestens einen Wochentag auswählen.');return}const payload={title:raw.title,passenger_name:raw.passenger,customer_phone:raw.phone||null,pickup:raw.pickup,destination:raw.destination,start_date:raw.start_date,end_date:raw.end_date||null,weekdays,ride_time:raw.time,assigned_drivers:sel.ids,driver_names:sel.names,vehicle_id:raw.vehicle||null,vehicle_name:vehicle?.name||null,ride_type:raw.type,note:raw.note||null,active:true};let id=raw.id;if(id){const{error}=await db.from('recurring_series').update(payload).eq('id',id);if(error){alert(error.message);return}await db.from('rides').delete().eq('series_id',id).gte('ride_date',isoDate(new Date())).neq('status','Abgeschlossen')}else{const{data,error}=await db.from('recurring_series').insert(payload).select('id').single();if(error){alert(error.message);return}id=data.id}await db.rpc('generate_recurring_occurrences',{p_series:id,p_until:isoDate(new Date(Date.now()+365*86400000))});$('#recurring-dialog').close();await loadData()});
async function toggleSeries(id){const s=series.find(x=>x.id===id);if(!s)return;const active=!s.active;const{error}=await db.from('recurring_series').update({active}).eq('id',id);if(error){alert(error.message);return}if(!active)await db.from('rides').delete().eq('series_id',id).gte('ride_date',isoDate(new Date())).neq('status','Abgeschlossen');else await db.rpc('generate_recurring_occurrences',{p_series:id,p_until:isoDate(new Date(Date.now()+365*86400000))})}
function renderAll(){renderDispatch();renderStats();renderOverview();renderRides();renderFleet();renderCalendar();renderRecurring()}
db.auth.onAuthStateChange((event,newSession)=>{
  console.info("Taxi Erbas Auth:",event);
  if(event==="SIGNED_OUT"){
    session=null;
    profile=null;
    if(mobileSyncTimer)clearInterval(mobileSyncTimer);
    mobileSyncTimer=null;
    mobileSyncStarted=false;
    return;
  }
  if(newSession){
    session=newSession;
    if(event==="TOKEN_REFRESHED" || event==="SIGNED_IN"){
      loadData().catch(()=>{});
    }
  }
});
initialize();
})();