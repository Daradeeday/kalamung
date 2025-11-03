// api/admin/reject.js
const admin = require('firebase-admin');
const requireAdmin = require('./_auth');

if (!admin.apps.length) {
  const sa = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { id, feedback } = req.body;
    if (!id) return res.status(400).json({ ok:false, message:'missing id' });
    await db.collection('works').doc(id).update({
      approved: false,
      rejected: true,
      feedback: feedback || '',
      reviewedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ ok:true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, message: e.message });
  }
};
