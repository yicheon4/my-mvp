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
