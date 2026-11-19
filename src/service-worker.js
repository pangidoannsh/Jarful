/// <reference lib="webworker" />
// Jarful service worker: makes the app installable and shows the evening reminder.
// It does not cache pages; data stays fresh through Firestore's own offline cache.

/** @type {ServiceWorkerGlobalScope} */
const sw = /** @type {any} */ (self);

sw.addEventListener('install', () => sw.skipWaiting());
sw.addEventListener('activate', (event) => event.waitUntil(sw.clients.claim()));

// Firebase Cloud Messaging delivers our data-only message as JSON: { data: { title, body, url } }.
sw.addEventListener('push', (event) => {
	/** @type {{ data?: Record<string, string>, notification?: Record<string, string> }} */
	let payload = {};
	try {
		payload = event.data ? event.data.json() : {};
	} catch {
		payload = { data: { body: event.data ? event.data.text() : '' } };
	}
	const d = { ...(payload.notification ?? {}), ...(payload.data ?? {}) };
	const title = d.title || 'Jarful';
	event.waitUntil(
		sw.registration.showNotification(title, {
			body: d.body || '',
			icon: '/icons/icon-192.png',
			badge: '/icons/icon-192.png',
			tag: d.tag || 'jarful-reminder',
			data: { url: d.url || '/' }
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = new URL(event.notification.data?.url || '/', sw.location.origin).href;
	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
			for (const w of windows) {
				if ('focus' in w) {
					w.navigate(url);
					return w.focus();
				}
			}
			return sw.clients.openWindow(url);
		})
	);
});
