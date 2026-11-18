(function () {
  var old = document.getElementById('ttPanel');
  if (old) { old.remove(); return; }

  var panel = document.createElement('div');
  panel.id = 'ttPanel';
  panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:250px;padding:14px;border-radius:14px;background:#111;color:#eee;font:13px/1.45 system-ui,sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.55)';
  panel.innerHTML = '<div style="font-weight:700;margin-bottom:8px">TikTok Unrepost</div>'
    + '<div id="ttS" style="opacity:.75;margin-bottom:10px">готов к работе</div>'
    + '<button id="ttGo" style="width:100%;padding:9px;margin-bottom:6px;border:0;border-radius:9px;background:#00c07f;color:#04241a;font-weight:700;cursor:pointer">Удалить все репосты</button>'
    + '<button id="ttStop" style="width:100%;padding:6px;border:0;border-radius:9px;background:#2a2a2a;color:#ddd;cursor:pointer">Стоп</button>'
    + '<button id="ttReload" style="width:100%;padding:7px;margin-top:6px;border:0;border-radius:9px;background:#1f6feb;color:#fff;cursor:pointer">Перезагрузить страницу</button>';
  document.body.appendChild(panel);

  var stop = false;

  function set(t) {
    var e = document.getElementById('ttS');
    if (e) e.textContent = t;
    console.log('[tt]', t);
  }

  function ck(n) {
    var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + n + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  function common() {
    var p = {
      aid: '1988', app_language: 'ru', app_name: 'tiktok_web',
      browser_language: navigator.language, browser_name: 'Mozilla',
      browser_platform: navigator.platform, browser_version: '5.0',
      channel: 'tiktok_web', cookie_enabled: 'true', device_platform: 'web_pc',
      focus_state: 'true', from_page: 'video', history_len: '3',
      is_fullscreen: 'false', is_page_visible: 'true', os: 'windows',
      priority_region: 'RU', referer: '', region: 'RU',
      screen_height: '' + screen.height, screen_width: '' + screen.width,
      tz_name: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    var ms = ck('msToken');
    if (ms) p.msToken = ms;
    return p;
  }

  function sign(url) {
    var ac = window.byted_acrawler;
    if (!ac || !ac.frontierSign) return null;
    var s = null;
    try { s = ac.frontierSign({ url: url }); } catch (e) { return null; }
    if (!s) return null;
    for (var k in s) url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(s[k]);
    return url;
  }

  function del(id) {
    var q = new URLSearchParams(common());
    q.set('item_id', id);
    var url = sign('https://www.tiktok.com/tiktok/v1/upvote/delete?' + q.toString());
    if (!url) return Promise.resolve({ fatal: true, why: 'нет подписанта, обновите страницу' });
    return fetch(url, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/x-www-form-urlencoded' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        return { ok: j.status_code === 0, fatal: j.status_code === 8, why: j.status_code + ': ' + (j.status_msg || '') };
      })
      .catch(function (e) { return { ok: false, why: 'сеть: ' + e.message }; });
  }

  function ids() {
    var sels = ['[data-e2e="user-repost-item-list"]', '[data-e2e="user-repost-item"]', '[role="tabpanel"]'];
    var nodes = [];
    for (var i = 0; i < sels.length && !nodes.length; i++) nodes = [].slice.call(document.querySelectorAll(sels[i]));
    if (!nodes.length) nodes = [document];
    var seen = {}, out = [];
    nodes.forEach(function (n) {
      [].slice.call(n.querySelectorAll('a[href*="/video/"]')).forEach(function (a) {
        var m = (a.getAttribute('href') || '').match(/\/video\/(\d{6,})/);
        if (m && !seen[m[1]]) { seen[m[1]] = 1; out.push(m[1]); }
      });
    });
    return out;
  }

  function scroller() {
    var list = document.querySelector('[data-e2e="user-repost-item-list"]');
    var el = list;
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight + 40) return el;
      el = el.parentElement;
    }
    return null;
  }

  function secUid() {
    var handle = (location.pathname.match(/^\/@([^/?#]+)/) || [])[1] || '';
    var el = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
    if (el) {
      try {
        var data = JSON.parse(el.textContent);
        var pairs = [];
        (function walk(o, d) {
          if (!o || typeof o !== 'object' || d > 10) return;
          if (o.secUid && typeof o.secUid === 'string' && o.secUid.length > 20) pairs.push({ s: o.secUid, u: o.uniqueId || '' });
          for (var k in o) walk(o[k], d + 1);
        })(data, 0);
        var exact = null;
        pairs.forEach(function (p) { if (handle && p.u === handle) exact = p.s; });
        if (exact) return exact;
        if (pairs.length) return pairs[0].s;
      } catch (e) {}
    }
    var m = document.documentElement.innerHTML.match(/"secUid":"([^"]{20,})"/);
    return m ? m[1] : '';
  }

  function apiList() {
    var sec = secUid();
    if (!sec) return Promise.resolve([]);
    var acc = [], cursor = '0', pages = 0;

    function page() {
      var q = new URLSearchParams(common());
      q.set('count', '30');
      q.set('cursor', String(cursor));
      q.set('secUid', sec);
      var plain = 'https://www.tiktok.com/api/repost/item_list/?' + q.toString();
      var url = sign(plain) || plain;
      return fetch(url, { credentials: 'include' })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var items = j.itemList || j.item_list || j.items || [];
          items.forEach(function (it) {
            var id = String((it && (it.id || it.itemId)) || '');
            if (/^\d{6,}$/.test(id)) acc.push(id);
          });
          pages++;
          if (!j.hasMore || !items.length || pages > 40) return acc;
          cursor = j.cursor || (Number(cursor) + 30);
          return new Promise(function (res) { setTimeout(res, 300); }).then(page);
        })
        .catch(function () { return acc; });
    }

    return page();
  }

  function gather() {
    set('запрашиваю список у TikTok…');
    return apiList().then(function (a) {
      if (a.length) return { ids: a, src: 'API' };
      return collect().then(function (g) { return { ids: g, src: 'сетка' }; });
    });
  }

  function collect() {
    return new Promise(function (done) {
      var seen = ids(), seenSet = {}, idle = 0, rounds = 0;
      seen.forEach(function (x) { seenSet[x] = 1; });
      function tick() {
        if (stop || rounds++ > 60 || idle > 6) { window.scrollTo(0, 0); return done(seen); }
        var before = seen.length;
        var sc = scroller();
        if (sc) sc.scrollTop += Math.round(sc.clientHeight * 0.8);
        else window.scrollBy(0, Math.round(innerHeight * 0.8));
        setTimeout(function () {
          ids().forEach(function (x) { if (!seenSet[x]) { seenSet[x] = 1; seen.push(x); } });
          idle = seen.length === before ? idle + 1 : 0;
          set('собираю список: ' + seen.length);
          tick();
        }, 700);
      }
      tick();
    });
  }

  function run() {
    stop = false;
    set('начинаю…');
    gather().then(function (res) {
      var list = res.ids;
      set('источник ' + res.src + ', найдено ' + list.length);
      var key = 'tt_unrepost_done';
      var known = [];
      try { known = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
      var knownSet = {};
      known.forEach(function (x) { knownSet[x] = 1; });
      var todo = list.filter(function (x) { return !knownSet[x]; });

      if (!todo.length) {
        set('нечего удалять (источник ' + res.src + ', найдено ' + list.length + '). Перезагрузите страницу (F5)');
        return;
      }

      set('удаляю 0 из ' + todo.length);
      var ok = 0, fail = 0, i = 0;

      function worker() {
        if (stop || i >= todo.length) return Promise.resolve();
        var id = todo[i++];
        return del(id).then(function (r) {
          if (r.ok) {
            ok++;
            knownSet[id] = 1;
            known.push(id);
            try { localStorage.setItem(key, JSON.stringify(known)); } catch (e) {}
            set('удалено ' + ok + ' из ' + todo.length);
          } else if (r.fatal) {
            stop = true;
            set('остановлено: ' + r.why);
            return Promise.resolve();
          } else {
            fail++;
          }
          return new Promise(function (res) { setTimeout(res, 400 + Math.random() * 700); }).then(worker);
        });
      }

      Promise.all([worker(), worker(), worker()]).then(function () {
        if (stop && ok === 0) {
          set('остановлено. Удалено ' + ok + ', ошибок ' + fail);
          return;
        }
        set('готово: удалено ' + ok + ', ошибок ' + fail + '. Перезагрузите страницу (F5)');
      });
    });
  }

  document.getElementById('ttGo').onclick = run;
  document.getElementById('ttStop').onclick = function () { stop = true; set('останавливаюсь…'); };
  document.getElementById('ttReload').onclick = function () { location.reload(); };
})();
