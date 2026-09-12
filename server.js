import { TikTokLiveConnection, WebcastEvent, RouteConfig } from 'tiktok-live-connector';
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });

// 👇 غيّر "ضع_مفتاحك_هنا" بمفتاحك الحقيقي من EulerStream
const API_KEY = 'euler_NmRmYTIyZmM0MTVkOTllYmQ0MDczMTI1ZDE1NmUwNmQ3ZmY3NjhjODcwZjMzOTFkNzgwZTk0';

// يحوّل الرد إلى نص ويلتقط أول سلسلة أرقام طويلة (رقم الغرفة)
function extractRoomId(result) {
  let text = '';

  // نجرب المفاتيح المباشرة أول
  const direct = result?.roomId ?? result?.room_id
    ?? result?.data?.roomId ?? result?.data?.room_id;
  if (direct != null && /^\d{10,}$/.test(String(direct))) {
    return String(direct);
  }

  // ثم نحوّل كل شي لنص ونبحث بالتعبير النمطي
  try {
    const seen = new WeakSet();
    text = JSON.stringify(result, (k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return undefined;
        seen.add(v);
      }
      return typeof v === 'bigint' ? String(v) : v;
    });
  } catch (e) {
    text = String(result);
  }

  const match = text && text.match(/\b\d{15,22}\b/);
  return match ? match[0] : null;
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

      try {
        const seen = new WeakSet();
        const dump = JSON.stringify(result, (k, v) => {
          if (typeof v === 'object' && v !== null) {
            if (seen.has(v)) return undefined;
            seen.add(v);
          }
          return typeof v === 'bigint' ? String(v) : v;
        });
        console.log('📦 شكل الرد:', String(dump).slice(0, 800));
      } catch (e) {
        console.log('📦 شكل الرد (نص):', String(result).slice(0, 800));
        console.log('📦 المفاتيح:', Object.keys(result || {}).join(', '));
      }

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
