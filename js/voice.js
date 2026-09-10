/* 음성으로 홀 기록하기
 * ==================================================================
 * 마이크 버튼을 누르고 말하면 그 홀의 클럽 / 퍼팅 / 스코어 / 샷 결과를 한 번에 채운다.
 *
 * [알아 둘 점]
 *  - 브라우저 음성인식(Web Speech API)은 음성을 구글 서버로 보내 글자로 바꾼다.
 *    즉 인터넷이 필요하다. 신호가 약한 홀에서는 동작하지 않는다.
 *  - 그래서 인식된 문장은 항상 그 홀에 그대로 저장한다(voiceLog).
 *    엉뚱하게 알아들어도 원문이 남아 있어 나중에 고칠 수 있다.
 *  - 음성 파일 자체는 저장하지 않는다. 몇 홀만 쌓여도 폰 저장 공간을 금방 채우기 때문에,
 *    글자로 바뀐 결과만 남긴다.
 *  - 안드로이드 크롬에서 가장 잘 된다. 아이폰 사파리는 기기/버전에 따라 안 될 수 있다.
 * ================================================================== */
(function (g) {
  'use strict';

  var SR = g.SpeechRecognition || g.webkitSpeechRecognition || null;

  /* ---------------- 숫자 읽기 ---------------- */
  var NUM = {
    '영': 0, '공': 0,
    '일': 1, '한': 1, '하나': 1, '원': 1,
    '이': 2, '두': 2, '둘': 2, '투': 2,
    '삼': 3, '세': 3, '셋': 3, '쓰리': 3, '스리': 3,
    '사': 4, '네': 4, '넷': 4, '포': 4,
    '오': 5, '다섯': 5, '파이브': 5,
    '육': 6, '여섯': 6, '식스': 6,
    '칠': 7, '일곱': 7, '세븐': 7,
    '팔': 8, '여덟': 8, '에잇': 8,
    '구': 9, '아홉': 9, '나인': 9,
    '십': 10, '열': 10, '텐': 10
  };
  // 긴 것부터 매칭해야 "다섯"이 "다"로 잘리지 않는다
  var NUM_KEYS = Object.keys(NUM).sort(function (a, b) { return b.length - a.length; });
  var NUM_PAT = NUM_KEYS.join('|');

  function toNum(s) {
    if (s === undefined || s === null || s === '') return null;
    var t = String(s).trim();
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    return NUM[t] !== undefined ? NUM[t] : null;
  }

  /* ---------------- 클럽 사전 ----------------
     같은 클럽을 부르는 여러 방식을 모아 둔다. 긴 표현부터 먼저 찾는다. */
  var CLUB_WORDS = [
    ['dr', ['드라이버', '드라이바', '드라이브', '드라이버로', '디알']],
    ['w3', ['3번우드', '삼번우드', '3우드', '삼우드', '스리우드', '쓰리우드']],
    ['w5', ['5번우드', '오번우드', '5우드', '오우드', '파이브우드']],
    ['w7', ['7번우드', '칠번우드', '7우드', '칠우드']],
    ['u3', ['3번유틸', '삼번유틸', '3유틸', '삼유틸', '3번하이브리드']],
    ['u4', ['4번유틸', '사번유틸', '4유틸', '사유틸', '4번하이브리드']],
    ['u5', ['5번유틸', '오번유틸', '5유틸', '오유틸', '5번하이브리드']],
    ['i4', ['4번아이언', '사번아이언', '4아이언', '사아이언', '포아이언']],
    ['i5', ['5번아이언', '오번아이언', '5아이언', '오아이언', '파이브아이언']],
    ['i6', ['6번아이언', '육번아이언', '6아이언', '육아이언', '식스아이언']],
    ['i7', ['7번아이언', '칠번아이언', '7아이언', '칠아이언', '세븐아이언']],
    ['i8', ['8번아이언', '팔번아이언', '8아이언', '팔아이언', '에잇아이언']],
    ['i9', ['9번아이언', '구번아이언', '9아이언', '구아이언', '나인아이언']],
    ['pw', ['피칭웨지', '피칭', '피치웨지', '피더블유']],
    ['aw', ['어프로치웨지', '어프로치', '갭웨지', '갭', '에이더블유']],
    ['sw', ['샌드웨지', '샌드', '에스더블유']],
    ['lw', ['로브웨지', '로브', '엘더블유', '60도']],
    // 번호만 말한 경우 ("칠번", "세븐") — 아이언으로 본다
    ['i4', ['4번', '사번']], ['i5', ['5번', '오번']], ['i6', ['6번', '육번']],
    ['i7', ['7번', '칠번']], ['i8', ['8번', '팔번']], ['i9', ['9번', '구번']],
    ['w3', ['우드']], ['u5', ['유틸리티', '유틸', '하이브리드']], ['sw', ['웨지']]
  ];

  /* 스코어 이름 -> 파 대비 타수 */
  var SCORE_WORDS = [
    ['알바트로스', -3], ['앨버트로스', -3],
    ['이글', -2],
    ['버디', -1],
    ['더블보기', 2], ['더블', 2],
    ['트리플보기', 3], ['트리플', 3],
    ['쿼드러플', 4],
    ['보기', 1],
    ['파', 0]              // "파온"을 먼저 소비한 뒤에 봐야 한다
  ];

  /* ---------------- 파서 ----------------
     hole: 현재 홀 (par 를 알아야 "보기"를 타수로 바꿀 수 있다)
     반환: {sets:[{key,value,label}], raw, unknown} */
  function parse(text, hole, unit) {
    var s = String(text || '');
    var work = s.replace(/[,.!?·]/g, ' ').toLowerCase();
    // 붙여 말해도 잡히도록 공백을 뺀 사본을 함께 쓴다
    var flat = work.replace(/\s+/g, '');

    var out = {
      raw: s.trim(),
      shots: null, putts: null, score: null, fairway: null, gir: null,
      ob: 0, hazard: 0, bunker: 0, approach: null, nav: null,
      labels: []
    };

    function take(re) {              // 매칭되면 그 부분을 지워서 중복 해석을 막는다
      var m = flat.match(re);
      if (m) flat = flat.replace(m[0], ' ');
      return m;
    }

    // 1) 홀 이동
    if (/다음홀|넥스트|다음으로/.test(flat)) { out.nav = 'next'; out.labels.push('다음 홀로 이동'); flat = flat.replace(/다음홀|넥스트|다음으로/g, ' '); }
    else if (/이전홀|전홀|뒤로/.test(flat)) { out.nav = 'prev'; out.labels.push('이전 홀로 이동'); flat = flat.replace(/이전홀|전홀|뒤로/g, ' '); }

    // 2) 남은 거리 (아이언샷 기록용) — "140 남았", "150야드", "백사십"
    var dm = take(new RegExp('(\\d{2,3})\\s*(야드|yd|미터|m|미)?\\s*(남|남았|남아|남은)'))
          || take(new RegExp('(\\d{2,3})\\s*(야드|yd|미터|m|미)'));
    var apDist = dm ? parseInt(dm[1], 10) : null;

    // 3) 퍼팅
    var pm = take(new RegExp('(원|투|쓰리|포|한|두|세|네|다섯|1|2|3|4|5)\\s*퍼[트팅]'))
          || take(new RegExp('퍼[트팅]\\s*(원|투|쓰리|포|한|두|세|네|다섯|\\d)'));
    if (pm) out.putts = toNum(pm[1]);
    else if (/노퍼트|퍼팅없|퍼트없/.test(flat)) { out.putts = 0; flat = flat.replace(/노퍼트|퍼팅없|퍼트없/g, ' '); }
    if (out.putts !== null) out.labels.push('퍼팅 ' + out.putts + '개');

    // 4) 벌타 / 벙커
    var obm = take(/(\d|한|두|세)?\s*(오비|ob|오빈|아웃오브바운드)/);
    if (obm) { out.ob = toNum(obm[1]) || 1; out.labels.push('OB ' + out.ob); }
    var hzm = take(/(\d|한|두|세)?\s*(해저드|헤저드|워터해저드|물에|해자드)/);
    if (hzm) { out.hazard = toNum(hzm[1]) || 1; out.labels.push('해저드 ' + out.hazard); }
    var bkm = take(/(\d|한|두|세)?\s*(벙커에|벙커)/);
    if (bkm) { out.bunker = toNum(bkm[1]) || 1; out.labels.push('벙커 ' + out.bunker); }

    // 5) 파온 / 온그린  ("파"보다 먼저 소비해야 한다)
    if (/파온|온그린|그린온|그린올|투온|원온/.test(flat)) {
      out.gir = true; out.labels.push('파온 성공');
      flat = flat.replace(/파온|온그린|그린온|그린올|투온|원온/g, ' ');
    } else if (/노온|파온실패|온못|그린놓/.test(flat)) {
      out.gir = false; out.labels.push('파온 실패');
      flat = flat.replace(/노온|파온실패|온못|그린놓/g, ' ');
    }

    // 6) 티샷 결과
    if (/페어웨이|페웨|똑바로|잘맞|가운데/.test(flat)) {
      out.fairway = 'hit'; out.labels.push('티샷 페어웨이');
      flat = flat.replace(/페어웨이|페웨|똑바로|잘맞|가운데/g, ' ');
    } else if (/왼쪽|좌측|왼|훅|당겨/.test(flat)) {
      out.fairway = 'left'; out.labels.push('티샷 좌측');
      flat = flat.replace(/왼쪽|좌측|왼|훅|당겨/g, ' ');
    } else if (/오른쪽|우측|오른|슬라이스|밀렸|푸시/.test(flat)) {
      out.fairway = 'right'; out.labels.push('티샷 우측');
      flat = flat.replace(/오른쪽|우측|오른|슬라이스|밀렸|푸시/g, ' ');
    }

    // 7) 아이언샷 결과 (거리를 말했을 때만 기록으로 만든다)
    var apResults = [];
    if (/짧|숏|모자|덜갔/.test(flat)) { apResults.push('short'); flat = flat.replace(/짧았|짧|숏|모자|덜갔/g, ' '); }
    if (/오버|넘겼|넘어|길었|길게/.test(flat)) { apResults.push('long'); flat = flat.replace(/오버|넘겼|넘어|길었|길게/g, ' '); }
    var apLie = /러프/.test(flat) ? 'rough' : (out.bunker ? 'bunker' : 'fairway');
    if (/러프/.test(flat)) flat = flat.replace(/러프/g, ' ');

    // 8) 스코어 — 절대 타수가 먼저
    var sm = take(new RegExp('(\\d{1,2}|' + NUM_PAT + ')\\s*타'));
    if (sm) {
      out.score = toNum(sm[1]);
      if (out.score !== null) out.labels.push('스코어 ' + out.score + '타');
    }
    if (out.score === null) {
      if (/양파/.test(flat)) {
        out.score = hole.par * 2; out.labels.push('양파 (' + out.score + '타)');
        flat = flat.replace(/양파/g, ' ');
      } else {
        for (var i = 0; i < SCORE_WORDS.length; i++) {
          var w = SCORE_WORDS[i][0];
          if (flat.indexOf(w) >= 0) {
            out.score = hole.par + SCORE_WORDS[i][1];
            out.labels.push(w + ' (' + out.score + '타)');
            flat = flat.replace(new RegExp(w, 'g'), ' ');
            break;
          }
        }
      }
    }

    // 9) 클럽 — 말한 순서대로 담는다
    var found = [];
    CLUB_WORDS.forEach(function (entry) {
      entry[1].forEach(function (word) {
        var at = flat.indexOf(word);
        while (at >= 0) {
          found.push({ at: at, id: entry[0], word: word });
          flat = flat.slice(0, at) + new Array(word.length + 1).join(' ') + flat.slice(at + word.length);
          at = flat.indexOf(word);
        }
      });
    });
    if (found.length) {
      found.sort(function (a, b) { return a.at - b.at; });
      // 실제로 백에 있는 클럽만 (설정에서 거리를 0으로 비워 둔 클럽은 무시)
      var have = {};
      Store.clubs().forEach(function (c) { have[c.id] = c; });
      out.shots = found.map(function (f) { return f.id; }).filter(function (id) { return have[id]; });
      if (out.shots.length) {
        out.labels.push('클럽 ' + out.shots.map(function (id) {
          var c = have[id]; return c.short || c.name;
        }).join(' → '));
      } else {
        out.shots = null;
      }
    }

    // 아이언샷 기록 구성 (거리를 말했을 때만)
    if (apDist) {
      var apClub = null;
      if (out.shots && out.shots.length) apClub = out.shots[out.shots.length - 1];
      if (out.gir === true && apResults.indexOf('green') < 0) apResults.push('green');
      out.approach = {
        dist: U.fromDisplay(apDist, unit),
        lie: apLie,
        clubId: apClub,
        results: apResults.slice(0, 2)
      };
      out.labels.push('아이언샷 ' + apDist + U.unitLabel(unit) +
        (apResults.length ? ' · ' + apResults.map(function (r) { return App.RESULT_KO[r] || r; }).join('+') : ''));
    } else if (apResults.length) {
      // 거리 없이 결과만 말한 경우 파온 여부만 반영
      if (apResults.indexOf('short') >= 0 || apResults.indexOf('long') >= 0) {
        if (out.gir === null) { out.gir = false; out.labels.push('파온 실패'); }
      }
    }

    return out;
  }

  /* ---------------- 홀에 적용 ---------------- */
  function apply(res, hole) {
    if (res.shots) hole.shots = res.shots.slice();
    if (res.putts !== null) hole.putts = res.putts;
    if (res.fairway) hole.fairway = res.fairway;
    if (res.gir !== null) { hole.gir = res.gir; hole.girManual = true; }
    if (res.ob) hole.penalty.ob = res.ob;
    if (res.hazard) hole.penalty.hazard = res.hazard;
    if (res.bunker) hole.bunker = res.bunker;
    if (res.approach) {
      if (!Array.isArray(hole.approaches)) hole.approaches = [];
      hole.approaches.push(res.approach);
    }

    // 스코어: 직접 말했으면 그 값, 아니면 샷+퍼팅+벌타로 자동 계산
    if (res.score !== null) {
      hole.score = res.score;
      hole.scoreManual = true;
    } else {
      var auto = (hole.shots ? hole.shots.length : 0) + (hole.putts || 0) +
        (hole.penalty.ob || 0) + (hole.penalty.hazard || 0);
      if (auto > 0 && !hole.scoreManual) hole.score = auto;
    }

    // 인식된 문장을 그대로 남긴다 (잘못 알아들었을 때 확인용)
    if (!Array.isArray(hole.voiceLog)) hole.voiceLog = [];
    hole.voiceLog.push({ t: new Date().toISOString(), text: res.raw });
  }

  /* ---------------- 음성 인식 ---------------- */
  var rec = null;
  var listening = false;

  function stop() {
    if (rec) { try { rec.stop(); } catch (e) {} }
    listening = false;
  }

  function start(cb) {
    if (!SR) { cb.error('이 브라우저는 음성 인식을 지원하지 않습니다. 안드로이드 크롬에서 사용해 주세요.'); return; }
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      cb.error('음성 인식은 https 주소에서만 동작합니다.'); return;
    }
    if (!navigator.onLine) {
      cb.error('음성 인식은 인터넷 연결이 필요합니다. 신호가 없으면 손으로 입력해 주세요.'); return;
    }
    stop();
    rec = new SR();
    rec.lang = 'ko-KR';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    var finalText = '';
    rec.onresult = function (e) {
      var interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      cb.interim(finalText + interim);
    };
    rec.onerror = function (e) {
      listening = false;
      var msg = {
        'not-allowed': '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크를 허용해 주세요.',
        'service-not-allowed': '마이크 권한이 거부되었습니다.',
        'no-speech': '소리가 들리지 않았습니다. 다시 눌러서 말해 주세요.',
        'audio-capture': '마이크를 찾을 수 없습니다.',
        'network': '음성 인식 서버에 연결하지 못했습니다. 인터넷 신호를 확인해 주세요.',
        'aborted': null
      }[e.error];
      if (msg) cb.error(msg);
      else if (e.error !== 'aborted') cb.error('음성 인식 오류: ' + e.error);
      else cb.end(finalText);
    };
    rec.onend = function () { listening = false; cb.end(finalText); };

    try { rec.start(); listening = true; cb.listening(); }
    catch (e) { cb.error('마이크를 시작하지 못했습니다: ' + e.message); }
  }

  g.Voice = {
    supported: function () { return !!SR; },
    listening: function () { return listening; },
    start: start,
    stop: stop,
    parse: parse,
    apply: apply,
    NUM: NUM
  };
})(window);
