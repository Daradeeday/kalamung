import admin from "firebase-admin";
import fetch from "node-fetch";

// ====== INITIALIZE FIREBASE ======
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// ====== LINE HANDLER ======
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const events = req.body.events || [];

  for (const event of events) {
    if (event.type !== "message" || event.message.type !== "text") continue;

    const userId = event.source.userId;
    const message = event.message.text.trim();

    // --- ลงทะเบียน ---
    if (message.startsWith("ลงทะเบียน")) {
      const studentId = message.replace("ลงทะเบียน", "").trim();
      await db.collection("students").doc(userId).set({ studentId, lineId: userId }, { merge: true });
      await replyMessage(event.replyToken, `✅ ลงทะเบียนสำเร็จ: ${studentId}`);
      continue;
    }

    // --- ดูผลงาน ---
    if (message === "ดูผลงาน") {
      const worksSnap = await db.collection("works").where("studentLineId", "==", userId).limit(5).get();
      if (worksSnap.empty) {
        await replyMessage(event.replyToken, "❌ ยังไม่มีผลงานที่บันทึกไว้");
      } else {
        const works = worksSnap.docs.map(d => d.data());
        const bubbles = works.map(work => ({
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: work.title || "ไม่มีชื่อ", weight: "bold", size: "lg" },
              { type: "text", text: work.description || "-", wrap: true, size: "sm", color: "#666666" },
              { type: "button", style: "link", height: "sm", action: { type: "uri", label: "ดูผลงาน", uri: work.link } }
            ]
          }
        }));
        await replyFlex(event.replyToken, "ผลงานของคุณ", bubbles);
      }
      continue;
    }

    // --- เพิ่มผลงาน (เมื่อส่งลิงก์) ---
    if (message.startsWith("http")) {
      const link = message;
      const studentRef = await db.collection("students").doc(userId).get();
      if (!studentRef.exists) {
        await replyMessage(event.replyToken, "⚠️ กรุณาลงทะเบียนก่อนส่งลิงก์ผลงาน");
        continue;
      }
      const studentId = studentRef.data().studentId;
      await db.collection("works").add({
        studentLineId: userId,
        studentId,
        link,
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await replyMessage(event.replyToken, "✅ บันทึกผลงานเรียบร้อย!");
    }
  }

  return res.status(200).send("OK");
}

// ====== LINE REPLY FUNCTIONS ======
async function replyMessage(replyToken, text) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
}

async function replyFlex(replyToken, altText, bubbles) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "flex",
          altText,
          contents: { type: "carousel", contents: bubbles },
        },
      ],
    }),
  });
}
