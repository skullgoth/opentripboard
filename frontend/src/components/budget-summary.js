/**
 * T220: BudgetSummary component - progress bar, spent/remaining, by category
 */
import { formatCurrency, formatPercentage, calculatePercentage, getCommonCurrencies } from '../utils/currency.js';
import { t } from '../utils/i18n.js';

/**
 * Create budget summary component
 * @param {Object} summary - Expense summary object
 * @param {string} currency - Trip currency code
 * @param {Object} options - Display options
 * @returns {string} HTML string
 */
export function createBudgetSummary(summary = {}, currency = 'USD', options = {}) {
  const { showSetBudget = true, compact = false } = options;

  const totalSpent = summary.totalSpent || 0;
  const budget = summary.budget;
  const remaining = summary.remaining;
  const percentUsed = summary.percentUsed || 0;
  const byCategory = summary.byCategory || [];
  const budgetStatus = summary.budgetStatus;
  const budgetWarning = summary.budgetWarning;

  if (compact) {
    return createCompactBudgetSummary(summary, currency);
  }

  return `
    <div class="budget-summary">
      <div class="budget-summary-header">
        <h3>${t('budget.overview')}</h3>
        ${showSetBudget && budget === null ? `
          <button class="btn btn-sm btn-secondary" data-action="set-budget">
            ${t('budget.setBudget')}
          </button>
        ` : ''}
        ${budget !== null ? `
          <button class="btn btn-sm btn-icon" data-action="edit-budget" title="${t('budget.editBudget')}">
            ✏️
          </button>
        ` : ''}
      </div>

      ${budgetWarning ? `
        <div class="budget-alert ${budgetStatus === 'exceeded' ? 'alert-danger' : 'alert-warning'}">
          <span class="alert-icon">${budgetStatus === 'exceeded' ? '⚠️' : '⚡'}</span>
          ${budgetWarning}
        </div>
      ` : ''}

      ${budget !== null ? createBudgetProgress(totalSpent, budget, remaining, percentUsed, currency) : ''}

      <div class="budget-stats">
        <div class="budget-stat-card">
          <span class="stat-icon">💰</span>
          <div class="stat-content">
            <span class="stat-label">${t('budget.totalSpent')}</span>
            <span class="stat-value spent">${formatCurrency(totalSpent, currency)}</span>
          </div>
        </div>

        ${budget !== null ? `
          <div class="budget-stat-card">
            <span class="stat-icon">🎯</span>
            <div class="stat-content">
              <span class="stat-label">${t('budget.budgetAmount')}</span>
              <span class="stat-value">${formatCurrency(budget, currency)}</span>
            </div>
          </div>

          <div class="budget-stat-card ${remaining < 0 ? 'over-budget' : ''}">
            <span class="stat-icon">${remaining < 0 ? '📉' : '📊'}</span>
            <div class="stat-content">
              <span class="stat-label">${remaining < 0 ? t('budget.overBudget') : t('budget.remaining')}</span>
              <span class="stat-value ${remaining < 0 ? 'negative' : 'positive'}">
                ${formatCurrency(Math.abs(remaining), currency)}
              </span>
            </div>
          </div>
        ` : `
          <div class="budget-stat-card">
            <span class="stat-icon">📝</span>
            <div class="stat-content">
              <span class="stat-label">${t('budget.expenseCount')}</span>
              <span class="stat-value">${summary.expenseCount || 0}</span>
            </div>
          </div>
        `}
      </div>

      ${byCategory.length > 0 ? createCategoryBreakdown(byCategory, totalSpent, currency) : ''}
    </div>
  `;
}

/**
 * Create budget progress bar
 * @param {number} spent - Amount spent
 * @param {number} budget - Total budget
 * @param {number} remaining - Remaining amount
 * @param {number} percentUsed - Percentage used
 * @param {string} currency - Currency code
 * @returns {string} HTML string
 */
function createBudgetProgress(spent, budget, remaining, percentUsed, currency) {
  const progressClass = percentUsed >= 100 ? 'over' : percentUsed >= 80 ? 'warning' : 'ok';
  const clampedPercent = Math.min(100, percentUsed);

  return `
    <div class="budget-progress-container">
      <div class="budget-progress">
        <div
          class="budget-progress-bar ${progressClass}"
          style="width: ${clampedPercent}%"
        ></div>
        ${percentUsed > 100 ? `
          <div
            class="budget-progress-over"
            style="width: ${Math.min(percentUsed - 100, 50)}%"
          ></div>
        ` : ''}
      </div>
      <div class="budget-progress-labels">
        <span class="progress-spent">${t('budget.percentUsed', { percent: formatPercentage(clampedPercent, 0) })}</span>
        <span class="progress-remaining">
          ${remaining >= 0 ? t('budget.amountLeft', { amount: formatCurrency(remaining, currency) }) : t('budget.amountOver', { amount: formatCurrency(Math.abs(remaining), currency) })}
        </span>
      </div>
    </div>
  `;
}

