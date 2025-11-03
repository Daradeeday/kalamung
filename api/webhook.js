// api/webhook.js
// LINE webhook for saving work-links into Firestore (admin SDK).
// Designed for deployment on Vercel as a serverless function.
const admin = require('firebase-admin');

// Initialize Firebase Admin from JSON string stored in env var (recommended for Vercel)
if (!admin.apps.length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const sa = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id
    });
  } else {
    // If running locally with GOOGLE_APPLICATION_CREDENTIALS set to a file path, admin will pick it up
    admin.initializeApp();
  }
}
const db = admin.firestore();

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET || '';

// simple signature verification (optional but recommended)
const crypto = require('crypto');
function verifySignature(req) {
  if (!LINE_SECRET) return true;
  const signature = req.headers['x-line-signature'] || '';
  const body = JSON.stringify(req.body || {});
  const hash = crypto.createHmac('sha256', LINE_SECRET).update(body).digest('base64');
  return hash === signature;
}

// lightweight url reachable check (HEAD then GET fallback)
async function isUrlReachable(url) {
  try {
    if (!/^https?:\/\//i.test(url)) return false;
    // global fetch is available on Vercel (Node 18+)
    const head = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (head.ok) return true;
    const get = await fetch(url, { method: 'GET', redirect: 'follow' });
    return get.ok;
  } catch (e) {
    return false;
  }
}

function parseWorkText(text) {
  const titleMatch = text.match(/(?:ชื่อ[:：]\s*)(.+)/i);
  const linkMatch = text.match(/(?:ลิงก์[:：]\s*)(https?:\/\/\S+)/i);
  const descMatch = text.match(/(?:คำอธิบาย[:：]\s*)([\s\S]+)/i);
  return {
    title: titleMatch ? titleMatch[1].trim() : "",
    link: linkMatch ? linkMatch[1].trim() : null,
    description: descMatch ? descMatch[1].trim() : ""
  };
}

async function pushMessageToUser(userId, messages) {
  if (!LINE_TOKEN) return;
  // messages: array of message objects or single string
  const body = { to: userId, messages: Array.isArray(messages) ? messages : [{ type: 'text', text: messages }] };
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_TOKEN}`
    },
    body: JSON.stringify(body)
  });
}

// Build a simple flex carousel from works (max 5)
function buildCarouselMessages(works) {
  if (!works || works.length === 0) {
    return [{ type: 'text', text: 'ยังไม่มีผลงานในระบบ' }];
  }
  // Limit to 5
  const items = works.slice(0,5).map(w => {
    const title = w.title || '(ไม่มีชื่อ)';
    const desc = w.description ? (w.description.length>60? w.description.slice(0,57)+'...': w.description) : '';
    const url = w.link || w.file_url || '';
    return {
      "type":"bubble",
      "size":"kilo",
      "body": {
        "type":"box",
        "layout":"vertical",
        "spacing":"md",
        "contents":[
          { "type":"text", "text": title, "wrap": true, "weight":"bold", "size":"md" },
          { "type":"text", "text": desc, "wrap": true, "size":"sm", "color":"#666666" }
        ]
      },
      "footer":{
        "type":"box",
        "layout":"vertical",
        "spacing":"sm",
        "contents":[
          {
            "type":"button",
            "style":"primary",
            "action": { "type":"uri", "label":"ดูผลงาน", "uri": url }
          }
        ]
      }
    };
  });

  const flex = {
    type: 'flex',
    altText: `ผลงาน (${works.length})`,
    contents: {
      type: 'carousel',
      contents: items
    }
  };
  return [flex];
}

// fetch latest works for a studentLineId (limit n)
async function fetchWorksForStudent(lineId, limit = 5) {
  const q = await db.collection('works')
    .where('studentLineId', '==', lineId)
    .orderBy('uploadedAt', 'desc')
    .limit(limit)
    .get();
  const arr = [];
  q.forEach(d => {
    arr.push(Object.assign({ id: d.id }, d.data()));
  });
  return arr;
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      // simple health check
      return res.status(200).send('OK');
    }
    // Vercel uses POST for webhooks
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    // Optional verify signature
    if (!verifySignature(req)) {
      return res.status(401).send('Invalid signature');
    }

    const body = req.body || {};
    const events = body.events || [];
    for (const ev of events) {
      if (ev.type !== 'message') continue;
      const userId = ev.source && ev.source.userId;
      const msg = ev.message;
      if (!userId) continue;

      if (msg && msg.type === 'text') {
        const text = (msg.text || '').trim();

        // registration: "ลงทะเบียน 63045"
        const reg = text.match(/^ลงทะเบียน\s+(\S+)/i);
        if (reg) {
          const studentId = reg[1];
          await db.collection('students').doc(userId).set({
            studentId,
            linkedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          await pushMessageToUser(userId, `✅ ลงทะเบียนสำเร็จ: ${studentId}`);
          continue;
        }

        // "ดูผลงาน" command
        if (/^ดูผลงาน$/i.test(text)) {
          const works = await fetchWorksForStudent(userId, 5);
          const messages = buildCarouselMessages(works);
          await pushMessageToUser(userId, messages);
          continue;
        }

        // parse link form
        const parsed = parseWorkText(text);
        if (!parsed.link) {
          await pushMessageToUser(userId, "ยังไม่พบลิงก์ในข้อความ โปรดส่งตามรูปแบบ:\nชื่อ: ...\nลิงก์: https://...\nคำอธิบาย: ...");
          continue;
        }

        const reachable = await isUrlReachable(parsed.link);
        const studentDoc = await db.collection('students').doc(userId).get();
        const studentId = studentDoc.exists ? (studentDoc.data().studentId || null) : null;

        const doc = {
          studentLineId: userId,
          studentId,
          title: parsed.title || "(ไม่มีชื่อ)",
          link: parsed.link,
          description: parsed.description || "",
          uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
          validLink: reachable,
          approved: false
        };

        const ref = await db.collection('works').add(doc);

        if (reachable) {
          await pushMessageToUser(userId, `✅ บันทึกผลงานเรียบร้อย! id: ${ref.id}\nชื่อ: ${doc.title}\nลิงก์: ${doc.link}`);
        } else {
          await pushMessageToUser(userId, `⚠️ บันทึกแล้ว (id: ${ref.id}) แต่ลิงก์อาจเข้าถึงไม่ได้ โปรดตรวจสิทธิ์การแชร์: ${doc.link}`);
        }
      } else {
        // non-text guidance
        await pushMessageToUser(userId, "กรุณาส่งลิงก์ผลงานเป็นข้อความ เช่น:\nชื่อ: ชื่อผลงาน\nลิงก์: https://drive.google.com/...\nคำอธิบาย: ...");
      }
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error', err);
    return res.status(500).send('error');
  }
};
