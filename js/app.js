/**
 * BOOKISH LIBRARY - MAIN APPLICATION
 * Coordinates all modules and handles user interactions
 */

import { dataStore } from './data.js';
import { lookupISBN, autoClassifyGenre, validateISBN } from './api.js';
import { startBarcodeScanner, stopBarcodeScanner } from './barcode.js';
import { 
  renderBooksTable, 
  updateCounts, 
  updateGenreFilter,
  updateSortIndicator,
  openDetailSheet,
  closeDetailSheet,
  openBookModal,
  closeBookModal,
  getBookFormData,
  autofillBookForm,
  clearISBNInput,
  setISBNLookupLoading
} from './ui.js';
import {
  showToast,
  debounce,
  buildAmazonUrl,
  copyToClipboard,
  downloadJSON,
  getExportFilename,
  parseImportedJSON
} from './utils.js';
import { initDiscover } from './discover.js';

/**
 * Application State
 */
const state = {
  currentBooks: [],
  filters: {
    search: '',
    fictionType: '',
    genre: '',
    status: '',
    formats: []
  },
  sort: {
    by: 'title',
    ascending: true
  },
  selectMode: false,
  selectedIds: new Set()
};

/**
 * Initialize Application
 */
async function init() {
  console.log('🚀 Bookish Library v2 Initializing...');

  // Load and render initial data
  await loadAndRender();

  // Setup event listeners
  setupEventListeners();

  // Discover feature
  initDiscover();

  // Check for ?isbn= URL parameter (e.g., from iOS Shortcut)
  const params = new URLSearchParams(window.location.search);
  const isbnParam = params.get('isbn');
  if (isbnParam) {
    console.log('📖 ISBN parameter detected:', isbnParam);
    // Clean the URL so reloads don't re-trigger
    window.history.replaceState({}, '', '/');
    // Open modal and auto-lookup
    openBookModal();
    document.getElementById('isbnInput').value = isbnParam.trim();
    await handleISBNLookup();
  }

  console.log('✅ Application ready!');
}

/**
 * Load data and render UI
 */
async function loadAndRender() {
  // Load books from Supabase
  await dataStore.loadFromStorage();
  
  // Apply filters and sort
  applyFiltersAndSort();
  
  // Update genre dropdown
  const genres = dataStore.getUniqueGenres();
  updateGenreFilter(genres);
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Header actions
  document.getElementById('addBookBtn')?.addEventListener('click', handleAddBook);
  document.getElementById('importBtn')?.addEventListener('click', handleImportClick);
  document.getElementById('exportBtn')?.addEventListener('click', handleExport);
  
  // Import file input
  document.getElementById('importFile')?.addEventListener('change', handleImportFile);
  
  // Search
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(handleSearchChange, 300));
  }
  
  // Filters
  document.getElementById('fictionFilter')?.addEventListener('change', handleFilterChange);
  document.getElementById('genreFilter')?.addEventListener('change', handleFilterChange);
  document.getElementById('statusFilter')?.addEventListener('change', handleFilterChange);
  document.getElementById('filterPhysical')?.addEventListener('change', handleFilterChange);
  document.getElementById('filterKindle')?.addEventListener('change', handleFilterChange);
  document.getElementById('filterAudible')?.addEventListener('change', handleFilterChange);
  
  // Table sorting
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', handleSort);
  });
  
  // Table row clicks (open detail)
  document.getElementById('booksTableBody')?.addEventListener('click', handleTableRowClick);
  
  // Detail sheet
  document.getElementById('detailClose')?.addEventListener('click', () => closeDetailSheet());
  document.querySelector('.detail-backdrop')?.addEventListener('click', () => closeDetailSheet());
  document.getElementById('amazonOpen')?.addEventListener('click', handleAmazonOpen);
  document.getElementById('amazonCopy')?.addEventListener('click', handleAmazonCopy);
  document.getElementById('editBookBtn')?.addEventListener('click', handleEditBook);
  document.getElementById('deleteBookBtn')?.addEventListener('click', handleDeleteBook);
  
  // Book modal
  document.getElementById('bookModalClose')?.addEventListener('click', () => closeBookModal());
  document.getElementById('bookModalBackdrop')?.addEventListener('click', () => closeBookModal());
  document.getElementById('cancelBtn')?.addEventListener('click', () => closeBookModal());
  document.getElementById('bookForm')?.addEventListener('submit', handleSaveBook);
  
  // ISBN lookup
  document.getElementById('isbnLookupBtn')?.addEventListener('click', handleISBNLookup);
  document.getElementById('isbnInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleISBNLookup();
    }
  });

  // Paste from clipboard & lookup
  document.getElementById('pasteAndLookupBtn')?.addEventListener('click', handlePasteAndLookup);
  
  // Barcode scanning
  document.getElementById('scanBarcodeBtn')?.addEventListener('click', handleBarcodeScanning);
  
  // Barcode modal
  document.getElementById('barcodeModalClose')?.addEventListener('click', () => {
    stopBarcodeScanner();
    document.getElementById('barcodeModal').classList.remove('active');
  });
  document.getElementById('barcodeModalBackdrop')?.addEventListener('click', () => {
    stopBarcodeScanner();
    document.getElementById('barcodeModal').classList.remove('active');
  });
  
  // OCR buttons (still placeholders)
  document.getElementById('scanTitleBtn')?.addEventListener('click', () => {
    showToast('Title page scanning coming soon!');
  });
  document.getElementById('scanSpineBtn')?.addEventListener('click', () => {
    showToast('Spine scanning coming soon!');
  });

  // Bulk edit
  document.getElementById('selectModeBtn')?.addEventListener('click', handleEnterSelectMode);
  document.getElementById('bulkCancel')?.addEventListener('click', handleExitSelectMode);
  document.getElementById('bulkSelectAll')?.addEventListener('click', handleSelectAll);
  document.getElementById('bulkRead')?.addEventListener('click', () => handleBulkStatusUpdate('read'));
  document.getElementById('bulkUnread')?.addEventListener('click', () => handleBulkStatusUpdate('unread'));
  document.getElementById('bulkReading')?.addEventListener('click', () => handleBulkStatusUpdate('reading'));
}

