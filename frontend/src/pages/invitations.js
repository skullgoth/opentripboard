/**
 * Invitations Page - Manage trip buddy invitations
 */
import * as apiClient from '../services/api-client.js';
import { showToast } from '../utils/toast.js';
import { updateInvitationCount } from '../main.js';
import { t } from '../utils/i18n.js';

export async function invitationsPage() {
  const container = document.getElementById('page-container');

  container.innerHTML = `
    <div class="page-header">
      <h1>${t('invitations.title')}</h1>
      <p class="page-description">${t('invitations.subtitle')}</p>
    </div>

    <div id="invitations-container" class="invitations-container">
      <div class="loading-message">
        <div class="spinner"></div>
        <p>${t('invitations.loading')}</p>
      </div>
    </div>
  `;

  // Load invitations
  await loadInvitations();
}

async function loadInvitations() {
  const invitationsContainer = document.getElementById('invitations-container');

  try {
    const invitations = await apiClient.get('/trip-buddies/invitations');

    if (!invitations || invitations.length === 0) {
      invitationsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📬</div>
          <h2>${t('invitations.noInvitations')}</h2>
          <p>${t('invitations.noInvitationsDescription')}</p>
          <a href="#/" class="btn btn-sm btn-primary">${t('invitations.viewMyTrips')}</a>
        </div>
      `;
      return;
    }

    invitationsContainer.innerHTML = `
      <div class="invitations-list">
        ${invitations.map(invitation => renderInvitationCard(invitation)).join('')}
      </div>
    `;

    // Attach event listeners
    invitations.forEach(invitation => {
      attachInvitationListeners(invitation);
    });

  } catch (error) {
    console.error('Failed to load invitations:', error);
    invitationsContainer.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h2>${t('invitations.loadFailed')}</h2>
        <p>${error.message || t('errors.generic')}</p>
        <button class="btn btn-sm btn-primary" onclick="window.location.reload()">${t('invitations.tryAgain')}</button>
      </div>
    `;
  }
}

function renderInvitationCard(invitation) {
  const invitedDate = new Date(invitation.invitedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const tripDates = invitation.startDate && invitation.endDate
    ? `${new Date(invitation.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} - ${new Date(invitation.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : t('invitations.datesNotSet');

  const roleLabel = invitation.role === 'editor' ? t('invitations.roleEditor') : t('invitations.roleViewer');
  const roleDescription = invitation.role === 'editor'
    ? t('invitations.roleEditorDescription')
    : t('invitations.roleViewerDescription');

  return `
    <div class="invitation-card card" data-invitation-id="${invitation.id}">
      <div class="invitation-header">
        <div class="invitation-trip-info">
          <h3 class="invitation-trip-name">${escapeHtml(invitation.tripName)}</h3>
          <p class="invitation-destination">
            📍 ${escapeHtml(invitation.destination || t('trips.noDestination'))}
          </p>
        </div>
        <span class="badge badge-${invitation.role}">${roleLabel}</span>
      </div>

      <div class="invitation-details">
        <div class="invitation-detail">
          <span class="invitation-detail-label">${t('invitations.dates')}</span>
          <span class="invitation-detail-value">${tripDates}</span>
        </div>
        <div class="invitation-detail">
          <span class="invitation-detail-label">${t('invitations.invitedBy')}</span>
          <span class="invitation-detail-value">${escapeHtml(invitation.invitedByName || 'Unknown')}</span>
        </div>
        <div class="invitation-detail">
          <span class="invitation-detail-label">${t('invitations.invitedOn')}</span>
          <span class="invitation-detail-value">${invitedDate}</span>
        </div>
        <div class="invitation-detail">
          <span class="invitation-detail-label">${t('invitations.roleLabel')}</span>
          <span class="invitation-detail-value">${roleDescription}</span>
        </div>
      </div>

      <div class="invitation-actions">
        <button
          class="btn btn-sm btn-primary"
          data-action="accept-invitation"
          data-invitation-id="${invitation.id}"
          data-trip-id="${invitation.tripId}">
          ✓ ${t('invitations.acceptInvitation')}
        </button>
        <button
          class="btn btn-sm btn-secondary"
          data-action="decline-invitation"
          data-invitation-id="${invitation.id}">
          ✗ ${t('invitations.decline')}
        </button>
      </div>
    </div>
  `;
}

function attachInvitationListeners(invitation) {
  const card = document.querySelector(`[data-invitation-id="${invitation.id}"]`);
  if (!card) return;

  const acceptBtn = card.querySelector('[data-action="accept-invitation"]');
  const declineBtn = card.querySelector('[data-action="decline-invitation"]');

  if (acceptBtn) {
    acceptBtn.addEventListener('click', async () => {
      await handleAcceptInvitation(invitation.id, invitation.tripId, card);
    });
  }

  if (declineBtn) {
    declineBtn.addEventListener('click', async () => {
      await handleDeclineInvitation(invitation.id, card);
    });
  }
}

async function handleAcceptInvitation(invitationId, tripId, card) {
  const acceptBtn = card.querySelector('[data-action="accept-invitation"]');
  const declineBtn = card.querySelector('[data-action="decline-invitation"]');

  // Disable buttons
  acceptBtn.disabled = true;
  declineBtn.disabled = true;
  acceptBtn.textContent = t('invitations.accepting');

  try {
    await apiClient.post(`/trip-buddies/${invitationId}/accept`);

    showToast(t('invitations.accepted'), 'success');

    // Update badge count
    updateInvitationCount();

    // Remove card with animation
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';

    // Redirect to trip after short delay
    setTimeout(() => {
      window.location.hash = `#/trips/${tripId}`;
    }, 1000);

  } catch (error) {
    console.error('Failed to accept invitation:', error);
    showToast(error.message || t('invitations.acceptFailed'), 'error');

    // Re-enable buttons
    acceptBtn.disabled = false;
    declineBtn.disabled = false;
    acceptBtn.textContent = `✓ ${t('invitations.acceptInvitation')}`;
  }
}

async function handleDeclineInvitation(invitationId, card) {
  const acceptBtn = card.querySelector('[data-action="accept-invitation"]');
  const declineBtn = card.querySelector('[data-action="decline-invitation"]');

  // Confirm decline
  if (!confirm(t('invitations.confirmDecline'))) {
    return;
  }

  // Disable buttons
  acceptBtn.disabled = true;
  declineBtn.disabled = true;
  declineBtn.textContent = t('invitations.declining');

  try {
    await apiClient.del(`/trip-buddies/${invitationId}`);

    showToast(t('invitations.declined'), 'success');

    // Update badge count
    updateInvitationCount();

    // Remove card with animation
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';

    setTimeout(() => {
      card.remove();

      // Check if there are no more invitations
      const remainingCards = document.querySelectorAll('.invitation-card');
      if (remainingCards.length === 0) {
        loadInvitations(); // Reload to show empty state
      }
    }, 300);

  } catch (error) {
    console.error('Failed to decline invitation:', error);
    showToast(error.message || t('invitations.declineFailed'), 'error');

    // Re-enable buttons
    acceptBtn.disabled = false;
    declineBtn.disabled = false;
    declineBtn.textContent = `✗ ${t('invitations.decline')}`;
  }
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
