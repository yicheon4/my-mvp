/** Persona World v7 world data: approved looks, six connected spaces, NPC spots.
 * Coordinates are image pixels of the 1536×1024 map art (world units). Feet anchors.
 * Day and night art share the same layout (checked side by side), so geometry is shared.
 * Image paths stay literal strings so scripts/export-github-static.py can rewrite them.
 */
export type Pt = [number, number];
export type Direction = 'down' | 'left' | 'right' | 'up';
export type TimeOfDay = 'day' | 'night';
export type MapId = 'bedroom' | 'kitchen' | 'living-room' | 'campus' | 'park' | 'bar';

export const WORLD_W = 1536, WORLD_H = 1024;

export type Look = {
  id: 'lavender' | 'pink-cargo' | 'white-denim';
  name: string;
  detail: string;
  art: string;
  // Matching mini sprite for this exact outfit. null = not made yet (the shared default mini is shown with a notice).
  mini: string | null;
};
export const looks: Look[] = [
  { id: 'lavender', name: '라벤더 니트', detail: '라벤더 카디건 · 크림 티 · 와이드 데님', art: '/art/v7/player-lavender.webp', mini: null },
  { id: 'pink-cargo', name: '핑크 & 카고', detail: '핑크 카디건 · 흰 티 · 올리브 카고', art: '/art/v7/player-pink-cargo.webp', mini: null },
  { id: 'white-denim', name: '화이트 & 데님', detail: '흰 티셔츠 · 블루 데님 · 흰 스니커즈', art: '/art/v7/player-white-denim.webp', mini: null },
];
export const DEFAULT_LOOK: Look['id'] = 'lavender';

// Existing fixed-appearance walk sheet (white tee, jeans). Not a match for any approved look.
export const defaultMini = {
  art: '/art/v7/mini-default-walk.webp',
  directions: ['down', 'left', 'right', 'up'] as Direction[],
  fps: 7,
  frames: [
    [135, 16, 106, 287], [423, 16, 106, 286], [736, 16, 106, 286], [1032, 15, 109, 287],
    [104, 323, 137, 288], [416, 323, 120, 289], [703, 323, 142, 289], [1038, 324, 113, 288],
    [117, 635, 147, 287], [414, 635, 121, 288], [712, 634, 154, 288], [1035, 634, 121, 288],
    [115, 945, 113, 287], [413, 945, 113, 287], [728, 945, 111, 287], [1034, 945, 113, 287],
  ] as [number, number, number, number][],
};

export const portraits = {
  chloe: '/art/v7/portraits-chloe.webp', sophie: '/art/v7/portraits-sophie.webp', ethan: '/art/v7/portraits-ethan.webp',
  luna: '/art/v7/portraits-luna.webp', julian: '/art/v7/portraits-julian.webp', oliver: '/art/v7/portraits-oliver.webp',
};

export const mapArt: Record<MapId, Record<TimeOfDay, string>> = {
  bedroom: { day: '/art/v7/maps-bedroom-day.webp', night: '/art/v7/maps-bedroom-night.webp' },
  kitchen: { day: '/art/v7/maps-kitchen-day.webp', night: '/art/v7/maps-kitchen-night.webp' },
  'living-room': { day: '/art/v7/maps-living-room-day.webp', night: '/art/v7/maps-living-room-night.webp' },
  campus: { day: '/art/v7/maps-campus-day.webp', night: '/art/v7/maps-campus-night.webp' },
  park: { day: '/art/v7/maps-park-day.webp', night: '/art/v7/maps-park-night.webp' },
  bar: { day: '/art/v7/maps-bar-day.webp', night: '/art/v7/maps-bar-night.webp' },
};

export type Portal = { id: string; rect: [number, number, number, number]; to: MapId; toPortal: string; label: string; spawn: { x: number; y: number; dir: Direction } };
export type Npc = { person: number; x: number; y: number; face: [number, number, number] };
export type Occluder = { poly: Pt[]; baseY: number };
export type WorldMapDef = {
  id: MapId; name: string;
  walk: Pt[][]; blocks: Pt[][]; occluders: Occluder[];
  portals: Portal[]; spawn: { x: number; y: number; dir: Direction };
  npcs: Npc[];
  // Mini height in world px at the top / bottom of the walkable area (perspective).
  scale: { y0: number; h0: number; y1: number; h1: number };
};
const ALWAYS = 9999;

