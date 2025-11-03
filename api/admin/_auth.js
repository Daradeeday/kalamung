module.exports = function requireAdmin(req,res){
  const auth = (req.headers.authorization||'').trim();
  if (!auth.startsWith('Bearer ')) { res.status(401).json({ ok:false, message:'Missing token' }); return null; }
  const token = auth.slice(7);
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) { res.status(403).json({ ok:false, message:'Invalid token' }); return null; }
  return token;
};
