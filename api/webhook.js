// แทนที่ safeReply เดิมด้วยโค้ดนี้
async function safeReply(replyToken, messages, fallbackUserId) {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.warn('[REPLY] missing LINE_CHANNEL_ACCESS_TOKEN');
    return;
  }
  const body = {
    replyToken,
    messages: Array.isArray(messages) ? messages : [{ type: 'text', text: String(messages) }]
  };
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify(body),
    });

    const text = await r.text().catch(()=>'<no body>');
    if (!r.ok) {
      console.error('[REPLY] non-ok response', r.status, text);

      // fallback: ถ้าเรามี userId, ให้ลองส่งแบบ push แทน
      if (fallbackUserId) {
        console.log('[REPLY] attempting push fallback to', fallbackUserId);
        await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            to: fallbackUserId,
            messages: Array.isArray(messages) ? messages : [{ type: 'text', text: String(messages) }]
          })
        }).then(async pr => {
          const ptxt = await pr.text().catch(()=>'<no body>');
          if (!pr.ok) console.error('[PUSH] non-ok', pr.status, ptxt); else console.log('[PUSH] ok');
        }).catch(pe => console.error('[PUSH] error', pe && pe.stack?pe.stack:pe));
      }
    } else {
      console.log('[REPLY] ok', r.status, text.slice(0,800));
    }
  } catch (e) {
    console.error('[REPLY] fetch error', e && e.stack ? e.stack : e);
    // try fallback push
    if (fallbackUserId) {
      try {
        await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            to: fallbackUserId,
            messages: Array.isArray(messages) ? messages : [{ type: 'text', text: String(messages) }]
          })
        });
        console.log('[PUSH] fallback attempted');
      } catch (pe) {
        console.error('[PUSH] fallback error', pe && pe.stack ? pe.stack : pe);
      }
    }
  }
}
