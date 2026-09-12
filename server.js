import { TikTokLiveConnection, WebcastEvent, RouteConfig } from 'tiktok-live-connector';
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });

// 👇 غيّر "ضع_مفتاحك_هنا" بمفتاحك الحقيقي من EulerStream
const API_KEY = 'euler_NmRmYTIyZmM0MTVkOTllYmQ0MDczMTI1ZDE1NmUwNmQ3ZmY3NjhjODcwZjMzOTFkNzgwZTk0';

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
      signApiKey: API_KEY,
      fetchRoomInfoOnConnect: false   // نتفادى طلب معلومات الغرفة من تيك توك مباشرة
    });

    tiktokLive.on(WebcastEvent.CHAT, data => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ user: data?.user?.nickname, comment: data?.comment }));
      }
    });

    tiktokLive.on('disconnected', () => {
      console.log(`⚠️ تيك توك قطع الاتصال بـ ${username}`);
    });

    try {
      // الخطوة المفتاحية: نجيب رقم الغرفة من EulerStream مباشرة
      console.log(`🔎 جلب رقم الغرفة لـ ${username} من EulerStream...`);
      const result = await RouteConfig.fetchRoomIdFromProvider({
        apiClient: tiktokLive.apiClient,
        webClient: tiktokLive.webClient,
        uniqueId: username
      });

      const roomId = result?.roomId || result?.room_id || result?.data?.roomId || result;
      console.log(`✅ رقم الغرفة: ${roomId}`);

      // نمرر الرقم مباشرة فنتخطى البحث المحظور
      await tiktokLive.connect(String(roomId));
      console.log(`✅ نجح الاتصال بـ ${username}`);
      ws.send(JSON.stringify({ status: `✅ متصل بحساب ${username}` }));

    } catch (err) {
      console.log(`❌ فشل: ${err?.message}`);
      console.log('   التفاصيل:', JSON.stringify(err, Object.getOwnPropertyNames(err)).slice(0, 600));
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
    if (tiktokLive) {
      try { tiktokLive.disconnect(); } catch (e) {}
    }
  });
});
