/**
 * Bookish — /api/recommend  (Netlify Edge Function)
 * Runs on Cloudflare-edge infrastructure so it can reach api.anthropic.com.
 * Accepts { prompt, books } → returns JSON array of literary recommendations.
 */

export default async (request) => {
  try {
    return await handleRequest(request);
  } catch (err) {
    console.error('[recommend] uncaught:', err.message, err.stack);
    return new Response(
      JSON.stringify({ error: 'Internal error', details: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

async function handleRequest(request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let prompt = '';
  let books = [];
  try {
    ({ prompt = '', books = [] } = await request.json());
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Build a rich context picture from the library ────────────────────────────

  const readBooks    = books.filter(b => b.status === 'read');
  const readingBooks = books.filter(b => b.status === 'reading');

  const fictionCount    = readBooks.filter(b => b.fiction_type === 'Fiction').length;
  const nonfictionCount = readBooks.filter(b => b.fiction_type === 'Nonfiction').length;

  const diffCounts = { Light: 0, Moderate: 0, Dense: 0 };
  readBooks.forEach(b => { if (b.difficulty && diffCounts[b.difficulty] !== undefined) diffCounts[b.difficulty]++; });

  const genreCounts = {};
  readBooks.forEach(b => { if (b.genre) genreCounts[b.genre] = (genreCounts[b.genre] || 0) + 1; });
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([g, n]) => `${g} (${n})`)
    .join(', ');

  function formatBook(b) {
    const tags = [b.genre, b.fiction_type, b.difficulty].filter(Boolean).join(' · ');
    const notes = b.notes ? ` — reader note: "${b.notes}"` : '';
    return `- ${b.title} by ${b.author}${tags ? ` [${tags}]` : ''}${notes}`;
  }

  const readBooksBlock    = readBooks.map(formatBook).join('\n') || '(none yet)';
  const readingBooksBlock = readingBooks.map(formatBook).join('\n') || '(none)';
  const allTitlesBlock    = books.map(b => `- ${b.title}`).join('\n');

  // ── System prompt ────────────────────────────────────────────────────────────

  const systemPrompt = `You are a literary advisor with unusually broad and deep reading across fiction and \
nonfiction — the kind of person who follows prize lists, reads reviews in the LRB and NYRB, and thinks \
seriously about what makes writing genuinely good.

Your task is to study a reader's library and generate precise, substantive book recommendations. \
The goal is not to find more books in the same genre — it is to find books that match the specific \
literary character of what this person already values.

─── HOW TO ANALYSE THE LIBRARY ───────────────────────────────────────────────

Before recommending anything, form a detailed picture of this reader's literary sensibility:

  PROSE & STYLE
  What kind of writing have they gravitated toward? Dense, architecturally complex sentences or \
clean declarative prose? Maximalist or restrained? Formally experimental or conventionally structured?

  INTELLECTUAL REGISTER
  Are they drawn to books that advance arguments and change how you think (even in fiction), or to \
books that immerse and entertain? What level of prior knowledge do the books assume?

  EMOTIONAL TONE
  Melancholic, ironic, propulsive, comic, elegiac, cold, warm? What emotional world do the books \
they've read inhabit?

  THEMATIC PREOCCUPATIONS
  What ideas, periods, problems, or human situations keep appearing? Power, consciousness, history, \
place, identity, science, mortality, institutions?

  QUALITY SIGNALS
  Have they read books that won or were shortlisted for major prizes (Booker, Pulitzer, National Book \
Award, Nobel, PEN/Faulkner, Baillie Gifford, NBCC, Costa)? Do they tend toward canonical works, \
contemporary literary fiction, narrative nonfiction, or a mix?

─── RECOMMENDATION CRITERIA ────────────────────────────────────────────────

Recommend only books with genuine literary distinction. This means:
  - Critically recognised, prize-winning, or considered essential by serious readers
  - NOT chosen because they share a genre label or an author with something already read
  - Chosen because they share something specific: a mode of attention, a prose register, a \
quality of thinking, a way of inhabiting a subject

─── THE "WHY" FIELD ────────────────────────────────────────────────────────

This is the most important field. Write 3–5 sentences of genuine literary reasoning. You must:
  - Name specific literary qualities of books this person has read (not just the title)
  - Explain what precise quality this recommendation shares with those books
  - Reference critical standing, prizes, or reputation where it strengthens the case
  - Avoid filler phrases like "if you enjoyed X you'll love Y" — explain WHY, with specifics

─── OUTPUT FORMAT ───────────────────────────────────────────────────────────

Return ONLY a valid JSON array — no markdown fences, no commentary outside the array.

Each element must have exactly these fields:
{
  "title": string,
  "author": string,
  "genre": string,
  "fiction_type": "Fiction" | "Nonfiction",
  "why": string — 3-5 sentences of genuine literary reasoning,
  "literary_match": string — one precise sentence naming the specific quality that creates the match,
  "suggested_formats": array of zero or more of: "audible", "physical", "kindle",
  "taste_summary": string — ONLY on element [0]; 2-3 sentences capturing the reader's literary character
}

Rules:
  - Never recommend a book already in the library (check every title carefully)
  - Produce exactly 5 recommendations
  - taste_summary appears only on element [0]; omit the field entirely from all others
  - If fewer than 5 books have been read, acknowledge that but still generate strong recommendations
  - Honour any specific request, but only recommend books that genuinely merit the reader's time`;

  // ── User message ─────────────────────────────────────────────────────────────

  const userMessage = `
READER'S LIBRARY
─────────────────
Total books: ${books.length}
Books read: ${readBooks.length}
Currently reading: ${readingBooks.length}

Fiction / Nonfiction split (read): ${fictionCount} fiction, ${nonfictionCount} nonfiction
Difficulty (read): Light ${diffCounts.Light} · Moderate ${diffCounts.Moderate} · Dense ${diffCounts.Dense}
Top genres (read): ${topGenres || 'n/a'}

BOOKS READ — study these carefully to understand taste:
${readBooksBlock}

CURRENTLY READING — context only:
${readingBooksBlock}

ALL LIBRARY TITLES — do not recommend any of these:
${allTitlesBlock}

${prompt
  ? `SPECIFIC REQUEST: "${prompt}"\nHonour this request, but only recommend books that genuinely match the reader's demonstrated literary sensibility.`
  : 'No specific request — give your most considered open-ended recommendations based on everything you observe about this reader.'
}

Return only the JSON array.`.trim();

  // ── Pre-warm connection (Netlify edge cold-start fix) ────────────────────────
  // First connection to api.anthropic.com/v1/messages from a cold edge instance
  // hangs indefinitely. Sending a minimal malformed POST (missing required fields)
  // returns 400 in <1s without running inference, but establishes the
  // TLS/HTTP2 session so the real request below can reuse it.
  // Pre-warm the HTTP/2 session (cold Netlify edge instances hang on first
  // connection to api.anthropic.com/v1/messages). A well-structured POST with
  // an intentionally invalid model name returns 400 in ~200ms without running
  // inference, establishing the session the real request below reuses.
  await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-3-5-20241022', max_tokens: 1, messages: [{ role: 'user', content: ' ' }] }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});

  // ── Call Anthropic API ────────────────────────────────────────────────────────

  let apiResponse;
  try {
    apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      signal: AbortSignal.timeout(38000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5',
        max_tokens: 1500,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userMessage }],
      }),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to reach Claude API', details: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!apiResponse.ok) {
    const errText = await apiResponse.text();
    return new Response(
      JSON.stringify({ error: 'Claude API error', details: errText }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const claudeData = await apiResponse.json();
  const raw = (claudeData.content?.[0]?.text || '').trim();
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let recommendations;
  try {
    recommendations = JSON.parse(cleaned);
    if (!Array.isArray(recommendations)) throw new Error('Expected an array');
  } catch {
    return new Response(
      JSON.stringify({ error: 'Could not parse recommendations', raw }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify(recommendations), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export const config = { path: '/api/recommend' };
