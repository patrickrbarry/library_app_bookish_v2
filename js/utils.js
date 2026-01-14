/**
 * BOOKISH LIBRARY - UTILITY FUNCTIONS
 * Helper functions used throughout the app
 */

/**
 * Generate a unique ID for books
 * Format: book-{timestamp}-{random}
 */
export function generateId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `book-${timestamp}-${random}`;
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current ISO timestamp
 */
export function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Validate ISBN format (10 or 13 digits)
 */
export function isValidISBN(isbn) {
  if (!isbn) return true; // ISBN is optional
  const cleaned = isbn.replace(/[-\s]/g, '');
  return /^\d{10}$/.test(cleaned) || /^\d{13}$/.test(cleaned);
}

/**
 * Clean ISBN (remove hyphens and spaces)
 */
export function cleanISBN(isbn) {
  if (!isbn) return '';
  return isbn.replace(/[-\s]/g, '');
}

/**
 * Validate book object
 */
export function validateBook(book) {
  const errors = [];
  
  if (!book.title?.trim()) {
    errors.push('Title is required');
  }
  
  if (!book.author?.trim()) {
    errors.push('Author is required');
  }
  
  if (!book.genre) {
    errors.push('Genre is required');
  }
  
  if (!book.fictionType) {
    errors.push('Fiction Type is required');
  }
  
  if (!book.difficulty) {
    errors.push('Difficulty is required');
  }
  
  if (!book.status) {
    errors.push('Status is required');
  }
  
  if (!book.formats || book.formats.length === 0) {
    errors.push('At least one format is required');
  }
  
  if (book.isbn && !isValidISBN(book.isbn)) {
    errors.push('Invalid ISBN format');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Build Amazon search URL
 */
export function buildAmazonUrl(book) {
  const query = encodeURIComponent(`${book.title} ${book.author}`);
  return `https://www.amazon.com/s?k=${query}`;
}

/**
 * Show toast notification
 */
export function showToast(message, duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, duration);
}

/**
 * Debounce function for search input
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Download JSON file
 */
export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { 
    type: 'application/json' 
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format export filename with timestamp
 */
export function getExportFilename() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  
  return `bookish-backup-${year}-${month}-${day}-${hour}h${minute}.json`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Parse imported JSON with error handling
 */
export function parseImportedJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data)) {
      throw new Error('Invalid format: expected an array of books');
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
