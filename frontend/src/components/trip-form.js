// T071: TripForm component - create/edit trip modal
// T017: Integrated destination autocomplete
import { formatDateForInput } from '../utils/date-helpers.js';
import { validateCoverImage } from '../utils/validators.js';
import { t } from '../utils/i18n.js';
import { createAutocomplete } from './autocomplete.js';
import { searchDestinations } from '../services/geocoding-api.js';
import { getPreferences } from '../state/preferences-state.js';

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Create trip form modal
 * @param {Object} trip - Existing trip data (for edit mode)
 * @returns {string} HTML string
 */
export function createTripForm(trip = null) {
  const isEdit = !!trip;
  const title = isEdit ? t('tripForm.editTrip') : t('tripForm.createNewTrip');
  const submitText = isEdit ? t('tripForm.updateTrip') : t('tripForm.createTrip');

  return `
    <div class="modal-overlay" id="trip-form-modal" data-modal="trip-form" role="dialog" aria-modal="true" aria-labelledby="trip-form-title">
      <div class="modal-dialog">
        <div class="modal-header">
          <h2 class="modal-title" id="trip-form-title">${title}</h2>
          <button class="modal-close" data-action="close-modal" aria-label="${t('common.close')}">&times;</button>
        </div>

        <form id="trip-form" class="modal-body">
        <div class="form-group">
          <label for="trip-name" class="form-label">${t('tripForm.tripNameRequired')}</label>
          <input
            type="text"
            id="trip-name"
            name="name"
            class="form-input"
            placeholder="${t('tripForm.tripNamePlaceholder')}"
            value="${escapeHtml(trip?.name || '')}"
            required
            maxlength="100"
          />
          <div class="form-hint char-counter"><span id="trip-name-count">${(trip?.name || '').length}</span>/100</div>
          <div class="form-error" data-error="name"></div>
        </div>

        <div class="form-group">
          <label for="trip-destination" class="form-label">${t('tripForm.destinationRequired')}</label>
          <div id="destination-autocomplete-container"></div>
          <div class="form-hint" id="destination-hint" style="display: none;">
            <span class="hint-icon">ℹ️</span>
            <span id="destination-hint-text"></span>
          </div>
          <div class="form-error" data-error="destination"></div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="trip-start-date" class="form-label">${t('tripForm.startDateRequired')}</label>
            <input
              type="date"
              id="trip-start-date"
              name="startDate"
              class="form-input"
              value="${trip?.startDate ? formatDateForInput(trip.startDate) : ''}"
              required
            />
            <div class="form-error" data-error="startDate"></div>
          </div>

          <div class="form-group">
            <label for="trip-end-date" class="form-label">${t('tripForm.endDateRequired')}</label>
            <input
              type="date"
              id="trip-end-date"
              name="endDate"
              class="form-input"
              value="${trip?.endDate ? formatDateForInput(trip.endDate) : ''}"
              required
            />
            <div class="form-error" data-error="endDate"></div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="trip-budget" class="form-label">${t('trip.budget')}</label>
            <input
              type="number"
              id="trip-budget"
              name="budget"
              class="form-input"
              placeholder="5000"
              value="${trip?.budget || ''}"
              min="0"
              step="0.01"
            />
          </div>

          <div class="form-group">
            <label for="trip-currency" class="form-label">${t('tripForm.currency')}</label>
            <select id="trip-currency" name="currency" class="form-select">
              <option value="EUR" ${!trip || trip.currency === 'EUR' ? 'selected' : ''}>EUR</option>
              <option value="USD" ${trip?.currency === 'USD' ? 'selected' : ''}>USD</option>
              <option value="GBP" ${trip?.currency === 'GBP' ? 'selected' : ''}>GBP</option>
              <option value="JPY" ${trip?.currency === 'JPY' ? 'selected' : ''}>JPY</option>
              <option value="CAD" ${trip?.currency === 'CAD' ? 'selected' : ''}>CAD</option>
              <option value="AUD" ${trip?.currency === 'AUD' ? 'selected' : ''}>AUD</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="trip-description" class="form-label">${t('trip.description')}</label>
          <textarea
            id="trip-description"
            name="description"
            class="form-textarea"
            placeholder="${t('tripForm.descriptionPlaceholder')}"
            rows="3"
            maxlength="250"
          >${escapeHtml(trip?.description || '')}</textarea>
          <div class="form-hint char-counter"><span id="trip-description-count">${(trip?.description || '').length}</span>/250</div>
        </div>

        <div class="form-group">
          <label for="trip-cover-image" class="form-label">${t('tripForm.coverImage')}</label>
          <div class="cover-image-upload">
            <input
              type="file"
              id="trip-cover-image"
              name="coverImage"
              class="form-input-file"
              accept="image/jpeg,image/png,image/webp"
            />
            <div class="cover-image-preview" id="cover-image-preview" style="display: none;">
              <img src="" alt="${t('tripForm.coverPreview')}" data-testid="cover-image-preview" />
              <button type="button" class="btn-remove-preview" data-action="remove-cover-preview" aria-label="${t('tripForm.removeImage')}">
                &times;
              </button>
            </div>
            <div class="form-hint">${t('tripForm.coverImageHint')}</div>
            <div class="form-error" data-error="coverImage"></div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-sm btn-secondary" data-action="close-modal">
            ${t('common.cancel')}
          </button>
          <button type="submit" class="btn btn-sm btn-primary" id="trip-form-submit">
            ${submitText}
          </button>
        </div>
      </form>
      </div>
    </div>
  `;
}

