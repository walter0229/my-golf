/* 음성 입력 UI — 마이크 버튼 + 듣는 중 패널
 * 화면이 다시 그려져도 패널이 사라지지 않도록 document.body 에 붙인다. */
(function (g) {
  'use strict';

  var panel = null;
  var ctx = null;      // {roundId, holeIdx}

  function el(tag, attrs, kids) { return U.el(tag, attrs, kids); }

  function close() {
    Voice.stop();
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    panel = null;
  }

  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }

  /* 무엇을 말하면 되는지 예시 */
  var EXAMPLES = [
    '드라이버 7번 아이언 온그린 투퍼트 파',
    '드라이버 왼쪽 3번우드 피칭 쓰리퍼트 더블보기',
    '드라이버 치고 140 남아서 8번 아이언 짧았어 투퍼트 보기',
    '오비 하나 6타',
    '드라이버 우드 웨지 투퍼트'
  ];

  function open(roundId, holeIdx) {
    close();
    ctx = { roundId: roundId, holeIdx: holeIdx };

    var round = Store.round(roundId);
    var hole = round.holes[holeIdx];

    var status = el('div', { class: 'vstat', text: '마이크를 누르고 말해 주세요' });
    var heard = el('div', { class: 'vheard', text: '' });
    var result = el('div', { class: 'vresult' });
    var micBtn = el('button', { class: 'vmic', 'aria-label': '음성 입력' }, '🎤');

    var exWrap = el('div', { class: 'vex' }, [
      el('div', { class: 'tiny mb8', text: '이렇게 말하면 됩니다' })
    ]);
    EXAMPLES.forEach(function (x) {
      exWrap.appendChild(el('div', { class: 'vexline', text: '"' + x + '"' }));
    });

    var box = el('div', { class: 'vpanel' }, [
      el('div', { class: 'row between mb8' }, [
        el('div', {}, [
          el('div', { style: 'font-weight:700;font-size:16px', text: (holeIdx + 1) + '번홀 · 파' + hole.par }),
          el('div', { class: 'tiny', text: round.courseName })
        ]),
        el('button', { class: 'sm ghost', onclick: close }, '닫기')
      ]),
      status, heard, result,
      el('div', { class: 'center', style: 'margin:18px 0 6px' }, [micBtn]),
      exWrap
    ]);

    panel = el('div', { class: 'vbg' }, [box]);
    panel.addEventListener('click', function (e) { if (e.target === panel) close(); });
    document.body.appendChild(panel);

    function listen() {
      heard.textContent = '';
      result.innerHTML = '';
      Voice.start({
        listening: function () {
          micBtn.className = 'vmic on';
          status.textContent = '듣는 중...';
          vibrate(30);
        },
        interim: function (txt) { heard.textContent = txt; },
        error: function (msg) {
          micBtn.className = 'vmic';
          status.textContent = '다시 시도해 주세요';
          result.innerHTML = '';
          result.appendChild(el('div', { class: 'verr', text: msg }));
        },
        end: function (txt) {
          micBtn.className = 'vmic';
          if (!txt || !txt.trim()) {
            if (!result.querySelector('.verr')) status.textContent = '아무 말도 인식되지 않았습니다';
            return;
          }
          status.textContent = '인식 결과';
          heard.textContent = txt;
          applyResult(txt);
        }
      });
    }

    function applyResult(txt) {
      var rnd = Store.round(ctx.roundId);
      var h = rnd.holes[ctx.holeIdx];
      var before = JSON.parse(JSON.stringify(h));

      var res = Voice.parse(txt, h, Store.unit());
      Voice.apply(res, h);
      Store.save();
      vibrate([30, 60, 30]);

      result.innerHTML = '';
      if (!res.labels.length) {
        result.appendChild(el('div', { class: 'verr', text: '무슨 말인지 알아듣지 못했습니다. 문장은 홀 기록에 그대로 저장했으니 나중에 확인하실 수 있습니다.' }));
      } else {
        var ul = el('div', { class: 'vlist' });
        res.labels.forEach(function (l) { ul.appendChild(el('div', { class: 'vitem', text: '✓ ' + l })); });
        result.appendChild(ul);
        result.appendChild(el('div', { class: 'vscore', text: '스코어 ' + (h.score || '-') + '타' +
          (h.score ? ' (' + U.scoreName(h.score, h.par) + ')' : '') }));
      }

      result.appendChild(el('div', { class: 'btnrow mt12' }, [
        el('button', {
          class: 'sm', onclick: function () {
            var cur = Store.round(ctx.roundId).holes[ctx.holeIdx];
            Object.keys(cur).forEach(function (k) { delete cur[k]; });
            Object.keys(before).forEach(function (k) { cur[k] = before[k]; });
            Store.save();
            result.innerHTML = '';
            status.textContent = '되돌렸습니다. 다시 말해 주세요';
            App.render();
          }
        }, '되돌리기'),
        el('button', { class: 'sm', onclick: listen }, '다시 말하기'),
        el('button', {
          class: 'sm primary', onclick: function () {
            var next = ctx.holeIdx + 1;
            var rr = Store.round(ctx.roundId);
            if (res.nav === 'prev') next = Math.max(0, ctx.holeIdx - 1);
            if (next >= rr.holes.length) { close(); App.go('round/' + ctx.roundId); return; }
            ctx.holeIdx = next;
            App.go('play/' + ctx.roundId + '/' + next);
            open(ctx.roundId, next);
          }
        }, '다음 홀 ›')
      ]));

      App.render();
    }

    micBtn.addEventListener('click', function () {
      if (Voice.listening()) { Voice.stop(); return; }
      listen();
    });

    // 패널을 열면 바로 듣기 시작 (버튼 클릭이 사용자 동작으로 이어진다)
    listen();
  }

  g.VoiceUI = { open: open, close: close };
})(window);
