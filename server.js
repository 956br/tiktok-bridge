import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const username = url.searchParams.get('user');

  if (!username) {
    ws.send(JSON.stringify({ error: 'لازم تحدد اسم الحساب' }));
    ws.close();
    return;
  }

  // 👇 غيّر "ضع_مفتاحك_هنا" بمفتاحك الحقيقي من لوحة EulerStream
  const tiktokLive = new TikTokLiveConnection(username, {
    signApiKey: 'euler_NmRmYTIyZmM0MTVkOTllYmQ0MDczMTI1ZDE1NmUwNmQ3ZmY3NjhjODcwZjMzOTFkNzgwZTk0',
    connectWithUniqueId: true,   // يخلي EulerStream يجيب معلومات الغرفة بدل سيرفرنا (يتفادى حظر الـ IP)
    disableEulerFallbacks: false
  });

  tiktokLive.connect()
    .then(() => ws.send(JSON.stringify({ status: `✅ متصل بحساب ${username}` })))
    .catch(err => ws.send(JSON.stringify({ error: `❌ ما قدرت أتصل بـ ${username}: ${err.message}` })));

  tiktokLive.on(WebcastEvent.CHAT, data => {
    ws.send(JSON.stringify({ user: data?.user?.nickname, comment: data?.content }));
  });

  ws.on('close', () => {
    tiktokLive.disconnect();
  });
});