/**
 * Apply filters and sort, then render
 */
function applyFiltersAndSort() {
  // Get filtered books
  let books = dataStore.filterBooks(state.filters);
  
  // Sort books
  books = dataStore.sortBooks(books, state.sort.by, state.sort.ascending);
  
  // Update state
  state.currentBooks = books;
  
  // Render
  renderBooksTable(books, state.selectMode);
  updateCounts(books.length, dataStore.getAllBooks().length);
  updateSortIndicator(state.sort.by, state.sort.ascending);
}

/**
 * Handle add book button
 */
function handleAddBook() {
  openBookModal();
}

/**
 * Handle search input change
 */
function handleSearchChange(e) {
  state.filters.search = e.target.value;
  applyFiltersAndSort();
}

/**
 * Handle filter change
 */
function handleFilterChange() {
  // Update filter state
  state.filters.fictionType = document.getElementById('fictionFilter').value;
  state.filters.genre = document.getElementById('genreFilter').value;
  state.filters.status = document.getElementById('statusFilter').value;
  
  // Format filters (AND logic)
  state.filters.formats = [];
  if (document.getElementById('filterPhysical').checked) {
    state.filters.formats.push('physical');
  }
  if (document.getElementById('filterKindle').checked) {
    state.filters.formats.push('kindle');
  }
  if (document.getElementById('filterAudible').checked) {
    state.filters.formats.push('audible');
  }
  
  applyFiltersAndSort();
}

/**
 * Handle table column sort
 */
function handleSort(e) {
  const th = e.currentTarget;
  const sortBy = th.dataset.sort;
  
  if (!sortBy) return;
  
  // Toggle direction if same column, else default to ascending
  if (state.sort.by === sortBy) {
    state.sort.ascending = !state.sort.ascending;
  } else {
    state.sort.by = sortBy;
    state.sort.ascending = true;
  }
  
  applyFiltersAndSort();
}

/**
 * Handle table row click (open detail, or toggle selection in select mode)
 */
