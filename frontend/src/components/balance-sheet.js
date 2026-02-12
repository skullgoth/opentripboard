/**
 * T222: BalanceSheet component - who owes who, simplified debts
 */
import { formatCurrency } from '../utils/currency.js';
import { t } from '../utils/i18n.js';
import { escapeHtml } from '../utils/html.js';

/**
 * Create balance sheet component
 * @param {Object} balanceData - Balance data with participants and debts
 * @param {string} currency - Trip currency code
 * @param {string} currentUserId - Current user ID
 * @returns {string} HTML string
 */
export function createBalanceSheet(balanceData = {}, currency = 'USD', currentUserId = null) {
  const { participants = [], debts = [] } = balanceData;

  return `
    <div class="balance-sheet">
      <div class="balance-sheet-header">
        <h3>${t('balanceSheet.title')}</h3>
        <p class="balance-sheet-subtitle">${t('balanceSheet.subtitle')}</p>
      </div>

      ${debts.length > 0 ? createDebtsList(debts, currency, currentUserId) : createNoDebts()}

      ${participants.length > 0 ? createParticipantSummary(participants, currency, currentUserId) : ''}
    </div>
  `;
}

/**
 * Create debts list (simplified who-owes-whom)
 * @param {Array} debts - Array of debt objects
 * @param {string} currency - Currency code
 * @param {string} currentUserId - Current user ID
 * @returns {string} HTML string
 */
function createDebtsList(debts, currency, currentUserId) {
  return `
    <div class="debts-section">
      <h4>${t('balanceSheet.settlementsNeeded')}</h4>
      <div class="debts-list">
        ${debts.map(debt => createDebtItem(debt, currency, currentUserId)).join('')}
      </div>
    </div>
  `;
}

/**
 * Create single debt item
 * @param {Object} debt - Debt object { from, to, amount }
 * @param {string} currency - Currency code
 * @param {string} currentUserId - Current user ID
 * @returns {string} HTML string
 */
function createDebtItem(debt, currency, currentUserId) {
  const isFromCurrentUser = debt.from.id === currentUserId;
  const isToCurrentUser = debt.to.id === currentUserId;

  const fromName = isFromCurrentUser ? t('expenses.you') : escapeHtml(debt.from.fullName || debt.from.email);
  const toName = isToCurrentUser ? t('expenses.you') : escapeHtml(debt.to.fullName || debt.to.email);

  let debtClass = '';
  let debtLabel = '';

  if (isFromCurrentUser) {
    debtClass = 'you-owe';
    debtLabel = t('balanceSheet.youOwe', { name: toName });
  } else if (isToCurrentUser) {
    debtClass = 'owed-to-you';
    debtLabel = t('balanceSheet.owesYou', { name: fromName });
  } else {
    debtLabel = t('balanceSheet.owes', { from: fromName, to: toName });
  }

  return `
    <div class="debt-item ${debtClass}" data-from="${debt.from.id}" data-to="${debt.to.id}" data-amount="${debt.amount}">
      <div class="debt-flow">
        <div class="debt-person from">
          <span class="avatar">${getInitials(debt.from.fullName || debt.from.email)}</span>
          <span class="name">${fromName}</span>
        </div>
        <div class="debt-arrow">
          <span class="arrow-icon">→</span>
          <span class="debt-amount">${formatCurrency(debt.amount, currency)}</span>
        </div>
        <div class="debt-person to">
          <span class="avatar">${getInitials(debt.to.fullName || debt.to.email)}</span>
          <span class="name">${toName}</span>
        </div>
      </div>
      <div class="debt-actions">
        <span class="debt-label">${debtLabel}</span>
        <button class="btn btn-sm btn-primary settle-btn"
                data-action="settle-debt"
                data-from-id="${debt.from.id}"
                data-from-name="${escapeHtml(debt.from.fullName || debt.from.email)}"
                data-to-id="${debt.to.id}"
                data-to-name="${escapeHtml(debt.to.fullName || debt.to.email)}"
                data-amount="${debt.amount}">
          ${t('balanceSheet.markAsPaid')}
        </button>
      </div>
    </div>
  `;
}

/**
 * Create no debts message
 * @returns {string} HTML string
 */
function createNoDebts() {
  return `
    <div class="no-debts">
      <span class="icon">✅</span>
      <p>${t('balanceSheet.allSettled')}</p>
      <p class="text-muted">${t('balanceSheet.noOneOwes')}</p>
    </div>
  `;
}

/**
 * Create participant summary table
 * @param {Array} participants - Array of participant balance objects
 * @param {string} currency - Currency code
 * @param {string} currentUserId - Current user ID
 * @returns {string} HTML string
 */
