'use strict';
const CACHE = 'physics-answers-v2';
const MEDIA = 'physics-answer-pages';
const SHELL = ['./','./index.html','./style.css?v=2','./index-data.js?v=2','./app.js?v=2','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const media=await caches.open(MEDIA); let upgrading=false;
 for(const key of await caches.keys()) {
  if(key.startsWith('physics-answers-')&&key!==CACHE) { upgrading=true;
   const old=await caches.open(key);
   for(const request of await old.keys()) if(new URL(request.url).pathname.includes('/pages/')) {const r=await old.match(request); if(r)await media.put(request,r);}
   await caches.delete(key);
  }
 }
 await self.clients.claim();
 if(upgrading) for(const client of await self.clients.matchAll({type:'window'})) if(client.url.startsWith(self.registration.scope)) await client.navigate(client.url);
})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
 const url=new URL(event.request.url);
 const isPage=/\/pages(?:-mobile)?\/\d+\.webp$/.test(url.pathname);
 const cacheName=isPage?MEDIA:CACHE;
 const network=async()=>{
  const response=await fetch(event.request);
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(cacheName).then(c=>c.put(event.request,copy)).catch(()=>{}));}
  return response;
 };
 if(event.request.mode==='navigate'){
  event.respondWith((async()=>{
   const cached=(await caches.match(event.request))||(await caches.match(new URL('./',self.registration.scope).href));
   if(cached){event.waitUntil(network().catch(()=>{}));return cached;}
   try{return await network();}catch{return Response.error();}
  })());
 }else{
  event.respondWith((async()=>{
   const cached=await caches.match(event.request);if(cached)return cached;
   try{return await network();}
   catch{
    if(url.pathname.includes('/pages-mobile/')){url.pathname=url.pathname.replace('/pages-mobile/','/pages/');const full=await caches.match(url.href);if(full)return full;}
    return Response.error();
   }
  })());
 }
});