function handleTableRowClick(e) {
  const row = e.target.closest('tr');
  if (!row) return;

  const bookId = row.dataset.bookId;
  if (!bookId) return;

  if (state.selectMode) {
    // Toggle selection
    if (state.selectedIds.has(bookId)) {
      state.selectedIds.delete(bookId);
      row.classList.remove('selected');
    } else {
      state.selectedIds.add(bookId);
      row.classList.add('selected');
    }
    // Sync checkbox
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = state.selectedIds.has(bookId);
    updateBulkToolbar();
    return;
  }

  const book = dataStore.getBookById(bookId);
  if (book) {
    openDetailSheet(book);
  }
}

/**
 * Handle Amazon open
 */
function handleAmazonOpen() {
  const sheet = document.getElementById('detailSheet');
  const bookId = sheet?.dataset.bookId;
  if (!bookId) return;
  
  const book = dataStore.getBookById(bookId);
  if (book) {
    const url = buildAmazonUrl(book);
    window.open(url, '_blank');
  }
}

/**
 * Handle Amazon copy
 */
async function handleAmazonCopy() {
  const sheet = document.getElementById('detailSheet');
  const bookId = sheet?.dataset.bookId;
  if (!bookId) return;
  
  const book = dataStore.getBookById(bookId);
  if (book) {
    const url = buildAmazonUrl(book);
    const success = await copyToClipboard(url);
    if (success) {
      showToast('Amazon link copied to clipboard!');
    } else {
      showToast('Failed to copy link');
    }
  }
}

/**
 * Handle edit book
 */
function handleEditBook() {
  const sheet = document.getElementById('detailSheet');
  const bookId = sheet?.dataset.bookId;
  if (!bookId) return;
  
  const book = dataStore.getBookById(bookId);
  if (book) {
    closeDetailSheet();
    openBookModal(book);
  }
}

/**
 * Handle delete book
 */
async function handleDeleteBook() {
  const sheet = document.getElementById('detailSheet');
  const bookId = sheet?.dataset.bookId;
  if (!bookId) return;
  
  const book = dataStore.getBookById(bookId);
  if (!book) return;
  
  const confirmed = confirm(`Delete "${book.title}" by ${book.author}?`);
  if (!confirmed) return;
  
  try {
    await dataStore.deleteBook(bookId);
    showToast('Book deleted');
    closeDetailSheet();
    await loadAndRender();
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Failed to delete book');
  }
}

/**
 * Handle save book (add or edit)
 */
async function handleSaveBook(e) {
  e.preventDefault();
  
  const modal = document.getElementById('bookModal');
  const mode = modal?.dataset.mode;
  const bookId = modal?.dataset.bookId;
  
  const formData = getBookFormData();
  
  try {
    if (mode === 'edit' && bookId) {
      // Update existing book
      await dataStore.updateBook(bookId, formData);
      showToast('Book updated!');
    } else {
      // Add new book
      await dataStore.addBook(formData);
      showToast('Book added!');
    }
    
    closeBookModal();
    await loadAndRender();
  } catch (error) {
    console.error('Save error:', error);
    showToast(`Error: ${error.message}`);
  }
}

/**
 * Handle barcode scanning
 */
/**
 * Handle barcode scanning with multi-ISBN support
 */
