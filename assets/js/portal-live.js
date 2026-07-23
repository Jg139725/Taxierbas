(() => {
  "use strict";

  const db = window.taxiSupabase;
  let session = null;
  let profile = null;
  let rides = [];
  let fleet = [];
  let realtimeChannel = null;

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const loginScreen = $("#login-screen");
  const dashboard = $("#dashboard");

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  function formatDate(date) {
    if (!date) return "–";
    return new Intl.DateTimeFormat("de-DE", {
      day:"2-digit", month:"2-digit", year:"numeric"
    }).format(new Date(date + "T12:00:00"));
  }

  function showError(message) {
    $("#login-error").textContent = message || "Es ist ein Fehler aufgetreten.";
  }

  function canDispatch() {
    return ["admin", "dispatcher"].includes(profile?.role);
  }

  function badgeClass(value) {
    if (["Werkstatt","Nicht verfügbar","Reinigung erforderlich","Reserve"].includes(value)) return "badge danger";
    if (["Unterwegs","Leicht verschmutzt","¼ voll","Halbvoll","Offen"].includes(value)) return "badge warn";
    return "badge";
  }

  async function loadProfile() {
    const { data, error } = await db
      .from("profiles")
      .select("id, full_name, role, active")
      .eq("id", session.user.id)
      .single();

    if (error) throw new Error("Mitarbeiterprofil konnte nicht geladen werden.");
    if (!data.active) throw new Error("Dieser Mitarbeiterzugang wurde deaktiviert.");
    profile = data;
  }

  async function loadData() {
    const [rideResult, vehicleResult] = await Promise.all([
      db.from("rides").select("*").order("ride_date", { ascending: true }).order("ride_time", { ascending: true }),
      db.from("vehicles").select("*").order("name", { ascending: true })
    ]);

    if (rideResult.error) throw rideResult.error;
    if (vehicleResult.error) throw vehicleResult.error;

    rides = rideResult.data || [];
    fleet = vehicleResult.data || [];
    renderAll();
  }

  function subscribeRealtime() {
    if (realtimeChannel) db.removeChannel(realtimeChannel);

    realtimeChannel = db
      .channel("taxi-erbas-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"rides" }, loadData)
      .on("postgres_changes", { event:"*", schema:"public", table:"vehicles" }, loadData)
      .subscribe();
  }

  function openDashboard() {
    loginScreen.classList.add("hidden");
    dashboard.classList.remove("hidden");

    const roleLabels = {
      admin: "Administrator",
      dispatcher: "Disponent",
      driver: "Fahrer"
    };

    $("#role-label").textContent = roleLabels[profile.role] || profile.role;
    $("#user-name").textContent = profile.full_name || session.user.email;

    $$("[data-open-ride], [data-open-vehicle]").forEach(btn => {
      btn.style.display = canDispatch() ? "" : "none";
    });

    subscribeRealtime();
    loadData().catch(error => alert("Daten konnten nicht geladen werden: " + error.message));
  }

  async function initialize() {
    const { data } = await db.auth.getSession();
    session = data.session;

    if (!session) {
      loginScreen.classList.remove("hidden");
      dashboard.classList.add("hidden");
      return;
    }

    try {
      await loadProfile();
      openDashboard();
    } catch (error) {
      await db.auth.signOut();
      showError(error.message);
    }
  }

  $("#login-form").addEventListener("submit", async e => {
    e.preventDefault();
    showError("");

    const email = $("#login-user").value.trim();
    const password = $("#login-password").value;

    const submit = e.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = "Anmeldung läuft …";

    const { data, error } = await db.auth.signInWithPassword({ email, password });

    submit.disabled = false;
    submit.textContent = "Portal öffnen";

    if (error) {
      showError("Anmeldung fehlgeschlagen. Bitte E-Mail-Adresse und Passwort prüfen.");
      return;
    }

    session = data.session;

    try {
      await loadProfile();
      openDashboard();
    } catch (profileError) {
      await db.auth.signOut();
      showError(profileError.message);
    }
  });

  $("#logout-button").addEventListener("click", async () => {
    if (realtimeChannel) await db.removeChannel(realtimeChannel);
    await db.auth.signOut();
    location.reload();
  });

  $("#reset-demo").addEventListener("click", async () => {
    const button = $("#reset-demo");
    button.disabled = true;
    button.textContent = "Wird geladen …";
    try {
      await loadData();
    } finally {
      button.disabled = false;
      button.textContent = "Daten neu laden";
    }
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

  function renderStats() {
    const today = new Date().toISOString().slice(0,10);
    $("#stat-today").textContent = rides.filter(r => r.ride_date === today).length;
    $("#stat-open").textContent = rides.filter(r => r.status === "Offen").length;
    $("#stat-active").textContent = rides.filter(r => r.status === "Unterwegs").length;
    $("#stat-available").textContent = fleet.filter(v => v.status === "Verfügbar").length;
  }

  function renderOverview() {
    const upcoming = rides.slice(0, 5);
    $("#upcoming-rides").innerHTML = upcoming.length ? upcoming.map(r => `
      <div class="compact-item">
        <div>
          <strong>${escapeHtml(r.ride_time?.slice(0,5) || "–")} · ${escapeHtml(r.customer_name)}</strong>
          <small>${escapeHtml(r.pickup)} → ${escapeHtml(r.destination)}</small>
        </div>
        <span class="${badgeClass(r.status)}">${escapeHtml(r.status)}</span>
      </div>`).join("") : '<div class="empty">Noch keine Fahrten vorhanden.</div>';

    $("#fleet-summary").innerHTML = fleet.length ? fleet.map(v => `
      <div class="compact-item">
        <div>
          <strong>${escapeHtml(v.name)}</strong>
          <small>${escapeHtml(v.location)} · ${escapeHtml(v.fuel_level)}</small>
        </div>
        <span class="${badgeClass(v.status)}">${escapeHtml(v.status)}</span>
      </div>`).join("") : '<div class="empty">Noch keine Fahrzeuge vorhanden.</div>';
  }

  function renderRides() {
    $("#rides-list").innerHTML = rides.length ? rides.map(r => `
      <article class="ride-card">
        <div class="ride-time">
          <strong>${escapeHtml(r.ride_time?.slice(0,5) || "–")}</strong>
          <span>${formatDate(r.ride_date)}</span>
        </div>
        <div class="ride-main">
          <h3>${escapeHtml(r.customer_name)}</h3>
          <p>${escapeHtml(r.pickup)} → ${escapeHtml(r.destination)}</p>
          <div class="ride-meta">
            <span class="pill">${escapeHtml(r.driver_name || "Fahrer offen")}</span>
            <span class="pill">${escapeHtml(r.vehicle_name || "Fahrzeug offen")}</span>
            <span class="pill">${escapeHtml(r.ride_type)}</span>
            ${r.note ? `<span class="pill">${escapeHtml(r.note)}</span>` : ""}
          </div>
        </div>
        <div class="ride-actions">
          <select data-ride-status="${r.id}">
            ${["Offen","Zugewiesen","Unterwegs","Abgeschlossen"].map(s =>
              `<option ${s===r.status?"selected":""}>${s}</option>`).join("")}
          </select>
          ${canDispatch() ? `
            <button data-edit-ride="${r.id}">Bearbeiten</button>
            <button data-delete-ride="${r.id}">Löschen</button>` : ""}
        </div>
      </article>`).join("") : '<div class="empty">Noch keine Fahrten eingetragen.</div>';

    $$("[data-ride-status]").forEach(select => select.addEventListener("change", async () => {
      select.disabled = true;
      const { error } = await db
        .from("rides")
        .update({ status: select.value })
        .eq("id", select.dataset.rideStatus);
      select.disabled = false;
      if (error) {
        alert("Status konnte nicht gespeichert werden: " + error.message);
        await loadData();
      }
    }));

    $$("[data-edit-ride]").forEach(btn =>
      btn.addEventListener("click", () => openRide(rides.find(r => r.id === btn.dataset.editRide)))
    );

    $$("[data-delete-ride]").forEach(btn => btn.addEventListener("click", async () => {
      if (!confirm("Diese Fahrt wirklich löschen?")) return;
      const { error } = await db.from("rides").delete().eq("id", btn.dataset.deleteRide);
      if (error) alert("Fahrt konnte nicht gelöscht werden: " + error.message);
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
          <div><small>Tank</small><strong>${escapeHtml(v.fuel_level)}</strong></div>
          <div><small>Sauberkeit</small><strong>${escapeHtml(v.cleanliness)}</strong></div>
          <div><small>Kilometer</small><strong>${Number(v.mileage || 0).toLocaleString("de-DE")} km</strong></div>
        </div>
        <p class="vehicle-note">${escapeHtml(v.note || "Keine Notiz")}</p>
        <div class="vehicle-actions">
          <button data-edit-vehicle="${v.id}">Status ändern</button>
          ${canDispatch() ? `<button data-delete-vehicle="${v.id}">Löschen</button>` : ""}
        </div>
      </article>`).join("") : '<div class="empty">Noch keine Fahrzeuge angelegt.</div>';

    $$("[data-edit-vehicle]").forEach(btn =>
      btn.addEventListener("click", () => openVehicle(fleet.find(v => v.id === btn.dataset.editVehicle)))
    );

    $$("[data-delete-vehicle]").forEach(btn => btn.addEventListener("click", async () => {
      if (!confirm("Dieses Fahrzeug wirklich entfernen? Bestehende Fahrten bleiben erhalten.")) return;
      const { error } = await db.from("vehicles").delete().eq("id", btn.dataset.deleteVehicle);
      if (error) alert("Fahrzeug konnte nicht gelöscht werden: " + error.message);
    }));
  }

  function refreshVehicleOptions(selected = "") {
    $("#ride-vehicle-select").innerHTML =
      '<option value="">Noch offen</option>' +
      fleet.map(v => `<option value="${v.id}" ${v.id===selected?"selected":""}>${escapeHtml(v.name)} (${escapeHtml(v.plate)})</option>`).join("");
  }

  async function loadDrivers(selected = "") {
    const select = $("#ride-form").elements.driver;
    const { data, error } = await db
      .from("profiles")
      .select("id, full_name")
      .eq("active", true)
      .eq("role", "driver")
      .order("full_name");

    if (error) {
      select.innerHTML = '<option value="">Noch offen</option>';
      return;
    }

    select.innerHTML = '<option value="">Noch offen</option>' +
      data.map(d => `<option value="${d.id}" ${d.id===selected?"selected":""}>${escapeHtml(d.full_name)}</option>`).join("");
  }

  async function openRide(ride = null) {
    const form = $("#ride-form");
    form.reset();
    form.elements.id.value = ride?.id || "";
    form.elements.customer.value = ride?.customer_name || "";
    form.elements.phone.value = ride?.customer_phone || "";
    form.elements.pickup.value = ride?.pickup || "";
    form.elements.destination.value = ride?.destination || "";
    form.elements.date.value = ride?.ride_date || new Date().toISOString().slice(0,10);
    form.elements.time.value = ride?.ride_time?.slice(0,5) || "";
    form.elements.status.value = ride?.status || "Offen";
    form.elements.type.value = ride?.ride_type || "Taxifahrt";
    form.elements.note.value = ride?.note || "";
    refreshVehicleOptions(ride?.vehicle_id || "");
    await loadDrivers(ride?.assigned_driver || "");
    $("#ride-dialog").showModal();
  }

  function openVehicle(vehicle = null) {
    const form = $("#vehicle-form");
    form.reset();
    form.elements.id.value = vehicle?.id || "";
    form.elements.name.value = vehicle?.name || "";
    form.elements.plate.value = vehicle?.plate || "";
    form.elements.location.value = vehicle?.location || "Betriebshof";
    form.elements.status.value = vehicle?.status || "Verfügbar";
    form.elements.fuel.value = vehicle?.fuel_level || "Voll";
    form.elements.cleanliness.value = vehicle?.cleanliness || "Sauber";
    form.elements.mileage.value = vehicle?.mileage || "";
    form.elements.driver.value = vehicle?.current_driver_name || "";
    form.elements.note.value = vehicle?.note || "";
    $("#vehicle-dialog").showModal();
  }

  $$("[data-open-ride]").forEach(btn => btn.addEventListener("click", () => openRide()));
  $$("[data-open-vehicle]").forEach(btn => btn.addEventListener("click", () => openVehicle()));

  $("#ride-form").addEventListener("submit", async e => {
    e.preventDefault();
    if (!canDispatch()) return;

    const form = e.currentTarget;
    const raw = Object.fromEntries(new FormData(form));
    const vehicle = fleet.find(v => v.id === raw.vehicle);
    const driverOption = form.elements.driver.selectedOptions[0];

    const payload = {
      customer_name: raw.customer,
      customer_phone: raw.phone || null,
      pickup: raw.pickup,
      destination: raw.destination,
      ride_date: raw.date,
      ride_time: raw.time,
      assigned_driver: raw.driver || null,
      driver_name: raw.driver ? driverOption.textContent : null,
      vehicle_id: raw.vehicle || null,
      vehicle_name: vehicle?.name || null,
      status: raw.status,
      ride_type: raw.type,
      note: raw.note || null
    };

    const result = raw.id
      ? await db.from("rides").update(payload).eq("id", raw.id)
      : await db.from("rides").insert(payload);

    if (result.error) {
      alert("Fahrt konnte nicht gespeichert werden: " + result.error.message);
      return;
    }

    $("#ride-dialog").close();
  });

  $("#vehicle-form").addEventListener("submit", async e => {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));

    const payload = {
      name: raw.name,
      plate: raw.plate.toUpperCase(),
      location: raw.location,
      status: raw.status,
      fuel_level: raw.fuel,
      cleanliness: raw.cleanliness,
      mileage: Number(raw.mileage || 0),
      current_driver_name: raw.driver || null,
      note: raw.note || null
    };

    const result = raw.id
      ? await db.from("vehicles").update(payload).eq("id", raw.id)
      : await db.from("vehicles").insert(payload);

    if (result.error) {
      alert("Fahrzeug konnte nicht gespeichert werden: " + result.error.message);
      return;
    }

    $("#vehicle-dialog").close();
  });

  function renderAll() {
    renderStats();
    renderOverview();
    renderRides();
    renderFleet();
    refreshVehicleOptions();
  }

  db.auth.onAuthStateChange((event, newSession) => {
    if (event === "SIGNED_OUT") {
      session = null;
      profile = null;
    } else if (newSession) {
      session = newSession;
    }
  });

  initialize();
})();