/* 샷 단위 기록 — 말 한 번 = 샷 하나
 * ==================================================================
 * 한 홀을 한 문장으로 말하는 게 아니라, 칠 때마다 한 샷씩 쌓는다.
 *
 *   1타  "드라이버 정타 페어웨이 250미터"
 *   2타  "남은거리 150 8번 아이언 온그린인데 조금 길었음"
 *   3타  "8미터 퍼팅 짧아서 2미터 남음"
 *   4타  "2미터 넣었다"
 *
 * 이렇게 쌓인 샷 목록(hole.shotLog)이 그 홀의 원본 기록이고,
 * 스코어 / 퍼팅 수 / 파온 / 페어웨이 안착은 전부 여기서 계산해 낸다.
 * (기존 화면과 통계가 그대로 동작하도록 계산 결과를 홀에 되돌려 넣는다)
 * ================================================================== */
(function (g) {
  'use strict';

  var YD = 1.09361;

  /* ---------------- 말 사전 ----------------
     각 항목은 [코드, 한글이름, [인식할 표현들]] */

  // 타구질 — 어떻게 맞았나
  var CONTACT = [
    ['solid', '정타', ['정타', '정확히맞', '제대로맞', '잘맞', '굿샷', '나이스샷', '잘쳤', '완벽']],
    ['thin', '뱀샷(토핑)', ['뱀샷', '뱀', '토핑', '탑볼', '탑핑', '땅볼', '얇게', '얇게맞', '굴러갔', '뜨지않', '떠지않']],
    ['fat', '뒷땅', ['뒷땅', '뒤땅', '뒤를쳐', '두껍게', '뚱', '쳐박']],
    ['shank', '생크', ['생크', '쌩크', '샹크']],
    ['slice', '슬라이스', ['슬라이스', '슬라', '우로휘', '오른쪽으로휘']],
    ['hook', '훅', ['훅', '후크', '좌로휘', '왼쪽으로휘', '감겼']],
    ['push', '밀림', ['밀려', '밀렸', '푸시', '푸쉬']],
    ['pull', '당김', ['당겨', '당겼', '풀샷']],
    ['toe', '토우', ['토우', '토에맞']],
    ['heel', '힐', ['힐에맞', '힐로']]
  ];

  // 공이 멈춘 곳
  var END = [
    ['hole', '홀인', ['홀인', '들어갔', '들어감', '컵인', '넣었', '성공', '컨시드', '오케이', 'ok', '기브']],
    ['green', '그린', ['온그린', '그린온', '그린에올', '그린위', '온됐', '올렸', '그린']],
    ['fringe', '프린지', ['프린지', '에지', '엣지', '그린주변', '칼라']],
    ['ob', 'OB', ['오비', 'ob', '아웃오브']],
    ['hazard', '해저드', ['해저드', '헤저드', '워터', '물에', '물속', '연못']],
    ['bunker', '벙커', ['벙커']],
    ['rough', '러프', ['러프', '세미러프', '깊은풀']],
    ['trees', '나무/숲', ['나무', '숲', '수풀', '산으로']],
    ['cartpath', '카트도로', ['카트도로', '카트길', '도로']],
    ['divot', '디봇', ['디봇']],
    ['fairway', '페어웨이', ['페어웨이', '페웨', '페어에']]
  ];

  // 미스 방향 / 거리
  var MISS = [
    ['short', '짧음', ['짧', '숏', '모자', '덜갔', '덜쳐', '못미']],
    ['long', '길음', ['길었', '길게', '오버', '넘겼', '넘어갔', '지나쳤', '많이갔']],
    ['left', '좌측', ['왼쪽', '좌측', '왼편', '레프트']],
    ['right', '우측', ['오른쪽', '우측', '오른편', '라이트']]
  ];

  /* 샷을 친 지점.
     "그린주변에서 샌드웨지 온그린" 처럼 "~에서"가 붙은 말은 결과가 아니라 친 자리다.
     그래서 결과(END)보다 먼저 찾아서 먼저 소비한다. */
  var LIE = [
    ['tee', '티박스', ['티박스에서', '티박스', '티에서', '티샷']],
    ['fringe', '그린주변', ['그린주변에서', '그린주변', '프린지에서', '칼라에서', '에지에서', '엣지에서']],
    ['fairway', '페어웨이', ['페어웨이에서', '페웨에서']],
    ['rough', '러프', ['러프에서', '러프서']],
    ['bunker', '벙커', ['벙커에서', '벙커서']],
    ['trees', '나무밑', ['나무밑에서', '나무밑', '숲에서']],
    ['slope', '경사', ['경사에서', '언덕에서', '내리막에서', '오르막에서']],
    ['divot', '디봇', ['디봇에서']],
    ['green', '그린', ['그린에서']]
  ];

  var CLUBS = [
    ['dr', ['드라이버', '드라이바', '드라이브', '디알']],
    ['w3', ['3번우드', '삼번우드', '3우드', '삼우드', '스리우드', '쓰리우드']],
    ['w5', ['5번우드', '오번우드', '5우드', '오우드', '파이브우드']],
    ['w7', ['7번우드', '칠번우드', '7우드', '칠우드']],
    ['u3', ['3번유틸', '삼번유틸', '3유틸', '삼유틸']],
    ['u4', ['4번유틸', '사번유틸', '4유틸', '사유틸']],
    ['u5', ['5번유틸', '오번유틸', '5유틸', '오유틸']],
    ['i4', ['4번아이언', '사번아이언', '4아이언', '포아이언']],
    ['i5', ['5번아이언', '오번아이언', '5아이언', '파이브아이언']],
    ['i6', ['6번아이언', '육번아이언', '6아이언', '식스아이언']],
    ['i7', ['7번아이언', '칠번아이언', '7아이언', '세븐아이언']],
    ['i8', ['8번아이언', '팔번아이언', '8아이언', '에잇아이언']],
    ['i9', ['9번아이언', '구번아이언', '9아이언', '나인아이언']],
    ['pw', ['피칭웨지', '피칭', '피치웨지']],
    ['aw', ['어프로치웨지', '어프로치', '갭웨지']],
    ['sw', ['샌드웨지', '샌드']],
    ['lw', ['로브웨지', '로브', '60도']],
    ['pt', ['퍼터']],
    ['i4', ['4번', '사번']], ['i5', ['5번', '오번']], ['i6', ['6번', '육번']],
    ['i7', ['7번', '칠번']], ['i8', ['8번', '팔번']], ['i9', ['9번', '구번']],
    ['w3', ['우드']], ['u5', ['유틸리티', '유틸', '하이브리드']], ['sw', ['웨지']]
  ];

  // 퍼팅을 가리키는 표현 (음성인식이 제각각으로 적는다)
  var PUTT_RE = '(?:퍼팅|퍼트|퍼터|퍼티|펏|펕|펐|풋|펀트|펌트)';

  /* 표 구조가 [코드, 이름, 단어들] 인 경우 */
  function scan3(state, table) {
    var hits = [];
    table.forEach(function (row) {
      row[2].forEach(function (w) {
        var at = state.flat.indexOf(w);
        if (at >= 0) hits.push({ at: at, code: row[0], name: row[1], w: w });
      });
    });
    if (!hits.length) return null;
    // 먼저 나온 것, 같은 위치면 더 긴 표현
    hits.sort(function (a, b) { return a.at - b.at || b.w.length - a.w.length; });
    var pick = hits[0];
    state.flat = state.flat.split(pick.w).join(' ');
    return pick;
  }

  function scanAll3(state, table) {
    var out = [];
    var guard = 0;
    while (guard++ < 6) {
      var h = scan3(state, table);
      if (!h) break;
      if (out.indexOf(h.code) < 0) out.push(h.code);
    }
    return out;
  }

  /* ---------------- 파싱 ----------------
     text : 말한 문장
     ctx  : {hole, shotNo, unit}  unit 은 앱 설정 단위 ('y'|'m')
     반환 : {shot, labels, ok} */
  function parse(text, ctx) {
    var raw = String(text || '').trim();
    var state = { flat: raw.toLowerCase().replace(/[,.!?·]/g, ' ').replace(/\s+/g, '') };
    var labels = [];
    var hole = ctx.hole || { par: 4 };
    var shotNo = ctx.shotNo || 1;

    /* 거리: 숫자 + 단위. 말한 단위를 그대로 존중한다.
       (앱은 야드로 보고 있어도 "8미터 퍼팅"이라고 말하면 8m 로 받는다) */
    var dists = [];
    var re = /(\d{1,3})\s*(미터|미|m|야드|yd|y)?/g;
    var m;
    while ((m = re.exec(state.flat)) !== null) {
      var n = parseInt(m[1], 10);
      if (!n) continue;
      var u = m[2] || '';
      var meters;
      if (/미터|^미$|^m$/.test(u)) meters = n;
      else if (/야드|yd|^y$/.test(u)) meters = Math.round(n / YD);
      else meters = (ctx.unit === 'm') ? n : Math.round(n / YD);   // 단위를 안 말했으면 앱 설정 따름
      dists.push({ at: m.index, n: n, unit: u, meters: meters, said: n + (u || '') });
    }
    // 퍼팅인지 먼저 본다
    var isPutt = new RegExp(PUTT_RE).test(state.flat);

    // 클럽
    var clubHits = [];
    CLUBS.forEach(function (row) {
      row[1].forEach(function (w) {
        var at = state.flat.indexOf(w);
        if (at >= 0) clubHits.push({ at: at, id: row[0], w: w });
      });
    });
    clubHits.sort(function (a, b) { return a.at - b.at || b.w.length - a.w.length; });
    var clubId = null;
    if (clubHits.length) {
      var have = {};
      Store.clubs().forEach(function (c) { have[c.id] = c; });
      for (var i = 0; i < clubHits.length; i++) {
        if (have[clubHits[i].id]) { clubId = clubHits[i].id; state.flat = state.flat.split(clubHits[i].w).join(' '); break; }
      }
    }

    // 거리 재수집 (클럽 이름으로 쓰인 숫자는 위에서 지워졌다)
    var spokenUnit = null;   // 말할 때 쓴 단위 ("8미터" -> 'm'). 표시할 때 그대로 써 준다
    dists = [];
    re = /(\d{1,3})\s*(미터|미|m|야드|yd|y)?/g;
    while ((m = re.exec(state.flat)) !== null) {
      var n2 = parseInt(m[1], 10);
      if (!n2) continue;
      var u2 = m[2] || '';
      var mt;
      if (/미터|^미$|^m$/.test(u2)) mt = n2;
      else if (/야드|yd|^y$/.test(u2)) mt = Math.round(n2 / YD);
      else mt = (ctx.unit === 'm') ? n2 : Math.round(n2 / YD);
      dists.push({ at: m.index, n: n2, meters: mt, said: n2 + (u2 || ''), u: u2 });
      if (u2) spokenUnit = /미터|^미$|^m$/.test(u2) ? 'm' : 'y';
    }

    /* 퍼팅 판단.
       "퍼팅"이라는 말이 없어도 앞 샷이 그린에 올라간 뒤에 클럽 없이 말하면
       ("넣었다", "1미터 남음") 그린 위의 퍼팅으로 본다. */
    var prev = ctx.prevShot || null;
    var onGreen = prev && (prev.type === 'putt' || prev.end === 'green' || prev.end === 'fringe');
    if (!isPutt && onGreen && !clubId && shotNo > 1) isPutt = true;

    var shot = {
      n: shotNo,
      type: isPutt ? 'putt' : (shotNo === 1 ? 'tee' : 'shot'),
      clubId: clubId,
      remain: null, carry: null, leftover: null,
      contact: null, lie: null, end: null, miss: [],
      penalty: null,
      spokenUnit: null,
      raw: raw
    };

    // 타구질
    var ct = scan3(state, CONTACT);
    if (ct) { shot.contact = ct.code; labels.push('타구질 ' + ct.name); }

    // 친 지점
    var li = scan3(state, LIE);
    if (li) { shot.lie = li.code; }

    // 멈춘 곳
    var en = scan3(state, END);
    if (en) {
      shot.end = en.code;
      if (en.code === 'ob') shot.penalty = 'ob';
      if (en.code === 'hazard') shot.penalty = 'hazard';
      labels.push(en.code === 'hole' ? '홀 아웃' : '결과 ' + en.name);
    }

    // 미스 (짧음/길음/좌/우) — 여러 개 가능
    var missCodes = scanAll3(state, MISS);
    // "거리는 맞았는데" 는 거리 미스가 아님을 뜻한다
    if (/거리는맞|거리맞|거리는좋/.test(state.flat)) {
      missCodes = missCodes.filter(function (c) { return c !== 'short' && c !== 'long'; });
      labels.push('거리는 맞음');
      state.flat = state.flat.replace(/거리는맞\S*|거리맞\S*|거리는좋\S*/g, ' ');
    }
    shot.miss = missCodes;
    if (missCodes.length) {
      labels.push('미스 ' + missCodes.map(function (c) {
        var nm = c; MISS.forEach(function (r) { if (r[0] === c) nm = r[1]; }); return nm;
      }).join(' + '));
    }

    /* 거리 배정
       - "남은거리 150" / "150 남아서" -> remain (샷 전 남은 거리)
       - "250 나갔다/보냈다" -> carry (이 샷이 간 거리)
       - "2미터 남음" (미스 뒤) -> leftover (샷 후 남은 거리)
       - 퍼팅이면 첫 숫자가 퍼팅 거리(remain), 둘째가 남은 거리(leftover) */
    var f = state.flat;
    function nearWord(d, words) {
      var seg = f.slice(Math.max(0, d.at - 6), d.at + String(d.n).length + 8);
      for (var i = 0; i < words.length; i++) if (seg.indexOf(words[i]) >= 0) return true;
      return false;
    }
    var used = {};
    dists.forEach(function (d, i) {
      if (nearWord(d, ['남은', '남아', '남았', '남기'])) { if (shot.remain === null) { shot.remain = d.meters; used[i] = 1; } }
    });
    dists.forEach(function (d, i) {
      if (used[i]) return;
      if (nearWord(d, ['남음', '남았', '남기고', '남겨'])) { if (shot.leftover === null) { shot.leftover = d.meters; used[i] = 1; } }
    });
    dists.forEach(function (d, i) {
      if (used[i]) return;
      if (nearWord(d, ['나갔', '보냈', '날아', '쳤', '비거리'])) { if (shot.carry === null) { shot.carry = d.meters; used[i] = 1; } }
    });
    // 남은 숫자를 순서대로 채운다
    dists.forEach(function (d, i) {
      if (used[i]) return;
      if (shot.type === 'putt' || shot.type === 'shot') {
        if (shot.remain === null) { shot.remain = d.meters; used[i] = 1; }
        else if (shot.leftover === null) { shot.leftover = d.meters; used[i] = 1; }
      } else {   // 티샷은 보통 "얼마나 나갔나"
        if (shot.carry === null) { shot.carry = d.meters; used[i] = 1; }
        else if (shot.leftover === null) { shot.leftover = d.meters; used[i] = 1; }
      }
    });

    shot.spokenUnit = spokenUnit;
    var uu = spokenUnit || ctx.unit;
    if (shot.remain !== null) labels.push((shot.type === 'putt' ? '퍼팅 거리 ' : '남은 거리 ') + U.toDisplay(shot.remain, uu) + U.unitLabel(uu));
    if (shot.carry !== null) labels.push('비거리 ' + U.toDisplay(shot.carry, uu) + U.unitLabel(uu));
    if (shot.leftover !== null) labels.push('치고 나서 ' + U.toDisplay(shot.leftover, uu) + U.unitLabel(uu) + ' 남음');

    // 퍼팅인데 홀인이라고 안 했고 남은 거리도 없으면 넣은 것으로 본다
    if (shot.type === 'putt' && !shot.end && shot.leftover === null) shot.end = 'hole';

    // 클럽을 말 안 한 티샷은 드라이버로 본다 (파3 제외)
    if (!shot.clubId && shot.type === 'tee' && hole.par >= 4) {
      shot.clubId = 'dr'; shot.autoClub = true;
    }
    if (shot.clubId) {
      var c = Store.club(shot.clubId);
      labels.unshift('클럽 ' + (c ? c.name : shot.clubId) + (shot.autoClub ? ' (자동)' : ''));
    }
    if (shot.type === 'putt' && !shot.clubId) shot.clubId = 'pt';

    return { shot: shot, labels: labels, ok: labels.length > 0 };
  }

  /* ---------------- 샷 목록 -> 홀 기록 계산 ----------------
     기존 화면·통계·내보내기가 그대로 돌아가도록 결과를 홀에 되돌려 넣는다. */
  function derive(hole) {
    var log = hole.shotLog;
    if (!Array.isArray(log) || !log.length) return;

    var putts = 0, ob = 0, hz = 0, bunker = 0;
    var clubs = [];
    var approaches = [];
    var greenAt = null;

    log.forEach(function (s, i) {
      if (s.type === 'putt') putts++;
      else if (s.clubId) clubs.push(s.clubId);

      if (s.penalty === 'ob') ob++;
      if (s.penalty === 'hazard') hz++;
      if (s.end === 'bunker' || s.lie === 'bunker') bunker++;

      if (greenAt === null && (s.end === 'green' || s.end === 'hole') && s.type !== 'putt') greenAt = i + 1;

      // 그린을 노린 샷은 기존 "아이언샷 기록" 형식으로도 남긴다 (통계가 그대로 동작하도록)
      if (s.type !== 'putt' && s.type !== 'tee' && s.remain) {
        var results = [];
        if (s.end === 'green' || s.end === 'hole') results.push('green');
        s.miss.forEach(function (mm) { if (results.length < 2) results.push(mm); });
        approaches.push({
          dist: s.remain, lie: s.lie || 'fairway', clubId: s.clubId,
          results: results.slice(0, 2), fromShotLog: true
        });
      }
    });

    hole.shots = clubs;
    hole.putts = putts;
    hole.penalty = { ob: ob, hazard: hz };
    hole.bunker = bunker;
    hole.score = log.length + ob + hz;
    hole.scoreManual = false;

    // 티샷 결과
    var tee = log[0];
    if (tee && tee.type !== 'putt') {
      if (tee.end === 'fairway') hole.fairway = 'hit';
      else if (tee.miss.indexOf('left') >= 0) hole.fairway = 'left';
      else if (tee.miss.indexOf('right') >= 0) hole.fairway = 'right';
      else if (tee.end) hole.fairway = null;
    }

    // 파온: 규정 타수(파-2) 안에 그린에 올렸는가
    if (greenAt !== null) hole.gir = greenAt <= (hole.par - 2);
    else if (putts > 0) hole.gir = false;
    hole.girManual = false;

    // 손으로 넣은 아이언샷 기록은 남기고, 샷 목록에서 만든 것만 교체
    var manual = (hole.approaches || []).filter(function (a) { return !a.fromShotLog; });
    hole.approaches = manual.concat(approaches);
  }

  /* 샷 한 줄 요약 */
  function summary(s, unit) {
    var parts = [];
    unit = s.spokenUnit || unit;   // "8미터"라고 말했으면 8m 로 보여 준다
    var c = s.clubId ? Store.club(s.clubId) : null;
    if (s.type === 'putt') {
      parts.push('퍼팅');
      if (s.remain) parts.push(U.toDisplay(s.remain, unit) + U.unitLabel(unit));
    } else {
      if (c) parts.push(c.short || c.name);
      if (s.remain) parts.push('남은 ' + U.toDisplay(s.remain, unit) + U.unitLabel(unit));
      if (s.carry) parts.push(U.toDisplay(s.carry, unit) + U.unitLabel(unit) + ' 감');
    }
    if (s.contact) CONTACT.forEach(function (r) { if (r[0] === s.contact) parts.push(r[1]); });
    if (s.end) END.forEach(function (r) { if (r[0] === s.end) parts.push(r[1]); });
    s.miss.forEach(function (mm) { MISS.forEach(function (r) { if (r[0] === mm) parts.push(r[1]); }); });
    if (s.leftover) parts.push(U.toDisplay(s.leftover, unit) + U.unitLabel(unit) + ' 남음');
    return parts.join(' · ');
  }

  /* ---------------- 한 번에 여러 샷 ----------------
     "8번아이언 뒷땅 다시 8번아이언 오버" 처럼 한 번 말할 때 샷이 둘 이상일 수 있다.
     1) "다시 / 그리고 / 또 / 이어서" 같은 이어주는 말에서 자르고,
     2) 그래도 한 토막 안에 클럽이 두 번 나오면 두 번째 클럽 앞에서 한 번 더 자른다. */
  var JOIN_RE = /다시한번|다시|그다음에|그다음|그담에|그담|담에|다음에|그리고나서|그리고|이어서|또한번|또/;

  function splitByClub(text) {
    var flat = text.toLowerCase().replace(/\s+/g, '');
    // 원문에서의 위치를 찾기 위해 공백을 지운 인덱스 -> 원문 인덱스 대응표를 만든다
    var map = [], k = 0;
    for (var i = 0; i < text.length; i++) {
      if (/\s/.test(text[i])) continue;
      map[k++] = i;
    }
    var hits = [];
    CLUBS.forEach(function (row) {
      row[1].forEach(function (w) {
        var at = flat.indexOf(w);
        while (at >= 0) {
          hits.push({ at: at, len: w.length });
          at = flat.indexOf(w, at + 1);
        }
      });
    });
    if (hits.length < 2) return [text];
    hits.sort(function (a, b) { return a.at - b.at; });
    // 겹치는(같은 단어를 짧게/길게 잡은) 것은 하나로 본다
    var starts = [];
    hits.forEach(function (h) {
      if (!starts.length || h.at >= starts[starts.length - 1].at + starts[starts.length - 1].len) starts.push(h);
    });
    if (starts.length < 2) return [text];
    var out = [], prev = 0;
    for (var j = 1; j < starts.length; j++) {
      var cut = map[starts[j].at];
      if (cut === undefined || cut <= prev) continue;
      out.push(text.slice(prev, cut).trim());
      prev = cut;
    }
    out.push(text.slice(prev).trim());
    return out.filter(Boolean);
  }

  var OR_MARK = String.fromCharCode(1);   // "또는"을 잠시 바꿔 둘 표시 (이어주는 말 "또"와 섞이지 않게)

  function splitShots(raw) {
    var t = String(raw || '').split('또는').join(OR_MARK);
    var parts = t.split(JOIN_RE)
      .map(function (s) { return s.split(OR_MARK).join('또는').trim(); })
      .filter(Boolean);
    if (!parts.length) parts = [String(raw || '')];
    var out = [];
    parts.forEach(function (p) { splitByClub(p).forEach(function (q) { out.push(q); }); });
    return out.filter(Boolean);
  }

  /* 여러 샷을 한 번에 파싱.
     뒤 토막에 클럽이 없으면 앞 토막의 클럽을 이어받는다
     ("8번아이언 뒷땅 다시 오버" -> 두 번째도 8번 아이언) */
  function parseMulti(text, ctx) {
    var segs = splitShots(text);
    var results = [];
    var lastClub = null;
    var prev = ctx.prevShot || null;
    segs.forEach(function (seg, i) {
      var r = parse(seg, {
        hole: ctx.hole,
        shotNo: (ctx.shotNo || 1) + i,
        unit: ctx.unit,
        prevShot: prev
      });
      prev = r.shot;
      if (!r.shot.clubId && lastClub && r.shot.type !== 'putt') {
        r.shot.clubId = lastClub;
        r.shot.autoClub = true;
        var c = Store.club(lastClub);
        r.labels.unshift('클럽 ' + (c ? c.name : lastClub) + ' (앞 샷과 동일)');
        r.ok = true;
      }
      if (r.shot.clubId && r.shot.type !== 'putt') lastClub = r.shot.clubId;
      r.shot.raw = seg;
      results.push(r);
    });
    return results;
  }

  g.Shot = {
    parse: parse,
    parseMulti: parseMulti,
    splitShots: splitShots,
    derive: derive,
    summary: summary,
    CONTACT: CONTACT, END: END, MISS: MISS, LIE: LIE,
    contactName: function (c) { var n = c; CONTACT.forEach(function (r) { if (r[0] === c) n = r[1]; }); return n; },
    endName: function (c) { var n = c; END.forEach(function (r) { if (r[0] === c) n = r[1]; }); return n; },
    missName: function (c) { var n = c; MISS.forEach(function (r) { if (r[0] === c) n = r[1]; }); return n; }
  };
})(window);
