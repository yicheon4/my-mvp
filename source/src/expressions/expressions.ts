/** Character expressions for the chat screen (first target: Chloe).
 * Each expression is ONE complete upper-body image on the same canvas as the base portrait; never composite
 * faces/eyes/mouths. A missing or mismatched image falls back to the base portrait (not counted as done).
 * Motions are tiny whole-image effects (not joint animation), played once when a reply asks for one.
 */
export const EXPRESSIONS = ['neutral', 'smile', 'laugh', 'thinking', 'concerned', 'disappointed'] as const;
export type Expression = typeof EXPRESSIONS[number];
export const MOTIONS = ['nod', 'tilt'] as const;
export type Motion = typeof MOTIONS[number];

export const normalizeExpression = (x: unknown): Expression => (EXPRESSIONS as readonly unknown[]).includes(x) ? x as Expression : 'neutral';
export const normalizeMotion = (x: unknown): Motion | null => (MOTIONS as readonly unknown[]).includes(x) ? x as Motion : null;

/** Real expression art per character (each a complete 1024×1536 transparent PNG on the base portrait canvas).
 * Chloe: PersonaWorld_Chloe_Expressions_v1, derived from the v7 portrait. A state left out shows the base portrait. */
export const expressionArt: Record<string, Partial<Record<Expression, string>>> = {
  chloe: {
    neutral: '/art/expressions/chloe/neutral.png',
    smile: '/art/expressions/chloe/smile.png',
    laugh: '/art/expressions/chloe/laugh.png',
    thinking: '/art/expressions/chloe/thinking.png',
    concerned: '/art/expressions/chloe/concerned.png',
    disappointed: '/art/expressions/chloe/disappointed.png',
  },
};

export type Choice = { text: string; next: string };
export type DemoNode = { text: string; ko: string; expression: Expression; motion: Motion | null; tip: { id: string; en: string; ko: string; context: string }; choices: Choice[] };

/** DEMO ONLY (pre-API): a small branching test script for Chloe so each reply carries an explicit expression.
 * These lines are not Chloe's fixed dialogue, catchphrases or prompt data; they are never sent to a model. */
const topics: Record<string, Choice> = {
  daily: { text: 'I just got back from class. It was a long day.', next: 'daily' },
  funny: { text: 'Funny thing: I waved back at someone who was waving at the person behind me.', next: 'funny' },
  worry: { text: 'Honestly, I’m a bit stressed about my group project.', next: 'worry' },
  opinion: { text: 'Should I join the festival booth team, or is that too much right now?', next: 'opinion' },
  chore: { text: 'Sorry, I forgot to take out the recycling again.', next: 'chore' },
};
const others = (...skip: string[]) => Object.entries(topics).filter(([k]) => !skip.includes(k)).map(([, c]) => c);

