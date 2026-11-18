// Red Ivy image slots. Story data refers to these IDs only; nothing here changes dialogue or game logic.
// To connect an image: put the file under public/red-ivy/<folder>/ and replace `null` with its file name.
// Example: bg_vip_lounge_night: { ..., file: 'backgrounds/bg_vip_lounge_night.webp' }
// A slot left as null (or a file that fails to load) shows the placeholder: a solid colour background, or a
// silhouette with the character's name. IDs follow Red_Ivy_EP01_이미지제작_요청자료/03_제작체크리스트.csv.
// See docs/red-ivy-images.md for the full list and where each slot appears.

export const ART_ROOT = '/red-ivy/';

export type CastId = 'chloe' | 'sophie' | 'ethan' | 'luna' | 'julian' | 'oliver' | 'marcus';
export const cast: Record<CastId, { name: string; ko: string; color: string }> = {
  chloe: { name: 'CHLOE', ko: '클로이', color: '#7a2433' },
  sophie: { name: 'SOPHIE', ko: '소피', color: '#3d4f74' },
  ethan: { name: 'ETHAN', ko: '이든', color: '#4a4a4f' },
  luna: { name: 'LUNA', ko: '루나', color: '#2f5a46' },
  julian: { name: 'JULIAN', ko: '줄리언', color: '#6b5530' },
  oliver: { name: 'OLIVER', ko: '올리버', color: '#2b3f66' },
  marcus: { name: 'MARCUS', ko: '마커스', color: '#3b2a2a' },
};

// Off-screen voices (no portrait planned): name label only.
export const voices: Record<string, string> = {
  narration: '', ivy_talk: 'IVY TALK', unknown: 'UNKNOWN', end_card: '',
  security: 'SECURITY', dean: 'DEAN', operator: 'OPERATOR', detective: 'DETECTIVE', father: 'FATHER',
};

export type Slot = { label: string; color?: string; file: string | null };

export const backgrounds: Record<string, Slot> = {
  bg_crimson_hall_evening: { label: '크림슨 홀 · 저녁', color: '#3b1519', file: 'backgrounds/bg_crimson_hall_evening.webp' },
  bg_vip_lounge_night: { label: 'VIP 라운지 · 밤', color: '#16261f', file: 'backgrounds/bg_vip_lounge_night.webp' },
  bg_lounge_corridor_night: { label: '라운지 바깥 복도 · 밤', color: '#1d1f2b', file: 'backgrounds/bg_lounge_corridor_night.webp' },
  bg_terrace_night: { label: '테라스 · 밤', color: '#121a2a', file: 'backgrounds/bg_terrace_night.webp' },
  bg_campus_morning: { label: '다음 날 · 메시지', color: '#3a4146', file: 'backgrounds/bg_campus_morning.webp' },
  // EP02–04 (no image request yet; IDs follow the same naming)
  bg_club_office_morning: { label: '클럽 사무실 · 아침', color: '#3a2a24', file: null },
  bg_library_late_evening: { label: '도서관 · 늦은 저녁', color: '#2a2a1e', file: null },
  bg_darkroom_corridor: { label: '사진관 복도', color: '#1f1f24', file: null },
  bg_darkroom: { label: '암실', color: '#3a1012', file: null },
  bg_rowing_locker_corridor: { label: '조정부 라커룸 앞', color: '#22303a', file: null },
  bg_dorm_corridor_evening: { label: '기숙사 복도 · 저녁', color: '#2e2630', file: null },
  bg_masquerade_hall_evening: { label: '가면무도회 · 저녁', color: '#3b1424', file: null },
  bg_faculty_corridor_night: { label: '교수 연구실 복도 · 밤', color: '#1c2228', file: null },
  bg_masquerade_entrance_night: { label: '무도회 입구 · 밤', color: '#2a1620', file: null },
};

