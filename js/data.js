/**
 * BOOKISH LIBRARY - DATA MANAGEMENT
 * Handles all data operations and localStorage persistence
 */

import { generateId, getCurrentTimestamp, validateBook } from './utils.js';

const STORAGE_KEY = 'bookish_library_v2';

/**
 * Data store singleton
 */
class DataStore {
  constructor() {
    this.books = [];
    this.loadFromStorage();
  }

  /**
   * Load books from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.books = Array.isArray(data) ? data : [];
        console.log(`Loaded ${this.books.length} books from localStorage`);
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      this.books = [];
    }
  }

  /**
   * Save books to localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.books));
      console.log(`Saved ${this.books.length} books to localStorage`);
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      throw new Error('Failed to save books. Your browser storage may be full.');
    }
  }

  /**
   * Get all books
   */
  getAllBooks() {
    return [...this.books];
  }

  /**
   * Get book by ID
   */
  getBookById(id) {
    return this.books.find(book => book.id === id);
  }

  /**
   * Add a new book
   */
  addBook(bookData) {
    // Validate book data
    const validation = validateBook(bookData);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    // Create book object with required fields
    const book = {
      id: generateId(),
      title: bookData.title.trim(),
      author: bookData.author.trim(),
      status: bookData.status,
      genre: bookData.genre,
      fictionType: bookData.fictionType,
      difficulty: bookData.difficulty,
      formats: [...bookData.formats],
      notes: bookData.notes?.trim() || '',
      isbn: bookData.isbn?.trim() || '',
      publicationDate: bookData.publicationDate || '',
      acquiredDate: bookData.acquiredDate || '',
      coverUrl: bookData.coverUrl?.trim() || '',
      addedAt: getCurrentTimestamp()
    };

    this.books.push(book);
    this.saveToStorage();
    
    return book;
  }

  /**
   * Update an existing book
   */
  updateBook(id, bookData) {
    const index = this.books.findIndex(book => book.id === id);
    if (index === -1) {
      throw new Error('Book not found');
    }

    // Validate book data
    const validation = validateBook(bookData);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    // Update book (preserve id and addedAt)
    const existingBook = this.books[index];
    this.books[index] = {
      id: existingBook.id,
      addedAt: existingBook.addedAt,
      title: bookData.title.trim(),
      author: bookData.author.trim(),
      status: bookData.status,
      genre: bookData.genre,
      fictionType: bookData.fictionType,
      difficulty: bookData.difficulty,
      formats: [...bookData.formats],
      notes: bookData.notes?.trim() || '',
      isbn: bookData.isbn?.trim() || '',
      publicationDate: bookData.publicationDate || '',
      acquiredDate: bookData.acquiredDate || '',
      coverUrl: bookData.coverUrl?.trim() || ''
    };

    this.saveToStorage();
    return this.books[index];
  }

  /**
   * Delete a book
   */
  deleteBook(id) {
    const index = this.books.findIndex(book => book.id === id);
    if (index === -1) {
      throw new Error('Book not found');
    }

    const deleted = this.books.splice(index, 1)[0];
    this.saveToStorage();
    return deleted;
  }

  /**
   * Import books from JSON
   * Merges with existing books (no duplicates by title+author)
   */
  importBooks(importedBooks) {
    if (!Array.isArray(importedBooks)) {
      throw new Error('Invalid import data: expected an array');
    }

    let imported = 0;
    let skipped = 0;

    importedBooks.forEach(bookData => {
      try {
        // Check for duplicate (same title and author)
        const isDuplicate = this.books.some(
          existing => 
            existing.title.toLowerCase() === bookData.title?.toLowerCase() &&
            existing.author.toLowerCase() === bookData.author?.toLowerCase()
        );

        if (isDuplicate) {
          skipped++;
          return;
        }

        // Add missing required fields with defaults
        const completeBookData = {
          title: bookData.title || 'Untitled',
          author: bookData.author || 'Unknown Author',
          status: bookData.status || 'unread',
          genre: bookData.genre || 'Uncategorized',
          fictionType: bookData.fictionType || 'Nonfiction',
          difficulty: bookData.difficulty || 'Moderate',
          formats: bookData.formats || ['physical'],
          notes: bookData.notes || '',
          isbn: bookData.isbn || '',
          publicationDate: bookData.publicationDate || '',
          acquiredDate: bookData.acquiredDate || '',
          coverUrl: bookData.coverUrl || ''
        };

        this.addBook(completeBookData);
        imported++;
      } catch (error) {
        console.error('Error importing book:', bookData, error);
        skipped++;
      }
    });

    return { imported, skipped, total: importedBooks.length };
  }

