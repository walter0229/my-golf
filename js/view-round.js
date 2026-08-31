/* 라운드 관련 화면: 새 라운드 설정 / 홀 기록 / 스코어카드 */
(function (g) {
  'use strict';

  // 새 라운드 화면의 임시 선택 상태
  var NS = { kind: 'field', courseId: null, nineIds: [], tee: null, date: null, q: '' };

  function fmtDist(m) { return U.toDisplay(m, Store.unit()) + U.unitLabel(Store.unit()); }

  /* ============================================================
     1. 새 라운드
     ============================================================ */
  App.views['new'] = function () {
    var st = Store.get();
    if (!NS.tee) NS.tee = st.settings.defaultTee;
    if (!NS.date) NS.date = U.today();

    var body = U.el('div');

    // 진행 중 라운드가 있으면 안내
    var active = Store.activeRound();
    if (active) {
      body.appendChild(U.el('div', { class: 'card', style: 'border-color:#6b1f2c' }, [
        U.el('div', { class: 'row between' }, [
          U.el('div', { class: 'grow' }, [
            U.el('div', { style: 'font-weight:600', text: '진행 중인 라운드가 있습니다' }),
            U.el('div', { class: 'muted sm', text: active.courseName + ' · ' + U.fmtDate(active.date) })
          ]),
          U.el('button', { class: 'sm primary', onclick: function () { App.go('play/' + active.id + '/0'); } }, '이어하기')
        ])
      ]));
    }

    // 필드 / 스크린
    var seg = U.el('div', { class: 'seg' });
    [['field', '필드'], ['screen', '스크린골프']].forEach(function (k) {
      seg.appendChild(U.el('button', {
        class: NS.kind === k[0] ? 'on' : '',
        onclick: function () { NS.kind = k[0]; NS.courseId = null; NS.nineIds = []; App.render(); }
      }, k[1]));
    });
    body.appendChild(U.el('div', { class: 'section' }, [U.el('h2', { text: '어디서 치나요?' }), seg]));

    // 골프장 선택
    var courses = Store.courses(NS.kind);
    var selected = NS.courseId ? Store.course(NS.courseId) : null;

    if (!selected) {
      var searchBox = U.el('div', { class: 'search' }, [
        U.el('input', {
          type: 'search', placeholder: '골프장 이름 / 지역 검색', value: NS.q,
          oninput: function (e) { NS.q = e.target.value; redrawList(); }
        })
      ]);
      var listWrap = U.el('div');

      function courseItem(c) {
        return U.el('div', {
          class: 'item',
          onclick: function () { NS.courseId = c.id; NS.nineIds = []; App.render(); }
        }, [
          U.el('div', { class: 'main' }, [
            U.el('div', { class: 'title nowrap', text: c.name }),
            U.el('div', { class: 'desc nowrap' }, [
              (c.region || '') + ' · ' + c.nines.length + '개 코스 ',
              App.estBadge(c)
            ])
          ]),
          // 별을 누르면 "자주 가는 곳" 고정 (목록 이동은 하지 않음)
          U.el('button', {
            class: 'star' + (c.fav ? ' on' : ''),
            'aria-label': '자주 가는 곳',
            onclick: function (e) { e.stopPropagation(); Store.toggleFav(c.id); redrawList(); }
          }, c.fav ? '★' : '☆')
        ]);
      }

      function redrawList() {
        var q = NS.q.trim().toLowerCase();
        var filtered = courses.filter(function (c) { return Store.matchCourse(c, q); });
        listWrap.innerHTML = '';
        if (!filtered.length) {
          listWrap.appendChild(App.empty('🔍', '검색 결과가 없습니다.', '골프장 직접 추가', function () { App.go('course/new/' + NS.kind); }));
          return;
        }

        // 자주 가는 곳을 맨 위에 고정
        var favs = filtered.filter(function (c) { return c.fav; });
        if (favs.length) {
          listWrap.appendChild(U.el('h2', { style: 'font-size:12px;color:var(--accent);margin:14px 2px 6px', text: '★ 자주 가는 곳' }));
          var favList = U.el('div', { class: 'list' });
          favs.forEach(function (c) { favList.appendChild(courseItem(c)); });
          listWrap.appendChild(favList);
        }

        // 나머지는 권역별로 묶기
        var groups = {};
        filtered.forEach(function (c) {
          if (c.fav) return;
          var k = c.area || '기타';
          (groups[k] = groups[k] || []).push(c);
        });
        Object.keys(groups).forEach(function (area) {
          listWrap.appendChild(U.el('h2', { style: 'font-size:12px;color:var(--fg3);margin:14px 2px 6px', text: area }));
          var list = U.el('div', { class: 'list' });
          groups[area].forEach(function (c) { list.appendChild(courseItem(c)); });
          listWrap.appendChild(list);
        });
        listWrap.appendChild(U.el('button', {
          class: 'ghost full mt12', onclick: function () { App.go('course/new/' + NS.kind); }
        }, '+ 골프장 직접 추가'));
      }
      redrawList();

      body.appendChild(U.el('div', { class: 'section' }, [
        U.el('h2', { text: '골프장 선택 (' + courses.length + '곳)' }),
        searchBox, listWrap
      ]));

      return { title: '새 라운드', body: body, back: true };
    }

    // --- 골프장이 선택된 상태 ---
    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('h2', { text: '골프장' }),
      U.el('div', { class: 'card' }, [
        U.el('div', { class: 'row between' }, [
          U.el('div', { class: 'grow' }, [
            U.el('div', { style: 'font-weight:700;font-size:16px', text: selected.name }),
            U.el('div', { class: 'muted sm mt8' }, [(selected.region || '') + ' ', App.estBadge(selected)])
          ]),
          U.el('button', { class: 'sm ghost', onclick: function () { NS.courseId = null; App.render(); } }, '변경')
        ]),
        U.el('div', { class: 'btnrow mt12' }, [
          U.el('button', { class: 'sm', onclick: function () { App.go('course/' + selected.id); } }, '코스 정보 보기 / 수정')
        ])
      ])
    ]));

    // 코스(9홀) 선택 — 앞 9홀, 뒤 9홀
    var nineSec = U.el('div', { class: 'section' }, [
      U.el('h2', { text: '플레이할 코스 (앞 9홀 → 뒤 9홀 순서로 선택)' })
    ]);
    var nineList = U.el('div', { class: 'list' });
    selected.nines.forEach(function (n) {
      var idx = NS.nineIds.indexOf(n.id);
      var par = n.holes.reduce(function (a, h) { return a + h.par; }, 0);
      var teeDef = null;
      COURSE_DATA.TEES.forEach(function (t) { if (t.id === NS.tee) teeDef = t; });
      var f = teeDef ? teeDef.factor : 1;
      var dist = Math.round(n.holes.reduce(function (a, h) { return a + h.dist * f; }, 0));
      nineList.appendChild(U.el('div', {
        class: 'item',
        style: idx >= 0 ? 'background:var(--card2)' : '',
        onclick: function () {
          var i = NS.nineIds.indexOf(n.id);
          if (i >= 0) NS.nineIds.splice(i, 1);
          else if (NS.nineIds.length < 2) NS.nineIds.push(n.id);
          else { NS.nineIds = [NS.nineIds[1], n.id]; }
          App.render();
        }
      }, [
        U.el('div', {
          style: 'width:26px;height:26px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;' +
            (idx >= 0 ? 'background:var(--green-d);color:#fff' : 'border:1px solid var(--line);color:var(--fg3)'),
          text: idx >= 0 ? String(idx + 1) : ''
        }),
        U.el('div', { class: 'main' }, [
          U.el('div', { class: 'title', text: n.name }),
          U.el('div', { class: 'desc', text: '파 ' + par + ' · ' + fmtDist(dist) })
        ])
      ]));
    });
    nineSec.appendChild(nineList);
    body.appendChild(nineSec);

    // 티박스
    var teeSeg = U.el('div', { class: 'seg' });
    COURSE_DATA.TEES.forEach(function (t) {
      teeSeg.appendChild(U.el('button', {
        class: NS.tee === t.id ? 'on' : '',
        onclick: function () { NS.tee = t.id; App.render(); }
      }, t.name.split(' ')[0]));
    });
    body.appendChild(U.el('div', { class: 'section' }, [U.el('h2', { text: '티박스' }), teeSeg]));

    // 날짜 / 메모
    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('h2', { text: '라운드 정보' }),
      U.el('div', { class: 'card' }, [
        U.el('label', { class: 'field' }, [
          U.el('span', { text: '날짜' }),
          U.el('input', { type: 'date', value: NS.date, onchange: function (e) { NS.date = e.target.value; } })
        ]),
        U.el('label', { class: 'field', style: 'margin-bottom:0' }, [
          U.el('span', { text: '메모 (날씨, 동반자 등)' }),
          U.el('input', { type: 'text', placeholder: '예: 맑음, 바람 강함', id: 'r-memo' })
        ])
      ])
    ]));

    var canStart = NS.nineIds.length === 2;
    body.appendChild(U.el('button', {
      class: 'primary full', disabled: !canStart,
      onclick: function () {
        var memoEl = U.$('#r-memo');
        var r = Store.createRound({
          kind: NS.kind, courseId: NS.courseId, nineIds: NS.nineIds,
          tee: NS.tee, date: NS.date, memo: memoEl ? memoEl.value : ''
        });
        if (r) {
          NS.courseId = null; NS.nineIds = []; NS.q = '';
          App.go('play/' + r.id + '/0');
        }
      }
    }, canStart ? '라운드 시작 (18홀)' : '코스를 2개 선택하세요 (' + NS.nineIds.length + '/2)'));

    return { title: '새 라운드', body: body, back: true };
  };

  /* ============================================================
     2. 홀 기록
     ============================================================ */
  App.views['play'] = function (params) {
    var roundId = params[0];
    var idx = Math.max(0, Math.min(17, parseInt(params[1], 10) || 0));
    var round = Store.round(roundId);
    if (!round) return { title: '라운드 없음', body: App.empty('❓', '해당 라운드를 찾을 수 없습니다.', '홈으로', function () { App.go('home'); }), back: true };

    var hole = round.holes[idx];
    var course = Store.course(round.courseId);
    var body = U.el('div');

    // --- 홀 점프 바 ---
    var bar = U.el('div', { class: 'holebar' });
    round.holes.forEach(function (h, i) {
      bar.appendChild(U.el('button', {
        class: (i === idx ? 'cur' : '') + (h.score ? ' done' : ''),
        onclick: function () { App.go('play/' + roundId + '/' + i); }
      }, String(i + 1)));
    });
    body.appendChild(bar);

    // --- 홀 헤더 ---
    var t = Store.totals(round);
    body.appendChild(U.el('div', { class: 'holehead' }, [
      U.el('div', { class: 'top' }, [
        U.el('div', { class: 'hno' }, [String(idx + 1), U.el('small', { text: ' / 18' })]),
        U.el('div', { class: 'meta' }, [
          U.el('div', { class: 'par', text: 'PAR ' + hole.par }),
          U.el('div', { class: 'dist', text: fmtDist(hole.dist) + ' · 난이도 ' + hole.hcp + '위' })
        ])
      ]),
      U.el('div', { class: 'muted sm mt8', text: hole.nineName + ' ' + hole.holeNo + '번홀 · ' + round.teeName }),
      U.el('div', { class: 'row between mt8' }, [
        U.el('div', { class: 'tiny', text: '현재 ' + t.holesPlayed + '홀 · ' + t.strokes + '타 (' + U.sign(t.toPar) + ') · ' + t.putts + '퍼트' }),
        App.kindBadge(round.kind)
      ])
    ]));

    // --- 공략법 ---
    var clubs = Store.swingClubs();
    var coursePar = round.holes.reduce(function (a, h) { return a + h.par; }, 0);
    var extra = Math.max(0, (Store.settings().targetScore || 90) - coursePar);
    var plan = Strategy.build(hole, {
      clubs: clubs, unit: Store.unit(), extraStrokes: extra,
      kind: round.kind, estimated: course && !course.verified
    });

    var planCard = U.el('div', { class: 'plan' }, [U.el('h3', {}, ['🎯 이 홀 공략법'])]);
    plan.steps.forEach(function (s) {
      if (!s.club) return;
      planCard.appendChild(U.el('div', { class: 'step' + (s.alt ? ' alt' : '') }, [
        U.el('div', { class: 'num', text: String(s.n) }),
        U.el('div', { class: 'body' }, [
          U.el('div', { class: 'lbl', text: s.label }),
          U.el('div', { class: 'club' }, [
            U.el('em', { text: s.club.name }),
            U.el('span', { style: 'color:var(--fg2);font-size:13px;font-weight:400' , text: '  ' + fmtDist(s.club.dist) + (s.remain > 0 ? '  →  남은 ' + fmtDist(s.remain) : '  →  그린') })
          ]),
          s.note ? U.el('div', { class: 'note', text: s.note }) : null
        ])
      ]));
    });
    var tipUl = U.el('ul', { class: 'tiplist' });
    plan.tips.forEach(function (tp) { tipUl.appendChild(U.el('li', { text: tp })); });
    planCard.appendChild(tipUl);

    // 나만의 메모
    var noteKeyArgs = [round.courseId, hole.nineId, hole.holeNo];
    var myNote = Store.getNote.apply(null, noteKeyArgs);
    if (myNote) {
      planCard.appendChild(U.el('div', { class: 'mynote' }, [
        U.el('div', { class: 't', text: '내 메모' }),
        U.el('div', { class: 'c', text: myNote })
      ]));
    }
    planCard.appendChild(U.el('button', {
      class: 'ghost full mt12 sm',
      onclick: function () { editNote(round.courseId, hole.nineId, hole.holeNo, hole); }
    }, myNote ? '내 메모 수정' : '+ 이 홀에 나만의 공략 메모 남기기'));
    body.appendChild(U.el('div', { class: 'section' }, [planCard]));

    // --- 사용 클럽 ---
    var suggested = {};
    plan.steps.forEach(function (s) { if (s.club && !s.alt) suggested[s.club.id] = true; });

    var grid = U.el('div', { class: 'clubgrid' });
    Store.clubs().forEach(function (c) {
      if (c.cat === 'putter') return;
      var used = hole.shots.indexOf(c.id) >= 0;
      grid.appendChild(U.el('button', {
        class: (suggested[c.id] ? 'sug' : '') + (used ? ' used' : ''),
        onclick: function () {
          hole.shots.push(c.id);
          recalc(hole);
          Store.save();
          App.go('play/' + roundId + '/' + idx);
        }
      }, [c.short || c.name, U.el('span', { class: 'd', text: c.dist ? fmtDist(c.dist) : '' })]));
    });

    var shotList = U.el('div', { class: 'shotlist' });
    if (!hole.shots.length) shotList.appendChild(U.el('span', { class: 'muted sm', text: '위에서 사용한 클럽을 순서대로 눌러주세요.' }));
    hole.shots.forEach(function (cid, i) {
      var c = Store.club(cid);
      shotList.appendChild(U.el('span', {
        class: 'shotchip',
        onclick: function () {
          hole.shots.splice(i, 1);
          recalc(hole); Store.save(); App.go('play/' + roundId + '/' + idx);
        }
      }, [
        U.el('span', { class: 'n', text: String(i + 1) }),
        c ? (c.short || c.name) : '?',
        U.el('span', { class: 'x', text: '×' })
      ]));
    });

    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('h2', { text: '사용한 클럽 (퍼팅 제외 · 누르면 추가, 칩을 누르면 삭제)' }),
      U.el('div', { class: 'card' }, [grid, shotList])
    ]));

    // --- 퍼팅 / 스코어 ---
    function stepper(value, onChange, min, max) {
      var vEl = U.el('span', { class: 'v', text: value === null || value === undefined ? '-' : String(value) });
      return U.el('div', { class: 'stepper' }, [
        U.el('button', {
          onclick: function () {
            var v = (value === null || value === undefined) ? (min || 0) : value - 1;
            if (v < (min || 0)) v = (min || 0);
            onChange(v);
          }
        }, '−'),
        vEl,
        U.el('button', {
          onclick: function () {
            var v = (value === null || value === undefined) ? (min || 0) + 1 : value + 1;
            if (max && v > max) v = max;
            onChange(v);
          }
        }, '+')
      ]);
    }

    var scoreCard = U.el('div', { class: 'card' });
    scoreCard.appendChild(U.el('div', { class: 'row between' }, [
      U.el('div', {}, [
        U.el('div', { style: 'font-weight:600', text: '퍼팅 수' }),
        U.el('div', { class: 'tiny', text: '그린 위 퍼터 사용 횟수' })
      ]),
      stepper(hole.putts, function (v) { hole.putts = v; recalc(hole); Store.save(); App.go('play/' + roundId + '/' + idx); }, 0, 10)
    ]));
    scoreCard.appendChild(U.el('hr', { class: 'sep' }));
    scoreCard.appendChild(U.el('div', { class: 'row between' }, [
      U.el('div', {}, [
        U.el('div', { style: 'font-weight:600' }, [
          '스코어 ',
          // 퍼팅까지 입력해야 홀이 끝난 것으로 보고 명칭을 표시한다 (샷 하나 눌렀을 때 "홀인원"이 뜨는 것 방지)
          (hole.score && typeof hole.putts === 'number')
            ? U.el('span', { class: U.scoreClass(hole.score, hole.par), text: '(' + U.scoreName(hole.score, hole.par) + ')' })
            : null
        ]),
        U.el('div', { class: 'tiny', text: '샷 ' + hole.shots.length + ' + 퍼팅 ' + (hole.putts || 0) + ' + 벌타 ' + (hole.penalty.ob + hole.penalty.hazard) + ' = ' + autoScore(hole) })
      ]),
      stepper(hole.score, function (v) { hole.score = v || null; hole.scoreManual = true; recalcGir(hole); Store.save(); App.go('play/' + roundId + '/' + idx); }, 1, 20)
    ]));
    body.appendChild(U.el('div', { class: 'section' }, [U.el('h2', { text: '스코어' }), scoreCard]));

    // --- 샷 결과 ---
    var detail = U.el('div', { class: 'card' });
    if (hole.par >= 4) {
      var fwSeg = U.el('div', { class: 'seg' });
      [['left', '좌측 미스'], ['hit', '페어웨이'], ['right', '우측 미스']].forEach(function (o) {
        fwSeg.appendChild(U.el('button', {
          class: hole.fairway === o[0] ? 'on' : '',
          onclick: function () {
            hole.fairway = hole.fairway === o[0] ? null : o[0];
            Store.save(); App.go('play/' + roundId + '/' + idx);
          }
        }, o[1]));
      });
      detail.appendChild(U.el('div', { class: 'mb8', style: 'font-size:13px;color:var(--fg2)', text: '티샷 결과' }));
      detail.appendChild(fwSeg);
      detail.appendChild(U.el('hr', { class: 'sep' }));
    }

    var girSeg = U.el('div', { class: 'seg' });
    [[true, '파온 성공'], [false, '파온 실패']].forEach(function (o) {
      girSeg.appendChild(U.el('button', {
        class: hole.gir === o[0] ? 'on' : '',
        onclick: function () {
          hole.gir = hole.gir === o[0] ? null : o[0];
          hole.girManual = true;
          Store.save(); App.go('play/' + roundId + '/' + idx);
        }
      }, o[1]));
    });
    detail.appendChild(U.el('div', { class: 'mb8', style: 'font-size:13px;color:var(--fg2)', text: '그린 적중 (규정 타수 안에 그린 온) · 스코어·퍼팅 입력 시 자동 판정' }));
    detail.appendChild(girSeg);
    detail.appendChild(U.el('hr', { class: 'sep' }));

    var penRow = U.el('div', { class: 'row', style: 'gap:14px;flex-wrap:wrap' });
    [['ob', 'OB'], ['hazard', '해저드'], ['bunker', '벙커']].forEach(function (p) {
      var isBunker = p[0] === 'bunker';
      var val = isBunker ? (hole.bunker || 0) : hole.penalty[p[0]];
      penRow.appendChild(U.el('div', { class: 'row', style: 'gap:6px' }, [
        U.el('span', { class: 'muted sm', text: p[1] }),
        U.el('button', { class: 'sm', onclick: function () {
          var v = Math.max(0, val - 1);
          if (isBunker) hole.bunker = v; else hole.penalty[p[0]] = v;
          recalc(hole); Store.save(); App.go('play/' + roundId + '/' + idx);
        } }, '−'),
        U.el('span', { style: 'min-width:18px;text-align:center;font-weight:700', text: String(val) }),
        U.el('button', { class: 'sm', onclick: function () {
          var v = val + 1;
          if (isBunker) hole.bunker = v; else hole.penalty[p[0]] = v;
          recalc(hole); Store.save(); App.go('play/' + roundId + '/' + idx);
        } }, '+')
      ]));
    });
    detail.appendChild(U.el('div', { class: 'mb8', style: 'font-size:13px;color:var(--fg2)', text: '벌타 / 벙커' }));
    detail.appendChild(penRow);

    body.appendChild(U.el('div', { class: 'section' }, [U.el('h2', { text: '샷 결과' }), detail]));

    // --- 홀 메모 ---
    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('h2', { text: '이 홀 한줄 기록' }),
      U.el('input', {
        type: 'text', value: hole.memo || '', placeholder: '예: 세컨 오른쪽 벙커, 어프로치 짧았음',
        onchange: function (e) { hole.memo = e.target.value; Store.save(); }
      })
    ]));

    // --- 이동 ---
    var nav = U.el('div', { class: 'holenav' }, [
      U.el('button', { disabled: idx === 0, onclick: function () { App.go('play/' + roundId + '/' + (idx - 1)); } }, '‹ 이전'),
      U.el('div', { class: 'pos', text: (idx + 1) + ' / 18' }),
      idx < 17
        ? U.el('button', { class: 'primary', onclick: function () { App.go('play/' + roundId + '/' + (idx + 1)); } }, '다음 ›')
        : U.el('button', { class: 'primary', onclick: function () { finish(round); } }, '라운드 종료')
    ]);
    body.appendChild(nav);

    body.appendChild(U.el('div', { class: 'btnrow mt12' }, [
      U.el('button', { class: 'ghost sm', onclick: function () { App.go('round/' + roundId); } }, '스코어카드 보기'),
      U.el('button', { class: 'ghost sm', onclick: function () { finish(round); } }, '라운드 종료')
    ]));

    return {
      title: round.courseName,
      sub: hole.nineName + ' ' + hole.holeNo + '번홀',
      body: body, back: true, keepScroll: true
    };
  };

  function autoScore(h) {
    return h.shots.length + (h.putts || 0) + (h.penalty.ob || 0) + (h.penalty.hazard || 0);
  }
  // 스코어를 수동으로 고치지 않았다면 자동 계산값을 채운다
  function recalc(h) {
    if (!h.scoreManual) {
      var s = autoScore(h);
      h.score = s > 0 ? s : null;
    }
    recalcGir(h);
  }
  function recalcGir(h) {
    if (h.girManual) return;
    if (h.score && typeof h.putts === 'number') {
      h.gir = (h.score - h.putts) <= (h.par - 2);
    }
  }

  function editNote(courseId, nineId, holeNo, hole) {
    var ta = U.el('textarea', {
      placeholder: '예)\n티샷은 좌측 벙커 넘기면 안 됨. 우측 나무 앞이 안전.\n그린은 뒤에서 앞으로 빠름. 핀 뒤에 붙이면 3퍼트.',
      rows: 6
    });
    ta.value = Store.getNote(courseId, nineId, holeNo);
    var m = App.modal(
      hole.nineName + ' ' + holeNo + '번홀 (파' + hole.par + ') 나만의 공략',
      U.el('div', {}, [
        U.el('div', { class: 'muted sm mb8', text: '여기 적어두면 다음에 이 홀에 올 때 공략법 아래에 같이 표시됩니다.' }),
        ta
      ]),
      U.el('div', { class: 'btnrow mt16' }, [
        U.el('button', { onclick: function () { m.close(); } }, '취소'),
        U.el('button', { class: 'primary', onclick: function () {
          Store.setNote(courseId, nineId, holeNo, ta.value);
          m.close(); App.render(); U.toast('메모를 저장했습니다.');
        } }, '저장')
      ])
    );
    setTimeout(function () { ta.focus(); }, 50);
  }

  function finish(round) {
    var t = Store.totals(round);
    if (t.holesPlayed < 18) {
      if (!U.confirm(t.holesPlayed + '홀만 기록되었습니다. 그래도 라운드를 종료할까요?')) return;
    }
    Store.finishRound(round.id);
    U.toast('라운드를 저장했습니다.');
    App.go('round/' + round.id);
  }

  /* ============================================================
     3. 스코어카드
     ============================================================ */
  App.views['round'] = function (params) {
    var round = Store.round(params[0]);
    if (!round) return { title: '라운드 없음', body: App.empty('❓', '해당 라운드를 찾을 수 없습니다.', '홈으로', function () { App.go('home'); }), back: true };

    var t = Store.totals(round);
    var body = U.el('div');

    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('div', { class: 'card' }, [
        U.el('div', { class: 'row', style: 'gap:6px' }, [
          App.kindBadge(round.kind),
          U.el('span', { class: 'badge', text: round.teeName }),
          round.done ? null : U.el('span', { class: 'badge live', text: '미완료' })
        ]),
        U.el('div', { class: 'mt8', style: 'font-size:18px;font-weight:700', text: round.courseName }),
        U.el('div', { class: 'muted sm', text: U.fmtDate(round.date) + ' · ' + round.nineNames.join(' + ') + (round.memo ? ' · ' + round.memo : '') })
      ]),
      U.el('div', { class: 'tiles' }, [
        App.tile(t.strokes, '총 타수', U.sign(t.toPar)),
        App.tile(t.putts, '퍼팅', t.holesPlayed ? U.round1(t.putts / t.holesPlayed) + '/홀' : ''),
        App.tile(U.pct(t.gir, t.girChance) === null ? '-' : U.pct(t.gir, t.girChance) + '%', '파온', t.gir + '/' + t.girChance),
        App.tile(U.pct(t.fwHit, t.fwChance) === null ? '-' : U.pct(t.fwHit, t.fwChance) + '%', '페어웨이', t.fwHit + '/' + t.fwChance)
      ]),
      U.el('div', { class: 'tiles mt8' }, [
        App.tile(t.birdieOrBetter, '버디 이상'),
        App.tile(t.par, '파'),
        App.tile(t.bogey, '보기'),
        App.tile(t.doubleOrWorse, '더블+'),
        App.tile(t.threePutt, '3퍼트'),
        App.tile(t.ob + t.hazard, '벌타')
      ])
    ]));

    // 스코어카드 표
    function tableFor(from, to, label) {
      var holes = round.holes.slice(from, to);
      var tbl = U.el('table', { class: 'scard' });
      var head = U.el('tr', {}, [U.el('th', { text: '홀' })]);
      holes.forEach(function (h) { head.appendChild(U.el('th', { text: String(h.no) })); });
      head.appendChild(U.el('th', { text: label }));
      tbl.appendChild(U.el('thead', {}, [head]));

      var tb = U.el('tbody');
      function row(lbl, fn, cls) {
        var tr = U.el('tr', { class: cls || '' }, [U.el('td', { class: 'lbl', text: lbl })]);
        holes.forEach(function (h, i) { tr.appendChild(fn(h, i)); });
        return tr;
      }
      var parSum = holes.reduce(function (a, h) { return a + h.par; }, 0);
      var scSum = holes.reduce(function (a, h) { return a + (h.score || 0); }, 0);
      var ptSum = holes.reduce(function (a, h) { return a + (h.putts || 0); }, 0);

      var trPar = row('파', function (h) { return U.el('td', { text: String(h.par) }); });
      trPar.appendChild(U.el('td', { style: 'font-weight:700', text: String(parSum) }));
      tb.appendChild(trPar);

      var trDist = row(U.unitLabel(Store.unit()), function (h) { return U.el('td', { class: 'tiny', text: String(U.toDisplay(h.dist, Store.unit())) }); });
      trDist.appendChild(U.el('td', { class: 'tiny', text: String(U.toDisplay(holes.reduce(function (a, h) { return a + h.dist; }, 0), Store.unit())) }));
      tb.appendChild(trDist);

      var trSc = row('스코어', function (h, i) {
        return U.el('td', {
          class: 'score ' + U.scoreClass(h.score, h.par),
          style: 'cursor:pointer',
          onclick: function () { App.go('play/' + round.id + '/' + (from + i)); },
          text: h.score ? String(h.score) : '-'
        });
      }, 'sum');
      trSc.appendChild(U.el('td', { text: scSum ? String(scSum) : '-' }));
      tb.appendChild(trSc);

      var trPt = row('퍼팅', function (h) { return U.el('td', { text: typeof h.putts === 'number' ? String(h.putts) : '-' }); });
      trPt.appendChild(U.el('td', { style: 'font-weight:700', text: String(ptSum) }));
      tb.appendChild(trPt);

      var trCl = row('티샷', function (h) {
        var c = h.shots.length ? Store.club(h.shots[0]) : null;
        return U.el('td', { class: 'tiny', text: c ? (c.short || c.name) : '-' });
      });
      trCl.appendChild(U.el('td', { text: '' }));
      tb.appendChild(trCl);

      tbl.appendChild(tb);
      return U.el('div', { class: 'cardwrap mb8' }, [tbl]);
    }

    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('h2', { text: '스코어카드 (숫자를 누르면 그 홀로 이동)' }),
      tableFor(0, 9, 'OUT'),
      tableFor(9, 18, 'IN')
    ]));

    // 홀 메모 모음
    var memos = round.holes.filter(function (h) { return h.memo; });
    if (memos.length) {
      var ml = U.el('div', { class: 'list' });
      memos.forEach(function (h) {
        ml.appendChild(U.el('div', { class: 'item', onclick: function () { App.go('play/' + round.id + '/' + (h.no - 1)); } }, [
          U.el('div', { class: 'main' }, [
            U.el('div', { class: 'title', text: h.no + '번홀 (파' + h.par + ')' }),
            U.el('div', { class: 'desc', text: h.memo })
          ])
        ]));
      });
      body.appendChild(U.el('div', { class: 'section' }, [U.el('h2', { text: '홀 기록' }), ml]));
    }

    body.appendChild(U.el('div', { class: 'btnrow' }, [
      round.done
        ? U.el('button', { onclick: function () { Store.reopenRound(round.id); App.go('play/' + round.id + '/0'); } }, '이어서 수정')
        : U.el('button', { class: 'primary', onclick: function () { App.go('play/' + round.id + '/0'); } }, '이어서 기록'),
      U.el('button', { class: 'danger', onclick: function () {
        if (U.confirm('이 라운드를 삭제할까요? 되돌릴 수 없습니다.')) { Store.removeRound(round.id); App.go('home'); }
      } }, '삭제')
    ]));

    return { title: '스코어카드', sub: round.courseName, body: body, back: true };
  };
})(window);