/**
 * Attach trip form listeners
 * @param {HTMLElement} container - Modal container
 * @param {Function} onSubmit - Submit callback
 * @param {Function} onClose - Close callback
 * @param {Object} trip - Existing trip data (for edit mode)
 */
export function attachTripFormListeners(container, onSubmit, onClose, trip = null) {
  const modal = container.querySelector('[data-modal="trip-form"]');
  const form = container.querySelector('#trip-form');
  const closeButtons = container.querySelectorAll('[data-action="close-modal"]');
  const submitButton = form.querySelector('#trip-form-submit');

  // Get required fields
  const nameInput = form.querySelector('#trip-name');
  const startDateInput = form.querySelector('#trip-start-date');
  const endDateInput = form.querySelector('#trip-end-date');
  const descriptionInput = form.querySelector('#trip-description');

  // T017: Store selected destination data
  let selectedDestinationData = trip?.destinationData || null;
  let destinationValue = trip?.destination || '';

  // T017: Initialize autocomplete for destination
  const autocompleteContainer = form.querySelector('#destination-autocomplete-container');
  const destinationHint = form.querySelector('#destination-hint');
  const destinationHintText = form.querySelector('#destination-hint-text');

  let autocomplete = null;
  let isAutocompleteAvailable = true;

  try {
    autocomplete = createAutocomplete({
      container: autocompleteContainer,
      placeholder: t('tripForm.destinationPlaceholder'),
      minChars: 2,
      debounceMs: 300,
      noResultsText: t('tripForm.noDestinationsFound', 'No locations found'),
      loadingText: t('tripForm.searchingDestinations', 'Searching...'),
      errorText: t('tripForm.destinationSearchError', 'Search unavailable'),
      onSearch: async (query) => {
        try {
          const { language } = getPreferences();
          const result = await searchDestinations(query, { limit: 5, language });
          isAutocompleteAvailable = true;
          hideDestinationHint();
          return result.results;
        } catch (error) {
          if (error.message === 'SERVICE_UNAVAILABLE') {
            isAutocompleteAvailable = false;
            showDestinationHint(t('tripForm.autocompleteUnavailable', 'Destination search is temporarily unavailable. You can type your destination manually.'), 'warning');
          }
          throw error;
        }
      },
      onSelect: (destination) => {
        selectedDestinationData = destination;
        destinationValue = destination.display_name;
        showDestinationHint(`✓ ${t('tripForm.validatedDestination', 'Validated location')}: ${destination.display_name}`, 'success');
      },
      formatResult: (destination) => destination.display_name,
      getItemValue: (destination) => destination.display_name,
    });

    // Set initial value if editing
    if (trip?.destination) {
      autocomplete.setValue(trip.destination);
    }

    // Get the autocomplete input for validation
    const destinationInput = autocomplete.getInput();
    destinationInput.id = 'trip-destination';
    destinationInput.name = 'destination';
    destinationInput.required = true;

    // T020: Helper functions for destination hints
    function showDestinationHint(text, type = 'info') {
      destinationHintText.textContent = text;
      destinationHint.className = `form-hint hint-${type}`;
      destinationHint.style.display = 'block';
    }

    function hideDestinationHint() {
      destinationHint.style.display = 'none';
    }

    // Track manual input changes (when user types without selecting from dropdown)
    destinationInput.addEventListener('input', () => {
      const currentValue = destinationInput.value;
      if (currentValue !== destinationValue) {
        // User modified the selected value or typed manually
        selectedDestinationData = null;
        destinationValue = currentValue;
        hideDestinationHint();
      }
    });

  } catch (error) {
    console.error('Failed to initialize autocomplete:', error);
    // T020: Fallback to manual input if autocomplete fails
    isAutocompleteAvailable = false;
    const fallbackInput = document.createElement('input');
    fallbackInput.type = 'text';
    fallbackInput.id = 'trip-destination';
    fallbackInput.name = 'destination';
    fallbackInput.className = 'form-input';
    fallbackInput.placeholder = t('tripForm.destinationPlaceholder');
    fallbackInput.value = trip?.destination || '';
    fallbackInput.required = true;
    fallbackInput.maxLength = 255;
    autocompleteContainer.appendChild(fallbackInput);

    const destinationInput = fallbackInput;
    showDestinationHint(t('tripForm.autocompleteUnavailable', 'Destination search is temporarily unavailable. You can type your destination manually.'), 'warning');
  }

  // Get the destination input (either from autocomplete or fallback)
  const destinationInput = form.querySelector('#trip-destination');

  // Get character counter elements
  const nameCountEl = form.querySelector('#trip-name-count');
  const descriptionCountEl = form.querySelector('#trip-description-count');

  // Character counter update functions
  const updateNameCounter = () => {
    if (nameCountEl) {
      nameCountEl.textContent = nameInput.value.length;
    }
  };

  const updateDescriptionCounter = () => {
    if (descriptionCountEl) {
      descriptionCountEl.textContent = descriptionInput.value.length;
    }
  };

  // Attach character counter listeners
  nameInput.addEventListener('input', updateNameCounter);
  if (descriptionInput) {
    descriptionInput.addEventListener('input', updateDescriptionCounter);
  }

  // Get cover image elements
  const coverImageInput = form.querySelector('#trip-cover-image');
  const coverImagePreview = form.querySelector('#cover-image-preview');
  const coverImagePreviewImg = coverImagePreview?.querySelector('img');
  const removePreviewBtn = form.querySelector('[data-action="remove-cover-preview"]');

  // Real-time validation function
  const validateAndUpdateUI = () => {
    clearFormErrors(form);

    const tripData = {
      name: nameInput.value,
      destination: destinationInput.value,
      startDate: startDateInput.value,
      endDate: endDateInput.value,
    };

    const errors = validateTripData(tripData);

    // Show errors
    if (errors.length > 0) {
      showFormErrors(form, errors);
    }

    // Update submit button state
    updateSubmitButtonState(form, submitButton);
  };

  // Add real-time validation on input/change
  nameInput.addEventListener('input', validateAndUpdateUI);
  destinationInput.addEventListener('input', validateAndUpdateUI);
  startDateInput.addEventListener('change', validateAndUpdateUI);
  endDateInput.addEventListener('change', validateAndUpdateUI);

  // Initial validation state
  validateAndUpdateUI();

  // Handle cover image upload
  if (coverImageInput) {
    coverImageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Validate file
      const validation = validateCoverImage(file);
      const errorEl = form.querySelector('[data-error="coverImage"]');

      if (!validation.valid) {
        errorEl.textContent = validation.errors.join(', ');
        errorEl.style.display = 'block';
        coverImageInput.value = '';
        return;
      }

      // Clear errors
      errorEl.textContent = '';
      errorEl.style.display = 'none';

      // Show preview
      const reader = new FileReader();
      reader.onload = (event) => {
        if (coverImagePreviewImg) {
          coverImagePreviewImg.src = event.target.result;
          coverImagePreview.style.display = 'block';
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Handle remove preview
  if (removePreviewBtn) {
    removePreviewBtn.addEventListener('click', () => {
      coverImageInput.value = '';
      coverImagePreview.style.display = 'none';
      if (coverImagePreviewImg) {
        coverImagePreviewImg.src = '';
      }
    });
  }

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous errors
    clearFormErrors(form);

    const formData = new FormData(form);
    const tripData = {
      name: formData.get('name'),
      destination: formData.get('destination'),
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
      budget: formData.get('budget') ? parseFloat(formData.get('budget')) : null,
      currency: formData.get('currency'),
      description: formData.get('description')?.trim() || null,
      coverImage: formData.get('coverImage'),
      // T019: Include validated destination data if available
      destinationData: selectedDestinationData,
    };

    // Validate
    const errors = validateTripData(tripData);
    if (errors.length > 0) {
      showFormErrors(form, errors);
      return;
    }

    // T030: Show loading indicator during trip creation (cover image fetch)
    submitButton.disabled = true;
    const originalButtonText = submitButton.textContent;

    if (selectedDestinationData) {
      submitButton.textContent = t('tripForm.fetchingCoverImage', 'Creating trip and fetching cover image...');
    } else {
      submitButton.textContent = t('tripForm.creating', 'Creating trip...');
    }

    // Call submit callback
    if (onSubmit) {
      try {
        await onSubmit(tripData);
      } catch (error) {
        showFormErrors(form, [{ field: 'general', message: error.message }]);
      } finally {
        // Restore button state
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  });

  // Handle close
  closeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (onClose) onClose();
    });
  });

  // Close on overlay click (clicking outside the dialog)
  const overlay = container.querySelector('.modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (onClose) onClose();
      }
    });
  }

  // Add open class for animation
  requestAnimationFrame(() => {
    if (overlay) overlay.classList.add('open');
  });
}

