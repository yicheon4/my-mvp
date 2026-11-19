import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
const feedback = {alignment:'matched',meaning_ko:'오늘은 어렵고 내일 도울 수 있다는 뜻이에요.',feedback_ko:'help 뒤에 목적어를 연결해 보세요.',expressions:[{en:'I can help tomorrow. Would that work?',ko:'내일 도와줄 수 있어. 괜찮을까?',context:'친구에게 시간을 제안할 때'},{en:'I am busy today, but I can help tomorrow.',ko:'오늘은 바쁘지만 내일 도와줄 수 있어.',context:'오늘의 사정을 설명할 때'}]};
test('feedback saves only chosen expression, deduplicates and survives reload on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const requests:any[]=[];
 await page.route('**/api/ai',async route=>{requests.push(route.request().postDataJSON());await route.fulfill({json:{ok:true,mode:'gemini',feedback}});});
 await page.goto('/#practice');
 const submit=page.getByRole('button',{name:'Gemini로 표현 피드백 받기'});
 await expect(submit).toBeDisabled();
 await page.getByRole('textbox',{name:'영어로 표현하기'}).fill('I want help you tomorrow.');
 await submit.click();
 await expect(page.getByText('선택한 뜻이 전해졌어요')).toBeVisible();
 expect(requests).toHaveLength(1);expect(requests[0].intent).toBe('tomorrow');
 await page.getByRole('button',{name:'이 표현 저장',exact:true}).first().click();
 await expect(page.getByRole('button',{name:'메모장에 저장됨'})).toBeDisabled();
 await page.getByRole('button',{name:'내 메모장 보기',exact:true}).click();
 await expect(page.getByRole('heading',{name:feedback.expressions[0].en,exact:true})).toBeVisible();
 await page.reload();
 await page.getByRole('button',{name:'내 메모장 보기',exact:true}).click();
 await expect(page.getByRole('heading',{name:feedback.expressions[0].en,exact:true})).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('persona-world-v1'))).not.toContain('I want help you tomorrow.');
});
test('server failure preserves text and retry; changing intent clears old feedback',async({page})=>{
 let attempt=0;
 await page.route('**/api/ai',async route=>{attempt++;await route.fulfill(attempt===1?{status:429,json:{ok:false,error:'quota'}}:{json:{ok:true,mode:'gemini',feedback:{...feedback,alignment:'different'}}});});
 await page.goto('/#practice');
 const input=page.getByRole('textbox',{name:'영어로 표현하기'});
 await input.fill('Yes, let us practice now.');
 await page.getByRole('button',{name:'Gemini로 표현 피드백 받기'}).click();
 await expect(page.getByRole('alert')).toContainText('429');await expect(input).toHaveValue('Yes, let us practice now.');
 await page.getByRole('button',{name:'Gemini로 표현 피드백 받기'}).click();
 await expect(page.getByText('선택한 마음과 다른 뜻으로 들려요')).toBeVisible();
 await page.getByRole('button',{name:'지금 함께 방송 연습을 해 보자고 말하기'}).click();
 await expect(page.getByText('실제 Gemini 피드백',{exact:true})).toHaveCount(0);
});

