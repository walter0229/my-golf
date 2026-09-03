/* 구글 시트 동기화 (선택 기능)
 * ------------------------------------------------------------------
 * 동작 방식: 이 앱(브라우저)이 원본이고, 구글 시트는 "보기 좋은 사본"이다.
 *   앱 -> 시트 방향으로만 밀어 넣는다(덮어쓰기). 시트를 고쳐도 앱으로는 안 돌아온다.
 * 필요 조건:
 *   1) 구글 클라우드 콘솔에서 OAuth 클라이언트 ID (웹 애플리케이션) 발급
 *   2) 앱이 https:// 주소에서 열려 있어야 함 (file:// 에서는 구글 로그인이 막힘)
 * 자세한 절차는 README.md 참고.
 * ------------------------------------------------------------------ */
(function (g) {
  'use strict';

  var SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
  var token = null;        // 메모리에만 보관 (약 1시간 후 만료)
  var tokenClient = null;
  var gisLoaded = false;

  function loadGIS() {
    return new Promise(function (resolve, reject) {
      if (gisLoaded && g.google && g.google.accounts) return resolve();
      if (!navigator.onLine) return reject(new Error('인터넷에 연결되어 있지 않습니다.'));
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = function () { gisLoaded = true; resolve(); };
      s.onerror = function () { reject(new Error('구글 로그인 스크립트를 불러오지 못했습니다.')); };
      document.head.appendChild(s);
    });
  }

  function authorize(clientId, force) {
    return loadGIS().then(function () {
      return new Promise(function (resolve, reject) {
        if (token && !force) return resolve(token);
        try {
          tokenClient = g.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: SCOPE,
            callback: function (resp) {
              if (resp && resp.access_token) { token = resp.access_token; resolve(token); }
              else reject(new Error('구글 인증이 취소되었거나 실패했습니다.'));
            },
            error_callback: function (err) {
              reject(new Error('구글 인증 오류: ' + (err && err.type ? err.type : '알 수 없음')));
            }
          });
          tokenClient.requestAccessToken({ prompt: token ? '' : 'consent' });
        } catch (e) { reject(e); }
      });
    });
  }

  function api(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers['Authorization'] = 'Bearer ' + token;
    if (opts.body) opts.headers['Content-Type'] = 'application/json';
    return fetch(url, opts).then(function (res) {
      return res.json().then(function (j) {
        if (!res.ok) {
          var msg = (j && j.error && j.error.message) || ('HTTP ' + res.status);
          if (res.status === 403) msg += ' (Google Sheets API가 켜져 있는지, 시트 접근 권한이 있는지 확인하세요)';
          if (res.status === 404) msg += ' (스프레드시트 ID가 맞는지 확인하세요)';
          throw new Error(msg);
        }
        return j;
      });
    });
  }

  var BASE = 'https://sheets.googleapis.com/v4/spreadsheets/';

  function ensureSheets(sid, titles) {
    return api(BASE + sid + '?fields=sheets.properties.title').then(function (meta) {
      var have = {};
      (meta.sheets || []).forEach(function (s) { have[s.properties.title] = true; });
      var reqs = titles.filter(function (t) { return !have[t]; })
        .map(function (t) { return { addSheet: { properties: { title: t } } }; });
      if (!reqs.length) return;
      return api(BASE + sid + ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: reqs }) });
    });
  }

  function writeSheet(sid, title, values) {
    var range = encodeURIComponent("'" + title + "'!A1");
    return api(BASE + sid + '/values/' + range + ':clear', { method: 'POST', body: '{}' })
      .then(function () {
        return api(BASE + sid + '/values/' + range + '?valueInputOption=RAW', {
          method: 'PUT',
          body: JSON.stringify({ range: "'" + title + "'!A1", majorDimension: 'ROWS', values: values })
        });
      });
  }

  // 홀 단위 데이터
  function holeRows() {
    var unit = Store.unit();
    var rows = [['날짜', '구분', '골프장', '코스', '티', '날씨', '동반자', '홀', '파', '거리(' + U.unitLabel(unit) + ')',
      '스코어', '파대비', '퍼팅', '티샷클럽', '사용클럽', '페어웨이', '파온',
      '아이언샷', 'OB', '해저드', '벙커', '메모']];
    Store.rounds().forEach(function (r) {
      r.holes.forEach(function (h) {
        if (!h.score && typeof h.putts !== 'number') return;
        var clubs = h.shots.map(function (id) { var c = Store.club(id); return c ? (c.short || c.name) : '?'; });
        rows.push([
          r.date, r.kind === 'screen' ? '스크린' : '필드', r.courseName, h.nineName, r.teeName,
          r.weather || '', r.partners || '',
          h.no, h.par, U.toDisplay(h.dist, unit),
          h.score || '', h.score ? (h.score - h.par) : '', (typeof h.putts === 'number' ? h.putts : ''),
          clubs[0] || '', clubs.join(' '),
          h.fairway === 'hit' ? '페어웨이' : h.fairway === 'left' ? '좌' : h.fairway === 'right' ? '우' : '',
          h.gir === true ? 'O' : h.gir === false ? 'X' : '',
          App.approachText(h), h.penalty.ob || 0, h.penalty.hazard || 0, h.bunker || 0, h.memo || ''
        ]);
      });
    });
    return rows;
  }

  // 라운드 요약
  function roundRows() {
    var rows = [['날짜', '구분', '골프장', '코스', '티', '날씨', '동반자', '홀수', '총타수', '파대비', '퍼팅',
      '파온율(%)', '페어웨이(%)', '버디이상', '파', '보기', '더블이상', '3퍼트', 'OB', '해저드', '메모']];
    Store.rounds().forEach(function (r) {
      var t = Store.totals(r);
      if (!t.holesPlayed) return;
      rows.push([
        r.date, r.kind === 'screen' ? '스크린' : '필드', r.courseName, r.nineNames.join('+'), r.teeName,
        r.weather || '', r.partners || '',
        t.holesPlayed, t.strokes, t.toPar, t.putts,
        U.pct(t.gir, t.girChance) || 0, U.pct(t.fwHit, t.fwChance) || 0,
        t.birdieOrBetter, t.par, t.bogey, t.doubleOrWorse, t.threePutt, t.ob, t.hazard, r.memo || ''
      ]);
    });
    return rows;
  }

  // 클럽 거리
  function clubRows() {
    var unit = Store.unit();
    var rows = [['클럽', '표기', '종류', '거리(' + U.unitLabel(unit) + ')']];
    Store.clubs().forEach(function (c) {
      rows.push([c.name, c.short || '', c.cat, c.dist ? U.toDisplay(c.dist, unit) : '']);
    });
    return rows;
  }

  var Sheets = {
    configured: function () {
      var gs = Store.settings().gsheet;
      return !!(gs.clientId && gs.spreadsheetId);
    },
    hasToken: function () { return !!token; },

    sync: function () {
      var gs = Store.settings().gsheet;
      if (!gs.clientId || !gs.spreadsheetId) {
        return Promise.reject(new Error('클라이언트 ID와 스프레드시트 ID를 먼저 입력하세요.'));
      }
      if (location.protocol === 'file:') {
        return Promise.reject(new Error('file:// 로 연 화면에서는 구글 로그인이 동작하지 않습니다. https 주소로 열어주세요. (README 참고)'));
      }
      if (!navigator.onLine) return Promise.reject(new Error('오프라인 상태입니다. 인터넷 연결 후 다시 시도하세요.'));

      var sid = gs.spreadsheetId.trim();
      // 전체 URL을 붙여넣은 경우 ID만 뽑아낸다
      var m = sid.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (m) sid = m[1];

      return authorize(gs.clientId.trim())
        .then(function () { return ensureSheets(sid, ['홀기록', '라운드요약', '클럽거리']); })
        .then(function () { return writeSheet(sid, '홀기록', holeRows()); })
        .then(function () { return writeSheet(sid, '라운드요약', roundRows()); })
        .then(function () { return writeSheet(sid, '클럽거리', clubRows()); })
        .then(function () {
          var s = Store.settings();
          s.gsheet.lastSync = new Date().toISOString();
          Store.save();
          return true;
        });
    },

    signOut: function () { token = null; }
  };

  g.Sheets = Sheets;

  /* ---------------- 설정 화면 ---------------- */
  App.views['sheets'] = function () {
    var gs = Store.settings().gsheet;
    var body = U.el('div');

    body.appendChild(U.el('div', { class: 'card' }, [
      U.el('div', { style: 'font-weight:600', text: '어떻게 동작하나요?' }),
      U.el('div', { class: 'muted sm mt8', text: '기록은 항상 폰 안에 먼저 저장됩니다(오프라인 동작). 동기화 버튼을 누르면 그 기록을 구글 시트로 밀어 넣어 PC에서도 볼 수 있게 만듭니다.' }),
      U.el('div', { class: 'muted sm mt8', text: '방향은 앱 → 시트 한 방향입니다. 동기화할 때마다 시트 내용을 앱 기록으로 덮어씁니다. 시트에서 직접 고친 값은 다음 동기화 때 사라지니 주의하세요.' })
    ]));

    if (location.protocol === 'file:') {
      body.appendChild(U.el('div', { class: 'card', style: 'border-color:#6b1f2c' }, [
        U.el('span', { class: 'badge live', text: '사용 불가' }),
        U.el('div', { class: 'muted sm mt8', text: '지금 이 화면은 파일(file://)로 열려 있습니다. 구글 로그인은 https 주소에서만 동작합니다. README.md 의 "구글 시트 연동" 항목을 참고해 GitHub Pages 등에 올린 뒤 사용하세요. 그 전까지는 설정 > 백업의 CSV 내보내기로 구글 시트에 붙여넣어 쓰시면 됩니다.' })
      ]));
    }

    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('h2', { text: '연결 정보' }),
      U.el('div', { class: 'card' }, [
        U.el('label', { class: 'field' }, [
          U.el('span', { text: 'OAuth 클라이언트 ID' }),
          U.el('input', {
            type: 'text', value: gs.clientId || '', placeholder: '000000-xxxx.apps.googleusercontent.com',
            onchange: function (e) { gs.clientId = e.target.value.trim(); Store.save(); }
          })
        ]),
        U.el('label', { class: 'field', style: 'margin-bottom:0' }, [
          U.el('span', { text: '스프레드시트 ID 또는 주소' }),
          U.el('input', {
            type: 'text', value: gs.spreadsheetId || '', placeholder: 'https://docs.google.com/spreadsheets/d/... 를 그대로 붙여넣어도 됩니다',
            onchange: function (e) { gs.spreadsheetId = e.target.value.trim(); Store.save(); }
          })
        ])
      ])
    ]));

    var statusEl = U.el('div', { class: 'muted sm mt8', text: gs.lastSync ? '마지막 동기화: ' + new Date(gs.lastSync).toLocaleString('ko-KR') : '아직 동기화한 적이 없습니다.' });

    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('button', {
        class: 'primary full',
        onclick: function (e) {
          var btn = e.target;
          btn.disabled = true; btn.textContent = '동기화 중...';
          Sheets.sync().then(function () {
            btn.disabled = false; btn.textContent = '지금 동기화';
            U.toast('구글 시트로 보냈습니다.');
            App.render();
          }).catch(function (err) {
            btn.disabled = false; btn.textContent = '지금 동기화';
            statusEl.textContent = '오류: ' + err.message;
            statusEl.style.color = 'var(--red)';
            U.toast(err.message, 'err');
          });
        }
      }, '지금 동기화'),
      statusEl
    ]));

    var steps = [
      '구글 클라우드 콘솔(console.cloud.google.com)에서 프로젝트를 하나 만듭니다.',
      'API 및 서비스 > 라이브러리에서 "Google Sheets API"를 사용 설정합니다.',
      'OAuth 동의 화면을 만들고, 테스트 사용자에 본인 구글 계정을 추가합니다.',
      '사용자 인증 정보 > OAuth 클라이언트 ID > 웹 애플리케이션을 만들고, "승인된 자바스크립트 원본"에 이 앱을 올린 주소(예: https://아이디.github.io)를 넣습니다.',
      '발급된 클라이언트 ID를 위에 붙여넣습니다.',
      '구글 드라이브에서 빈 스프레드시트를 하나 만들고 주소를 위에 붙여넣습니다.',
      '"지금 동기화"를 누르면 홀기록 / 라운드요약 / 클럽거리 세 개의 시트가 자동으로 만들어집니다.'
    ];
    var ol = U.el('ol', { style: 'padding-left:18px;margin:0;font-size:13px;color:var(--fg2);line-height:1.7' });
    steps.forEach(function (s) { ol.appendChild(U.el('li', { text: s })); });
    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('h2', { text: '처음 설정하는 방법' }),
      U.el('div', { class: 'card' }, [ol])
    ]));

    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('div', { class: 'card' }, [
        U.el('div', { class: 'muted sm', text: '설정이 번거로우면 이 기능을 건너뛰어도 됩니다. 설정 > 백업에서 CSV로 내보낸 뒤 구글 시트에 붙여넣는 방법이 더 간단합니다.' }),
        U.el('button', { class: 'ghost full sm mt12', onclick: function () {
          U.download('golf-scores-' + U.today() + '.csv', App.toCSV());
          U.toast('CSV를 내려받았습니다.');
        } }, 'CSV로 내보내기')
      ])
    ]));

    return { title: '구글 시트 동기화', body: body, back: true };
  };
})(window);
