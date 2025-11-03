// api/webhook.js
const fetch = global.fetch || require('node-fetch');
let admin = null;
let db = null;
let firebaseInitError = null;

async function tryInitFirebase() {
  if (db || firebaseInitError) return;
  try {
    admin = require('firebase-admin');
    const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!raw) throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS_JSON env');
    let sa;
    try { sa = JSON.parse(raw); } catch (e) { sa = JSON.parse(raw.replace(/\\n/g,'\n')); }
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
    db = admin.firestore();
    console.log('[INIT FIREBASE] ok');
  } catch (e) {
    firebaseInitError = e;
    console.error('[INIT FIREBASE] error', e && e.stack ? e.stack : e);
  }
}

async function safeReply(replyToken, messages) {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) return;
  try {
    const body = { replyToken, messages: Array.isArray(messages) ? messages : [{ type:'text', text:String(messages) }] };
    const r = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + process.env.LINE_CHANNEL_ACCESS_TOKEN },
      body: JSON.stringify(body)
    });
    const txt = await r.text().catch(()=>'<no body>');
    if (!r.ok) console.error('[REPLY] non-ok', r.status, txt);
  } catch (e) {
    console.error('[REPLY] error', e && e.stack ? e.stack : e);
  }
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') return res.status(200).send('OK');
    await tryInitFirebase();
    if (firebaseInitError || !db) {
      console.error('[WEBHOOK] firebase init failed');
      return res.status(200).send('OK - firebase init failed');
    }
    const events = (req.body && req.body.events) || [];
    for (const ev of events) {
      try {
        if (ev.type === 'message' && ev.message && ev.message.type === 'text') {
          const txt = (ev.message.text || '').trim();
          const userId = ev.source && ev.source.userId ? ev.source.userId : 'unknown';
          if (/^ลงทะเบียน\s+/i.test(txt)) {
            const studentId = txt.replace(/^ลงทะเบียน\s+/i, '').trim();
            await db.collection('students').doc(userId).set({ studentId, linkedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge:true });
            await safeReply(ev.replyToken, `✅ ลงทะเบียนสำเร็จ: ${studentId}`);
            continue;
          }
          if (/^ดูผลงาน$/i.test(txt)) {
            const q = await db.collection('works').where('studentLineId','==',userId).orderBy('uploadedAt','desc').limit(10).get();
            if (q.empty) {
              await safeReply(ev.replyToken, 'ยังไม่มีผลงานในระบบ');
            } else {
              const items = [];
              q.forEach(d=>{ const data = d.data(); items.push(`${data.title||'(ไม่มีชื่อ)'}\n${data.link||''}`); });
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
              approved: false
            });
            await safeReply(ev.replyToken, '✅ บันทึกผลงานเรียบร้อย');
            continue;
          }
          await safeReply(ev.replyToken, 'ส่งรูปแบบ:\nลงทะเบียน <รหัส>\nหรือส่งลิงก์ผลงาน\nหรือพิมพ์ "ดูผลงาน"');
        } else {
          await safeReply(ev.replyToken, 'โปรดส่งเป็นข้อความที่มีลิงก์หรือพิมพ์ "ดูผลงาน"');
        }
      } catch (inner) {
        console.error('[EVENT] error', inner && inner.stack ? inner.stack : inner);
      }
    }
    return res.status(200).send('OK');
  } catch (err) {
    console.error('[WEBHOOK] handler error', err && err.stack ? err.stack : err);
    return res.status(200).send('OK - error logged');
  }
};
