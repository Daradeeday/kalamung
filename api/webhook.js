cat > api/webhook.js <<'JS'
/*
  Robust webhook for Vercel (CommonJS).
  Fixed: safe handling of headers/body preview (no .slice on undefined).
*/
const fetch = global.fetch || require('node-fetch');
const admin = require('firebase-admin');

let db = null;
let firebaseInitError = null;

try {
  if (!admin.apps.length) {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS_JSON env');
    }
    const sa = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    db = admin.firestore();
    console.log('[INIT] Firebase initialized');
  } else {
    db = admin.firestore();
  }
} catch (err) {
  firebaseInitError = err;
  console.error('[INIT FIREBASE] error:', err && err.stack ? err.stack : err);
  // keep going — handle in request handler
}

function safeSlice(str, len = 800) {
  try {
    if (typeof str === 'string') return str.slice(0, len);
    // if object, stringify it
    if (typeof str === 'object' && str !== null) return JSON.stringify(str).slice(0, len);
  } catch (e) { /* fallthrough */ }
  return '';
}

function safeReply(replyToken, messages) {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.warn('[REPLY] missing LINE_CHANNEL_ACCESS_TOKEN');
    return Promise.resolve();
  }
  const body = {
    replyToken,
    messages: Array.isArray(messages) ? messages : [{ type: 'text', text: String(messages) }]
  };
  return fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify(body),
  }).then(r => {
    if (!r.ok) {
      return r.text().then(t => {
        console.error('[REPLY] non-ok response', r.status, t);
      });
    }
  }).catch(e => {
    console.error('[REPLY] fetch error', e && e.stack ? e.stack : e);
  });
}

module.exports = async (req, res) => {
  try {
    console.log('[WEBHOOK] Method:', req.method);

    // safe previews
    const headersPreview = safeSlice(req.headers || {}, 800);
    const bodyPreview = safeSlice(req.body || {}, 2000);
    console.log('[WEBHOOK] Headers preview:', headersPreview);
    console.log('[WEBHOOK] Body preview:', bodyPreview);

    // quick env check
    const missing = [];
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) missing.push('LINE_CHANNEL_ACCESS_TOKEN');
    if (!process.env.LINE_CHANNEL_SECRET) missing.push('LINE_CHANNEL_SECRET');
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) missing.push('GOOGLE_APPLICATION_CREDENTIALS_JSON');
    if (missing.length) {
      console.error('[WEBHOOK] Missing env:', missing);
      return res.status(200).send('OK - error logged (missing env: ' + missing.join(',') + ')');
    }

    if (firebaseInitError || !db) {
      console.error('[WEBHOOK] firebase not initialized:', firebaseInitError && firebaseInitError.stack ? firebaseInitError.stack : firebaseInitError);
      return res.status(200).send('OK - error logged (firebase init failed)');
    }

    if (req.method === 'GET') return res.status(200).send('OK');
    if (req.method !== 'POST') return res.status(200).send('OK');

    const events = (req.body && req.body.events) || [];
    for (const ev of events) {
      try {
        console.log('[EVENT] type:', ev.type, 'source:', safeSlice(ev.source || {}, 200));
        if (ev.type === 'message' && ev.message && ev.message.type === 'text') {
          const txt = (ev.message.text || '').trim();
          const userId = (ev.source && ev.source.userId) || 'unknown';

          if (/^ลงทะเบียน\s+/i.test(txt)) {
            const studentId = txt.replace(/^ลงทะเบียน\s+/i, '').trim();
            await db.collection('students').doc(userId).set({
              studentId,
              linkedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            await safeReply(ev.replyToken, `✅ ลงทะเบียนสำเร็จ: ${studentId}`);
            continue;
          }

          if (/^ดูผลงาน$/i.test(txt)) {
            const q = await db.collection('works').where('studentLineId', '==', userId).orderBy('uploadedAt','desc').limit(5).get();
            if (q.empty) {
              await safeReply(ev.replyToken, 'ยังไม่มีผลงานในระบบ');
            } else {
              const items = [];
              q.forEach(d => {
                const data = d.data();
                items.push(`${data.title || '(ไม่มีชื่อ)'}\n${data.link}\n`);
              });
              await safeReply(ev.replyToken, items.join('\n'));
            }
            continue;
          }

          const urlMatch = txt.match(/https?:\/\/\S+/);
          if (urlMatch) {
            const link = urlMatch[0];
            const studentDoc = await db.collection('students').doc(userId).get();
            if (!studentDoc.exists) {
              await safeReply(ev.replyToken, '⚠️ กรุณาลงทะเบียนก่อนส่งลิงก์ผลงาน (พิมพ์: ลงทะเบียน <รหัส>)');
              continue;
            }
            const studentId = studentDoc.data().studentId || null;
            await db.collection('works').add({
              studentLineId: userId,
              studentId,
              title: '(จาก LINE)',
              link,
              uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
              validLink: true
            });
            await safeReply(ev.replyToken, '✅ บันทึกผลงานเรียบร้อย');
            continue;
          }

          await safeReply(ev.replyToken, 'ส่งรูปแบบ:\nลงทะเบียน <รหัส>\nหรือส่งลิงก์ผลงาน\nหรือพิมพ์ "ดูผลงาน"');
        } else {
          await safeReply(ev.replyToken, 'โปรดส่งเป็นข้อความที่มีลิงก์หรือพิมพ์ "ดูผลงาน"');
        }
      } catch (innerErr) {
        console.error('[EVENT HANDLER] error:', innerErr && innerErr.stack ? innerErr.stack : innerErr);
      }
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('[WEBHOOK] handler error:', err && err.stack ? err.stack : err);
    return res.status(200).send('OK - error logged');
  }
};
JS
