// Category manager component for settings page

import { t } from '../utils/i18n.js';
import { createIconPicker } from './icon-picker.js';
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryUsage,
} from '../services/categories.js';
import {
  setCategories,
  addCustomCategory,
  updateCustomCategory,
  removeCustomCategory,
  getCategories,
  getCustomCategoriesCount,
  setCategoriesLoading,
} from '../state/categories-state.js';
import { showToast } from '../utils/toast.js';
import { confirmDialog } from '../utils/confirm-dialog.js';

import { ACTIVITY_GROUPS, getGroupName } from '../utils/default-categories.js';

const MAX_CATEGORIES = 100;
// Note: 'reservation' domain has been merged into 'activity' domain
const VALID_DOMAINS = ['activity', 'expense', 'document'];

/**
 * Create a category manager component
 * @param {HTMLElement} container - Container element
 * @returns {Object} - Category manager API
 */
export function createCategoryManager(container) {
  // State
  let isLoading = false;
  let editingCategory = null;
  let iconPicker = null;

  // Create main wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'category-manager';

  // Render the component
  render();
  container.appendChild(wrapper);

  /**
   * Main render function
   */
  function render() {
    wrapper.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'category-manager-header';

    const title = document.createElement('h3');
    title.className = 'category-manager-title';
    title.textContent = t('settings.tripCategories.title') || 'Trip Categories';

    const subtitle = document.createElement('p');
    subtitle.className = 'category-manager-subtitle';
    subtitle.textContent = t('settings.tripCategories.subtitle') || 'Manage your custom categories for activities, expenses, and documents';

    header.appendChild(title);
    header.appendChild(subtitle);
    wrapper.appendChild(header);

    // Add category button
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'btn btn-primary category-manager-add-btn';
    addButton.innerHTML = `<span class="btn-icon">+</span> ${t('settings.tripCategories.addCategory') || 'Add Category'}`;

    const customCount = getCustomCategoriesCount();
    if (customCount >= MAX_CATEGORIES) {
      addButton.disabled = true;
      addButton.title = t('settings.tripCategories.maxCategoriesReached') || 'Maximum of 100 custom categories reached';
    }

    addButton.addEventListener('click', () => showCategoryForm());
    wrapper.appendChild(addButton);

    // Category count info
    const countInfo = document.createElement('div');
    countInfo.className = 'category-manager-count';
    countInfo.textContent = `${customCount} / ${MAX_CATEGORIES}`;
    wrapper.appendChild(countInfo);

    // Domain tabs/sections
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'category-manager-tabs';

    VALID_DOMAINS.forEach((domain) => {
      const tab = createDomainTab(domain);
      tabsContainer.appendChild(tab);
    });

    wrapper.appendChild(tabsContainer);

    // Categories list by domain
    const categoriesList = document.createElement('div');
    categoriesList.className = 'category-manager-list';

    const categories = getCategories();

    VALID_DOMAINS.forEach((domain) => {
      const section = createDomainSection(domain, categories.defaults[domain] || [], categories.custom[domain] || []);
      categoriesList.appendChild(section);
    });

    wrapper.appendChild(categoriesList);
  }

  /**
   * Create a domain tab
   * @param {string} domain - Domain name
   * @returns {HTMLElement} Tab element
   */
  function createDomainTab(domain) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'category-manager-tab';
    tab.dataset.domain = domain;
    tab.textContent = t(`categories.domains.${domain}`) || domain;

    tab.addEventListener('click', () => {
      // Scroll to section
      const section = wrapper.querySelector(`.category-domain-section[data-domain="${domain}"]`);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // Update active tab
      wrapper.querySelectorAll('.category-manager-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
    });

    return tab;
  }

  /**
   * Create a domain section with defaults and custom categories
   * T054: For reservations, groups defaults by lodging/transport/dining
   * @param {string} domain - Domain name
   * @param {Array} defaults - Default categories
   * @param {Array} custom - Custom categories
   * @returns {HTMLElement} Section element
   */
  function createDomainSection(domain, defaults, custom) {
    const section = document.createElement('div');
    section.className = 'category-domain-section';
    section.dataset.domain = domain;

    // Section header
    const header = document.createElement('h4');
    header.className = 'category-domain-header';
    header.textContent = t(`categories.domains.${domain}`) || domain;
    section.appendChild(header);

    // Default categories (read-only)
    if (defaults && defaults.length > 0) {
      const defaultsGroup = document.createElement('div');
      defaultsGroup.className = 'category-group category-group-defaults';

      const defaultsLabel = document.createElement('span');
      defaultsLabel.className = 'category-group-label';
      defaultsLabel.textContent = t('settings.tripCategories.defaultCategories') || 'Default Categories';
      defaultsGroup.appendChild(defaultsLabel);

      // Group activity defaults by their group (culture, nature, lodging, transport, dining, etc.)
      if (domain === 'activity') {
        // Build groups object from ACTIVITY_GROUPS
        const groups = {};
        ACTIVITY_GROUPS.forEach((g) => {
          groups[g.key] = [];
        });

        // Categorize defaults by group
        defaults.forEach((cat) => {
          if (cat.group && groups[cat.group]) {
            groups[cat.group].push(cat);
          }
        });

        // Render each group that has items
        ACTIVITY_GROUPS.forEach((groupDef) => {
          const items = groups[groupDef.key];
          if (items && items.length > 0) {
            const subGroup = document.createElement('div');
            subGroup.className = 'category-subgroup';

            const subLabel = document.createElement('span');
            subLabel.className = 'category-subgroup-label';
            subLabel.textContent = getGroupName(groupDef.key);
            subGroup.appendChild(subLabel);

            const subList = document.createElement('div');
            subList.className = 'category-items';

            items.forEach((cat) => {
              const item = createCategoryItem(cat, domain, false);
              subList.appendChild(item);
            });

            subGroup.appendChild(subList);
            defaultsGroup.appendChild(subGroup);
          }
        });
      } else {
        const defaultsList = document.createElement('div');
        defaultsList.className = 'category-items';

        defaults.forEach((cat) => {
          const item = createCategoryItem(cat, domain, false);
          defaultsList.appendChild(item);
        });

        defaultsGroup.appendChild(defaultsList);
      }

      section.appendChild(defaultsGroup);
    }

    // Custom categories
    const customGroup = document.createElement('div');
    customGroup.className = 'category-group category-group-custom';

    const customLabel = document.createElement('span');
    customLabel.className = 'category-group-label';
    customLabel.textContent = t('settings.tripCategories.customCategories') || 'Custom Categories';
    customGroup.appendChild(customLabel);

    const customList = document.createElement('div');
    customList.className = 'category-items category-items-custom';

    if (custom && custom.length > 0) {
      custom.forEach((cat) => {
        const item = createCategoryItem(cat, domain, true);
        customList.appendChild(item);
      });
    } else {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'category-empty-message';
      emptyMsg.textContent = t('settings.tripCategories.noCustomCategories') || 'No custom categories yet';
      customList.appendChild(emptyMsg);
    }

    customGroup.appendChild(customList);
    section.appendChild(customGroup);

    return section;
  }

  /**
   * Create a category item element
   * @param {Object} category - Category object
   * @param {string} domain - Domain name
   * @param {boolean} isCustom - Whether it's a custom category
   * @returns {HTMLElement} Item element
   */
  function createCategoryItem(category, domain, isCustom) {
    const item = document.createElement('div');
    item.className = `category-item ${isCustom ? 'category-item-custom' : 'category-item-default'}`;
    item.dataset.categoryId = category.id || category.key;

    // Icon
    const icon = document.createElement('span');
    icon.className = 'category-item-icon';
    icon.textContent = category.icon;
    item.appendChild(icon);

    // Name
    const name = document.createElement('span');
    name.className = 'category-item-name';
    name.textContent = isCustom ? category.name : (t(category.i18nKey) || category.key);
    item.appendChild(name);

    // Default indicator (small lock icon)
    if (!isCustom) {
      const badge = document.createElement('span');
      badge.className = 'category-item-badge';
      badge.textContent = '🔒';
      badge.title = t('settings.tripCategories.default') || 'Default';
      item.appendChild(badge);
    }

    // Actions for custom categories
    if (isCustom) {
      const actions = document.createElement('div');
      actions.className = 'category-item-actions';

      // Edit button
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-icon btn-small';
      editBtn.title = t('settings.tripCategories.editCategory') || 'Edit Category';
      editBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
      editBtn.addEventListener('click', () => showCategoryForm(category, domain));
      actions.appendChild(editBtn);

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-icon btn-small btn-danger';
      deleteBtn.title = t('settings.tripCategories.deleteCategory') || 'Delete Category';
      deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      deleteBtn.addEventListener('click', () => confirmDeleteCategory(category));
      actions.appendChild(deleteBtn);

      item.appendChild(actions);
    }

    return item;
  }

  /**
   * Show category form (create or edit)
   * @param {Object} category - Category to edit (null for create)
   * @param {string} domain - Domain for new category
   */
  function showCategoryForm(category = null, domain = null) {
    editingCategory = category;

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal modal-category-form';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    // Modal header
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';

    const modalTitle = document.createElement('h3');
    modalTitle.textContent = category
      ? (t('settings.tripCategories.editCategory') || 'Edit Category')
      : (t('settings.tripCategories.addCategory') || 'Add Category');
    modalHeader.appendChild(modalTitle);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => closeModal(modal));
    modalHeader.appendChild(closeBtn);

    modalContent.appendChild(modalHeader);

    // Form
    const form = document.createElement('form');
    form.className = 'category-form';

    // Icon picker
    const iconGroup = document.createElement('div');
    iconGroup.className = 'form-group';
    const iconLabel = document.createElement('label');
    iconLabel.textContent = t('settings.tripCategories.categoryIcon') || 'Icon';
    iconGroup.appendChild(iconLabel);

    const iconPickerContainer = document.createElement('div');
    iconPickerContainer.className = 'icon-picker-container';
    iconGroup.appendChild(iconPickerContainer);

    form.appendChild(iconGroup);

    // Name input
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    const nameLabel = document.createElement('label');
    nameLabel.setAttribute('for', 'category-name');
    nameLabel.textContent = t('settings.tripCategories.categoryName') || 'Category Name';
    nameGroup.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'category-name';
    nameInput.className = 'form-input';
    nameInput.placeholder = t('settings.tripCategories.categoryNamePlaceholder') || 'Enter category name...';
    nameInput.maxLength = 50;
    nameInput.value = category?.name || '';
    nameInput.required = true;
    nameGroup.appendChild(nameInput);

    form.appendChild(nameGroup);

    // Domain select (only for new categories)
    if (!category) {
      const domainGroup = document.createElement('div');
      domainGroup.className = 'form-group';
      const domainLabel = document.createElement('label');
      domainLabel.setAttribute('for', 'category-domain');
      domainLabel.textContent = t('settings.tripCategories.domain') || 'Category Type';
      domainGroup.appendChild(domainLabel);

      const domainSelect = document.createElement('select');
      domainSelect.id = 'category-domain';
      domainSelect.className = 'form-select';
      domainSelect.required = true;

      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = t('settings.tripCategories.selectDomain') || 'Select category type...';
      domainSelect.appendChild(defaultOption);

      VALID_DOMAINS.forEach((d) => {
        const option = document.createElement('option');
        option.value = d;
        option.textContent = t(`categories.domains.${d}`) || d;
        if (d === domain) option.selected = true;
        domainSelect.appendChild(option);
      });

      domainGroup.appendChild(domainSelect);
      form.appendChild(domainGroup);
    }

    // Error message container
    const errorContainer = document.createElement('div');
    errorContainer.className = 'form-error';
    errorContainer.style.display = 'none';
    form.appendChild(errorContainer);

    // Form actions
    const actions = document.createElement('div');
    actions.className = 'form-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = t('common.cancel') || 'Cancel';
    cancelBtn.addEventListener('click', () => closeModal(modal));
    actions.appendChild(cancelBtn);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = t('common.save') || 'Save';
    actions.appendChild(submitBtn);

    form.appendChild(actions);
    modalContent.appendChild(form);
    modal.appendChild(modalContent);

    // Initialize icon picker after modal is in DOM
    document.body.appendChild(modal);

    iconPicker = createIconPicker({
      container: iconPickerContainer,
      selectedIcon: category?.icon || '',
      onSelect: () => {},
    });

    // Focus name input
    setTimeout(() => nameInput.focus(), 100);

    // Form submit handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorContainer.style.display = 'none';

      const selectedIcon = iconPicker.getValue();
      const name = nameInput.value.trim();
      const selectedDomain = category ? category.domain : document.getElementById('category-domain')?.value;

      // Validation
      const errors = [];
      if (!selectedIcon) {
        errors.push(t('settings.tripCategories.iconRequired') || 'Please select an icon');
      }
      if (!name) {
        errors.push(t('settings.tripCategories.nameRequired') || 'Category name is required');
      }
      if (name.length > 50) {
        errors.push(t('settings.tripCategories.nameTooLong') || 'Category name must be 50 characters or less');
      }
      if (!category && !selectedDomain) {
        errors.push(t('settings.tripCategories.domainRequired') || 'Please select a category type');
      }

      if (errors.length > 0) {
        errorContainer.textContent = errors.join('. ');
        errorContainer.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = t('common.loading') || 'Loading...';

      try {
        if (category) {
          // T043: Optimistic update with rollback for edit operations
          // Save old values for rollback
          const previousName = category.name;
          const previousIcon = category.icon;

          // Update state optimistically
          updateCustomCategory(category.id, { name, icon: selectedIcon });

          try {
            // Call API
            await updateCategory(category.id, { name, icon: selectedIcon });
            showToast(t('settings.tripCategories.categoryUpdated') || 'Category updated', 'success');
          } catch (apiError) {
            // Rollback on API failure
            updateCustomCategory(category.id, { name: previousName, icon: previousIcon });
            throw apiError;
          }
        } else {
          // Create new category
          const created = await createCategory({ name, icon: selectedIcon, domain: selectedDomain });
          addCustomCategory({ ...created, domain: selectedDomain });
          showToast(t('settings.tripCategories.categoryCreated') || 'Category created', 'success');
        }

        closeModal(modal);
        render();
      } catch (error) {
        console.error('Failed to save category:', error);
        errorContainer.textContent = error.message || (category
          ? (t('settings.tripCategories.updateFailed') || 'Failed to update category')
          : (t('settings.tripCategories.createFailed') || 'Failed to create category'));
        errorContainer.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = t('common.save') || 'Save';
      }
    });

    // Close on escape
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal(modal);
      }
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  }

  /**
   * Close modal and cleanup
   * @param {HTMLElement} modal - Modal element
   */
  function closeModal(modal) {
    if (iconPicker) {
      iconPicker.destroy();
      iconPicker = null;
    }
    editingCategory = null;
    modal.remove();
  }

  /**
   * Confirm and delete a category
   * @param {Object} category - Category to delete
   */
  async function confirmDeleteCategory(category) {
    try {
      // Get usage count first
      const usage = await getCategoryUsage(category.id);

      let message;
      if (usage.total > 0) {
        message = (t('settings.tripCategories.confirmDeleteInUse') || 'This category is used by {{count}} item(s). Deleting it will reassign those items to "Other". Are you sure?')
          .replace('{{count}}', usage.total);
      } else {
        message = (t('settings.tripCategories.confirmDelete') || 'Are you sure you want to delete "{{name}}"?')
          .replace('{{name}}', category.name);
      }

      if (!await confirmDialog({ message, variant: 'danger' })) {
        return;
      }

      await deleteCategory(category.id);
      removeCustomCategory(category.id);
      showToast(t('settings.tripCategories.categoryDeleted') || 'Category deleted', 'success');
      render();
    } catch (error) {
      console.error('Failed to delete category:', error);
      showToast(t('settings.tripCategories.deleteFailed') || 'Failed to delete category', 'error');
    }
  }

  /**
   * Load categories from API
   */
  async function loadCategories() {
    if (isLoading) return;

    isLoading = true;
    setCategoriesLoading(true);

    try {
      const data = await fetchCategories();
      setCategories(data);
      render();
    } catch (error) {
      console.error('Failed to load categories:', error);
      showToast(t('settings.tripCategories.loadFailed') || 'Failed to load categories', 'error');
    } finally {
      isLoading = false;
      setCategoriesLoading(false);
    }
  }

  // Initial load
  loadCategories();

  // API
  return {
    /**
     * Refresh categories from API
     */
    refresh: loadCategories,

    /**
     * Re-render the component
     */
    render,

    /**
     * Destroy the component
     */
    destroy() {
      if (iconPicker) {
        iconPicker.destroy();
      }
      wrapper.remove();
    },

    /**
     * Get the DOM element
     * @returns {HTMLElement} Wrapper element
     */
    getElement() {
      return wrapper;
    },
  };
}

export default createCategoryManager;