/**
 * Validate trip data
 * @param {Object} tripData - Trip data to validate
 * @returns {Array} Array of error objects
 */
function validateTripData(tripData) {
  const errors = [];

  // Mandatory fields validation
  if (!tripData.name || tripData.name.trim().length === 0) {
    errors.push({ field: 'name', message: t('tripForm.errors.nameRequired') });
  }

  if (!tripData.destination || tripData.destination.trim().length === 0) {
    errors.push({ field: 'destination', message: t('tripForm.errors.destinationRequired') });
  }

  if (!tripData.startDate) {
    errors.push({ field: 'startDate', message: t('tripForm.errors.startDateRequired') });
  }

  if (!tripData.endDate) {
    errors.push({ field: 'endDate', message: t('tripForm.errors.endDateRequired') });
  }

  // Date range validation (only if both dates are provided)
  if (tripData.startDate && tripData.endDate) {
    const start = new Date(tripData.startDate);
    const end = new Date(tripData.endDate);

    if (end < start) {
      errors.push({ field: 'endDate', message: t('tripForm.errors.endDateAfterStart') });
    }
  }

  // Optional budget validation (only if provided)
  if (tripData.budget !== null && tripData.budget !== undefined && tripData.budget < 0) {
    errors.push({ field: 'budget', message: t('tripForm.errors.budgetPositive') });
  }

  return errors;
}

