/**
 * Activity Notes & Attachments Component
 * Collapsible section for activity cards showing text notes and file attachments.
 */
import { t } from '../utils/i18n.js';
import { escapeHtml } from '../utils/html.js';
import {
  getActivityNotes,
  createActivityNote,
  updateActivityNote,
  deleteActivityNote,
  getActivityDocuments,
  downloadDocument,
  deleteDocument,
} from '../services/api-client.js';
import { showToast } from '../utils/toast.js';
import { confirmDialog } from '../utils/confirm-dialog.js';
import { logError } from '../utils/error-tracking.js';

/**
 * Create the notes & attachments section HTML (placeholder until data loads)
 * @param {number} noteCount - Cached note count (0 if unknown)
 * @param {number} docCount - Cached document count (0 if unknown)
 * @returns {string} HTML string
 */
export function createNotesAttachmentsSection(noteCount = 0, docCount = 0) {
  const totalCount = noteCount + docCount;
  const badge = totalCount > 0 ? `(${totalCount})` : '';

  return `
    <div class="activity-notes-attachments" data-loaded="false">
      <div class="activity-notes-attachments-header" data-action="toggle-notes-attachments">
        <span class="activity-notes-attachments-icon">📎</span>
        <span class="activity-notes-attachments-title">${t('activity.notesAttachments', 'Notes & Attachments')}</span>
        <span class="activity-notes-attachments-badge">${badge}</span>
        <span class="activity-notes-attachments-chevron">▶</span>
      </div>
      <div class="activity-notes-attachments-body" style="display: none;">
        <div class="activity-notes-attachments-loading">
          <span class="spinner-small"></span> ${t('common.loading')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render the full notes & attachments content
 * @param {Array} notes - Notes array
 * @param {Array} documents - Documents array
 * @param {string} currentUserId - Current user ID
 * @returns {string} HTML string
 */
function renderNotesAttachmentsContent(notes, documents, currentUserId) {
  const notesHtml = renderNotesList(notes, currentUserId);
  const attachmentsHtml = renderAttachmentsList(documents, currentUserId);

  return `
    <div class="activity-notes-section">
      <div class="activity-notes-list">
        ${notesHtml}
      </div>
      <div class="activity-notes-add-form">
        <textarea
          class="activity-note-input"
          placeholder="${t('activity.addNote', 'Add a note...')}"
          maxlength="2000"
          rows="2"
        ></textarea>
        <button class="btn btn-sm btn-primary activity-note-submit" disabled>
          ${t('common.add')}
        </button>
      </div>
    </div>
    <div class="activity-attachments-section">
      <div class="activity-attachments-list">
        ${attachmentsHtml}
      </div>
      <button class="btn btn-sm btn-ghost activity-attach-file-btn">
        📎 ${t('activity.attachFile', 'Attach file')}
      </button>
    </div>
  `;
}

/**
 * Render notes list
 * @param {Array} notes - Notes array
 * @param {string} currentUserId - Current user ID
 * @returns {string} HTML string
 */
function renderNotesList(notes, currentUserId) {
  if (!notes || notes.length === 0) {
    return `<div class="activity-notes-empty">${t('activity.noNotesYet', 'No notes yet')}</div>`;
  }

  return notes.map((note) => {
    const isOwner = note.authorId === currentUserId;
    const date = new Date(note.createdAt);
    const timeStr = date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `
      <div class="activity-note-item" data-note-id="${note.id}">
        <div class="activity-note-header">
          <span class="activity-note-author">${escapeHtml(note.authorName || 'Unknown')}</span>
          <span class="activity-note-time">${timeStr}</span>
          ${isOwner ? `
            <div class="activity-note-actions">
              <button class="btn-icon-sm" data-action="edit-note" data-note-id="${note.id}" title="${t('activity.editNote', 'Edit note')}">✏️</button>
              <button class="btn-icon-sm" data-action="delete-note" data-note-id="${note.id}" title="${t('activity.deleteNote', 'Delete note')}">🗑️</button>
            </div>
          ` : ''}
        </div>
        <div class="activity-note-content">${escapeHtml(note.content)}</div>
      </div>
    `;
  }).join('');
}

/**
 * Render attachments list
 * @param {Array} documents - Documents array
 * @param {string} currentUserId - Current user ID
 * @returns {string} HTML string
 */
function renderAttachmentsList(documents, currentUserId) {
  if (!documents || documents.length === 0) {
    return `<div class="activity-attachments-empty">${t('activity.noAttachmentsYet', 'No attachments yet')}</div>`;
  }

  return `<div class="activity-attachment-grid">${documents.map((doc) => {
    const isImage = doc.fileType && doc.fileType.startsWith('image/');
    const isOwner = doc.uploadedBy === currentUserId;

    return `
      <div class="activity-attachment-item" data-document-id="${doc.id}">
        <div class="activity-attachment-preview">
          ${isImage
    ? `<img src="/uploads/documents/${doc.filePath.split('/').pop()}" alt="${escapeHtml(doc.fileName)}" loading="lazy" />`
    : `<span class="activity-attachment-icon">📄</span>`}
        </div>
        <div class="activity-attachment-info">
          <span class="activity-attachment-name" title="${escapeHtml(doc.fileName)}">${escapeHtml(truncateFileName(doc.fileName, 20))}</span>
        </div>
        <div class="activity-attachment-actions">
          <button class="btn-icon-sm" data-action="download-attachment" data-document-id="${doc.id}" data-file-name="${escapeAttr(doc.fileName)}" title="Download">⬇️</button>
          ${isOwner ? `<button class="btn-icon-sm" data-action="delete-attachment" data-document-id="${doc.id}" title="${t('common.delete')}">🗑️</button>` : ''}
        </div>
      </div>
    `;
  }).join('')}</div>`;
}

/**
 * Attach event listeners for the notes & attachments section
 * @param {HTMLElement} card - Activity card element
 * @param {string} tripId - Trip ID
 * @param {string} activityId - Activity ID
 * @param {string} currentUserId - Current user ID
 * @param {Object} callbacks - Callbacks { onUploadFile }
 */
export function attachNotesAttachmentsListeners(card, tripId, activityId, currentUserId, callbacks = {}) {
  const section = card.querySelector('.activity-notes-attachments');
  if (!section) return;

  const header = section.querySelector('.activity-notes-attachments-header');
  const body = section.querySelector('.activity-notes-attachments-body');
  const chevron = section.querySelector('.activity-notes-attachments-chevron');

  // Toggle expand/collapse
  header?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isExpanded = body.style.display !== 'none';

    if (isExpanded) {
      body.style.display = 'none';
      chevron.textContent = '▶';
      return;
    }

    body.style.display = 'block';
    chevron.textContent = '▼';

    // Lazy load on first expand
    if (section.dataset.loaded === 'false') {
      await loadNotesAttachments(section, body, tripId, activityId, currentUserId, callbacks);
    }
  });
}

/**
 * Load notes and attachments data
 */
async function loadNotesAttachments(section, body, tripId, activityId, currentUserId, callbacks) {
  try {
    const [notes, documents] = await Promise.all([
      getActivityNotes(tripId, activityId),
      getActivityDocuments(tripId, activityId),
    ]);

    section.dataset.loaded = 'true';

    // Cache data on section element
    section._notesData = notes;
    section._documentsData = documents;

    body.innerHTML = renderNotesAttachmentsContent(notes, documents, currentUserId);

    // Update badge
    updateBadge(section, notes.length, documents.length);

    // Bind body event listeners
    bindBodyListeners(section, body, tripId, activityId, currentUserId, callbacks);
  } catch (error) {
    logError('Failed to load notes/attachments:', error);
    body.innerHTML = `<div class="activity-notes-attachments-error">${t('common.error')}</div>`;
  }
}

/**
 * Bind event listeners on the body content (notes form, actions, etc.)
 */
function bindBodyListeners(section, body, tripId, activityId, currentUserId, callbacks) {
  // Add note form
  const textarea = body.querySelector('.activity-note-input');
  const submitBtn = body.querySelector('.activity-note-submit');

  textarea?.addEventListener('input', () => {
    submitBtn.disabled = !textarea.value.trim();
  });

  submitBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const content = textarea.value.trim();
    if (!content) return;

    submitBtn.disabled = true;
    try {
      const note = await createActivityNote(tripId, activityId, content);
      textarea.value = '';

      // Refresh notes list
      const notes = await getActivityNotes(tripId, activityId);
      section._notesData = notes;
      const notesList = body.querySelector('.activity-notes-list');
      if (notesList) {
        notesList.innerHTML = renderNotesList(notes, currentUserId);
        bindNoteActions(section, body, tripId, activityId, currentUserId);
      }
      updateBadge(section, notes.length, section._documentsData?.length || 0);
      showToast(t('activity.saved'), 'success');
    } catch (error) {
      logError('Failed to create note:', error);
      showToast(error.message || t('activity.saveFailed'), 'error');
      submitBtn.disabled = false;
    }
  });

  // Bind note action buttons
  bindNoteActions(section, body, tripId, activityId, currentUserId);

  // Bind attachment action buttons
  bindAttachmentActions(body, tripId, currentUserId, section);

  // Attach file button
  const attachBtn = body.querySelector('.activity-attach-file-btn');
  attachBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (callbacks.onUploadFile) {
      callbacks.onUploadFile(activityId);
    }
  });
}

/**
 * Bind note edit/delete actions
 */
function bindNoteActions(section, body, tripId, activityId, currentUserId) {
  // Edit note
  body.querySelectorAll('[data-action="edit-note"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const noteId = btn.dataset.noteId;
      const noteItem = btn.closest('.activity-note-item');
      const contentEl = noteItem.querySelector('.activity-note-content');
      const currentContent = contentEl.textContent;

      // Replace content with textarea
      const editArea = document.createElement('textarea');
      editArea.className = 'activity-note-edit-input';
      editArea.value = currentContent;
      editArea.maxLength = 2000;
      editArea.rows = 3;

      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-sm btn-primary';
      saveBtn.textContent = t('common.save');

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-sm btn-secondary';
      cancelBtn.textContent = t('common.cancel');

      const btnRow = document.createElement('div');
      btnRow.className = 'activity-note-edit-actions';
      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(saveBtn);

      contentEl.style.display = 'none';
      contentEl.after(btnRow);
      contentEl.after(editArea);
      editArea.focus();

      cancelBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        editArea.remove();
        btnRow.remove();
        contentEl.style.display = '';
      });

      saveBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const newContent = editArea.value.trim();
        if (!newContent) return;

        saveBtn.disabled = true;
        try {
          await updateActivityNote(tripId, activityId, noteId, newContent);
          contentEl.textContent = newContent;
          editArea.remove();
          btnRow.remove();
          contentEl.style.display = '';
          showToast(t('activity.saved'), 'success');
        } catch (error) {
          logError('Failed to update note:', error);
          showToast(error.message || t('activity.saveFailed'), 'error');
          saveBtn.disabled = false;
        }
      });
    });
  });

  // Delete note
  body.querySelectorAll('[data-action="delete-note"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const noteId = btn.dataset.noteId;

      if (await confirmDialog({ message: t('activity.deleteNote', 'Delete note') + '?', variant: 'danger' })) {
        try {
          await deleteActivityNote(tripId, activityId, noteId);

          const notes = await getActivityNotes(tripId, activityId);
          section._notesData = notes;
          const notesList = body.querySelector('.activity-notes-list');
          if (notesList) {
            notesList.innerHTML = renderNotesList(notes, currentUserId);
            bindNoteActions(section, body, tripId, activityId, currentUserId);
          }
          updateBadge(section, notes.length, section._documentsData?.length || 0);
          showToast(t('activity.deleted'), 'success');
        } catch (error) {
          logError('Failed to delete note:', error);
          showToast(error.message || t('activity.deleteFailed'), 'error');
        }
      }
    });
  });
}

/**
 * Bind attachment download/delete actions
 */
function bindAttachmentActions(body, tripId, currentUserId, section) {
  body.querySelectorAll('[data-action="download-attachment"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const documentId = btn.dataset.documentId;
      const fileName = btn.dataset.fileName;
      try {
        await downloadDocument(tripId, documentId, fileName);
      } catch (error) {
        logError('Failed to download:', error);
        showToast(t('documents.downloadFailed'), 'error');
      }
    });
  });

  body.querySelectorAll('[data-action="delete-attachment"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const documentId = btn.dataset.documentId;

      if (await confirmDialog({ message: t('documents.confirmDelete'), variant: 'danger' })) {
        try {
          await deleteDocument(tripId, documentId);

          const documents = await getActivityDocuments(tripId, btn.closest('.activity-notes-attachments')?.dataset?.activityId || '');
          section._documentsData = documents;

          const attachmentsList = body.querySelector('.activity-attachments-list');
          if (attachmentsList) {
            attachmentsList.innerHTML = renderAttachmentsList(documents, currentUserId);
            bindAttachmentActions(body, tripId, currentUserId, section);
          }
          updateBadge(section, section._notesData?.length || 0, documents.length);
          showToast(t('documents.deleted'), 'success');
        } catch (error) {
          logError('Failed to delete attachment:', error);
          showToast(t('documents.deleteFailed'), 'error');
        }
      }
    });
  });
}

/**
 * Update the badge count
 */
function updateBadge(section, noteCount, docCount) {
  const badge = section.querySelector('.activity-notes-attachments-badge');
  if (badge) {
    const total = noteCount + docCount;
    badge.textContent = total > 0 ? `(${total})` : '';
  }
}

/**
 * Refresh the notes section for an activity card (used by WebSocket handlers)
 * @param {HTMLElement} card - Activity card element
 * @param {string} tripId - Trip ID
 * @param {string} activityId - Activity ID
 * @param {string} currentUserId - Current user ID
 */
export async function refreshActivityNotes(card, tripId, activityId, currentUserId) {
  const section = card.querySelector('.activity-notes-attachments');
  if (!section || section.dataset.loaded !== 'true') return;

  try {
    const notes = await getActivityNotes(tripId, activityId);
    section._notesData = notes;

    const body = section.querySelector('.activity-notes-attachments-body');
    const notesList = body?.querySelector('.activity-notes-list');
    if (notesList) {
      notesList.innerHTML = renderNotesList(notes, currentUserId);
      bindNoteActions(section, body, tripId, activityId, currentUserId);
    }
    updateBadge(section, notes.length, section._documentsData?.length || 0);
  } catch (error) {
    logError('Failed to refresh activity notes:', error);
  }
}

/**
 * Truncate a filename keeping the extension
 */
function truncateFileName(name, maxLen) {
  if (!name || name.length <= maxLen) return name;
  const ext = name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.')) : '';
  const base = name.slice(0, name.lastIndexOf('.') > 0 ? name.lastIndexOf('.') : name.length);
  const truncLen = maxLen - ext.length - 3;
  if (truncLen <= 0) return name.slice(0, maxLen);
  return base.slice(0, truncLen) + '...' + ext;
}

/**
 * Escape attribute value
 */
function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
