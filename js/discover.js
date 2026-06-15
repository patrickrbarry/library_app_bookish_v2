/**
 * Bookish — Discover feature
 * Bottom-sheet UI that fetches personalised book recommendations from
 * the /api/recommend Netlify function and lets the user add them to
 * their library in one tap.
 */

import { dataStore } from './data.js';
import { showToast } from './utils.js';

// ── Cache ─────────────────────────────────────────────────────────────────────
const CACHE_KEY   = 'bookish_discover_cache';
const CACHE_TTL   = 60 * 60 * 1000; // 1 hour

function readCache(prompt) {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, key, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    if (key !== prompt) return null;
    return data;
  } catch { return null; }
}

function writeCache(prompt, data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), key: prompt, data }));
  } catch {}
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── State ─────────────────────────────────────────────────────────────────────
let activeChip = '';

// ── Open / close ──────────────────────────────────────────────────────────────
export function openDiscover() {
  $('discoverBackdrop').classList.add('open');
  $('discoverSheet').classList.add('open');
  $('discoverPrompt').focus();
}

export function closeDiscover() {
  $('discoverBackdrop').classList.remove('open');
  $('discoverSheet').classList.remove('open');
}

// ── Chip selection ────────────────────────────────────────────────────────────
function selectChip(el, value) {
  document.querySelectorAll('.discover-chip').forEach(c => c.classList.remove('active'));
  if (activeChip === value) {
    // toggle off
    activeChip = '';
    $('discoverPrompt').value = '';
  } else {
    el.classList.add('active');
    activeChip = value;
    $('discoverPrompt').value = value;
    $('discoverPrompt').focus();
  }
}

// ── Build a recommendation card ───────────────────────────────────────────────
function buildCard(rec, tasteSummary) {
  const amazonUrl  = `https://www.amazon.com/s?k=${encodeURIComponent(rec.title + ' ' + rec.author)}`;
  const audibleUrl = `https://www.audible.com/search?keywords=${encodeURIComponent(rec.title + ' ' + rec.author)}`;
  const hasAudible = (rec.suggested_formats || []).includes('audible');

  const card = document.createElement('div');
  card.className = 'discover-card';
  card.innerHTML = `
    <div class="discover-card-cover">📖</div>
    <div class="discover-card-body">
      <div class="discover-card-title">${escHtml(rec.title)}</div>
      <div class="discover-card-author">${escHtml(rec.author)}</div>
      <div class="discover-card-tags">
        <span class="discover-tag">${escHtml(rec.genre || '')}</span>
        ${hasAudible ? '<span class="discover-tag discover-tag-format">🎧 Audible</span>' : ''}
      </div>
      ${rec.literary_match ? `<div class="discover-card-match">${escHtml(rec.literary_match)}</div>` : ''}
      <div class="discover-card-why">${escHtml(rec.why || '')}</div>
      <div class="discover-card-actions">
        <button class="discover-btn discover-btn-add">+ Add to library</button>
        <button class="discover-btn discover-btn-skip">Not for me</button>
      </div>
      <div class="discover-buy">
        <span class="discover-buy-label">Buy:</span>
        <a href="${amazonUrl}" target="_blank" rel="noopener noreferrer">🛒 Amazon</a>
        <span class="discover-buy-sep">·</span>
        <a href="${audibleUrl}" target="_blank" rel="noopener noreferrer">🎧 Audible</a>
      </div>
    </div>
  `;

  // Add to library
  card.querySelector('.discover-btn-add').addEventListener('click', async () => {
    await addRecommendation(rec, card);
  });

  // Dismiss
  card.querySelector('.discover-btn-skip').addEventListener('click', () => {
    card.style.transition = 'opacity 0.2s, transform 0.2s';
    card.style.opacity = '0';
    card.style.transform = 'translateX(12px)';
    setTimeout(() => card.remove(), 220);
  });

  // Prepend taste summary if present
  if (tasteSummary) {
    const summary = document.createElement('div');
    summary.className = 'discover-taste-summary';
    summary.textContent = tasteSummary;
    return [summary, card];
  }

  return [card];
}

