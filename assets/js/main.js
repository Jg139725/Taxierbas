(() => {
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