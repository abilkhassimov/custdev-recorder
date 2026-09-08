/* ══════════════════════════════════════════════════════════════
   E-AUDITOR · полевой диктофон кастдева
   Приложение-суфлёр: один экран с именем собеседника, запись всего
   разговора в фоне, вопросы блоками как подсказка. По завершении
   аудио целиком уходит в папку кастдева на Google Drive. Ввод текста
   в интервью нет: только имя в начале и живая запись. Разбор с
   вердиктом собирается уже на сервере, вне этого приложения.

   Надёжность: запись копится в памяти И параллельно пишется в IndexedDB
   посекундными кусками. Если вкладку убьёт система или закрыть до заливки,
   при следующем открытии приложение предложит отправить недозаписанное.
   Плюс экран удерживается от гашения через Wake Lock,
   пока идёт запись. Уход со страницы во время записи и заливки
   перехватывается предупреждением.
   ══════════════════════════════════════════════════════════════ */

/* ── вступление: говорим вслух, не читаем с экрана дословно ──── */
const INTRO =
  'Спасибо за полчаса. Я ничего не продаю и презентацию не показываю. ' +
  'Наш разговор я записываю на диктофон, чтобы потом не по памяти восстанавливать, вы не против? ' +
  'Хочу понять, как вы держите руку на пульсе компании: какие цифры смотрите ' +
  'и где их берёте, когда сотрудников уже не десять.';

/* ── блоки вопросов: пять блоков, показываем блок целиком ── */
const BLOCKS = [
  {
    t: 'Компания и роль',
    q: [
      'Расскажите про компанию: чем занимаетесь, что продаёте, сколько лет на рынке?',
      'Сколько сейчас человек в команде и как выросли за последние пару лет?',
      'За что отвечаете лично, а что уже отдали людям и смотрите со стороны?',
      'Что из ежедневной работы компании вы перестали видеть сами, когда стало больше людей?'
    ]
  },
  {
    t: 'Как держите руку на пульсе',
    q: [
      'Когда утром хотите понять, как идут дела, куда смотрите первым делом и какие две-три цифры ищете?',
      'Как эти цифры до вас доходят: отчёт от финдира, 1С, свой Excel, звонок бухгалтеру, на глаз? И как часто?',
      'Выручка, себестоимость, маржа: что видите живьём в любой день, а что узнаёте раз в месяц из отчёта?',
      'Какой цифры или картины про компанию у вас сейчас нет под рукой, а хотелось бы видеть в любой момент?'
    ]
  },
  {
    t: 'Долги, закупки, налоги',
    q: [
      'Дебиторка и кредиторка: как сейчас видите, кто вам должен и кому должны вы, где эта картина живёт и когда последний раз она вас подвела?',
      'Закупки и запасы: как отслеживаете, что и почём закупается, у кого это в голове или в системе, случалось ли переплатить или закупить лишнее?',
      'Налоги и обязательные платежи: как узнаёте, что подходит срок, было ли, что чуть не пропустили или попали на пени, хотелось бы предупреждение заранее?',
      'Выручка и прибыль по компании в целом: где смотрите итог и с какой задержкой он до вас доходит? Если не в фокусе, можно пропустить.'
    ]
  },
  {
    t: 'Где узнали поздно',
    q: [
      'Вспомните последний раз, когда важное узнали позже, чем стоило: просадка выручки, кассовый разрыв, лишняя трата, просроченный платёж. Что было?',
      'Как вы это узнали: случайно, кто-то сказал, сами наткнулись, или сработала процедура?',
      'Во сколько это обошлось и сколько времени ушло, чтобы распутать?',
      'Что после этого поменяли, чтобы увидеть раньше, сработало? И сколько раз за год такое всплывало?'
    ]
  },
  {
    t: 'Ценность и контакты',
    q: [
      'Если бы завтра в телефоне была одна страница про компанию, какие пять цифр или списков вы бы на неё поставили?',
      'Кто и за сколько сейчас собирает вам эту картину: финдир, бухгалтерия, вы сами по вечерам? Во сколько в год обходится?',
      'За последние два года покупали что-то ради порядка в цифрах: ERP, доработку 1С, BI, аудит, консультантов? Что и почём?',
      'Кого из знакомых собственников стоит спросить про то же самое?'
    ]
  }
];

