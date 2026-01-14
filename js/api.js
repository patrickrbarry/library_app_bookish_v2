/**
 * BOOKISH LIBRARY - API MODULE
 * Handles ISBN lookup using the Vercel serverless API
 */

const ISBN_API_URL = 'https://bookish-isbn-api.vercel.app/api/lookup';

/**
 * Lookup book by ISBN using the Vercel API
 * This API tries Google Books (with key) then falls back to Open Library
 * 
 * @param {string} isbn - ISBN-10 or ISBN-13
 * @returns {Promise<Object|null>} Book data or null if not found
 */
export async function lookupISBN(isbn) {
  console.log('=== ISBN LOOKUP START ===');
  console.log('ISBN:', isbn);

  try {
    const url = `${ISBN_API_URL}?isbn=${encodeURIComponent(isbn)}`;
    console.log('Fetching:', url);

    const response = await fetch(url);
    const result = await response.json();

    console.log('API Response:', result);

    if (result.success && result.book) {
      const book = result.book;
      console.log('✅ Book found via', book.source);

      // Return normalized book data
      return {
        title: book.title || '',
        author: book.author || '',
        isbn: book.isbn || isbn,
        publicationDate: book.publicationDate || '',
        coverUrl: book.coverUrl || '',
        categories: book.categories || [],
        source: book.source
      };
    } else {
      console.log('❌ Book not found');
      return null;
    }
  } catch (error) {
    console.error('ISBN lookup error:', error);
    throw new Error('Failed to lookup ISBN. Please check your internet connection.');
  }
}

/**
 * Auto-classify genre from Google Books categories
 * Maps API categories to our predefined genres
 */
export function autoClassifyGenre(categories) {
  if (!categories || categories.length === 0) {
    return null;
  }

  // Convert categories to lowercase for matching
  const lowerCategories = categories.map(c => c.toLowerCase());
  const categoriesStr = lowerCategories.join(' ');

  // Fiction genres
  if (categoriesStr.includes('literary') || categoriesStr.includes('literature')) {
    return { genre: 'Literary Fiction', fictionType: 'Fiction' };
  }
  if (categoriesStr.includes('mystery') || categoriesStr.includes('thriller') || categoriesStr.includes('detective')) {
    return { genre: 'Mystery/Thriller', fictionType: 'Fiction' };
  }
  if (categoriesStr.includes('science fiction') || categoriesStr.includes('sci-fi')) {
    return { genre: 'Science Fiction', fictionType: 'Fiction' };
  }
  if (categoriesStr.includes('fantasy')) {
    return { genre: 'Fantasy', fictionType: 'Fiction' };
  }
  if (categoriesStr.includes('romance')) {
    return { genre: 'Romance', fictionType: 'Fiction' };
  }
  if (categoriesStr.includes('historical fiction')) {
    return { genre: 'Historical Fiction', fictionType: 'Fiction' };
  }
  if (categoriesStr.includes('horror')) {
    return { genre: 'Horror', fictionType: 'Fiction' };
  }

  // Nonfiction genres
  if (categoriesStr.includes('biography') || categoriesStr.includes('memoir')) {
    return { genre: 'Biography/Memoir', fictionType: 'Nonfiction' };
  }
  if (categoriesStr.includes('history')) {
    return { genre: 'History', fictionType: 'Nonfiction' };
  }
  if (categoriesStr.includes('science') && !categoriesStr.includes('fiction')) {
    return { genre: 'Science', fictionType: 'Nonfiction' };
  }
  if (categoriesStr.includes('philosophy')) {
    return { genre: 'Philosophy', fictionType: 'Nonfiction' };
  }
  if (categoriesStr.includes('business') || categoriesStr.includes('economics')) {
    return { genre: 'Business', fictionType: 'Nonfiction' };
  }
  if (categoriesStr.includes('self-help') || categoriesStr.includes('self help')) {
    return { genre: 'Self-Help', fictionType: 'Nonfiction' };
  }
  if (categoriesStr.includes('true crime')) {
    return { genre: 'True Crime', fictionType: 'Nonfiction' };
  }
  if (categoriesStr.includes('essay')) {
    return { genre: 'Essay Collection', fictionType: 'Nonfiction' };
  }
  if (categoriesStr.includes('politics') || categoriesStr.includes('political')) {
    return { genre: 'Politics/Current Events', fictionType: 'Nonfiction' };
  }

  // Special categories
  if (categoriesStr.includes('poetry')) {
    return { genre: 'Poetry', fictionType: 'Nonfiction' };
  }
  if (categoriesStr.includes('graphic novel') || categoriesStr.includes('comics')) {
    return { genre: 'Graphic Novel', fictionType: 'Fiction' };
  }
  if (categoriesStr.includes('young adult')) {
    return { genre: 'Young Adult', fictionType: 'Fiction' };
  }

  // Default: check for "fiction" keyword
  if (categoriesStr.includes('fiction')) {
    return { genre: 'Literary Fiction', fictionType: 'Fiction' };
  }

  // If no match, return null (user will select manually)
  return null;
}

/**
 * Validate ISBN format
 */
export function validateISBN(isbn) {
  if (!isbn) return { valid: false, message: 'ISBN is required' };

  const cleaned = isbn.replace(/[-\s]/g, '');
  
  if (!/^\d{10}$/.test(cleaned) && !/^\d{13}$/.test(cleaned)) {
    return { 
      valid: false, 
      message: 'ISBN must be 10 or 13 digits' 
    };
  }

  return { valid: true, isbn: cleaned };
}
