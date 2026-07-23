(() => {
  const STORAGE_RIDES = "taxiErbasDemoRides";
  const STORAGE_FLEET = "taxiErbasDemoFleet";
  const STORAGE_USER = "taxiErbasDemoUser";

  const seedRides = [
    {id: crypto.randomUUID(), customer:"Frau Schneider", phone:"0171 445566", pickup:"Bad Wörishofen, Bahnhof", destination:"Flughafen Memmingen", date:new Date().toISOString().slice(0,10), time:"18:30", driver:"Ali", vehicle:"Mercedes V-Klasse", status:"Zugewiesen", type:"Flughafentransfer", note:"2 Koffer"},
    {id: crypto.randomUUID(), customer:"Herr Müller", phone:"0151 223344", pickup:"Türkheim, Hauptstraße", destination:"Klinik Bad Wörishofen", date:new Date().toISOString().slice(0,10), time:"14:15", driver:"Mehmet", vehicle:"Mercedes E-Klasse", status:"Unterwegs", type:"Krankenfahrt", note:"Begleitperson fährt mit"}
  ];
  const seedFleet = [
    {id:crypto.randomUUID(), name:"Mercedes V-Klasse", plate:"MN-TE 101", location:"Betriebshof", status:"Verfügbar", fuel:"¾ voll", cleanliness:"Sauber", mileage:84500, driver:"Ali", note:"Keine Mängel"},
    {id:crypto.randomUUID(), name:"Mercedes E-Klasse", plate:"MN-TE 202", location:"Bad Wörishofen Zentrum", status:"Unterwegs", fuel:"Halbvoll", cleanliness:"Leicht verschmutzt", mileage:112400, driver:"Mehmet", note:"Innenraum später kurz reinigen"},
    {id:crypto.randomUUID(), name:"Ford Tourneo", plate:"MN-TE 303", location:"Betriebshof", status:"Werkstatt", fuel:"¼ voll", cleanliness:"Reinigung erforderlich", mileage:96300, driver:"", note:"Rechter Blinker prüfen"}
  ];

  const get = (key, seed) => {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
    localStorage.setItem(key, JSON.stringify(seed));
    return structuredClone(seed);
  };
  const save = (key, data) => localStorage.setItem(key, JSON.stringify(data));

  let rides = get(STORAGE_RIDES, seedRides);
  let fleet = get(STORAGE_FLEET, seedFleet);
  let role = localStorage.getItem(STORAGE_USER);

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const loginScreen = $("#login-screen");
  const dashboard = $("#dashboard");

  function openDashboard(userRole) {
    role = userRole;
    localStorage.setItem(STORAGE_USER, role);
    loginScreen.classList.add("hidden");
    dashboard.classList.remove("hidden");
    $("#role-label").textContent = role === "driver" ? "Fahreransicht" : "Disponentenansicht";
    $("#user-name").textContent = role === "driver" ? "Demo Fahrer" : "Demo Disponent";
    $$("[data-open-ride], [data-open-vehicle]").forEach(btn => {
      btn.style.display = role === "driver" ? "none" : "";
    });
    renderAll();
  }

  $("#login-form").addEventListener("submit", e => {
    e.preventDefault();
    const user = $("#login-user").value.trim().toLowerCase();
    const password = $("#login-password").value;
    if (password === "demo123" && (user === "disponent" || user === "fahrer")) {
      $("#login-error").textContent = "";
      openDashboard(user === "fahrer" ? "driver" : "dispatcher");
    } else {
      $("#login-error").textContent = "Zugangsdaten stimmen nicht. Nutze einen der Demo-Zugänge.";
    }
  });

  $("#logout-button").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_USER);
    location.reload();
  });

  $("#reset-demo").addEventListener("click", () => {
    if (!confirm("Alle Testdaten auf den Ausgangszustand zurücksetzen?")) return;
    localStorage.removeItem(STORAGE_RIDES);
    localStorage.removeItem(STORAGE_FLEET);
    rides = get(STORAGE_RIDES, seedRides);
    fleet = get(STORAGE_FLEET, seedFleet);
    renderAll();
  });

  $$(".nav-button").forEach(btn => btn.addEventListener("click", () => {
    $$(".nav-button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    $$(".view").forEach(v => v.classList.remove("active"));
    $("#view-" + btn.dataset.view).classList.add("active");
    $("#page-title").textContent = btn.textContent;
    $(".sidebar").classList.remove("open");
  }));

  $("#mobile-menu").addEventListener("click", () => $(".sidebar").classList.toggle("open"));

  function badgeClass(value) {
    if (["Werkstatt","Nicht verfügbar","Reinigung erforderlich","Reserve"].includes(value)) return "badge danger";
    if (["Unterwegs","Leicht verschmutzt","¼ voll","Halbvoll","Offen"].includes(value)) return "badge warn";
    return "badge";
  }

  function renderStats() {
    const today = new Date().toISOString().slice(0,10);
    $("#stat-today").textContent = rides.filter(r => r.date === today).length;
    $("#stat-open").textContent = rides.filter(r => r.status === "Offen").length;
    $("#stat-active").textContent = rides.filter(r => r.status === "Unterwegs").length;
    $("#stat-available").textContent = fleet.filter(v => v.status === "Verfügbar").length;
  }

  function renderOverview() {
    const upcoming = [...rides].sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time)).slice(0,5);
    $("#upcoming-rides").innerHTML = upcoming.length ? upcoming.map(r => `
      <div class="compact-item">
        <div><strong>${escapeHtml(r.time)} · ${escapeHtml(r.customer)}</strong><small>${escapeHtml(r.pickup)} → ${escapeHtml(r.destination)}</small></div>
        <span class="${badgeClass(r.status)}">${escapeHtml(r.status)}</span>
      </div>`).join("") : '<div class="empty">Noch keine Fahrten vorhanden.</div>';

    $("#fleet-summary").innerHTML = fleet.map(v => `
      <div class="compact-item">
        <div><strong>${escapeHtml(v.name)}</strong><small>${escapeHtml(v.location)} · ${escapeHtml(v.fuel)}</small></div>
        <span class="${badgeClass(v.status)}">${escapeHtml(v.status)}</span>
      </div>`).join("");
  }

  function renderRides() {
    $("#rides-list").innerHTML = rides.length ? [...rides].sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time)).map(r => `
      <article class="ride-card">
        <div class="ride-time"><strong>${escapeHtml(r.time)}</strong><span>${formatDate(r.date)}</span></div>
        <div class="ride-main">
          <h3>${escapeHtml(r.customer)}</h3>
          <p>${escapeHtml(r.pickup)} → ${escapeHtml(r.destination)}</p>
          <div class="ride-meta">
            <span class="pill">${escapeHtml(r.driver)}</span>
            <span class="pill">${escapeHtml(r.vehicle || "Kein Fahrzeug")}</span>
            <span class="pill">${escapeHtml(r.type)}</span>
            ${r.note ? `<span class="pill">${escapeHtml(r.note)}</span>` : ""}
          </div>
        </div>
        <div class="ride-actions">
          <select data-ride-status="${r.id}" ${role==="driver" ? "" : ""}>
            ${["Offen","Zugewiesen","Unterwegs","Abgeschlossen"].map(s => `<option ${s===r.status?"selected":""}>${s}</option>`).join("")}
          </select>
          ${role==="dispatcher" ? `<button data-edit-ride="${r.id}">Bearbeiten</button><button data-delete-ride="${r.id}">Löschen</button>` : ""}
        </div>
      </article>`).join("") : '<div class="empty">Noch keine Fahrten eingetragen.</div>';

    $$("[data-ride-status]").forEach(select => select.addEventListener("change", () => {
      const ride = rides.find(r => r.id === select.dataset.rideStatus);
      ride.status = select.value;
      save(STORAGE_RIDES, rides);
      renderAll();
    }));
    $$("[data-edit-ride]").forEach(btn => btn.addEventListener("click", () => openRide(rides.find(r => r.id === btn.dataset.editRide))));
    $$("[data-delete-ride]").forEach(btn => btn.addEventListener("click", () => {
      if (!confirm("Diese Fahrt löschen?")) return;
      rides = rides.filter(r => r.id !== btn.dataset.deleteRide);
      save(STORAGE_RIDES, rides);
      renderAll();
    }));
  }

  function renderFleet() {
    $("#fleet-list").innerHTML = fleet.length ? fleet.map(v => `
      <article class="vehicle-card">
        <div class="vehicle-head">
          <div><h3>${escapeHtml(v.name)}</h3><span>${escapeHtml(v.plate)}</span></div>
          <span class="${badgeClass(v.status)}">${escapeHtml(v.status)}</span>
        </div>
        <div class="vehicle-status">
          <div><small>Standort</small><strong>${escapeHtml(v.location)}</strong></div>
          <div><small>Tank</small><strong>${escapeHtml(v.fuel)}</strong></div>
          <div><small>Sauberkeit</small><strong>${escapeHtml(v.cleanliness)}</strong></div>
          <div><small>Kilometer</small><strong>${Number(v.mileage || 0).toLocaleString("de-DE")} km</strong></div>
        </div>
        <p class="vehicle-note">${escapeHtml(v.note || "Keine Notiz")}</p>
        <div class="vehicle-actions">
          <button data-edit-vehicle="${v.id}">Status ändern</button>
          ${role==="dispatcher" ? `<button data-delete-vehicle="${v.id}">Löschen</button>` : ""}
        </div>
      </article>`).join("") : '<div class="empty">Noch keine Fahrzeuge angelegt.</div>';

    $$("[data-edit-vehicle]").forEach(btn => btn.addEventListener("click", () => openVehicle(fleet.find(v => v.id === btn.dataset.editVehicle))));
    $$("[data-delete-vehicle]").forEach(btn => btn.addEventListener("click", () => {
      if (!confirm("Dieses Fahrzeug löschen?")) return;
      fleet = fleet.filter(v => v.id !== btn.dataset.deleteVehicle);
      save(STORAGE_FLEET, fleet);
      renderAll();
    }));
  }

  function refreshVehicleOptions() {
    $("#ride-vehicle-select").innerHTML = '<option value="">Noch offen</option>' + fleet.map(v => `<option>${escapeHtml(v.name)}</option>`).join("");
  }

  function openRide(ride = null) {
    const form = $("#ride-form");
    form.reset();
    refreshVehicleOptions();
    if (ride) Object.entries(ride).forEach(([k,v]) => { if (form.elements[k]) form.elements[k].value = v; });
    $("#ride-dialog").showModal();
  }

  function openVehicle(vehicle = null) {
    const form = $("#vehicle-form");
    form.reset();
    if (vehicle) Object.entries(vehicle).forEach(([k,v]) => { if (form.elements[k]) form.elements[k].value = v; });
    $("#vehicle-dialog").showModal();
  }

  $$("[data-open-ride]").forEach(btn => btn.addEventListener("click", () => openRide()));
  $$("[data-open-vehicle]").forEach(btn => btn.addEventListener("click", () => openVehicle()));

  $("#ride-form").addEventListener("submit", e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (data.id) {
      const index = rides.findIndex(r => r.id === data.id);
      rides[index] = data;
    } else {
      data.id = crypto.randomUUID();
      rides.push(data);
    }
    save(STORAGE_RIDES, rides);
    $("#ride-dialog").close();
    renderAll();
  });

  $("#vehicle-form").addEventListener("submit", e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    data.mileage = Number(data.mileage || 0);
    if (data.id) {
      const index = fleet.findIndex(v => v.id === data.id);
      fleet[index] = data;
    } else {
      data.id = crypto.randomUUID();
      fleet.push(data);
    }
    save(STORAGE_FLEET, fleet);
    $("#vehicle-dialog").close();
    renderAll();
  });

  function formatDate(date) {
    return new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(date+"T12:00:00"));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function renderAll() {
    renderStats();
    renderOverview();
    renderRides();
    renderFleet();
    refreshVehicleOptions();
  }

  if (role) openDashboard(role);
})();