const MARK =
  '<svg class="mark" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<rect x="1.5" y="1.5" width="23" height="23" rx="2.5" stroke="var(--brass)" stroke-width="2"/>' +
  '<rect x="8" y="8" width="10" height="10" rx="1.5" fill="var(--jade)"/></svg>';

/* ── мелочи ─────────────────────────────────────────────────── */
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2600);
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function stamp(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    ' ' + pad2(d.getHours()) + '-' + pad2(d.getMinutes()) + '-' + pad2(d.getSeconds());
}

/* fetch с таймаутом: висящую заливку обрываем, а не ждём вечно */
async function fetchT(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, Object.assign({}, opts, { signal: ctrl.signal }));
  } finally {
    clearTimeout(t);
  }
}

/* ── состояние одной сессии ─────────────────────────────────── */
const state = {
  name: '',
  block: 0,
  rec: null,
  stream: null,
  chunks: [],
  mime: '',
  blob: null,
  t0: 0,
  uid: '',          // случайный ключ записи: по нему сервер точно опознаёт файл в Drive
  uploadTried: false, // была ли уже попытка заливки (тогда перед повтором сперва проверяем Drive)
  tick: null,
  wake: null,
  busy: false,      // защита от двойного клика на старт/стоп
  stopped: false,   // onStopped отработал ровно один раз
  guarding: false,  // висит ли перехват ухода со страницы
  wakeReq: false,   // запрос wake lock в полёте, чтобы не плодить гонку
  idbChain: null,   // последовательная очередь записи кусков в IndexedDB
  idbOk: true       // удаётся ли писать резерв в устройство (false = только память)
};

// Случайный hex-ключ одной записи. Кладётся в appProperties файла на Drive,
// чтобы проверка «долетел ли файл» шла по точному id, а не по неуникальному имени.
function makeUid() {
  try {
    const a = new Uint8Array(16);
    (crypto || window.crypto).getRandomValues(a);
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return (Date.now().toString(16) + Math.random().toString(16).slice(2)).slice(0, 32).padEnd(32, '0');
  }
}

/* ── стойкое хранилище кусков: страховка от убитой вкладки ──────
   Каждый посекундный кусок падает не только в память, но и в IndexedDB.
   Если вкладку прибьёт система или заливку оборвёт, при следующем
   открытии предложим отправить недозаписанное.
   Память остаётся быстрым путём, IDB страховкой. */
