const admin = require('firebase-admin');
const requireAdmin = require('./_auth');
if (!admin.apps.length) {
  const sa = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();
module.exports = async (req,res) => {
  if (!requireAdmin(req,res)) return;
  try {
    const snap = await db.collection('works').orderBy('uploadedAt','desc').limit(200).get();
    const arr = [];
    snap.forEach(d=>arr.push(Object.assign({ id:d.id }, d.data())));
    res.json({ ok:true, data:arr });
  } catch(e){ console.error(e); res.status(500).json({ ok:false, message:e.message }); }
};
