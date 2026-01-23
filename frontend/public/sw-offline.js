/**
 * Custom service worker extensions for offline reading support.
 * This file is imported by the next-pwa generated service worker.
 */

const OFFLINE_CACHE = 'offline-stories-v1';
const OFFLINE_FALLBACK_PAGE = '/offline';

// Story content that has been saved for offline reading
const offlineStoryCache = {
  async saveStory(storyId, segments) {
    const cache = await caches.open(OFFLINE_CACHE);
    const storyData = {
      storyId,
      segments,
      savedAt: Date.now(),
    };
    const response = new Response(JSON.stringify(storyData), {
      headers: { 'Content-Type': 'application/json' },
    });
    await cache.put(`/offline/story/${storyId}`, response);
  },

  async getStory(storyId) {
    const cache = await caches.open(OFFLINE_CACHE);
    const response = await cache.match(`/offline/story/${storyId}`);
    if (response) {
      return response.json();
    }
    return null;
  },

  async removeStory(storyId) {
    const cache = await caches.open(OFFLINE_CACHE);
    await cache.delete(`/offline/story/${storyId}`);
  },

  async listStories() {
    const cache = await caches.open(OFFLINE_CACHE);
    const keys = await cache.keys();
    const stories = [];
    for (const request of keys) {
      if (request.url.includes('/offline/story/')) {
        const response = await cache.match(request);
        if (response) {
          stories.push(await response.json());
        }
      }
    }
    return stories;
  },
};

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SAVE_STORY_OFFLINE': {
      const { storyId, segments } = payload;
      await offlineStoryCache.saveStory(storyId, segments);
      event.ports[0]?.postMessage({ success: true });
      break;
    }

    case 'GET_OFFLINE_STORY': {
      const story = await offlineStoryCache.getStory(payload.storyId);
      event.ports[0]?.postMessage({ story });
      break;
    }

    case 'REMOVE_OFFLINE_STORY': {
      await offlineStoryCache.removeStory(payload.storyId);
      event.ports[0]?.postMessage({ success: true });
      break;
    }

    case 'LIST_OFFLINE_STORIES': {
      const stories = await offlineStoryCache.listStories();
      event.ports[0]?.postMessage({ stories });
      break;
    }

    case 'CLEAR_OFFLINE_CACHE': {
      await caches.delete(OFFLINE_CACHE);
      event.ports[0]?.postMessage({ success: true });
      break;
    }
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      notificationId: data.id,
    },
    actions: data.actions || [],
    tag: data.tag || 'default',
    renotify: !!data.tag,
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Aardvark', options));
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if available
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reading-progress') {
    event.waitUntil(syncReadingProgress());
  }
});

async function syncReadingProgress() {
  const cache = await caches.open(OFFLINE_CACHE);
  const response = await cache.match('/offline/pending-progress');
  if (!response) return;

  const pendingUpdates = await response.json();

  for (const update of pendingUpdates) {
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
    } catch {
      // Will retry on next sync
      return;
    }
  }

  // Clear pending updates on success
  await cache.delete('/offline/pending-progress');
}
