// api/admin/get.js
const admin = require('firebase-admin');
const requireAdmin = require('./_auth');

if (!admin.apps.length) {
  const sa = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ ok:false, message:'missing id' });
    const doc = await db.collection('works').doc(id).get();
    if (!doc.exists) return res.status(404).json({ ok:false, message:'not found' });
    res.json({ ok:true, data: Object.assign({ id: doc.id }, doc.data()) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, message: e.message });
  }
};
