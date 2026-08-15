self.addEventListener("install",event=>{
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key))))
    ])
  );
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();

  event.waitUntil(
    clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
      for(const client of list){
        if("focus" in client){
          client.navigate("portal.html");
          return client.focus();
        }
      }

      return clients.openWindow("portal.html");
    })
  );
});
