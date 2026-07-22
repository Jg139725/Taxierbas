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
