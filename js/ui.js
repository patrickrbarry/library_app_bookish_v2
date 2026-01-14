/**
 * BOOKISH LIBRARY - UI MODULE
 * Handles all UI rendering and updates
 */

/**
 * Render books table
 */
export function renderBooksTable(books) {
  const tbody = document.getElementById('booksTableBody');
  if (!tbody) return;

  if (books.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-light);">
          No books found. Try adjusting your filters or add your first book!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = books.map(book => `
    <tr data-book-id="${book.id}">
      <td>${escapeHtml(book.title)}</td>
      <td>${escapeHtml(book.author)}</td>
      <td>${escapeHtml(book.genre)}</td>
      <td>${escapeHtml(book.status)}</td>
      <td>${renderFormats(book.formats)}</td>
    </tr>
  `).join('');
}

/**
 * Render format badges
 */
function renderFormats(formats) {
  const icons = {
    physical: '📕',
    kindle: '📱',
    audible: '🎧'
  };

  return formats.map(format => {
    const icon = icons[format] || '📖';
    return `<span class="format-badge">${icon} ${format}</span>`;
  }).join(' ');
}

/**
 * Update counts
 */
export function updateCounts(shown, total) {
  const shownEl = document.getElementById('shownCount');
  const totalEl = document.getElementById('totalCount');
  const bookCount = document.getElementById('bookCount');

  if (shownEl) shownEl.textContent = shown;
  if (totalEl) totalEl.textContent = total;
  if (bookCount) bookCount.textContent = `${total} book${total !== 1 ? 's' : ''}`;
}

/**
 * Update genre filter dropdown with current genres
 */
export function updateGenreFilter(genres) {
  const select = document.getElementById('genreFilter');
  if (!select) return;

  // Preserve current selection
  const currentValue = select.value;

  // Rebuild options
  select.innerHTML = '<option value="">All Genres</option>' +
    genres.map(genre => 
      `<option value="${escapeHtml(genre)}">${escapeHtml(genre)}</option>`
    ).join('');

  // Restore selection if still valid
  if (currentValue && genres.includes(currentValue)) {
    select.value = currentValue;
  }
}

/**
 * Update sort indicator on table headers
 */
export function updateSortIndicator(sortBy, ascending) {
  // Clear all indicators
  document.querySelectorAll('.sort-indicator').forEach(el => {
    el.textContent = '';
  });

  // Set active indicator
  const header = document.querySelector(`th[data-sort="${sortBy}"]`);
  if (header) {
    const indicator = header.querySelector('.sort-indicator');
    if (indicator) {
      indicator.textContent = ascending ? '▲' : '▼';
    }
  }
}

/**
 * Open detail sheet with book data
 */
export function openDetailSheet(book) {
  const sheet = document.getElementById('detailSheet');
  if (!sheet) return;

  // Populate details
  document.getElementById('detailTitle').textContent = book.title;
  document.getElementById('detailAuthor').textContent = `by ${book.author}`;
  
  // Build metadata line
  const metaParts = [
    book.fictionType,
    book.genre,
    book.difficulty
  ];
  if (book.acquiredDate) {
    metaParts.push(`Acquired: ${formatDisplayDate(book.acquiredDate)}`);
  }
  document.getElementById('detailMeta').textContent = metaParts.join(' | ');

  // Render formats
  document.getElementById('detailFormats').innerHTML = renderFormats(book.formats);

  // Notes
  const notesEl = document.getElementById('detailNotes');
  if (book.notes) {
    notesEl.textContent = book.notes;
    notesEl.style.display = 'block';
  } else {
    notesEl.style.display = 'none';
  }

  // Tags
  const tagsEl = document.getElementById('detailTags');
  const tags = [
    book.status,
    ...book.formats
  ];
  tagsEl.innerHTML = tags.map(tag => 
    `<span class="tag">${escapeHtml(tag)}</span>`
  ).join('');

  // Store book ID for actions
  sheet.dataset.bookId = book.id;

  // Show sheet
  sheet.classList.add('active');
}

/**
 * Close detail sheet
 */
export function closeDetailSheet() {
  const sheet = document.getElementById('detailSheet');
  if (sheet) {
    sheet.classList.remove('active');
  }
}

/**
 * Open book modal (add or edit)
 */
