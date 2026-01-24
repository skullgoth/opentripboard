/**
 * T216: ExpenseTracker component - list expenses, add button, totals
 * T036: Updated to use category resolver for dynamic categories
 */
import { formatCurrency, getCurrencySymbol } from '../utils/currency.js';
import { t } from '../utils/i18n.js';
import { resolveCategory, getCategoryIcon as resolveCategoryIcon, getCategoryName } from '../utils/category-resolver.js';

/**
 * Create expense tracker component
 * @param {Array} expenses - Array of expense objects
 * @param {Object} summary - Expense summary object
 * @param {string} currency - Trip currency code
 * @param {Object} options - Display options
 * @returns {string} HTML string
 */
export function createExpenseTracker(expenses = [], summary = {}, currency = 'USD', options = {}) {
  const { showAddButton = true, currentUserId = null } = options;

  return `
    <div class="expense-tracker">
      <div class="expense-tracker-header">
        <h3>${t('expenses.title')}</h3>
        ${showAddButton ? `
          <button class="btn btn-primary btn-sm" data-action="add-expense">
            + ${t('expenses.addExpense')}
          </button>
        ` : ''}
      </div>

      ${createQuickStats(summary, currency)}

      <div class="expense-filters">
        <select class="expense-category-filter" data-action="filter-expenses">
          <option value="">${t('budget.allCategories')}</option>
          <option value="accommodation">${t('expenses.categories.accommodation')}</option>
          <option value="transportation">${t('expenses.categories.transportation')}</option>
          <option value="food">${t('expenses.categories.food')}</option>
          <option value="activities">${t('expenses.categories.activities')}</option>
          <option value="shopping">${t('expenses.categories.shopping')}</option>
          <option value="entertainment">${t('expenses.categories.entertainment')}</option>
          <option value="other">${t('expenses.categories.other')}</option>
        </select>
      </div>

      <div class="expense-list" id="expense-list">
        ${expenses.length > 0
          ? expenses.map(expense => createExpenseItem(expense, currency, currentUserId)).join('')
          : `<div class="empty-state">
              <p>${t('budget.noExpenses')}</p>
              <p class="text-muted">${t('budget.startTracking')}</p>
            </div>`
        }
      </div>
    </div>
  `;
}

/**
 * Create quick stats summary
 * @param {Object} summary - Expense summary
 * @param {string} currency - Currency code
 * @returns {string} HTML string
 */
function createQuickStats(summary, currency) {
  const totalSpent = summary.totalSpent || 0;
  const budget = summary.budget;
  const remaining = summary.remaining;
  const percentUsed = summary.percentUsed;

  return `
    <div class="expense-quick-stats">
      <div class="stat-item">
        <span class="stat-label">${t('budget.totalSpent')}</span>
        <span class="stat-value">${formatCurrency(totalSpent, currency)}</span>
      </div>
      ${budget !== null && budget !== undefined ? `
        <div class="stat-item">
          <span class="stat-label">${t('budget.budgetAmount')}</span>
          <span class="stat-value">${formatCurrency(budget, currency)}</span>
        </div>
        <div class="stat-item ${remaining < 0 ? 'over-budget' : ''}">
          <span class="stat-label">${remaining < 0 ? t('budget.overBudget') : t('budget.remaining')}</span>
          <span class="stat-value">${formatCurrency(Math.abs(remaining), currency)}</span>
        </div>
      ` : ''}
      <div class="stat-item">
        <span class="stat-label">${t('budget.expenseCount')}</span>
        <span class="stat-value">${summary.expenseCount || 0}</span>
      </div>
    </div>
  `;
}

/**
 * Create single expense item
 * @param {Object} expense - Expense object
 * @param {string} currency - Currency code
 * @param {string} currentUserId - Current user ID
 * @returns {string} HTML string
 */
export function createExpenseItem(expense, currency = 'USD', currentUserId = null) {
  const isOwnExpense = expense.payerId === currentUserId;
  const categoryIcon = getCategoryIcon(expense.category);
  const formattedDate = formatDate(expense.expenseDate);
  const splitCount = expense.splits?.length || 0;

  return `
    <div class="expense-item" data-expense-id="${expense.id}">
      <div class="expense-item-icon">
        ${categoryIcon}
      </div>
      <div class="expense-item-content">
        <div class="expense-item-header">
          <span class="expense-category-badge category-${expense.category}">
            ${formatCategory(expense.category)}
          </span>
          <span class="expense-date">${formattedDate}</span>
        </div>
        <div class="expense-item-description">
          ${escapeHtml(expense.description || t('budget.noDescription'))}
        </div>
        <div class="expense-item-meta">
          <span class="expense-payer">
            ${t('budget.paidBy', { name: isOwnExpense ? t('expenses.you') : escapeHtml(expense.payerName || expense.payerEmail || 'Unknown') })}
          </span>
          ${splitCount > 0 ? `
            <span class="expense-split-info">
              ${splitCount === 1 ? t('budget.splitWays', { count: splitCount }) : t('budget.splitWays_plural', { count: splitCount })}
            </span>
          ` : ''}
        </div>
      </div>
      <div class="expense-item-amount">
        <span class="amount">${formatCurrency(expense.amount, currency)}</span>
        <div class="expense-item-actions">
          <button class="btn btn-icon btn-sm" data-action="edit-expense" data-expense-id="${expense.id}" title="${t('common.edit')}" aria-label="${t('expenses.editExpense')}">
            ✏️
          </button>
          <button class="btn btn-icon btn-sm btn-danger" data-action="delete-expense" data-expense-id="${expense.id}" title="${t('common.delete')}" aria-label="${t('expenses.deleteExpense')}">
            🗑️
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get category icon - T036: Now uses category resolver for custom categories
 * @param {string} category - Expense category value (key or custom:uuid)
 * @returns {string} Icon emoji
 */
function getCategoryIcon(category) {
  return resolveCategoryIcon(category, 'expense');
}

/**
 * Format category name - T036: Now uses category resolver for custom categories
 * @param {string} category - Category value (key or custom:uuid)
 * @returns {string} Formatted category name
 */
function formatCategory(category) {
  return getCategoryName(category, 'expense');
}

/**
 * Format date
 * @param {string} dateStr - Date string
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Escape HTML
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export { getCategoryIcon, formatCategory };