test('EP1 batches four choices once, retries without losing text, and saves only selected feedback', async ({ page }) => {
 test.setTimeout(120000);
 await page.setViewportSize({ width: 390, height: 844 });
 const requests: any[] = [];
 await page.route('**/api/ai', async route => {
  const body = route.request().postDataJSON(); requests.push(body);
  if (requests.length === 1) return route.fulfill({status:429,json:{ok:false,error:'quota'}});
  return route.fulfill({json:{ok:true,mode:'gemini',feedback:{items:body.items.map((it:any,i:number)=>({choice_id:it.choiceId,meaning_ko:`내가 전한 뜻 ${i+1}`,already_natural:true,coaching_ko:'짧지만 자연스럽게 뜻을 전했어요.',alternatives:[{en:`Let's talk about this ${i+1}.`,ko:'이 이야기를 해 보자.',nuance_ko:'부드럽게 제안해요.'},{en:`Can we discuss this ${i+1}?`,ko:'이 이야기를 해도 될까?',nuance_ko:'상대의 의사를 먼저 물어요.'}]}))}}});
 });
 await page.goto('/#red-ivy');
 await page.getByRole('button',{name:/1화 A Perfect Party/}).click();
 await page.getByRole('button',{name:'시작하기',exact:true}).click();
 let choices=0;
 for(let i=0;i<130;i++) {
  if(await page.locator('.ri-feedback').count()) break;
  const options=page.locator('.ri-option');
  if(await options.count()) {
   await options.nth(choices%2).click();
   const input=page.getByRole('textbox',{name:'내가 할 영어 문장 (확인·수정)'});
   await input.fill(`This is my own answer number ${++choices}.`);
   await page.getByRole('button',{name:/이 문장.*계속하기/}).click();
   expect(requests).toHaveLength(0);
  } else {
   // The dialogue panel overlaps the full-screen next hit area: dispatch its normal click handler.
   await page.getByRole('button',{name:'다음 대사',exact:true}).dispatchEvent('click');
  }
 }
 expect(choices).toBe(4);
 await expect(page.getByRole('button',{name:'피드백 다시 받기'})).toBeVisible();
 expect(requests).toHaveLength(1);
 expect(requests[0].mode).toBe('red-ivy-feedback');
 expect(requests[0].items.map((x:any)=>x.option)).toEqual(['A','B','A','B']);
 await expect(page.locator('.ri-said').last()).toHaveText('This is my own answer number 4.');
 await page.getByRole('button',{name:'피드백 다시 받기'}).click();
 await expect(page.getByText('이미 자연스러운 표현이에요.',{exact:true})).toHaveCount(4);
 await page.getByRole('button',{name:'이 표현 저장',exact:true}).first().click();
 await expect(page.getByRole('button',{name:'메모장에 저장됨',exact:true})).toBeDisabled();
 const persisted=await page.evaluate(()=>localStorage.getItem('persona-world-v1') ?? '');
 expect(persisted).toContain("Let's talk about this 1.");
 expect(persisted).not.toContain('Can we discuss this 1?');
 expect(persisted).not.toContain('This is my own answer');
 await page.getByRole('button',{name:'에피소드 목록',exact:true}).first().click();
 await page.getByRole('button',{name:/1화 A Perfect Party/}).click();
 await page.getByRole('button',{name:'마지막 화면 보기'}).click();
 await expect(page.getByText('이미 자연스러운 표현이에요.',{exact:true})).toHaveCount(4);
 expect(requests).toHaveLength(2);
 await page.reload();
 await page.getByRole('button',{name:/1화 A Perfect Party/}).click();
 await page.getByRole('button',{name:'마지막 화면 보기'}).click();
 await expect(page.getByText(/피드백할 문장이 남아 있지 않아요/)).toBeVisible();
 expect(requests).toHaveLength(2);
});

