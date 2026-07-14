(() => {

  const brandMenu = document.querySelector(".brand-menu");
  const brandMobileNav = document.querySelector(".brand-mobile-nav");
  brandMenu?.addEventListener("click", () => {
    const open = brandMobileNav?.classList.toggle("open");
    brandMenu.classList.toggle("active", Boolean(open));
    brandMenu.setAttribute("aria-expanded", String(Boolean(open)));
  });
  brandMobileNav?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    brandMobileNav.classList.remove("open");
    brandMenu?.classList.remove("active");
    brandMenu?.setAttribute("aria-expanded", "false");
  }));

  const menu = document.querySelector(".menu");
  const nav = document.querySelector(".nav nav");
  menu?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menu.setAttribute("aria-expanded", String(open));
  });
  nav?.querySelectorAll("a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const observer = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, {threshold: .12}) : null;
  document.querySelectorAll(".reveal").forEach(el => observer ? observer.observe(el) : el.classList.add("visible"));

  const form = document.getElementById("booking-form");
  const status = document.getElementById("form-status");
  form?.addEventListener("submit", e => {
    e.preventDefault();
    const d = new FormData(form);
    const body = [
      "Guten Tag Taxi Erbas,",
      "",
      "ich möchte folgende Fahrt anfragen:",
      "",
      `Name: ${d.get("name")}`,
      `Telefon: ${d.get("phone")}`,
      `Abholort: ${d.get("pickup")}`,
      `Ziel: ${d.get("destination")}`,
      `Datum: ${d.get("date")}`,
      `Uhrzeit: ${d.get("time")}`,
      `Personen: ${d.get("passengers")}`,
      `Fahrtart: ${d.get("type")}`,
      `Zusätzliche Angaben: ${d.get("message") || "-"}`,
      "",
      "Bitte bestätigen Sie mir, ob die Fahrt möglich ist.",
      "",
      "Freundliche Grüße",
      d.get("name")
    ].join("\n");
    window.location.href = `mailto:fahrdienst-erbas@hotmail.com?subject=${encodeURIComponent("Fahrtanfrage über die Webseite")}&body=${encodeURIComponent(body)}`;
    if (status) status.textContent = "Die Anfrage wurde in Ihrem E-Mail-Programm vorbereitet. Bitte dort noch absenden.";
  });

  document.querySelectorAll(".faq-item button").forEach(button => {
    button.addEventListener("click", () => {
      const item = button.closest(".faq-item");
      const open = item.classList.toggle("open");
      button.setAttribute("aria-expanded", String(open));
      button.querySelector("span").textContent = open ? "−" : "+";
    });
  });

  const wa = document.querySelector(".js-whatsapp");
  const waNumber = window.TAXI_ERBAS?.whatsapp || "";
  if (wa) {
    if (waNumber) {
      wa.href = `https://wa.me/${waNumber}?text=${encodeURIComponent("Guten Tag, ich möchte eine Fahrt bei Taxi Erbas anfragen.")}`;
      wa.target = "_blank";
      wa.rel = "noopener";
    } else {
      wa.style.display = "none";
    }
  }

  const visual = document.querySelector(".premium-visual");
  window.addEventListener("scroll", () => {
    if (!visual || window.innerWidth < 900) return;
    const y = Math.min(window.scrollY * 0.05, 24);
    visual.style.transform = `translateY(${y}px)`;
  }, {passive:true});
})();

// Zusätzlicher Feinschliff
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener("click", event => {
    const target = document.querySelector(link.getAttribute("href"));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({behavior:"smooth", block:"start"});
    }
  });
});

const dateField = document.querySelector('input[type="date"]');
if (dateField) {
  const today = new Date();
  dateField.min = today.toISOString().split("T")[0];
}

if (window.matchMedia("(pointer:fine)").matches) {
  document.querySelectorAll(".service-v2").forEach(card => {
    card.addEventListener("mousemove", event => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `translateY(-7px) rotateX(${(-y * 2).toFixed(2)}deg) rotateY(${(x * 2).toFixed(2)}deg)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

const hoursCard = document.querySelector(".live-status-card");
const statusText = document.getElementById("live-status-text");
const statusSubtext = document.getElementById("live-status-subtext");
const hoursRows = document.querySelectorAll("#hours-list [data-day]");

if (hoursRows.length) {
  const today = new Date().getDay();
  hoursRows.forEach(row => {
    row.classList.toggle("today", Number(row.dataset.day) === today);
  });
}

const confirmedHours = window.TAXI_ERBAS?.openingHours || null;
if (hoursCard && statusText && statusSubtext) {
  if (!confirmedHours) {
    hoursCard.classList.remove("open", "closed");
    statusText.textContent = "Zeiten werden geprüft";
    statusSubtext.textContent = "Noch keine bestätigten Öffnungszeiten hinterlegt";
  } else {
    const now = new Date();
    const day = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const ranges = confirmedHours[day] || [];
    const isOpen = ranges.some(range => {
      const [sh, sm] = range.start.split(":").map(Number);
      const [eh, em] = range.end.split(":").map(Number);
      return currentMinutes >= sh * 60 + sm && currentMinutes < eh * 60 + em;
    });
    hoursCard.classList.toggle("open", isOpen);
    hoursCard.classList.toggle("closed", !isOpen);
    statusText.textContent = isOpen ? "Jetzt erreichbar" : "Aktuell geschlossen";
    statusSubtext.textContent = isOpen ? "Telefonische Anfrage möglich" : "Bitte nächste bestätigte Zeit beachten";
  }
}

const closeBrandMenu = () => {
  const mobileNav = document.querySelector(".brand-mobile-nav");
  const menuButton = document.querySelector(".brand-menu");
  mobileNav?.classList.remove("open");
  menuButton?.classList.remove("active");
  menuButton?.setAttribute("aria-expanded","false");
};

window.addEventListener("resize", () => {
  if (window.innerWidth > 900) closeBrandMenu();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeBrandMenu();
});
