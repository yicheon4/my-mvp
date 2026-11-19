import { mapArt } from './world/world-data';
import type { MapId } from './world/world-data';
export type StoryScene={title:string;place:string;detail:string;art:string;mapId:MapId;opening:string;translation:string;locked:boolean};
// id matches characters/character-prompts.json; the array order is the saved session index and must not change.
// Public Red Ivy introductions: spoiler-light, matching the live server personas. No fixed catchphrases.
export type Person={id:'chloe'|'sophie'|'ethan'|'luna'|'julian'|'oliver';name:string;en:string;art:string;relation:string;role:string;trait:string;description:string;tags:string[];locked:boolean};
export const people:Person[]=[
  {
    "id": "chloe",
    "name": "클로이",
    "en": "CHLOE",
    "art": "/red-ivy/characters/chloe/00_base.webp",
    "relation": "크림슨 클럽의 호스트",
    "role": "St. Jude University · 성인 대학생",
    "trait": "우아한 자신감, 쉽게 보이지 않는 속마음",
    "description": "사람들의 시선과 분위기를 누구보다 빠르게 읽는 클로이. 매끄러운 농담과 당당한 태도로 자리를 이끌지만, 남들이 자신을 어떻게 보는지에는 예민하다. 진심 어린 말에는 잠시 경계를 내려놓기도 한다.",
    "tags": [
      "정제된 말투",
      "날카로운 장난",
      "감춰 둔 불안"
    ],
    "locked": false
  },
  {
    "id": "sophie",
    "name": "소피",
    "en": "SOPHIE",
    "art": "/red-ivy/characters/sophie/02_attentive.webp",
    "relation": "작은 변화를 알아채는 클럽 멤버",
    "role": "St. Jude University · 성인 대학생",
    "trait": "조용한 관찰과 눈에 띄지 않는 배려",
    "description": "빈 잔이나 흐트러진 소매처럼 남들이 지나치는 것을 먼저 알아챈다. 큰 위로보다 필요한 도움을 건네고, 차분한 말 사이에 건조한 농담을 섞는다. 조용하다고 해서 자기 생각까지 없는 것은 아니다.",
    "tags": [
      "세심한 관찰",
      "실질적인 배려",
      "담담한 유머"
    ],
    "locked": false
  },
  {
    "id": "ethan",
    "name": "이든",
    "en": "ETHAN",
    "art": "/red-ivy/characters/ethan/00_neutral.webp",
    "relation": "거리를 두고 지켜보는 클럽 멤버",
    "role": "St. Jude University · 성인 대학생",
    "trait": "짧은 농담 뒤에 남는 진지함",
    "description": "분위기에 쉽게 휩쓸리지 않고, 그럴듯한 말에 숨은 모순을 짚는다. 무심하고 냉소적으로 보이지만 중요한 순간에는 농담을 멈추고 직설적으로 말한다. 가까워지는 데는 조금 시간이 필요하다.",
    "tags": [
      "건조한 유머",
      "솔직한 직설",
      "느리게 여는 마음"
    ],
    "locked": false
  },
  {
    "id": "luna",
    "name": "루나",
    "en": "LUNA",
    "art": "/red-ivy/characters/luna/00_neutral.webp",
    "relation": "새롭게 합류한 편입생",
    "role": "St. Jude University · 성인 대학생",
    "trait": "쉽게 믿지 않지만 끝까지 듣는 사람",
    "description": "낯선 자리에서도 자신의 속도를 잃지 않는다. 사람들이 당연하게 넘기는 일에 이유를 묻고, 직접 본 사실과 추측을 구분한다. 진지하게 들어 주는 사람에게는 질문만큼 자신의 생각도 나눈다.",
    "tags": [
      "신중한 질문",
      "흔들리지 않는 태도",
      "차분한 호기심"
    ],
    "locked": false
  },
  {
    "id": "julian",
    "name": "줄리언",
    "en": "JULIAN",
    "art": "/red-ivy/characters/julian/00_neutral.webp",
    "relation": "분위기를 읽는 클럽 멤버",
    "role": "St. Jude University · 성인 대학생",
    "trait": "가벼운 농담, 가볍지 않은 배려",
    "description": "어색한 순간에 적절한 농담을 건네고 새로운 사람도 대화에 끼워 준다. 하지만 누군가 몰리는 상황에서는 웃음을 거두고 선을 긋는다. 사교적인 모습 안에 자기만의 기준이 있다.",
    "tags": [
      "재치 있는 말투",
      "갈등 중재",
      "필요할 때 단호함"
    ],
    "locked": false
  },
  {
    "id": "oliver",
    "name": "올리버",
    "en": "OLIVER",
    "art": "/red-ivy/characters/oliver/00_neutral.webp",
    "relation": "친절하게 신입을 맞는 클럽 멤버",
    "role": "St. Jude University · 성인 대학생",
    "trait": "다정한 미소 뒤의 작은 망설임",
    "description": "처음 만난 사람도 편하게 해 주려 노력한다. 알기 쉬운 말과 소박한 농담을 좋아하지만, 모두가 기대하는 모습에 맞추느라 지칠 때도 있다. 자기 이야기를 꺼낼 때는 잠시 말을 고르곤 한다.",
    "tags": [
      "편안한 환대",
      "솔직한 망설임",
      "감춰 둔 긴장"
    ],
    "locked": false
  }
];
const art={cafe:'bar',campus:'campus',park:'park',kitchen:'kitchen',seaside:'park',street:'campus',terrace:'living-room',room:'bedroom',sun:'living-room'} satisfies Record<string,MapId>;
type Row=[string,string,string,keyof typeof art,string,string];
function make(rows:Row[]):StoryScene[]{return rows.map((r,i)=>({title:r[0],place:r[1],detail:r[2],art:mapArt[art[r[3]]].day,mapId:art[r[3]],opening:r[4],translation:r[5],locked:i>=7}));}
export const stories:StoryScene[][]=[make([
 ['함께 요리하는 저녁','쉐어하우스 공용 주방','파스타를 만들며 오늘 유독 지쳤던 이유를 꺼내 봐.','kitchen','You’ve been quiet today. Want to tell me about it while we cook?','오늘 조용하네. 같이 요리하면서 무슨 일 있었는지 말해 줄래?'],
 ['불 끄기 전, 작은 고민','쉐어하우스, 내 방 문 앞','쉽게 잠들지 못하는 밤, 머릿속에서 맴도는 생각을 나눠.','room','Still awake? Is something keeping you up?','아직 안 자? 무슨 생각 때문에 잠이 안 와?'],
 ['과제에 치인 오후','도서관 스터디 라운지','과제와 시험이 겹쳐 버거운 마음을 솔직하게 전해 봐.','campus','You look overwhelmed. What’s the hardest part right now?','많이 벅차 보여. 지금 가장 힘든 건 뭐야?'],
 ['서로의 생활 리듬','쉐어하우스 거실 소파','소음이나 청소처럼 함께 살며 생긴 작은 불편을 부드럽게 말해.','room','Can we talk about how to make our room work for both of us?','우리 둘 다 편하게 지내려면 어떻게 하면 좋을지 얘기해 볼까?'],
 ['수업 끝, 커피 한 잔','캠퍼스 앞 카페','새 수업에서 어색했던 순간과 친구를 사귀고 싶은 마음을 나눠.','cafe','How did that new class go? Did you get to talk to anyone?','새 수업은 어땠어? 누구랑 이야기해 봤어?'],
 ['집이 그리운 날','동네 산책길','낯선 환경에서 문득 밀려온 외로움과 향수병을 털어놔.','park','What do you miss most about home today?','오늘은 집에서 뭐가 가장 그리워?'],
 ['편의점 야식 타임','집 앞 편의점','간식을 고르며 이번 주의 작은 성취를 함께 축하해.','street','Tell me one little thing you’re proud of this week.','이번 주에 스스로 뿌듯했던 일 하나만 들려줘.'],
 ['처음 부딪힌 마음','늦은 밤 공용 주방','작은 말다툼 뒤, 내 의도를 설명하고 화해의 첫마디를 건네.','kitchen','I think we misunderstood each other. Can we start over?','우리 서로 오해한 것 같아. 다시 이야기해 볼까?'],
 ['비 오는 날의 속마음','창가 소파','남들과 비교하며 작아졌던 마음을 천천히 꺼내 봐.','room','You don’t have to compare yourself to everyone else. What happened?','모두와 너를 비교할 필요는 없어. 무슨 일이 있었어?'],
 ['학기가 끝나기 전에','쉐어하우스 옥상','한 학기를 돌아보며 고마웠던 순간과 다음 학기의 바람을 나눠.','terrace','What’s one thing you want us to remember about this semester?','이번 학기에서 우리가 기억했으면 하는 순간은 뭐야?'],
]),make([
 ['오랜만에 만난 우리','단골 카페','밀린 근황을 나누다가 요즘 진짜 어떤지 솔직하게 이야기해.','cafe','Okay, I’ve heard the updates. How are you really doing?','근황은 들었고, 그래서 너 진짜 어떻게 지내?'],
 ['그때 우리 기억나?','공원 벤치','고등학교 시절의 추억을 떠올리며 달라진 나를 이야기해.','park','Remember how we used to imagine our lives by now?','우리 이맘때쯤 어떻게 살고 있을지 상상하던 거 기억나?'],
 ['답장 하나가 신경 쓰일 때','늦은 저녁 편의점','친구의 짧은 답장을 오해했을까 봐 걱정되는 마음을 나눠.','street','Show me what happened. What made you feel hurt?','무슨 일이었는지 말해 봐. 어떤 부분이 서운했어?'],
 ['잘하는 게 뭔지 모르겠어','도서관 휴게 공간','진로가 막막할 때 오래된 친구에게 내가 놓친 장점을 물어봐.','campus','I’ve seen you get excited about so many things. What still matters to you?','네가 신나 하던 순간들을 많이 봤잖아. 지금도 마음 가는 건 뭐야?'],
 ['아무것도 안 해도 되는 날','친구 집 거실','소파에 누워 요즘 쉬어도 쉬는 것 같지 않은 이유를 나눠.','sun','We don’t have to do anything today. What would feel restful to you?','오늘은 아무것도 안 해도 돼. 어떻게 쉬면 편할 것 같아?'],
 ['비교하고 싶지 않은데','동네 산책길','친구들의 좋은 소식이 반가우면서도 조급한 마음을 털어놔.','park','You can be happy for them and still feel unsure about yourself.','친구 일이 기쁘면서 동시에 내 상황이 불안할 수도 있지.'],
 ['말하지 못했던 고마움','우리만의 저녁 식탁','늘 곁에 있어 준 친구에게 구체적인 고마움을 전해.','kitchen','What made you think of that day all of a sudden?','갑자기 그날이 떠오른 이유가 뭐야?'],
 ['오래된 서운함을 꺼내다','조용한 밤 카페','오랫동안 말하지 못한 서운함을 관계를 지키며 표현해 봐.','cafe','I’d rather hear the honest version, even if it’s hard.','어렵더라도 네 솔직한 마음을 듣고 싶어.'],
 ['다른 길을 걷는 우리','해 질 무렵 바닷가','사는 곳과 삶의 속도가 달라도 우정을 이어갈 방법을 나눠.','seaside','Things are changing, but I don’t want us to drift apart.','많은 게 바뀌어도 우리 사이까지 멀어지진 않았으면 해.'],
 ['누구에게도 못 한 이야기','별이 보이는 테라스','정리가 안 된 마음도 괜찮다는 믿음으로 깊은 고민을 전해.','terrace','You don’t have to explain it perfectly. I know you.','완벽하게 설명하지 않아도 돼. 나는 너를 알잖아.'],
]),make([
 ['퇴근 후, 너의 하루','둘이 자주 가는 카페','서로의 하루를 들으며 해결책보다 위로가 필요하다고 말해 봐.','cafe','Do you want advice, or would you rather I just listen?','조언이 필요해, 아니면 그냥 들어주는 게 좋을까?'],
 ['함께 만드는 주말 저녁','집 주방','함께 요리하며 오늘 가장 좋았던 작은 순간을 나눠.','kitchen','This is my favorite part of the week. What was yours?','난 한 주 중 지금이 제일 좋아. 너는 어떤 순간이 좋았어?'],
 ['손잡고 걷는 저녁','강변 산책길','함께 있어 편안한 이유와 평소 말 못 한 애정을 표현해.','park','What’s something small I do that makes you feel loved?','내가 하는 작은 행동 중에 사랑받는다고 느끼게 하는 게 있어?'],
 ['조금 서운했던 오늘','조용한 집 거실','약속이나 연락에서 느낀 서운함을 탓하지 않고 전해 봐.','room','I noticed something felt off. Did I miss something important to you?','뭔가 마음에 걸리는 것 같았어. 내가 너에게 중요한 걸 놓쳤을까?'],
 ['데이트를 정하는 오후','햇살 드는 창가','서로 다른 취향과 예산을 편하게 조율하며 다음 약속을 정해.','sun','What kind of day would make you happy this weekend?','이번 주말은 어떤 하루를 보내면 좋을 것 같아?'],
 ['혼자만의 시간도 필요해','캠퍼스 라운지','공부와 연애 사이에서 필요한 개인 시간을 다정하게 설명해.','campus','How can we make space for each other and still have time for ourselves?','서로를 챙기면서 각자의 시간도 가지려면 어떻게 하면 좋을까?'],
 ['별것 아닌 순간의 행복','밤 산책 중 편의점','간식을 나눠 먹으며 우리가 닮아 간 작은 습관을 이야기해.','street','I think I’ve picked up one of your habits. Want to guess which one?','나 네 습관 하나 닮은 것 같아. 어떤 건지 맞혀 볼래?'],
 ['우리의 첫 기념일','노을 지는 바닷가','함께한 1년의 소중한 순간과 앞으로의 바람을 이야기해.','seaside','What’s a moment from our first year that you’d relive?','우리 첫 1년 중 다시 돌아가고 싶은 순간은 언제야?'],
 ['다툰 뒤, 다시 마주 앉아','불빛 낮춘 거실','사과하고 싶은 부분과 이해받고 싶은 마음을 구분해서 말해.','room','I’m sorry for my part in this. Can you tell me how it felt for you?','내가 잘못한 부분은 미안해. 네 마음은 어땠는지 들려줄래?'],
 ['앞으로의 우리를 상상해','밤하늘 아래 테라스','졸업 후 달라질 일상과 관계에 대한 기대·불안을 나눠.','terrace','When you picture the next year, what excites you and what worries you?','내년을 상상하면 어떤 게 기대되고 어떤 게 걱정돼?'],
])];
// Locked character collections are visible after their profile; each has seven standard and three special chapters.
const extra:Row[][]=[
 [['처음 함께 걷는 도시','동네 골목','낯선 도시에서 설렘과 긴장을 나눠.','street'],['여행 중 쉬어 가기','작은 카페','계획을 멈추고 쉬고 싶은 마음을 말해.','cafe'],['혼자 여행을 온 이유','해변 벤치','이번 여행에 기대한 변화를 이야기해.','seaside'],['사진에 남지 않는 순간','강변 공원','오늘 가장 오래 기억하고 싶은 감정을 나눠.','park'],['서로 다른 여행 방식','숙소 거실','일정과 취향 차이를 편하게 조율해.','sun'],['집으로 돌아가기 전','숙소 주방','여행 이후 일상에 가져가고 싶은 것을 말해.','kitchen'],['처음 해 본 도전','숙소 테라스','오늘 용기를 낸 작은 순간을 축하해.','terrace'],['계획이 틀어진 날','비 오는 카페','뜻대로 되지 않은 하루를 받아들이는 마음을 나눠.','cafe'],['어디에도 속하지 않는 기분','밤바다','낯선 곳에서 느끼는 자유와 외로움을 말해.','seaside'],['다시 만날 수 있을까','마지막 밤 테라스','짧은 만남이 남긴 의미와 아쉬움을 전해.','terrace']].map(r=>[...r,'What has this moment made you think about?','이 순간 어떤 생각이 들었어?'] as Row),
 [['내가 좋아하는 것을 찾기','캠퍼스 라운지','타인의 평가 없이 좋아하는 취향을 이야기해.','campus'],['끝내지 못한 작업','조용한 카페','완벽하게 하려다 시작을 미룬 마음을 꺼내.','cafe'],['영감이 떠오르는 길','강변 산책길','일상에서 발견한 작은 아이디어를 나눠.','park'],['동아리 모임 후','늦은 밤 편의점','여럿 사이에서 의견을 내기 어려웠던 순간을 말해.','street'],['작은 결과물 공개하기','햇살 드는 작업실','작품을 보여 주는 설렘과 두려움을 나눠.','sun'],['좋아하는 일과 진로','도서관 라운지','취미를 직업으로 삼을지 고민해 봐.','campus'],['오늘의 작은 진전','작업실 테라스','완성보다 꾸준히 해낸 것을 돌아봐.','terrace'],['비평이 마음에 남을 때','비 오는 카페','피드백과 내 가치를 분리해서 생각해 봐.','cafe'],['나만의 이야기를 만들기','늦은 밤 작업실','내 경험에서 작품의 소재를 찾아봐.','room'],['전시를 마친 밤','밤하늘 테라스','긴 준비 뒤의 후련함과 허전함을 함께 나눠.','terrace']].map(r=>[...r,'What part of this feels most like you?','어떤 부분이 가장 너답다고 느껴져?'] as Row),
 [['한 권을 고르는 오후','서점 독서 라운지','요즘 마음과 닮은 이야기를 찾아봐.','campus'],['책 속의 문장 하나','서점 옆 카페','오래 기억한 문장이 왜 좋았는지 이야기해.','cafe'],['책을 덮고 걷는 길','동네 공원','이야기를 읽고 달라진 생각을 나눠.','park'],['바쁜 날의 잠깐 쉼','서점 창가','혼자 쉬는 시간이 필요한 이유를 말해.','sun'],['나의 어린 시절 이야기','조용한 독서 공간','어릴 때 좋아했던 것과 지금의 나를 이어 봐.','campus'],['책을 선물하고 싶은 사람','동네 카페','누군가에게 전하고 싶은 마음을 골라 봐.','cafe'],['하루를 닫는 대화','서점 앞 골목','오늘 기억하고 싶은 작은 장면을 나눠.','street'],['이별을 다룬 이야기','비 오는 창가','지나간 관계를 돌아보며 남은 감정을 말해.','room'],['다시 시작하는 용기','노을빛 테라스','실패 뒤 새로운 선택을 하는 마음을 나눠.','terrace'],['내 삶을 책으로 쓴다면','조용한 밤 라운지','지금 내 삶의 장에 제목을 붙여 봐.','campus']].map(r=>[...r,'What does that story bring up for you?','그 이야기는 너에게 어떤 마음을 떠올리게 해?'] as Row)
];
extra.forEach(rows=>stories.push(make(rows)));

// Korean particle 와/과 after a name: 과 when the last syllable has a final consonant (이든과, 줄리언과), else 와 (클로이와).
export function withAnd(name:string){const c=name.charCodeAt(name.length-1);const hasFinal=c>=0xac00&&c<=0xd7a3&&(c-0xac00)%28!==0;return name+(hasFinal?'과':'와');}
