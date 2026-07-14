(() => {
  const config = window.TAXI_CONFIG || {};
  const menuButton = document.querySelector(".menu-button");
  const nav = document.querySelector(".main-nav");

  menuButton?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(open));
  });

  nav?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");
  }));

  document.querySelectorAll(".js-phone-text").forEach(el => {
    el.textContent = config.phoneDisplay || "Wird ergänzt";
  });

  document.querySelectorAll(".js-phone-link").forEach(el => {
    if (config.phoneLink) {
      el.href = `tel:${config.phoneLink}`;
    } else {
      el.href = "#kontakt";
      el.addEventListener("click", event => {
        if (el.getAttribute("href") === "#kontakt") return;
        event.preventDefault();
      });
    }
  });

  document.getElementById("year").textContent = new Date().getFullYear();

  const form = document.getElementById("booking-form");
  const status = document.getElementById("form-status");

  form?.addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(form);
    const message = [
      `Neue Fahrtanfrage für ${config.company || "Taxi Erbas"}`,
      "",
      `Name: ${data.get("name")}`,
      `Telefon: ${data.get("phone")}`,
      `Abholort: ${data.get("pickup")}`,
      `Ziel: ${data.get("destination")}`,
      `Datum: ${data.get("date")}`,
      `Uhrzeit: ${data.get("time")}`,
      `Weitere Angaben: ${data.get("message") || "-"}`
    ].join("\n");

    if (config.whatsapp) {
      window.open(`https://wa.me/${config.whatsapp}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
      status.textContent = "Die Anfrage wurde für WhatsApp vorbereitet. Bitte dort noch absenden.";
    } else if (config.email) {
      window.location.href = `mailto:${config.email}?subject=${encodeURIComponent("Fahrtanfrage")}&body=${encodeURIComponent(message)}`;
      status.textContent = "Die Anfrage wurde in Ihrem E-Mail-Programm vorbereitet.";
    } else {
      status.textContent = "Das Formular ist im Demo-Modus. Nach Eintragung von WhatsApp oder E-Mail kann die Anfrage versendet werden.";
    }
  });
})();
