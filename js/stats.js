/* 통계 & 약점 진단 */
(function (g) {
  'use strict';

  function completed(rounds) {
    return rounds.filter(function (r) {
      var played = 0;
      r.holes.forEach(function (h) { if (h.score) played++; });
      return played >= 9;
    });
  }

  function summary(rounds) {
    var s = {
      rounds: 0, holes: 0,
      strokes: 0, par: 0,
      putts: 0, puttHoles: 0,
      threePutt: 0, onePutt: 0,
      fwHit: 0, fwChance: 0,
      gir: 0, girChance: 0,
      ob: 0, hazard: 0, bunker: 0,
      dist: { 3: [], 4: [], 5: [] },
      byScore: { eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, triplePlus: 0 },
      full18: [],      // 18홀 완주 라운드의 총타수
      trend: [],       // {date, score, toPar, courseName}
      byCourse: {},    // courseId -> {name, n, sum, par}
      byClub: {}       // clubId -> {n, sumToPar, holes}
    };

    rounds.forEach(function (r) {
      var played = 0, strokes = 0, parSum = 0;
      r.holes.forEach(function (h) {
        if (!h.score) {
          if (typeof h.putts === 'number') { s.putts += h.putts; s.puttHoles++; }
          return;
        }
        played++;
        strokes += h.score;
        parSum += h.par;
        s.holes++;
        s.strokes += h.score;
        s.par += h.par;

        var d = h.score - h.par;
        if (d <= -2) s.byScore.eagle++;
        else if (d === -1) s.byScore.birdie++;
        else if (d === 0) s.byScore.par++;
        else if (d === 1) s.byScore.bogey++;
        else if (d === 2) s.byScore.double++;
        else s.byScore.triplePlus++;

        if (s.dist[h.par]) s.dist[h.par].push(d);

        s.girChance++;
        if (h.gir) s.gir++;
        if (h.par >= 4) {
          s.fwChance++;
          if (h.fairway === 'hit') s.fwHit++;
        }
        if (typeof h.putts === 'number') {
          s.putts += h.putts;
          s.puttHoles++;
          if (h.putts >= 3) s.threePutt++;
          if (h.putts === 1) s.onePutt++;
        }
        s.ob += (h.penalty && h.penalty.ob) || 0;
        s.hazard += (h.penalty && h.penalty.hazard) || 0;
        s.bunker += h.bunker || 0;

        // 티샷 클럽별 성적
        if (h.shots && h.shots.length) {
          var cid = h.shots[0];
          if (!s.byClub[cid]) s.byClub[cid] = { n: 0, sumToPar: 0, fwHit: 0, fwChance: 0 };
          s.byClub[cid].n++;
          s.byClub[cid].sumToPar += d;
          if (h.par >= 4) {
            s.byClub[cid].fwChance++;
            if (h.fairway === 'hit') s.byClub[cid].fwHit++;
          }
        }
      });

      if (played === 0) return;
      s.rounds++;

      if (played >= 18) s.full18.push(strokes);
      s.trend.push({
        date: r.date, score: strokes, toPar: strokes - parSum,
        holes: played, courseName: r.courseName, kind: r.kind, id: r.id
      });

      if (!s.byCourse[r.courseId]) s.byCourse[r.courseId] = { name: r.courseName, n: 0, sum: 0, par: 0, best: null };
      var bc = s.byCourse[r.courseId];
      if (played >= 18) {
        bc.n++; bc.sum += strokes; bc.par += parSum;
        if (bc.best === null || strokes < bc.best) bc.best = strokes;
      }
    });

    s.trend.sort(function (a, b) { return a.date.localeCompare(b.date); });

    // 파생 지표
    s.avg18 = U.avg(s.full18);
    s.best18 = s.full18.length ? Math.min.apply(null, s.full18) : null;
    s.worst18 = s.full18.length ? Math.max.apply(null, s.full18) : null;
    s.avgToPar = s.holes ? (s.strokes - s.par) / s.holes : null;
    s.puttsPerHole = s.puttHoles ? s.putts / s.puttHoles : null;
    s.puttsPer18 = s.puttsPerHole === null ? null : s.puttsPerHole * 18;
    s.fwPct = U.pct(s.fwHit, s.fwChance);
    s.girPct = U.pct(s.gir, s.girChance);
    s.threePuttPer18 = s.puttHoles ? (s.threePutt / s.puttHoles) * 18 : null;
    s.onePuttPer18 = s.puttHoles ? (s.onePutt / s.puttHoles) * 18 : null;
    s.obPerRound = s.rounds ? s.ob / s.rounds : null;
    s.hazardPerRound = s.rounds ? s.hazard / s.rounds : null;
    s.avgPar3 = U.avg(s.dist[3]);
    s.avgPar4 = U.avg(s.dist[4]);
    s.avgPar5 = U.avg(s.dist[5]);
    s.recent5 = U.avg(s.full18.slice(-5));

    return s;
  }

  /* 약점 진단: 보기 플레이어(90타) 기준선과 비교해서 개선 우선순위를 뽑아낸다. */
  function diagnose(s) {
    var out = [];
    if (!s.holes) return out;

    // 표본이 너무 적으면 엉뚱한 진단이 나오므로 최소 18홀 기록을 요구한다
    if (s.holes < 18) {
      return [{
        level: 'ok', title: '진단하기에는 기록이 적습니다',
        detail: '지금까지 ' + s.holes + '홀 기록. 18홀(1라운드) 이상 쌓이면 약점 진단을 시작합니다.',
        action: ''
      }];
    }

    // 1) 퍼팅
    if (s.puttsPer18 !== null && s.puttHoles >= 18) {
      if (s.puttsPer18 >= 36) {
        out.push({
          level: 'high', title: '퍼팅이 가장 큰 손실 구간입니다',
          detail: '라운드당 평균 ' + U.round1(s.puttsPer18) + '퍼트. 36퍼트 이상이면 스코어의 40% 이상이 그린 위에서 나갑니다. 목표는 32퍼트입니다.',
          action: '10m 롱퍼트 거리감 위주로 연습하세요. 방향보다 거리 오차가 3퍼트를 만듭니다.'
        });
      } else if (s.puttsPer18 >= 33) {
        out.push({
          level: 'mid', title: '퍼팅 개선 여지가 있습니다',
          detail: '라운드당 평균 ' + U.round1(s.puttsPer18) + '퍼트. 32퍼트까지 줄이면 그대로 타수가 됩니다.',
          action: '1.5m 이내 짧은 퍼트 성공률을 올리세요.'
        });
      }
    }

    // 2) 3퍼트
    if (s.threePuttPer18 !== null && s.puttHoles >= 18 && s.threePuttPer18 >= 3) {
      out.push({
        level: 'high', title: '3퍼트가 많습니다',
        detail: '라운드당 ' + U.round1(s.threePuttPer18) + '회. 첫 퍼트를 홀 1m 안에 붙이는 연습이 필요합니다.',
        action: '연습 그린에서 15m/20m 거리 맞추기만 20개씩.'
      });
    }

    // 3) 페어웨이
    if (s.fwPct !== null && s.fwChance >= 20) {
      if (s.fwPct < 35) {
        out.push({
          level: 'high', title: '티샷 페어웨이 안착률이 낮습니다',
          detail: '페어웨이 안착 ' + s.fwPct + '% (' + s.fwHit + '/' + s.fwChance + '). 티샷이 흔들리면 뒤에 있는 모든 샷이 어려워집니다.',
          action: '어려운 홀에서는 드라이버 대신 우드/유틸로 티샷하는 전략을 시험해 보세요. 앱의 공략법에서 대안 티샷을 확인하세요.'
        });
      } else if (s.fwPct < 50) {
        out.push({
          level: 'mid', title: '페어웨이 안착률 ' + s.fwPct + '%',
          detail: '보기 플레이어 평균 수준입니다. 50% 이상이면 파 세이브가 눈에 띄게 늘어납니다.',
          action: ''
        });
      }
    }

    // 4) 그린 적중
    if (s.girPct !== null && s.girChance >= 20) {
      if (s.girPct < 15) {
        out.push({
          level: 'high', title: '그린 적중률이 낮습니다',
          detail: '파온 ' + s.girPct + '%. 아이언 거리가 실제보다 길게 설정돼 있을 가능성이 큽니다.',
          action: '설정 > 내 클럽 거리를 캐리(뜬 거리) 기준으로 다시 재보세요. 대부분 10~15m 짧습니다.'
        });
      } else if (s.girPct < 30) {
        out.push({
          level: 'mid', title: '그린 적중률 ' + s.girPct + '%',
          detail: '30%를 넘기면 80대 스코어가 안정적으로 나옵니다.',
          action: '100~130m 구간 어프로치 정확도를 집중적으로 올리세요.'
        });
      }
    }

    // 5) 벌타
    if (s.obPerRound !== null && s.rounds >= 2 && s.obPerRound >= 1.5) {
      out.push({
        level: 'high', title: 'OB가 라운드당 ' + U.round1(s.obPerRound) + '회',
        detail: 'OB 한 번은 보통 2타 손실입니다. 라운드당 ' + U.round1(s.obPerRound * 2) + '타를 여기서 잃고 있습니다.',
        action: 'OB가 자주 나는 홀에 나만의 메모를 남기고, 그 홀에서는 티샷 클럽을 한 단계 낮춰보세요.'
      });
    }
    if (s.hazardPerRound !== null && s.rounds >= 2 && s.hazardPerRound >= 2) {
      out.push({
        level: 'mid', title: '해저드 벌타가 잦습니다',
        detail: '라운드당 ' + U.round1(s.hazardPerRound) + '회.',
        action: '해저드를 넘기는 샷은 넘어가는 거리 + 10m 클럽으로 잡으세요.'
      });
    }

    // 6) 파별 약점
    var pars = [
      { p: 3, v: s.avgPar3, n: s.dist[3].length, label: '파3' },
      { p: 4, v: s.avgPar4, n: s.dist[4].length, label: '파4' },
      { p: 5, v: s.avgPar5, n: s.dist[5].length, label: '파5' }
    ].filter(function (x) { return x.v !== null && x.n >= 6; });
    if (pars.length >= 2) {
      pars.sort(function (a, b) { return b.v - a.v; });
      var worst = pars[0], best = pars[pars.length - 1];
      if (worst.v - best.v >= 0.4) {
        out.push({
          level: 'mid', title: worst.label + '에서 유독 타수를 잃습니다',
          detail: worst.label + ' 평균 ' + U.sign(U.round1(worst.v)) + ' / ' + best.label + ' 평균 ' + U.sign(U.round1(best.v)) + '.',
          action: worst.p === 3 ? '파3는 티 높이와 클럽 선택 문제인 경우가 많습니다. 그린 중앙 공략으로 바꿔보세요.'
            : worst.p === 5 ? '파5에서 2온을 무리하게 노리고 있지는 않은지 확인하세요. 레이업 전략을 써보세요.'
              : '파4 세컨샷 거리(120~160m) 구간 연습이 필요합니다.'
        });
      }
    }

    // 7) 더블보기 이상
    var bad = s.byScore.double + s.byScore.triplePlus;
    if (s.holes >= 18 && (bad / s.holes) >= 0.28) {
      out.push({
        level: 'high', title: '더블보기 이상이 전체의 ' + U.pct(bad, s.holes) + '%',
        detail: '큰 실수 하나가 라운드를 무너뜨리고 있습니다.',
        action: '트러블에 빠지면 무조건 페어웨이로 빼내는 것을 원칙으로 삼으세요. 더블을 보기로 바꾸는 것이 버디보다 스코어에 큽니다.'
      });
    }

    if (!out.length) {
      out.push({
        level: 'ok', title: '눈에 띄는 약점이 없습니다',
        detail: '기록이 더 쌓이면 더 정확한 진단이 나옵니다. 최소 3라운드 이상 기록해 보세요.',
        action: ''
      });
    }

    var rank = { high: 0, mid: 1, ok: 2 };
    out.sort(function (a, b) { return rank[a.level] - rank[b.level]; });
    return out;
  }

  g.Stats = { summary: summary, diagnose: diagnose, completed: completed };
})(window);