  /**
   * Export all books as JSON
   */
  exportBooks() {
    return [...this.books];
  }

  /**
   * Get unique genres from current books
   */
  getUniqueGenres() {
    const genres = new Set();
    this.books.forEach(book => {
      if (book.genre) {
        genres.add(book.genre);
      }
    });
    return Array.from(genres).sort();
  }

  /**
   * Search books by query
   * Searches: title, author, genre, notes, fictionType
   */
  searchBooks(query) {
    if (!query || !query.trim()) {
      return this.getAllBooks();
    }

    const lowerQuery = query.toLowerCase().trim();
    
    return this.books.filter(book => {
      return (
        book.title.toLowerCase().includes(lowerQuery) ||
        book.author.toLowerCase().includes(lowerQuery) ||
        book.genre.toLowerCase().includes(lowerQuery) ||
        book.notes.toLowerCase().includes(lowerQuery) ||
        book.fictionType.toLowerCase().includes(lowerQuery)
      );
    });
  }

  /**
   * Filter books by criteria
   */
  filterBooks(criteria) {
    let filtered = [...this.books];

    // Fiction type filter
    if (criteria.fictionType) {
      filtered = filtered.filter(book => book.fictionType === criteria.fictionType);
    }

    // Genre filter
    if (criteria.genre) {
      filtered = filtered.filter(book => book.genre === criteria.genre);
    }

    // Status filter
    if (criteria.status) {
      filtered = filtered.filter(book => book.status === criteria.status);
    }

    // Format filter (AND logic - book must have ALL checked formats)
    if (criteria.formats && criteria.formats.length > 0) {
      filtered = filtered.filter(book => {
        return criteria.formats.every(format => book.formats.includes(format));
      });
    }

    // Search query
    if (criteria.search) {
      const lowerQuery = criteria.search.toLowerCase().trim();
      filtered = filtered.filter(book => {
        return (
          book.title.toLowerCase().includes(lowerQuery) ||
          book.author.toLowerCase().includes(lowerQuery) ||
          book.genre.toLowerCase().includes(lowerQuery) ||
          book.notes.toLowerCase().includes(lowerQuery) ||
          book.fictionType.toLowerCase().includes(lowerQuery)
        );
      });
    }

    return filtered;
  }

  /**
   * Sort books by field
   */
  sortBooks(books, sortBy, ascending = true) {
    const sorted = [...books];

    sorted.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      // Special handling for formats (array)
      if (sortBy === 'formats') {
        aVal = a.formats.join(', ');
        bVal = b.formats.join(', ');
      }

      // Convert to lowercase for string comparison
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return ascending ? -1 : 1;
      if (aVal > bVal) return ascending ? 1 : -1;
      return 0;
    });

    return sorted;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      total: this.books.length,
      byStatus: {
        unread: this.books.filter(b => b.status === 'unread').length,
        reading: this.books.filter(b => b.status === 'reading').length,
        read: this.books.filter(b => b.status === 'read').length
      },
      byFictionType: {
        fiction: this.books.filter(b => b.fictionType === 'Fiction').length,
        nonfiction: this.books.filter(b => b.fictionType === 'Nonfiction').length
      },
      byFormat: {
        physical: this.books.filter(b => b.formats.includes('physical')).length,
        kindle: this.books.filter(b => b.formats.includes('kindle')).length,
        audible: this.books.filter(b => b.formats.includes('audible')).length
      }
    };
  }
}

// Export singleton instance
export const dataStore = new DataStore();
