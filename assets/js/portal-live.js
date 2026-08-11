(() => {
  "use strict";

  const db = window.taxiSupabase;

  let session = null;
  let profile = null;

  let rides = [];
  let fleet = [];
  let drivers = [];
  let rideDrivers = [];
  let recurring = [];
  let recurringDrivers = [];
  let recurringExceptions = [];

  let realtimeChannel = null;
  let clockTimer = null;

  let calendarCursor = new Date();
  calendarCursor.setDate(1);

  let selectedCalendarDate = null;
  let notificationKnownRideIds = new Set();

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const loginScreen = $("#login-screen");
  const dashboard = $("#dashboard");

  const ROLE_LABELS = {
    admin: "Administrator",
    dispatcher: "Disponent",
    driver: "Fahrer"
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function localIsoDate(date = new Date()) {
    const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return copy.toISOString().slice(0, 10);
  }

  function formatDate(dateString) {
    if (!dateString) return "–";
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date(`${dateString}T12:00:00`));
  }

  function formatLongDate(dateString) {
    if (!dateString) return "–";
    return new Intl.DateTimeFormat("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(new Date(`${dateString}T12:00:00`));
  }

  function canDispatch() {
    return ["admin", "dispatcher"].includes(profile?.role);
  }

  function badgeClass(value) {
    if (["Werkstatt", "Nicht verfügbar", "Reinigung erforderlich", "Reserve"].includes(value)) {
      return "badge danger";
    }

    if (["Unterwegs", "Leicht verschmutzt", "¼ voll", "Halbvoll", "Offen"].includes(value)) {
      return "badge warn";
    }

    return "badge";
  }

  function vehicleState(vehicle) {
    if (vehicle.status === "Verfügbar") return "free";
    if (vehicle.status === "Unterwegs") return "busy";
    if (vehicle.status === "Reserviert") return "reserved";
    return "offline";
  }

  function showLoginError(message = "") {
    const node = $("#login-error");
    if (node) node.textContent = message;
  }

  function selectedDriverIds(containerId) {
    return $$(`#${containerId} input[type="checkbox"]:checked`).map((input) => input.value);
  }

  function driverNames(ids) {
    return ids
      .map((id) => drivers.find((driver) => driver.id === id)?.full_name)
      .filter(Boolean);
  }

  function rideDriverIds(rideId) {
    const ids = rideDrivers
      .filter((row) => row.ride_id === rideId)
      .map((row) => row.driver_id);

    if (!ids.length) {
      const ride = rides.find((item) => item.id === rideId);
      if (ride?.assigned_driver) ids.push(ride.assigned_driver);
    }

    return [...new Set(ids)];
  }

  function recurringDriverIds(recurringId) {
    return [...new Set(
      recurringDrivers
        .filter((row) => row.recurring_id === recurringId)
        .map((row) => row.driver_id)
    )];
  }

  function rideDriverNames(ride) {
    const names = rideDrivers
      .filter((row) => row.ride_id === ride.id)
      .map((row) => row.driver_name)
      .filter(Boolean);

    if (!names.length && ride.driver_name) names.push(ride.driver_name);

    return [...new Set(names)];
  }

  function recurringDriverNames(item) {
    return [...new Set(
      recurringDrivers
        .filter((row) => row.recurring_id === item.id)
        .map((row) => row.driver_name)
        .filter(Boolean)
    )];
  }

  async function loadProfile() {
    const { data, error } = await db
      .from("profiles")
      .select("id, full_name, role, active")
      .eq("id", session.user.id)
      .single();

    if (error) throw new Error("Mitarbeiterprofil konnte nicht geladen werden.");
    if (!data?.active) throw new Error("Dieser Mitarbeiterzugang wurde deaktiviert.");

    profile = data;
  }

  async function loadData({ notify = false } = {}) {
    const requests = [
      db.from("rides")
        .select("*")
        .order("ride_date", { ascending: true })
        .order("ride_time", { ascending: true }),

      db.from("vehicles")
        .select("*")
        .order("name", { ascending: true }),

      db.from("profiles")
        .select("id, full_name, role, active")
        .eq("role", "driver")
        .order("full_name", { ascending: true }),

      db.from("ride_drivers")
        .select("ride_id, driver_id, driver_name"),

      db.from("recurring_rides")
        .select("*")
        .order("start_date", { ascending: true })
        .order("ride_time", { ascending: true }),

      db.from("recurring_ride_drivers")
        .select("recurring_id, driver_id, driver_name"),

      db.from("recurring_exceptions")
        .select("*")
    ];

    const [
      rideResult,
      vehicleResult,
      driverResult,
      rideDriversResult,
      recurringResult,
      recurringDriversResult,
      exceptionsResult
    ] = await Promise.all(requests);

    if (rideResult.error) throw rideResult.error;
    if (vehicleResult.error) throw vehicleResult.error;

    rides = rideResult.data || [];
    fleet = vehicleResult.data || [];
    drivers = driverResult.error ? [] : (driverResult.data || []);
    rideDrivers = rideDriversResult.error ? [] : (rideDriversResult.data || []);
    recurring = recurringResult.error ? [] : (recurringResult.data || []);
    recurringDrivers = recurringDriversResult.error ? [] : (recurringDriversResult.data || []);
    recurringExceptions = exceptionsResult.error ? [] : (exceptionsResult.data || []);

    if (notify) notifyDriverAboutChanges();

    renderAll();
  }

  function subscribeRealtime() {
    if (realtimeChannel) db.removeChannel(realtimeChannel);

    realtimeChannel = db
      .channel("taxi-erbas-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => loadData({ notify: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_drivers" }, () => loadData({ notify: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "recurring_rides" }, () => loadData({ notify: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "recurring_ride_drivers" }, () => loadData({ notify: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "recurring_exceptions" }, () => loadData())
      .subscribe();
  }

  function startDispatchClock() {
    const update = () => {
      const now = new Date();

      if ($("#dispatch-clock")) {
        $("#dispatch-clock").textContent = now.toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit"
        });
      }

      if ($("#dispatch-date")) {
        $("#dispatch-date").textContent = now.toLocaleDateString("de-DE", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        });
      }
    };

    update();

    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(update, 30000);
  }

  function openDashboard() {
    loginScreen?.classList.add("hidden");
    dashboard?.classList.remove("hidden");

    if ($("#role-label")) {
      $("#role-label").textContent = ROLE_LABELS[profile.role] || profile.role;
    }

    if ($("#user-name")) {
      $("#user-name").textContent = profile.full_name || session.user.email;
    }

    $$("[data-open-ride], [data-open-vehicle], #open-recurring").forEach((button) => {
      button.style.display = canDispatch() ? "" : "none";
    });

    const recurringNav = $(".recurring-nav");
    const dispatchNav = $(".dispatch-nav");

    if (!canDispatch()) {
      if (dispatchNav) dispatchNav.style.display = "none";
      if (recurringNav) recurringNav.style.display = "none";

      $$(".nav-button").forEach((button) => button.classList.remove("active"));
      $$(".view").forEach((view) => view.classList.remove("active"));

      $('[data-view="overview"]')?.classList.add("active");
      $("#view-overview")?.classList.add("active");

      if ($("#page-title")) $("#page-title").textContent = "Übersicht";
    } else {
      startDispatchClock();
    }

    updateNotificationUi();
    subscribeRealtime();

    loadData()
      .then(() => {
        if (profile.role === "driver") {
          notificationKnownRideIds = new Set(driverRelevantRideKeys());
        }
      })
      .catch((error) => {
        alert(`Daten konnten nicht geladen werden: ${error.message}`);
      });
  }

  async function initialize() {
    const { data } = await db.auth.getSession();
    session = data.session;

    if (!session) {
      loginScreen?.classList.remove("hidden");
      dashboard?.classList.add("hidden");
      return;
    }

    try {
      await loadProfile();
      openDashboard();
    } catch (error) {
      await db.auth.signOut();
      showLoginError(error.message);
    }
  }

  $("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    showLoginError("");

    const email = $("#login-user").value.trim();
    const password = $("#login-password").value;

    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = "Anmeldung läuft …";

    const { data, error } = await db.auth.signInWithPassword({ email, password });

    submit.disabled = false;
    submit.textContent = "Anmelden";

    if (error) {
      showLoginError("Anmeldung fehlgeschlagen. Bitte E-Mail-Adresse und Passwort prüfen.");
      return;
    }

    session = data.session;

    try {
      await loadProfile();
      openDashboard();
    } catch (profileError) {
      await db.auth.signOut();
      showLoginError(profileError.message);
    }
  });

  $("#logout-button")?.addEventListener("click", async () => {
    if (realtimeChannel) await db.removeChannel(realtimeChannel);
    await db.auth.signOut();
    location.reload();
  });

  $("#reset-demo")?.addEventListener("click", async () => {
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

  $$(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".nav-button").forEach((entry) => entry.classList.remove("active"));
      button.classList.add("active");

      $$(".view").forEach((view) => view.classList.remove("active"));
      $(`#view-${button.dataset.view}`)?.classList.add("active");

      if ($("#page-title")) $("#page-title").textContent = button.textContent.trim();

      $(".sidebar")?.classList.remove("open");

      if (button.dataset.view === "calendar") renderCalendar();
      if (button.dataset.view === "recurring") renderRecurring();
    });
  });

  $("#mobile-menu")?.addEventListener("click", () => {
    $(".sidebar")?.classList.toggle("open");
  });

  function driverState(driver) {
    const activeRide = rides.find((ride) => {
      const ids = rideDriverIds(ride.id);
      return ids.includes(driver.id) && ["Zugewiesen", "Unterwegs"].includes(ride.status);
    });

    if (!driver.active) return { label: "Deaktiviert", className: "offline", ride: null };
    if (activeRide?.status === "Unterwegs") return { label: "Unterwegs", className: "busy", ride: activeRide };
    if (activeRide) return { label: "Zugewiesen", className: "reserved", ride: activeRide };

    return { label: "Frei", className: "free", ride: null };
  }

  function renderDispatch() {
    if (!canDispatch() || !$("#dispatch-rides")) return;

    const openRides = rides.filter((ride) => ride.status !== "Abgeschlossen");
    const activeRides = rides.filter((ride) => ride.status === "Unterwegs");
    const freeVehicles = fleet.filter((vehicle) => vehicle.status === "Verfügbar");
    const freeDrivers = drivers.filter((driver) => driverState(driver).label === "Frei");

    $("#dispatch-open-count").textContent = openRides.length;
    $("#dispatch-free-vehicles").textContent = freeVehicles.length;
    $("#dispatch-free-drivers").textContent = freeDrivers.length;
    $("#dispatch-active-count").textContent = activeRides.length;

    $("#dispatch-vehicles").innerHTML = fleet.length
      ? fleet.map((vehicle) => {
          const state = vehicleState(vehicle);

          return `
            <button class="dispatch-item dispatch-vehicle-item ${state}" data-dispatch-vehicle="${vehicle.id}">
              <span class="vehicle-icon">🚕</span>
              <span class="dispatch-item-copy">
                <strong>${escapeHtml(vehicle.name)}</strong>
                <small>${escapeHtml(vehicle.plate)}</small>
                <em>${escapeHtml(vehicle.location)} · ${escapeHtml(vehicle.fuel_level)}</em>
              </span>
              <span class="visual-status ${state}">
                <i></i>${escapeHtml(vehicle.status)}
              </span>
            </button>
          `;
        }).join("")
      : '<div class="empty dispatch-empty">Noch keine Fahrzeuge angelegt.</div>';

    $("#dispatch-rides").innerHTML = openRides.length
      ? openRides.map((ride) => {
          const names = rideDriverNames(ride);

          return `
            <article class="dispatch-ride ${
              ride.status === "Unterwegs"
                ? "ride-active"
                : ride.status === "Zugewiesen"
                  ? "ride-assigned"
                  : "ride-open"
            }">
              <div class="dispatch-ride-time">
                <strong>${escapeHtml(ride.ride_time?.slice(0, 5) || "–")}</strong>
                <span>${formatDate(ride.ride_date)}</span>
              </div>

              <div class="dispatch-route">
                <div class="route-point pickup">
                  <i></i>
                  <span>
                    <small>Abholung</small>
                    <strong>${escapeHtml(ride.pickup)}</strong>
                  </span>
                </div>
                <div class="route-line"></div>
                <div class="route-point destination">
                  <i></i>
                  <span>
                    <small>Ziel</small>
                    <strong>${escapeHtml(ride.destination)}</strong>
                  </span>
                </div>
              </div>

              <div class="dispatch-ride-copy">
                <strong>${escapeHtml(ride.customer_name)}</strong>
                <div>
                  <span>👨‍✈️ ${escapeHtml(names.join(", ") || "Fahrer offen")}</span>
                  <span>🚕 ${escapeHtml(ride.vehicle_name || "Fahrzeug offen")}</span>
                  <span>📌 ${escapeHtml(ride.ride_type)}</span>
                </div>
              </div>

              <div class="dispatch-ride-actions">
                <span class="${badgeClass(ride.status)}">${escapeHtml(ride.status)}</span>
                <button data-dispatch-edit-ride="${ride.id}">
                  ${names.length && ride.vehicle_id ? "Bearbeiten" : "Jetzt zuweisen"}
                </button>
              </div>
            </article>
          `;
        }).join("")
      : '<div class="empty dispatch-empty">Keine offenen Fahrten.</div>';

    $("#dispatch-drivers").innerHTML = drivers.length
      ? drivers.map((driver) => {
          const state = driverState(driver);

          return `
            <article class="dispatch-item driver-item ${state.className}">
              <span class="driver-avatar">
                ${escapeHtml((driver.full_name || "?").trim().charAt(0).toUpperCase())}
              </span>

              <span class="dispatch-item-copy">
                <strong>${escapeHtml(driver.full_name)}</strong>
                <small>
                  ${
                    state.ride
                      ? `Aktuell: ${escapeHtml(state.ride.destination)}`
                      : "Bereit für neue Fahrt"
                  }
                </small>
                <em>
                  ${
                    state.ride
                      ? `${escapeHtml(state.ride.ride_time?.slice(0, 5) || "")} Uhr`
                      : "Kein Auftrag"
                  }
                </em>
              </span>

              <span class="visual-status ${state.className}">
                <i></i>${state.label}
              </span>
            </article>
          `;
        }).join("")
      : '<div class="empty dispatch-empty">Noch keine Fahrer in Supabase angelegt.</div>';

    $$("[data-dispatch-edit-ride]").forEach((button) => {
      button.addEventListener("click", () => {
        openRide(rides.find((ride) => ride.id === button.dataset.dispatchEditRide));
      });
    });

    $$("[data-dispatch-vehicle]").forEach((button) => {
      button.addEventListener("click", () => {
        openVehicle(fleet.find((vehicle) => vehicle.id === button.dataset.dispatchVehicle));
      });
    });
  }

  function renderStats() {
    const today = localIsoDate();

    $("#stat-today").textContent = rides.filter((ride) => ride.ride_date === today).length;
    $("#stat-open").textContent = rides.filter((ride) => ride.status === "Offen").length;
    $("#stat-active").textContent = rides.filter((ride) => ride.status === "Unterwegs").length;
    $("#stat-available").textContent = fleet.filter((vehicle) => vehicle.status === "Verfügbar").length;
  }

  function renderOverview() {
    const upcoming = [...rides]
      .filter((ride) => ride.status !== "Abgeschlossen")
      .sort((a, b) => `${a.ride_date}${a.ride_time}`.localeCompare(`${b.ride_date}${b.ride_time}`))
      .slice(0, 5);

    $("#upcoming-rides").innerHTML = upcoming.length
      ? upcoming.map((ride) => `
          <div class="compact-item">
            <div>
              <strong>${escapeHtml(ride.ride_time?.slice(0, 5) || "–")} · ${escapeHtml(ride.customer_name)}</strong>
              <small>${escapeHtml(ride.pickup)} → ${escapeHtml(ride.destination)}</small>
            </div>
            <span class="${badgeClass(ride.status)}">${escapeHtml(ride.status)}</span>
          </div>
        `).join("")
      : '<div class="empty">Noch keine Fahrten vorhanden.</div>';

    $("#fleet-summary").innerHTML = fleet.length
      ? fleet.map((vehicle) => `
          <div class="compact-item">
            <div>
              <strong>${escapeHtml(vehicle.name)}</strong>
              <small>${escapeHtml(vehicle.location)} · ${escapeHtml(vehicle.fuel_level)}</small>
            </div>
            <span class="${badgeClass(vehicle.status)}">${escapeHtml(vehicle.status)}</span>
          </div>
        `).join("")
      : '<div class="empty">Noch keine Fahrzeuge vorhanden.</div>';
  }

  function renderRides() {
    const sorted = [...rides].sort((a, b) => {
      return `${a.ride_date}${a.ride_time}`.localeCompare(`${b.ride_date}${b.ride_time}`);
    });

    $("#rides-list").innerHTML = sorted.length
      ? sorted.map((ride) => {
          const names = rideDriverNames(ride);

          return `
            <article class="ride-card">
              <div class="ride-time">
                <strong>${escapeHtml(ride.ride_time?.slice(0, 5) || "–")}</strong>
                <span>${formatDate(ride.ride_date)}</span>
              </div>

              <div class="ride-main">
                <h3>${escapeHtml(ride.customer_name)}</h3>
                <p>${escapeHtml(ride.pickup)} → ${escapeHtml(ride.destination)}</p>

                <div class="ride-meta">
                  <span class="pill">${escapeHtml(names.join(", ") || "Fahrer offen")}</span>
                  <span class="pill">${escapeHtml(ride.vehicle_name || "Fahrzeug offen")}</span>
                  <span class="pill">${escapeHtml(ride.ride_type)}</span>
                  ${
                    ride.note
                      ? `<span class="pill">${escapeHtml(ride.note)}</span>`
                      : ""
                  }
                </div>
              </div>

              <div class="ride-actions">
                <select data-ride-status="${ride.id}">
                  ${["Offen", "Zugewiesen", "Unterwegs", "Abgeschlossen"]
                    .map((status) => `
                      <option ${status === ride.status ? "selected" : ""}>
                        ${status}
                      </option>
                    `)
                    .join("")}
                </select>

                ${
                  canDispatch()
                    ? `
                      <button data-edit-ride="${ride.id}">Bearbeiten</button>
                      <button data-delete-ride="${ride.id}">Löschen</button>
                    `
                    : ""
                }
              </div>
            </article>
          `;
        }).join("")
      : '<div class="empty">Noch keine Fahrten eingetragen.</div>';

    $$("[data-ride-status]").forEach((select) => {
      select.addEventListener("change", async () => {
        select.disabled = true;

        const { error } = await db
          .from("rides")
          .update({ status: select.value })
          .eq("id", select.dataset.rideStatus);

        select.disabled = false;

        if (error) {
          alert(`Status konnte nicht gespeichert werden: ${error.message}`);
          await loadData();
        }
      });
    });

    $$("[data-edit-ride]").forEach((button) => {
      button.addEventListener("click", () => {
        openRide(rides.find((ride) => ride.id === button.dataset.editRide));
      });
    });

    $$("[data-delete-ride]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Diese Fahrt wirklich löschen?")) return;

        const { error } = await db
          .from("rides")
          .delete()
          .eq("id", button.dataset.deleteRide);

        if (error) {
          alert(`Fahrt konnte nicht gelöscht werden: ${error.message}`);
        }
      });
    });
  }

  function fuelPercent(value) {
    const text = String(value || "").toLowerCase();

    if (text.includes("voll") && !text.includes("halb")) return 100;
    if (text.includes("¾")) return 75;
    if (text.includes("halb")) return 50;
    if (text.includes("¼")) return 25;
    if (text.includes("reserve")) return 10;

    const parsed = parseInt(text.replace(/\D/g, ""), 10);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0;
  }

  function renderFleet() {
    $("#fleet-list").innerHTML = fleet.length
      ? fleet.map((vehicle) => {
          const state = vehicleState(vehicle);
          const cleanText = String(vehicle.cleanliness || "").toLowerCase();

          const cleanClass = cleanText === "sauber"
            ? "good"
            : cleanText.includes("leicht")
              ? "medium"
              : "bad";

          const currentDriver = vehicle.current_driver_name || "Nicht zugewiesen";

          return `
            <article class="vehicle-card premium-vehicle-card ${state}">
              <div class="vehicle-visual">
                <div class="vehicle-silhouette" aria-hidden="true">🚕</div>

                <div class="vehicle-live-status ${state}">
                  <i></i>${escapeHtml(vehicle.status)}
                </div>
              </div>

              <div class="vehicle-card-body">
                <div class="vehicle-head premium-head">
                  <div>
                    <p>Taxi-Erbas-Fuhrpark</p>
                    <h3>${escapeHtml(vehicle.name)}</h3>
                    <span class="plate-number">${escapeHtml(vehicle.plate)}</span>
                  </div>

                  <button
                    class="vehicle-edit-icon"
                    data-edit-vehicle="${vehicle.id}"
                    aria-label="Fahrzeug bearbeiten">
                    ✎
                  </button>
                </div>

                <div class="vehicle-driver-row">
                  <span class="vehicle-info-icon">👨‍✈️</span>
                  <div>
                    <small>Aktueller Fahrer</small>
                    <strong>${escapeHtml(currentDriver)}</strong>
                  </div>
                </div>

                <div class="vehicle-details">
                  <div class="vehicle-detail">
                    <span>📍</span>
                    <div>
                      <small>Standort</small>
                      <strong>${escapeHtml(vehicle.location || "Unbekannt")}</strong>
                    </div>
                  </div>

                  <div class="vehicle-detail">
                    <span>🛣️</span>
                    <div>
                      <small>Kilometerstand</small>
                      <strong>${Number(vehicle.mileage || 0).toLocaleString("de-DE")} km</strong>
                    </div>
                  </div>
                </div>

                <div class="vehicle-condition">
                  <div class="condition-head">
                    <span>Tankstand</span>
                    <strong>${escapeHtml(vehicle.fuel_level || "–")}</strong>
                  </div>

                  <div class="fuel-track">
                    <i style="width:${fuelPercent(vehicle.fuel_level)}%"></i>
                  </div>
                </div>

                <div class="vehicle-cleanliness">
                  <span>Sauberkeit</span>

                  <strong class="${cleanClass}">
                    <i></i>
                    ${escapeHtml(vehicle.cleanliness || "Nicht geprüft")}
                  </strong>
                </div>

                <div class="vehicle-note premium-note">
                  <span>Hinweis</span>
                  <p>${escapeHtml(vehicle.note || "Keine offenen Hinweise oder Mängel.")}</p>
                </div>

                <div class="vehicle-actions premium-actions">
                  <button class="vehicle-main-action" data-edit-vehicle="${vehicle.id}">
                    Fahrzeug verwalten
                  </button>

                  ${
                    canDispatch()
                      ? `
                        <button
                          class="vehicle-delete-action"
                          data-delete-vehicle="${vehicle.id}"
                          title="Fahrzeug löschen">
                          ⌫
                        </button>
                      `
                      : ""
                  }
                </div>
              </div>
            </article>
          `;
        }).join("")
      : '<div class="empty">Noch keine Fahrzeuge angelegt.</div>';

    $$("[data-edit-vehicle]").forEach((button) => {
      button.addEventListener("click", () => {
        openVehicle(fleet.find((vehicle) => vehicle.id === button.dataset.editVehicle));
      });
    });

    $$("[data-delete-vehicle]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Dieses Fahrzeug wirklich entfernen? Bestehende Fahrten bleiben erhalten.")) return;

        const { error } = await db
          .from("vehicles")
          .delete()
          .eq("id", button.dataset.deleteVehicle);

        if (error) {
          alert(`Fahrzeug konnte nicht gelöscht werden: ${error.message}`);
        }
      });
    });
  }

  function refreshVehicleOptions(selectId = "ride-vehicle-select", selected = "") {
    const select = $(`#${selectId}`);
    if (!select) return;

    select.innerHTML = `
      <option value="">Noch offen</option>
      ${fleet.map((vehicle) => `
        <option value="${vehicle.id}" ${vehicle.id === selected ? "selected" : ""}>
          ${escapeHtml(vehicle.name)} (${escapeHtml(vehicle.plate)})
        </option>
      `).join("")}
    `;
  }

  function renderDriverCheckboxes(containerId, selectedIds = []) {
    const container = $(`#${containerId}`);
    if (!container) return;

    const selected = new Set(selectedIds);

    container.innerHTML = drivers
      .filter((driver) => driver.active)
      .map((driver) => `
        <label>
          <input
            type="checkbox"
            value="${driver.id}"
            ${selected.has(driver.id) ? "checked" : ""}>
          <span>${escapeHtml(driver.full_name)}</span>
        </label>
      `)
      .join("");
  }

  async function openRide(ride = null, presetDate = null) {
    const form = $("#ride-form");
    form.reset();

    form.elements.id.value = ride?.id || "";
    form.elements.customer.value = ride?.customer_name || "";
    form.elements.phone.value = ride?.customer_phone || "";
    form.elements.pickup.value = ride?.pickup || "";
    form.elements.destination.value = ride?.destination || "";
    form.elements.date.value = ride?.ride_date || presetDate || localIsoDate();
    form.elements.time.value = ride?.ride_time?.slice(0, 5) || "";
    form.elements.status.value = ride?.status || "Offen";
    form.elements.type.value = ride?.ride_type || "Taxifahrt";
    form.elements.note.value = ride?.note || "";

    refreshVehicleOptions("ride-vehicle-select", ride?.vehicle_id || "");
    renderDriverCheckboxes("ride-driver-list", ride ? rideDriverIds(ride.id) : []);

    const seriesInfo = $("#series-occurrence-info");
    if (seriesInfo) seriesInfo.hidden = true;

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

  $$("[data-open-ride]").forEach((button) => {
    button.addEventListener("click", () => openRide());
  });

  $$("[data-open-vehicle]").forEach((button) => {
    button.addEventListener("click", () => openVehicle());
  });

  $("#ride-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canDispatch()) return;

    const form = event.currentTarget;
    const raw = Object.fromEntries(new FormData(form));

    const selectedIds = selectedDriverIds("ride-driver-list");
    const selectedNames = driverNames(selectedIds);

    const vehicle = fleet.find((item) => item.id === raw.vehicle);

    const payload = {
      customer_name: raw.customer,
      customer_phone: raw.phone || null,
      pickup: raw.pickup,
      destination: raw.destination,
      ride_date: raw.date,
      ride_time: raw.time,
      assigned_driver: selectedIds[0] || null,
      driver_name: selectedNames[0] || null,
      vehicle_id: raw.vehicle || null,
      vehicle_name: vehicle?.name || null,
      status: raw.status,
      ride_type: raw.type,
      note: raw.note || null
    };

    let rideId = raw.id;

    if (rideId) {
      const { error } = await db
        .from("rides")
        .update(payload)
        .eq("id", rideId);

      if (error) {
        alert(`Fahrt konnte nicht gespeichert werden: ${error.message}`);
        return;
      }
    } else {
      const { data, error } = await db
        .from("rides")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        alert(`Fahrt konnte nicht gespeichert werden: ${error.message}`);
        return;
      }

      rideId = data.id;
    }

    await db
      .from("ride_drivers")
      .delete()
      .eq("ride_id", rideId);

    if (selectedIds.length) {
      const rows = selectedIds.map((driverId) => ({
        ride_id: rideId,
        driver_id: driverId,
        driver_name: drivers.find((driver) => driver.id === driverId)?.full_name || null
      }));

      const { error } = await db.from("ride_drivers").insert(rows);

      if (error) {
        alert(`Fahrer konnten nicht vollständig zugewiesen werden: ${error.message}`);
      }
    }

    $("#ride-dialog").close();
    await loadData({ notify: true });
  });

  $("#vehicle-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const raw = Object.fromEntries(new FormData(event.currentTarget));

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
      alert(`Fahrzeug konnte nicht gespeichert werden: ${result.error.message}`);
      return;
    }

    $("#vehicle-dialog").close();
    await loadData();
  });

  function isRecurringException(recurringId, dateString) {
    return recurringExceptions.find((item) => {
      return item.recurring_id === recurringId && item.occurrence_date === dateString;
    });
  }

  function recurringOccursOn(item, dateString) {
    if (!item.active) return false;

    const date = new Date(`${dateString}T12:00:00`);
    const start = new Date(`${item.start_date}T12:00:00`);

    if (date < start) return false;

    if (item.end_date) {
      const end = new Date(`${item.end_date}T12:00:00`);
      if (date > end) return false;
    }

    const weekdays = Array.isArray(item.weekdays)
      ? item.weekdays.map(Number)
      : [];

    if (!weekdays.includes(date.getDay())) return false;

    const exception = isRecurringException(item.id, dateString);

    if (exception?.action === "skip") return false;

    return true;
  }

  function recurringOccurrence(item, dateString) {
    const exception = isRecurringException(item.id, dateString);

    return {
      synthetic: true,
      key: `recurring:${item.id}:${dateString}`,
      recurring_id: item.id,
      ride_date: dateString,
      ride_time: item.ride_time,
      customer_name: exception?.override_customer_name || item.passenger_name,
      customer_phone: item.phone,
      pickup: item.pickup,
      destination: item.destination,
      vehicle_id: item.vehicle_id,
      vehicle_name: item.vehicle_name,
      ride_type: item.ride_type,
      note: item.note,
      status: "Wiederholung",
      driver_names: recurringDriverNames(item)
    };
  }

  function ridesForDate(dateString) {
    const normal = rides
      .filter((ride) => ride.ride_date === dateString)
      .map((ride) => ({
        ...ride,
        synthetic: false,
        key: `ride:${ride.id}`,
        driver_names: rideDriverNames(ride)
      }));

    const series = recurring
      .filter((item) => recurringOccursOn(item, dateString))
      .map((item) => recurringOccurrence(item, dateString));

    return [...normal, ...series].sort((a, b) => {
      return String(a.ride_time || "").localeCompare(String(b.ride_time || ""));
    });
  }

  function renderCalendar() {
    if (!$("#calendar-grid")) return;

    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();

    $("#calendar-title").textContent = new Intl.DateTimeFormat("de-DE", {
      month: "long",
      year: "numeric"
    }).format(calendarCursor);

    const first = new Date(year, month, 1);
    const weekday = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - weekday);

    const today = localIsoDate();
    const cells = [];

    for (let index = 0; index < 42; index += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);

      const dateString = localIsoDate(date);
      const dayRides = ridesForDate(dateString);
      const inMonth = date.getMonth() === month;

      const visibleEvents = dayRides.slice(0, 3);

      cells.push(`
        <button
          type="button"
          class="calendar-day ${inMonth ? "" : "other-month"} ${dateString === today ? "today" : ""}"
          data-calendar-date="${dateString}">

          <div class="calendar-day-number">
            <span>${date.getDate()}</span>
            ${dayRides.length ? `<span class="calendar-day-count">${dayRides.length}</span>` : ""}
          </div>

          <div class="calendar-events">
            ${visibleEvents.map((ride) => `
              <div class="calendar-event ${
                ride.status === "Unterwegs"
                  ? "underway"
                  : ride.status === "Zugewiesen" || ride.synthetic
                    ? "assigned"
                    : ""
              }">
                ${escapeHtml(ride.ride_time?.slice(0, 5) || "–")} · ${escapeHtml(ride.customer_name)}
              </div>
            `).join("")}
          </div>
        </button>
      `);
    }

    $("#calendar-grid").innerHTML = cells.join("");

    $$("[data-calendar-date]").forEach((button) => {
      button.addEventListener("click", () => {
        openDay(button.dataset.calendarDate);
      });
    });
  }

  $("#calendar-prev")?.addEventListener("click", () => {
    calendarCursor.setMonth(calendarCursor.getMonth() - 1);
    renderCalendar();
  });

  $("#calendar-next")?.addEventListener("click", () => {
    calendarCursor.setMonth(calendarCursor.getMonth() + 1);
    renderCalendar();
  });

  $("#calendar-today")?.addEventListener("click", () => {
    calendarCursor = new Date();
    calendarCursor.setDate(1);
    renderCalendar();
  });

  function openDay(dateString) {
    selectedCalendarDate = dateString;

    $("#day-dialog-title").textContent = `Fahrten am ${formatLongDate(dateString)}`;

    const dayRides = ridesForDate(dateString);

    $("#day-rides-list").innerHTML = dayRides.length
      ? dayRides.map((ride) => `
          <article class="day-ride-card">
            <strong class="day-ride-time">${escapeHtml(ride.ride_time?.slice(0, 5) || "–")}</strong>

            <div>
              <strong>${escapeHtml(ride.customer_name)}</strong>
              <small>${escapeHtml(ride.pickup)} → ${escapeHtml(ride.destination)}</small>
              <small>
                👨‍✈️ ${escapeHtml((ride.driver_names || []).join(", ") || "Fahrer offen")}
                · 🚕 ${escapeHtml(ride.vehicle_name || "Fahrzeug offen")}
              </small>
            </div>

            <div class="day-ride-actions">
              ${
                ride.synthetic
                  ? `
                    <button data-edit-recurring="${ride.recurring_id}">Serie bearbeiten</button>
                    <button class="skip" data-skip-recurring="${ride.recurring_id}" data-date="${dateString}">
                      Nur diesen Termin aussetzen
                    </button>
                  `
                  : `
                    <button data-edit-day-ride="${ride.id}">Bearbeiten</button>
                  `
              }
            </div>
          </article>
        `).join("")
      : '<div class="empty">An diesem Tag sind keine Fahrten eingetragen.</div>';

    $$("[data-edit-day-ride]").forEach((button) => {
      button.addEventListener("click", () => {
        $("#day-dialog").close();
        openRide(rides.find((ride) => ride.id === button.dataset.editDayRide));
      });
    });

    $$("[data-edit-recurring]").forEach((button) => {
      button.addEventListener("click", () => {
        $("#day-dialog").close();
        openRecurring(recurring.find((item) => item.id === button.dataset.editRecurring));
      });
    });

    $$("[data-skip-recurring]").forEach((button) => {
      button.addEventListener("click", async () => {
        const item = recurring.find((entry) => entry.id === button.dataset.skipRecurring);

        if (!confirm(
          `Nur die Fahrt "${item?.title || ""}" am ${formatDate(button.dataset.date)} aussetzen?\n\nDie restliche Serie bleibt bestehen.`
        )) return;

        const { error } = await db
          .from("recurring_exceptions")
          .upsert({
            recurring_id: button.dataset.skipRecurring,
            occurrence_date: button.dataset.date,
            action: "skip"
          }, {
            onConflict: "recurring_id,occurrence_date"
          });

        if (error) {
          alert(`Termin konnte nicht ausgesetzt werden: ${error.message}`);
          return;
        }

        await loadData();
        openDay(button.dataset.date);
      });
    });

    $("#day-dialog").showModal();
  }

  $("#day-new-ride")?.addEventListener("click", () => {
    $("#day-dialog").close();
    openRide(null, selectedCalendarDate);
  });

  function weekdayLabel(day) {
    return ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][Number(day)];
  }

  function renderRecurring() {
    if (!$("#recurring-list")) return;

    $("#recurring-list").innerHTML = recurring.length
      ? recurring.map((item) => {
          const names = recurringDriverNames(item);
          const weekdays = Array.isArray(item.weekdays) ? item.weekdays : [];

          return `
            <article class="recurring-card">
              <div class="recurring-card-head">
                <div>
                  <h3>${escapeHtml(item.title)}</h3>
                  <span>${escapeHtml(item.ride_time?.slice(0, 5) || "–")} Uhr</span>
                </div>
                <span class="${item.active ? "badge" : "badge danger"}">
                  ${item.active ? "Aktiv" : "Pausiert"}
                </span>
              </div>

              <div class="recurring-person">
                <small>Gefahrene Person</small>
                <strong>${escapeHtml(item.passenger_name)}</strong>
              </div>

              <div class="recurring-meta">
                <div>
                  <small>Route</small>
                  <strong>${escapeHtml(item.pickup)} → ${escapeHtml(item.destination)}</strong>
                </div>

                <div>
                  <small>Fahrer</small>
                  <strong>${escapeHtml(names.join(", ") || "Noch offen")}</strong>
                </div>

                <div>
                  <small>Start</small>
                  <strong>${formatDate(item.start_date)}</strong>
                </div>

                <div>
                  <small>Ende</small>
                  <strong>${item.end_date ? formatDate(item.end_date) : "Ohne Enddatum"}</strong>
                </div>
              </div>

              <div class="recurring-days">
                ${weekdays.map((day) => `<span>${weekdayLabel(day)}</span>`).join("")}
              </div>

              <div class="recurring-actions">
                <button data-edit-recurring-card="${item.id}">Bearbeiten</button>
                <button data-toggle-recurring="${item.id}">
                  ${item.active ? "Pausieren" : "Aktivieren"}
                </button>
                <button class="delete" data-delete-recurring="${item.id}">Löschen</button>
              </div>
            </article>
          `;
        }).join("")
      : '<div class="empty">Noch keine Wiederholungsfahrten angelegt.</div>';

    $$("[data-edit-recurring-card]").forEach((button) => {
      button.addEventListener("click", () => {
        openRecurring(recurring.find((item) => item.id === button.dataset.editRecurringCard));
      });
    });

    $$("[data-toggle-recurring]").forEach((button) => {
      button.addEventListener("click", async () => {
        const item = recurring.find((entry) => entry.id === button.dataset.toggleRecurring);
        if (!item) return;

        const { error } = await db
          .from("recurring_rides")
          .update({ active: !item.active })
          .eq("id", item.id);

        if (error) {
          alert(`Serie konnte nicht geändert werden: ${error.message}`);
        }
      });
    });

    $$("[data-delete-recurring]").forEach((button) => {
      button.addEventListener("click", async () => {
        const item = recurring.find((entry) => entry.id === button.dataset.deleteRecurring);

        if (!confirm(`Wiederholungsfahrt "${item?.title || ""}" wirklich vollständig löschen?`)) return;

        const { error } = await db
          .from("recurring_rides")
          .delete()
          .eq("id", button.dataset.deleteRecurring);

        if (error) {
          alert(`Serie konnte nicht gelöscht werden: ${error.message}`);
        }
      });
    });
  }

  function openRecurring(item = null) {
    const form = $("#recurring-form");
    form.reset();

    form.elements.id.value = item?.id || "";
    form.elements.title.value = item?.title || "";
    form.elements.passenger.value = item?.passenger_name || "";
    form.elements.phone.value = item?.phone || "";
    form.elements.time.value = item?.ride_time?.slice(0, 5) || "";
    form.elements.pickup.value = item?.pickup || "";
    form.elements.destination.value = item?.destination || "";
    form.elements.start_date.value = item?.start_date || localIsoDate();
    form.elements.end_date.value = item?.end_date || "";
    form.elements.type.value = item?.ride_type || "Taxifahrt";
    form.elements.note.value = item?.note || "";

    const selectedWeekdays = new Set(
      (Array.isArray(item?.weekdays) ? item.weekdays : [1, 2, 3, 4, 5]).map(Number)
    );

    $$("#recurring-weekdays input").forEach((input) => {
      input.checked = selectedWeekdays.has(Number(input.value));
    });

    refreshVehicleOptions("recurring-vehicle-select", item?.vehicle_id || "");
    renderDriverCheckboxes(
      "recurring-driver-list",
      item ? recurringDriverIds(item.id) : []
    );

    $("#recurring-dialog").showModal();
  }

  $("#open-recurring")?.addEventListener("click", () => openRecurring());

  $("#recurring-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canDispatch()) return;

    const form = event.currentTarget;
    const raw = Object.fromEntries(new FormData(form));

    const weekdays = $$("#recurring-weekdays input:checked").map((input) => Number(input.value));

    if (!weekdays.length) {
      alert("Bitte mindestens einen Wochentag auswählen.");
      return;
    }

    const selectedIds = selectedDriverIds("recurring-driver-list");
    const vehicle = fleet.find((item) => item.id === raw.vehicle);

    const payload = {
      title: raw.title,
      passenger_name: raw.passenger,
      phone: raw.phone || null,
      pickup: raw.pickup,
      destination: raw.destination,
      ride_time: raw.time,
      start_date: raw.start_date,
      end_date: raw.end_date || null,
      weekdays,
      vehicle_id: raw.vehicle || null,
      vehicle_name: vehicle?.name || null,
      ride_type: raw.type,
      note: raw.note || null,
      active: true
    };

    let recurringId = raw.id;

    if (recurringId) {
      const { error } = await db
        .from("recurring_rides")
        .update(payload)
        .eq("id", recurringId);

      if (error) {
        alert(`Wiederholungsfahrt konnte nicht gespeichert werden: ${error.message}`);
        return;
      }
    } else {
      const { data, error } = await db
        .from("recurring_rides")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        alert(`Wiederholungsfahrt konnte nicht gespeichert werden: ${error.message}`);
        return;
      }

      recurringId = data.id;
    }

    await db
      .from("recurring_ride_drivers")
      .delete()
      .eq("recurring_id", recurringId);

    if (selectedIds.length) {
      const rows = selectedIds.map((driverId) => ({
        recurring_id: recurringId,
        driver_id: driverId,
        driver_name: drivers.find((driver) => driver.id === driverId)?.full_name || null
      }));

      const { error } = await db.from("recurring_ride_drivers").insert(rows);

      if (error) {
        alert(`Fahrer konnten nicht vollständig gespeichert werden: ${error.message}`);
      }
    }

    $("#recurring-dialog").close();
    await loadData();
  });

  function notificationsSupported() {
    return "Notification" in window;
  }

  function updateNotificationUi() {
    const button = $("#notification-button");
    const state = $("#notification-state");

    if (!button || !state) return;

    if (!notificationsSupported()) {
      button.disabled = true;
      state.textContent = "auf diesem Gerät nicht unterstützt";
      return;
    }

    if (Notification.permission === "granted") {
      state.textContent = "aktiviert";
      button.textContent = "🔔 Benachrichtigungen aktiv";
    } else if (Notification.permission === "denied") {
      state.textContent = "im Browser blockiert";
      button.textContent = "🔕 Benachrichtigungen blockiert";
    } else {
      state.textContent = "nicht aktiviert";
      button.textContent = "🔔 Benachrichtigungen";
    }
  }

  $("#notification-button")?.addEventListener("click", async () => {
    if (!notificationsSupported()) return;

    const permission = await Notification.requestPermission();
    updateNotificationUi();

    if (permission === "granted") {
      new Notification("Taxi Erbas", {
        body: "Benachrichtigungen für das Fahrerportal sind aktiviert."
      });
    }
  });

  function driverRelevantRideKeys() {
    if (profile?.role !== "driver") return [];

    const normal = rides
      .filter((ride) => rideDriverIds(ride.id).includes(profile.id))
      .map((ride) => `ride:${ride.id}:${ride.updated_at || ""}:${ride.status}`);

    const series = recurring
      .filter((item) => recurringDriverIds(item.id).includes(profile.id))
      .map((item) => `recurring:${item.id}:${item.updated_at || ""}`);

    return [...normal, ...series];
  }

  function notifyDriverAboutChanges() {
    if (profile?.role !== "driver") return;
    if (!notificationsSupported()) return;
    if (Notification.permission !== "granted") return;

    const current = new Set(driverRelevantRideKeys());

    if (!notificationKnownRideIds.size) {
      notificationKnownRideIds = current;
      return;
    }

    const additions = [...current].filter((key) => !notificationKnownRideIds.has(key));

    if (additions.length) {
      new Notification("Taxi Erbas – Neuer oder geänderter Auftrag", {
        body: "Es gibt eine neue oder geänderte Fahrt in deinem Fahrerportal."
      });
    }

    notificationKnownRideIds = current;
  }

  $$("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      button.closest("dialog")?.close();
    });
  });

  $$("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      const rect = dialog.getBoundingClientRect();

      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!inside) dialog.close();
    });

    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dialog.close();
    });
  });

  function renderAll() {
    renderDispatch();
    renderStats();
    renderOverview();
    renderRides();
    renderFleet();
    renderCalendar();
    renderRecurring();

    refreshVehicleOptions("ride-vehicle-select");
    refreshVehicleOptions("recurring-vehicle-select");
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
})();    if (vehicleResult.error) throw vehicleResult.error;

    rides = rideResult.data || [];
    fleet = vehicleResult.data || [];
    drivers = driverResult.error ? [] : (driverResult.data || []);
    renderAll();
  }

  function subscribeRealtime() {
    if (realtimeChannel) db.removeChannel(realtimeChannel);

    realtimeChannel = db
      .channel("taxi-erbas-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"rides" }, loadData)
      .on("postgres_changes", { event:"*", schema:"public", table:"vehicles" }, loadData)
      .on("postgres_changes", { event:"*", schema:"public", table:"profiles" }, loadData)
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

    const dispatchNav = $(".dispatch-nav");
    if (!canDispatch()) {
      dispatchNav.style.display = "none";
      $$(".nav-button").forEach(b => b.classList.remove("active"));
      $$(".view").forEach(v => v.classList.remove("active"));
      $('[data-view="overview"]').classList.add("active");
      $("#view-overview").classList.add("active");
      $("#page-title").textContent = "Übersicht";
    } else {
      startDispatchClock();
    }

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


  function startDispatchClock() {
    const updateClock = () => {
      const now = new Date();
      const clock = $("#dispatch-clock");
      const date = $("#dispatch-date");
      if (clock) clock.textContent = now.toLocaleTimeString("de-DE", { hour:"2-digit", minute:"2-digit" });
      if (date) date.textContent = now.toLocaleDateString("de-DE", {
        weekday:"long", day:"2-digit", month:"2-digit", year:"numeric"
      });
    };
    updateClock();
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(updateClock, 30000);
  }

  function driverState(driver) {
    const activeRide = rides.find(r =>
      r.assigned_driver === driver.id && ["Zugewiesen", "Unterwegs"].includes(r.status)
    );
    if (!driver.active) return { label:"Deaktiviert", className:"offline", ride:null };
    if (activeRide?.status === "Unterwegs") return { label:"Unterwegs", className:"busy", ride:activeRide };
    if (activeRide) return { label:"Zugewiesen", className:"reserved", ride:activeRide };
    return { label:"Frei", className:"free", ride:null };
  }

  function renderDispatch() {
    if (!canDispatch() || !$("#dispatch-rides")) return;

    const openRides = rides.filter(r => r.status !== "Abgeschlossen");
    const activeRides = rides.filter(r => r.status === "Unterwegs");
    const freeVehicles = fleet.filter(v => v.status === "Verfügbar");
    const freeDrivers = drivers.filter(d => driverState(d).label === "Frei");

    $("#dispatch-open-count").textContent = openRides.length;
    $("#dispatch-free-vehicles").textContent = freeVehicles.length;
    $("#dispatch-free-drivers").textContent = freeDrivers.length;
    $("#dispatch-active-count").textContent = activeRides.length;

    $("#dispatch-vehicles").innerHTML = fleet.length ? fleet.map(v => `
      <button class="dispatch-item dispatch-vehicle-item" data-dispatch-vehicle="${v.id}">
        <span class="state-light ${v.status === "Verfügbar" ? "free" : v.status === "Unterwegs" ? "busy" : "offline"}"></span>
        <span class="dispatch-item-copy">
          <strong>${escapeHtml(v.name)}</strong>
          <small>${escapeHtml(v.plate)} · ${escapeHtml(v.location)}</small>
        </span>
        <span class="${badgeClass(v.status)}">${escapeHtml(v.status)}</span>
      </button>`).join("") : '<div class="empty dispatch-empty">Noch keine Fahrzeuge angelegt.</div>';

    $("#dispatch-rides").innerHTML = openRides.length ? openRides.map(r => `
      <article class="dispatch-ride">
        <div class="dispatch-ride-time">
          <strong>${escapeHtml(r.ride_time?.slice(0,5) || "–")}</strong>
          <span>${formatDate(r.ride_date)}</span>
        </div>
        <div class="dispatch-ride-copy">
          <strong>${escapeHtml(r.customer_name)}</strong>
          <small>${escapeHtml(r.pickup)} → ${escapeHtml(r.destination)}</small>
          <div>
            <span>${escapeHtml(r.driver_name || "Fahrer offen")}</span>
            <span>${escapeHtml(r.vehicle_name || "Fahrzeug offen")}</span>
          </div>
        </div>
        <div class="dispatch-ride-actions">
          <span class="${badgeClass(r.status)}">${escapeHtml(r.status)}</span>
          <button data-dispatch-edit-ride="${r.id}">${r.assigned_driver && r.vehicle_id ? "Bearbeiten" : "Zuweisen"}</button>
        </div>
      </article>`).join("") : '<div class="empty dispatch-empty">Keine offenen Fahrten.</div>';

    $("#dispatch-drivers").innerHTML = drivers.length ? drivers.map(d => {
      const state = driverState(d);
      return `
        <article class="dispatch-item driver-item">
          <span class="driver-avatar">${escapeHtml((d.full_name || "?").trim().charAt(0).toUpperCase())}</span>
          <span class="dispatch-item-copy">
            <strong>${escapeHtml(d.full_name)}</strong>
            <small>${state.ride ? `${escapeHtml(state.ride.ride_time?.slice(0,5) || "")} · ${escapeHtml(state.ride.destination)}` : "Kein aktiver Auftrag"}</small>
          </span>
          <span class="driver-state ${state.className}">${state.label}</span>
        </article>`;
    }).join("") : '<div class="empty dispatch-empty">Noch keine Fahrer in Supabase angelegt.</div>';

    $$("[data-dispatch-edit-ride]").forEach(btn =>
      btn.addEventListener("click", () => openRide(rides.find(r => r.id === btn.dataset.dispatchEditRide)))
    );

    $$("[data-dispatch-vehicle]").forEach(btn =>
      btn.addEventListener("click", () => openVehicle(fleet.find(v => v.id === btn.dataset.dispatchVehicle)))
    );
  }

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
    select.innerHTML = '<option value="">Noch offen</option>' +
      drivers.filter(d => d.active).map(d =>
        `<option value="${d.id}" ${d.id===selected?"selected":""}>${escapeHtml(d.full_name)}</option>`
      ).join("");
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

  // Dialoge zuverlässig schließen: X, Abbrechen, Escape und Klick auf den Hintergrund.
  $$('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => {
      const dialog = button.closest('dialog');
      if (dialog?.open) dialog.close();
    });
  });

  $$('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      dialog.close();
    });
  });

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
    renderDispatch();
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
