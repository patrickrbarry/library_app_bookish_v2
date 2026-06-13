/**
 * Bookish — /api/recommend
 * Accepts { prompt, books } and returns a JSON array of deeply reasoned
 * book recommendations powered by Claude.
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

  let prompt = '';
  let books = [];
  try {
    ({ prompt = '', books = [] } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  // ── Build a rich context picture from the library ──────────────────────────

  const readBooks    = books.filter(b => b.status === 'read');
  const readingBooks = books.filter(b => b.status === 'reading');
  const allTitles    = new Set(books.map(b => b.title.toLowerCase()));

  // Fiction / nonfiction split
  const fictionCount    = readBooks.filter(b => b.fiction_type === 'Fiction').length;
  const nonfictionCount = readBooks.filter(b => b.fiction_type === 'Nonfiction').length;

  // Difficulty distribution
  const diffCounts = { Light: 0, Moderate: 0, Dense: 0 };
  readBooks.forEach(b => { if (b.difficulty && diffCounts[b.difficulty] !== undefined) diffCounts[b.difficulty]++; });

  // Genre breakdown (top 8)
  const genreCounts = {};
  readBooks.forEach(b => { if (b.genre) genreCounts[b.genre] = (genreCounts[b.genre] || 0) + 1; });
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([g, n]) => `${g} (${n})`)
    .join(', ');

  // Format a single book for the context block
  function formatBook(b) {
    const tags = [b.genre, b.fiction_type, b.difficulty].filter(Boolean).join(' · ');
    const notes = b.notes ? ` — reader note: "${b.notes}"` : '';
    return `- ${b.title} by ${b.author}${tags ? ` [${tags}]` : ''}${notes}`;
  }

  const readBooksBlock    = readBooks.map(formatBook).join('\n') || '(none yet)';
  const readingBooksBlock = readingBooks.map(formatBook).join('\n') || '(none)';
  const allTitlesBlock    = books.map(b => `- ${b.title}`).join('\n');

  // ── System prompt ───────────────────────────────────────────────────────────

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

Examples of weak "why":
  ✗ "Since you read several nonfiction books, you might enjoy this one too."
  ✗ "You've read Cormac McCarthy before and this has a similar feel."

Examples of strong "why":
  ✓ "Your copy of Stoner sits alongside several books whose power comes from restraint — \
prose that earns its weight by refusing ornament. Marilynne Robinson's Gilead works the same \
economy: a dying man writing letters to a son who won't remember him, every sentence doing \
double duty as theology and grief. It won the Pulitzer and is considered by many critics the \
finest American novel of the past twenty years."
  ✓ "The density you've shown tolerance for — Tocqueville, Barrett — suggests you're \
comfortable with books that demand active reading rather than passive absorption. Thinking, \
Fast and Slow belongs in that company: Kahneman synthesises decades of research into a model \
of mind that genuinely changes how you see behaviour, including your own."

─── OUTPUT FORMAT ───────────────────────────────────────────────────────────

Return ONLY a valid JSON array — no markdown fences, no commentary outside the array.

Each element must have exactly these fields:
{
  "title": string,
  "author": string,
  "genre": string,
  "fiction_type": "Fiction" | "Nonfiction",
  "why": string — 3-5 sentences of genuine literary reasoning as described above,
  "literary_match": string — one precise sentence naming the specific quality that creates the match (e.g. "Shares the moral seriousness and tonal restraint of Stoner"),
  "suggested_formats": array of zero or more of: "audible", "physical", "kindle",
  "taste_summary": string — ONLY on element [0]; 2-3 sentences capturing the reader's literary character in specific terms, not genre labels
}

Rules:
  - Never recommend a book already in the library (check every title carefully)
  - Produce exactly 5–7 recommendations
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

  // ── Call Claude ─────────────────────────────────────────────────────────────

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
        model:      'claude-sonnet-4-5',
        max_tokens: 3000,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userMessage }],
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
