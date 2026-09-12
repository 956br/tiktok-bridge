import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });

// 👇 حط مفتاحك من EulerStream هنا
const API_KEY = 'euler_NmRmYTIyZmM0MTVkOTllYmQ0MDczMTI1ZDE1NmUwNmQ3ZmY3NjhjODcwZjMzOTFkNzgwZTk0';

console.log('🚀 السيرفر شغال على المنفذ 8080 — بانتظار الاتصال');

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const username = url.searchParams.get('user');

  if (!username) {
    ws.send(JSON.stringify({ error: 'لازم تحدد اسم الحساب' }));
    ws.close();
    return;
  }

  let tiktokLive = null;
  let keepAlive = null;

  async function start() {
    tiktokLive = new TikTokLiveConnection(username, {
      signApiKey: API_KEY
    });

    tiktokLive.on(WebcastEvent.CHAT, data => {
      if (ws.readyState === ws.OPEN) {
        const comment = data?.comment ?? data?.content;
        ws.send(JSON.stringify({ user: data?.user?.nickname, comment }));
      }
    });

    tiktokLive.on('disconnected', () => {
      console.log(`⚠️ تيك توك قطع الاتصال بـ ${username}`);
    });

    try {
      console.log(`🔌 محاولة الاتصال بـ ${username} ...`);
      const state = await tiktokLive.connect();
      console.log(`✅ نجح الاتصال بـ ${username} — رقم الغرفة: ${state?.roomId}`);
      ws.send(JSON.stringify({ status: `✅ متصل بحساب ${username}` }));
    } catch (err) {
      console.log(`❌ فشل: ${err?.message}`);
      ws.send(JSON.stringify({ error: `❌ ما قدرت أتصل بـ ${username}: ${err?.message}` }));
    }
  }

  start();

  keepAlive = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
      ws.send(JSON.stringify({ ping: true }));
    }
  }, 25000);

  ws.on('close', () => {
    console.log(`🔌 انقطع اتصال المتصفح بـ ${username}`);
    if (keepAlive) clearInterval(keepAlive);
    if (tiktokLive) { try { tiktokLive.disconnect(); } catch (e) {} }
  });
});