const IDB_NAME = 'custdev-rec';
let idbDb = null;
function idbOpen() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no idb')); return; }
    const rq = indexedDB.open(IDB_NAME, 1);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks', { autoIncrement: true });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error || new Error('idb open'));
  });
}
async function idbHandle() { if (idbDb) return idbDb; idbDb = await idbOpen(); return idbDb; }
function idbRun(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    fn(tx.objectStore(store));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('idb abort'));
  });
}
function idbGet(db, store, key) {
  return new Promise((resolve, reject) => {
    const rq = db.transaction(store, 'readonly').objectStore(store).get(key);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
function idbGetAll(db, store) {
  return new Promise((resolve, reject) => {
    const rq = db.transaction(store, 'readonly').objectStore(store).getAll();
    rq.onsuccess = () => resolve(rq.result || []);
    rq.onerror = () => reject(rq.error);
  });
}
// Старт новой записи: чистим прошлое и кладём метаданные ОДНОЙ транзакцией на оба
// стора, иначе частичный сбой смешает куски и мету. Возвращаем true/false —
// удался ли резерв. Промис, на который встаёт очередь записи кусков.
async function idbReset(meta) {
  try {
    const db = await idbHandle();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['chunks', 'meta'], 'readwrite');
      tx.objectStore('chunks').clear();
      tx.objectStore('meta').put(meta, 'cur');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('idb abort'));
    });
    return true;
  } catch (e) { return false; }   // без IDB просто нет страховки, память работает
}
function idbAddChunk(blob) {
  // Резерв отвалился (или сброс прошлой сессии не удался): больше не пишем в IDB,
  // иначе новые куски лягут поверх непочищенных старых и восстановление смешает две записи.
  if (state.idbOk === false) return state.idbChain || Promise.resolve();
  state.idbChain = (state.idbChain || Promise.resolve()).then(async () => {
    try { const db = await idbHandle(); await idbRun(db, 'chunks', 'readwrite', st => st.add(blob)); }
    catch (e) {
      // Кусок не лёг в резерв (например, кончилась квота). Больше не обещаем
      // восстановление и предупреждаем один раз, при первом же сбое.
      if (state.idbOk !== false) { state.idbOk = false; toast('Резерв в устройстве отвалился, держите вкладку открытой'); }
    }
  });
  return state.idbChain;
}
// Помечаем сессию как успешно залитую ДО удаления резерва. Если чистка потом
// сорвётся, следующий запуск увидит флаг и не предложит залить дубль.
async function idbMarkDone() {
  const db = await idbHandle();
  const meta = await idbGet(db, 'meta', 'cur');
  if (!meta) return;
  meta.done = true;
  await idbRun(db, 'meta', 'readwrite', st => st.put(meta, 'cur'));
}
async function idbClear() {
  try {
    const db = await idbHandle();
    await idbRun(db, 'chunks', 'readwrite', st => st.clear());
    await idbRun(db, 'meta', 'readwrite', st => st.clear());
    return true;
  } catch (e) { return false; }
}
async function idbLoad() {
  try {
    const db = await idbHandle();
    const meta = await idbGet(db, 'meta', 'cur');
    if (!meta || meta.done) return null;   // done = уже залито, дубль не предлагаем
    const blobs = await idbGetAll(db, 'chunks');
    if (!blobs.length) return null;
    return { meta: meta, blobs: blobs };
  } catch (e) { return null; }
}

/* ── спросить сервер, лёг ли файл в Drive ──────────────────────
   Последняя проверка перед тем, как признать провал. Клиентский PUT идёт
   напрямую в Google, и ответ может потеряться, когда байты уже закоммичены;
   финализированная сессия на повторный опрос порой отвечает 4xx. Сервер
   смотрит саму папку по имени и метке приложения — это честный ответ. */
async function verifyUploaded(uid, name, size) {
  try {
    const r = await fetchT('/api/verify-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, name, size })
    }, 20000);
    if (!r.ok) return false;
    const j = await r.json();
    return !!(j && j.found);
  } catch (e) { return false; }
}

/* уход со страницы во время записи или заливки грозит потерей куска */
function unloadGuard(e) { e.preventDefault(); e.returnValue = ''; return ''; }
function setGuard(on) {
  if (on && !state.guarding) { window.addEventListener('beforeunload', unloadGuard); state.guarding = true; }
  else if (!on && state.guarding) { window.removeEventListener('beforeunload', unloadGuard); state.guarding = false; }
}

/* всё, что надо погасить при остановке. Идемпотентно: зовём с любого пути */
function cleanup() {
  if (state.tick) { clearInterval(state.tick); state.tick = null; }
  releaseWake();
  document.removeEventListener('visibilitychange', onVisible);
  stopStream();
}

/* ══════════════════════════════════════════════════════════════
   Экран 1. Имя собеседника.
   ══════════════════════════════════════════════════════════════ */
