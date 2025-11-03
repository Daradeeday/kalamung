// index.js
import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import admin from "firebase-admin";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

// init firebase admin from JSON string in env (works on Vercel)
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  const sa = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: sa.project_id
  });
} else {
  // if running locally with GOOGLE_APPLICATION_CREDENTIALS path set
  admin.initializeApp();
}
const db = admin.firestore();

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET;

// optional signature verification
function verifySignature(req) {
  if (!LINE_SECRET) return true;
  const signature = req.headers["x-line-signature"] || "";
  const body = JSON.stringify(req.body);
  const hash = crypto.createHmac("sha256", LINE_SECRET).update(body).digest("base64");
  return hash === signature;
}

// small url reachable check
async function isUrlReachable(url) {
  try {
    if (!/^https?:\/\//i.test(url)) return false;
    const resp = await fetch(url, { method: "HEAD", redirect: "follow", timeout: 8000 });
    if (resp.ok) return true;
    const resp2 = await fetch(url, { method: "GET", redirect: "follow", timeout: 8000 });
    return resp2.ok;
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

async function pushMessageToUser(userId, text) {
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_TOKEN}`
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text }]
    })
  });
}

app.post("/webhook", async (req, res) => {
  try {
    if (!verifySignature(req)) return res.status(401).send("Invalid signature");
    const events = req.body.events || [];
    for (const ev of events) {
      if (ev.type !== "message") continue;
      const userId = ev.source.userId;
      const msg = ev.message;

      if (msg.type === "text") {
        const text = msg.text.trim();

        // register command
        const reg = text.match(/^ลงทะเบียน\s+(\S+)/i);
        if (reg) {
          const studentId = reg[1];
          await db.collection("students").doc(userId).set({
            studentId,
            linkedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          await pushMessageToUser(userId, `✅ ลงทะเบียนสำเร็จ: ${studentId}`);
          continue;
        }

        // parse link form
        const parsed = parseWorkText(text);
        if (!parsed.link) {
          await pushMessageToUser(userId, "ยังไม่พบลิงก์ในข้อความ โปรดส่งตามรูปแบบ:\nชื่อ: ...\nลิงก์: https://...\nคำอธิบาย: ...");
          continue;
        }

        const reachable = await isUrlReachable(parsed.link);
        const studentDoc = await db.collection("students").doc(userId).get();
        const studentId = studentDoc.exists ? studentDoc.data().studentId || null : null;

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

        const ref = await db.collection("works").add(doc);
        if (reachable) {
          await pushMessageToUser(userId, `✅ บันทึกผลงานเรียบร้อย! id: ${ref.id}\nชื่อ: ${doc.title}\nลิงก์: ${doc.link}`);
        } else {
          await pushMessageToUser(userId, `⚠️ บันทึกแล้ว (id: ${ref.id}) แต่ลิงก์อาจเข้าถึงไม่ได้ โปรดตรวจสิทธิ์การแชร์: ${doc.link}`);
        }
      } else {
        await pushMessageToUser(ev.source.userId, "กรุณาส่งลิงก์ผลงานเป็นข้อความ เช่น:\nชื่อ: ชื่อผลงาน\nลิงก์: https://drive.google.com/...\nคำอธิบาย: ...");
      }
    }
    res.status(200).send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send("error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
