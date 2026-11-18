# Red Ivy 이미지 연결 안내 (EP01–04)

2026-11-19: EP01 배경 5장(`public/red-ivy/backgrounds/`, 모바일배경_인물축소_v2의 web/ WebP)과 6인 표정 세트(`public/red-ivy/characters/<인물>/`, 원본 1024×1536 PNG → WebP, 루나는 드레스길이수정 세트)를 연결했습니다. 특별 장면 2개(테라스 키스, 익명 게시물 사진)와 EP02–04 배경은 아직 비어 있어 제목 카드/단색으로 표시됩니다.

배치: 인물 캔버스 높이 = 화면 높이 × 68.08%, 하단 = 화면 높이 × 87%, 가운데 정렬(서 있음/앉음 동일). 대화창은 안전영역 포함 화면 하단 약 28%에서 시작해 내용만큼 커지고, 선택·입력창이 32%를 넘으면 인물을 최대 6% 위로 올립니다. 이미지는 로드가 끝난 뒤 0.3초 크로스페이드(동작 줄이기 설정 시 즉시)로 바뀌고, 실패하면 이전 이미지를 유지합니다.
이미지를 넣어도 대사·선택지·진행 로직은 바뀌지 않습니다. 슬롯 이름(ID)은 `Red_Ivy_EP01_이미지제작_요청자료/03_제작체크리스트.csv`와 같습니다.

## 넣는 곳과 연결 방법

1. 파일을 아래 폴더에 넣습니다. 파일 이름은 `슬롯ID.확장자`를 권장합니다(webp 또는 png).
   - 배경: `public/red-ivy/backgrounds/bg_vip_lounge_night.webp`
   - 인물: `public/red-ivy/characters/chloe/chloe_standing_host.webp`
   - 특별 장면: `public/red-ivy/cg/cg_terrace_kiss.webp`
2. `src/redivy/art-manifest.ts`에서 해당 슬롯의 `null`을 `public/red-ivy/` 아래 경로로 바꿉니다.
   - 배경·특별 장면: `file: null` → `file: 'backgrounds/bg_vip_lounge_night.webp'`
   - 인물: `chloe_standing_host: null` → `chloe_standing_host: 'characters/chloe/chloe_standing_host.webp'`
3. 화면을 새로고침합니다. 파일이 없거나 불러오지 못하면 자동으로 임시 표시로 돌아갑니다.

인물 표정 이미지가 아직 없을 때는 같은 인물·같은 자세의 기본 표정 → 그 인물의 아무 이미지 → 실루엣 순서로 대신 보여 줍니다.
기본 표정: 서 있음/앉음 기준 `chloe_standing_host`/`chloe_seated_probe`, `sophie_standing_watch`/`sophie_seated_explain`, `ethan_standing_detached`/`ethan_seated_skeptical`, `luna_standing_arrival`/`luna_seated_composed`, `julian_standing_host`/`julian_seated_amused`, `oliver_standing_public_smile`/`oliver_seated_polite`.

## 배경 5개

| 슬롯 ID | 쓰이는 곳 |
|---|---|
| bg_crimson_hall_evening | 장면1 환영 파티 (선택1 A/B 반응 포함) |
| bg_vip_lounge_night | 장면2 VIP 라운지 (선택2 A/B 반응 포함) |
| bg_lounge_corridor_night | 장면3 라운지 바깥 복도 (선택3 A/B 반응 포함) |
| bg_terrace_night | 장면3 관객 전용 테라스 부분 |
| bg_campus_morning | 장면4 다음 날 (선택4 A/B 반응 포함) |

## 특별 장면 2개

| 슬롯 ID | 쓰이는 곳 |
|---|---|
| cg_terrace_kiss | 장면3 테라스 연출(관객 전용), 화면 탭으로 넘김 |
| cg_ivy_talk_evidence | 장면4 Ivy Talk 익명 게시물 사진 |

## 인물 36개

대사에 연결된 28개:

| 인물 | 슬롯 ID → 쓰이는 곳 |
|---|---|
| 클로이 | chloe_standing_host → 장면1·선택1 반응 / chloe_standing_guarded → 장면1 / chloe_seated_probe → 장면2 / chloe_seated_offended → 선택2 A/B 반응 / chloe_standing_vulnerable → 장면3 |
| 소피 | sophie_standing_offer_water, sophie_standing_dry_smile → 장면1 / sophie_seated_explain, sophie_seated_defensive → 장면2 |
| 이든 | ethan_standing_dry_amusement → 장면1·선택1 A / ethan_seated_skeptical, ethan_seated_alert → 장면2 / ethan_standing_confront, ethan_standing_conflicted → 장면3 |
| 루나 | luna_standing_arrival, luna_seated_reveal → 장면2 / luna_seated_composed → 장면2·선택2 A / luna_seated_challenge → 장면2·선택2 B / luna_standing_observe → 장면3·선택3 A/B / luna_standing_softened → 장면3 |
| 줄리언 | julian_standing_joke → 장면1·선택1 B / julian_standing_jealous → 장면1 / julian_seated_amused, julian_seated_stop → 장면2 |
| 올리버 | oliver_standing_public_smile, oliver_standing_weary, oliver_standing_accept_water → 장면1 / oliver_seated_frozen → 장면2 |

EP01에서는 쓰지 않지만 EP02–04에서 쓰는 4개: sophie_standing_watch, sophie_seated_unsettled, ethan_standing_detached, julian_standing_host.
EP01–04 어디에도 아직 연결하지 않은 4개(나중 회차·반응 컷용, oliver_seated_polite는 기본 표정 대체용): chloe_seated_crack, julian_seated_alarm, oliver_seated_polite, oliver_seated_avoidant.

어떤 대사에 어떤 표정을 쓸지는 `src/redivy/script/ep01.overlay.json`의 `portraits`에서 바꿉니다. 바꾼 뒤 `npm run test:redivy`를 실행하면 `src/redivy/data/ep01.json`이 다시 만들어집니다.

## EP02–04 배경 (새 슬롯 9개, 아직 이미지 요청자료 없음)

| 슬롯 ID | 쓰이는 곳 |
|---|---|
| bg_club_office_morning | EP02 장면1 클럽 사무실 |
| bg_library_late_evening | EP02 장면2 도서관 |
| bg_darkroom_corridor | EP02 장면3 사진관 복도, EP02 장면4 관객 전용(클로이) |
| bg_darkroom | EP02 장면4, EP03 장면1·2 암실 |
| bg_rowing_locker_corridor | EP03 장면3 조정부 라커룸 앞 |
| bg_dorm_corridor_evening | EP03 장면4 기숙사 복도 (관객 전용 통화 포함) |
| bg_masquerade_hall_evening | EP04 장면1 가면무도회 |
| bg_faculty_corridor_night | EP04 장면2·3 교수 연구실 복도 |
| bg_masquerade_entrance_night | EP04 장면4 무도회 입구 (관객 전용 포함) |

EP02–04 인물은 위 36개 슬롯을 그대로 다시 씁니다. 대사별 지정은 `src/redivy/script/ep02~04.overlay.json`의 `portraits`에 있습니다.
EP02–04에는 특별 장면(CG) 슬롯을 만들지 않았습니다. EP03 라커룸 입맞춤은 사용자가 시선을 돌리는 연출이라 별도 화면 없이 지나갑니다.
