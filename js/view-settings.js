/* 설정 화면: 클럽 거리 / 골프장 관리 / 백업 / 구글 시트 */
(function (g) {
  'use strict';

  /* ============================================================
     설정 메인
     ============================================================ */
  App.views['settings'] = function () {
    var st = Store.get();
    var body = U.el('div');

    // 기본 설정
    var card = U.el('div', { class: 'card' }, [
      U.el('label', { class: 'field' }, [
        U.el('span', { text: '이름 (선택)' }),
        U.el('input', { type: 'text', value: st.settings.playerName || '', placeholder: '홍길동',
          onchange: function (e) { Store.setSetting('playerName', e.target.value); } })
      ]),
      U.el('label', { class: 'field' }, [
        U.el('span', { text: '거리 단위' }),
        (function () {
          var seg = U.el('div', { class: 'seg' });
          [['m', '미터 (m)'], ['y', '야드 (yd)']].forEach(function (o) {
            seg.appendChild(U.el('button', {
              class: st.settings.unit === o[0] ? 'on' : '',
              onclick: function () { Store.setSetting('unit', o[0]); App.render(); }
            }, o[1]));
          });
          return seg;
        })()
      ]),
      U.el('label', { class: 'field' }, [
        U.el('span', { text: '기본 티박스' }),
        (function () {
          var sel = U.el('select', { onchange: function (e) { Store.setSetting('defaultTee', e.target.value); } });
          COURSE_DATA.TEES.forEach(function (t) {
            sel.appendChild(U.el('option', { value: t.id, selected: st.settings.defaultTee === t.id }, t.name));
          });
          return sel;
        })()
      ]),
      U.el('label', { class: 'field', style: 'margin-bottom:0' }, [
        U.el('span', { text: '목표 스코어 (홀별 목표 타수 계산에 사용)' }),
        U.el('input', {
          type: 'number', value: st.settings.targetScore || 90, min: 60, max: 130,
          onchange: function (e) { Store.setSetting('targetScore', parseInt(e.target.value, 10) || 90); }
        })
      ])
    ]);
    body.appendChild(U.el('div', { class: 'section' }, [U.el('h2', { text: '기본 설정' }), card]));

    // 메뉴
    var menu = U.el('div', { class: 'list' });
    [
      ['clubs', '⛳', '내 클럽 거리', Store.clubs().filter(function (c) { return c.dist > 0; }).length + '개 클럽 등록됨 · 공략법 계산에 사용'],
      ['courses', '🏌', '골프장 관리', Store.courses().length + '곳 (필드 ' + Store.courses('field').length + ' / 스크린 ' + Store.courses('screen').length + ')'],
      ['sheets', '☁', '구글 시트 동기화', st.settings.gsheet.spreadsheetId ? '연결됨 · 마지막 동기화 ' + (st.settings.gsheet.lastSync ? U.fmtDate(st.settings.gsheet.lastSync.slice(0, 10)) : '없음') : '설정 안 됨 (선택 사항)']
    ].forEach(function (m) {
      menu.appendChild(U.el('div', { class: 'item', onclick: function () { App.go(m[0]); } }, [
        U.el('div', { style: 'font-size:20px;width:26px;text-align:center', text: m[1] }),
        U.el('div', { class: 'main' }, [
          U.el('div', { class: 'title', text: m[2] }),
          U.el('div', { class: 'desc', text: m[3] })
        ]),
        U.el('div', { class: 'right muted', text: '›' })
      ]));
    });
    body.appendChild(U.el('div', { class: 'section' }, [U.el('h2', { text: '관리' }), menu]));

    // 백업
    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('h2', { text: '백업 / 복원' }),
      U.el('div', { class: 'card' }, [
        U.el('div', { class: 'muted sm', text: '이 앱의 기록은 이 브라우저 안에 저장됩니다. 브라우저 데이터를 지우면 사라지므로 가끔 파일로 백업해 두세요.' }),
        U.el('div', { class: 'btnrow mt12' }, [
          U.el('button', { onclick: function () {
            U.download('golf-backup-' + U.today() + '.json', Store.exportJSON());
            U.toast('백업 파일을 내려받았습니다.');
          } }, '백업 파일 저장'),
          U.el('button', { onclick: importDialog }, '백업 복원')
        ]),
        U.el('div', { class: 'mt12' }, [
          U.el('button', { class: 'ghost full sm', onclick: function () {
            U.download('golf-scores-' + U.today() + '.csv', toCSV());
            U.toast('CSV를 내려받았습니다. 엑셀/구글시트에서 열 수 있습니다.');
          } }, 'CSV로 내보내기 (엑셀·구글시트용)')
        ])
      ])
    ]));

    // 데이터 초기화
    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('div', { class: 'card' }, [
        U.el('button', { class: 'ghost full sm', onclick: function () {
          var n = Store.restoreBuiltins();
          U.toast(n ? n + '곳의 기본 골프장을 추가했습니다.' : '추가할 기본 골프장이 없습니다.');
          App.render();
        } }, '기본 골프장 목록 다시 불러오기'),
        U.el('button', { class: 'danger full sm mt8', onclick: function () {
          if (U.confirm('모든 라운드 기록과 설정을 삭제합니다. 정말 진행할까요?')) {
            if (U.confirm('마지막 확인입니다. 백업은 받으셨나요? 삭제하면 복구할 수 없습니다.')) {
              Store.clearAll(); U.toast('초기화했습니다.'); App.go('home');
            }
          }
        } }, '전체 데이터 삭제')
      ]),
      U.el('div', { class: 'tiny center mt8', text: '골프 스코어 관리 v1.0 · 오프라인 동작' })
    ]));

    return { title: '설정', body: body };
  };

  function importDialog() {
    var input = U.el('input', { type: 'file', accept: '.json,application/json' });
    var modeSel = U.el('select', {}, [
      U.el('option', { value: 'merge' }, '합치기 (기존 기록 유지, 없는 것만 추가)'),
      U.el('option', { value: 'replace' }, '덮어쓰기 (기존 기록 전부 교체)')
    ]);
    var m = App.modal('백업 복원', U.el('div', {}, [
      U.el('label', { class: 'field' }, [U.el('span', { text: '백업 파일 (.json)' }), input]),
      U.el('label', { class: 'field' }, [U.el('span', { text: '방식' }), modeSel])
    ]), U.el('div', { class: 'btnrow mt16' }, [
      U.el('button', { onclick: function () { m.close(); } }, '취소'),
      U.el('button', { class: 'primary', onclick: function () {
        var f = input.files && input.files[0];
        if (!f) { U.toast('파일을 선택하세요.', 'err'); return; }
        var fr = new FileReader();
        fr.onload = function () {
          try {
            var res = Store.importJSON(String(fr.result), modeSel.value);
            m.close();
            U.toast('복원 완료: 라운드 ' + res.rounds + '건');
            App.go('home');
          } catch (e) { U.toast('복원 실패: ' + e.message, 'err'); }
        };
        fr.readAsText(f);
      } }, '복원')
    ]));
  }

  // 홀 단위 CSV (구글 시트에 그대로 붙여넣기 가능)
  function toCSV() {
    var unit = Store.unit();
    var head = ['날짜', '구분', '골프장', '코스', '티', '날씨', '동반자', '홀', '파', '거리(' + U.unitLabel(unit) + ')',
      '스코어', '파대비', '퍼팅', '티샷클럽', '사용클럽', '페어웨이', '파온',
      '아이언샷', 'OB', '해저드', '벙커', '메모'];
    var rows = [head];
    Store.rounds().forEach(function (r) {
      r.holes.forEach(function (h) {
        if (!h.score && typeof h.putts !== 'number') return;
        var clubs = h.shots.map(function (id) { var c = Store.club(id); return c ? (c.short || c.name) : '?'; });
        rows.push([
          r.date, r.kind === 'screen' ? '스크린' : '필드', r.courseName, h.nineName, r.teeName,
          r.weather || '', (r.partners || []).join(', '),
          h.no, h.par, U.toDisplay(h.dist, unit),
          h.score || '', h.score ? (h.score - h.par) : '', (typeof h.putts === 'number' ? h.putts : ''),
          clubs[0] || '', clubs.join(' '),
          h.fairway === 'hit' ? '페어웨이' : h.fairway === 'left' ? '좌' : h.fairway === 'right' ? '우' : '',
          h.gir === true ? 'O' : h.gir === false ? 'X' : '',
          App.approachText(h), h.penalty.ob || 0, h.penalty.hazard || 0, h.bunker || 0, (h.memo || '')
        ]);
      });
    });
    return '﻿' + rows.map(function (row) {
      return row.map(function (v) {
        var s = String(v === null || v === undefined ? '' : v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\n');
  }
  App.toCSV = toCSV;

  /* ============================================================
     내 클럽 거리
     ============================================================ */
  App.views['clubs'] = function () {
    var unit = Store.unit();
    var body = U.el('div');

    body.appendChild(U.el('div', { class: 'card' }, [
      U.el('div', { style: 'font-weight:600', text: '왜 필요한가요?' }),
      U.el('div', { class: 'muted sm mt8', text: '홀 거리와 내 클럽 거리를 비교해서 "티샷 드라이버 → 남은 145m는 6번 아이언" 같은 공략 루트를 계산합니다. 거리가 정확할수록 공략이 정확해집니다.' }),
      U.el('div', { class: 'muted sm mt8', text: '팁: 굴러간 거리 말고 공이 떨어진 지점(캐리) 기준으로, 잘 맞았을 때가 아니라 평소 열 번 중 일곱 번 나오는 거리를 넣으세요.' })
    ]));

    var groups = [
      ['wood', '우드 / 드라이버'],
      ['hybrid', '유틸리티'],
      ['iron', '아이언'],
      ['wedge', '웨지'],
      ['putter', '퍼터']
    ];

    groups.forEach(function (grp) {
      var list = Store.clubs().filter(function (c) { return c.cat === grp[0]; });
      if (!list.length) return;
      var box = U.el('div', { class: 'list' });
      list.forEach(function (c) {
        var isPutter = c.cat === 'putter';
        box.appendChild(U.el('div', { class: 'item', style: 'cursor:default' }, [
          U.el('div', { class: 'main' }, [
            U.el('div', { class: 'title', text: c.name }),
            U.el('div', { class: 'desc', text: c.short || '' })
          ]),
          isPutter ? U.el('div', { class: 'muted sm', text: '-' }) : U.el('div', { class: 'row', style: 'gap:6px;width:132px' }, [
            U.el('input', {
              type: 'number', class: 'num', inputmode: 'numeric',
              value: c.dist ? U.toDisplay(c.dist, unit) : '',
              placeholder: '0',
              onchange: function (e) {
                Store.setClubDist(c.id, U.fromDisplay(e.target.value, unit) || 0);
                U.toast(c.name + ' 거리를 저장했습니다.');
              }
            }),
            U.el('span', { class: 'muted sm', text: U.unitLabel(unit) })
          ]),
          c.custom ? U.el('button', { class: 'sm ghost', onclick: function () {
            if (U.confirm(c.name + ' 클럽을 삭제할까요?')) { Store.removeClub(c.id); App.render(); }
          } }, '×') : null
        ]));
      });
      body.appendChild(U.el('div', { class: 'section' }, [U.el('h2', { text: grp[1] }), box]));
    });

    body.appendChild(U.el('div', { class: 'btnrow' }, [
      U.el('button', { onclick: addClubDialog }, '+ 클럽 추가'),
      U.el('button', { class: 'ghost', onclick: function () {
        if (U.confirm('클럽 목록과 거리를 기본값으로 되돌릴까요?')) { Store.resetClubs(); App.render(); }
      } }, '기본값으로')
    ]));

    // 거리 간격 점검
    var sw = Store.swingClubs();
    if (sw.length >= 3) {
      var warn = [];
      for (var i = 0; i < sw.length - 1; i++) {
        var gap = sw[i].dist - sw[i + 1].dist;
        if (gap <= 3) warn.push(sw[i].name + ' 과(와) ' + sw[i + 1].name + ' 거리 차이가 ' + gap + U.unitLabel(unit) + '뿐입니다.');
        if (gap >= 25) warn.push(sw[i].name + ' 과(와) ' + sw[i + 1].name + ' 사이에 ' + gap + U.unitLabel(unit) + ' 공백이 있습니다.');
      }
      if (warn.length) {
        var wl = U.el('ul', { class: 'tiplist' });
        warn.slice(0, 6).forEach(function (w) { wl.appendChild(U.el('li', { text: w })); });
        body.appendChild(U.el('div', { class: 'section mt16' }, [
          U.el('h2', { text: '거리 간격 점검' }),
          U.el('div', { class: 'card' }, [
            U.el('div', { class: 'muted sm', text: '클럽 간격이 너무 좁거나(중복) 너무 넓으면(공백) 애매한 거리가 생깁니다.' }),
            wl
          ])
        ]));
      }
    }

    return { title: '내 클럽 거리', sub: '공략법 계산의 기준', body: body, back: true };
  };

  function addClubDialog() {
    var name = U.el('input', { type: 'text', placeholder: '예: 7번 우드' });
    var short = U.el('input', { type: 'text', placeholder: '예: 7W', maxlength: 4 });
    var dist = U.el('input', { type: 'number', placeholder: '예: 165' });
    var cat = U.el('select', {}, [
      U.el('option', { value: 'wood' }, '우드'),
      U.el('option', { value: 'hybrid' }, '유틸리티'),
      U.el('option', { value: 'iron' }, '아이언'),
      U.el('option', { value: 'wedge' }, '웨지')
    ]);
    var m = App.modal('클럽 추가', U.el('div', {}, [
      U.el('label', { class: 'field' }, [U.el('span', { text: '클럽 이름' }), name]),
      U.el('label', { class: 'field' }, [U.el('span', { text: '짧은 표기 (버튼에 표시)' }), short]),
      U.el('label', { class: 'field' }, [U.el('span', { text: '종류' }), cat]),
      U.el('label', { class: 'field' }, [U.el('span', { text: '거리 (' + U.unitLabel(Store.unit()) + ')' }), dist])
    ]), U.el('div', { class: 'btnrow mt16' }, [
      U.el('button', { onclick: function () { m.close(); } }, '취소'),
      U.el('button', { class: 'primary', onclick: function () {
        if (!name.value.trim()) { U.toast('이름을 입력하세요.', 'err'); return; }
        Store.addClub(name.value.trim(), (short.value || name.value).trim().slice(0, 4), cat.value,
          U.fromDisplay(dist.value, Store.unit()) || 0);
        m.close(); App.render();
      } }, '추가')
    ]));
  }

  /* ============================================================
     골프장 관리
     ============================================================ */
  var CQ = { q: '', kind: 'field' };

  App.views['courses'] = function () {
    var body = U.el('div');

    var seg = U.el('div', { class: 'seg' });
    [['field', '필드'], ['screen', '스크린']].forEach(function (o) {
      seg.appendChild(U.el('button', { class: CQ.kind === o[0] ? 'on' : '', onclick: function () { CQ.kind = o[0]; App.render(); } }, o[1]));
    });
    body.appendChild(U.el('div', { class: 'section' }, [seg]));

    var listWrap = U.el('div');
    var search = U.el('div', { class: 'search' }, [
      U.el('input', { type: 'search', placeholder: '골프장 검색', value: CQ.q, oninput: function (e) { CQ.q = e.target.value; draw(); } })
    ]);

    function draw() {
      var q = CQ.q.trim();
      var list = Store.courses(CQ.kind).filter(function (c) { return Store.matchCourse(c, q); });
      // 자주 가는 곳을 위로
      list.sort(function (a, b) { return (b.fav ? 1 : 0) - (a.fav ? 1 : 0); });
      listWrap.innerHTML = '';
      var box = U.el('div', { class: 'list' });
      list.forEach(function (c) {
        box.appendChild(U.el('div', { class: 'item', onclick: function () { App.go('course/' + c.id); } }, [
          U.el('div', { class: 'main' }, [
            U.el('div', { class: 'title nowrap', text: c.name }),
            U.el('div', { class: 'desc nowrap' }, [
              (c.region || '') + ' · ' + c.nines.length + '개 코스 ',
              App.estBadge(c),
              c.builtin ? null : U.el('span', { class: 'badge', style: 'margin-left:4px', text: '직접 추가' })
            ])
          ]),
          U.el('button', {
            class: 'star' + (c.fav ? ' on' : ''), 'aria-label': '자주 가는 곳',
            onclick: function (e) { e.stopPropagation(); Store.toggleFav(c.id); draw(); }
          }, c.fav ? '★' : '☆')
        ]));
      });
      listWrap.appendChild(box);
      if (!list.length) listWrap.appendChild(App.empty('🔍', '결과가 없습니다.'));
    }
    draw();

    body.appendChild(U.el('div', { class: 'section' }, [search, listWrap]));
    body.appendChild(U.el('button', {
      class: 'primary full', onclick: function () { App.go('course/new/' + CQ.kind); }
    }, '+ 골프장 추가'));

    return { title: '골프장 관리', sub: '거리·파를 실제 값으로 수정하세요', body: body, back: true };
  };

  /* ---------- 골프장 상세 / 편집 ---------- */
  var CE = { nineIdx: 0 };

  App.views['course'] = function (params) {
    var course;
    var isNew = params[0] === 'new';
    if (isNew) {
      course = COURSE_DATA.blank(params[1] || 'field');
      Store.addCourse(course);
      CE.nineIdx = 0;
      App.go('course/' + course.id);
      return { title: '...', body: U.el('div') };
    }
    course = Store.course(params[0]);
    if (!course) return { title: '없음', body: App.empty('❓', '골프장을 찾을 수 없습니다.', '목록으로', function () { App.go('courses'); }), back: true };
    if (CE.nineIdx >= course.nines.length) CE.nineIdx = 0;

    var unit = Store.unit();
    var body = U.el('div');

    // 기본 정보
    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('h2', { text: '기본 정보' }),
      U.el('div', { class: 'card' }, [
        U.el('label', { class: 'field' }, [
          U.el('span', { text: '골프장 이름' }),
          U.el('input', { type: 'text', value: course.name, placeholder: '예: 롱타인 골프클럽',
            onchange: function (e) { course.name = e.target.value; Store.save(); } })
        ]),
        U.el('label', { class: 'field' }, [
          U.el('span', { text: '지역' }),
          U.el('input', { type: 'text', value: course.region || '', placeholder: '예: 동나이',
            onchange: function (e) { course.region = e.target.value; Store.save(); } })
        ]),
        U.el('label', { class: 'field' }, [
          U.el('span', { text: '별칭 (검색용 · 띄어쓰기로 여러 개)' }),
          U.el('input', { type: 'text', value: course.alias || '', placeholder: '예: 동모 Dong Mo 킹아',
            onchange: function (e) { course.alias = e.target.value; Store.save(); } })
        ]),
        U.el('div', { class: 'field' }, [
          U.el('span', { style: 'display:block;font-size:13px;color:var(--fg2);margin-bottom:5px', text: '자주 가는 곳' }),
          U.el('button', {
            class: course.fav ? 'primary full' : 'full',
            onclick: function () { Store.toggleFav(course.id); App.render(); }
          }, course.fav ? '★ 목록 맨 위에 고정됨 (누르면 해제)' : '☆ 자주 가는 곳으로 고정하기')
        ]),
        U.el('label', { class: 'field', style: 'margin-bottom:0' }, [
          U.el('span', { text: '구분' }),
          (function () {
            var seg = U.el('div', { class: 'seg' });
            [['field', '필드'], ['screen', '스크린']].forEach(function (o) {
              seg.appendChild(U.el('button', {
                class: course.kind === o[0] ? 'on' : '',
                onclick: function () { course.kind = o[0]; Store.save(); App.render(); }
              }, o[1]));
            });
            return seg;
          })()
        ])
      ])
    ]));

    var infoCard = App.courseInfoCard(course);
    if (infoCard) {
      body.appendChild(U.el('div', { class: 'section' }, [U.el('h2', { text: '골프장 정보' }), infoCard]));
    }
    if (!course.verified && (course.quality === 'est' || course.quality === 'total')) {
      body.appendChild(U.el('div', { class: 'card', style: 'border-color:#6b4d1f' }, [
        U.el('div', { class: 'row', style: 'gap:8px' }, [
          App.estBadge(course),
          U.el('span', { class: 'muted sm grow', text: '홀별 파/거리가 추정값입니다.' })
        ]),
        U.el('div', { class: 'muted sm mt8', text: '실제 스코어카드를 보고 아래 표를 채운 뒤 "실제 값으로 확인함"을 누르면 공략법이 정확해집니다.' })
      ]));
    }

    // 코스(9홀) 탭
    var tabs = U.el('div', { class: 'holebar' });
    course.nines.forEach(function (n, i) {
      tabs.appendChild(U.el('button', {
        class: i === CE.nineIdx ? 'cur' : '', style: 'min-width:auto;padding:8px 12px',
        onclick: function () { CE.nineIdx = i; App.render(); }
      }, n.name));
    });
    tabs.appendChild(U.el('button', {
      style: 'min-width:auto;padding:8px 12px', onclick: function () {
        var id = course.id + '-n' + Date.now().toString(36);
        course.nines.push({
          id: id, name: '새 코스',
          holes: COURSE_DATA.ROUTINGS[0].map(function (p, i) { return { no: i + 1, par: p, dist: COURSE_DATA.estDistance(id + '|' + i, p) }; })
        });
        CE.nineIdx = course.nines.length - 1;
        Store.save(); App.render();
      }
    }, '+ 코스'));
    body.appendChild(tabs);

    var nine = course.nines[CE.nineIdx];
    var parSum = nine.holes.reduce(function (a, h) { return a + h.par; }, 0);
    var distSum = nine.holes.reduce(function (a, h) { return a + h.dist; }, 0);

    var tbl = U.el('table', { class: 'edit' });
    tbl.appendChild(U.el('thead', {}, [U.el('tr', {}, [
      U.el('th', { text: '홀' }), U.el('th', { text: '파' }),
      U.el('th', { text: '블랙티 거리 (' + U.unitLabel(unit) + ')' })
    ])]));
    var tb = U.el('tbody');
    nine.holes.forEach(function (h) {
      var parSel = U.el('select', { onchange: function (e) { h.par = parseInt(e.target.value, 10); Store.save(); App.render(); } });
      [3, 4, 5, 6].forEach(function (p) { parSel.appendChild(U.el('option', { value: p, selected: h.par === p }, String(p))); });
      tb.appendChild(U.el('tr', {}, [
        U.el('td', { class: 'no', text: String(h.no) }),
        U.el('td', {}, [parSel]),
        U.el('td', {}, [U.el('input', {
          type: 'number', class: 'num', inputmode: 'numeric', value: U.toDisplay(h.dist, unit),
          onchange: function (e) { h.dist = U.fromDisplay(e.target.value, unit) || h.dist; Store.save(); App.render(); }
        })])
      ]));
    });
    tbl.appendChild(tb);

    body.appendChild(U.el('div', { class: 'section' }, [
      U.el('div', { class: 'row between' }, [
        U.el('h2', { class: 'grow', text: nine.name + ' — 파 ' + parSum + ' · ' + U.toDisplay(distSum, unit) + U.unitLabel(unit) })
      ]),
      U.el('div', { class: 'card' }, [
        U.el('label', { class: 'field' }, [
          U.el('span', { text: '코스 이름' }),
          U.el('input', { type: 'text', value: nine.name, onchange: function (e) { nine.name = e.target.value; Store.save(); App.render(); } })
        ]),
        tbl,
        U.el('div', { class: 'tiny mt8', text: '블랙(챔피언) 티 기준 거리를 넣으세요. 블루/화이트/레드는 자동으로 비율 계산됩니다.' }),
        course.nines.length > 1 ? U.el('button', { class: 'danger full sm mt12', onclick: function () {
          if (U.confirm(nine.name + ' 코스를 삭제할까요?')) {
            course.nines.splice(CE.nineIdx, 1); CE.nineIdx = 0; Store.save(); App.render();
          }
        } }, '이 코스 삭제') : null
      ])
    ]));

    // 이 골프장의 내 메모 모음
    var notes = [];
    var st = Store.get();
    Object.keys(st.holeNotes).forEach(function (k) {
      var p = k.split('|');
      if (p[0] !== course.id) return;
      var n = null;
      course.nines.forEach(function (x) { if (x.id === p[1]) n = x; });
      notes.push({ nineName: n ? n.name : '?', holeNo: p[2], text: st.holeNotes[k], key: k });
    });
    if (notes.length) {
      var nl = U.el('div', { class: 'list' });
      notes.forEach(function (n) {
        nl.appendChild(U.el('div', { class: 'item', style: 'cursor:default' }, [
          U.el('div', { class: 'main' }, [
            U.el('div', { class: 'title', text: n.nineName + ' ' + n.holeNo + '번홀' }),
            U.el('div', { class: 'desc', style: 'white-space:pre-wrap', text: n.text })
          ]),
          U.el('button', { class: 'sm ghost', onclick: function () {
            if (U.confirm('이 메모를 삭제할까요?')) { delete Store.get().holeNotes[n.key]; Store.save(); App.render(); }
          } }, '×')
        ]));
      });
      body.appendChild(U.el('div', { class: 'section' }, [U.el('h2', { text: '이 골프장의 내 공략 메모' }), nl]));
    }

    body.appendChild(U.el('div', { class: 'btnrow mt16' }, [
      U.el('button', {
        class: course.verified ? 'ghost' : 'primary',
        onclick: function () { course.verified = !course.verified; Store.save(); App.render(); U.toast(course.verified ? '확인된 코스로 표시했습니다.' : '미확인으로 되돌렸습니다.'); }
      }, course.verified ? '확인 표시 해제' : '실제 값으로 확인함'),
      U.el('button', { class: 'danger', onclick: function () {
        if (U.confirm(course.name + ' 을(를) 목록에서 삭제할까요? 기존 라운드 기록은 남습니다.')) {
          Store.removeCourse(course.id); App.go('courses');
        }
      } }, '삭제')
    ]));

    return { title: course.name || '새 골프장', sub: course.kind === 'screen' ? '스크린' : '필드', body: body, back: true, keepScroll: true };
  };
})(window);