function renderName() {
  app.innerHTML =
    '<header class="top">' + MARK +
      '<div class="topt"><b>Полевой диктофон кастдева</b><span>Custodo · проблемное интервью</span></div>' +
    '</header>' +
    '<main><div class="pad">' +
      '<p class="lead">Запишем весь разговор целиком. Вопросы на экране это подсказка, чтобы не сбиться. Печатать ничего не нужно.</p>' +
      '<label class="field"><span>С кем говорим</span>' +
        '<input type="text" id="nm" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Имя собеседника" value="' + esc(state.name) + '">' +
      '</label>' +
      '<p class="foot">Имя станет названием записи в Google Drive. Запись начнётся сразу после нажатия. Экран не будет гаснуть, пока идёт запись, а куски параллельно сохраняются в устройстве на случай сбоя. Не переключайтесь в другие приложения. Скажите собеседнику вслух, что идёт запись, первый экран об этом напомнит.</p>' +
    '</div></main>' +
    '<div class="bar"><button class="primary wide" id="go" disabled>Начать разговор</button></div>';

  const nm = document.getElementById('nm');
  const go = document.getElementById('go');
  const sync = () => { state.name = nm.value.trim(); go.disabled = !state.name; };
  nm.addEventListener('input', sync);
  nm.addEventListener('keydown', e => { if (e.key === 'Enter' && state.name) begin(); });
  go.addEventListener('click', () => { if (state.name) begin(); });
  sync();
  setTimeout(() => nm.focus(), 60);
}

/* ══════════════════════════════════════════════════════════════
   Запись.
   ══════════════════════════════════════════════════════════════ */
function pickMime() {
  const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'];
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  for (const c of cands) { if (MediaRecorder.isTypeSupported(c)) return c; }
  return '';
}

async function begin() {
  if (state.busy) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
    toast('Этот браузер не умеет запись звука'); return;
  }
  state.busy = true;
  // просим у браузера не вытеснять наше хранилище (лучший эффорт, тихо)
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    state.busy = false;
    toast(e && e.name === 'NotAllowedError' ? 'Нужен доступ к микрофону' : 'Микрофон недоступен');
    return;
  }
  state.mime = pickMime();
  state.chunks = [];
  state.stopped = false;
  try {
    const opts = { audioBitsPerSecond: 32000 };
    if (state.mime) opts.mimeType = state.mime;
    state.rec = new MediaRecorder(state.stream, opts);
    if (state.rec.mimeType) state.mime = state.rec.mimeType;   // реальный тип от рекордера
    state.rec.ondataavailable = e => {
      if (e.data && e.data.size) { state.chunks.push(e.data); idbAddChunk(e.data); }
    };
    state.rec.onstop = onStopped;
    state.rec.onerror = () => {
      // Ошибка рекордера может оборвать запись. Не врём «продолжаем»: останавливаем,
      // и финализация идёт штатно через onstop, чтобы не потерять последний кусок.
      toast('Сбой записи, сохраняю накопленное');
      try { if (state.rec && state.rec.state === 'recording') { state.rec.stop(); return; } } catch (err) {}
      onStopped();   // если стоп не запустить — финализируем напрямую, идемпотентно
    };
    state.t0 = Date.now();
    state.uid = makeUid();
    state.uploadTried = false;
    // Заводим IDB-страховку ДО старта: очередь записи кусков встаёт на этот промис,
    // поэтому очистка прошлой сессии гарантированно раньше первого нового куска.
    state.idbChain = idbReset({ name: state.name, mime: state.mime, t0: state.t0, uid: state.uid });
    state.idbChain.then(ok => { state.idbOk = ok; if (ok === false) toast('Резерв в устройстве недоступен, держите вкладку открытой'); });
    state.rec.start(1000);   // режем на секундные куски, чтобы поток отдавал данные по ходу
  } catch (e) {
    cleanup(); state.rec = null; state.busy = false;
    toast('Запись не запустилась'); return;
  }
  state.block = 0;
  state.busy = false;
  setGuard(true);
  requestWake();
  document.addEventListener('visibilitychange', onVisible);
  renderLive();
  startTick();
}

