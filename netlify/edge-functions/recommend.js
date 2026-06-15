/**
 * Bookish — /api/recommend  (Netlify Edge Function)
 * Fast, reliable book recommendations using claude-haiku-4-5 (~3s response).
 */

export default async (request) => {
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

  // ── Build library context ────────────────────────────────────────────────────

  const readBooks    = books.filter(b => b.status === 'read');
  const readingBooks = books.filter(b => b.status === 'reading');
  const allTitles    = books.map(b => b.title).join(', ');

  const readList = readBooks
    .map(b => {
      const tags = [b.genre, b.fiction_type, b.difficulty].filter(Boolean).join('/');
      const note = b.notes ? ` ("${b.notes}")` : '';
      return `${b.title} by ${b.author}${tags ? ` [${tags}]` : ''}${note}`;
    })
    .join('\n');

  const readingList = readingBooks
    .map(b => `${b.title} by ${b.author}`)
    .join(', ');

  // ── Prompts ──────────────────────────────────────────────────────────────────

  const systemPrompt = `You are a knowledgeable literary advisor recommending books based on a reader's library.

Analyse their reading history to understand their taste — consider literary quality, prose style, intellectual tone, genre preferences, and difficulty. Then recommend books that genuinely match what they value.

Rules:
- Only recommend books NOT already in their library
- Choose books with real literary merit (prize-winners, critically acclaimed, considered essential)
- The "why" field must be specific: name qualities from books they've READ that the recommendation shares
- Return ONLY a valid JSON array — no markdown, no commentary

Each item in the array must have exactly these fields:
{
  "title": string,
  "author": string,
  "genre": string,
  "fiction_type": "Fiction" | "Nonfiction",
  "why": string (2-3 sentences, specific to this reader's taste),
  "literary_match": string (one phrase: the specific quality that connects this to their reading),
  "suggested_formats": string[] (any of: "physical", "kindle", "audible"),
  "taste_summary": string (ONLY on the first item — 1-2 sentences about this reader's literary character; omit from all others)
}`;

  const userMsg = [
    readBooks.length
      ? `Books read:\n${readList}`
      : 'No books read yet — recommend foundational literary works.',
    readingList
      ? `Currently reading: ${readingList}`
      : null,
    `Do not recommend any of: ${allTitles || 'none'}`,
    prompt
      ? `Specific request: "${prompt}"`
      : 'Open recommendation — best match for this reader.',
    'Return 3–5 recommendations as a JSON array.',
  ].filter(Boolean).join('\n\n');

  // ── Pre-warm HTTP/2 session to api.anthropic.com ─────────────────────────────
  // Cold edge instances hang on first connection; a structured-but-invalid POST
  // returns 400 in ~200ms and opens the session the real request reuses.
  await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-3-5-20241022', max_tokens: 1, messages: [{ role: 'user', content: ' ' }] }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => {});

  // ── Call Claude ───────────────────────────────────────────────────────────────

  let apiResponse;
  try {
    apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5',
        max_tokens: 1000,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userMsg }],
      }),
      signal: AbortSignal.timeout(30000),
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
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};

export const config = { path: '/api/recommend' };
