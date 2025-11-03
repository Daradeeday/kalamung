// api/admin/list.js
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
    const { status } = req.query; // optional: pending|all|approved|rejected
    let q;
    if (status === 'all') {
      q = db.collection('works').orderBy('uploadedAt','desc').limit(200);
    } else if (status === 'approved') {
      q = db.collection('works').where('approved','==',true).orderBy('uploadedAt','desc').limit(200);
    } else if (status === 'rejected') {
      q = db.collection('works').where('approved','==',false).where('rejected','==',true).orderBy('uploadedAt','desc').limit(200);
    } else {
      // default: pending
      q = db.collection('works').where('approved','==',false).orderBy('uploadedAt','desc').limit(200);
    }
    const snap = await q.get();
    const arr = [];
    snap.forEach(d => arr.push(Object.assign({ id: d.id }, d.data())));
    res.json({ ok:true, data: arr });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, message: e.message });
  }
};