export function openBookModal(book = null) {
  const modal = document.getElementById('bookModal');
  const title = document.getElementById('modalTitle');
  const form = document.getElementById('bookForm');
  
  if (!modal || !title || !form) return;

  // Set mode
  modal.dataset.mode = book ? 'edit' : 'add';
  modal.dataset.bookId = book ? book.id : '';
  title.textContent = book ? 'Edit Book' : 'Add Book';

  // Reset or populate form
  if (book) {
    populateBookForm(book);
  } else {
    form.reset();
  }

  // Show modal
  modal.classList.add('active');
}

/**
 * Close book modal
 */
export function closeBookModal() {
  const modal = document.getElementById('bookModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Populate book form with data (for editing)
 */
function populateBookForm(book) {
  document.getElementById('bookTitle').value = book.title || '';
  document.getElementById('bookAuthor').value = book.author || '';
  document.getElementById('bookGenre').value = book.genre || '';
  document.getElementById('bookFictionType').value = book.fictionType || '';
  document.getElementById('bookDifficulty').value = book.difficulty || '';
  document.getElementById('bookStatus').value = book.status || '';
  document.getElementById('bookISBN').value = book.isbn || '';
  document.getElementById('bookPublicationDate').value = book.publicationDate || '';
  document.getElementById('bookAcquiredDate').value = book.acquiredDate || '';
  document.getElementById('bookCoverUrl').value = book.coverUrl || '';
  document.getElementById('bookNotes').value = book.notes || '';

  // Formats checkboxes
  document.getElementById('formatPhysical').checked = book.formats?.includes('physical') || false;
  document.getElementById('formatKindle').checked = book.formats?.includes('kindle') || false;
  document.getElementById('formatAudible').checked = book.formats?.includes('audible') || false;
}

/**
 * Get book data from form
 */
export function getBookFormData() {
  const formats = [];
  if (document.getElementById('formatPhysical').checked) formats.push('physical');
  if (document.getElementById('formatKindle').checked) formats.push('kindle');
  if (document.getElementById('formatAudible').checked) formats.push('audible');

  return {
    title: document.getElementById('bookTitle').value,
    author: document.getElementById('bookAuthor').value,
    genre: document.getElementById('bookGenre').value,
    fictionType: document.getElementById('bookFictionType').value,
    difficulty: document.getElementById('bookDifficulty').value,
    status: document.getElementById('bookStatus').value,
    formats: formats,
    isbn: document.getElementById('bookISBN').value,
    publicationDate: document.getElementById('bookPublicationDate').value,
    acquiredDate: document.getElementById('bookAcquiredDate').value,
    coverUrl: document.getElementById('bookCoverUrl').value,
    notes: document.getElementById('bookNotes').value
  };
}

/**
 * Auto-fill form with ISBN lookup results
 */
export function autofillBookForm(bookData, autoClassification = null) {
  if (bookData.title) {
    document.getElementById('bookTitle').value = bookData.title;
  }
  if (bookData.author) {
    document.getElementById('bookAuthor').value = bookData.author;
  }
  if (bookData.isbn) {
    document.getElementById('bookISBN').value = bookData.isbn;
  }
  if (bookData.publicationDate) {
    document.getElementById('bookPublicationDate').value = bookData.publicationDate;
  }
  if (bookData.coverUrl) {
    document.getElementById('bookCoverUrl').value = bookData.coverUrl;
  }

  // Auto-classification from categories
  if (autoClassification) {
    if (autoClassification.genre) {
      document.getElementById('bookGenre').value = autoClassification.genre;
    }
    if (autoClassification.fictionType) {
      document.getElementById('bookFictionType').value = autoClassification.fictionType;
    }
  }
}

/**
 * Clear ISBN input field
 */
export function clearISBNInput() {
  const input = document.getElementById('isbnInput');
  if (input) input.value = '';
}

/**
 * Set ISBN lookup button state
 */
export function setISBNLookupLoading(loading) {
  const btn = document.getElementById('isbnLookupBtn');
  if (!btn) return;

  if (loading) {
    btn.disabled = true;
    btn.textContent = '⏳ Looking up...';
  } else {
    btn.disabled = false;
    btn.textContent = '🔍 Lookup';
  }
}

/**
 * Helper: Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Helper: Format date for display
 */
function formatDisplayDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