export const chloeDemo: Record<string, DemoNode> = {
  daily: {
    text: 'Same here, my studio ran late. I’m just putting groceries away. Was it the classes or the walk back that wore you out?',
    ko: '나도 스튜디오가 늦게 끝났어. 지금 장 본 거 정리하는 중이야. 수업 때문이었어, 아니면 돌아오는 길 때문에 지쳤어?',
    expression: 'neutral', motion: 'nod',
    tip: { id: 'c-long-day', en: 'It was a long day.', ko: '긴 하루였어.', context: '하루가 길고 피곤했다고 가볍게 말할 때' },
    choices: [{ text: 'Mostly the classes. Three in a row.', next: 'daily2' }, ...others('daily')],
  },
  daily2: {
    text: 'Three in a row is a lot. I’d keep tonight simple, then. I’ll be in the living room later if you want company.',
    ko: '세 개 연속이면 많지. 그럼 오늘 밤은 단순하게 보내. 나중에 거실에 있을 테니 같이 있고 싶으면 와.',
    expression: 'neutral', motion: null,
    tip: { id: 'c-in-a-row', en: 'I had three classes in a row.', ko: '수업이 세 개 연달아 있었어.', context: '일정이 연달아 있었다고 설명할 때' },
    choices: others(),
  },
  funny: {
    text: 'Oh no, the classic. Did you pretend to fix your hair, or just commit to the wave?',
    ko: '아이고, 그거 흔하지. 머리 만지는 척했어, 아니면 그냥 끝까지 손 흔들었어?',
    expression: 'laugh', motion: null,
    tip: { id: 'c-funny-thing', en: 'Funny thing happened today.', ko: '오늘 웃긴 일이 있었어.', context: '웃긴 일을 꺼내며 이야기를 시작할 때' },
    choices: [{ text: 'I just kept waving. Full commitment.', next: 'funny2' }, ...others('funny')],
  },
  funny2: {
    text: 'Respect. Honestly, that’s the braver choice.',
    ko: '인정. 솔직히 그게 더 용감한 선택이야.',
    expression: 'smile', motion: null,
    tip: { id: 'c-commit', en: 'I just went with it.', ko: '그냥 밀고 나갔어.', context: '어색한 상황을 그대로 넘겼다고 말할 때' },
    choices: others('funny'),
  },
  worry: {
    text: 'That sounds heavy. Is it the workload, or the group itself? I can just listen, if that helps more than ideas.',
    ko: '무겁게 들린다. 일의 양 때문이야, 아니면 조원들 때문이야? 아이디어보다 듣는 게 낫다면 그냥 들을게.',
    expression: 'concerned', motion: null,
    tip: { id: 'c-stressed-about', en: 'I’m a bit stressed about it.', ko: '그것 때문에 조금 스트레스받아.', context: '걱정되는 일을 부담 없이 꺼낼 때' },
    choices: [{ text: 'It’s mostly one person who never replies.', next: 'worry2' }, ...others('worry')],
  },
  worry2: {
    text: 'That’s frustrating, especially with a deadline. Maybe message them with one clear task and a date. Want help wording it?',
    ko: '마감이 있으면 더 답답하지. 할 일 하나와 날짜를 분명하게 적어서 보내 보는 건 어때? 문장 같이 다듬어 줄까?',
    expression: 'concerned', motion: 'nod',
    tip: { id: 'c-never-replies', en: 'They never reply to messages.', ko: '그 사람은 메시지에 답을 안 해.', context: '연락이 잘 안 되는 상황을 설명할 때' },
    choices: others('worry'),
  },
  opinion: {
    text: 'Hmm. It depends on your next few weeks. If you have one free evening, it’s doable. If not, saying no now is easier than dropping out later.',
    ko: '음, 앞으로 몇 주에 달렸어. 저녁 하루가 비면 할 만해. 아니라면 나중에 빠지는 것보다 지금 거절하는 게 쉬워.',
    expression: 'thinking', motion: 'tilt',
    tip: { id: 'c-too-much', en: 'Is that too much right now?', ko: '지금은 그게 너무 무리일까?', context: '새 일을 맡을지 의견을 물을 때' },
    choices: others('opinion'),
  },
  chore: {
    text: 'Okay. That’s the second time this week, and I ended up doing it. I’m not angry, but if Tuesdays don’t work for you, let’s switch days.',
    ko: '알겠어. 이번 주에 두 번째라서 결국 내가 했어. 화난 건 아니지만, 화요일이 어렵다면 요일을 바꾸자.',
    expression: 'disappointed', motion: null,
    tip: { id: 'c-forgot-to', en: 'Sorry, I forgot to do it.', ko: '미안, 깜빡하고 못 했어.', context: '맡은 일을 잊었을 때 사과할 때' },
    choices: [{ text: 'You’re right. Can I take Thursdays instead?', next: 'chore2' }, ...others('chore')],
  },
  chore2: {
    text: 'Thursdays work. Thanks for saying it straight. That’s easier than both of us guessing.',
    ko: '목요일 좋아. 솔직하게 말해 줘서 고마워. 둘 다 짐작만 하는 것보다 훨씬 편해.',
    expression: 'smile', motion: 'nod',
    tip: { id: 'c-instead', en: 'Can I take Thursdays instead?', ko: '대신 목요일을 맡아도 될까?', context: '역할이나 일정을 바꾸자고 제안할 때' },
    choices: others('chore'),
  },
};
export const chloeHubChoices: Choice[] = Object.values(topics);
export const chloeOpening = { expression: 'smile' as Expression, motion: null as Motion | null };