/**
 * Create category breakdown
 * @param {Array} categories - Array of { category, total }
 * @param {number} totalSpent - Total amount spent
 * @param {string} currency - Currency code
 * @returns {string} HTML string
 */
function createCategoryBreakdown(categories, totalSpent, currency) {
  return `
    <div class="category-breakdown">
      <h4>${t('budget.spendingByCategory')}</h4>
      <div class="category-list">
        ${categories.map(cat => {
          const percent = totalSpent > 0 ? calculatePercentage(cat.total, totalSpent) : 0;
          return `
            <div class="category-item">
              <div class="category-header">
                <span class="category-icon">${getCategoryIcon(cat.category)}</span>
                <span class="category-name">${formatCategoryName(cat.category)}</span>
                <span class="category-amount">${formatCurrency(cat.total, currency)}</span>
              </div>
              <div class="category-progress">
                <div
                  class="category-progress-bar category-${cat.category}"
                  style="width: ${percent}%"
                ></div>
              </div>
              <span class="category-percent">${formatPercentage(percent, 0)}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Create compact budget summary (for sidebars, headers)
 * @param {Object} summary - Expense summary
 * @param {string} currency - Currency code
 * @returns {string} HTML string
 */
function createCompactBudgetSummary(summary, currency) {
  const totalSpent = summary.totalSpent || 0;
  const budget = summary.budget;
  const remaining = summary.remaining;
  const percentUsed = summary.percentUsed || 0;
  const budgetStatus = summary.budgetStatus;

  return `
    <div class="budget-summary-compact">
      <div class="compact-amounts">
        <span class="compact-spent">${formatCurrency(totalSpent, currency)}</span>
        ${budget !== null ? `
          <span class="compact-separator">/</span>
          <span class="compact-budget">${formatCurrency(budget, currency)}</span>
        ` : ''}
      </div>
      ${budget !== null ? `
        <div class="compact-progress">
          <div
            class="compact-progress-bar ${budgetStatus || 'ok'}"
            style="width: ${Math.min(100, percentUsed)}%"
          ></div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Create budget edit form
 * @param {number} currentBudget - Current budget value
 * @param {string} currency - Currency code
 * @returns {string} HTML string
 */
export function createBudgetEditForm(currentBudget = null, currency = 'USD') {
  const currencies = getCommonCurrencies();

  return `
    <div class="budget-edit-form">
      <div class="modal-header">
        <h3 class="modal-title">${currentBudget !== null ? t('budget.budgetForm.editTitle') : t('budget.budgetForm.title')}</h3>
        <button type="button" class="modal-close" data-action="cancel-budget-form" aria-label="${t('common.close')}">&times;</button>
      </div>
      <form id="budget-form">
        <div class="form-group">
          <label for="budget-currency">${t('budget.budgetForm.currency')}</label>
          <select id="budget-currency" name="currency" class="form-select">
            ${currencies.map(c => `
              <option value="${c.code}" ${c.code === currency ? 'selected' : ''}>
                ${c.symbol} ${c.code} - ${c.name}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="budget-amount">${t('budget.budgetForm.amount')}</label>
          <div class="input-with-prefix">
            <span class="input-prefix" id="budget-currency-symbol">${getCurrencySymbol(currency)}</span>
            <input
              type="number"
              id="budget-amount"
              name="budget"
              step="0.01"
              min="0"
              value="${currentBudget || ''}"
              placeholder="${t('budget.budgetForm.amountPlaceholder')}"
            />
          </div>
          <p class="form-hint">${t('budget.budgetForm.hint')}</p>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-action="cancel-budget-form">
            ${t('common.cancel')}
          </button>
          <button type="submit" class="btn btn-primary">
            ${t('common.save')}
          </button>
          ${currentBudget !== null ? `
            <button type="button" class="btn btn-danger" data-action="remove-budget">
              ${t('budget.budgetForm.removeBudget')}
            </button>
          ` : ''}
        </div>
      </form>
    </div>
  `;
}

/**
 * Get category icon
 * @param {string} category - Expense category
 * @returns {string} Icon emoji
 */
function getCategoryIcon(category) {
  const icons = {
    accommodation: '🏨',
    transportation: '🚗',
    food: '🍽️',
    activities: '🎭',
    shopping: '🛍️',
    entertainment: '🎬',
    other: '📦',
  };
  return icons[category] || '📦';
}

/**
 * Format category name
 * @param {string} category - Category key
 * @returns {string} Formatted name
 */
function formatCategoryName(category) {
  return t(`expenses.categories.${category}`) || category;
}

/**
 * Get currency symbol
 * @param {string} currency - Currency code
 * @returns {string} Currency symbol
 */
function getCurrencySymbol(currency) {
  const symbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  };
  return symbols[currency] || currency;
}

export { createCompactBudgetSummary, createCategoryBreakdown };