async function requestWake() {
  // Уже держим lock или запрос в полёте — второй не плодим (иначе первый течёт).
  if (state.wake || state.wakeReq || !('wakeLock' in navigator)) return;
  state.wakeReq = true;
  try {
    const w = await navigator.wakeLock.request('screen');
    // Запрос мог разрешиться уже после остановки записи: тогда сразу отпускаем,
    // чтобы не держать экран включённым зря.
    if (!state.rec || state.rec.state !== 'recording') { try { w.release(); } catch (e) {} return; }
    state.wake = w;
    // Система сама снимает lock при уходе вкладки в фон: сбрасываем ссылку,
    // чтобы onVisible смог запросить новый при возврате.
    w.addEventListener('release', () => { if (state.wake === w) state.wake = null; });
  } catch (e) { /* не критично: запись живёт и без wake lock */ }
  finally { state.wakeReq = false; }
}
function onVisible() {
  if (document.visibilityState === 'visible' && state.rec && state.rec.state === 'recording'
      && !state.wake && !state.wakeReq) requestWake();
}
function startTick() {
  const paint = () => {
    const el = document.getElementById('rectime');
    if (!el) return;
    const s = Math.max(0, Math.floor((Date.now() - state.t0) / 1000));
    el.textContent = pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
  };
  paint();
  state.tick = setInterval(paint, 1000);
}

function stopStream() {
  if (state.stream) { try { state.stream.getTracks().forEach(t => t.stop()); } catch (e) {} state.stream = null; }
}
function releaseWake() {
  if (state.wake) { try { state.wake.release(); } catch (e) {} state.wake = null; }
}

/* ══════════════════════════════════════════════════════════════
   Экран 2. Суфлёр по блокам.
   ══════════════════════════════════════════════════════════════ */
function renderLive() {
  const b = BLOCKS[state.block];
  const last = state.block === BLOCKS.length - 1;

  const dots = BLOCKS.map((_, i) =>
    '<div class="dot ' + (i < state.block ? 'done' : i === state.block ? 'cur' : '') + '"></div>').join('');

  const qs = b.q.map(q => '<li>' + esc(q) + '</li>').join('');

  const intro = state.block === 0
    ? '<div class="script"><b>Сказать вслух</b>' + esc(INTRO) + '</div>'
    : '';

  app.innerHTML =
    '<header class="top">' + MARK +
      '<div class="topt"><b>' + esc(state.name) + '</b><span>идёт запись</span></div>' +
      '<div class="reclive"><span class="reclamp"></span><span class="rectime" id="rectime">00:00</span></div>' +
      '<button class="endbtn" id="end">Стоп</button>' +
    '</header>' +
    '<main><div class="pad">' +
      '<div class="dots">' + dots + '</div>' +
      '<div class="blocktitle">' + esc(b.t) + '</div>' +
      '<div class="blockidx">Блок ' + (state.block + 1) + ' из ' + BLOCKS.length + '</div>' +
      intro +
      '<ol class="qlist">' + qs + '</ol>' +
    '</div></main>' +
    '<div class="bar">' +
      '<button class="ghost" id="back"' + (state.block === 0 ? ' disabled' : '') + '>Назад</button>' +
      '<button class="primary" id="next">' + (last ? 'Завершить разговор' : 'Дальше') + '</button>' +
    '</div>';

  document.getElementById('end').addEventListener('click', endConversation);
  document.getElementById('back').addEventListener('click', () => {
    if (state.block > 0) { state.block--; renderLive(); }
  });
  document.getElementById('next').addEventListener('click', () => {
    if (last) { endConversation(); return; }
    state.block++; renderLive();
  });
}

/* ══════════════════════════════════════════════════════════════
   Завершение и заливка.
   ══════════════════════════════════════════════════════════════ */
function endConversation() {
  if (state.busy || state.stopped) return;
  state.busy = true;
  try {
    if (state.rec && state.rec.state !== 'inactive') { state.rec.stop(); return; }   // дальше onStopped
  } catch (e) {}
  onStopped();
}

function onStopped() {
  if (state.stopped) return;   // ровно один раз, с любого пути остановки
  state.stopped = true;
  cleanup();
  const type = state.mime || 'audio/webm';
  state.blob = new Blob(state.chunks, { type });
  state.busy = false;
  if (!state.blob || state.blob.size < 1024) {
    setGuard(false);
    idbClear();   // пустышку в резерве не держим, иначе следующий запуск её предложит
    renderDone(false, 'Запись пустая: звук не записался. Проверьте доступ к микрофону.', null);
    return;
  }
  renderUploading();
  uploadBlob(state.blob);
}

