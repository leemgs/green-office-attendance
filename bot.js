const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

require('dotenv').config();

const SITE_URL = process.env.SITE_URL || 'https://green-office.uk/';
const USER_ID = process.env.USER_ID;
const USER_PASSWORD = process.env.USER_PASSWORD;

async function runBot(mode = 'attendance') {
  console.log(`Starting bot in ${mode} mode with stealth plugin...`);
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  try {
    // 1. Login
    if (!USER_ID || !USER_PASSWORD) {
      throw new Error('USER_ID or USER_PASSWORD is not set. Please check your GitHub Secrets or .env file.');
    }

    console.log(`Logging in... (ID length: ${USER_ID.length}, Pass length: ${USER_PASSWORD.length})`);
    await page.goto(`${SITE_URL}login`);
    await page.waitForTimeout(5000); 
    await page.waitForSelector('input[placeholder*="아이디"]');
    
    console.log('Filling ID...');
    await page.fill('input[placeholder*="아이디"]', USER_ID.trim());
    await page.waitForTimeout(500);
    
    console.log('Filling Password...');
    await page.fill('input[placeholder*="비밀번호"]', USER_PASSWORD.trim());
    await page.waitForTimeout(1000);
    
    console.log('Submitting login form via native click...');
    const loginBtn = page.locator('button[type="submit"], button:has-text("로그인")').last();
    await loginBtn.waitFor({ state: 'visible', timeout: 5000 });
    await loginBtn.click({ force: true });
    
    // Wait for redirection
    console.log('Waiting for redirection (15s)...');
    await page.waitForTimeout(15000); 
    
    const currentUrl = page.url();
    const loginBtnVisible = await page.locator('button:has-text("로그인")').isVisible();
    
    if (loginBtnVisible || currentUrl.includes('login')) {
      console.error('Login failed: Still on login page.');
      const pageInfo = await page.evaluate(() => {
        const errorEl = document.querySelector('.text-red-500, [role="alert"], .error-message');
        const errorText = errorEl ? errorEl.innerText.trim() : '';
        const bodyTextSnippet = document.body.innerText.slice(0, 500);
        return { errorText, bodyTextSnippet };
      });

      console.log(`Page Content Snippet: ${pageInfo.bodyTextSnippet}`);
      
      let errorMsg = pageInfo.errorText;
      if (!errorMsg) {
        // Removed '가입' to avoid false positive from '회원가입' (Sign up)
        const keywords = ['아이디/비밀번호를 확인해주세요', '틀렸습니다', '올바르지', '실패', 'Cloudflare', 'security verification', 'bot detection'];
        for (const k of keywords) {
          if (pageInfo.bodyTextSnippet.includes(k)) {
            errorMsg = (k === 'Cloudflare' || k === 'security verification') 
              ? 'Blocked by Cloudflare Bot Protection' 
              : `Detected error: ${k}`;
            break;
          }
        }
      }
      
      if (!errorMsg) errorMsg = 'Unknown error (Form may not have submitted properly or silently failed)';
      console.error(`Site status: ${errorMsg}`);
      throw new Error(`Login failed: ${errorMsg}`);
    }
    console.log('Login successful.');

    // Always run attendance if requested
    if (mode === 'attendance') {
      await handleAttendance(page);
    } else if (mode === 'post') {
      await handlePost(page);
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

  console.log('Selecting attendance option: 출근 완료!');
  const optionBtn = page.locator('button:has-text("출근 완료!")');
  if (await optionBtn.isVisible()) {
    await optionBtn.click();
  } else {
    console.log('Option "출근 완료!" not found, searching for alternatives...');
    const altOptions = ["오늘도 화이팅", "좋은 아침입니다", "커피 한 잔 하실래요?", "오늘도 무사히", "직접 입력"];
    for (const opt of altOptions) {
      const btn = page.locator(`button:has-text("${opt}")`);
      if (await btn.isVisible()) {
        await btn.click();
        break;
      }
    }
  }

  console.log('Clicking the final attendance button...');
  const submitBtn = page.locator('button:has-text("출석하기")').first();
  await submitBtn.click();
  
  await page.waitForTimeout(3000);
  console.log('Attendance completed.');
}

async function handlePost(page) {
  console.log('Navigating to posting page...');
  // 게시판 작성 페이지로 이동 (URL은 실제 환경에 맞게 수정 필요)
  await page.goto(`${SITE_URL}board/write`);
  await page.waitForTimeout(3000);

  const title = "🌿 [이번주의 식물] 오렌지자스민 키우기 & 관리 팁";
  const content = `오렌지자스민은 달콤하고 은은한 향기가 나는 하얀 꽃과 붉은 열매를 감상할 수 있어 반려식물로 인기가 매우 높습니다. 초보자도 비교적 쉽게 키울 수 있는 오렌지자스민의 핵심 관리 정보를 정리해 드립니다!

### 1. 햇빛과 온도
- **햇빛**: 밝은 빛을 매우 좋아합니다. 하루 4~6시간 이상 밝은 곳(양지~반양지)에 두어야 꽃이 잘 핍니다. 한여름의 강한 직사광선은 잎을 타게 할 수 있으니 주의하세요.
- **온도**: 15~25℃ 사이에서 가장 잘 자랍니다. 추위에 약하므로 겨울철에는 반드시 실내(10℃ 이상 유지)로 들여서 관리해야 합니다.

### 2. 물 주기 및 습도
- **물 주기**: 겉흙이 말랐을 때 화분 배수구로 물이 흘러나올 정도로 충분히 줍니다. 보통 주 1~2회 정도 확인하는 것이 좋습니다. 겨울철에는 물 주는 횟수를 줄입니다.
- **습도**: 공중 습도가 높은 환경을 좋아합니다. 잎 주변에 자주 분무해 주면 건강하게 유지하는 데 큰 도움이 됩니다.

### 3. 꽃과 열매 관리
- **꽃**: 보통 봄부터 초여름(4~6월) 사이에 피지만, 환경이 좋으면 1년 내내 꽃을 볼 수도 있습니다.
- **열매**: 꽃이 진 후 열매가 맺히는데, 실내에서는 벌이나 나비가 없어 자연 수정이 어렵습니다. 꽃이 피었을 때 붓 등으로 가볍게 인공 수정을 시도해 보세요.

### 4. 기타 관리 팁
- **가지치기**: 꽃이 진 후에 가지를 정리해 주면 수형이 예뻐지고 다음 꽃을 더 풍성하게 피울 수 있습니다.
- **분갈이**: 1~2년에 한 번, 봄이나 가을에 화분이 작아졌을 때 배수가 잘되는 흙으로 분갈이해 줍니다.
- **통풍**: 통풍이 잘되는 환경을 매우 좋아하므로, 실내에서 키우더라도 환기를 자주 시켜주세요!`;

  console.log('Filling post title and content...');
  try {
    const titleInput = page.locator('input[name="title"], input[placeholder*="제목"]').first();
    await titleInput.waitFor({ state: 'visible', timeout: 5000 });
    await titleInput.fill(title);

    const contentArea = page.locator('textarea[name="content"], textarea, .toastui-editor-contents, div[contenteditable="true"]').first();
    await contentArea.fill(content);

    console.log('Clicking the post submit button...');
    const submitBtn = page.locator('button:has-text("등록"), button:has-text("작성"), button[type="submit"]').last();
    await submitBtn.click();
    
    await page.waitForTimeout(3000);
    console.log('Post completed.');
  } catch (err) {
    console.log('Error filling post. Please check the selectors for the posting page.', err);
    throw err;
  }
}

module.exports = { runBot };
