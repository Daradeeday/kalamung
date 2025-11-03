// Simple React app (no build tools included in zip)
// You can use this as a starting point. For Vercel, deploy as a separate project or build and serve static files.
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [works, setWorks] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);

  async function fetchWorks(id) {
    setLoading(true);
    const q = id ? `?studentLineId=${encodeURIComponent(id)}` : '';
    const res = await fetch(`/api/gallery${q}`);
    const data = await res.json();
    setWorks(data);
    setLoading(false);
  }

  useEffect(() => {
    // optionally fetch latest global works
    fetchWorks('');
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: '24px auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>แฟ้มสะสมผลงานนักเรียน</h1>
      <div style={{ marginBottom: 12 }}>
        <input placeholder="กรอก LINE userId (ถ้ามี)" value={studentId} onChange={e=>setStudentId(e.target.value)} />
        <button onClick={()=>fetchWorks(studentId)} style={{ marginLeft: 8 }}>ค้นหา</button>
      </div>
      {loading && <div>กำลังโหลด...</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {works.map(w => (
          <div key={w.id} style={{ border:'1px solid #ddd', padding:12, borderRadius:8 }}>
            <div style={{ fontWeight:600 }}>{w.title || '(ไม่มีชื่อ)'}</div>
            <div style={{ fontSize:12, color:'#666', marginBottom:8 }}>{w.description}</div>
            <a href={w.link} target="_blank" rel="noopener noreferrer">ดูผลงาน</a>
            <div style={{ fontSize:11, color:'#999', marginTop:8 }}>{new Date(w.uploadedAt && w.uploadedAt._seconds ? w.uploadedAt._seconds*1000 : w.uploadedAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
