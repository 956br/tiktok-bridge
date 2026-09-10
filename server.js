const { WebcastPushConnection } = require('tiktok-live-connector');
const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });

wss.on('connection', (ws, req) => {
  // ناخذ اسم الحساب من الرابط: wss://...?user=اسم_الحساب
  const url = new URL(req.url, `http://${req.headers.host}`);
  const username = url.searchParams.get('user');

  if (!username) {
    ws.send(JSON.stringify({ error: 'لازم تحدد اسم الحساب' }));
    ws.close();
    return;
  }

  const tiktokLive = new WebcastPushConnection(username);

  tiktokLive.connect()
    .then(() => ws.send(JSON.stringify({ status: `✅ متصل بحساب ${username}` })))
    .catch(err => ws.send(JSON.stringify({ error: `❌ ما قدرت أتصل بـ ${username}` })));

  tiktokLive.on('chat', data => {
    ws.send(JSON.stringify({ user: data.uniqueId, comment: data.comment }));
  });

  // لما المستخدم يقفل الصفحة، نقفل الاتصال بتيك توك
  ws.on('close', () => {
    tiktokLive.disconnect();
  });
});
