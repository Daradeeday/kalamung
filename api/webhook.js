// api/webhook.js (Correct JS - CommonJS for Vercel)
const fetch = global.fetch || require('node-fetch');

let admin = null;
let db = null;
let firebaseInitError = null;

function safeSlice(val, len = 800) {
  try {
    if (typeof val === 'string') return val.slice(0, len);
    if (val === undefined || val === null) return '';
    return JSON.stringify(val).slice(0, len);
  } catch (e) { return ''; }
}

// Lazy init firebase to avoid cold-start crashes
async function tryInitFirebase() {
  if (db || firebaseInitError) return;
  try {
    admin = require('firebase-admin');
    const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!raw) throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS_JSON env');
    let sa;
    try {
      sa = JSON.parse(raw);
    } catch (e) {
      // tolerate escaped newlines
      try {
        const fixed = raw.replace(/\\n/g, '\n');
        sa = JSON.parse(fixed);
      } catch (e2) {
        throw new Error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON: ' + e2.message);
      }
    }
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
    db = admin.firestore();
    console.log('[INIT FIREBASE] success');
  } catch (err) {
    firebaseInitError = err;
    console.error('[INIT FIREBASE] error:', err && err.stack ? err.stack : err);
  }
}

async function safeReply(replyToken, messages) {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.warn('[REPLY] missing LINE_CHANNEL_ACCESS_TOKEN');
    return;
  }
  try {
    const body = {
      replyToken,
      messages: Array.isArray(messages) ? messages : [{ type: 'text', text: String(messages) }]
    };
    const r = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '<no body>');
      console.error('[REPLY] non-ok', r.status, txt);
    }
  } catch (e) {
    console.error('[REPLY] error', e && e.stack ? e.stack : e);
  }
}

module.exports = async (req, res) => {
  try {
    console.log('[WEBHOOK] method', req.method);
    console.log('[WEBHOOK] headers preview', safeSlice(req.headers, 800));
    console.log('[WEBHOOK] body preview', safeSlice(req.body, 3000));

    // env check
    const missing = [];
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) missing.push('LINE_CHANNEL_ACCESS_TOKEN');
    if (!process.env.LINE_CHANNEL_SECRET) missing.push('LINE_CHANNEL_SECRET');
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) missing.push('GOOGLE_APPLICATION_CREDENTIALS_JSON');
    if (missing.length) {
      console.error('[WEBHOOK] missing env', missing);
      return res.status(200).send('OK - missing env: ' + missing.join(','));
    }

    // init firebase
    await tryInitFirebase();
    if (firebaseInitError || !db) {
      console.error('[WEBHOOK] firebase init failed:', firebaseInitError && firebaseInitError.stack ? firebaseInitError.stack : firebaseInitError);
      return res.status(200).send('OK - firebase init failed');
    }

    if (req.method === 'GET') return res.status(200).send('OK');
    if (req.method !== 'POST') return res.status(200).send('OK');

    const events = (req.body && req.body.events) || [];
    for (const ev of events) {
      try {
        console.log('[EVENT] type', ev.type, 'source', safeSlice(ev.source, 200));
        if (ev.type === 'message' && ev.message && ev.message.type === 'text') {
          const txt = (ev.message.text || '').trim();
          const userId = ev.source && ev.source.userId ? ev.source.userId : 'unknown';

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
            const q = await db.collection('works').where('studentLineId','==',userId).orderBy('uploadedAt','desc').limit(5).get();
            if (q.empty) {
              await safeReply(ev.replyToken, 'ยังไม่มีผลงานในระบบ');
            } else {
              const items = [];
              q.forEach(d => {
                const data = d.data();
                items.push(`${data.title || '(ไม่มีชื่อ)'}\n${data.link}`);
              });
              await safeReply(ev.replyToken, items.join('\n\n'));
            }
            continue;
          }

          const url = (txt.match(/https?:\/\/\S+/) || [null])[0];
          if (url) {
            const sdoc = await db.collection('students').doc(userId).get();
            if (!sdoc.exists) {
              await safeReply(ev.replyToken, '⚠️ กรุณาลงทะเบียนก่อนส่งลิงก์ผลงาน (พิมพ์: ลงทะเบียน <รหัส>)');
              continue;
            }
            const studentId = sdoc.data().studentId || null;
            await db.collection('works').add({
              studentLineId: userId,
              studentId,
              title: '(จาก LINE)',
              link: url,
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
      } catch (ie) {
        console.error('[EVENT HANDLER] inner error', ie && ie.stack ? ie.stack : ie);
      }
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('[WEBHOOK] unhandled error', err && err.stack ? err.stack : err);
    return res.status(200).send('OK - error logged');
  }
};
