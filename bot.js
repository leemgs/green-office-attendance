const { chromium } = require('playwright');
require('dotenv').config();

const SITE_URL = process.env.SITE_URL || 'https://green-office.uk/';
const USER_ID = process.env.USER_ID;
const USER_PASSWORD = process.env.USER_PASSWORD;

async function runBot(mode = 'comment') {
  console.log(`Starting bot in ${mode} mode...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    // 1. Login
    console.log('Logging in...');
    await page.goto(`${SITE_URL}login`);
    await page.fill('input[placeholder*="아이디"]', USER_ID);
    await page.fill('input[placeholder*="비밀번호"]', USER_PASSWORD);
    await page.click('button:has-text("로그인")');
    
    // Wait and verify login
    await page.waitForTimeout(5000); 
    const loginBtn = await page.locator('button:has-text("로그인")').isVisible();
    if (loginBtn) {
      console.error('Login failed: Still on login page.');
      // Check for error messages
      const errorMsg = await page.locator('.text-red-500, [role="alert"]').innerText().catch(() => '');
      if (errorMsg) console.error(`Error message: ${errorMsg}`);
      throw new Error('Login failed. Please check your ID and PASSWORD.');
    }
    console.log('Login successful.');

    if (mode === 'comment') {
      await handleComment(page);
    } else if (mode === 'post') {
      await handlePost(page);
    } else if (mode === 'attendance') {
      await handleAttendance(page);
    }

  } catch (error) {
    console.error('Error during bot execution:', error);
    await page.screenshot({ path: `error-${mode}-${Date.now()}.png` });
    throw error;
  } finally {
    await browser.close();
  }
}

async function handleAttendance(page) {
  console.log('Navigating to attendance page...');
  await page.goto(`${SITE_URL}attendance`);
  await page.waitForTimeout(3000);

  console.log('Selecting attendance option: 오늘도 화이팅');
  // Try to find the button with the text provided by user
  const optionBtn = page.locator('button:has-text("오늘도 화이팅")');
  if (await optionBtn.isVisible()) {
    await optionBtn.click();
  } else {
    console.log('Option "오늘도 화이팅" not found, searching for alternatives...');
    const altOptions = ["출근 완료!", "좋은 아침입니다", "직접 입력"];
    for (const opt of altOptions) {
      const btn = page.locator(`button:has-text("${opt}")`);
      if (await btn.isVisible()) {
        await btn.click();
        break;
      }
    }
  }

  console.log('Clicking the final attendance button...');
  // The large button with the leaf emoji
  const submitBtn = page.locator('button:has-text("출석하기"), span:has-text("출석하기")');
  await submitBtn.click();
  
  await page.waitForTimeout(3000);
  console.log('Attendance completed.');
}

async function handleComment(page) {
  // (Remaining handleComment code stays mostly same, but with minor robustness improvements)
  console.log('Navigating to home to find a post...');
  await page.goto(SITE_URL);
  await page.waitForLoadState('networkidle');

  const postLinks = await page.$$eval('a[href*="/posts/"]', links => links.map(a => a.href));
  
  if (postLinks.length === 0) {
    console.log('No posts found. Looking for alternative selectors...');
    const altLinks = await page.$$eval('main a', links => links.map(a => a.href).filter(href => href.includes('/posts/')));
    if (altLinks.length > 0) postLinks.push(...altLinks);
  }

  if (postLinks.length === 0) {
    throw new Error('Could not find any posts to comment on.');
  }

  const randomPost = postLinks[Math.floor(Math.random() * postLinks.length)];
  console.log(`Selecting random post: ${randomPost}`);
  await page.goto(randomPost);
  await page.waitForTimeout(2000);

  const messages = ["감사합니다.", "멋집니다."];
  const message = messages[Math.floor(Math.random() * messages.length)];

  console.log(`Leaving comment: ${message}`);
  
  const commentArea = await page.waitForSelector('textarea', { timeout: 10000 });
  await commentArea.fill(message);
  
  const submitBtn = await page.locator('button:has-text("등록"), button:has-text("댓글")').first();
  await submitBtn.click();
  
  await page.waitForTimeout(2000);
  console.log('Comment submitted successfully.');
}

async function handlePost(page) {
  console.log('Creating a new post about Orange Jasmine...');
  
  await page.goto(SITE_URL);
  await page.waitForTimeout(2000);
  
  const writeBtn = await page.locator('a[href*="/write"], button:has-text("글쓰기"), a:has-text("글쓰기")').first();
  
  if (await writeBtn.isVisible()) {
    await writeBtn.click();
  } else {
    console.log('Write button not found on home, navigating directly to /write');
    await page.goto(`${SITE_URL}write`);
  }
  
  await page.waitForTimeout(3000);

  // Check if we are on the write page (some sites use different paths)
  if (page.url().includes('login')) {
    throw new Error('Redirected to login page. Post writing requires being logged in.');
  }

  const title = "오렌지 자스민 키우기: 향기로운 반려식물을 위한 꿀팁 🌿";
  const content = `
오렌지 자스민(Orange Jasmine)은 향기로운 하얀 꽃과 반짝이는 잎이 매력적인 식물입니다. 
성공적으로 키우기 위한 핵심 정보를 공유합니다!

1. 햇빛: 양지~반양지를 좋아합니다. 하루 4-6시간 이상의 밝은 빛이 필요해요.
2. 물주기: 겉흙이 말랐을 때 흠뻑 주세요. (주 1-2회 정도)
3. 온도: 15~25도 사이가 적당하며, 추위에 약하니 겨울에는 실내로 옮겨주세요.
4. 팁: 꽃이 진 후 가지치기를 해주면 더 풍성하게 자란답니다.

달콤한 향기가 가득한 오렌지 자스민과 함께 힐링하세요! #식물키우기 #오렌지자스민 #가드닝
  `.trim();

  console.log('Filling post content...');
  // More robust selector for title
  const titleInput = page.locator('input[placeholder*="제목"], input[name*="title"], input[type="text"]').first();
  await titleInput.fill(title);
  
  console.log('Filling body content...');
  // More robust selector for content
  const contentArea = page.locator('textarea, div[contenteditable="true"], .ProseMirror').first();
  await contentArea.fill(content);
  
  console.log('Submitting post...');
  const submitBtn = await page.locator('button:has-text("등록"), button:has-text("작성"), button:has-text("완료")').first();
  await submitBtn.click();
  
  await page.waitForTimeout(5000);
  console.log('Post created successfully.');
}

module.exports = { runBot };