function ext() {
  const m = (state.mime || '').toLowerCase();
  if (m.indexOf('mp4') >= 0) return 'm4a';
  if (m.indexOf('mpeg') >= 0) return 'mp3';
  if (m.indexOf('ogg') >= 0) return 'ogg';
  return 'webm';
}
function baseMime() {
  return (state.mime || 'audio/webm').split(';')[0].trim() || 'audio/webm';
}

// Спрашиваем у resumable-сессии, сколько байт она уже приняла.
// 200/201 -> файл целиком закоммичен; 308 -> сколько дошло (заголовок Range);
// иначе -> сессия непригодна. Пустой PUT с "Content-Range: bytes */total".
async function probeSession(url, total) {
  const r = await fetchT(url, {
    method: 'PUT',
    headers: { 'Content-Range': 'bytes */' + total }
  }, 30000);
  if (r.status === 200 || r.status === 201) return { done: true };
  if (r.status === 308) {
    // Google отдаёт Range по CORS. Если вдруг скрыт — offset 0 означает полный
    // повторный PUT bytes 0..N-1/N, который сессия штатно принимает и финализирует.
    let offset = 0;
    const range = r.headers.get('range');   // "bytes=0-N"
    if (range) { const m = range.match(/-(\d+)\s*$/); if (m) offset = parseInt(m[1], 10) + 1; }
    return { done: offset >= total, offset: offset };
  }
  return { fatal: true };
}

// Дозаливаем хвост с известного смещения.
async function resumeFrom(url, blob, offset) {
  const total = blob.size;
  const r = await fetchT(url, {
    method: 'PUT',
    headers: { 'Content-Range': 'bytes ' + offset + '-' + (total - 1) + '/' + total },
    body: blob.slice(offset)
  }, 15 * 60 * 1000);
  return r.status === 200 || r.status === 201;   // коммит только по 200/201
}

// Первый PUT упал или ответ потерялся. Прежде чем кричать об ошибке — выясняем
// у Google, дошёл ли файл. Часто он уже в Drive, а до нас не долетел лишь ответ.
async function verifyOrResume(url, blob) {
  const total = blob.size;
  for (let attempt = 0; attempt < 2; attempt++) {
    let st;
    try { st = await probeSession(url, total); }
    catch (e) { return false; }        // сессию не достучаться -> реальный обрыв
    if (st.fatal) return false;
    if (st.done) return true;          // всё принято, коммит подтверждён
    try { if (await resumeFrom(url, blob, st.offset || 0)) return true; }
    catch (e) { /* повторим probe на следующем витке */ }
  }
  try { const st = await probeSession(url, total); return !!st.done; }
  catch (e) { return false; }
}

// Успешная заливка: сперва дождаться недописанных кусков и стереть резерв в
// устройстве, и только потом рапортовать успех и снимать защиту от закрытия.
// Иначе быстрое закрытие оставит копию и вызовет ложное восстановление и дубль.
async function finishOk(finalName) {
  try { await state.idbChain; } catch (e) {}
  // Сначала штампуем «залито» (пережмёт ложное восстановление, даже если стереть
  // не выйдет), затем чистим резерв. Успех рапортуем независимо от исхода чистки.
  try { await idbMarkDone(); } catch (e) {}
  try { await idbClear(); } catch (e) {}
  setGuard(false);
  renderDone(true, finalName, null);
}

