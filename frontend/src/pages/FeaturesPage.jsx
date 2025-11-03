import React from 'react';
export default function FeaturesPage(){
  const features=[
    { title:'ส่งผลงานผ่าน LINE', desc:'ให้นักเรียนสามารถส่งผลงานมาเก็บไว้ในระบบผ่านแชทได้ทันที' },
    { title:'จัดหมวดหมู่อัตโนมัติ', desc:'ระบบช่วยแยกผลงานตามประเภท เช่น แข่งขัน วิชาการ กิจกรรม' },
    { title:'ค้นหาและดาวน์โหลด', desc:'ครูสามารถค้นหาผลงานตามชื่อ รหัส หรือประเภท และดาวน์โหลดได้' },
    { title:'แดชบอร์ดสรุปผลงาน', desc:'แสดงจำนวนผลงาน สถานะการอนุมัติ และสถิติต่าง ๆ' },
    { title:'ปลอดภัยและเป็นส่วนตัว', desc:'ใช้ Firebase และ LINE Platform จัดเก็บข้อมูลอย่างปลอดภัย' },
    { title:'Kalamung+', desc:'ปลดล็อกฟีเจอร์พิเศษ เช่น รายงานเชิงลึก และแจ้งเตือนอัตโนมัติ' }
  ];
  return (
    <div style={{fontFamily:'Sarabun,Inter,Arial',background:'#f0f9ff',minHeight:'100vh'}}>
      <header style={{background:'#007bff',color:'#fff',padding:'48px 16px',textAlign:'center'}}>
        <h1 style={{margin:0,fontSize:32}}>ฟีเจอร์ของ Kalamung</h1>
        <p style={{marginTop:8}}>ผู้ช่วยจัดการผลงานและข้อมูลนักเรียนผ่าน LINE ได้ง่ายขึ้น</p>
        <a href="#features" style={{display:'inline-block',marginTop:12,padding:'8px 16px',background:'#fff',color:'#007bff',borderRadius:999}}>ดูฟีเจอร์ทั้งหมด</a>
      </header>
      <main id="features" style={{maxWidth:1100,margin:'32px auto',padding:'0 16px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:20}}>
        {features.map((f,i)=>(
          <article key={i} style={{background:'#fff',padding:20,borderRadius:12,boxShadow:'0 6px 18px rgba(2,6,23,0.06)'}}>
            <h3 style={{color:'#007bff',marginTop:0}}>{f.title}</h3>
            <p style={{margin:0,color:'#334155'}}>{f.desc}</p>
          </article>
        ))}
      </main>
      <section style={{maxWidth:900,margin:'0 auto 48px',padding:'0 16px'}}>
        <div style={{background:'#e6f6ff',borderRadius:12,padding:20,border:'1px solid #d9f0ff'}}>
          <h3 style={{color:'#007bff'}}>Kalamung+</h3>
          <p>อัปเกรดเป็น Kalamung+ เพื่อปลดล็อกฟีเจอร์พิเศษ เช่น รายงานเชิงลึก และการแจ้งเตือนอัตโนมัติ</p>
          <a style={{display:'inline-block',marginTop:8,padding:'8px 12px',background:'#007bff',color:'#fff',borderRadius:8}} href="#">ดูฟีเจอร์ Kalamung+</a>
        </div>
      </section>
      <footer style={{background:'#e6f6ff',textAlign:'center',padding:16,color:'#334155'}}>&copy; 2025 Kalamung. All rights reserved.</footer>
    </div>
  );
}
