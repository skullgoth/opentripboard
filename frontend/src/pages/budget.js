// T216-T225: Budget and Expense Tracking page
import { createExpenseTracker, createExpenseItem } from '../components/expense-tracker.js';
import { createExpenseForm, getExpenseFormData, validateExpenseForm, initExpenseFormHandlers } from '../components/expense-form.js';
import { createBudgetSummary, createBudgetEditForm } from '../components/budget-summary.js';
import { createBalanceSheet } from '../components/balance-sheet.js';
import { getCurrencySymbol } from '../utils/currency.js';
import { showToast } from '../utils/toast.js';
import { app } from '../main.js';
import { tripState } from '../state/trip-state.js';
import { tripBuddyState } from '../state/trip-buddy-state.js';
import { authState } from '../state/auth-state.js';
import * as api from '../services/api-client.js';
import { t } from '../utils/i18n.js';
import { escapeHtml } from '../utils/html.js';

let currentTrip = null;
let currentExpenses = [];
let currentSummary = {};
let currentBalances = {};
let currentParticipants = [];

/**
 * Render budget page
 * @param {Object} params - Route parameters
 */
export async function budgetPage(params) {
  const container = document.getElementById('page-container');
  const { id: tripId } = params;

  // Check authentication
  if (!authState.isAuthenticated()) {
    app.router.navigate('/login');
    return;
  }

  // Show loading state
  container.innerHTML = `
    <div class="loading-page">
      <div class="spinner"></div>
      <p>${t('budget.loading')}</p>
    </div>
  `;

  try {
    // Load trip, expenses, summary, balances, and participants
    const [trip, expenses, summary, balances, tripBuddies] = await Promise.all([
      tripState.loadTrip(tripId),
      api.getExpenses(tripId),
      api.getExpenseSummary(tripId),
      api.getExpenseBalances(tripId),
      tripBuddyState.loadTripBuddies(tripId),
    ]);

    currentTrip = trip;
    currentExpenses = expenses;
    currentSummary = summary;
    currentBalances = balances;

    // Build participants list (owner + trip buddies)
    const currentUser = authState.getCurrentUser();
    currentParticipants = buildParticipantsList(trip, tripBuddies, currentUser);

    renderPage(container, currentUser);
    attachEventListeners(container, tripId, currentUser);

  } catch (error) {
    console.error('Failed to load budget:', error);
    container.innerHTML = `
      <div class="error-page">
        <h2>${t('budget.loadFailed')}</h2>
        <p>${error.message || t('errors.generic')}</p>
        <a href="#/trips/${tripId}" class="btn btn-sm btn-primary">${t('budget.backToTrip')}</a>
      </div>
    `;
  }
}

/**
 * Build participants list from trip owner and trip buddies
 */
function buildParticipantsList(trip, tripBuddies, currentUser) {
  const participants = [];

  // Add owner - use trip.ownerName/ownerEmail from backend, or currentUser if they're the owner
  const isCurrentUserOwner = currentUser?.id === trip.ownerId;
  participants.push({
    id: trip.ownerId,
    email: isCurrentUserOwner ? currentUser.email : (trip.ownerEmail || 'Owner'),
    fullName: isCurrentUserOwner ? currentUser.fullName : (trip.ownerName || 'Trip Owner'),
  });

  // Add accepted trip buddies
  for (const buddy of tripBuddies) {
    if (buddy.acceptedAt && buddy.userId !== trip.ownerId) {
      participants.push({
        id: buddy.userId,
        email: buddy.userEmail,
        fullName: buddy.userName,
      });
    }
  }

  return participants;
}

/**
 * Render the page content
 */
