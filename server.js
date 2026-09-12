import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });

// 👇 غيّر "ضع_مفتاحك_هنا" بمفتاحك الحقيقي من EulerStream
const API_KEY = 'euler_NmRmYTIyZmM0MTVkOTllYmQ0MDczMTI1ZDE1NmUwNmQ3ZmY3NjhjODcwZjMzOTFkNzgwZTk0';

const MAX_TRIES = 5;        // عدد المحاولات قبل الاستسلام
const DELAY_MS = 4000;      // الانتظار بين كل محاولة

const wait = (ms) => new Promise(r => setTimeout(r, ms));

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const username = url.searchParams.get('user');

  if (!username) {
    ws.send(JSON.stringify({ error: 'لازم تحدد اسم الحساب' }));
    ws.close();
    return;
  }

  let tiktokLive = null;
  let closed = false;
  let keepAlive = null;

  async function tryConnect() {
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      if (closed) return;

      tiktokLive = new TikTokLiveConnection(username, {
        signApiKey: API_KEY,
        connectWithUniqueId: true,
        disableEulerFallbacks: false
      });

      tiktokLive.on(WebcastEvent.CHAT, data => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ user: data?.user?.nickname, comment: data?.content }));
        }
      });

      tiktokLive.on('disconnected', () => {
        console.log(`⚠️ تيك توك قطع الاتصال بـ ${username}`);
      });

      try {
        console.log(`🔌 محاولة ${attempt} من ${MAX_TRIES} للاتصال بـ ${username}`);
        await tiktokLive.connect();
        console.log(`✅ نجح الاتصال بـ ${username} من المحاولة ${attempt}`);
        ws.send(JSON.stringify({ status: `✅ متصل بحساب ${username}` }));
        return;
      } catch (err) {
        console.log(`❌ فشلت المحاولة ${attempt}: ${err?.message}`);
        try { tiktokLive.disconnect(); } catch (e) {}
        tiktokLive = null;

        if (attempt < MAX_TRIES) {
          ws.send(JSON.stringify({ status: `⏳ المحاولة ${attempt} فشلت، جاري إعادة المحاولة...` }));
          await wait(DELAY_MS);
        } else {
          ws.send(JSON.stringify({ error: `❌ ما قدرت أتصل بـ ${username} بعد ${MAX_TRIES} محاولات: ${err?.message}` }));
        }
      }
    }
  }

  tryConnect();

  // نبضة تمنع قطع الاتصال بسبب الخمول
  keepAlive = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
      ws.send(JSON.stringify({ ping: true }));
    }
  }, 25000);

  ws.on('close', () => {
    console.log(`🔌 انقطع اتصال المتصفح بـ ${username}`);
    closed = true;
    if (keepAlive) clearInterval(keepAlive);
    if (tiktokLive) {
      try { tiktokLive.disconnect(); } catch (e) {}
    }
  });
});
