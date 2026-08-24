// ═══════════════════════════════════════════════════════════
// ANIMATED COUNTERS — count-up on load
// ═══════════════════════════════════════════════════════════
(function() {
  const counters = document.querySelectorAll('.stat-card__number[data-count]');
  const duration = 1200;

  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        if (target === 0) { el.textContent = '0'; return; }
        const start = performance.now();

        function update(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const value = Math.round(easeOutExpo(progress) * target);
          el.textContent = value.toLocaleString();
          if (progress < 1) requestAnimationFrame(update);
        }

        requestAnimationFrame(update);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.3 });

  counters.forEach(c => observer.observe(c));
})();

// ═══════════════════════════════════════════════════════════
// SEARCH — live filter notes
// ═══════════════════════════════════════════════════════════
(function() {
  const searchInput = document.getElementById('searchInput');
  const searchBar = document.getElementById('searchBar');
  const searchClear = document.getElementById('searchClear');
  const noResults = document.getElementById('noResults');
  const visibleCount = document.getElementById('visibleCount');
  const filterInfo = document.getElementById('filterInfo');

  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    const cards = document.querySelectorAll('.note-card');
    let visible = 0;

    searchBar.classList.toggle('search-bar--active', query.length > 0);

    cards.forEach(card => {
      const title = (card.dataset.title || '').toLowerCase();
      const content = (card.dataset.content || '').toLowerCase();
      const match = !query || title.includes(query) || content.includes(query);
      card.classList.toggle('is-hidden', !match);
      if (match) visible++;
    });

    if (visibleCount) visibleCount.textContent = visible;
    if (noResults) noResults.classList.toggle('is-visible', visible === 0 && cards.length > 0);
    if (filterInfo) {
      filterInfo.textContent = query ? `Showing ${visible} of ${cards.length}` : '';
    }
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input'));
    searchInput.focus();
  });
})();

// ═══════════════════════════════════════════════════════════
// FORM — AJAX submission (no page reload)
// ═══════════════════════════════════════════════════════════
const noteForm = document.getElementById('noteForm');
const submitBtn = document.getElementById('submitBtn');

if (noteForm) {
  noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const titulo = document.getElementById('titulo').value.trim();
    if (!titulo) return;

    submitBtn.classList.add('is-loading');
    submitBtn.querySelector('span:last-child').textContent = 'Launching...';

    try {
      const formData = new URLSearchParams(new FormData(noteForm));
      const res = await fetch('/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      if (res.ok) {
        showToast('Note launched into the cosmos! ✨', 'success');
        setTimeout(() => location.reload(), 500);
      } else {
        showToast('Failed to launch note', 'error');
      }
    } catch (err) {
      showToast('Network error — check your connection', 'error');
    } finally {
      submitBtn.classList.remove('is-loading');
      submitBtn.querySelector('span:last-child').textContent = 'Launch Note';
    }
  });
}

// ═══════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
  // Don't trigger shortcuts when typing in inputs
  const tag = document.activeElement.tagName;
  const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  // Ctrl/Cmd + Enter — submit form
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    const titulo = document.getElementById('titulo');
    if (titulo.value.trim()) {
      noteForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }
    return;
  }

  // Escape — close modal or clear search
  if (e.key === 'Escape') {
    closeModal();
    const searchInput = document.getElementById('searchInput');
    if (document.activeElement === searchInput) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      searchInput.blur();
    }
    return;
  }

  if (isInput) return;

  // "/" — focus search
  if (e.key === '/') {
    e.preventDefault();
    document.getElementById('searchInput').focus();
    return;
  }

  // "N" — open form panel and focus new note title
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    const wrapper = document.getElementById('formPanelWrapper');
    const fab = document.getElementById('fabNewNote');
    if (!wrapper.classList.contains('is-open')) {
      wrapper.classList.add('is-open');
      fab.classList.add('is-open');
    }
    setTimeout(() => document.getElementById('titulo').focus(), 350);
    return;
  }
});

