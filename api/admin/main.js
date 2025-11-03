// frontend/admin/main.js (very small SPA)
const root = document.getElementById('root');
root.innerHTML = `
  <h2>Admin Login</h2>
  <div>
    <input id="token" placeholder="Admin token" style="width:300px"/>
    <button id="login">Login</button>
  </div>
  <div id="app" style="display:none">
    <h3>Pending works</h3>
    <div id="list"></div>
  </div>
`;

document.getElementById('login').onclick = async () => {
  const t = document.getElementById('token').value.trim();
  if (!t) return alert('กรอก token');
  sessionStorage.setItem('ADMIN_TOKEN', t);
  await loadList();
  document.getElementById('app').style.display = 'block';
};

async function loadList(){
  const token = sessionStorage.getItem('ADMIN_TOKEN');
  const res = await fetch('/api/admin/list', { headers: { Authorization: 'Bearer ' + token } });
  const j = await res.json();
  if (!j.ok) return alert('Auth failed');
  const list = document.getElementById('list');
  list.innerHTML = '';
  j.data.forEach(w => {
    const el = document.createElement('div');
    el.style.border='1px solid #ddd'; el.style.padding='8px'; el.style.margin='6px';
    el.innerHTML = `<b>${w.title||'(no title)'}</b><div>${w.description||''}</div><div><a href="${w.link}" target="_blank">open</a></div>
      <div>
        <button data-id="${w.id}" class="ap">Approve</button>
        <button data-id="${w.id}" class="rj">Reject</button>
        <input placeholder="feedback" data-id="${w.id}" style="width:300px"/>
      </div>`;
    list.appendChild(el);
  });
  document.querySelectorAll('.ap').forEach(b => b.onclick = async e => {
    const id = e.target.dataset.id; await adminAction(id,'approve'); await loadList();
  });
  document.querySelectorAll('.rj').forEach(b => b.onclick = async e => {
    const id = e.target.dataset.id;
    const inp = document.querySelector(`input[data-id="${id}"]`);
    await adminAction(id,'reject', inp.value);
    await loadList();
  });
}

async function adminAction(id, action, feedback=''){
  const token = sessionStorage.getItem('ADMIN_TOKEN');
  const url = action === 'approve' ? '/api/admin/approve' : '/api/admin/reject';
  const res = await fetch(url, { method:'POST', headers:{ 'Authorization':'Bearer '+token, 'Content-Type':'application/json' }, body: JSON.stringify({ id, feedback }) });
  const j = await res.json();
  if (!j.ok) alert('failed: '+ (j.message || ''));
}
