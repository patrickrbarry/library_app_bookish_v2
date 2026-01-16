/**
 * BOOKISH LIBRARY - DATA MANAGEMENT (SUPABASE VERSION)
 * Handles all data operations with Supabase cloud database
 */

import { supabase } from './supabase.js';
import { generateId, getCurrentTimestamp, validateBook } from './utils.js';

/**
 * Data store with Supabase
 */
class DataStore {
  constructor() {
    this.books = [];
  }

  /**
   * Load books from Supabase
   */
  async loadFromStorage() {
    try {
      const { data, error } = await supabase
        .from('bookslist')
        .select('*')
        .order('title');
      
      if (error) throw error;
      
      this.books = data || [];
      console.log(`Loaded ${this.books.length} books from Supabase`);
    } catch (error) {
      console.error('Error loading from Supabase:', error);
      this.books = [];
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
  async addBook(bookData) {
    const validation = validateBook(bookData);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    const book = {
      id: generateId(),
      title: bookData.title.trim(),
      author: bookData.author.trim(),
      status: bookData.status,
      genre: bookData.genre,
      fiction_type: bookData.fictionType,
      difficulty: bookData.difficulty,
      formats: bookData.formats,
      notes: bookData.notes?.trim() || '',
      isbn: bookData.isbn?.trim() || '',
      publication_date: bookData.publicationDate || '',
      acquired_date: bookData.acquiredDate || '',
      cover_url: bookData.coverUrl?.trim() || '',
      added_at: getCurrentTimestamp()
    };

    const { error } = await supabase
      .from('bookslist')
      .insert([book]);

    if (error) throw error;

    this.books.push(book);
    return book;
  }

  /**
   * Update an existing book
   */
  async updateBook(id, bookData) {
    const index = this.books.findIndex(book => book.id === id);
    if (index === -1) {
      throw new Error('Book not found');
    }

    const validation = validateBook(bookData);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    const existingBook = this.books[index];
    const updatedBook = {
      id: existingBook.id,
      added_at: existingBook.added_at,
      title: bookData.title.trim(),
      author: bookData.author.trim(),
      status: bookData.status,
      genre: bookData.genre,
      fiction_type: bookData.fictionType,
      difficulty: bookData.difficulty,
      formats: bookData.formats,
      notes: bookData.notes?.trim() || '',
      isbn: bookData.isbn?.trim() || '',
      publication_date: bookData.publicationDate || '',
      acquired_date: bookData.acquiredDate || '',
      cover_url: bookData.coverUrl?.trim() || ''
    };

    const { error } = await supabase
      .from('bookslist')
      .update(updatedBook)
      .eq('id', id);

    if (error) throw error;

    this.books[index] = updatedBook;
    return updatedBook;
  }

  /**
   * Delete a book
   */
  async deleteBook(id) {
    const index = this.books.findIndex(book => book.id === id);
    if (index === -1) {
      throw new Error('Book not found');
    }

    const { error } = await supabase
      .from('bookslist')
      .delete()
      .eq('id', id);

    if (error) throw error;

    const deleted = this.books.splice(index, 1)[0];
    return deleted;
  }

  /**
   * Import books from JSON
   */
  async importBooks(importedBooks) {
    if (!Array.isArray(importedBooks)) {
      throw new Error('Invalid import data: expected an array');
    }

    let imported = 0;
    let skipped = 0;

    for (const bookData of importedBooks) {
      try {
        const isDuplicate = this.books.some(
          existing => 
            existing.title.toLowerCase() === bookData.title?.toLowerCase() &&
            existing.author.toLowerCase() === bookData.author?.toLowerCase()
        );

        if (isDuplicate) {
          skipped++;
          continue;
        }

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

        await this.addBook(completeBookData);
        imported++;
      } catch (error) {
        console.error('Error importing book:', bookData, error);
        skipped++;
      }
    }

    return { imported, skipped, total: importedBooks.length };
  }

  /**
   * Export all books as JSON
   */
  exportBooks() {
    return [...this.books];
  }

  /**
   * Get unique genres
   */
  getUniqueGenres() {
    const genres = new Set();
    this.books.forEach(book => {
      if (book.genre) genres.add(book.genre);
    });
    return Array.from(genres).sort();
  }

  /**
   * Filter books
   */
  filterBooks(criteria) {
    let filtered = [...this.books];

    if (criteria.fictionType) {
      filtered = filtered.filter(book => book.fiction_type === criteria.fictionType);
    }

    if (criteria.genre) {
      filtered = filtered.filter(book => book.genre === criteria.genre);
    }

    if (criteria.status) {
      filtered = filtered.filter(book => book.status === criteria.status);
    }

    if (criteria.formats && criteria.formats.length > 0) {
      filtered = filtered.filter(book => {
        return criteria.formats.every(format => book.formats.includes(format));
      });
    }

    if (criteria.search) {
      const lowerQuery = criteria.search.toLowerCase().trim();
      filtered = filtered.filter(book => {
        return (
          book.title.toLowerCase().includes(lowerQuery) ||
          book.author.toLowerCase().includes(lowerQuery) ||
          book.genre.toLowerCase().includes(lowerQuery) ||
          book.notes.toLowerCase().includes(lowerQuery) ||
          book.fiction_type.toLowerCase().includes(lowerQuery)
        );
      });
    }

    return filtered;
  }

  /**
   * Sort books
   */
  sortBooks(books, sortBy, ascending = true) {
    const sorted = [...books];

    sorted.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (sortBy === 'formats') {
        aVal = a.formats.join(', ');
        bVal = b.formats.join(', ');
      }

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return ascending ? -1 : 1;
      if (aVal > bVal) return ascending ? 1 : -1;
      return 0;
    });

    return sorted;
  }
}

export const dataStore = new DataStore();
