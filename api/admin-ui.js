module.exports = (req,res) => {
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.status(200).send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Admin (Kalamung)</title>
  <style>body{font-family:Inter, 'Sarabun',sans-serif;padding:18px} .card{border:1px solid #ddd;padding:10px;margin:8px 0;border-radius:8px}</style>
  </head><body>
  <h2>Admin (Temporary)</h2>
  <p>ใส่ ADMIN_TOKEN แล้วกด Login</p>
  <input id="token" style="width:360px" placeholder="ADMIN_TOKEN"/><button id="login">Login</button>
  <div id="app" style="display:none"><h3>Pending works</h3><div id="list"></div></div>
  <script>
  document.getElementById('login').onclick = async ()=>{ const t=document.getElementById('token').value.trim(); if(!t) return alert('กรอก token'); sessionStorage.setItem('ADMIN_TOKEN', t); await loadList(); document.getElementById('app').style.display='block'; };
  async function loadList(){ const t=sessionStorage.getItem('ADMIN_TOKEN'); const r=await fetch('/api/admin/list',{ headers:{ Authorization:'Bearer '+t }}); const j=await r.json(); if(!j.ok) return alert('Auth failed'); const list=document.getElementById('list'); list.innerHTML=''; j.data.forEach(w=>{ const el=document.createElement('div'); el.className='card'; el.innerHTML='<div style="font-weight:600">'+(w.title||'(no title)')+'</div><div style="font-size:13px;color:#444">'+(w.description||'')+'</div><div><a href="'+(w.link||'#')+'" target="_blank">open</a></div><div style="margin-top:8px"><button data-id="'+w.id+'" class="ap">Approve</button> <button data-id="'+w.id+'" class="rj">Reject</button> <input placeholder="feedback" data-id="'+w.id+'" style="width:300px"/></div>'; list.appendChild(el); }); document.querySelectorAll('.ap').forEach(b=>b.onclick=async e=>{ const id=e.target.dataset.id; await adminAction(id,'approve'); await loadList(); }); document.querySelectorAll('.rj').forEach(b=>b.onclick=async e=>{ const id=e.target.dataset.id; const inp=document.querySelector('input[data-id="'+id+'"]'); await adminAction(id,'reject', inp.value); await loadList(); }); }
  async function adminAction(id, action, feedback=''){ const t=sessionStorage.getItem('ADMIN_TOKEN'); const url = action==='approve' ? '/api/admin/approve' : '/api/admin/reject'; const res = await fetch(url, { method:'POST', headers:{ 'Authorization':'Bearer '+t, 'Content-Type':'application/json' }, body: JSON.stringify({ id, feedback })}); const j=await res.json(); if(!j.ok) alert('failed'); }
  </script>
  </body></html>`);
};
