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
import { findDuplicate, handleDuplicate } from './duplicates.js';
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
  }
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
  renderBooksTable(books);
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
 * Handle table row click (open detail)
 */
function handleTableRowClick(e) {
  const row = e.target.closest('tr');
  if (!row) return;
  
  const bookId = row.dataset.bookId;
  if (!bookId) return;
  
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
 * Handle barcode scanning with multi-ISBN support and duplicate detection
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
          // Success! Found the book - now check for duplicates
          const existingBook = findDuplicate(bookData.title, bookData.author);
          
          if (existingBook) {
            // Duplicate found - let user decide what to do
            const shouldContinue = await handleDuplicate(bookData, existingBook);
            if (shouldContinue) {
              // User cancelled or we handled it (added format)
              return;
            }
            // User wants to add as separate copy - form is already filled
            return;
          }
          
          // No duplicate - auto-fill form normally
          const classification = autoClassifyGenre(bookData.categories);
          autofillBookForm(bookData, classification);
          showToast(`✅ Book found: ${bookData.title}`);
          return; // Stop trying other ISBNs
        }
      }
      
      // None of the ISBNs worked
      showToast(`❌ Tried ${isbns.length} barcode(s) but couldn't find book. Add manually.`);
      document.getElementById('bookISBN').value = isbns[0]; // Save first ISBN
    },
    (error) => {
      stopBarcodeScanner();
      modal.classList.remove('active');
      showToast(error);
    }
  );
/**
 * Handle ISBN lookup with duplicate detection
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
      // Check for duplicates before auto-filling
      const existingBook = findDuplicate(bookData.title, bookData.author);
      
      if (existingBook) {
        // Duplicate found - let user decide
        const shouldContinue = await handleDuplicate(bookData, existingBook);
        if (shouldContinue) {
          // User cancelled or we handled it
          clearISBNInput();
          setISBNLookupLoading(false);
          return;
        }
        // User wants to add as separate copy - form is already filled
        clearISBNInput();
        setISBNLookupLoading(false);
        showToast(`✅ Book found via ${bookData.source}! Adding as separate copy.`);
        return;
      }
      
      // No duplicate - auto-fill form normally
      const classification = autoClassifyGenre(bookData.categories);
      autofillBookForm(bookData, classification);
      clearISBNInput();
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
      
      showToast(`✅ Imported ${importResult.imported} books! ` +
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
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
