import { wsClient } from '../services/websocket-client.js';
import { t } from '../utils/i18n.js';

let bannerEl = null;
let unsubscribe = null;

/**
 * Initialize the WebSocket connection status banner.
 * Call once during app startup.
 */
export function initConnectionStatus() {
  if (unsubscribe) return;

  unsubscribe = wsClient.onConnectionStateChange(renderBanner);
}

/**
 * Tear down the connection status banner.
 */
export function destroyConnectionStatus() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  removeBanner();
}

function renderBanner(state) {
  if (state === 'connected' || state === 'disconnected') {
    removeBanner();
    return;
  }

  ensureBanner();

  if (state === 'reconnecting') {
    bannerEl.className = 'ws-connection-banner ws-connection-banner--reconnecting';
    bannerEl.innerHTML =
      `<span class="ws-connection-banner__spinner"></span>` +
      `<span>${t('connection.reconnecting')}</span>`;
  } else if (state === 'failed') {
    bannerEl.className = 'ws-connection-banner ws-connection-banner--failed';
    bannerEl.innerHTML =
      `<span>${t('connection.lost')}</span>` +
      `<button class="ws-connection-banner__btn">${t('connection.reconnect')}</button>`;
    bannerEl.querySelector('.ws-connection-banner__btn')
      .addEventListener('click', () => {
        wsClient.manualReconnect();
      });
  }

  // Trigger reflow then show
  requestAnimationFrame(() => {
    bannerEl.classList.add('visible');
  });
}

function ensureBanner() {
  if (!bannerEl) {
    bannerEl = document.createElement('div');
    bannerEl.setAttribute('role', 'status');
    bannerEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(bannerEl);
  }
}

function removeBanner() {
  if (bannerEl) {
    bannerEl.classList.remove('visible');
    setTimeout(() => {
      if (bannerEl && bannerEl.parentElement) {
        bannerEl.parentElement.removeChild(bannerEl);
      }
      bannerEl = null;
    }, 300);
  }
}
