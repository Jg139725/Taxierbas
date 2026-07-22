/* Paket 6 – Premium Animationen */
/* In assets/js/main.js am ENDE einfügen */

document.addEventListener("DOMContentLoaded", () => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return;

  // Elemente mit data-animate oder typischen Klassen animieren
  const elements = document.querySelectorAll(
    '[data-animate], section h2, section p, .card, .service-card, .fleet-card, .extra-card'
  );

  elements.forEach(el => {
    if (!el.hasAttribute("data-animate")) {
      el.setAttribute("data-animate","fade-up");
    }
    el.style.opacity = "0";
    el.style.transform = "translateY(28px)";
    el.style.transition = "opacity .7s ease, transform .7s ease";
  });

  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.style.opacity="1";
        entry.target.style.transform="translateY(0)";
        io.unobserve(entry.target);
      }
    });
  },{threshold:0.15});

  elements.forEach(el=>io.observe(el));

  // sanfter Hover für Buttons
  document.querySelectorAll(".btn, .button, .primary-button").forEach(btn=>{
    btn.style.transition += ", transform .2s ease, box-shadow .2s ease";
    btn.addEventListener("mouseenter",()=>{
      btn.style.transform="translateY(-2px)";
      btn.style.boxShadow="0 12px 24px rgba(0,0,0,.18)";
    });
    btn.addEventListener("mouseleave",()=>{
      btn.style.transform="";
      btn.style.boxShadow="";
    });
  });

  // dezenter Zoom für Bilder
  document.querySelectorAll("img").forEach(img=>{
    const parent = img.parentElement;
    if(parent){
      parent.style.overflow="hidden";
      img.style.transition="transform .5s ease";
      parent.addEventListener("mouseenter",()=>img.style.transform="scale(1.04)");
      parent.addEventListener("mouseleave",()=>img.style.transform="scale(1)");
    }
  });
});
