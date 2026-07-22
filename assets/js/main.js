const b=document.querySelector(".menu-toggle"),n=document.querySelector(".main-nav");
b?.addEventListener("click",()=>n.classList.toggle("open"));
document.querySelectorAll(".main-nav a").forEach(a=>a.addEventListener("click",()=>n.classList.remove("open")));

const o=new IntersectionObserver(e=>e.forEach(i=>i.isIntersecting&&i.target.classList.add("visible")),{threshold:.1});
document.querySelectorAll(".reveal,.cards article,.fleet-gallery img").forEach(e=>{e.classList.add("reveal");o.observe(e)});

const year=document.getElementById("year");
if(year) year.textContent=new Date().getFullYear();

/* Fuhrpark-Zähler: verändert ausschließlich den Zahleninhalt, nicht das Layout. */
(function(){
  const section=document.getElementById("fuhrpark");
  if(!section) return;

  const counters=[...section.querySelectorAll(".home-fleet-stat strong")];
  if(!counters.length) return;

  const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const targets=counters.map(counter=>{
    const value=parseInt(counter.textContent.trim(),10);
    return Number.isFinite(value)?value:0;
  });

  if(reduceMotion) return;

  counters.forEach(counter=>counter.textContent="0");
  let started=false;

  function startCounters(){
    if(started) return;
    started=true;

    counters.forEach((counter,index)=>{
      const target=targets[index];
      const duration=1300;
      const startTime=performance.now();

      function update(now){
        const progress=Math.min((now-startTime)/duration,1);
        const eased=1-Math.pow(1-progress,3);
        counter.textContent=String(Math.round(target*eased));

        if(progress<1){
          requestAnimationFrame(update);
        }else{
          counter.textContent=String(target);
        }
      }

      requestAnimationFrame(update);
    });
  }

  if("IntersectionObserver" in window){
    const counterObserver=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){
        startCounters();
        counterObserver.disconnect();
      }
    },{threshold:.3});
    counterObserver.observe(section);
  }else{
    startCounters();
  }
})();


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



/* Paket 8 – Bewertungs-Karussell */
(function(){
  const section=document.getElementById("bewertungen");
  if(!section) return;

  const cards=[...section.querySelectorAll(".review-card")];
  const dots=[...section.querySelectorAll(".review-dots button")];
  const prev=section.querySelector(".review-prev");
  const next=section.querySelector(".review-next");
  let current=0;
  let timer;

  function show(index){
    current=(index+cards.length)%cards.length;
    cards.forEach((card,i)=>card.classList.toggle("is-active",i===current));
    dots.forEach((dot,i)=>dot.classList.toggle("is-active",i===current));
  }

  function restart(){
    clearInterval(timer);
    if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      timer=setInterval(()=>show(current+1),6500);
    }
  }

  prev?.addEventListener("click",()=>{show(current-1);restart()});
  next?.addEventListener("click",()=>{show(current+1);restart()});
  dots.forEach((dot,i)=>dot.addEventListener("click",()=>{show(i);restart()}));

  section.addEventListener("mouseenter",()=>clearInterval(timer));
  section.addEventListener("mouseleave",restart);

  if("IntersectionObserver" in window){
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          section.classList.add("stars-visible");
          observer.unobserve(section);
        }
      });
    },{threshold:.25});
    observer.observe(section);
  }else{
    section.classList.add("stars-visible");
  }

  show(0);
  restart();
})();