async function uploadBlob(blob) {
  const name = 'Кастдев. ' + state.name + '. ' + stamp(state.t0 || Date.now()) + '.' + ext();
  const mime = baseMime();
  setGuard(true);   // держим предупреждение до самого конца заливки
  // Повтор после прошлой попытки: сперва спросим Drive по uid, не лёг ли файл уже.
  // Иначе новая сессия зальёт дубль, если предыдущий PUT на деле закоммитился.
  if (state.uploadTried && state.uid && await verifyUploaded(state.uid, name, blob.size)) {
    await finishOk(name);
    return;
  }
  state.uploadTried = true;
  let uploadUrl = null;
  let finalName = name;
  try {
    const sr = await fetchT('/api/upload-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mime, size: blob.size, uid: state.uid })
    }, 20000);
    if (!sr.ok) throw new Error('session ' + sr.status);
    const sj = await sr.json();
    if (!sj.uploadUrl) throw new Error('no url');
    uploadUrl = sj.uploadUrl;
    if (sj.name && typeof sj.name === 'string') finalName = sj.name;   // серверное имя главнее

    const pr = await fetchT(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mime },
      body: blob
    }, 15 * 60 * 1000);   // до 15 минут на большой файл
    // Коммит только по 200/201. Любой иной ответ (в т.ч. неожиданный 2xx) —
    // не верим на слово, идём переспрашивать сессию.
    if (pr.status === 200 || pr.status === 201) {
      await finishOk(finalName);
      return;
    }
    throw new Error('put ' + pr.status);
  } catch (e) {
    // PUT оборвался или ответ потерялся. Если сессию успели создать —
    // спросим Google, дошёл ли файл, и при нужде дольём хвост, а не пугаем зря.
    if (uploadUrl) {
      try {
        if (await verifyOrResume(uploadUrl, blob)) {
          await finishOk(finalName);
          return;
        }
      } catch (e2) { console.warn('verify', e2 && e2.message || e2); }
    }
    // Последний арбитр: спросим сервер по uid, не лёг ли файл в Drive несмотря на
    // потерянный ответ. Часто он уже там, а мы зря собрались пугать ошибкой.
    if (await verifyUploaded(state.uid, finalName, blob.size)) {
      await finishOk(finalName);
      return;
    }
    console.warn('upload', e && e.message || e);
    // Блоб цел, даём повторить, страницу закрывать всё ещё нельзя.
    renderDone(false, 'Не удалось загрузить запись. Проверьте связь и попробуйте ещё раз.', blob);
  }
}

/* ── экраны заливки / итога ─────────────────────────────────── */
function renderUploading() {
  app.innerHTML =
    '<header class="top">' + MARK +
      '<div class="topt"><b>' + esc(state.name) + '</b><span>загрузка записи</span></div>' +
    '</header>' +
    '<main><div class="pad">' +
      '<p class="lead">Отправляю запись в Google Drive. Не закрывайте страницу.</p>' +
    '</div></main>' +
    '<div class="bar"><button class="primary wide" disabled>' +
      '<span class="uploading"><span class="spin"></span>Загрузка</span></button></div>';
}

function renderDone(ok, msg, retryBlob) {
  // Успех уже прошёл через finishOk (там ждём очередь и чистим резерв), тут только UI.
  const cls = ok ? 'donewrap' : 'donewrap doneerr';
  const head = ok ? 'Запись загружена' : 'Не отправилось';
  // Честно про сохранность: если резерв в устройстве отвалился, запись держится
  // только в памяти этой вкладки, и закрывать её нельзя.
  const safe = state.idbOk === false
    ? ' Запись держится в этой вкладке, не закрывайте её. Нажмите «Повторить», чтобы отправить снова.'
    : ' Запись цела в устройстве. Нажмите «Повторить», чтобы отправить снова.';
  const body = ok
    ? 'Файл «' + esc(msg) + '» лежит в папке кастдева. Разбор с вердиктом придёт следом.'
    : esc(msg) + safe;

  let bar;
  if (ok) {
    bar = '<button class="primary wide" id="again">Новый разговор</button>';
  } else if (retryBlob) {
    bar = '<button class="ghost" id="again">Заново</button>' +
          '<button class="primary" id="retry">Повторить</button>';
  } else {
    bar = '<button class="primary wide" id="again">Новый разговор</button>';
  }

  app.innerHTML =
    '<header class="top">' + MARK +
      '<div class="topt"><b>' + esc(state.name) + '</b><span>' + (ok ? 'готово' : 'ошибка') + '</span></div>' +
    '</header>' +
    '<main><div class="pad">' +
      '<div class="' + cls + '"><div class="donemark"></div>' +
        '<div class="doneh">' + head + '</div>' +
        '<div class="donep">' + body + '</div>' +
      '</div>' +
    '</div></main>' +
    '<div class="bar">' + bar + '</div>';

  const again = document.getElementById('again');
  if (again) again.addEventListener('click', () => {
    // «Заново» на экране ошибки выбрасывает единственную копию — переспросим.
    if (!ok && retryBlob && !confirm('Удалить эту запись и начать заново? Она нигде не сохранится.')) return;
    setGuard(false); reset();
  });
  const retry = document.getElementById('retry');
  if (retry && retryBlob) retry.addEventListener('click', () => { renderUploading(); uploadBlob(retryBlob); });
}

