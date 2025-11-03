import React, { useEffect, useState } from 'react';

export default function App(){
  const [works, setWorks] = useState([]);
  useEffect(()=>{ fetch('/api/gallery').then(r=>r.json()).then(d=>{ if(d.ok) setWorks(d.data); }).catch(()=>{}); },[]);
  return (
    <div style={{fontFamily:'Inter,Arial',padding:20,maxWidth:1000,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <h1>แฟ้มสะสมผลงาน</h1>
        <a href="/api/admin-ui" style={{textDecoration:'none',padding:'8px 12px',background:'#0b74ff',color:'#fff',borderRadius:6}}>Admin</a>
      </header>
      <main>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
          {works.length===0 && <div>ยังไม่มีผลงานที่อนุมัติ</div>}
          {works.map(w=>(
            <div key={w.id} style={{border:'1px solid #e6e6e6',padding:12,borderRadius:8,background:'#fff'}}>
              <div style={{fontWeight:700}}>{w.title||'(ไม่มีชื่อ)'}</div>
              <div style={{fontSize:13,color:'#666',margin:'8px 0'}}>{w.description||''}</div>
              <a href={w.link} target="_blank" rel="noreferrer">ดูผลงาน</a>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