// ── Add book to library ───────────────────────────────────────────────────────
async function addRecommendation(rec, card) {
  const btn = card.querySelector('.discover-btn-add');
  btn.disabled = true;
  btn.textContent = 'Adding…';

  try {
    await dataStore.addBook({
      title:           rec.title,
      author:          rec.author,
      status:          'unread',
      genre:           rec.genre || 'Uncategorized',
      fictionType:     rec.fiction_type || 'Fiction',
      difficulty:      'Moderate',
      formats:         rec.suggested_formats?.length ? rec.suggested_formats : ['physical'],
      notes:           '',
      isbn:            '',
      publicationDate: '',
      acquiredDate:    '',
      coverUrl:        '',
    });

    btn.textContent = '✓ Added';
    btn.style.background = '#2d7a2d';
    btn.style.borderColor = '#2d7a2d';
    showToast(`Added "${rec.title}" to your library`);

    // Refresh the main library view if available
    if (typeof window.renderBooks === 'function') window.renderBooks();

  } catch (err) {
    btn.disabled = false;
    btn.textContent = '+ Add to library';
    showToast(`Failed to add book: ${err.message}`);
  }
}

// ── Fetch recommendations ─────────────────────────────────────────────────────
async function fetchRecommendations(prompt) {
  const cached = readCache(prompt);
  if (cached) return cached;

  const books = dataStore.books.map(b => ({
    title:        b.title,
    author:       b.author,
    status:       b.status,
    genre:        b.genre,
    fiction_type: b.fictionType || b.fiction_type,
    difficulty:   b.difficulty,
    notes:        b.notes || '',
  }));

  // Single auto-retry — Netlify edge cold-starts occasionally fail on first hit
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch('/api/recommend', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prompt, books }),
    });

    if (res.ok) {
      const data = await res.json();
      writeCache(prompt, data);
      return data;
    }

    if (attempt === 1) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    await new Promise(r => setTimeout(r, 800));
  }
}

// ── Run discovery ─────────────────────────────────────────────────────────────
async function runDiscover() {
  const prompt   = ($('discoverPrompt').value || '').trim();
  const loading  = $('discoverLoading');
  const results  = $('discoverResults');
  const errorEl  = $('discoverError');

  // Reset
  results.innerHTML = '';
  results.style.display = 'none';
  errorEl.style.display = 'none';
  loading.style.display  = 'block';

  try {
    const recs = await fetchRecommendations(prompt);

    loading.style.display = 'none';

    if (!recs.length) {
      results.innerHTML = '<p class="discover-empty">No recommendations found. Try a different prompt.</p>';
      results.style.display = 'block';
      return;
    }

    const label = document.createElement('div');
    label.className = 'discover-results-label';
    label.textContent = `${recs.length} recommendations · based on ${
      dataStore.books.filter(b => b.status === 'read').length
    } books read`;
    results.appendChild(label);

    recs.forEach((rec, i) => {
      const tasteSummary = i === 0 ? rec.taste_summary : null;
      const nodes = buildCard(rec, tasteSummary);
      nodes.forEach(n => results.appendChild(n));
    });

    results.style.display = 'block';

  } catch (err) {
    loading.style.display = 'none';
    errorEl.textContent   = `Could not load recommendations: ${err.message}`;
    errorEl.style.display = 'block';
  }
}

// ── Tiny XSS guard ────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
export function initDiscover() {
  // Wire Discover button in header
  $('discoverBtn')?.addEventListener('click', openDiscover);

  // Backdrop + close button
  $('discoverBackdrop')?.addEventListener('click', closeDiscover);
  $('discoverClose')?.addEventListener('click', closeDiscover);

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('discoverSheet')?.classList.contains('open')) closeDiscover();
  });

  // Go button + Enter key in prompt
  $('discoverGo')?.addEventListener('click', runDiscover);
  $('discoverPrompt')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') runDiscover();
  });

  // Chips
  document.querySelectorAll('.discover-chip').forEach(chip => {
    chip.addEventListener('click', () => selectChip(chip, chip.dataset.value));
  });
}