async function reset() {
  setGuard(false);
  await idbClear();    // ДОЖДАТЬСЯ стирания резерва: иначе отложенная чистка может
                       // снести уже начатую следующую запись (её мету/куски)
  state.name = '';
  state.block = 0;
  state.rec = null;
  state.chunks = [];
  state.mime = '';
  state.blob = null;
  state.t0 = 0;
  state.uid = '';
  state.uploadTried = false;
  state.busy = false;
  state.stopped = false;
  state.idbChain = null;
  state.idbOk = true;
  renderName();
}

/* ══════════════════════════════════════════════════════════════
   Восстановление: нашлась незагруженная запись прошлой сессии.
   ══════════════════════════════════════════════════════════════ */
function renderRecover(rec) {
  const mime = (rec.meta && rec.meta.mime) || 'audio/webm';
  const name = (rec.meta && rec.meta.name) || 'без имени';
  const blob = new Blob(rec.blobs, { type: mime });
  const mb = blob.size / (1024 * 1024);
  const sizeStr = mb >= 1 ? mb.toFixed(1) + ' МБ' : Math.max(1, Math.round(blob.size / 1024)) + ' КБ';
  state.name = name;
  state.mime = mime;
  // Имя файла при заливке считается от t0 — берём исходное время записи, а не «сейчас».
  state.t0 = (rec.meta && rec.meta.t0) || Date.now();
  // uid прошлой записи (если был): по нему сервер точно опознает файл при заливке и проверке.
  state.uid = (rec.meta && rec.meta.uid) || '';
  // Восстановленную запись считаем «уже пытались залить»: она могла закоммититься
  // до гибели вкладки. Поэтому перед новой заливкой uploadBlob сперва спросит Drive
  // по uid и не создаст дубль, если файл там уже есть.
  state.uploadTried = true;

  app.innerHTML =
    '<header class="top">' + MARK +
      '<div class="topt"><b>' + esc(name) + '</b><span>незагруженная запись</span></div>' +
    '</header>' +
    '<main><div class="pad">' +
      '<div class="donewrap"><div class="donemark"></div>' +
        '<div class="doneh">Нашлась незагруженная запись</div>' +
        '<div class="donep">Разговор с «' + esc(name) + '» сохранён в этом устройстве (' + sizeStr +
          '), но не отправился. Можно отправить его сейчас.</div>' +
      '</div>' +
    '</div></main>' +
    '<div class="bar">' +
      '<button class="ghost" id="rdel">Удалить</button>' +
      '<button class="primary" id="rsend">Отправить</button>' +
    '</div>';

  document.getElementById('rsend').addEventListener('click', () => { renderUploading(); uploadBlob(blob); });
  document.getElementById('rdel').addEventListener('click', async () => {
    if (!confirm('Удалить незавершённую запись без отправки?')) return;
    const cleared = await idbClear();
    if (!cleared) { toast('Не удалось стереть запись из устройства'); return; }
    reset();
  });
}

/* ── старт ──────────────────────────────────────────────────── */
// Восстановление в приоритете: сначала смотрим, нет ли недозалитой записи,
// и только если её нет — показываем обычный экран имени. Иначе экран имени
// мигнёт и перескочит на восстановление (гонка рендеров).
(async () => {
  let rec = null;
  try { rec = await idbLoad(); } catch (e) {}
  if (rec) renderRecover(rec);
  else renderName();
})();