function handleBarcodeScanning() {
  const modal = document.getElementById('barcodeModal');
  modal.classList.add('active');

  startBarcodeScanner(
    'barcodeScannerContainer',
    async (isbns) => {
      // Multiple barcodes detected - try each one
      stopBarcodeScanner();
      modal.classList.remove('active');

      showToast(`📷 Found ${isbns.length} barcode(s)! Trying each...`);

      // Try each ISBN until we find one that works
      for (let i = 0; i < isbns.length; i++) {
        const isbn = isbns[i];
        console.log(`Trying ISBN ${i + 1}/${isbns.length}: ${isbn}`);

        const bookData = await lookupISBN(isbn);

        if (bookData) {
          // Check for duplicate before opening the form
          const allBooks = dataStore.getAllBooks();
          const existing = allBooks.find(b =>
            b.title.toLowerCase() === bookData.title.toLowerCase() &&
            b.author.toLowerCase() === bookData.author.toLowerCase()
          );

          if (existing) {
            const existingFormats = existing.formats.join(', ');
            const alreadyPhysical = existing.formats.includes('physical');

            if (alreadyPhysical) {
              // Already have it as physical — just ask if they want a second copy
              const addAnother = confirm(
                `You already have "${bookData.title}" as a physical book.\n\nAdd it again as a second copy?`
              );
              if (!addAnother) return;
              // Fall through to open the form as a new entry
            } else {
              // Have it in another format — offer to add physical to existing record
              const addFormat = confirm(
                `You already have "${bookData.title}" (${existingFormats}).\n\nAdd Physical format to the existing record?`
              );
              if (addFormat) {
                const updatedFormats = [...existing.formats, 'physical'];
                try {
                  await dataStore.updateBook(existing.id, {
                    title: existing.title,
                    author: existing.author,
                    status: existing.status,
                    genre: existing.genre,
                    fictionType: existing.fiction_type,
                    difficulty: existing.difficulty,
                    formats: updatedFormats,
                    notes: existing.notes,
                    isbn: existing.isbn,
                    publicationDate: existing.publication_date,
                    acquiredDate: existing.acquired_date,
                    coverUrl: existing.cover_url
                  });
                  showToast(`✅ Added Physical format to "${existing.title}"`);
                  await loadAndRender();
                } catch (err) {
                  console.error('Failed to update formats:', err);
                  showToast('Failed to update book formats.');
                }
                return;
              }
              // User said no — fall through to open the form as a new entry
            }
          }

          // No duplicate (or user chose to add anyway) — open form
          const classification = autoClassifyGenre(bookData.categories);
          openBookModal();
          autofillBookForm(bookData, classification, true);
          showToast(`✅ Book found: ${bookData.title}`);
          return; // Stop trying other ISBNs
        }
      }

      // None of the ISBNs worked — open blank form with ISBN pre-filled and Physical checked
      showToast(`❌ Tried ${isbns.length} barcode(s) but couldn't find book. Add manually.`);
      openBookModal();
      document.getElementById('bookISBN').value = isbns[0];
      document.getElementById('formatPhysical').checked = true;
    },
    (error) => {
      stopBarcodeScanner();
      modal.classList.remove('active');
      showToast(error);
    }
  );
}
/**
 * Handle paste from clipboard and immediately run ISBN lookup
 */
async function handlePasteAndLookup() {
  try {
    const text = await navigator.clipboard.readText();
    const isbn = text.trim().replace(/[-\s]/g, '');

    if (!isbn) {
      showToast('Clipboard is empty');
      return;
    }

    // Put it in the input so user can see what was grabbed
    const input = document.getElementById('isbnInput');
    if (input) input.value = isbn;

    // Run the lookup
    await handleISBNLookup();

  } catch (err) {
    // Clipboard permission denied — fall back to asking user to paste manually
    console.log('Clipboard read failed:', err);
    showToast('Tap the ISBN field and paste manually (⌘V or long-press → Paste)');
    document.getElementById('isbnInput')?.focus();
  }
}

/**
 * Handle ISBN lookup
 */
async function handleISBNLookup() {
  const input = document.getElementById('isbnInput');
  const isbn = input?.value.trim();
  
  if (!isbn) {
    showToast('Please enter an ISBN');
    return;
  }
  
  // Validate ISBN
  const validation = validateISBN(isbn);
  if (!validation.valid) {
    showToast(validation.message);
    return;
  }
  
  // Show loading state
  setISBNLookupLoading(true);
  
  try {
    const bookData = await lookupISBN(validation.isbn);
    
    if (bookData) {
      // Auto-classify genre
      const classification = autoClassifyGenre(bookData.categories);
      
      // Auto-fill form
      autofillBookForm(bookData, classification);
      
      // Clear ISBN input
      clearISBNInput();
      
      // Show success message
      showToast(`✅ Book found via ${bookData.source}! Review and save.`);
    } else {
      // Book not found
      showToast('❌ Book not found. Try another ISBN or add manually.');
    }
  } catch (error) {
    console.error('ISBN lookup error:', error);
    showToast('❌ Lookup failed. Please try again or add manually.');
  } finally {
    setISBNLookupLoading(false);
  }
}

/**
 * Handle export
 */