// Seed completed ids only, as if EP01 was played previously; never seed learner text.
async function completedEpisode(page: import('@playwright/test').Page) {
 const ep=JSON.parse(readFileSync(new URL('../src/redivy/data/ep01.json',import.meta.url),'utf8'));
 await page.addInitScript(({ep})=>localStorage.setItem('persona-world-redivy-v1',JSON.stringify({version:1,episodes:{[ep.episode_id]:{story_id:ep.story_id,episode_id:ep.episode_id,node_id:ep.nodes.find((n:any)=>n.channel==='end_card')!.id,choices:{ep01_c01:'A',ep01_c02:'B',ep01_c03:'A',ep01_c04:'B'},finished:true,updated_at:Date.now()}}})),{ep});
 await page.goto('/#red-ivy');
 await page.getByRole('button',{name:/1화 A Perfect Party/}).click();
 await page.getByRole('button',{name:'마지막 화면 보기'}).click();
}
function characterReply(character:string) { return {speech_text:`I am ${character}. What did you think of the party?`,translation_ko:'파티는 어땠어?',emotion:'curious',suggested_replies:[{en:'It was overwhelming.',ko:'정신없었어.',intent:'내 느낌'},{en:'I enjoyed meeting everyone.',ko:'다들 만나서 좋았어.',intent:'좋았던 점'},{en:'What about you?',ko:'너는 어땠어?',intent:'물어보기'}],learning_card:{expression:'It was overwhelming.',meaning_ko:'정신없었어.',usage_note:'낯선 상황에 압도됐을 때'}}; }
test('all six characters open isolated chats, contextual replies save and errors retain drafts',async({page})=>{
 test.setTimeout(90000);
 await page.setViewportSize({width:390,height:844});
 const reqs:any[]=[];let failNext=false;
 await page.route('**/api/ai',async route=>{
  const body=route.request().postDataJSON();reqs.push(body);
  if(failNext){failNext=false;return route.fulfill({status:429,json:{ok:false,error:'quota'}});}
  return route.fulfill({json:{ok:true,mode:'gemini',reply:characterReply(body.character)}});
 });
 await completedEpisode(page);
 for(const [id,name] of [['chloe','클로이'],['sophie','소피'],['ethan','이든'],['luna','루나'],['julian','줄리언'],['oliver','올리버']]) {
  await page.getByRole('button',{name:`${name}와 일대일 대화`,exact:true}).click();
  await expect(page.getByText(`I am ${id}. What did you think of the party?`,{exact:true})).toBeVisible();
  expect(reqs.at(-1).mode).toBe('red-ivy-chat');expect(reqs.at(-1).character).toBe(id);expect(reqs.at(-1).turns).toEqual([]);
  if(id==='chloe') {
   await page.getByRole('button',{name:'확인',exact:true}).click();
   await page.getByRole('button',{name:'한국어 뜻'}).click();
   await expect(page.getByText('파티는 어땠어?',{exact:true})).toBeVisible();
   await page.getByRole('button',{name:'이 표현 저장',exact:true}).click();
   await expect(page.getByRole('button',{name:'메모장에 저장됨'})).toBeDisabled();
   const input=page.getByRole('textbox',{name:'클로이에게 영어로 말하기'});
   await input.fill('I felt nervous about the party.');failNext=true;
   await page.getByRole('button',{name:'보내기',exact:true}).click();
   await expect(page.getByRole('alert')).toContainText('429');
   await expect(input).toHaveValue('I felt nervous about the party.');
   await page.getByRole('button',{name:'다시 시도',exact:false}).click();
   await expect(page.locator('.bubble.you')).toHaveCount(1);
   expect(reqs.at(-1).turns.at(-1).text).toBe('I felt nervous about the party.');
   await page.screenshot({path:'/tmp/persona-character-chat-mobile.png'});
  }
  await page.getByRole('button',{name:'1화 피드백으로 돌아가기'}).click();
 }
 expect(new Set(reqs.filter(x=>x.opening).map(x=>x.sessionId)).size).toBe(6);
 expect(await page.evaluate(()=>JSON.stringify(sessionStorage))).not.toContain('I felt nervous');
 const notes=await page.evaluate(()=>localStorage.getItem('persona-world-v1'));
 expect(notes).toContain('It was overwhelming.');expect(notes).not.toContain('I felt nervous');
});
test('invalid saved invite can be replaced in chat without leaving the screen',async({page})=>{
 let n=0;
 await page.route('**/api/ai',async route=>{n++;await route.fulfill(n===1?{status:401,json:{ok:false,error:'invite_invalid'}}:{json:{ok:true,mode:'gemini',reply:characterReply('sophie')}});});
 await completedEpisode(page);
 await page.getByRole('button',{name:'소피와 일대일 대화',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('일치하지');
 await page.getByRole('textbox',{name:'시험 참여 코드'}).fill('test-only-not-a-real-code');
 await page.getByRole('alert').getByRole('button',{name:'확인',exact:true}).click();
 await expect(page.getByText('I am sophie. What did you think of the party?',{exact:true})).toBeVisible();
 expect(n).toBe(2);
});
