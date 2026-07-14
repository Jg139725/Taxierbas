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
})();