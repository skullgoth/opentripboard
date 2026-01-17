// Service Worker registration and management

let registration = null;

/**
 * Register the service worker
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function registerServiceWorker() {
  // Skip in development unless explicitly enabled
  if (import.meta.env.DEV && !import.meta.env.VITE_ENABLE_SW) {
    console.log('[SW] Skipping registration in development mode');
    return null;
  }

  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported');
    return null;
  }

  try {
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[SW] Registered with scope:', registration.scope);

    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000); // Check every hour

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;

      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            notifyUpdateAvailable();
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('[SW] Registration failed:', error);
    return null;
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker() {
  if (!registration) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      await reg.unregister();
      console.log('[SW] Unregistered');
    }
    return;
  }

  await registration.unregister();
  registration = null;
  console.log('[SW] Unregistered');
}

/**
 * Check if service worker is active
 */
export function isServiceWorkerActive() {
  return navigator.serviceWorker?.controller !== null;
}

/**
 * Skip waiting and activate new service worker
 */
export function skipWaiting() {
  if (registration?.waiting) {
    registration.waiting.postMessage('skipWaiting');
  }
}

/**
 * Clear all caches
 */
export async function clearCaches() {
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    console.log('[SW] Caches cleared');
  }
}

/**
 * Notify user that an update is available
 */
function notifyUpdateAvailable() {
  // Create update notification
  const notification = document.createElement('div');
  notification.className = 'sw-update-notification';
  notification.innerHTML = `
    <div class="sw-update-content">
      <span>A new version is available!</span>
      <button class="btn btn-sm btn-primary" id="sw-update-btn">Update Now</button>
      <button class="btn btn-sm btn-secondary" id="sw-dismiss-btn">Later</button>
    </div>
  `;

  document.body.appendChild(notification);

  // Handle update button
  document.getElementById('sw-update-btn')?.addEventListener('click', () => {
    skipWaiting();
    window.location.reload();
  });

  // Handle dismiss button
  document.getElementById('sw-dismiss-btn')?.addEventListener('click', () => {
    notification.remove();
  });
}

/**
 * Add update notification styles
 */
export function addServiceWorkerStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .sw-update-notification {
      position: fixed;
      bottom: var(--spacing-4, 1rem);
      left: 50%;
      transform: translateX(-50%);
      background: var(--color-gray-800, #1f2937);
      color: var(--color-white, #fff);
      padding: var(--spacing-3, 0.75rem) var(--spacing-4, 1rem);
      border-radius: var(--radius-lg, 0.5rem);
      box-shadow: var(--shadow-lg, 0 10px 15px rgba(0,0,0,0.1));
      z-index: 9999;
      animation: slideUp 0.3s ease-out;
    }

    .sw-update-content {
      display: flex;
      align-items: center;
      gap: var(--spacing-3, 0.75rem);
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    [data-theme='dark'] .sw-update-notification {
      background: var(--color-gray-700, #374151);
    }
  `;

  document.head.appendChild(style);
}
