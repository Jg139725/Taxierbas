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







/* Paket 8 V4 – klassischer Seiten-Slider */
(function(){
  const section = document.querySelector(".google-reviews-section");
  if(!section) return;

  const viewport = section.querySelector(".google-review-viewport");
  const track = section.querySelector(".google-review-track");
  const cards = [...section.querySelectorAll(".google-review-card")];
  const dotsWrap = section.querySelector(".google-review-dots");
  const prev = section.querySelector(".google-review-prev");
  const next = section.querySelector(".google-review-next");

  if(!viewport || !track || !cards.length || !dotsWrap) return;

  let page = 0;
  let cardsPerPage = 3;
  let autoTimer;

  function perPage(){
    if(window.innerWidth <= 760) return 1;
    if(window.innerWidth <= 1050) return 2;
    return 3;
  }

  function pageCount(){
    return Math.ceil(cards.length / cardsPerPage);
  }

  function buildDots(){
    dotsWrap.innerHTML = "";
    for(let i = 0; i < pageCount(); i++){
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", "Bewertungsseite " + (i + 1));
      dot.addEventListener("click", function(){
        showPage(i);
        restartAuto();
      });
      dotsWrap.appendChild(dot);
    }
  }

  function updateDots(){
    [...dotsWrap.children].forEach((dot, i) => {
      dot.classList.toggle("is-active", i === page);
    });
  }

  function showPage(nextPage){
    const totalPages = pageCount();
    page = (nextPage + totalPages) % totalPages;

    const firstCardIndex = page * cardsPerPage;
    const firstCard = cards[firstCardIndex];
    if(!firstCard) return;

    const offset = firstCard.offsetLeft;
    track.style.transform = `translateX(-${offset}px)`;
    updateDots();
  }

  function restartAuto(){
    clearInterval(autoTimer);
    if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      autoTimer = setInterval(function(){
        showPage(page + 1);
      }, 7000);
    }
  }

  prev?.addEventListener("click", function(){
    showPage(page - 1);
    restartAuto();
  });

  next?.addEventListener("click", function(){
    showPage(page + 1);
    restartAuto();
  });

  section.addEventListener("mouseenter", function(){
    clearInterval(autoTimer);
  });

  section.addEventListener("mouseleave", restartAuto);

  window.addEventListener("resize", function(){
    const oldPerPage = cardsPerPage;
    cardsPerPage = perPage();

    if(oldPerPage !== cardsPerPage){
      page = 0;
      buildDots();
    }

    requestAnimationFrame(function(){
      showPage(page);
    });
  });

  cardsPerPage = perPage();
  buildDots();
  showPage(0);
  restartAuto();
})();


/* Paket 9 – Fuhrpark-Lightbox */
(function(){
  const lightbox = document.querySelector(".fleet-lightbox");
  const triggers = [...document.querySelectorAll(".fleet-image-button")];
  if(!lightbox || !triggers.length) return;

  const image = lightbox.querySelector("img");
  const caption = lightbox.querySelector("figcaption");
  const close = lightbox.querySelector(".fleet-lightbox-close");
  const prev = lightbox.querySelector(".fleet-lightbox-prev");
  const next = lightbox.querySelector(".fleet-lightbox-next");
  let activeIndex = 0;

  function show(index){
    activeIndex = (index + triggers.length) % triggers.length;
    const trigger = triggers[activeIndex];
    image.src = trigger.dataset.lightboxSrc;
    image.alt = trigger.dataset.lightboxAlt || "";
    caption.textContent = trigger.dataset.lightboxAlt || "";
    lightbox.hidden = false;
    document.body.classList.add("lightbox-open");
    close.focus();
  }

  function hide(){
    lightbox.hidden = true;
    document.body.classList.remove("lightbox-open");
    triggers[activeIndex]?.focus();
  }

  triggers.forEach((trigger,index)=>{
    trigger.addEventListener("click",()=>show(index));
  });

  close.addEventListener("click",hide);
  prev.addEventListener("click",()=>show(activeIndex-1));
  next.addEventListener("click",()=>show(activeIndex+1));

  lightbox.addEventListener("click",(event)=>{
    if(event.target===lightbox) hide();
  });

  document.addEventListener("keydown",(event)=>{
    if(lightbox.hidden) return;
    if(event.key==="Escape") hide();
    if(event.key==="ArrowLeft") show(activeIndex-1);
    if(event.key==="ArrowRight") show(activeIndex+1);
  });
})();


