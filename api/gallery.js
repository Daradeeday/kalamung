// api/gallery.js
const admin = require('firebase-admin');
if (!admin.apps.length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const sa = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id
    });
  } else {
    admin.initializeApp();
  }
}
const db = admin.firestore();

module.exports = async (req, res) => {
  try {
    const { studentLineId } = req.query;
    let q = db.collection('works').orderBy('uploadedAt', 'desc').limit(100);
    if (studentLineId) {
      q = db.collection('works').where('studentLineId', '==', studentLineId).orderBy('uploadedAt','desc').limit(100);
    }
    const snap = await q.get();
    const arr = [];
    snap.forEach(d => arr.push(Object.assign({ id: d.id }, d.data())));
    res.setHeader('Content-Type','application/json');
    return res.status(200).send(JSON.stringify(arr));
  } catch (e) {
    console.error('gallery error', e);
    return res.status(500).send('error');
  }
};