function renderPage(container, currentUser) {
  const currency = currentTrip.currency || 'USD';

  // Create components
  const budgetSummaryHtml = createBudgetSummary(currentSummary, currency, {
    showSetBudget: true,
  });

  const expenseTrackerHtml = createExpenseTracker(currentExpenses, currentSummary, currency, {
    showAddButton: true,
    currentUserId: currentUser?.id,
  });

  const balanceSheetHtml = createBalanceSheet(currentBalances, currency, currentUser?.id);

  container.innerHTML = `
    <div class="budget-page">
      <div class="page-header">
        <div class="page-header-content">
          <a href="#/trips/${currentTrip.id}" class="btn btn-secondary btn-sm">
            ← ${t('budget.backToTrip')}
          </a>
          <h1>${t('budget.title')}</h1>
          <p class="page-subtitle">${escapeHtml(currentTrip.name)}</p>
        </div>
      </div>

      <div class="budget-page-content">
        <div class="budget-main">
          <div class="budget-summary-section">
            ${budgetSummaryHtml}
          </div>

          <div class="expense-tracker-section">
            ${expenseTrackerHtml}
          </div>
        </div>

        <div class="budget-sidebar">
          <div class="balance-sheet-section">
            ${balanceSheetHtml}
          </div>
        </div>
      </div>

      <!-- Expense Form Modal -->
      <div id="expense-modal" class="modal-overlay">
        <div class="modal-dialog">
          <div id="expense-form-container"></div>
        </div>
      </div>

      <!-- Budget Form Modal -->
      <div id="budget-modal" class="modal-overlay">
        <div class="modal-dialog">
          <div id="budget-form-container"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Attach event listeners
 */
function attachEventListeners(container, tripId, currentUser) {
  // Add expense button
  container.querySelector('[data-action="add-expense"]')?.addEventListener('click', () => {
    showExpenseModal(null, currentUser);
  });

  // Set/Edit budget button
  container.querySelector('[data-action="set-budget"]')?.addEventListener('click', () => {
    showBudgetModal();
  });
  container.querySelector('[data-action="edit-budget"]')?.addEventListener('click', () => {
    showBudgetModal();
  });

  // Category filter
  container.querySelector('[data-action="filter-expenses"]')?.addEventListener('change', (e) => {
    filterExpenses(e.target.value, currentUser);
  });

  // Expense item actions (delegated)
  container.querySelector('.expense-list')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-action="edit-expense"]');
    const deleteBtn = e.target.closest('[data-action="delete-expense"]');

    if (editBtn) {
      const expenseId = editBtn.dataset.expenseId;
      const expense = currentExpenses.find(ex => ex.id === expenseId);
      if (expense) {
        showExpenseModal(expense, currentUser);
      }
    }

    if (deleteBtn) {
      const expenseId = deleteBtn.dataset.expenseId;
      handleDeleteExpense(tripId, expenseId);
    }
  });

  // Settle debt buttons (delegated)
  container.querySelector('.balance-sheet')?.addEventListener('click', (e) => {
    const settleBtn = e.target.closest('[data-action="settle-debt"]');
    if (settleBtn) {
      const fromId = settleBtn.dataset.fromId;
      const fromName = settleBtn.dataset.fromName;
      const toId = settleBtn.dataset.toId;
      const toName = settleBtn.dataset.toName;
      const amount = parseFloat(settleBtn.dataset.amount);
      handleSettleDebt(tripId, fromId, fromName, toId, toName, amount);
    }
  });

}

/**
 * Show expense form modal
 */
async function showExpenseModal(expense = null, currentUser) {
  const modal = document.getElementById('expense-modal');
  const formContainer = document.getElementById('expense-form-container');

  const formHtml = createExpenseForm({
    expense,
    participants: currentParticipants,
    currency: currentTrip.currency || 'USD',
    currentUserId: currentUser?.id,
    tripId: currentTrip.id, // T032: Pass tripId for dynamic categories
  });

  formContainer.innerHTML = formHtml;

  // Show modal with animation
  requestAnimationFrame(() => {
    modal.classList.add('open');
  });

  // Initialize form handlers (async for category select)
  await initExpenseFormHandlers(formContainer, currentTrip.currency || 'USD');

  // Attach form submit handler
  const form = formContainer.querySelector('#expense-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleExpenseSubmit(form, expense?.id);
  });

  // Attach cancel buttons (both X and Cancel button)
  formContainer.querySelectorAll('[data-action="cancel-expense-form"]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModals();
    });
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModals();
    }
  });
}

/**
 * Show budget edit modal
 */
function showBudgetModal() {
  const modal = document.getElementById('budget-modal');
  const formContainer = document.getElementById('budget-form-container');

  const formHtml = createBudgetEditForm(currentTrip.budget, currentTrip.currency || 'USD');
  formContainer.innerHTML = formHtml;

  // Show modal with animation
  requestAnimationFrame(() => {
    modal.classList.add('open');
  });

  // Update currency symbol when currency changes
  const currencySelect = formContainer.querySelector('#budget-currency');
  const currencySymbol = formContainer.querySelector('#budget-currency-symbol');
  if (currencySelect && currencySymbol) {
    currencySelect.addEventListener('change', (e) => {
      currencySymbol.textContent = getCurrencySymbol(e.target.value);
    });
  }

  // Attach form submit handler
  const form = formContainer.querySelector('#budget-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const budgetAmountValue = form.querySelector('#budget-amount').value;
    const budgetAmount = budgetAmountValue ? parseFloat(budgetAmountValue) : null;
    const currency = form.querySelector('#budget-currency').value;
    await handleBudgetUpdate(budgetAmount, currency);
  });

  // Attach cancel buttons (both X and Cancel button)
  formContainer.querySelectorAll('[data-action="cancel-budget-form"]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModals();
    });
  });

  // Attach remove budget button
  formContainer.querySelector('[data-action="remove-budget"]')?.addEventListener('click', async () => {
    const currency = form.querySelector('#budget-currency').value;
    await handleBudgetUpdate(null, currency);
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModals();
    }
  });
}

/**
 * Close all modals
 */
function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.classList.remove('open');
  });
}

/**
 * Handle expense form submission
 */
async function handleExpenseSubmit(form, existingExpenseId) {
  const formData = getExpenseFormData(form);
  const validation = validateExpenseForm(formData);

  if (!validation.valid) {
    showToast(validation.errors.join(', '), 'error');
    return;
  }

  try {
    if (existingExpenseId) {
      // Update existing expense
      await api.updateExpense(currentTrip.id, existingExpenseId, formData);
      showToast(t('budget.expenseUpdated'), 'success');
    } else {
      // Create new expense
      await api.createExpense(currentTrip.id, formData);
      showToast(t('budget.expenseAdded'), 'success');
    }

    closeModals();
    await refreshData();

  } catch (error) {
    console.error('Failed to save expense:', error);
    showToast(error.message || t('budget.saveFailed'), 'error');
  }
}

/**
 * Handle expense deletion
 */
async function handleDeleteExpense(tripId, expenseId) {
  if (!confirm(t('budget.confirmDeleteExpense'))) {
    return;
  }

  try {
    await api.deleteExpense(tripId, expenseId);
    showToast(t('budget.expenseDeleted'), 'success');
    await refreshData();
  } catch (error) {
    console.error('Failed to delete expense:', error);
    showToast(error.message || t('budget.deleteFailed'), 'error');
  }
}

/**
 * Handle budget update
 */
async function handleBudgetUpdate(budgetAmount, currency) {
  try {
    const updates = { budget: budgetAmount };
    if (currency && currency !== currentTrip.currency) {
      updates.currency = currency;
    }

    await tripState.updateTrip(currentTrip.id, updates);
    currentTrip.budget = budgetAmount;
    if (currency) {
      currentTrip.currency = currency;
    }

    showToast(budgetAmount !== null ? t('budget.budgetForm.budgetUpdated') : t('budget.budgetForm.budgetRemoved'), 'success');
    closeModals();
    await refreshData();
  } catch (error) {
    console.error('Failed to update budget:', error);
    showToast(error.message || t('budget.budgetForm.updateFailed'), 'error');
  }
}

/**
 * Handle settling a debt between two participants
 */
async function handleSettleDebt(tripId, fromId, fromName, toId, toName, amount) {
  const currency = currentTrip.currency || 'USD';

  if (!confirm(t('balanceSheet.confirmSettle', { amount: amount.toFixed(2), currency, from: fromName, to: toName }))) {
    return;
  }

  try {
    // Create a settlement expense
    // The debtor (fromId) pays the creditor (toId)
    const settlementData = {
      payerId: fromId,
      amount: amount,
      currency: currency,
      category: 'settlement',
      description: `Settlement: ${fromName} paid ${toName}`,
      expenseDate: new Date().toISOString().split('T')[0],
      splits: [
        {
          userId: toId,
          amount: amount,
          percentage: 100,
        },
      ],
    };

    await api.createExpense(tripId, settlementData);
    showToast(t('balanceSheet.paymentRecorded'), 'success');
    await refreshData();

  } catch (error) {
    console.error('Failed to record settlement:', error);
    showToast(error.message || t('balanceSheet.settleFailed'), 'error');
  }
}

/**
 * Filter expenses by category
 */
function filterExpenses(category, currentUser) {
  const expenseList = document.getElementById('expense-list');
  if (!expenseList) return;

  const currency = currentTrip.currency || 'USD';
  const filtered = category
    ? currentExpenses.filter(e => e.category === category)
    : currentExpenses;

  if (filtered.length > 0) {
    expenseList.innerHTML = filtered
      .map(expense => createExpenseItem(expense, currency, currentUser?.id))
      .join('');
  } else {
    expenseList.innerHTML = `
      <div class="empty-state">
        <p>${t('budget.noCategoryExpenses')}</p>
      </div>
    `;
  }
}

/**
 * Refresh all data
 */
async function refreshData() {
  try {
    const [expenses, summary, balances] = await Promise.all([
      api.getExpenses(currentTrip.id),
      api.getExpenseSummary(currentTrip.id),
      api.getExpenseBalances(currentTrip.id),
    ]);

    currentExpenses = expenses;
    currentSummary = summary;
    currentBalances = balances;

    // Re-render page
    const container = document.getElementById('page-container');
    const currentUser = authState.getCurrentUser();
    renderPage(container, currentUser);
    attachEventListeners(container, currentTrip.id, currentUser);

  } catch (error) {
    console.error('Failed to refresh data:', error);
    showToast(t('errors.generic'), 'error');
  }
}

/**
 * Cleanup function when leaving page
 */
export function cleanupBudgetPage() {
  currentTrip = null;
  currentExpenses = [];
  currentSummary = {};
  currentBalances = {};
  currentParticipants = [];
}
