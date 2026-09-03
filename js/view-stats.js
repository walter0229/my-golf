/* 통계 화면 */
(function (g) {
  'use strict';

  var FS = { kind: 'all', range: 'all' };

  function filtered() {
    var rounds = Store.get().rounds.slice();
    if (FS.kind !== 'all') rounds = rounds.filter(function (r) { return r.kind === FS.kind; });
    if (FS.range !== 'all') {
      var n = parseInt(FS.range, 10);
      rounds = rounds.sort(function (a, b) { return a.date.localeCompare(b.date); }).slice(-n);
    }
    return rounds;
  }

  // 최근 라운드 총타수 추이 그래프
  function sparkline(trend) {
    var pts = trend.filter(function (x) { return x.holes >= 18; }).slice(-15);
    if (pts.length < 2) return U.el('div', { class: 'muted sm center', style: 'padding:20px', text: '18홀 라운드가 2회 이상 쌓이면 추이 그래프가 나옵니다.' });

    var W = 320, H = 130, pad = 22;
    var vals = pts.map(function (p) { return p.score; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max === min) { max = min + 1; }
    var x = function (i) { return pad + (i * (W - pad * 2)) / (pts.length - 1); };
    var y = function (v) { return pad + ((max - v) * (H - pad * 2)) / (max - min); };

    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'spark');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');

    function add(tag, attrs) {
      var e = document.createElementNS(ns, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      svg.appendChild(e);
      return e;
    }
    // 평균선
    var avg = U.avg(vals);
    add('line', { x1: pad, y1: y(avg), x2: W - pad, y2: y(avg), stroke: '#3d4f47', 'stroke-dasharray': '3 3', 'stroke-width': 1 });

    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.score).toFixed(1); }).join(' ');
    add('path', { d: d + ' L' + x(pts.length - 1) + ' ' + (H - pad) + ' L' + x(0) + ' ' + (H - pad) + ' Z', fill: 'rgba(61,220,132,0.10)', stroke: 'none' });
    add('path', { d: d, fill: 'none', stroke: '#3ddc84', 'stroke-width': 2, 'stroke-linejoin': 'round' });

    pts.forEach(function (p, i) {
      add('circle', { cx: x(i), cy: y(p.score), r: 3, fill: '#3ddc84' });
      var tx = document.createElementNS(ns, 'text');
      tx.setAttribute('x', x(i)); tx.setAttribute('y', y(p.score) - 8);
      tx.setAttribute('fill', '#9db0a7'); tx.setAttribute('font-size', '9'); tx.setAttribute('text-anchor', 'middle');
      tx.textContent = p.score;
      svg.appendChild(tx);
    });
    // 최저/최고 라벨
    var lo = document.createElementNS(ns, 'text');
    lo.setAttribute('x', 2); lo.setAttribute('y', H - 6);
    lo.setAttribute('fill', '#6b8177'); lo.setAttribute('font-size', '9');
    lo.textContent = '평균 ' + U.round1(avg);
    svg.appendChild(lo);

    return svg;
  }

  function distBar(label, count, total, color) {
    var p = total ? (count / total) * 100 : 0;
    return U.el('div', { class: 'row', style: 'gap:8px;margin-bottom:6px' }, [
      U.el('span', { style: 'width:58px;font-size:12px;color:var(--fg2)', text: label }),
      U.el('div', { style: 'flex:1;height:14px;background:var(--bg2);border-radius:7px;overflow:hidden' }, [
        U.el('div', { style: 'height:100%;width:' + p.toFixed(1) + '%;background:' + color })
      ]),
      U.el('span', { style: 'width:56px;text-align:right;font-size:12px', text: count + ' (' + Math.round(p) + '%)' })
    ]);
  }

  App.views['stats'] = function () {
    var body = U.el('div');
    var all = Store.get().rounds;

    if (!all.length) {
      return { title: '통계', body: App.empty('📊', '기록이 쌓이면 여기에 통계와 약점 진단이 나옵니다.', '새 라운드 시작', function () { App.go('new'); }) };
    }

    // 필터
    var seg1 = U.el('div', { class: 'seg' });
    [['all', '전체'], ['field', '필드'], ['screen', '스크린']].forEach(function (o) {
      seg1.appendChild(U.el('button', { class: FS.kind === o[0] ? 'on' : '', onclick: function () { FS.kind = o[0]; App.render(); } }, o[1]));
    });
    var seg2 = U.el('div', { class: 'seg mt8' });
    [['all', '전체 기간'], ['10', '최근 10R'], ['5', '최근 5R']].forEach(function (o) {
      seg2.appendChild(U.el('button', { class: FS.range === o[0] ? 'on' : '', onclick: function () { FS.range = o[0]; App.render(); } }, o[1]));
    });
    body.appendChild(U.el('div', { class: 'section' }, [seg1, seg2]));

    var rounds = filtered();
    var s = Stats.summary(rounds);

    if (!s.rounds) {
      body.appendChild(App.empty('📊', '이 조건에 해당하는 기록이 없습니다.'));
      return { title: '통계', body: body };
    }

    // 핵심 지표
    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('h2', { text: '핵심 지표 (' + s.rounds + '라운드 / ' + s.holes + '홀)' }),
      U.el('div', { class: 'tiles' }, [
        App.tile(s.avg18 === null ? '-' : U.round1(s.avg18), '평균 타수', s.full18.length + '회 18홀'),
        App.tile(s.best18 === null ? '-' : s.best18, '베스트'),
        App.tile(s.recent5 === null ? '-' : U.round1(s.recent5), '최근 5R 평균'),
        App.tile(s.avgToPar === null ? '-' : U.sign(U.round2(s.avgToPar)), '홀당 평균', '파 대비')
      ]),
      U.el('div', { class: 'tiles mt8' }, [
        App.tile(s.puttsPer18 === null ? '-' : U.round1(s.puttsPer18), '퍼팅 (18홀)'),
        App.tile(s.girPct === null ? '-' : s.girPct + '%', '파온율', s.gir + '/' + s.girChance),
        App.tile(s.fwPct === null ? '-' : s.fwPct + '%', '페어웨이', s.fwHit + '/' + s.fwChance),
        App.tile(s.threePuttPer18 === null ? '-' : U.round1(s.threePuttPer18), '3퍼트/R')
      ]),
      U.el('div', { class: 'tiles mt8' }, [
        App.tile(s.avgPar3 === null ? '-' : U.sign(U.round2(s.avgPar3)), '파3 평균'),
        App.tile(s.avgPar4 === null ? '-' : U.sign(U.round2(s.avgPar4)), '파4 평균'),
        App.tile(s.avgPar5 === null ? '-' : U.sign(U.round2(s.avgPar5)), '파5 평균'),
        App.tile(U.round1(s.obPerRound), 'OB/R', '해저드 ' + U.round1(s.hazardPerRound))
      ])
    ]));

    // 추이
    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('h2', { text: '스코어 추이 (18홀 라운드)' }),
      U.el('div', { class: 'card' }, [sparkline(s.trend)])
    ]));

    // 스코어 분포
    var tot = s.holes;
    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('h2', { text: '스코어 분포' }),
      U.el('div', { class: 'card' }, [
        distBar('이글↓', s.byScore.eagle, tot, '#ffd166'),
        distBar('버디', s.byScore.birdie, tot, '#ff8fab'),
        distBar('파', s.byScore.par, tot, '#3ddc84'),
        distBar('보기', s.byScore.bogey, tot, '#5aa9e6'),
        distBar('더블', s.byScore.double, tot, '#ff8f8f'),
        distBar('트리플↑', s.byScore.triplePlus, tot, '#c94b4b')
      ])
    ]));

    // 약점 진단
    var diag = Stats.diagnose(s);
    var dbox = U.el('div', { class: 'card' });
    diag.forEach(function (d) {
      dbox.appendChild(U.el('div', { class: 'diag ' + d.level }, [
        U.el('div', { class: 't', text: d.title }),
        U.el('div', { class: 'd', text: d.detail }),
        d.action ? U.el('div', { class: 'a', text: '→ ' + d.action }) : null
      ]));
    });
    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('h2', { text: '실력 향상 포인트' }), dbox
    ]));

    // 아이언샷 분석
    if (s.approach.n > 0) {
      var ap = s.approach;
      var apBox = U.el('div', { class: 'card' }, [
        distBar('온그린', ap.results.green, ap.n, '#3ddc84'),
        distBar('짧음', ap.results.short, ap.n, '#ff8f8f'),
        distBar('오버', ap.results.long, ap.n, '#ffd166'),
        distBar('좌측 미스', ap.results.left, ap.n, '#5aa9e6'),
        distBar('우측 미스', ap.results.right, ap.n, '#b98fe6')
      ]);
      var lieRow = U.el('div', { class: 'tiles mt8' });
      [['fairway', '페어웨이에서'], ['rough', '러프에서'], ['bunker', '벙커에서']].forEach(function (l) {
        var d = ap.lies[l[0]];
        lieRow.appendChild(App.tile(
          d.n ? U.pct(d.green, d.n) + '%' : '-', l[1], d.green + '/' + d.n + ' 온그린'
        ));
      });
      body.appendChild(U.el('div', { class: 'section' }, [
        U.el('h2', { text: '아이언샷 분석 (' + ap.n + '샷)' }),
        apBox, lieRow,
        U.el('div', { class: 'tiny mt8', text: '짧음이 오버보다 훨씬 많으면 클럽 거리가 과대 입력된 것입니다. 설정에서 낮춰 보세요.' })
      ]));
    }

    // 클럽별
    var clubIds = Object.keys(s.byClub);
    if (clubIds.length) {
      clubIds.sort(function (a, b) { return s.byClub[b].n - s.byClub[a].n; });
      var cl = U.el('div', { class: 'list' });
      clubIds.forEach(function (cid) {
        var c = Store.club(cid);
        var d = s.byClub[cid];
        cl.appendChild(U.el('div', { class: 'item', style: 'cursor:default' }, [
          U.el('div', { class: 'main' }, [
            U.el('div', { class: 'title', text: c ? c.name : '(삭제된 클럽)' }),
            U.el('div', { class: 'desc', text: '티샷 ' + d.n + '회' + (d.fwChance ? ' · 페어웨이 ' + U.pct(d.fwHit, d.fwChance) + '%' : '') })
          ]),
          U.el('div', { class: 'right' }, [
            U.el('div', { class: 'big', text: U.sign(U.round2(d.sumToPar / d.n)) }),
            U.el('div', { class: 'tiny', text: '홀 평균' })
          ])
        ]));
      });
      body.appendChild(U.el('div', { class: 'section' }, [
        U.el('h2', { text: '티샷 클럽별 성적' }),
        cl,
        U.el('div', { class: 'tiny mt8', text: '숫자가 낮을수록 그 클럽으로 시작한 홀의 스코어가 좋았다는 뜻입니다.' })
      ]));
    }

    // 골프장별
    var cids = Object.keys(s.byCourse).filter(function (k) { return s.byCourse[k].n > 0; });
    if (cids.length) {
      cids.sort(function (a, b) { return (s.byCourse[a].sum / s.byCourse[a].n) - (s.byCourse[b].sum / s.byCourse[b].n); });
      var gl = U.el('div', { class: 'list' });
      cids.forEach(function (k) {
        var c = s.byCourse[k];
        gl.appendChild(U.el('div', { class: 'item', style: 'cursor:default' }, [
          U.el('div', { class: 'main' }, [
            U.el('div', { class: 'title nowrap', text: c.name }),
            U.el('div', { class: 'desc', text: c.n + '라운드 · 베스트 ' + c.best })
          ]),
          U.el('div', { class: 'right' }, [
            U.el('div', { class: 'big', text: String(Math.round(c.sum / c.n)) }),
            U.el('div', { class: 'tiny', text: '평균' })
          ])
        ]));
      });
      body.appendChild(U.el('div', { class: 'section' }, [U.el('h2', { text: '골프장별 평균' }), gl]));
    }

    // 전체 라운드 목록
    var rl = U.el('div', { class: 'list' });
    Store.rounds().forEach(function (r) {
      if (FS.kind !== 'all' && r.kind !== FS.kind) return;
      var t = Store.totals(r);
      rl.appendChild(U.el('div', { class: 'item', onclick: function () { App.go('round/' + r.id); } }, [
        U.el('div', { class: 'main' }, [
          U.el('div', { class: 'title nowrap', text: r.courseName }),
          U.el('div', { class: 'desc', text: U.fmtDate(r.date) + ' · ' + t.holesPlayed + '홀 · ' + t.putts + '퍼트' })
        ]),
        U.el('div', { class: 'right' }, [
          U.el('div', { class: 'big', text: t.holesPlayed ? String(t.strokes) : '-' }),
          U.el('div', { class: 'tiny', text: U.sign(t.toPar) })
        ])
      ]));
    });
    body.appendChild(U.el('div', { class: 'section' }, [U.el('h2', { text: '전체 라운드' }), rl]));

    return { title: '통계', body: body };
  };
})(window);
