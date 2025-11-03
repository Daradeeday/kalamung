// api/gallery.js
const admin = require('firebase-admin');
if (!admin.apps.length) {
  try { const sa = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}'); admin.initializeApp({ credential: admin.credential.cert(sa) }); }
  catch(e){ console.error('[GALLERY] init error', e); }
}
const db = admin.firestore ? admin.firestore() : null;
module.exports = async (req,res) => {
  try {
    if (!db) return res.status(500).json({ ok:false, message:'no firestore' });
    const { studentLineId } = req.query;
    let q;
    if (studentLineId) q = db.collection('works').where('studentLineId','==',studentLineId).where('approved','==',true).orderBy('uploadedAt','desc').limit(200);
    else q = db.collection('works').where('approved','==',true).orderBy('uploadedAt','desc').limit(200);
    const snap = await q.get();
    const arr = [];
    snap.forEach(d=>arr.push(Object.assign({ id:d.id }, d.data())));
    res.json({ ok:true, data:arr });
  } catch (e) { console.error(e); res.status(500).json({ ok:false, message:e.message }); }
};
