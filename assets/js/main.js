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





/* Paket 8 V2 – Google-Bewertungs-Slider */
(function(){
  const section=document.querySelector(".google-reviews-section");
  if(!section) return;

  const viewport=section.querySelector(".google-review-viewport");
  const track=section.querySelector(".google-review-track");
  const cards=[...section.querySelectorAll(".google-review-card")];
  const dotsWrap=section.querySelector(".google-review-dots");
  const prev=section.querySelector(".google-review-prev");
  const next=section.querySelector(".google-review-next");

  let index=0;
  let visible=3;
  let timer;

  function getVisible(){
    if(window.innerWidth<=760) return 1;
    if(window.innerWidth<=1050) return 2;
    return 3;
  }

  function maxIndex(){
    return Math.max(0,cards.length-visible);
  }

  function buildDots(){
    dotsWrap.innerHTML="";
    for(let i=0;i<=maxIndex();i++){
      const dot=document.createElement("button");
      dot.type="button";
      dot.setAttribute("aria-label","Bewertungsgruppe "+(i+1));
      dot.addEventListener("click",()=>{show(i);restart()});
      dotsWrap.appendChild(dot);
    }
  }

  function show(nextIndex){
    visible=getVisible();
    index=Math.max(0,Math.min(nextIndex,maxIndex()));

    if(window.innerWidth>760){
      const cardWidth=cards[0].getBoundingClientRect().width;
      const gap=20;
      track.style.transform=`translateX(-${index*(cardWidth+gap)}px)`;
    }

    [...dotsWrap.children].forEach((dot,i)=>{
      dot.classList.toggle("is-active",i===index);
    });
  }

  function restart(){
    clearInterval(timer);
    if(window.innerWidth>760 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      timer=setInterval(()=>{
        show(index>=maxIndex()?0:index+1);
      },6500);
    }
  }

  prev?.addEventListener("click",()=>{show(index-1);restart()});
  next?.addEventListener("click",()=>{show(index>=maxIndex()?0:index+1);restart()});

  section.addEventListener("mouseenter",()=>clearInterval(timer));
  section.addEventListener("mouseleave",restart);

  window.addEventListener("resize",()=>{
    visible=getVisible();
    buildDots();
    show(Math.min(index,maxIndex()));
    restart();
  });

  visible=getVisible();
  buildDots();
  show(0);
  restart();
})();
