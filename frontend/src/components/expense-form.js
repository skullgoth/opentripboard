/**
 * T218: ExpenseForm component - amount, category, payer, split options
 * T032: Updated to use dynamic category-select component
 */
import { getCommonCurrencies, getCurrencySymbol } from '../utils/currency.js';
import { t } from '../utils/i18n.js';
import { createCategorySelect } from './category-select.js';
import { escapeHtml } from '../utils/html.js';

/**
 * Create expense form component
 * @param {Object} options - Form options
 * @returns {string} HTML string
 */
export function createExpenseForm(options = {}) {
  const {
    expense = null, // Existing expense for editing
    participants = [], // Trip participants for payer/split selection
    currency = 'USD',
    currentUserId = null,
    activities = [], // Optional: activities to link expense to
    tripId = null, // T032: Trip ID for loading trip owner's categories
  } = options;

  const isEditing = !!expense;
  const formTitle = isEditing ? t('expenses.editExpense') : t('expenses.addExpense');
  const submitLabel = isEditing ? t('documents.saveChanges') : t('expenses.addExpense');

  // Default values
  const amount = expense?.amount || '';
  const category = expense?.category || 'other';
  const description = expense?.description || '';
  const expenseDate = expense?.expenseDate || new Date().toISOString().split('T')[0];
  const payerId = expense?.payerId || currentUserId;
  const activityId = expense?.activityId || '';

  // Determine split type from existing expense
  let defaultSplitType = 'none';
  let oneWayUserId = '';
  if (expense?.splits?.length === 1) {
    // Single split = one-way
    defaultSplitType = 'oneway';
    oneWayUserId = expense.splits[0].userId;
  } else if (expense?.splits?.length > 1) {
    // Multiple splits - check if equal or custom
    const splitAmounts = expense.splits.map(s => s.amount);
    const allEqual = splitAmounts.every(a => Math.abs(a - splitAmounts[0]) < 0.01);
    defaultSplitType = allEqual ? 'equal' : 'custom';
  }

  return `
    <div class="expense-form-container">
      <div class="modal-header">
        <h3 class="modal-title">${formTitle}</h3>
        <button type="button" class="modal-close" data-action="cancel-expense-form" aria-label="${t('common.close')}">&times;</button>
      </div>

      <form id="expense-form" class="expense-form" data-expense-id="${expense?.id || ''}">
        <div class="form-row">
          <div class="form-group form-group-amount">
            <label for="expense-amount">${t('expenses.amountRequired')}</label>
            <div class="input-with-prefix">
              <span class="input-prefix">${getCurrencySymbol(currency)}</span>
              <input
                type="number"
                id="expense-amount"
                name="amount"
                step="0.01"
                min="0.01"
                value="${amount}"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label for="expense-category">${t('expenses.categoryRequired')}</label>
            <div id="expense-category-container" data-domain="expense" data-value="${category}" data-trip-id="${tripId || ''}"></div>
          </div>
        </div>

        <div class="form-group">
          <label for="expense-description">${t('activity.description')}</label>
          <input
            type="text"
            id="expense-description"
            name="description"
            value="${escapeHtml(description)}"
            placeholder="${t('expenses.descriptionPlaceholder')}"
            maxlength="500"
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="expense-date">${t('expenses.dateRequired')}</label>
            <input
              type="date"
              id="expense-date"
              name="expenseDate"
              value="${expenseDate}"
              required
            />
          </div>

          <div class="form-group">
            <label for="expense-payer">${t('expenses.paidByRequired')}</label>
            <select id="expense-payer" name="payerId" required>
              ${participants.map(p => `
                <option value="${p.id}" ${p.id === payerId ? 'selected' : ''}>
                  ${p.id === currentUserId ? t('expenses.you') : escapeHtml(p.fullName || p.email)}
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        ${activities.length > 0 ? `
          <div class="form-group">
            <label for="expense-activity">${t('documents.linkToActivity')}</label>
            <select id="expense-activity" name="activityId">
              <option value="">${t('expenses.none')}</option>
              ${activities.map(a => `
                <option value="${a.id}" ${a.id === activityId ? 'selected' : ''}>
                  ${escapeHtml(a.title)}
                </option>
              `).join('')}
            </select>
          </div>
        ` : ''}

        <div class="form-group">
          <label>${t('expenses.splitOptions')}</label>
          <div class="split-options">
            <label class="radio-option">
              <input
                type="radio"
                name="splitType"
                value="none"
                ${defaultSplitType === 'none' ? 'checked' : ''}
              />
              <span>${t('expenses.noSplit')}</span>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                name="splitType"
                value="oneway"
                ${defaultSplitType === 'oneway' ? 'checked' : ''}
              />
              <span>${t('expenses.onePersonOwes')}</span>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                name="splitType"
                value="equal"
                ${defaultSplitType === 'equal' ? 'checked' : ''}
              />
              <span>${t('expenses.splitEqually')}</span>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                name="splitType"
                value="custom"
                ${defaultSplitType === 'custom' ? 'checked' : ''}
              />
              <span>${t('expenses.customSplit')}</span>
            </label>
          </div>
        </div>

        <div id="oneway-split-container" class="oneway-split-container" style="display: ${defaultSplitType === 'oneway' ? 'block' : 'none'};">
          <div class="form-group">
            <label for="oneway-user">${t('expenses.whoOwes')}</label>
            <select id="oneway-user" name="onewayUserId">
              ${participants.filter(p => p.id !== payerId).map(p => `
                <option value="${p.id}" ${p.id === oneWayUserId ? 'selected' : ''}>
                  ${p.id === currentUserId ? t('expenses.you') : escapeHtml(p.fullName || p.email)}
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <div id="custom-splits-container" class="custom-splits-container" style="display: ${defaultSplitType === 'custom' ? 'block' : 'none'};">
          <h4>${t('expenses.customSplitAmounts')}</h4>
          <div id="custom-splits-list">
            ${participants.map(p => {
              const existingSplit = expense?.splits?.find(s => s.userId === p.id);
              const splitAmount = existingSplit?.amount || 0;
              return `
              <div class="split-row" data-user-id="${p.id}">
                <span class="split-user">
                  ${p.id === currentUserId ? t('expenses.you') : escapeHtml(p.fullName || p.email)}
                </span>
                <div class="split-input-group">
                  <span class="input-prefix">${getCurrencySymbol(currency)}</span>
                  <input
                    type="number"
                    class="split-amount-input"
                    data-user-id="${p.id}"
                    step="0.01"
                    min="0"
                    value="${splitAmount}"
                    placeholder="0.00"
                  />
                </div>
              </div>
            `;
            }).join('')}
          </div>
          <div class="split-total">
            <span>${t('expenses.total')}: </span>
            <span id="split-total-amount">${getCurrencySymbol(currency)}${expense?.splits?.reduce((sum, s) => sum + (s.amount || 0), 0).toFixed(2) || '0.00'}</span>
            <span id="split-validation-msg" class="validation-msg"></span>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-action="cancel-expense-form">
            ${t('common.cancel')}
          </button>
          <button type="submit" class="btn btn-primary">
            ${submitLabel}
          </button>
        </div>
      </form>
    </div>
  `;
}

/**
 * Get form data from expense form
 * @param {HTMLFormElement} form - Form element
 * @returns {Object} Form data
 */
export function getExpenseFormData(form) {
  const formData = new FormData(form);
  const splitType = formData.get('splitType');

  const data = {
    amount: parseFloat(formData.get('amount')),
    category: formData.get('category'),
    expenseDate: formData.get('expenseDate'),
    payerId: formData.get('payerId'),
  };

  // Only include optional fields if they have values (avoid sending null for UUID fields)
  const description = formData.get('description');
  if (description && description.trim()) {
    data.description = description.trim();
  }

  const activityId = formData.get('activityId');
  if (activityId && activityId.trim()) {
    data.activityId = activityId;
  }

  // Handle splits
  if (splitType === 'equal') {
    data.splitEvenly = true;
  } else if (splitType === 'oneway') {
    const onewayUserId = formData.get('onewayUserId');
    if (onewayUserId) {
      data.splits = [
        {
          userId: onewayUserId,
          amount: data.amount,
          percentage: 100,
        },
      ];
    }
  } else if (splitType === 'custom') {
    const splits = [];
    const splitInputs = form.querySelectorAll('.split-amount-input');
    splitInputs.forEach(input => {
      const amount = parseFloat(input.value);
      if (amount > 0) {
        splits.push({
          userId: input.dataset.userId,
          amount: amount,
        });
      }
    });
    data.splits = splits;
  }

  return data;
}

/**
 * Validate expense form
 * @param {Object} data - Form data
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export function validateExpenseForm(data) {
  const errors = [];

  if (!data.amount || data.amount <= 0) {
    errors.push(t('expenses.errors.amountRequired'));
  }

  if (!data.category) {
    errors.push(t('expenses.errors.categoryRequired'));
  }

  if (!data.expenseDate) {
    errors.push(t('expenses.errors.dateRequired'));
  }

  if (!data.payerId) {
    errors.push(t('expenses.errors.payerRequired'));
  }

  // Validate custom splits
  if (data.splits && data.splits.length > 0) {
    const totalSplits = data.splits.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(totalSplits - data.amount) > 0.01) {
      errors.push(t('expenses.errors.splitMismatch', { splitTotal: totalSplits.toFixed(2), expenseTotal: data.amount.toFixed(2) }));
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Initialize expense form event handlers
 * @param {HTMLElement} container - Form container
 * @param {string} currency - Currency code
 */
export async function initExpenseFormHandlers(container, currency = 'USD') {
  const form = container.querySelector('#expense-form');
  if (!form) return;

  // T032: Initialize category select component
  const categoryContainer = form.querySelector('#expense-category-container');
  if (categoryContainer) {
    const domain = categoryContainer.dataset.domain || 'expense';
    const value = categoryContainer.dataset.value || '';
    const tripId = categoryContainer.dataset.tripId || null;

    await createCategorySelect({
      container: categoryContainer,
      domain,
      value,
      tripId: tripId || undefined,
      id: 'expense-category',
      name: 'category',
      required: true,
    });
  }

  // Handle split type changes
  const splitRadios = form.querySelectorAll('input[name="splitType"]');
  const customSplitsContainer = form.querySelector('#custom-splits-container');
  const onewaySplitContainer = form.querySelector('#oneway-split-container');

  splitRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      // Hide all split containers first
      customSplitsContainer.style.display = 'none';
      onewaySplitContainer.style.display = 'none';

      // Show the appropriate container
      if (radio.value === 'custom') {
        customSplitsContainer.style.display = 'block';
      } else if (radio.value === 'oneway') {
        onewaySplitContainer.style.display = 'block';
      }
    });
  });

  // Update one-way user options when payer changes
  const payerSelect = form.querySelector('#expense-payer');
  const onewayUserSelect = form.querySelector('#oneway-user');

  if (payerSelect && onewayUserSelect) {
    payerSelect.addEventListener('change', () => {
      const selectedPayerId = payerSelect.value;
      // Disable the option for current payer in one-way dropdown
      Array.from(onewayUserSelect.options).forEach(option => {
        option.disabled = option.value === selectedPayerId;
        if (option.disabled && option.selected) {
          // Select next available option
          const nextOption = Array.from(onewayUserSelect.options).find(o => !o.disabled);
          if (nextOption) nextOption.selected = true;
        }
      });
    });
  }

  // Handle amount changes to update split suggestions
  const amountInput = form.querySelector('#expense-amount');
  const splitInputs = form.querySelectorAll('.split-amount-input');
  const splitTotalEl = form.querySelector('#split-total-amount');
  const validationMsg = form.querySelector('#split-validation-msg');

  // Update split total when any split amount changes
  const updateSplitTotal = () => {
    let total = 0;
    splitInputs.forEach(input => {
      total += parseFloat(input.value) || 0;
    });
    splitTotalEl.textContent = `${getCurrencySymbol(currency)}${total.toFixed(2)}`;

    // Validate against expense amount
    const expenseAmount = parseFloat(amountInput.value) || 0;
    if (total > 0 && Math.abs(total - expenseAmount) > 0.01) {
      validationMsg.textContent = `(should equal ${getCurrencySymbol(currency)}${expenseAmount.toFixed(2)})`;
      validationMsg.classList.add('error');
    } else {
      validationMsg.textContent = '';
      validationMsg.classList.remove('error');
    }
  };

  splitInputs.forEach(input => {
    input.addEventListener('input', updateSplitTotal);
  });

  amountInput.addEventListener('input', updateSplitTotal);
}

