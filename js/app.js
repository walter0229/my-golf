/* 앱 셸: 해시 라우터 + 하단 탭 + 홈 화면 */
(function (g) {
  'use strict';

  var App = {
    views: {},     // name -> function(params) -> {title, sub, body, actions}
    root: null,
    current: null
  };

  // ---------- 라우팅 ----------
  function parseHash() {
    var h = (location.hash || '#/home').replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    return { name: parts[0] || 'home', params: parts.slice(1) };
  }

  App.go = function (path) {
    if (path.charAt(0) !== '#') path = '#/' + path.replace(/^\/?/, '');
    if (location.hash === path) render();
    else location.hash = path;
  };
  App.back = function () {
    if (history.length > 1) history.back();
    else App.go('home');
  };

  /* 화면을 다시 그릴 때 스크롤 위치 처리.
     App.root 를 비우는 순간 문서 높이가 0이 되면서 브라우저가 스크롤을 맨 위로 되돌린다.
     그래서 지우기 전에 위치를 기억해 뒀다가 다시 그린 뒤 복원한다.
     같은 화면을 다시 그리는 경우(코스 선택, 날씨 선택, 클럽 탭 등)에는 그 자리를 유지하고,
     다른 화면으로 이동할 때만 맨 위로 올린다. */
  var lastRouteKey = null;
  var forceTop = false;
  App.resetScroll = function () { forceTop = true; };

  function render() {
    var prevScroll = window.pageYOffset || document.documentElement.scrollTop || 0;
    var routeKey = location.hash || '#/home';
    var sameView = (routeKey === lastRouteKey) && !forceTop;
    lastRouteKey = routeKey;
    forceTop = false;

    var r = parseHash();
    var view = App.views[r.name] || App.views.home;
    App.current = r;
    var out;
    try {
      out = view(r.params);
    } catch (e) {
      console.error(e);
      out = { title: '오류', body: U.el('div', { class: 'empty' }, ['화면을 그리는 중 문제가 발생했습니다: ' + e.message]) };
    }

    App.root.innerHTML = '';

    var bar = U.el('div', { class: 'appbar' });
    if (out.back) bar.appendChild(U.el('button', { class: 'icon', onclick: function () { App.back(); }, 'aria-label': '뒤로' }, '‹'));
    var titleBox = U.el('div', { class: 'grow' });
    titleBox.appendChild(U.el('h1', {}, [out.title || '골프 스코어', out.sub ? U.el('span', { class: 'sub', text: out.sub }) : null]));
    bar.appendChild(titleBox);
    (out.actions || []).forEach(function (a) { bar.appendChild(a); });
    App.root.appendChild(bar);

    var wrap = U.el('div', { class: out.noWrap ? '' : 'wrap' });
    wrap.appendChild(out.body);
    App.root.appendChild(wrap);

    App.root.appendChild(tabbar(r.name));

    if (sameView && prevScroll > 0) {
      // 내용이 다시 채워진 뒤에 복원해야 한다 (한 번 더 잡아 주면 폰트/이미지 로딩 후에도 안 튄다)
      window.scrollTo(0, prevScroll);
      requestAnimationFrame(function () { window.scrollTo(0, prevScroll); });
    } else {
      window.scrollTo(0, 0);
    }
  }
  App.render = render;

  var TABS = [
    { id: 'home', ic: '⛳', label: '홈', match: ['home'] },
    { id: 'new', ic: '➕', label: '라운드', match: ['new', 'play', 'round'] },
    { id: 'stats', ic: '\u{1F4CA}', label: '통계', match: ['stats'] },
    { id: 'settings', ic: '⚙', label: '설정', match: ['settings', 'clubs', 'courses', 'course', 'sheets'] }
  ];

  function tabbar(cur) {
    var bar = U.el('nav', { class: 'tabbar' });
    TABS.forEach(function (t) {
      var on = t.match.indexOf(cur) >= 0;
      var a = U.el('a', { href: '#/' + t.id, class: on ? 'on' : '' }, [
        U.el('span', { class: 'ic', text: t.ic }),
        t.label
      ]);
      bar.appendChild(a);
    });
    return bar;
  }

  // ---------- 공용 컴포넌트 ----------
  App.tile = function (value, key, sub, cls) {
    return U.el('div', { class: 'tile' }, [
      U.el('div', { class: 'v ' + (cls || ''), text: value === null || value === undefined ? '-' : String(value) }),
      U.el('div', { class: 'k', text: key }),
      sub ? U.el('div', { class: 'sub', text: sub }) : null
    ]);
  };

  App.empty = function (icon, text, btnLabel, onClick) {
    return U.el('div', { class: 'empty' }, [
      U.el('div', { class: 'ic', text: icon }),
      U.el('div', { text: text }),
      btnLabel ? U.el('div', { class: 'mt16' }, [U.el('button', { class: 'primary', onclick: onClick }, btnLabel)]) : null
    ]);
  };

  App.modal = function (title, contentEl, footerEl) {
    var bg = U.el('div', { class: 'modal-bg' });
    var box = U.el('div', { class: 'modal' }, [U.el('h3', { text: title }), contentEl, footerEl || null]);
    bg.appendChild(box);
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    function close() { if (bg.parentNode) document.body.removeChild(bg); }
    document.body.appendChild(bg);
    return { el: bg, close: close };
  };

  // 아이언샷 기록을 한 줄 텍스트로 (CSV / 구글 시트 내보내기용)
  var LIE_KO = { fairway: '페어웨이', rough: '러프', bunker: '벙커' };
  var RESULT_KO = { green: '온그린', left: '좌측미스', right: '우측미스', short: '짧음', long: '오버' };
  App.LIE_KO = LIE_KO;
  App.RESULT_KO = RESULT_KO;
  App.approachText = function (hole) {
    if (!hole.approaches || !hole.approaches.length) return '';
    var unit = Store.unit();
    return hole.approaches.map(function (a) {
      var c = a.clubId ? Store.club(a.clubId) : null;
      return [
        a.dist ? U.toDisplay(a.dist, unit) + U.unitLabel(unit) : '?',
        LIE_KO[a.lie] || '?',
        c ? (c.short || c.name) : '?',
        (a.results || []).map(function (r) { return RESULT_KO[r] || r; }).join('+') || '?'
      ].join('/');
    }).join(' | ');
  };

  App.kindBadge = function (kind) {
    return U.el('span', { class: 'badge ' + kind, text: kind === 'screen' ? '스크린' : '필드' });
  };

  /* 코스 데이터의 출처를 배지로 알린다.
     card    = 공개 스코어카드 기반 (파·거리 비율·핸디캡 순번이 실제 값)
     partial = 일부 코스만 스코어카드
     total   = 총 길이만 확인, 홀별은 추정
     est     = 전부 추정 */
  App.estBadge = function (course) {
    if (!course) return null;
    if (course.verified) return U.el('span', { class: 'badge field', text: '내가 확인함' });
    var q = course.quality || 'est';
    if (q === 'card') return U.el('span', { class: 'badge ok', text: '스코어카드' });
    if (q === 'partial') return U.el('span', { class: 'badge ok', text: '스코어카드 일부' });
    if (q === 'total') return U.el('span', { class: 'badge warn', text: '총거리만 확인' });
    return U.el('span', { class: 'badge warn', text: '거리 추정' });
  };

  // 골프장 정보(설계자·개장연도·설명·출처) 카드
  App.courseInfoCard = function (course, nine) {
    if (!course) return null;
    var info = course.info;
    var rows = [];
    if (info && (info.designer || info.year)) {
      rows.push(U.el('div', { class: 'muted sm' }, [
        (info.designer || '') + (info.year ? ' · ' + info.year + '년 개장' : '')
      ]));
    }
    if (info && info.desc) rows.push(U.el('div', { class: 'mt8', style: 'font-size:13.5px;line-height:1.6', text: info.desc }));
    if (nine && nine.desc) {
      rows.push(U.el('div', { class: 'mynote mt12' }, [
        U.el('div', { class: 't', text: nine.name }),
        U.el('div', { class: 'c', text: nine.desc })
      ]));
    }
    if (nine && nine.real) {
      rows.push(U.el('div', { class: 'tiny mt12', text: '홀별 파와 난이도 순번은 공개 스코어카드 값입니다. 거리는 그 카드의 홀별 비율을 공식 총길이에 맞춰 환산한 값이라 실제와 몇 야드 차이가 날 수 있습니다.' }));
    } else if (course.quality === 'total') {
      rows.push(U.el('div', { class: 'tiny mt12', text: '공식 총 길이만 확인했습니다. 홀별 파와 거리는 추정값입니다.' }));
    } else if (!course.verified && course.quality === 'est') {
      rows.push(U.el('div', { class: 'tiny mt12', text: '홀별 파와 거리는 추정값입니다. 스코어카드를 보고 수정하면 공략이 정확해집니다.' }));
    }
    if (info && info.src) rows.push(U.el('div', { class: 'tiny mt8', text: '출처: ' + info.src }));
    if (!rows.length) return null;
    return U.el('div', { class: 'card' }, rows);
  };

  // ---------- 홈 ----------
  App.views.home = function () {
    var st = Store.get();
    var body = U.el('div');
    var active = Store.activeRound();

    // 진행 중인 라운드
    if (active) {
      var t = Store.totals(active);
      var played = t.holesPlayed;
      body.appendChild(U.el('div', { class: 'section' }, [
        U.el('h2', { text: '진행 중' }),
        U.el('div', {
          class: 'card click', onclick: function () {
            var next = 0;
            for (var i = 0; i < active.holes.length; i++) { if (!active.holes[i].score) { next = i; break; } }
            App.go('play/' + active.id + '/' + next);
          }
        }, [
          U.el('div', { class: 'row between' }, [
            U.el('div', { class: 'grow' }, [
              U.el('div', { class: 'row', style: 'gap:6px' }, [
                App.kindBadge(active.kind),
                U.el('span', { class: 'badge live', text: '진행 중' })
              ]),
              U.el('div', { class: 'mt8', style: 'font-weight:700;font-size:16px' , text: active.courseName }),
              U.el('div', { class: 'muted sm', text: active.nineNames.join(' + ') + ' · ' + U.fmtDate(active.date) })
            ]),
            U.el('div', { class: 'right center' }, [
              U.el('div', { style: 'font-size:26px;font-weight:800', text: played ? String(t.strokes) : '-' }),
              U.el('div', { class: 'tiny', text: played + '/18홀' })
            ])
          ]),
          U.el('div', { class: 'mt12' }, [U.el('button', { class: 'primary full' }, '이어서 기록하기')])
        ])
      ]));
    }

    // 요약
    var all = st.rounds;
    if (!all.length) {
      body.appendChild(App.empty('⛳', '아직 기록이 없습니다.\n첫 라운드를 시작해 보세요.', '새 라운드 시작', function () { App.go('new'); }));
      var setupCard = U.el('div', { class: 'card mt16 click', onclick: function () { App.go('clubs'); } }, [
        U.el('div', { style: 'font-weight:600', text: '먼저 내 클럽 거리를 입력하세요' }),
        U.el('div', { class: 'muted sm mt8', text: '클럽별 거리를 넣어야 홀마다 공략법(어떤 클럽으로 어디까지)을 계산해 드릴 수 있습니다.' })
      ]);
      body.appendChild(setupCard);
      return { title: '골프 스코어 관리', body: body };
    }

    var sAll = Stats.summary(all);
    var sField = Stats.summary(all.filter(function (r) { return r.kind === 'field'; }));
    var sScreen = Stats.summary(all.filter(function (r) { return r.kind === 'screen'; }));

    // 히어로: 가장 최근 18홀 라운드를 크게 보여준다
    var last = null;
    Store.rounds().some(function (r) {
      var t = Store.totals(r);
      if (t.holesPlayed >= 9) { last = { r: r, t: t }; return true; }
      return false;
    });

    var hero = U.el('div', { class: 'hero' });
    if (last) {
      hero.appendChild(U.el('div', { class: 'cap', text: '최근 라운드' }));
      hero.appendChild(U.el('div', { class: 'score-lg' }, [
        String(last.t.strokes),
        U.el('small', { text: U.sign(last.t.toPar) })
      ]));
      hero.appendChild(U.el('div', { class: 'meta', text: last.r.courseName + ' · ' + U.fmtDate(last.r.date) + (last.r.weather ? ' · ' + last.r.weather : '') }));
      hero.appendChild(U.el('div', { class: 'statrow' }, [
        U.el('div', { class: 's' }, [
          U.el('div', { class: 'n', text: sAll.avg18 === null ? '-' : String(Math.round(sAll.avg18)) }),
          U.el('div', { class: 'l', text: '평균' })
        ]),
        U.el('div', { class: 's' }, [
          U.el('div', { class: 'n', text: sAll.best18 === null ? '-' : String(sAll.best18) }),
          U.el('div', { class: 'l', text: '베스트' })
        ]),
        U.el('div', { class: 's' }, [
          U.el('div', { class: 'n', text: sAll.puttsPer18 === null ? '-' : String(U.round1(sAll.puttsPer18)) }),
          U.el('div', { class: 'l', text: '퍼팅' })
        ]),
        U.el('div', { class: 's' }, [
          U.el('div', { class: 'n', text: String(sAll.rounds) }),
          U.el('div', { class: 'l', text: '라운드' })
        ])
      ]));
    }
    if (last) body.appendChild(hero);

    var kindRow = U.el('div', { class: 'row', style: 'gap:8px' });
    [['필드', sField, 'field'], ['스크린', sScreen, 'screen']].forEach(function (x) {
      kindRow.appendChild(U.el('div', { class: 'card grow tight center' }, [
        U.el('span', { class: 'badge ' + x[2], text: x[0] }),
        U.el('div', { style: 'font-size:22px;font-weight:700;margin-top:6px', text: x[1].avg18 === null ? '-' : String(Math.round(x[1].avg18)) }),
        U.el('div', { class: 'tiny', text: x[1].rounds + '라운드 · 평균 타수' })
      ]));
    });
    body.appendChild(U.el('div', { class: 'section' }, [U.el('h2', { text: '필드 / 스크린' }), kindRow]));

    // 최근 라운드
    var recent = Store.rounds().slice(0, 6);
    var list = U.el('div', { class: 'list' });
    recent.forEach(function (r) {
      var t = Store.totals(r);
      list.appendChild(U.el('div', {
        class: 'item', onclick: function () { App.go('round/' + r.id); }
      }, [
        U.el('div', { class: 'main' }, [
          U.el('div', { class: 'title nowrap', text: r.courseName }),
          U.el('div', { class: 'desc' }, [
            U.fmtDate(r.date) + ' · ' + r.nineNames.join('+') + ' · ',
            U.el('span', { class: 'badge ' + r.kind, text: r.kind === 'screen' ? '스크린' : '필드' }),
            r.done ? null : U.el('span', { class: 'badge live', style: 'margin-left:4px', text: '미완료' })
          ])
        ]),
        U.el('div', { class: 'right' }, [
          U.el('div', { class: 'big', text: t.holesPlayed ? String(t.strokes) : '-' }),
          U.el('div', { class: 'tiny', text: t.holesPlayed ? U.sign(t.toPar) + ' · ' + t.putts + '퍼트' : '기록 없음' })
        ])
      ]));
    });
    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('div', { class: 'row between' }, [
        U.el('h2', { class: 'grow', text: '최근 라운드' }),
        U.el('button', { class: 'sm ghost', onclick: function () { App.go('stats'); } }, '전체 보기')
      ]),
      list
    ]));

    body.appendChild(U.el('button', {
      class: 'primary full mt8', onclick: function () { App.go('new'); }
    }, '새 라운드 시작'));

    return { title: '골프 스코어 관리', sub: st.settings.playerName || null, body: body };
  };

  // ---------- 시작 ----------
  function boot() {
    App.root = U.$('#app');
    Store.init();
    window.addEventListener('hashchange', render);
    render();

    // 서비스워커 (http/https 에서만 동작)
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function (e) { console.log('SW 등록 생략:', e.message); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  g.App = App;
})(window);
