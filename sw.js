const CACHE='sr-pwa-v02';
const CORE=['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./data/guide.json','./data/tips.json','./data/default-state.json','./data/forecast.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.url.includes('cdn.jsdelivr.net')){e.respondWith(caches.match(e.request).then(x=>x||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r})));return}e.respondWith(caches.match(e.request).then(x=>x||fetch(e.request)))})
