const CACHE_NAME = 'ollama-ai-cache-v1';
const ASSETS_TO_CACHE = [
	'/',
	'/index.html',
	'/manifest.webmanifest',
	'/icons/icon-192.png',
	'/icons/icon-512.png',
	'/icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
	self.skipWaiting();
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
		})
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(
				keys.map((key) => {
					if (key !== CACHE_NAME) {
						return caches.delete(key);
					}
				})
			);
		}).then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	
	const url = new URL(event.request.url);
	// Avoid caching streaming WebSocket and dynamic API routes
	if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) {
		return;
	}

	event.respondWith(
		fetch(event.request)
			.then((response) => {
				// Clone response and cache static assets on the fly
				if (response.status === 200 && response.type === 'basic') {
					const clone = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
				}
				return response;
			})
			.catch(() => {
				return caches.match(event.request).then((cached) => {
					if (cached) return cached;
					if (event.request.mode === 'navigate') {
						return caches.match('/');
					}
				});
			})
	);
});
