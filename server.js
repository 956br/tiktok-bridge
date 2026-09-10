const { WebcastPushConnection } = require('tiktok-live-connector');
const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const username = url.searchParams.get('user');

  if (!username) {
    ws.send(JSON.stringify({ error: 'لازم تحدد اسم الحساب' }));
    ws.close();
    return;
  }

  // 👇 أضفنا المفتاح هنا
  const tiktokLive = new WebcastPushConnection(username, {
    signApiKey: 'euler_NmRmYTIyZmM0MTVkOTllYmQ0MDczMTI1ZDE1NmUwNmQ3ZmY3NjhjODcwZjMzOTFkNzgwZTk0'
  });

  tiktokLive.connect()
    .then(() => ws.send(JSON.stringify({ status: `✅ متصل بحساب ${username}` })))
    .catch(err => ws.send(JSON.stringify({ error: `❌ ما قدرت أتصل بـ ${username}: ${err.message}` })));

  tiktokLive.on('chat', data => {
    ws.send(JSON.stringify({ user: data.uniqueId, comment: data.comment }));
  });

  ws.on('close', () => {
    tiktokLive.disconnect();
  });
});