/**
 * Update submit button state based on form validation
 * @param {HTMLElement} form - Form element
 * @param {HTMLButtonElement} submitButton - Submit button
 */
function updateSubmitButtonState(form, submitButton) {
  const nameInput = form.querySelector('#trip-name');
  const destinationInput = form.querySelector('#trip-destination');
  const startDateInput = form.querySelector('#trip-start-date');
  const endDateInput = form.querySelector('#trip-end-date');

  // Check if all required fields are filled
  const allRequiredFieldsFilled =
    nameInput.value.trim().length > 0 &&
    destinationInput.value.trim().length > 0 &&
    startDateInput.value &&
    endDateInput.value;

  // Check for date validation errors
  let hasDateError = false;
  if (startDateInput.value && endDateInput.value) {
    const start = new Date(startDateInput.value);
    const end = new Date(endDateInput.value);
    hasDateError = end < start;
  }

  // Enable/disable submit button
  submitButton.disabled = !allRequiredFieldsFilled || hasDateError;
}

/**
 * Show form errors
 * @param {HTMLElement} form - Form element
 * @param {Array} errors - Array of error objects
 */
function showFormErrors(form, errors) {
  errors.forEach(({ field, message }) => {
    const errorEl = form.querySelector(`[data-error="${field}"]`);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  });
}

/**
 * Clear form errors
 * @param {HTMLElement} form - Form element
 */
function clearFormErrors(form) {
  form.querySelectorAll('.form-error').forEach((el) => {
    el.textContent = '';
    el.style.display = 'none';
  });
}
