import { TikTokLiveConnection, WebcastEvent, RouteConfig } from 'tiktok-live-connector';
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });

// 👇 غيّر "ضع_مفتاحك_هنا" بمفتاحك الحقيقي من EulerStream
const API_KEY = 'euler_NmRmYTIyZmM0MTVkOTllYmQ0MDczMTI1ZDE1NmUwNmQ3ZmY3NjhjODcwZjMzOTFkNzgwZTk0';

// يبحث داخل أي كائن عن رقم غرفة (سلسلة أرقام طويلة)
function extractRoomId(obj, depth = 0) {
  if (depth > 6 || obj == null) return null;

  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'bigint') {
    const s = String(obj);
    return /^\d{10,}$/.test(s) ? s : null;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = extractRoomId(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof obj === 'object') {
    // نجرب المفاتيح المتوقعة أول
    for (const key of ['roomId', 'room_id', 'roomID', 'id']) {
      if (obj[key] != null) {
        const found = extractRoomId(obj[key], depth + 1);
        if (found) return found;
      }
    }
    // ثم نبحث في كل المفاتيح
    for (const key of Object.keys(obj)) {
      const found = extractRoomId(obj[key], depth + 1);
      if (found) return found;
    }
  }

  return null;
}

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
      fetchRoomInfoOnConnect: false
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
      console.log(`🔎 جلب رقم الغرفة لـ ${username} من EulerStream...`);
      const result = await RouteConfig.fetchRoomIdFromProvider({
        apiClient: tiktokLive.apiClient,
        webClient: tiktokLive.webClient,
        uniqueId: username
      });

      console.log('📦 شكل الرد:', JSON.stringify(result).slice(0, 500));

      const roomId = extractRoomId(result);
      if (!roomId) throw new Error('ما قدرت أستخرج رقم الغرفة من رد EulerStream');

      console.log(`✅ رقم الغرفة: ${roomId}`);

      await tiktokLive.connect(roomId);
      console.log(`✅ نجح الاتصال بـ ${username}`);
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
    if (tiktokLive) {
      try { tiktokLive.disconnect(); } catch (e) {}
    }
  });
});
