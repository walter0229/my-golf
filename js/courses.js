/* 골프장 기본 데이터
 * ------------------------------------------------------------------
 * [정확도 안내]
 * 골프장 이름 / 지역 / 코스(9홀) 구성은 알려진 정보를 바탕으로 넣었습니다.
 * 그러나 홀별 파 배치, 거리, 핸디캡 순번은 실제 스코어카드 값이 아니라
 * 표준 규격에서 만들어낸 추정값입니다. (par 72 기준)
 * 앱에서는 이런 코스에 "거리 미확인" 배지가 표시되며,
 * 설정 > 골프장 관리에서 실제 스코어카드를 보고 수정하면 배지가 사라집니다.
 * ------------------------------------------------------------------ */
(function (g) {
  'use strict';

  // 9홀 파 배치 템플릿 (각 합계 36)
  var ROUTINGS = [
    [4, 5, 4, 3, 4, 4, 3, 5, 4],
    [4, 4, 3, 5, 4, 3, 4, 5, 4],
    [5, 4, 3, 4, 4, 5, 3, 4, 4],
    [4, 3, 5, 4, 4, 3, 4, 4, 5]
  ];

  // 티박스 정의 (블랙 티 거리를 기준으로 한 비율)
  var TEES = [
    { id: 'black', name: '블랙 (챔피언)', factor: 1.0 },
    { id: 'blue', name: '블루', factor: 0.94 },
    { id: 'white', name: '화이트', factor: 0.87 },
    { id: 'red', name: '레드', factor: 0.77 }
  ];

  /* 베트남 필드 골프장
     [id, 한글명, 영문명, 지역, 권역, [ [코스명, 라우팅번호], ... ], 별칭(검색어), 즐겨찾기 ] */
  var VN = [
    ['vn-kingsisland', 'BRG 킹스아일랜드 골프리조트', 'BRG Kings Island Golf Resort', '하노이 선떠이', '북부',
      [['레이크사이드 OUT', 0], ['레이크사이드 IN', 1], ['마운틴뷰 OUT', 2], ['마운틴뷰 IN', 3], ['킹스 OUT', 1], ['킹스 IN', 0]],
      '동모 동모호수 Dong Mo 킹스 아일랜드 킹아', true],
    ['vn-legendhill', 'BRG 레전드힐 골프리조트', 'BRG Legend Hill Golf Resort', '하노이 속선', '북부',
      [['OUT', 0], ['IN', 1]]],
    ['vn-vantri', '반찌 골프클럽', 'Van Tri Golf Club', '하노이 동아인', '북부',
      [['OUT', 1], ['IN', 2]]],
    ['vn-longbien', '롱비엔 골프코스', 'Long Bien Golf Course', '하노이 롱비엔', '북부',
      [['A코스', 0], ['B코스', 1], ['C코스', 3]]],
    ['vn-skylake', '스카이레이크 리조트 앤 골프클럽', 'Sky Lake Resort and Golf Club', '하노이 쯔엉미', '북부',
      [['스카이 OUT', 2], ['스카이 IN', 0], ['레이크 OUT', 1], ['레이크 IN', 3]],
      '스카이 레이크 스레 Sky Lake', true],
    ['vn-phoenix', '피닉스 골프리조트', 'Phoenix Golf Resort', '호아빈 르엉선', '북부',
      [['챔피언', 0], ['드래곤', 1], ['피닉스', 2]],
      '피닉스 Phoenix 훼닉스', true],
    ['vn-hilltopvalley', '힐탑밸리 골프클럽', 'Hilltop Valley Golf Club', '호아빈', '북부',
      [['OUT', 3], ['IN', 0]]],
    ['vn-tamdao', '땀다오 골프리조트', 'Tam Dao Golf Resort', '빈푹', '북부',
      [['OUT', 1], ['IN', 2]],
      '땀다오 탐다오 Tam Dao', true],
    ['vn-dailai', '다이라이 스타 골프 앤 컨트리클럽', 'Dai Lai Star Golf and Country Club', '빈푹', '북부',
      [['OUT', 0], ['IN', 3]]],
    ['vn-heronlake', '헤론레이크 골프코스 앤 리조트', 'Heron Lake Golf Course and Resort', '빈푹 담박', '북부',
      [['OUT', 2], ['IN', 1]]],
    ['vn-thanhlanh', '타인란 밸리 골프 앤 리조트', 'Thanh Lanh Valley Golf and Resort', '빈푹', '북부',
      [['OUT', 0], ['IN', 2]]],
    ['vn-chilinh', '찌린 스타 골프 앤 컨트리클럽', 'Chi Linh Star Golf and Country Club', '하이즈엉', '북부',
      [['A코스', 0], ['B코스', 1], ['C코스', 2], ['D코스', 3]]],
    ['vn-rubytree', 'BRG 루비트리 골프리조트', 'BRG Ruby Tree Golf Resort', '하이퐁 도선', '북부',
      [['OUT', 1], ['IN', 0]]],
    ['vn-vinpearlhp', '빈펄 골프 하이퐁', 'Vinpearl Golf Hai Phong', '하이퐁 부옌', '북부',
      [['A코스', 0], ['B코스', 2], ['C코스', 1]]],
    ['vn-yendung', '옌중 리조트 앤 골프클럽', 'Yen Dung Resort and Golf Club', '박장', '북부',
      [['A코스', 3], ['B코스', 0], ['C코스', 1]]],
    ['vn-trangan', '짱안 골프 앤 컨트리클럽', 'Trang An Golf and Country Club', '닌빈', '북부',
      [['A코스', 1], ['B코스', 2], ['C코스', 0]]],
    ['vn-royalninhbinh', '로얄 골프클럽 닌빈', 'Royal Golf Club Ninh Binh', '닌빈', '북부',
      [['OUT', 0], ['IN', 1]]],
    ['vn-flchalong', 'FLC 하롱베이 골프클럽', 'FLC Ha Long Bay Golf Club', '꽝닌 하롱', '북부',
      [['OUT', 2], ['IN', 3]]],
    ['vn-flcsamson', 'FLC 삼손 골프링크스', 'FLC Sam Son Golf Links', '타인호아', '중부',
      [['OUT', 0], ['IN', 1]]],
    ['vn-cualo', '끄어로 골프리조트', 'Cua Lo Golf Resort', '응에안', '중부',
      [['OUT', 1], ['IN', 3]]],
    ['vn-dienlam', '므엉타인 지엔럼 골프클럽', 'Muong Thanh Dien Lam Golf Club', '응에안', '중부',
      [['OUT', 2], ['IN', 0]]],
    ['vn-xuanthanh', '쑤언타인 골프 앤 리조트', 'Xuan Thanh Golf and Resort', '하띤', '중부',
      [['OUT', 0], ['IN', 2]]],
    ['vn-flcquangbinh', 'FLC 꽝빈 골프링크스', 'FLC Quang Binh Golf Links', '꽝빈', '중부',
      [['오션 OUT', 1], ['오션 IN', 0], ['포레스트 OUT', 3], ['포레스트 IN', 2]]],
    ['vn-laguna', '라구나 랑꼬 골프클럽', 'Laguna Lang Co Golf Club', '후에 랑꼬', '중부',
      [['OUT', 0], ['IN', 1]]],
    ['vn-brgdanang', 'BRG 다낭 골프리조트 (노먼)', 'BRG Danang Golf Resort - Norman', '다낭', '중부',
      [['노먼 OUT', 1], ['노먼 IN', 2]]],
    ['vn-legenddanang', 'BRG 다낭 골프리조트 (레전드)', 'BRG Danang Golf Resort - Legend', '다낭', '중부',
      [['레전드 OUT', 0], ['레전드 IN', 3]]],
    ['vn-banahills', '바나힐스 골프클럽', 'Ba Na Hills Golf Club', '다낭', '중부',
      [['OUT', 2], ['IN', 0]]],
    ['vn-montgomerie', '몽고메리 링크스', 'Montgomerie Links Vietnam', '꽝남 디엔반', '중부',
      [['OUT', 1], ['IN', 3]]],
    ['vn-hoiana', '호이아나 쇼어스 골프클럽', 'Hoiana Shores Golf Club', '꽝남 주이쑤옌', '중부',
      [['OUT', 0], ['IN', 2]]],
    ['vn-vinpearlnamhoian', '빈펄 골프 남호이안', 'Vinpearl Golf Nam Hoi An', '꽝남', '중부',
      [['OUT', 3], ['IN', 1]]],
    ['vn-vinpearlnhatrang', '빈펄 골프 냐짱', 'Vinpearl Golf Nha Trang', '카인호아 냐짱', '중부',
      [['OUT', 0], ['IN', 1]]],
    ['vn-kngolflinks', 'KN 골프링크스 깜라인', 'KN Golf Links Cam Ranh', '카인호아 깜라인', '중부',
      [['A코스', 2], ['B코스', 0], ['C코스', 3]]],
    ['vn-diamondbay', '다이아몬드베이 골프 앤 빌라', 'Diamond Bay Golf and Villas', '카인호아 냐짱', '중부',
      [['OUT', 1], ['IN', 2]]],
    ['vn-dalatpalace', '달랏 팰리스 골프클럽', 'Dalat Palace Golf Club', '럼동 달랏', '중부',
      [['OUT', 0], ['IN', 3]]],
    ['vn-samtuyenlam', 'SAM 뚜옌럼 골프 앤 리조트', 'SAM Tuyen Lam Golf and Resorts', '럼동 달랏', '중부',
      [['OUT', 2], ['IN', 1]]],
    ['vn-dalat1200', '더 달랏 앳 1200 컨트리클럽', 'The Dalat at 1200 Country Club', '럼동 다떼', '중부',
      [['OUT', 3], ['IN', 0]]],
    ['vn-pgaocean', 'PGA 오션 골프코스 (노바월드 판티엣)', 'PGA Ocean Golf Course', '빈투언 판티엣', '중부',
      [['OUT', 1], ['IN', 2]]],
    ['vn-sealinks', '씨링크스 골프 앤 컨트리클럽', 'Sea Links Golf and Country Club', '빈투언 무이네', '중부',
      [['OUT', 0], ['IN', 1]]],
    ['vn-vgcc', '베트남 골프 앤 컨트리클럽', 'Vietnam Golf and Country Club', '호치민 투득', '남부',
      [['이스트 OUT', 0], ['이스트 IN', 1], ['웨스트 OUT', 2], ['웨스트 IN', 3]]],
    ['vn-tansonnhat', '떤선녓 골프코스', 'Tan Son Nhat Golf Course', '호치민 떤빈', '남부',
      [['A코스', 1], ['B코스', 0], ['C코스', 3], ['D코스', 2]]],
    ['vn-songbe', '송베 골프리조트', 'Song Be Golf Resort', '빈즈엉 투안안', '남부',
      [['팜 (Palm)', 0], ['로터스 (Lotus)', 1], ['데사 (Desa)', 2]]],
    ['vn-twindoves', '트윈도브스 골프클럽', 'Twin Doves Golf Club', '빈즈엉', '남부',
      [['A코스', 2], ['B코스', 3], ['C코스', 0]]],
    ['vn-harmonie', '하모니 골프파크', 'Harmonie Golf Park', '빈즈엉', '남부',
      [['OUT', 1], ['IN', 0]]],
    ['vn-mekong', '메콩 골프클럽', 'Mekong Golf Club', '빈즈엉', '남부',
      [['OUT', 3], ['IN', 2]]],
    ['vn-longthanh', '롱타인 골프클럽', 'Long Thanh Golf Club', '동나이', '남부',
      [['힐 OUT', 0], ['힐 IN', 1], ['레이크 OUT', 2], ['레이크 IN', 3]]],
    ['vn-taekwang', '태광 정산 컨트리클럽', 'Taekwang Jeongsan Country Club', '동나이', '남부',
      [['A코스', 1], ['B코스', 2], ['C코스', 0]]],
    ['vn-dongnai', '동나이 골프리조트', 'Dong Nai Golf Resort', '동나이', '남부',
      [['OUT', 3], ['IN', 1]]],
    ['vn-thebluffs', '더 블러프스 호짬', 'The Bluffs Ho Tram Strip', '바리아붕따우 호짬', '남부',
      [['OUT', 0], ['IN', 2]]],
    ['vn-vinpearlpq', '빈펄 골프 푸꾸옥', 'Vinpearl Golf Phu Quoc', '끼엔장 푸꾸옥', '남부',
      [['A코스', 1], ['B코스', 3], ['C코스', 0]]]
  ];

  /* 스크린골프 코스 템플릿
     파 배치와 거리는 표준 추정값입니다. 라운드 한 번 돌고 실제 값으로 고쳐서 쓰세요. */
  var SCREEN = [
    ['scr-generic', '직접 입력용 (표준 파72)', 'Custom Par 72', '스크린', '스크린', [['OUT', 0], ['IN', 1]]],
    ['scr-bearsbest', '베어즈베스트 청라', 'Bears Best Cheongna', '스크린', '스크린', [['OUT', 0], ['IN', 1]]],
    ['scr-sky72ocean', '스카이72 오션코스', 'Sky72 Ocean', '스크린', '스크린', [['OUT', 1], ['IN', 2]]],
    ['scr-southlinks', '사우스링스 영암', 'South Links Yeongam', '스크린', '스크린', [['OUT', 2], ['IN', 0]]],
    ['scr-pinebeach', '파인비치 골프링크스', 'Pine Beach Golf Links', '스크린', '스크린', [['OUT', 3], ['IN', 1]]],
    ['scr-oakvalley', '오크밸리', 'Oak Valley', '스크린', '스크린', [['OUT', 0], ['IN', 2]]],
    ['scr-blueone', '블루원 용인', 'Blue One Yongin', '스크린', '스크린', [['OUT', 1], ['IN', 3]]],
    ['scr-highone', '하이원 컨트리클럽', 'High1 Country Club', '스크린', '스크린', [['OUT', 2], ['IN', 1]]],
    ['scr-lavieest', '라비에벨 컨트리클럽', 'La Vie est Belle CC', '스크린', '스크린', [['OUT', 3], ['IN', 0]]],
    ['scr-montvert', '몽베르 컨트리클럽', 'Mont Vert CC', '스크린', '스크린', [['OUT', 0], ['IN', 3]]],
    ['scr-saintfour', '세인트포 컨트리클럽', 'Saint Four CC', '스크린', '스크린', [['OUT', 1], ['IN', 0]]]
  ];

  // 파 -> 블랙티 추정 거리(m). 시드로 홀마다 다른 값을 안정적으로 생성.
  function estDistance(seed, par) {
    var h = U.hash(seed);
    if (par === 3) return 140 + (h % 46);
    if (par === 5) return 458 + (h % 78);
    return 312 + (h % 96);
  }

  function buildCourse(row, kind) {
    var id = row[0], name = row[1], nameEn = row[2], region = row[3], area = row[4], nines = row[5];
    return {
      id: id,
      kind: kind,
      name: name,
      nameEn: nameEn,
      region: region,
      area: area,
      alias: row[6] || '',    // 검색용 별칭 (예: 킹스아일랜드를 "동모"로 검색)
      fav: !!row[7],          // 자주 가는 곳 (목록 맨 위에 고정)
      builtin: true,
      verified: false,
      nines: nines.map(function (n, ni) {
        var pars = ROUTINGS[n[1]];
        return {
          id: id + '-n' + ni,
          name: n[0],
          holes: pars.map(function (par, hi) {
            return { no: hi + 1, par: par, dist: estDistance(id + '|' + ni + '|' + hi, par) };
          })
        };
      })
    };
  }

  var BUILTIN = []
    .concat(VN.map(function (r) { return buildCourse(r, 'field'); }))
    .concat(SCREEN.map(function (r) { return buildCourse(r, 'screen'); }));

  g.COURSE_DATA = {
    TEES: TEES,
    ROUTINGS: ROUTINGS,
    BUILTIN: BUILTIN,
    estDistance: estDistance,
    // 새 골프장을 만들 때 쓰는 빈 껍데기
    blank: function (kind) {
      var id = U.uid('c');
      return {
        id: id,
        kind: kind || 'field',
        name: '',
        nameEn: '',
        region: '',
        area: kind === 'screen' ? '스크린' : '기타',
        alias: '',
        fav: false,
        builtin: false,
        verified: true,
        nines: [
          { id: id + '-n0', name: 'OUT', holes: ROUTINGS[0].map(function (p, i) { return { no: i + 1, par: p, dist: estDistance(id + '|0|' + i, p) }; }) },
          { id: id + '-n1', name: 'IN', holes: ROUTINGS[1].map(function (p, i) { return { no: i + 1, par: p, dist: estDistance(id + '|1|' + i, p) }; }) }
        ]
      };
    }
  };
})(window);
