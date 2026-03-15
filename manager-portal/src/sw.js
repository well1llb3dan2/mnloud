/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

self.skipWaiting();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// Background token refresh — keeps the session alive when pushes arrive
const refreshAuthToken = async () => {
  try {
    const raw = await self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Try to read from an open window's localStorage
      if (clients.length > 0) return null; // App is open, interceptor handles it
      return null;
    });
    // Read persisted auth from indexedDB/localStorage via cache API workaround:
    // Service workers can't access localStorage directly, so we request a known endpoint
    // that the client intercepts. Instead, we use a broadcast approach.
    // Simplest: use fetch against the refresh endpoint with the token stored in IDB.
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('manager-auth-sw', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('tokens');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction('tokens', 'readonly');
    const store = tx.objectStore('tokens');
    const token = await new Promise((resolve, reject) => {
      const req = store.get('refreshToken');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!token) return;

    const isLocalhost = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
    const apiBase = isLocalhost ? '/api' : 'https://api.mnloud.com/api';

    const resp = await fetch(`${apiBase}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
    if (!resp.ok) return;
    const data = await resp.json();

    // Store new tokens back to IDB
    const txW = (await new Promise((resolve, reject) => {
      const req = indexedDB.open('manager-auth-sw', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    })).transaction('tokens', 'readwrite');
    const storeW = txW.objectStore('tokens');
    storeW.put(data.refreshToken, 'refreshToken');
    storeW.put(data.accessToken, 'accessToken');

    // Notify open clients to update their in-memory store
    const allClients = await self.clients.matchAll({ type: 'window' });
    for (const client of allClients) {
      client.postMessage({
        type: 'TOKEN_REFRESHED',
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
    }
  } catch (e) {
    // Silent fail — next push or app open will retry
  }
};

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const title = data.title || 'New message';
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    data: { url: data.url || '/' },
    tag: data.tag || 'message',
  };
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      refreshAuthToken(),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    })
  );
});
