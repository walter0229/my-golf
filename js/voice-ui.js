/* 음성 입력 UI — 마이크 한 번 = 샷 하나
 * 누를 때마다 샷이 하나씩 쌓이고, 쌓인 샷으로 그 홀의 스코어가 계산된다.
 * 화면이 다시 그려져도 패널이 사라지지 않도록 document.body 에 붙인다. */
(function (g) {
  'use strict';

  var panel = null;
  var ctx = null;      // {roundId, holeIdx}

  function el(tag, attrs, kids) { return U.el(tag, attrs, kids); }
  function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  function close() {
    Voice.stop();
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    panel = null;
    App.render();
  }

  var EXAMPLES = [
    ['티샷', '드라이버 정타 페어웨이 250미터'],
    ['티샷', '드라이버 뱀샷 150미터'],
    ['티샷', '우측으로 밀려서 러프'],
    ['아이언', '남은거리 150 8번 아이언 온그린인데 조금 길었음'],
    ['아이언', '남은거리 120 피칭 조금 짧아서 온그린 못함'],
    ['퍼팅', '8미터 퍼팅 짧아서 2미터 남음'],
    ['퍼팅', '거리는 맞았는데 오른쪽으로 빠짐 1미터 남음'],
    ['퍼팅', '넣었다']
  ];

  function open(roundId, holeIdx) {
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    ctx = { roundId: roundId, holeIdx: holeIdx };
    build();
  }

  function build() {
    var round = Store.round(ctx.roundId);
    var hole = round.holes[ctx.holeIdx];
    if (!Array.isArray(hole.shotLog)) hole.shotLog = [];
    var unit = Store.unit();

    var status = el('div', { class: 'vstat', text: '마이크를 누르고 이번 샷 하나를 말해 주세요' });
    var heard = el('div', { class: 'vheard', text: '' });
    var result = el('div', { class: 'vresult' });
    var micBtn = el('button', { class: 'vmic', 'aria-label': '샷 말하기' }, '🎤');

    // 지금까지 쌓인 샷
    var listBox = el('div', { class: 'shotlog' });
    function drawList() {
      listBox.innerHTML = '';
      var h = Store.round(ctx.roundId).holes[ctx.holeIdx];
      if (!h.shotLog.length) {
        listBox.appendChild(el('div', { class: 'muted sm center', style: 'padding:14px', text: '아직 기록한 샷이 없습니다.' }));
        return;
      }
      h.shotLog.forEach(function (s, i) {
        listBox.appendChild(el('div', { class: 'srow' }, [
          el('div', { class: 'sn' + (s.type === 'putt' ? ' putt' : ''), text: String(i + 1) }),
          el('div', { class: 'grow' }, [
            el('div', { style: 'font-weight:600;font-size:14px', text: Shot.summary(s, unit) || '(내용 없음)' }),
            el('div', { class: 'tiny', text: '"' + s.raw + '"' })
          ]),
          el('button', {
            class: 'sm ghost',
            onclick: function () {
              var hh = Store.round(ctx.roundId).holes[ctx.holeIdx];
              hh.shotLog.splice(i, 1);
              hh.shotLog.forEach(function (x, k) { x.n = k + 1; });
              Shot.derive(hh); Store.save(); drawList(); drawTotal(); App.render();
            }
          }, '×')
        ]));
      });
    }

    var totalBox = el('div', { class: 'vscore' });
    function drawTotal() {
      var h = Store.round(ctx.roundId).holes[ctx.holeIdx];
      var n = h.shotLog.length;
      if (!n) { totalBox.textContent = ''; return; }
      totalBox.textContent = '현재 ' + h.score + '타' +
        (h.putts ? ' (퍼팅 ' + h.putts + ')' : '') +
        ' · 파' + h.par + ' 기준 ' + U.sign(h.score - h.par);
    }

    var exWrap = el('div', { class: 'vex' }, [el('div', { class: 'tiny mb8', text: '샷 하나씩 이렇게 말하면 됩니다' })]);
    EXAMPLES.forEach(function (x) {
      exWrap.appendChild(el('div', { class: 'vexline' }, [
        el('span', { class: 'vextag', text: x[0] }), '"' + x[1] + '"'
      ]));
    });

    var box = el('div', { class: 'vpanel' }, [
      el('div', { class: 'row between mb8' }, [
        el('div', {}, [
          el('div', { style: 'font-weight:700;font-size:16px', text: (ctx.holeIdx + 1) + '번홀 · 파' + hole.par + ' · ' + U.toDisplay(hole.dist, unit) + U.unitLabel(unit) }),
          el('div', { class: 'tiny', text: round.courseName + ' ' + hole.nineName })
        ]),
        el('button', { class: 'sm ghost', onclick: close }, '닫기')
      ]),
      listBox, totalBox,
      el('hr', { class: 'sep' }),
      status, heard, result,
      el('div', { class: 'center', style: 'margin:16px 0 6px' }, [micBtn]),
      el('div', { class: 'btnrow mt8' }, [
        el('button', {
          class: 'sm', onclick: function () {
            if (ctx.holeIdx <= 0) return;
            ctx.holeIdx--; App.go('play/' + ctx.roundId + '/' + ctx.holeIdx); open(ctx.roundId, ctx.holeIdx);
          }
        }, '‹ 이전 홀'),
        el('button', {
          class: 'sm primary', onclick: function () {
            var rr = Store.round(ctx.roundId);
            var next = ctx.holeIdx + 1;
            if (next >= rr.holes.length) { close(); App.go('round/' + ctx.roundId); return; }
            ctx.holeIdx = next;
            App.go('play/' + ctx.roundId + '/' + next);
            open(ctx.roundId, next);
          }
        }, '다음 홀 ›')
      ]),
      exWrap
    ]);

    panel = el('div', { class: 'vbg' }, [box]);
    panel.addEventListener('click', function (e) { if (e.target === panel) close(); });
    document.body.appendChild(panel);
    drawList(); drawTotal();

    function addShot(txt) {
      var h = Store.round(ctx.roundId).holes[ctx.holeIdx];
      // 한 번 말할 때 샷이 둘 이상일 수 있다 ("8번아이언 뒷땅 다시 8번아이언 오버")
      var results = Shot.parseMulti(txt, {
        hole: h, shotNo: h.shotLog.length + 1, unit: unit,
        prevShot: h.shotLog.length ? h.shotLog[h.shotLog.length - 1] : null
      });
      var added = results.length;

      result.innerHTML = '';
      results.forEach(function (res) { h.shotLog.push(res.shot); });
      Shot.derive(h); Store.save();

      var anyOk = results.some(function (r) { return r.ok; });
      if (!anyOk) {
        result.appendChild(el('div', { class: 'verr', text: '내용을 알아듣지 못했지만 말씀하신 문장은 샷으로 남겼습니다. 나중에 고치실 수 있습니다.' }));
      } else {
        vibrate([25, 50, 25]);
        result.appendChild(el('div', { class: 'tiny mb8', text: added > 1 ? added + '개 샷으로 나눠서 기록' : h.shotLog.length + '번째 샷으로 기록' }));
        results.forEach(function (res, ri) {
          var list = el('div', { class: 'vlist' });
          if (added > 1) list.appendChild(el('div', { class: 'tiny', style: 'margin:6px 0 2px', text: (h.shotLog.length - added + ri + 1) + '타' }));
          res.labels.forEach(function (l) { list.appendChild(el('div', { class: 'vitem', text: '✓ ' + l })); });
          result.appendChild(list);
        });
      }

      result.appendChild(el('div', { class: 'btnrow mt12' }, [
        el('button', {
          class: 'sm', onclick: function () {
            var hh = Store.round(ctx.roundId).holes[ctx.holeIdx];
            for (var q = 0; q < added; q++) hh.shotLog.pop();
            Shot.derive(hh); Store.save();
            result.innerHTML = ''; heard.textContent = '';
            status.textContent = '취소했습니다. 다시 말해 주세요';
            drawList(); drawTotal(); App.render();
          }
        }, added > 1 ? '방금 ' + added + '샷 취소' : '이 샷 취소'),
        el('button', { class: 'sm primary', onclick: listen }, '🎤 다음 샷')
      ]));

      drawList(); drawTotal();
      App.render();
      box.scrollTop = box.scrollHeight;
    }

    function listen() {
      heard.textContent = '';
      result.innerHTML = '';
      Voice.start({
        listening: function () {
          micBtn.className = 'vmic on';
          var h = Store.round(ctx.roundId).holes[ctx.holeIdx];
          status.textContent = (h.shotLog.length + 1) + '번째 샷 · 듣는 중...';
          vibrate(30);
        },
        interim: function (t) { heard.textContent = t; },
        error: function (msg) {
          micBtn.className = 'vmic';
          status.textContent = '다시 시도해 주세요';
          result.innerHTML = '';
          result.appendChild(el('div', { class: 'verr', text: msg }));
        },
        end: function (t) {
          micBtn.className = 'vmic';
          if (!t || !t.trim()) {
            if (!result.querySelector('.verr')) status.textContent = '아무 말도 인식되지 않았습니다';
            return;
          }
          status.textContent = '인식 결과';
          heard.textContent = t;
          addShot(t);
        }
      });
    }

    micBtn.addEventListener('click', function () {
      if (Voice.listening()) { Voice.stop(); return; }
      listen();
    });

    listen();
  }

  /* 인식 테스트 — 필드에 나가기 전에 내 말투가 잡히는지 확인해 보는 화면.
     실제 기록에는 저장하지 않는다. */
  function tester() {
    var fakeHole = { par: 4, no: 1, shotLog: [] };
    var shotNo = el('select', {}, [
      el('option', { value: '1' }, '1번째 샷 (티샷)'),
      el('option', { value: '2' }, '2번째 샷'),
      el('option', { value: '3' }, '3번째 샷')
    ]);
    var input = el('input', { type: 'text', placeholder: '예: 남은거리 150 8번 아이언 온그린인데 조금 길었음' });
    var out = el('div', { class: 'vresult' });
    var micBtn = el('button', { class: 'sm', style: 'width:auto' }, '🎤 말해서 넣기');

    function run(txt) {
      input.value = txt;
      out.innerHTML = '';
      if (!txt.trim()) return;
      var results = Shot.parseMulti(txt, { hole: fakeHole, shotNo: parseInt(shotNo.value, 10), unit: Store.unit() });
      if (!results.some(function (r) { return r.ok; })) {
        out.appendChild(el('div', { class: 'verr', text: '이 문장은 알아듣지 못했습니다. 어떤 표현이 안 잡히는지 알려주시면 사전에 추가하겠습니다.' }));
        return;
      }
      if (results.length > 1) out.appendChild(el('div', { class: 'tiny mb8', text: results.length + '개 샷으로 나눠서 인식했습니다' }));
      results.forEach(function (res, ri) {
        var list = el('div', { class: 'vlist' });
        if (results.length > 1) list.appendChild(el('div', { class: 'tiny', style: 'margin:6px 0 2px', text: (ri + 1) + '번째 샷' }));
        res.labels.forEach(function (l) { list.appendChild(el('div', { class: 'vitem', text: '✓ ' + l })); });
        out.appendChild(list);
        out.appendChild(el('div', { class: 'vscore', style: 'font-size:14px', text: '요약: ' + Shot.summary(res.shot, Store.unit()) }));
      });
    }

    input.addEventListener('input', function () { run(input.value); });
    shotNo.addEventListener('change', function () { run(input.value); });
    micBtn.addEventListener('click', function () {
      out.innerHTML = ''; input.value = '';
      Voice.start({
        listening: function () { micBtn.textContent = '🔴 듣는 중...'; },
        interim: function (t) { input.value = t; },
        error: function (m) { micBtn.textContent = '🎤 말해서 넣기'; out.innerHTML = ''; out.appendChild(el('div', { class: 'verr', text: m })); },
        end: function (t) { micBtn.textContent = '🎤 말해서 넣기'; if (t) run(t); }
      });
    });

    var ex = el('div', { class: 'vex' }, [el('div', { class: 'tiny mb8', text: '예시 (눌러서 넣기)' })]);
    EXAMPLES.forEach(function (x) {
      ex.appendChild(el('button', {
        class: 'chip', style: 'margin:3px 4px 3px 0',
        onclick: function () { run(x[1]); }
      }, x[1]));
    });

    App.modal('음성 인식 테스트', el('div', {}, [
      el('div', { class: 'tiny mb8', text: '실제 기록에는 저장되지 않습니다. 샷 하나를 말한다고 생각하고 넣어 보세요.' }),
      el('label', { class: 'field' }, [el('span', { text: '몇 번째 샷으로 볼지' }), shotNo]),
      input,
      el('div', { class: 'mt8' }, [micBtn]),
      out, ex
    ]));
  }

  g.VoiceUI = { open: open, close: close, tester: tester };
})(window);
