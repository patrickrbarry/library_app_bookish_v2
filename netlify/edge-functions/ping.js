export default async (request, context) => {
  const key = Netlify.env.get('ANTHROPIC_API_KEY');
  let abortSupported = false;
  try { AbortSignal.timeout(1); abortSupported = true; } catch(_) {}
  return new Response(JSON.stringify({
    ok: true,
    hasKey: !!key,
    abortSignalTimeout: abortSupported,
    method: request.method,
  }), { headers: { 'Content-Type': 'application/json' } });
};

export const config = { path: '/api/ping' };
