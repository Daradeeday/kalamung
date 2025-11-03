import React, { useEffect, useState } from 'react';

export default function App(){
  const [works, setWorks] = useState([]);
  useEffect(()=>{ fetch('/api/gallery').then(r=>r.json()).then(setWorks).catch(()=>{}); },[]);
  return (<div style={{padding:20,fontFamily:'Arial'}}>
    <h1>แฟ้มสะสมผลงาน</h1>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
      {works.map(w=>(
        <div key={w.id} style={{border:'1px solid #ddd',padding:12,borderRadius:8}}>
          <div style={{fontWeight:600}}>{w.title||'(ไม่มีชื่อ)'}</div>
          <div style={{fontSize:12,color:'#666'}}>{w.description}</div>
          <a href={w.link} target="_blank" rel="noreferrer">ดูผลงาน</a>
        </div>
      ))}
    </div>
  </div>);
}