// Character slot ID = <character>_<pose>_<expression>. pose: standing | seated.
// EP01 delivered sets (1024×1536 transparent PNG → WebP, same canvas for every file, never cropped).
// Luna uses the 드레스길이수정 set. Slots marked "EP01 new" were added so each EP01 line gets its own expression.
const f = (character: string, file: string) => `characters/${character}/${file}.webp`;
export const portraits: Record<string, string | null> = {
  chloe_standing_host: f('chloe', '01_toast_front'), chloe_standing_question: f('chloe', '02_question_front'), // EP01 new
  chloe_standing_guarded: f('chloe', '03_challenge'), chloe_seated_probe: f('chloe', '03_challenge'),
  chloe_seated_offended: f('chloe', '04_guarded_front'), chloe_seated_crack: f('chloe', '06_defensive_down'),
  chloe_standing_vulnerable: f('chloe', '05_intimate'), chloe_standing_defensive: f('chloe', '06_defensive_down'), // EP01 new
  chloe_standing_base: f('chloe', '00_base'),
  sophie_standing_watch: f('sophie', '00_neutral'), sophie_standing_offer_water: f('sophie', '01_caring_water'),
  sophie_standing_attentive: f('sophie', '02_attentive'), // EP01 new
  sophie_standing_dry_smile: f('sophie', '03_dry_humor'), sophie_seated_explain: f('sophie', '04_explain'),
  sophie_seated_defensive: f('sophie', '05_tense'), sophie_seated_unsettled: f('sophie', '05_tense'),
  ethan_standing_detached: f('ethan', '00_neutral'), ethan_standing_dry_amusement: f('ethan', '01_dry_joke'),
  ethan_seated_skeptical: f('ethan', '02_skeptical'), ethan_seated_alert: f('ethan', '04_challenge'),
  ethan_standing_confront: f('ethan', '04_challenge'), ethan_standing_intimate: f('ethan', '05_intimate'), // EP01 new
  ethan_standing_conflicted: f('ethan', '06_after_kiss'),
  luna_standing_arrival: f('luna', '01_arrival'), luna_seated_composed: f('luna', '00_neutral'),
  luna_seated_challenge: f('luna', '02_pushback'), luna_seated_ask: f('luna', '03_ask_player'), // EP01 new
  luna_seated_trust: f('luna', '05_trust'), // EP01 new
  luna_seated_reveal: f('luna', '04_elena'), luna_standing_observe: f('luna', '04_elena'),
  luna_standing_ask: f('luna', '03_ask_player'), // EP01 new
  luna_standing_softened: f('luna', '05_trust'),
  julian_standing_host: f('julian', '00_neutral'), julian_standing_joke: f('julian', '01_joking'),
  julian_standing_wry: f('julian', '02_wry_observer'), julian_standing_embarrassed: f('julian', '03_embarrassed'), // EP01 new
  julian_standing_jealous: f('julian', '02_wry_observer'),
  julian_seated_amused: f('julian', '04_defend_luna'), julian_seated_alarm: f('julian', '05_stop_game'), julian_seated_stop: f('julian', '05_stop_game'),
  oliver_standing_public_smile: f('oliver', '01_toast'), oliver_standing_weary: f('oliver', '02_wry'),
  oliver_standing_fine: f('oliver', '03_im_fine'), // EP01 new
  oliver_standing_accept_water: f('oliver', '04_welcome'),
  oliver_seated_polite: f('oliver', '00_neutral'), oliver_seated_frozen: f('oliver', '05_elena'), oliver_seated_avoidant: f('oliver', '05_elena'),
};

// Fallback order when a slot has no file: same character + same pose neutral → any file of that character → silhouette.
export const neutralByPose: Record<string, string> = {
  chloe_standing: 'chloe_standing_host', chloe_seated: 'chloe_seated_probe',
  sophie_standing: 'sophie_standing_watch', sophie_seated: 'sophie_seated_explain',
  ethan_standing: 'ethan_standing_detached', ethan_seated: 'ethan_seated_skeptical',
  luna_standing: 'luna_standing_arrival', luna_seated: 'luna_seated_composed',
  julian_standing: 'julian_standing_host', julian_seated: 'julian_seated_amused',
  oliver_standing: 'oliver_standing_public_smile', oliver_seated: 'oliver_seated_polite',
};

export const cgs: Record<string, Slot> = {
  cg_terrace_kiss: { label: '특별 장면 · 테라스', file: null },
  cg_ivy_talk_evidence: { label: '익명 게시물 사진', file: null },
};

export function splitPortrait(id: string) {
  const [character, pose, ...rest] = id.split('_');
  return { character: character as CastId, pose, expression: rest.join('_') };
}

/** Image URL to try for a portrait slot, following the fallback order; null → draw the silhouette. */
export function portraitFile(id: string | undefined): string | null {
  if (!id) return null;
  const direct = portraits[id];
  if (direct) return ART_ROOT + direct;
  const { character, pose } = splitPortrait(id);
  const neutral = portraits[neutralByPose[`${character}_${pose}`] ?? ''];
  if (neutral) return ART_ROOT + neutral;
  const any = Object.entries(portraits).find(([k, v]) => v && k.startsWith(character + '_'));
  return any ? ART_ROOT + any[1] : null;
}
export const backgroundFile = (id: string | null | undefined) => (id && backgrounds[id]?.file ? ART_ROOT + backgrounds[id].file : null);
export const cgFile = (id: string | null | undefined) => (id && cgs[id]?.file ? ART_ROOT + cgs[id].file : null);