/* Paket 10.2 – Anfrageformular mit echtem EmailJS-Versand */
(function(){
  const form = document.getElementById("booking-form");
  if(!form) return;

  const steps = [...form.querySelectorAll(".booking-step")];
  const progressDots = [...document.querySelectorAll(".booking-progress span")];
  const progressLines = [...document.querySelectorAll(".booking-progress i")];
  const back = form.querySelector(".booking-back");
  const next = form.querySelector(".booking-next");
  const submit = form.querySelector(".booking-submit");
  const status = form.querySelector(".booking-status");
  let current = 0;
  let sending = false;

  const today = new Date();
  const dateInput = form.querySelector('input[name="ride_date"]');
  if(dateInput){
    const local = new Date(today.getTime() - today.getTimezoneOffset()*60000)
      .toISOString().split("T")[0];
    dateInput.min = local;
  }

  function update(){
    steps.forEach((step,index)=>step.classList.toggle("active",index===current));
    progressDots.forEach((dot,index)=>{
      dot.classList.toggle("active",index===current);
      dot.classList.toggle("done",index<current);
    });
    progressLines.forEach((line,index)=>line.classList.toggle("done",index<current));
    back.hidden = current===0;
    next.hidden = current===steps.length-1;
    submit.hidden = current!==steps.length-1;
    status.className = "booking-status";
    status.textContent = "";
    steps[current].querySelector("input,select,textarea")?.focus({preventScroll:true});
  }

  function errorFor(field,message){
    const wrapper = field.closest(".booking-field");
    wrapper?.classList.toggle("has-error",Boolean(message));
    const error = wrapper?.querySelector(".field-error");
    if(error) error.textContent = message || "";
  }

  function validateStep(index){
    let valid = true;
    const fields = [...steps[index].querySelectorAll("input,select,textarea")];

    fields.forEach(field=>{
      if(field.type==="checkbox") return;
      let message = "";

      if(field.required && !field.value.trim()){
        message = "Bitte dieses Feld ausfüllen.";
      }else if(field.type==="email" && field.value && !field.validity.valid){
        message = "Bitte eine gültige E-Mail-Adresse eingeben.";
      }else if(field.type==="tel" && field.value && field.value.replace(/\D/g,"").length<6){
        message = "Bitte eine gültige Telefonnummer eingeben.";
      }

      errorFor(field,message);
      if(message) valid = false;
    });

    if(index===2){
      const privacy = form.querySelector('input[name="privacy"]');
      const privacyError = form.querySelector(".privacy-error");
      if(!privacy.checked){
        privacyError.textContent = "Bitte der Datenschutzerklärung zustimmen.";
        valid = false;
      }else{
        privacyError.textContent = "";
      }
    }

    if(!valid){
      steps[index].querySelector(".has-error input,.has-error select,.has-error textarea")?.focus();
    }
    return valid;
  }

  function emailJsConfigured(){
    const cfg = window.TAXI_ERBAS_EMAILJS;
    return Boolean(
      cfg &&
      cfg.publicKey &&
      cfg.serviceId &&
      cfg.templateId &&
      !cfg.publicKey.includes("HIER_") &&
      !cfg.serviceId.includes("HIER_") &&
      !cfg.templateId.includes("HIER_")
    );
  }

  function prepareTemplateFields(){
    const selectedTypes = [...form.querySelectorAll('input[name="ride_type"]:checked')]
      .map(input=>input.value);

    let hidden = form.querySelector('input[name="ride_types"]');
    if(!hidden){
      hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = "ride_types";
      form.appendChild(hidden);
    }
    hidden.value = selectedTypes.length ? selectedTypes.join(", ") : "Keine besondere Auswahl";

    let recipient = form.querySelector('input[name="recipient_email"]');
    if(!recipient){
      recipient = document.createElement("input");
      recipient.type = "hidden";
      recipient.name = "recipient_email";
      form.appendChild(recipient);
    }
    recipient.value = "fahrdienst-erbas@hotmail.com";

    let subject = form.querySelector('input[name="email_subject"]');
    if(!subject){
      subject = document.createElement("input");
      subject.type = "hidden";
      subject.name = "email_subject";
      form.appendChild(subject);
    }
    subject.value = "Neue Fahrtanfrage über die Taxi-Erbas-Website";
  }

  next.addEventListener("click",()=>{
    if(!validateStep(current)) return;
    current++;
    update();
  });

  back.addEventListener("click",()=>{
    if(sending) return;
    current--;
    update();
  });

  form.addEventListener("input",(event)=>{
    if(event.target.matches("input,select,textarea")){
      if(event.target.type!=="checkbox") errorFor(event.target,"");
      if(event.target.name==="privacy") form.querySelector(".privacy-error").textContent="";
    }
  });

  form.addEventListener("submit",async(event)=>{
    event.preventDefault();
    if(sending || !validateStep(current)) return;

    if(!emailJsConfigured()){
      status.className = "booking-status error";
      status.innerHTML =
        "<strong>EmailJS ist noch nicht verbunden.</strong><br>" +
        "Trage Public Key, Service ID und Template ID in " +
        "<code>assets/js/emailjs-config.js</code> ein.";
      return;
    }

    if(typeof window.emailjs==="undefined"){
      status.className = "booking-status error";
      status.textContent = "Der E-Mail-Dienst konnte nicht geladen werden. Bitte Internetverbindung prüfen und erneut versuchen.";
      return;
    }

    prepareTemplateFields();

    const cfg = window.TAXI_ERBAS_EMAILJS;
    const originalText = submit.textContent;
    sending = true;
    submit.disabled = true;
    back.disabled = true;
    submit.textContent = "Anfrage wird gesendet …";
    status.className = "booking-status sending";
    status.textContent = "Bitte einen Moment warten.";

    try{
      await window.emailjs.sendForm(
        cfg.serviceId,
        cfg.templateId,
        form,
        {publicKey: cfg.publicKey}
      );

      status.className = "booking-status success";
      status.innerHTML =
        "<strong>Vielen Dank! Ihre Fahrtanfrage wurde erfolgreich gesendet.</strong><br>" +
        "Taxi Erbas meldet sich zur Bestätigung persönlich bei Ihnen.";

      form.reset();
      current = 0;
      setTimeout(update, 4500);
    }catch(error){
      console.error("EmailJS-Versandfehler:", error);
      status.className = "booking-status error";
      status.innerHTML =
        "<strong>Die Anfrage konnte gerade nicht gesendet werden.</strong><br>" +
        "Bitte versuchen Sie es erneut oder rufen Sie uns unter " +
        "<a href=\"tel:+4982477585\">08247 7585</a> an.";
    }finally{
      sending = false;
      submit.disabled = false;
      back.disabled = false;
      submit.textContent = originalText;
    }
  });

  update();
})();
