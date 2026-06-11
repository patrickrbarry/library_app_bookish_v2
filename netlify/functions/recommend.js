/**
 * Bookish — /api/recommend
 * Accepts { prompt, books } and returns a JSON array of book recommendations
 * powered by Claude. Keeps the Anthropic API key server-side.
 */

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured' }),
    };
  }

  // Parse request
  let prompt = '';
  let books = [];
  try {
    ({ prompt = '', books = [] } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  // Build context from the library
  const readBooks = books.filter(b => b.status === 'read');

  const genreCounts = {};
  readBooks.forEach(b => {
    if (b.genre) genreCounts[b.genre] = (genreCounts[b.genre] || 0) + 1;
  });
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([g]) => g)
    .join(', ');

  const allTitlesBlock = books
    .map(b => `- ${b.title} by ${b.author}`)
    .join('\n');

  const readBooksBlock = readBooks
    .map(b => `- ${b.title} by ${b.author} [${b.genre || 'Unknown'}]`)
    .join('\n');

  const systemPrompt = `You are a personal book recommendation engine with deep knowledge of literature. \
You have been given a reader's complete library. Return ONLY a valid JSON array — no markdown fences, \
no explanation, nothing outside the array.

Each element must have exactly these fields:
{
  "title": string,
  "author": string,
  "genre": string,
  "fiction_type": "Fiction" or "Nonfiction",
  "why": string — 2-3 sentences anchored to at least one specific title from the read list,
  "suggested_formats": array containing one or both of "audible" and "physical",
  "taste_summary": string — include ONLY on the first element; 1-2 sentences summarising the reader's taste
}

Rules:
- Never recommend a book already present in the library (check every title).
- The "why" field must name at least one book the reader has actually read.
- Produce 5-7 recommendations total.
- taste_summary appears only on element [0] and is omitted from all others.`;

  const userMessage = `The reader has read ${readBooks.length} books. Top genres: ${topGenres}.

ALL books in their library — do NOT recommend any of these:
${allTitlesBlock}

Books they have READ (use these to understand their taste):
${readBooksBlock}

${prompt ? `Their specific request: "${prompt}"` : 'Give your best open-ended recommendations based on their taste.'}

Return only the JSON array.`;

  // Call Claude
  let claudeResponse;
  try {
    claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Failed to reach Claude API', details: err.message }) };
  }

  if (!claudeResponse.ok) {
    const errText = await claudeResponse.text();
    return { statusCode: 502, body: JSON.stringify({ error: 'Claude API error', details: errText }) };
  }

  const claudeData = await claudeResponse.json();
  const raw = (claudeData.content?.[0]?.text || '').trim();

  // Strip any accidental markdown code fences
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let recommendations;
  try {
    recommendations = JSON.parse(cleaned);
    if (!Array.isArray(recommendations)) throw new Error('Expected an array');
  } catch {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Could not parse recommendations', raw }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(recommendations),
  };
};
