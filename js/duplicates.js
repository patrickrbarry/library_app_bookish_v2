/**
 * BOOKISH LIBRARY - DUPLICATE DETECTION
 * Handles duplicate book detection and user choices
 */

import { dataStore } from './data.js';
import { showToast } from './utils.js';
import { autoClassifyGenre } from './api.js';
import { autofillBookForm } from './ui.js';

/**
 * Check if book already exists in library
 */
export function findDuplicate(title, author) {
  const allBooks = dataStore.getAllBooks();
  return allBooks.find(book => 
    book.title.toLowerCase().trim() === title.toLowerCase().trim() &&
    book.author.toLowerCase().trim() === author.toLowerCase().trim()
  );
}

/**
 * Handle duplicate book found during barcode scan
 * Returns true if handled, false if should proceed with normal add
 */
export async function handleDuplicate(scannedBookData, existingBook) {
  const hasPhysical = existingBook.formats.includes('physical');
  
  // Format the current formats nicely
  const formatIcons = {
    physical: '📕 Physical',
    kindle: '📱 Kindle', 
    audible: '🎧 Audible'
  };
  const currentFormats = existingBook.formats
    .map(f => formatIcons[f] || f)
    .join(', ');
  
  if (hasPhysical) {
    // Already has physical - this is a second copy
    const addCopy = confirm(
      `📚 YOU ALREADY HAVE THIS BOOK!\n\n` +
      `"${existingBook.title}"\n` +
      `by ${existingBook.author}\n\n` +
      `Current formats: ${currentFormats}\n\n` +
      `This barcode is for a SECOND physical copy.\n\n` +
      `Add it as "Physical Copy 2"?\n\n` +
      `(OK = Add Copy 2 | Cancel = Don't Add)`
    );
    
    if (addCopy) {
      // Auto-fill form for second copy
      const classification = autoClassifyGenre(scannedBookData.categories);
      autofillBookForm(scannedBookData, classification);
      document.getElementById('formatPhysical').checked = true;
      document.getElementById('bookNotes').value = 'Physical Copy 2';
      showToast('📝 Adding as second copy - review and save');
      return false; // Let normal add flow continue
    } else {
      showToast('❌ Cancelled - book not added');
      return true; // Handled, don't add
    }
    
  } else {
    // Has different format - offer to add Physical
    const addFormat = confirm(
      `📚 YOU ALREADY HAVE THIS BOOK!\n\n` +
      `"${existingBook.title}"\n` +
      `by ${existingBook.author}\n\n` +
      `Current formats: ${currentFormats}\n\n` +
      `Add 📕 Physical format to this existing book?\n\n` +
      `(OK = Add Format | Cancel = Add as Separate Copy)`
    );
    
    if (addFormat) {
      // Add physical format to existing book
      await addFormatToBook(existingBook);
      return true; // Handled, don't add new
    } else {
      // User wants separate copy
      const classification = autoClassifyGenre(scannedBookData.categories);
      autofillBookForm(scannedBookData, classification);
      document.getElementById('formatPhysical').checked = true;
      document.getElementById('bookNotes').value = 'Physical Copy 2';
      showToast('📝 Adding as separate copy - review and save');
      return false; // Let normal add flow continue
    }
  }
}

/**
 * Add physical format to existing book
 */
async function addFormatToBook(book) {
  try {
    // Add physical to formats array
    const updatedFormats = [...new Set([...book.formats, 'physical'])];
    
    await dataStore.updateBook(book.id, {
      title: book.title,
      author: book.author,
      status: book.status,
      genre: book.genre,
      fictionType: book.fiction_type,
      difficulty: book.difficulty,
      formats: updatedFormats,
      notes: book.notes,
      isbn: book.isbn,
      publicationDate: book.publication_date,
      acquiredDate: book.acquired_date,
      coverUrl: book.cover_url
    });
    
    showToast('✅ Added 📕 Physical format to existing book!');
    
    // Reload to show updated book
    window.location.reload();
    
  } catch (error) {
    console.error('Error adding format:', error);
    showToast('❌ Failed to add format');
  }
}
