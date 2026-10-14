// Minimal service worker so Edge offers "Install Weave". It caches nothing:
// every request goes to the network as usual.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
