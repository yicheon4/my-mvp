import { portraits, mapArt } from './world/world-data';
import type { MapId } from './world/world-data';
export type StoryScene={title:string;place:string;detail:string;art:string;mapId:MapId;opening:string;translation:string;locked:boolean};
// id matches characters/character-prompts.json; the array order is the saved session index and must not change.
// description = public intro from 캐릭터_설정집 v3. No quote/catchphrase field: character voice comes from style prompts, not fixed lines.
export type Person={id:'chloe'|'sophie'|'ethan'|'luna'|'julian'|'oliver';name:string;en:string;art:string;relation:string;role:string;trait:string;description:string;tags:string[];locked:boolean};
export const people:Person[]=[
 {id:'chloe',name:'클로이',en:'CHLOE',art:portraits.chloe,relation:'같은 집 룸메이트',role:'23세 · 환경디자인 3학년',trait:'다정한 현실주의자',description:'같은 쉐어하우스에 사는 동갑내기 룸메이트. 말보다 행동으로 마음을 전한다. 냉장고에는 날짜를 써두지만, 자기 마음에는 좀처럼 이름을 붙이지 못한다.',tags:['같은 집, 다른 하루','차분한 공감','함께 사는 친구'],locked:false},
 {id:'sophie',name:'소피',en:'SOPHIE',art:portraits.sophie,relation:'고등학교 절친',role:'23세 · 미디어커뮤니케이션 3학년 · 캠퍼스 라디오',trait:'내 마음을 먼저 알아채는',description:'고등학교 때부터 알던 절친. 조용한 모임도 금세 떠들썩하게 만든다. 네가 웃는 이유는 잘 알지만, 자신이 웃지 않을 때 어떻게 보여야 할지는 아직 서툴다.',tags:['오래된 우리','유쾌한 솔직함','설명하지 않아도'],locked:false},
 {id:'ethan',name:'이든',en:'ETHAN',art:portraits.ethan,relation:'연애한 지 1년 된 남자친구',role:'24세 · 기계공학 4학년 · 자전거 수리점 아르바이트',trait:'서두르지 않는 다정함',description:'교제한 지 1년 된 남자친구. 좋아하는 메뉴와 자주 걷는 길을 기억한다. 다정한 대답 뒤에 자기 생각을 잠시 미뤄두는 버릇이 있다.',tags:['함께한 1년','서로의 속도','다정한 연인'],locked:false},
 {id:'luna',name:'루나',en:'LUNA',art:portraits.luna,relation:'여행에서 만난 친구',role:'25세 · 시각인류학 휴학 · 지역 이야기 기록',trait:'낯선 곳에서도 나답게',description:'여행 중 우연히 친해진 뒤 이 도시에서 다시 만난 친구. 낯선 골목을 발견하는 감각이 좋다. 다음 목적지는 쉽게 말하면서, 다음 주의 약속에는 잠시 망설인다.',tags:['새로운 시선','여행의 우연','자유로운 대화'],locked:true},
 {id:'julian',name:'줄리언',en:'JULIAN',art:portraits.julian,relation:'예술 동아리 선배',role:'24세 · 시각예술 4학년 · 동아리 전시 총괄',trait:'좋은 질문을 건네는',description:'예술 동아리의 한 학년 선배. 네가 무심코 고른 색에서도 이야깃거리를 찾는다. 좋은 질문을 건네지만, 자기 작품의 제목을 물으면 대답이 길어진다.',tags:['취향을 나누는 사이','차분한 호기심','나만의 방향'],locked:true},
 {id:'oliver',name:'올리버',en:'OLIVER',art:portraits.oliver,relation:'동네 서점에서 사귄 친구',role:'25세 · 문헌정보학 졸업 · 가족 서점 운영 보조',trait:'이야기를 오래 기억하는',description:'동네 서점에서 책을 추천받다 친해진 친구. 네가 고른 책은 잘 기억하지만 자기 추천이 늘 맞는다고 생각하지는 않는다. 조용한 얼굴로 엉뚱한 농담을 한다.',tags:['책으로 이어진 사이','조용한 유머','느긋한 오후'],locked:true},
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
