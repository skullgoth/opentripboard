/**
 * T228: ListTemplateSelector component - allows users to select from predefined templates
 */
import { getListTypeIcon, formatListType } from './list-manager.js';
import { t } from '../utils/i18n.js';
import { escapeHtml } from '../utils/html.js';

/**
 * Create template selector modal content
 * @param {Array} templates - Array of template objects
 * @param {Object} options - Display options
 * @returns {string} HTML string
 */
export function createTemplateSelector(templates = [], options = {}) {
  const { showCustomOption = true } = options;

  // Group templates by category
  const packingTemplates = templates.filter(t => t.type === 'packing');
  const otherTemplates = templates.filter(t => t.type !== 'packing');

  return `
    <div class="template-selector">
      <div class="template-selector-header">
        <h3>${t('lists.templateSelector.title')}</h3>
        <p class="text-muted">${t('lists.templateSelector.subtitle')}</p>
      </div>

      ${showCustomOption ? `
        <div class="template-section">
          <h4>${t('lists.templateSelector.createCustom')}</h4>
          <div class="template-grid">
            ${createCustomOptions()}
          </div>
        </div>
      ` : ''}

      ${packingTemplates.length > 0 ? `
        <div class="template-section">
          <h4>${t('lists.templateSelector.packingLists')}</h4>
          <div class="template-grid">
            ${packingTemplates.map(template => createTemplateCard(template)).join('')}
          </div>
        </div>
      ` : ''}

      ${otherTemplates.length > 0 ? `
        <div class="template-section">
          <h4>${t('lists.templateSelector.otherTemplates')}</h4>
          <div class="template-grid">
            ${otherTemplates.map(template => createTemplateCard(template)).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Create custom list options
 * @returns {string} HTML string
 */
function createCustomOptions() {
  const customTypes = [
    { type: 'packing', icon: '🎒' },
    { type: 'todo', icon: '✅' },
    { type: 'shopping', icon: '🛒' },
    { type: 'custom', icon: '📝' },
  ];

  return customTypes.map(({ type, icon }) => `
    <div class="template-card custom-template" data-action="create-custom" data-type="${type}">
      <div class="template-icon">${icon}</div>
      <div class="template-info">
        <h5>${t(`lists.typeNames.${type}`)}</h5>
        <p class="template-description">${t(`lists.typeDescriptions.${type}`)}</p>
      </div>
      <div class="template-badge">${t('lists.templateSelector.blank')}</div>
    </div>
  `).join('');
}

/**
 * Create template card
 * @param {Object} template - Template object
 * @returns {string} HTML string
 */
export function createTemplateCard(template) {
  const typeIcon = getListTypeIcon(template.type);
  const itemCount = template.items?.length || 0;

  return `
    <div class="template-card" data-action="select-template" data-template-id="${template.id}">
      <div class="template-icon">${typeIcon}</div>
      <div class="template-info">
        <h5>${escapeHtml(template.name)}</h5>
        <p class="template-description">${escapeHtml(template.description || '')}</p>
        <span class="template-item-count">${t('lists.templateSelector.items', { count: itemCount })}</span>
      </div>
      <div class="template-preview">
        ${template.items?.slice(0, 3).map(item => `
          <span class="preview-tag">${escapeHtml(item.text)}</span>
        `).join('') || ''}
        ${itemCount > 3 ? `<span class="preview-tag more">+${itemCount - 3}</span>` : ''}
      </div>
    </div>
  `;
}

/**
 * Create list creation form (for custom lists)
 * @param {string} type - List type
 * @param {Object} options - Form options
 * @returns {string} HTML string
 */
export function createListForm(type = 'custom', options = {}) {
  const { existingList = null, templates = [] } = options;
  const isEditing = !!existingList;

  const typeIcon = getListTypeIcon(type);
  const typeName = formatListType(type);

  return `
    <div class="list-form">
      <div class="form-header">
        <span class="form-icon">${typeIcon}</span>
        <h3>${isEditing ? t('lists.form.editTitle', { type: typeName }) : t('lists.form.createTitle', { type: typeName })}</h3>
      </div>

      <form id="list-form" data-action="submit-list-form">
        <div class="form-group">
          <label for="list-title">${t('lists.form.listTitle')}</label>
          <input
            type="text"
            id="list-title"
            name="title"
            required
            placeholder="${t('lists.form.titlePlaceholder')}"
            value="${escapeHtml(existingList?.title || '')}"
            maxlength="255"
          />
        </div>

        <div class="form-group">
          <label for="list-type">${t('lists.form.listType')}</label>
          <select id="list-type" name="type" ${isEditing ? 'disabled' : ''}>
            <option value="packing" ${type === 'packing' ? 'selected' : ''}>🎒 ${t('lists.typeNames.packing')}</option>
            <option value="todo" ${type === 'todo' ? 'selected' : ''}>✅ ${t('lists.typeNames.todo')}</option>
            <option value="shopping" ${type === 'shopping' ? 'selected' : ''}>🛒 ${t('lists.typeNames.shopping')}</option>
            <option value="custom" ${type === 'custom' ? 'selected' : ''}>📝 ${t('lists.typeNames.custom')}</option>
          </select>
        </div>

        ${!isEditing && templates.length > 0 ? `
          <div class="form-group">
            <label for="list-template">${t('lists.form.startFromTemplate')}</label>
            <select id="list-template" name="templateId">
              <option value="">${t('lists.form.startBlank')}</option>
              ${templates.filter(tmpl => tmpl.type === type).map(tmpl => `
                <option value="${tmpl.id}">${escapeHtml(tmpl.name)} (${tmpl.items?.length || 0} items)</option>
              `).join('')}
            </select>
          </div>
        ` : ''}

        <input type="hidden" name="listId" value="${existingList?.id || ''}" />

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-action="cancel-form">
            ${t('common.cancel')}
          </button>
          <button type="submit" class="btn btn-primary">
            ${isEditing ? t('lists.form.saveChanges') : t('lists.form.createList')}
          </button>
        </div>
      </form>
    </div>
  `;
}

/**
 * Create quick add template button for specific use cases
 * @param {Object} template - Template object
 * @returns {string} HTML string
 */
export function createQuickTemplateButton(template) {
  const typeIcon = getListTypeIcon(template.type);

  return `
    <button
      class="quick-template-btn"
      data-action="quick-create-template"
      data-template-id="${template.id}"
      title="${t('lists.templateSelector.createTemplate', { name: escapeHtml(template.name) })}"
    >
      <span class="template-btn-icon">${typeIcon}</span>
      <span class="template-btn-name">${escapeHtml(template.name)}</span>
    </button>
  `;
}