function handleExport() {
  const books = dataStore.exportBooks();
  const filename = getExportFilename();
  
  downloadJSON(books, filename);
  showToast(`📤 Exported ${books.length} books!`);
}

/**
 * Handle import button click
 */
function handleImportClick() {
  const fileInput = document.getElementById('importFile');
  if (fileInput) {
    fileInput.click();
  }
}

/**
 * Handle import file selection
 */
async function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  
  reader.onload = async (event) => {
    try {
      const result = parseImportedJSON(event.target.result);
      
      if (!result.success) {
        showToast(`Import failed: ${result.error}`);
        return;
      }
      
      const importResult = await dataStore.importBooks(result.data);
      
      showToast(
        `✅ Imported ${importResult.imported} books! ` +
        `(${importResult.skipped} duplicates skipped)`
      );
      
      await loadAndRender();
    } catch (error) {
      console.error('Import error:', error);
      showToast(`Import failed: ${error.message}`);
    }
    
    // Reset file input
    e.target.value = '';
  };
  
  reader.readAsText(file);
}

/**
 * Enter select mode — show checkboxes, show bulk toolbar
 */
function handleEnterSelectMode() {
  state.selectMode = true;
  state.selectedIds.clear();
  document.getElementById('bulkToolbar').classList.remove('hidden');
  updateBulkToolbar();
  // Re-render table so checkboxes appear
  renderBooksTable(state.currentBooks, true);
}

/**
 * Exit select mode — hide checkboxes, hide bulk toolbar
 */
function handleExitSelectMode() {
  state.selectMode = false;
  state.selectedIds.clear();
  document.getElementById('bulkToolbar').classList.add('hidden');
  // Re-render without checkboxes
  renderBooksTable(state.currentBooks, false);
}

/**
 * Select all currently visible books
 */
function handleSelectAll() {
  const allSelected = state.selectedIds.size === state.currentBooks.length;
  if (allSelected) {
    // Deselect all
    state.selectedIds.clear();
  } else {
    // Select all visible
    state.currentBooks.forEach(b => state.selectedIds.add(b.id));
  }
  // Re-render to sync checkboxes and row highlights
  renderBooksTable(state.currentBooks, true);
  // Restore selected highlights
  state.selectedIds.forEach(id => {
    const row = document.querySelector(`tr[data-book-id="${id}"]`);
    if (row) {
      row.classList.add('selected');
      const cb = row.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = true;
    }
  });
  updateBulkToolbar();
}

/**
 * Update the bulk toolbar count and Select All label
 */
function updateBulkToolbar() {
  const count = state.selectedIds.size;
  document.getElementById('bulkCount').textContent =
    count === 0 ? 'None selected' : `${count} selected`;
  document.getElementById('bulkSelectAll').textContent =
    count === state.currentBooks.length ? 'Deselect All' : 'Select All';
}

/**
 * Bulk update status for all selected books
 */
async function handleBulkStatusUpdate(newStatus) {
  if (state.selectedIds.size === 0) {
    showToast('No books selected');
    return;
  }

  const count = state.selectedIds.size;
  const confirmed = confirm(`Mark ${count} book${count !== 1 ? 's' : ''} as "${newStatus}"?`);
  if (!confirmed) return;

  let successCount = 0;
  let errorCount = 0;

  for (const id of state.selectedIds) {
    const book = dataStore.getBookById(id);
    if (!book) continue;
    try {
      await dataStore.updateBook(id, {
        title: book.title,
        author: book.author,
        status: newStatus,
        genre: book.genre,
        fictionType: book.fiction_type,
        difficulty: book.difficulty,
        formats: book.formats,
        notes: book.notes,
        isbn: book.isbn,
        publicationDate: book.publication_date,
        acquiredDate: book.acquired_date,
        coverUrl: book.cover_url
      });
      successCount++;
    } catch (err) {
      console.error('Failed to update book:', id, err);
      errorCount++;
    }
  }

  if (errorCount > 0) {
    showToast(`Updated ${successCount}, failed ${errorCount}`);
  } else {
    showToast(`✅ Marked ${successCount} book${successCount !== 1 ? 's' : ''} as "${newStatus}"`);
  }

  handleExitSelectMode();
  await loadAndRender();
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
