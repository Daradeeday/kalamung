// api/webhook.js  — Safe-mode debugging webhook for Vercel
const fetch = global.fetch || require('node-fetch');

module.exports = async (req, res) => {
  try {
    console.log('[WEBHOOK] incoming', { method: req.method, headers: req.headers });
    // Log body size and preview (avoid logging secrets fully)
    const preview = JSON.stringify(req.body).slice(0, 2000);
    console.log('[WEBHOOK] body preview:', preview);

    // Basic health/echo for manual test
    if (req.method === 'GET') return res.status(200).send('OK (webhook debug)');

    // Quick sanity checks for env
    const missing = [];
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) missing.push('LINE_CHANNEL_ACCESS_TOKEN');
    if (!process.env.LINE_CHANNEL_SECRET) missing.push('LINE_CHANNEL_SECRET');
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) missing.push('GOOGLE_APPLICATION_CREDENTIALS_JSON');
    if (missing.length) {
      console.error('[WEBHOOK] Missing env:', missing);
      // still return 200 to stop LINE from marking the webhook as broken
      return res.status(200).send(`OK (missing env: ${missing.join(',')})`);
    }

    // If you want to inspect events:
    if (req.body && req.body.events) {
      for (const e of req.body.events) {
        console.log('[EVENT]', e.type, e.message && e.message.type, e.source);
      }
    }

    // respond 200 always (temporary). Replace with real logic after debugging.
    return res.status(200).send('OK - debug');
  } catch (err) {
    console.error('[WEBHOOK] uncaught error:', err && err.stack ? err.stack : err);
    // return 200 to satisfy LINE while we fix the issue
    return res.status(200).send('OK - error logged');
  }
};
