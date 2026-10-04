self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key))))])));
self.addEventListener("push",event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch(_){data={body:event.data?.text()||"Neue Fahrt"}}
  const title=data.title||"Taxi Erbas – Neue Fahrt";
  const options={
    body:data.body||"Dir wurde eine neue Fahrt zugewiesen.",
    icon:"assets/images/taxi-erbas-original-logo.png",
    badge:"assets/images/taxi-erbas-original-logo.png",
    tag:data.tag||`taxi-erbas-${data.ride_id||"ride"}`,
    renotify:true,
    data:{url:data.url||"portal.html",ride_id:data.ride_id||null}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=event.notification.data?.url||"portal.html";
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const client of list){if("focus" in client){client.navigate(target);return client.focus()}}
    return clients.openWindow(target);
  }));
});
