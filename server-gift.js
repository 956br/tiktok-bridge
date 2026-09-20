import { TikTokLive } from '@tiktool/live';
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: process.env.PORT || 4000 });

// 👇 حط مفتاحك المجاني من tik.tools هنا (بدون بطاقة بنكية): https://tik.tools
const API_KEY = 'tk_5cd1098171a4216399d345c6afaf2c7dd7b9d362de71bee3';

console.log('🚀 السيرفر شغال على المنفذ 4000 — بانتظار الاتصال');

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const username = url.searchParams.get('user');

  if (!username) {
    ws.send(JSON.stringify({ error: 'لازم تحدد اسم الحساب' }));
    ws.close();
    return;
  }

  let live = null;
  let keepAlive = null;

  async function start() {
    live = new TikTokLive({
      uniqueId: username,
      apiKey: API_KEY
    });

    live.on('chat', e => {
      console.log('👤 بيانات المستخدم الخام:', JSON.stringify(e.user));

      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'chat',
          user: e.user?.nickname,
          comment: e.comment,
          avatar: e.user?.avatarLargeUrl || e.user?.profilePicture || e.user?.profilePictureUrl
        }));
      }
    });

    live.on('gift', e => {
      if (ws.readyState !== ws.OPEN) return;

      // الهدايا المتتالية (كومبو) ترسل حدث لكل مرة يضغط فيها المستخدم
      // ننتظر repeatEnd عشان ناخذ العدد النهائي بدل ما نحسبها ناقصة
      if (e.combo && !e.repeatEnd) return;

      ws.send(JSON.stringify({
        type: 'gift',
        user: e.user?.nickname,
        giftName: e.giftName,
        giftType: e.giftType,
        diamondCount: e.diamondCount,
        repeatCount: e.repeatCount,
        totalValue: e.diamondCount * e.repeatCount
      }));
    });

    live.on('roomInfo', info => {
      console.log(`✅ نجح الاتصال بـ ${username} — رقم الغرفة: ${info?.roomId}`);
    });

    live.on('connected', () => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ status: `✅ متصل بحساب ${username}` }));
      }
    });

    live.on('disconnected', (code, reason) => {
      console.log(`⚠️ تيك توك قطع الاتصال بـ ${username}: ${reason ?? code}`);
    });

    live.on('error', err => {
      console.log(`❌ خطأ بالاتصال (${username}):`, err?.message ?? err);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ error: `❌ خطأ: ${err?.message ?? err}` }));
      }
    });

    // ديباق: يطبع/يرسل أي نوع حدث توصل من تيك توك حتى لو ما لقينا له معالج
    // مفيد عشان نتأكد هل فعلاً توصل بيانات (شات/هدايا/دخول مشاهدين) أو لا شي يوصل أصلاً
    live.on('event', event => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'debug', event: event?.type }));
      }
    });

    try {
      console.log(`🔌 محاولة الاتصال بـ ${username} ...`);
      await live.connect();
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
    if (live) { try { live.disconnect(); } catch (e) {} }
  });
});
