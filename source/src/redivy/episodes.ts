// Red Ivy season 1 catalog. Only episodes with generated data are playable; the free/premium split is kept in data
// (EP01–05 free, EP06–10 premium). Payment is not implemented: premium episodes open only with the development
// setting below (the local dev server, or VITE_RED_IVY_UNLOCK_ALL=1 for a review build). Nothing marks a purchase.
import ep01 from './data/ep01.json';
import ep02 from './data/ep02.json';
import ep03 from './data/ep03.json';
import ep04 from './data/ep04.json';
import type { Episode } from './engine';

export type CatalogEntry = { number: number; episode_id: string; title: string; access: 'free' | 'premium'; data: Episode | null; intro?: string };
const titles = ['A Perfect Party', 'The Price of Staying', 'What We Owe the Dead', 'The Wrong Red Dress', 'No More Favors', 'The Man in the Coat', 'An Invitation to Tell the Truth', 'Dinner with Marcus', 'What Honesty Costs', 'After the Ivy'];
const data: Record<number, Episode> = { 1: ep01, 2: ep02, 3: ep03, 4: ep04 } as unknown as Record<number, Episode>;
const intros: Record<number, string> = {
  1: '세인트 주드 대학교, 크림슨 클럽의 새 학기 첫 파티. 신입 멤버인 당신은 환영 데스크를 지키고 있다. 이곳의 모두는 서로를 알지만, 누구도 서로를 믿지 않는 것 같다.',
  2: '파티 다음 날 아침, 테라스 사진 한 장이 클럽을 뒤흔든다. 어젯밤 문 앞을 지키던 당신은 원하든 원치 않든 목격자가 되었다.',
  3: '잠긴 암실에서 구조를 기다리는 밤. 1년 동안 묻혀 있던 엘레나의 마지막 날이 조금씩 모습을 드러낸다.',
  4: '2주 뒤, 크림슨 클럽의 가면무도회. 빌려 입은 붉은 드레스, 늦은 밤의 약속, 그리고 누군가 미리 짜 둔 계획.',
};
export const catalog: CatalogEntry[] = titles.map((title, i) => ({ number: i + 1, episode_id: `red_ivy_s1_ep${String(i + 1).padStart(2, '0')}`, title, access: i < 5 ? 'free' : 'premium', data: data[i + 1] ?? null, intro: intros[i + 1] }));
export const DEV_UNLOCK_ALL = import.meta.env.DEV || import.meta.env.VITE_RED_IVY_UNLOCK_ALL === '1';
export const isOpen = (e: CatalogEntry) => !!e.data && (e.access === 'free' || DEV_UNLOCK_ALL);
