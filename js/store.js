/* 데이터 저장소
 * - 1차 저장: 브라우저 localStorage (오프라인 100% 동작)
 * - 2차 저장: 구글 시트 동기화 (js/sheets.js, 선택 사항)
 * 거리 값은 전부 "미터" 로 저장하고, 화면에 보여줄 때만 야드로 변환한다. */
(function (g) {
  'use strict';

  var KEY = 'golfscore.v1';
  var SCHEMA = 1;

  /* 기본 클럽 세트
     저장 단위는 항상 미터. 옆의 주석은 야드 환산값(화면 표시값)이다.
     드라이버 220y / 3번우드 200y / 4유틸 185y / 5유틸 180y / 7번 150y 는 사용자가 준 실측값이고,
     나머지는 그 사이를 자연스러운 간격으로 채운 추정값이다 -> 실제로 재보고 고칠 것.
     dist: 0 은 "백에 없음"으로 보고 공략법 계산에서 제외한다. */
  var DEFAULT_CLUBS = [
    { id: 'dr', name: '드라이버', short: 'DR', cat: 'wood', dist: 201 },      // 220y (실측)
    { id: 'w3', name: '3번 우드', short: '3W', cat: 'wood', dist: 183 },      // 200y (실측)
    { id: 'w5', name: '5번 우드', short: '5W', cat: 'wood', dist: 0 },        // 백에 없음
    { id: 'u3', name: '3번 유틸', short: '3U', cat: 'hybrid', dist: 0 },      // 백에 없음
    { id: 'u4', name: '4번 유틸', short: '4U', cat: 'hybrid', dist: 169 },    // 185y (실측)
    { id: 'u5', name: '5번 유틸', short: '5U', cat: 'hybrid', dist: 165 },    // 180y (실측)
    { id: 'i4', name: '4번 아이언', short: '4I', cat: 'iron', dist: 0 },      // 유틸로 대체
    { id: 'i5', name: '5번 아이언', short: '5I', cat: 'iron', dist: 155 },    // 170y (추정)
    { id: 'i6', name: '6번 아이언', short: '6I', cat: 'iron', dist: 146 },    // 160y (추정)
    { id: 'i7', name: '7번 아이언', short: '7I', cat: 'iron', dist: 137 },    // 150y (실측)
    { id: 'i8', name: '8번 아이언', short: '8I', cat: 'iron', dist: 128 },    // 140y (추정)
    { id: 'i9', name: '9번 아이언', short: '9I', cat: 'iron', dist: 117 },    // 128y (추정)
    { id: 'pw', name: '피칭 웨지', short: 'PW', cat: 'wedge', dist: 105 },    // 115y (추정)
    { id: 'aw', name: '어프로치 웨지', short: 'AW', cat: 'wedge', dist: 91 }, // 100y (추정)
    { id: 'sw', name: '샌드 웨지', short: 'SW', cat: 'wedge', dist: 78 },     //  85y (추정)
    { id: 'lw', name: '로브 웨지', short: 'LW', cat: 'wedge', dist: 59 },     //  65y (추정)
    { id: 'pt', name: '퍼터', short: 'PT', cat: 'putter', dist: 0 }
  ];

  function defaultState() {
    return {
      schema: SCHEMA,
      settings: {
        playerName: '',
        unit: 'y',            // 'm' | 'y'
        defaultTee: 'white',
        targetScore: 90,
        gsheet: { clientId: '', spreadsheetId: '', autoSync: false, lastSync: null }
      },
      clubs: JSON.parse(JSON.stringify(DEFAULT_CLUBS)),
      courses: [],            // 기본 데이터 + 사용자 추가/수정본
      holeNotes: {},          // "courseId|nineId|holeNo" -> 나만의 공략 메모
      rounds: [],
      activeRoundId: null,
      updatedAt: null
    };
  }

  var state = null;
  var listeners = [];

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) {
      state = defaultState();
      seedCourses();
      save();
      return;
    }
    try {
      state = JSON.parse(raw);
    } catch (e) {
      console.error('저장 데이터를 읽지 못했습니다. 새로 시작합니다.', e);
      state = defaultState();
    }
    migrate();
    seedCourses();
  }

  function migrate() {
    var d = defaultState();
    if (!state.schema) state.schema = SCHEMA;
    if (!state.settings) state.settings = d.settings;
    else {
      for (var k in d.settings) if (!(k in state.settings)) state.settings[k] = d.settings[k];
      if (!state.settings.gsheet) state.settings.gsheet = d.settings.gsheet;
      else for (var k2 in d.settings.gsheet) if (!(k2 in state.settings.gsheet)) state.settings.gsheet[k2] = d.settings.gsheet[k2];
    }
    if (!Array.isArray(state.clubs) || !state.clubs.length) state.clubs = d.clubs;
    if (!Array.isArray(state.courses)) state.courses = [];
    if (!Array.isArray(state.rounds)) state.rounds = [];
    if (!state.holeNotes) state.holeNotes = {};
  }

  // 기본 골프장 데이터를 넣는다. 이미 있는 id는 사용자가 고쳤을 수 있으므로 건드리지 않는다.
  function seedCourses() {
    var have = {};
    state.courses.forEach(function (c) { have[c.id] = c; });
    var added = 0, patched = 0;
    COURSE_DATA.BUILTIN.forEach(function (c) {
      var mine = have[c.id];
      if (!mine) {
        state.courses.push(JSON.parse(JSON.stringify(c)));
        added++;
        return;
      }
      // 기본 데이터가 수정됐고(예: 피닉스를 27홀 -> 54홀로 정정),
      // 사용자가 "실제 값으로 확인함"을 누르지 않은 코스라면 새 데이터로 교체한다.
      // 직접 확인·수정한 코스(verified)는 절대 덮어쓰지 않는다.
      if (mine.builtin && !mine.verified && (mine.dv || 1) < (c.dv || 1)) {
        var keepFav = mine.fav;
        var fresh = JSON.parse(JSON.stringify(c));
        fresh.fav = (keepFav === undefined) ? c.fav : keepFav;
        state.courses[state.courses.indexOf(mine)] = fresh;
        patched++;
        return;
      }
      // 이전 버전에 없던 항목은 채워 준다 (사용자가 고친 파/거리는 건드리지 않는다)
      if (mine.alias === undefined) { mine.alias = c.alias; patched++; }
      if (mine.fav === undefined) { mine.fav = c.fav; patched++; }
      if (mine.dv === undefined) { mine.dv = 1; patched++; }
    });
    if (added || patched) save();
    return added;
  }

  function save() {
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error(e);
      U.toast('저장 공간이 부족합니다. 백업 후 오래된 라운드를 지워주세요.', 'err');
    }
    listeners.forEach(function (fn) { try { fn(state); } catch (e) { console.error(e); } });
  }

  var S = {
    KEY: KEY,
    DEFAULT_CLUBS: DEFAULT_CLUBS,

    init: function () { load(); return state; },
    get: function () { if (!state) load(); return state; },
    save: save,
    onChange: function (fn) { listeners.push(fn); },

    // ---------- 설정 ----------
    settings: function () { return S.get().settings; },
    unit: function () { return S.get().settings.unit; },
    setSetting: function (key, val) { S.get().settings[key] = val; save(); },

    // ---------- 클럽 ----------
    clubs: function () { return S.get().clubs; },
    club: function (id) {
      var list = S.get().clubs;
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    // 퍼터를 제외한, 거리가 입력된 클럽을 먼 것부터 정렬해서 반환
    swingClubs: function () {
      return S.get().clubs
        .filter(function (c) { return c.cat !== 'putter' && c.dist > 0; })
        .sort(function (a, b) { return b.dist - a.dist; });
    },
    setClubDist: function (id, meters) {
      var c = S.club(id);
      if (c) { c.dist = meters; save(); }
    },
    addClub: function (name, short, cat, dist) {
      S.get().clubs.push({ id: U.uid('cl'), name: name, short: short, cat: cat || 'iron', dist: dist || 0, custom: true });
      save();
    },
    removeClub: function (id) {
      var st = S.get();
      st.clubs = st.clubs.filter(function (c) { return c.id !== id; });
      save();
    },
    resetClubs: function () {
      S.get().clubs = JSON.parse(JSON.stringify(DEFAULT_CLUBS));
      save();
    },

    // ---------- 골프장 ----------
    courses: function (kind) {
      var list = S.get().courses;
      return kind ? list.filter(function (c) { return c.kind === kind; }) : list;
    },
    course: function (id) {
      var list = S.get().courses;
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    nine: function (courseId, nineId) {
      var c = S.course(courseId);
      if (!c) return null;
      for (var i = 0; i < c.nines.length; i++) if (c.nines[i].id === nineId) return c.nines[i];
      return null;
    },
    addCourse: function (course) { S.get().courses.push(course); save(); return course; },
    toggleFav: function (id) {
      var c = S.course(id);
      if (c) { c.fav = !c.fav; save(); }
      return c ? c.fav : false;
    },
    // 검색어가 이름/영문명/지역/별칭 중 하나라도 걸리면 통과
    matchCourse: function (c, q) {
      if (!q) return true;
      return (c.name + ' ' + (c.nameEn || '') + ' ' + (c.region || '') + ' ' +
        (c.area || '') + ' ' + (c.alias || '')).toLowerCase().indexOf(q.toLowerCase()) >= 0;
    },
    removeCourse: function (id) {
      var st = S.get();
      st.courses = st.courses.filter(function (c) { return c.id !== id; });
      save();
    },
    restoreBuiltins: function () { return seedCourses(); },

    // ---------- 홀 공략 메모 ----------
    noteKey: function (courseId, nineId, holeNo) { return courseId + '|' + nineId + '|' + holeNo; },
    getNote: function (courseId, nineId, holeNo) {
      return S.get().holeNotes[S.noteKey(courseId, nineId, holeNo)] || '';
    },
    setNote: function (courseId, nineId, holeNo, text) {
      var st = S.get();
      var k = S.noteKey(courseId, nineId, holeNo);
      if (text && text.trim()) st.holeNotes[k] = text.trim();
      else delete st.holeNotes[k];
      save();
    },

    // ---------- 라운드 ----------
    rounds: function () {
      return S.get().rounds.slice().sort(function (a, b) {
        return (b.date + b.id).localeCompare(a.date + a.id);
      });
    },
    round: function (id) {
      var list = S.get().rounds;
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    activeRound: function () {
      var st = S.get();
      return st.activeRoundId ? S.round(st.activeRoundId) : null;
    },

    /* 라운드 생성
       opts: {kind, courseId, nineIds:[a,b], tee, date, memo, weather} */
    createRound: function (opts) {
      var course = S.course(opts.courseId);
      if (!course) return null;
      var teeDef = null;
      COURSE_DATA.TEES.forEach(function (t) { if (t.id === opts.tee) teeDef = t; });
      var factor = teeDef ? teeDef.factor : 1;

      var holes = [];
      opts.nineIds.forEach(function (nid) {
        var n = S.nine(opts.courseId, nid);
        if (!n) return;
        n.holes.forEach(function (h) {
          holes.push({
            no: holes.length + 1,
            nineId: nid,
            nineName: n.name,
            holeNo: h.no,
            par: h.par,
            dist: Math.round(h.dist * factor), // 미터
            score: null,
            putts: null,
            shots: [],          // 클럽 id 배열 (퍼팅 제외)
            fairway: null,      // 'hit' | 'left' | 'right' | null
            gir: null,          // true | false | null
            penalty: { ob: 0, hazard: 0 },
            bunker: 0,
            memo: ''
          });
        });
      });

      // 홀 핸디캡(난이도 순번)을 계산: 파가 크고 거리가 긴 홀이 어렵다고 본다.
      var order = holes.slice().sort(function (a, b) {
        if (b.par !== a.par) return b.par - a.par;
        return b.dist - a.dist;
      });
      order.forEach(function (h, i) { h.hcp = i + 1; });

      var round = {
        id: U.uid('r'),
        date: opts.date || U.today(),
        kind: opts.kind,
        courseId: course.id,
        courseName: course.name,
        nineIds: opts.nineIds.slice(),
        nineNames: opts.nineIds.map(function (nid) { var n = S.nine(course.id, nid); return n ? n.name : '?'; }),
        tee: opts.tee,
        teeName: teeDef ? teeDef.name : opts.tee,
        unit: S.unit(),
        weather: opts.weather || '',
        memo: opts.memo || '',
        holes: holes,
        done: false,
        createdAt: new Date().toISOString()
      };
      var st = S.get();
      st.rounds.push(round);
      st.activeRoundId = round.id;
      save();
      return round;
    },

    setActiveRound: function (id) { S.get().activeRoundId = id; save(); },
    finishRound: function (id) {
      var r = S.round(id);
      if (r) { r.done = true; }
      var st = S.get();
      if (st.activeRoundId === id) st.activeRoundId = null;
      save();
    },
    reopenRound: function (id) {
      var r = S.round(id);
      if (r) { r.done = false; S.get().activeRoundId = id; save(); }
    },
    removeRound: function (id) {
      var st = S.get();
      st.rounds = st.rounds.filter(function (r) { return r.id !== id; });
      if (st.activeRoundId === id) st.activeRoundId = null;
      save();
    },

    // ---------- 라운드 합계 ----------
    totals: function (round) {
      var t = {
        parPlayed: 0, strokes: 0, putts: 0, holesPlayed: 0,
        fwHit: 0, fwChance: 0, gir: 0, girChance: 0,
        ob: 0, hazard: 0, bunker: 0,
        outStrokes: 0, inStrokes: 0, outPar: 0, inPar: 0,
        birdieOrBetter: 0, par: 0, bogey: 0, doubleOrWorse: 0,
        threePutt: 0, onePutt: 0
      };
      round.holes.forEach(function (h, idx) {
        var first9 = idx < 9;
        if (first9) t.outPar += h.par; else t.inPar += h.par;
        if (h.score) {
          t.holesPlayed++;
          t.parPlayed += h.par;
          t.strokes += h.score;
          if (first9) t.outStrokes += h.score; else t.inStrokes += h.score;
          var d = h.score - h.par;
          if (d <= -1) t.birdieOrBetter++;
          else if (d === 0) t.par++;
          else if (d === 1) t.bogey++;
          else t.doubleOrWorse++;

          t.girChance++;
          if (h.gir) t.gir++;
          if (h.par >= 4) {
            t.fwChance++;
            if (h.fairway === 'hit') t.fwHit++;
          }
        }
        if (typeof h.putts === 'number') {
          t.putts += h.putts;
          if (h.putts >= 3) t.threePutt++;
          if (h.putts === 1) t.onePutt++;
        }
        t.ob += (h.penalty && h.penalty.ob) || 0;
        t.hazard += (h.penalty && h.penalty.hazard) || 0;
        t.bunker += h.bunker || 0;
      });
      t.toPar = t.holesPlayed ? t.strokes - t.parPlayed : null;
      t.totalPar = t.outPar + t.inPar;
      return t;
    },

    // ---------- 백업 / 복원 ----------
    exportJSON: function () { return JSON.stringify(S.get(), null, 2); },
    importJSON: function (text, mode) {
      var incoming = JSON.parse(text);
      if (!incoming || !incoming.rounds) throw new Error('백업 파일 형식이 아닙니다.');
      if (mode === 'replace') {
        state = incoming;
        migrate();
        seedCourses();
        save();
        return { rounds: incoming.rounds.length, mode: 'replace' };
      }
      // merge: 같은 id는 건너뛴다
      var st = S.get();
      var haveR = {}; st.rounds.forEach(function (r) { haveR[r.id] = true; });
      var addedR = 0;
      (incoming.rounds || []).forEach(function (r) { if (!haveR[r.id]) { st.rounds.push(r); addedR++; } });
      var haveC = {}; st.courses.forEach(function (c) { haveC[c.id] = true; });
      var addedC = 0;
      (incoming.courses || []).forEach(function (c) { if (!haveC[c.id]) { st.courses.push(c); addedC++; } });
      for (var k in (incoming.holeNotes || {})) if (!st.holeNotes[k]) st.holeNotes[k] = incoming.holeNotes[k];
      save();
      return { rounds: addedR, courses: addedC, mode: 'merge' };
    },
    clearAll: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      state = defaultState();
      seedCourses();
      save();
    }
  };

  g.Store = S;
})(window);