function createParticipantSummary(participants, currency, currentUserId) {
  // Check if any settlements exist
  const hasSettlements = participants.some(p => p.settlementsPaid > 0 || p.settlementsReceived > 0);

  return `
    <div class="participant-summary">
      <h4>${t('balanceSheet.individualBalances')}</h4>
      <table class="balance-table">
        <thead>
          <tr>
            <th>${t('balanceSheet.person')}</th>
            <th>${t('balanceSheet.paid')}</th>
            <th>${t('balanceSheet.owesColumn')}</th>
            ${hasSettlements ? `<th>${t('balanceSheet.settled')}</th>` : ''}
            <th>${t('balanceSheet.balance')}</th>
          </tr>
        </thead>
        <tbody>
          ${participants.map(p => createParticipantRow(p, currency, currentUserId, hasSettlements)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Create participant row
 * @param {Object} participant - Participant balance object
 * @param {string} currency - Currency code
 * @param {string} currentUserId - Current user ID
 * @param {boolean} hasSettlements - Whether to show settlements column
 * @returns {string} HTML string
 */
function createParticipantRow(participant, currency, currentUserId, hasSettlements = false) {
  const isCurrentUser = participant.id === currentUserId;
  const displayName = isCurrentUser ? t('expenses.you') : escapeHtml(participant.fullName || participant.email);

  let netBalanceClass = '';
  let netBalanceIcon = '';

  if (participant.netBalance > 0.01) {
    netBalanceClass = 'positive';
    netBalanceIcon = '↑';
  } else if (participant.netBalance < -0.01) {
    netBalanceClass = 'negative';
    netBalanceIcon = '↓';
  } else {
    netBalanceClass = 'neutral';
    netBalanceIcon = '✓';
  }

  // Calculate net settlement (positive = paid out, negative = received)
  const netSettlement = (participant.settlementsPaid || 0) - (participant.settlementsReceived || 0);
  let settlementDisplay = '';
  if (hasSettlements) {
    if (netSettlement > 0.01) {
      settlementDisplay = `<td class="amount settlement-paid">-${formatCurrency(netSettlement, currency)}</td>`;
    } else if (netSettlement < -0.01) {
      settlementDisplay = `<td class="amount settlement-received">+${formatCurrency(Math.abs(netSettlement), currency)}</td>`;
    } else {
      settlementDisplay = `<td class="amount">-</td>`;
    }
  }

  return `
    <tr class="${isCurrentUser ? 'current-user' : ''}">
      <td>
        <div class="participant-name">
          <span class="avatar small">${getInitials(participant.fullName || participant.email)}</span>
          <span>${displayName}</span>
        </div>
      </td>
      <td class="amount">${formatCurrency(participant.totalPaid, currency)}</td>
      <td class="amount">${formatCurrency(participant.totalOwed, currency)}</td>
      ${settlementDisplay}
      <td class="amount ${netBalanceClass}">
        <span class="balance-icon">${netBalanceIcon}</span>
        ${formatCurrency(Math.abs(participant.netBalance), currency)}
        ${participant.netBalance > 0.01 ? `<span class="balance-label">${t('balanceSheet.getsBack')}</span>` : ''}
        ${participant.netBalance < -0.01 ? `<span class="balance-label">${t('balanceSheet.owesAmount')}</span>` : ''}
      </td>
    </tr>
  `;
}

/**
 * Create compact balance view (for sidebars)
 * @param {Object} balanceData - Balance data
 * @param {string} currency - Currency code
 * @param {string} currentUserId - Current user ID
 * @returns {string} HTML string
 */
export function createCompactBalance(balanceData, currency, currentUserId) {
  const { participants = [], debts = [] } = balanceData;

  // Find current user's balance
  const currentUserBalance = participants.find(p => p.id === currentUserId);

  if (!currentUserBalance) {
    return `
      <div class="compact-balance">
        <span class="balance-status">${t('balanceSheet.noExpensesShared')}</span>
      </div>
    `;
  }

  const netBalance = currentUserBalance.netBalance;
  let statusText = '';
  let statusClass = '';

  if (netBalance > 0.01) {
    statusText = t('balanceSheet.youGetBack', { amount: formatCurrency(netBalance, currency) });
    statusClass = 'positive';
  } else if (netBalance < -0.01) {
    statusText = t('balanceSheet.youOweAmount', { amount: formatCurrency(Math.abs(netBalance), currency) });
    statusClass = 'negative';
  } else {
    statusText = t('balanceSheet.allSettled');
    statusClass = 'neutral';
  }

  // Count settlements involving current user
  const pendingSettlements = debts.filter(
    d => d.from.id === currentUserId || d.to.id === currentUserId
  ).length;

  return `
    <div class="compact-balance ${statusClass}">
      <span class="balance-status">${statusText}</span>
      ${pendingSettlements > 0 ? `
        <span class="settlements-count">${pendingSettlements === 1 ? t('balanceSheet.settlementsCount', { count: pendingSettlements }) : t('balanceSheet.settlementsCount_plural', { count: pendingSettlements })}</span>
      ` : ''}
    </div>
  `;
}

/**
 * Get initials from name or email
 * @param {string} nameOrEmail - Name or email
 * @returns {string} Initials (2 characters)
 */
function getInitials(nameOrEmail) {
  if (!nameOrEmail) return '??';

  // If it's an email, get initials from local part
  if (nameOrEmail.includes('@')) {
    const localPart = nameOrEmail.split('@')[0];
    return localPart.substring(0, 2).toUpperCase();
  }

  // If it's a name, get first letter of first two words
  const parts = nameOrEmail.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return nameOrEmail.substring(0, 2).toUpperCase();
}


export { createDebtsList, createParticipantSummary, getInitials };