// ═══════════════════════════════════════════════════════════
// PIN — toggle pin status
// ═══════════════════════════════════════════════════════════
async function togglePin(id) {
  try {
    const res = await fetch(`/notas/${id}/pin`, { method: 'PATCH' });
    if (res.ok) {
      const data = await res.json();
      showToast(data.pinned ? 'Note pinned 📌' : 'Note unpinned', 'info');
      setTimeout(() => location.reload(), 400);
    } else {
      showToast('Failed to pin note', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}

// ═══════════════════════════════════════════════════════════
// EDIT — inline editing
// ═══════════════════════════════════════════════════════════
function startEdit(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (!card || card.classList.contains('is-editing')) return;

  card.classList.add('is-editing');

  const titleEl = document.getElementById(`title-${id}`);
  const bodyEl = document.getElementById(`body-${id}`);

  const originalTitle = card.dataset.title;
  const originalContent = card.dataset.content;

  // Replace title with input
  const titleInput = document.createElement('input');
  titleInput.className = 'note-card__title-input';
  titleInput.value = originalTitle;
  titleInput.setAttribute('data-original', originalTitle);
  titleEl.replaceWith(titleInput);
  titleInput.id = `title-${id}`;

  // Replace body with textarea
  const bodyTextarea = document.createElement('textarea');
  bodyTextarea.className = 'note-card__body-edit';
  bodyTextarea.value = originalContent;
  bodyTextarea.setAttribute('data-original', originalContent);
  bodyEl.replaceWith(bodyTextarea);
  bodyTextarea.id = `body-${id}`;

  // Add save/cancel buttons
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'note-card__edit-actions';
  actionsDiv.innerHTML = `
    <button class="btn-save-edit" onclick="saveEdit(${id})">💾 Save</button>
    <button class="btn-cancel-edit" onclick="cancelEdit(${id}, '${originalTitle.replace(/'/g, "\\\'")}', '${originalContent.replace(/'/g, "\\\'")}')">✖ Cancel</button>
  `;
  bodyTextarea.after(actionsDiv);

  titleInput.focus();

  // Ctrl+Enter to save within edit
  const editKeyHandler = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      saveEdit(id);
      document.removeEventListener('keydown', editKeyHandler);
    }
  };
  document.addEventListener('keydown', editKeyHandler);
}

async function saveEdit(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (!card) return;

  const titleInput = document.getElementById(`title-${id}`);
  const bodyTextarea = document.getElementById(`body-${id}`);

  const newTitle = titleInput.value.trim();
  const newContent = bodyTextarea.value;

  if (!newTitle) {
    showToast('Title cannot be empty', 'error');
    titleInput.focus();
    return;
  }

  try {
    const res = await fetch(`/notas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: newTitle, contenido: newContent }),
    });

    if (res.ok) {
      showToast('Note updated ✏️', 'success');
      setTimeout(() => location.reload(), 400);
    } else {
      showToast('Failed to update note', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}

function cancelEdit(id, originalTitle, originalContent) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (!card) return;

  card.classList.remove('is-editing');

  const titleInput = document.getElementById(`title-${id}`);
  const bodyTextarea = document.getElementById(`body-${id}`);

  // Restore title
  const titleDiv = document.createElement('div');
  titleDiv.className = 'note-card__title';
  titleDiv.id = `title-${id}`;
  titleDiv.textContent = originalTitle;
  titleInput.replaceWith(titleDiv);

  // Restore body
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'note-card__body';
  bodyDiv.id = `body-${id}`;
  bodyDiv.textContent = originalContent || '';
  if (!originalContent) {
    bodyDiv.innerHTML = '<span class="note-card__empty">No content</span>';
  }

  // Remove edit actions
  const editActions = card.querySelector('.note-card__edit-actions');
  if (editActions) editActions.remove();

  bodyTextarea.replaceWith(bodyDiv);
}

// ═══════════════════════════════════════════════════════════
// DELETE — Modal & AJAX delete
// ═══════════════════════════════════════════════════════════
let deleteId = null;
const deleteModal = document.getElementById('deleteModal');
const deleteModalText = document.getElementById('deleteModalText');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

function confirmDelete(id, title) {
  deleteId = id;
  deleteModalText.textContent = `"${title}" will be lost forever in the void.`;
  deleteModal.classList.add('modal-overlay--active');
}

function closeModal() {
  deleteModal.classList.remove('modal-overlay--active');
  deleteId = null;
}

// Close modal on overlay click
if (deleteModal) {
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeModal();
  });
}

if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener('click', async () => {
    if (!deleteId) return;
    confirmDeleteBtn.textContent = 'Destroying...';
    confirmDeleteBtn.disabled = true;

    try {
      const res = await fetch(`/notas/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        closeModal();
        // Animate card removal
        const card = document.querySelector(`[data-id="${deleteId}"]`);
        if (card) {
          card.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
          card.style.transform = 'translateX(80px) scale(0.9)';
          card.style.opacity = '0';
          card.style.maxHeight = card.offsetHeight + 'px';
          setTimeout(() => {
            card.style.maxHeight = '0';
            card.style.padding = '0';
            card.style.margin = '0';
            card.style.border = 'none';
          }, 200);
          setTimeout(() => location.reload(), 600);
        } else {
          location.reload();
        }
        showToast('Note destroyed 💥', 'success');
      } else {
        showToast('Failed to delete note', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    } finally {
      confirmDeleteBtn.textContent = 'Destroy';
      confirmDeleteBtn.disabled = false;
    }
  });
}

// ═══════════════════════════════════════════════════════════
// TOAST — enhanced notification system with progress bar
// ═══════════════════════════════════════════════════════════
let toastCount = 0;
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  const id = ++toastCount;
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'} ${message}
    <div class="toast__progress"></div>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });
  });

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 500);
  }, 3200);
}

// ═══════════════════════════════════════════════════════════
// HOVER ACCENT — show accent bar on hover
// ═══════════════════════════════════════════════════════════
document.querySelectorAll('.note-card__accent').forEach(accent => {
  const card = accent.closest('.note-card');
  card.addEventListener('mouseenter', () => accent.style.opacity = '1');
  card.addEventListener('mouseleave', () => accent.style.opacity = '0');
});

// ═══════════════════════════════════════════════════════════
// FAB — Toggle form panel
// ═══════════════════════════════════════════════════════════
(function() {
  const fab = document.getElementById('fabNewNote');
  const wrapper = document.getElementById('formPanelWrapper');
  if (!fab || !wrapper) return;

  fab.addEventListener('click', () => {
    const isOpen = wrapper.classList.toggle('is-open');
    fab.classList.toggle('is-open', isOpen);
    if (isOpen) {
      // Focus title after animation
      setTimeout(() => document.getElementById('titulo').focus(), 350);
    }
  });

  // Close panel on Escape when form is focused
  wrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      wrapper.classList.remove('is-open');
      fab.classList.remove('is-open');
      fab.focus();
    }
  });
})();
