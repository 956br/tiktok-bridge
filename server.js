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

  // 👇 غيّر "ضع_مفتاحك_هنا" بمفتاحك الحقيقي من EulerStream
  const tiktokLive = new TikTokLiveConnection(username, {
    signApiKey: 'euler_NmRmYTIyZmM0MTVkOTllYmQ0MDczMTI1ZDE1NmUwNmQ3ZmY3NjhjODcwZjMzOTFkNzgwZTk0',
    connectWithUniqueId: true,      // يخلي EulerStream يجيب Room ID بدل سيرفرنا
    disableEulerFallbacks: false
  });

  console.log(`🔌 محاولة اتصال جديدة بحساب: ${username}`);

  tiktokLive.connect()
    .then(() => {
      console.log(`✅ نجح الاتصال بـ ${username}`);
      ws.send(JSON.stringify({ status: `✅ متصل بحساب ${username}` }));
    })
    .catch(err => {
      console.log('❌ فشل الاتصال - التفاصيل الكاملة:');
      console.log('  الرسالة:', err?.message);
      console.log('  النوع:', err?.constructor?.name);
      console.log('  الكامل:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      ws.send(JSON.stringify({ error: `❌ ما قدرت أتصل بـ ${username}: ${err.message}` }));
    });

  tiktokLive.on(WebcastEvent.CHAT, data => {
    // حقول الإصدار 2.x الصحيحة
    ws.send(JSON.stringify({ user: data?.user?.nickname, comment: data?.content }));
  });

  // نبضة كل 25 ثانية تمنع قطع الاتصال بسبب الخمول
  const keepAlive = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
      ws.send(JSON.stringify({ ping: true }));
    }
  }, 25000);

  ws.on('close', () => {
    console.log(`🔌 انقطع اتصال ${username}`);
    clearInterval(keepAlive);
    tiktokLive.disconnect();
  });

  tiktokLive.on('disconnected', () => {
    console.log(`⚠️ تيك توك قطع الاتصال بـ ${username}`);
  });
});
