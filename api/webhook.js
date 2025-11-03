// api/webhook.js - robust CommonJS webhook for Vercel
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
      const fixed = raw.replace(/\\n/g, '\n');
      sa = JSON.parse(fixed);
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

async function safeReply(replyToken, messages, fallbackUserId) {
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
      body: JSON.stringify(body),
    });
    const text = await r.text().catch(()=>'<no body>');
    if (!r.ok) {
      console.error('[REPLY] non-ok response', r.status, text);
      if (fallbackUserId) {
        console.log('[REPLY] attempting push fallback to', fallbackUserId);
        const pr = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            to: fallbackUserId,
            messages: Array.isArray(messages) ? messages : [{ type: 'text', text: String(messages) }]
          })
        });
        const ptxt = await pr.text().catch(()=>'<no body>');
        if (!pr.ok) console.error('[PUSH] non-ok', pr.status, ptxt); else console.log('[PUSH] ok');
      }
    } else {
      console.log('[REPLY] ok', r.status, text.slice(0,800));
    }
  } catch (e) {
    console.error('[REPLY] fetch error', e && e.stack ? e.stack : e);
    if (fallbackUserId) {
      try {
        const pr = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            to: fallbackUserId,
            messages: Array.isArray(messages) ? messages : [{ type: 'text', text: String(messages) }]
          })
        });
        const ptxt = await pr.text().catch(()=>'<no body>');
        if (!pr.ok) console.error('[PUSH] non-ok', pr.status, ptxt); else console.log('[PUSH] ok');
      } catch (pe) {
        console.error('[PUSH] fallback error', pe && pe.stack ? pe.stack : pe);
      }
    }
  }
}

module.exports = async (req, res) => {
  try {
    console.log('[WEBHOOK] method', req.method);
    console.log('[WEBHOOK] headers preview', safeSlice(req.headers, 800));
    console.log('[WEBHOOK] body preview', safeSlice(req.body, 3000));

    const missing = [];
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) missing.push('LINE_CHANNEL_ACCESS_TOKEN');
    if (!process.env.LINE_CHANNEL_SECRET) missing.push('LINE_CHANNEL_SECRET');
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) missing.push('GOOGLE_APPLICATION_CREDENTIALS_JSON');
    if (missing.length) {
      console.error('[WEBHOOK] missing env', missing);
      return res.status(200).send('OK - missing env: ' + missing.join(','));
    }

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
            await safeReply(ev.replyToken, `✅ ลงทะเบียนสำเร็จ: ${studentId}`, userId);
            continue;
          }

          if (/^ดูผลงาน$/i.test(txt)) {
            const q = await db.collection('works').where('studentLineId','==',userId).orderBy('uploadedAt','desc').limit(5).get();
            if (q.empty) {
              await safeReply(ev.replyToken, 'ยังไม่มีผลงานในระบบ', userId);
            } else {
              const items = [];
              q.forEach(d => {
                const data = d.data();
                items.push(`${data.title || '(ไม่มีชื่อ)'}\n${data.link}`);
              });
              await safeReply(ev.replyToken, items.join('\n\n'), userId);
            }
            continue;
          }

          const url = (txt.match(/https?:\/\/\S+/) || [null])[0];
          if (url) {
            const sdoc = await db.collection('students').doc(userId).get();
            if (!sdoc.exists) {
              await safeReply(ev.replyToken, '⚠️ กรุณาลงทะเบียนก่อนส่งลิงก์ผลงาน (พิมพ์: ลงทะเบียน <รหัส>)', userId);
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
            await safeReply(ev.replyToken, '✅ บันทึกผลงานเรียบร้อย', userId);
            continue;
          }

          await safeReply(ev.replyToken, 'ส่งรูปแบบ:\nลงทะเบียน <รหัส>\nหรือส่งลิงก์ผลงาน\nหรือพิมพ์ \"ดูผลงาน\"', userId);
        } else {
          await safeReply(ev.replyToken, 'โปรดส่งเป็นข้อความที่มีลิงก์หรือพิมพ์ \"ดูผลงาน\"');
        }
      } catch (innerErr) {
        console.error('[EVENT HANDLER] error:', innerErr && innerErr.stack ? innerErr.stack : innerErr);
      }
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('[WEBHOOK] handler error', err && err.stack ? err.stack : err);
    return res.status(200).send('OK - error logged');
  }
};