export const worldMaps: Record<MapId, WorldMapDef> = {
  bedroom: {
    id: 'bedroom', name: '나의 방',
    walk: [[[160, 1015], [160, 968], [305, 968], [325, 655], [380, 648], [425, 545], [560, 605], [815, 488], [1000, 500], [1255, 628], [1300, 672], [1380, 668], [940, 1015]]],
    blocks: [
      [[980, 700], [1240, 690], [1245, 770], [1030, 855], [1015, 885], [895, 885], [890, 810], [980, 780]],
      [[825, 905], [925, 905], [925, 1024], [825, 1024]],
    ],
    occluders: [
      { poly: [[975, 650], [1010, 590], [1100, 570], [1200, 590], [1245, 650], [1245, 770], [1030, 860], [975, 850]], baseY: 770 },
      { poly: [[892, 765], [1022, 765], [1022, 882], [892, 882]], baseY: 860 },
      { poly: [[825, 900], [925, 900], [925, 1024], [825, 1024]], baseY: 1000 },
    ],
    portals: [{ id: 'door', rect: [150, 900, 160, 115], to: 'living-room', toPortal: 'bedroom-door', label: '거실', spawn: { x: 400, y: 960, dir: 'right' } }],
    spawn: { x: 640, y: 760, dir: 'down' },
    npcs: [],
    scale: { y0: 500, h0: 205, y1: 1015, h1: 225 },
  },
  'living-room': {
    id: 'living-room', name: '거실',
    walk: [[[15, 505], [110, 505], [125, 428], [270, 428], [410, 422], [600, 342], [1250, 342], [1300, 578], [1205, 640], [1205, 726], [1290, 768], [1100, 860], [1000, 855], [990, 1010], [520, 1010], [505, 800], [370, 705], [240, 692], [230, 655], [160, 655], [120, 565], [15, 565]]],
    blocks: [
      [[580, 390], [760, 310], [1010, 255], [1315, 430], [1300, 560], [1185, 585], [950, 472], [720, 612], [650, 565]],
      [[490, 500], [560, 468], [645, 500], [645, 600], [575, 628], [490, 592]],
      [[838, 520], [960, 478], [1102, 520], [1102, 612], [960, 682], [838, 622]],
      [[985, 700], [1060, 650], [1150, 700], [1142, 782], [1060, 792], [988, 762]],
      [[0, 300], [110, 300], [110, 500], [0, 500]],
    ],
    occluders: [
      { poly: [[690, 800], [975, 800], [985, 1024], [690, 1024]], baseY: ALWAYS },
      { poly: [[0, 700], [250, 688], [505, 785], [515, 1024], [0, 1024]], baseY: ALWAYS },
    ],
    portals: [
      { id: 'front-door', rect: [130, 405, 140, 50], to: 'campus', toPortal: 'home-path', label: '학교 가는 길', spawn: { x: 220, y: 490, dir: 'down' } },
      { id: 'bedroom-door', rect: [915, 905, 80, 110], to: 'bedroom', toPortal: 'door', label: '나의 방', spawn: { x: 860, y: 945, dir: 'left' } },
      { id: 'kitchen-way', rect: [240, 650, 170, 55], to: 'kitchen', toPortal: 'doorway', label: '주방', spawn: { x: 340, y: 610, dir: 'right' } },
    ],
    spawn: { x: 520, y: 720, dir: 'down' },
    npcs: [{ person: 1, x: 760, y: 720, face: [512, 330, 420] }],
    scale: { y0: 430, h0: 190, y1: 1010, h1: 215 },
  },
  kitchen: {
    id: 'kitchen', name: '공용 주방',
    walk: [[[40, 392], [175, 392], [270, 396], [400, 350], [530, 332], [845, 322], [852, 396], [960, 406], [1230, 516], [1370, 546], [1380, 506], [1536, 506], [1536, 1024], [890, 1024], [880, 1005], [385, 852], [225, 772], [225, 518], [80, 508], [40, 508]]],
    blocks: [
      [[470, 420], [760, 368], [1025, 450], [1025, 640], [820, 718], [700, 722], [470, 600]],
      [[1085, 640], [1180, 560], [1310, 505], [1536, 490], [1536, 1024], [1290, 1024], [1140, 952], [1085, 862]],
    ],
    occluders: [
      { poly: [[470, 372], [600, 250], [780, 250], [1022, 432], [1012, 622], [820, 708], [478, 592]], baseY: 560 },
      { poly: [[385, 830], [880, 980], [880, 1024], [385, 1024]], baseY: ALWAYS },
      { poly: [[0, 740], [380, 840], [380, 1024], [0, 1024]], baseY: ALWAYS },
      { poly: [[1330, 830], [1536, 820], [1536, 1024], [1330, 1024]], baseY: ALWAYS },
    ],
    portals: [{ id: 'doorway', rect: [40, 385, 140, 45], to: 'living-room', toPortal: 'kitchen-way', label: '거실', spawn: { x: 190, y: 470, dir: 'down' } }],
    spawn: { x: 260, y: 600, dir: 'down' },
    npcs: [{ person: 0, x: 1050, y: 560, face: [512, 300, 420] }],
    scale: { y0: 330, h0: 190, y1: 1020, h1: 215 },
  },
  campus: {
    id: 'campus', name: '학교',
    walk: [[[70, 192], [225, 192], [235, 268], [405, 275], [560, 330], [690, 335], [710, 252], [930, 252], [915, 372], [1005, 395], [1010, 470], [905, 560], [905, 705], [1065, 700], [1065, 860], [770, 880], [765, 1022], [250, 1022], [130, 960], [130, 790], [200, 785], [355, 700], [360, 612], [560, 557], [560, 452], [300, 447], [232, 302], [70, 302]]],
    blocks: [[[183, 268], [218, 268], [218, 302], [183, 302]]],
    occluders: [
      { poly: [[0, 850], [400, 860], [420, 1024], [0, 1024]], baseY: ALWAYS },
      { poly: [[760, 850], [1240, 850], [1240, 1024], [760, 1024]], baseY: ALWAYS },
      { poly: [[1028, 700], [1096, 700], [1096, 990], [1028, 990]], baseY: 980 },
    ],
    portals: [
      { id: 'home-path', rect: [300, 975, 440, 49], to: 'living-room', toPortal: 'front-door', label: '집', spawn: { x: 520, y: 930, dir: 'up' } },
      { id: 'park-path', rect: [70, 192, 150, 40], to: 'park', toPortal: 'campus-path', label: '공원', spawn: { x: 140, y: 260, dir: 'down' } },
    ],
    spawn: { x: 600, y: 700, dir: 'down' },
    npcs: [
      { person: 3, x: 840, y: 610, face: [560, 320, 420] },
      { person: 4, x: 640, y: 450, face: [512, 300, 420] },
    ],
    scale: { y0: 192, h0: 160, y1: 1022, h1: 215 },
  },
  park: {
    id: 'park', name: '공원 산책길',
    walk: [[[640, 1022], [610, 880], [530, 780], [455, 700], [460, 600], [525, 535], [600, 465], [610, 400], [600, 350], [560, 330], [520, 300], [640, 290], [700, 320], [860, 380], [885, 420], [825, 480], [800, 560], [850, 680], [960, 770], [1100, 860], [1200, 980], [1230, 1022]]],
    blocks: [],
    occluders: [
      { poly: [[240, 700], [600, 700], [600, 1024], [240, 1024]], baseY: ALWAYS },
      { poly: [[1200, 650], [1536, 650], [1536, 1024], [1200, 1024]], baseY: ALWAYS },
    ],
    portals: [
      { id: 'campus-path', rect: [650, 985, 570, 39], to: 'campus', toPortal: 'park-path', label: '학교', spawn: { x: 900, y: 930, dir: 'up' } },
      { id: 'bar-stairs', rect: [515, 285, 135, 40], to: 'bar', toPortal: 'entrance', label: '바', spawn: { x: 660, y: 385, dir: 'down' } },
    ],
    spawn: { x: 760, y: 760, dir: 'up' },
    npcs: [{ person: 2, x: 720, y: 600, face: [512, 300, 420] }],
    scale: { y0: 290, h0: 80, y1: 1022, h1: 250 },
  },
  bar: {
    id: 'bar', name: '바',
    walk: [[[415, 600], [470, 590], [930, 435], [1000, 352], [1135, 352], [1240, 405], [1235, 470], [1100, 540], [1060, 560], [1060, 650], [960, 665], [950, 900], [1130, 840], [1135, 1022], [415, 1022]]],
    blocks: [[[400, 800], [410, 690], [520, 690], [500, 872], [410, 872]]],
    occluders: [
      { poly: [[1135, 820], [1536, 820], [1536, 1024], [1135, 1024]], baseY: ALWAYS },
      { poly: [[0, 800], [210, 800], [210, 1024], [0, 1024]], baseY: ALWAYS },
      { poly: [[396, 650], [530, 650], [520, 875], [400, 875]], baseY: 860 },
    ],
    portals: [{ id: 'entrance', rect: [430, 985, 690, 39], to: 'park', toPortal: 'bar-stairs', label: '공원', spawn: { x: 760, y: 930, dir: 'up' } }],
    spawn: { x: 760, y: 800, dir: 'up' },
    npcs: [{ person: 5, x: 720, y: 660, face: [512, 300, 420] }],
    scale: { y0: 350, h0: 185, y1: 1022, h1: 215 },
  },
};
export const MAP_IDS = Object.keys(worldMaps) as MapId[];

