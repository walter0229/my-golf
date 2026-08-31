/* 홀 공략법 자동 계산
 * 입력: 홀 정보(파/거리/난이도) + 설정에 저장된 내 클럽별 거리
 * 출력: 티샷부터 그린까지의 클럽 선택 시나리오 + 조언 + 이 홀의 목표 타수
 * 계산은 전부 미터 기준. 화면 표시는 U.toDisplay 로 변환. */
(function (g) {
  'use strict';

  // 남은 거리에 가장 가까운 클럽
  function pickClub(dist, clubs) {
    if (!clubs.length || dist <= 0) return null;
    var best = null, bestDiff = Infinity;
    clubs.forEach(function (c) {
      var d = Math.abs(c.dist - dist);
      if (d < bestDiff) { bestDiff = d; best = c; }
    });
    return best;
  }

  // 티샷용 클럽: 가장 멀리 치는 클럽 (보통 드라이버)
  function longest(clubs) { return clubs.length ? clubs[0] : null; }

  // 드라이버를 뺀 나머지 중 가장 먼 클럽 (세컨샷 그린 공략 판단용)
  function longestSecond(clubs) { return clubs.length > 1 ? clubs[1] : null; }

  // 풀스윙하기 편한 웨지 거리 (레이업 목표 지점). 100m 에 가장 가까운 클럽 기준.
  function layupTarget(clubs) {
    var wedges = clubs.filter(function (c) { return c.dist > 0 && c.dist <= 120; });
    if (!wedges.length) return clubs.length ? clubs[clubs.length - 1].dist : 90;
    var best = wedges[0], bestDiff = Infinity;
    wedges.forEach(function (c) {
      var d = Math.abs(c.dist - 100);
      if (d < bestDiff) { bestDiff = d; best = c; }
    });
    return best.dist;
  }

  /* 목표 스코어를 홀 난이도(hcp)에 따라 배분한다.
     예) 목표 90타 / 코스 파 72 -> 18타를 더 쳐도 됨 -> 모든 홀에서 보기가 목표.
         목표 81타 -> 9타 -> 어려운 홀 1~9번에서만 보기, 나머지는 파. */
  function targetForHole(hole, extraStrokes) {
    var hcp = hole.hcp || 10;
    var base = hole.par;
    if (extraStrokes <= 0) return base;
    var full = Math.floor(extraStrokes / 18);
    var rest = extraStrokes % 18;
    return base + full + (hcp <= rest ? 1 : 0);
  }

  /* 메인 함수
     hole: {par, dist(m), hcp, no}
     opts: {clubs, unit, extraStrokes, kind, estimated}
     반환: {steps:[...], tips:[...], target, twoOnPossible} */
  function build(hole, opts) {
    opts = opts || {};
    var clubs = (opts.clubs || []).slice().sort(function (a, b) { return b.dist - a.dist; });
    var unit = opts.unit || 'm';
    var D = hole.dist;
    var steps = [];
    var tips = [];
    var twoOn = false;

    var fmt = function (m) { return U.toDisplay(m, unit) + U.unitLabel(unit); };

    if (!clubs.length) {
      return {
        steps: [],
        tips: ['설정 > 내 클럽 거리에서 클럽별 거리를 입력하면 이 홀의 공략 루트를 계산해 드립니다.'],
        target: hole.par + 1,
        twoOnPossible: false
      };
    }

    var dr = longest(clubs);
    var fw = longestSecond(clubs);

    if (hole.par === 3) {
      var c3 = pickClub(D, clubs);
      var gap = c3 ? D - c3.dist : 0;
      steps.push({
        n: 1, label: '티샷 (그린 공략)', club: c3, from: D, remain: 0,
        note: Math.abs(gap) <= 4 ? '거리가 딱 맞습니다.'
          : gap > 0 ? '내 거리보다 ' + fmt(gap) + ' 깁니다. 한 클럽 길게 잡으세요.'
            : '내 거리보다 ' + fmt(-gap) + ' 짧습니다. 그립을 내려 잡거나 한 클럽 짧게.'
      });
      tips.push('파3는 핀보다 그린 한가운데를 보고 치는 편이 스코어에 유리합니다.');
      if (D >= 170) tips.push('긴 파3입니다. 그린 앞쪽에 떨어뜨려 굴려 올리는 것도 좋은 선택입니다.');
    } else if (hole.par === 4) {
      var remainWithDr = D - dr.dist;

      if (remainWithDr <= 20) {
        // 드라이버로 그린까지 닿는 짧은 파4
        steps.push({
          n: 1, label: '티샷 (그린 직접 공략 가능)', club: dr, from: D, remain: Math.max(0, remainWithDr),
          note: '드라이버로 그린 근처까지 갑니다. 앞쪽 벙커/해저드가 있으면 아래 레이업을 선택하세요.'
        });
        var lay = layupTarget(clubs);
        var layClub = pickClub(D - lay, clubs);
        if (layClub) {
          steps.push({
            n: 1, alt: true, label: '대안 티샷 (안전한 레이업)', club: layClub, from: D, remain: D - layClub.dist,
            note: '남은 거리를 ' + fmt(D - layClub.dist) + ' 로 만들어 편한 풀스윙 어프로치.'
          });
          steps.push({ n: 2, alt: true, label: '두 번째 샷 (그린 공략)', club: pickClub(D - layClub.dist, clubs), from: D - layClub.dist, remain: 0, note: '' });
        }
      } else {
        var teeClub = dr;
        var remain = remainWithDr;

        // 드라이버로 치면 남은 거리가 너무 애매한 경우(웨지보다 짧음) 티샷 클럽을 낮춘다
        var shortest = clubs[clubs.length - 1];
        if (remain > 0 && remain < shortest.dist * 0.7) {
          var target = layupTarget(clubs);
          var alt = pickClub(D - target, clubs);
          if (alt && alt.id !== dr.id) { teeClub = alt; remain = D - alt.dist; }
        }

        steps.push({
          n: 1, label: '티샷', club: teeClub, from: D, remain: remain,
          note: teeClub.id === dr.id ? '' : '드라이버 대신 ' + teeClub.name + '. 남은 거리를 편한 풀스윙 거리로 맞춥니다.'
        });

        var app = pickClub(remain, clubs);
        var appGap = app ? remain - app.dist : 0;
        steps.push({
          n: 2, label: '두 번째 샷 (그린 공략)', club: app, from: remain, remain: 0,
          note: !app ? '남은 거리가 클럽 범위를 벗어납니다.'
            : Math.abs(appGap) <= 4 ? '거리가 딱 맞습니다.'
              : appGap > 0 ? '한 클럽 길게 잡으세요. (' + fmt(appGap) + ' 부족)'
                : '한 클럽 짧게 또는 컨트롤 스윙. (' + fmt(-appGap) + ' 넘침)'
        });

        if (remain > (fw ? fw.dist : dr.dist)) {
          tips.push('티샷이 잘 맞아도 세컨이 ' + fmt(remain) + ' 남습니다. 무리하지 말고 그린 앞에 붙여 3온 2퍼트를 노리세요.');
        }
      }
    } else {
      // 파5
      var r1 = D - dr.dist;
      var canGo = fw && r1 <= fw.dist + 10;
      twoOn = !!canGo;

      steps.push({ n: 1, label: '티샷', club: dr, from: D, remain: r1, note: '' });

      if (canGo) {
        var c2 = pickClub(r1, clubs);
        steps.push({
          n: 2, label: '두 번째 샷 (2온 시도)', club: c2, from: r1, remain: 0,
          note: '티샷이 페어웨이에 잘 갔을 때만. 그린 앞이 막혀 있으면 아래 레이업으로.'
        });
        var lay2 = layupTarget(clubs);
        var layC2 = pickClub(r1 - lay2, clubs);
        if (layC2) {
          steps.push({ n: 2, alt: true, label: '대안 두 번째 샷 (레이업)', club: layC2, from: r1, remain: r1 - layC2.dist, note: '남은 ' + fmt(r1 - layC2.dist) + ' 를 풀스윙으로.' });
          steps.push({ n: 3, alt: true, label: '세 번째 샷 (그린 공략)', club: pickClub(r1 - layC2.dist, clubs), from: r1 - layC2.dist, remain: 0, note: '' });
        }
        tips.push('2온이 가능한 길이입니다. 다만 실패했을 때 벌타가 나올 위치라면 레이업이 평균 스코어에 더 좋습니다.');
      } else {
        var third = layupTarget(clubs);
        var c2b = pickClub(r1 - third, clubs);
        var actualRemain = c2b ? r1 - c2b.dist : third;
        steps.push({
          n: 2, label: '두 번째 샷 (레이업)', club: c2b, from: r1, remain: actualRemain,
          note: '남은 거리를 ' + fmt(actualRemain) + ' 로 맞춰 세 번째 샷을 풀스윙으로 만듭니다.'
        });
        steps.push({
          n: 3, label: '세 번째 샷 (그린 공략)', club: pickClub(actualRemain, clubs), from: actualRemain, remain: 0, note: ''
        });
        tips.push('파5는 세 번째 샷 거리를 내가 제일 자신 있는 거리로 만드는 것이 핵심입니다.');
      }
    }

    // 난이도 조언
    if (hole.hcp) {
      if (hole.hcp <= 4) tips.push('코스에서 가장 어려운 홀 중 하나입니다(난이도 ' + hole.hcp + '위). 보기로 막아도 성공입니다.');
      else if (hole.hcp >= 15) tips.push('가장 쉬운 홀 중 하나입니다(난이도 ' + hole.hcp + '위). 여기서 타수를 벌어야 합니다.');
    }

    if (opts.kind === 'screen') {
      tips.push('스크린은 런이 실제보다 길게 나오는 경우가 많습니다. 캐리 거리 기준으로 한 클럽 짧게 잡아보세요.');
    }

    if (opts.estimated) {
      tips.push('이 코스의 거리는 추정값입니다. 설정 > 골프장 관리에서 실제 거리를 넣으면 공략이 정확해집니다.');
    }

    var target = targetForHole(hole, opts.extraStrokes || 0);
    tips.push('이 홀 목표: ' + target + '타 (' + U.scoreName(target, hole.par) + ') · 그린 적중 후 2퍼트 기준.');

    return { steps: steps, tips: tips, target: target, twoOnPossible: twoOn };
  }

  g.Strategy = {
    build: build,
    pickClub: pickClub,
    targetForHole: targetForHole,
    layupTarget: layupTarget
  };
})(window);
