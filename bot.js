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
  await page.goto(`${SITE_URL}posts/new`, { waitUntil: 'networkidle', timeout: 30000 });

  // This is a Next.js CSR page — the form is rendered by React after JS hydration.
  // Wait extra time for React to mount the form components.
  console.log('Waiting for Next.js CSR hydration...');
  await page.waitForTimeout(5000);

  const title = "🌿 [오피스 가드닝] 오렌지 자스민, 사무실 실내에서 죽지 않고 키우는 핵심 가이드";
  const content = `오렌지 자스민은 은은하고 달콤한 자스민 향기와 붉은 열매를 감상할 수 있어 인기 있는 반려식물입니다. 하지만 본래 햇빛과 통풍이 잘 통하는 야외나 베란다에서 자라던 식물이기에, 사무실 실내에서는 관리를 조금만 소홀히 해도 금방 잎이 떨어지거나 죽기 쉽습니다.

사무실 실내라는 한정된 환경 속에서 오렌지 자스민을 건강하게 오래 키우는 핵심 관리 노하우를 정리해 드립니다!

---

### 1. 햇빛 관리 (사무실 명당 찾기 ☀️)
*   **직사광선에 준하는 밝은 곳**: 오렌지 자스민은 빛 요구량이 매우 높은 식물입니다. 사무실 내에서 가장 해가 잘 드는 창가 자리에 배치해 주세요.
*   **식물 생장용 LED 조명 활용**: 창문이 없거나 해가 잘 들지 않는 사무실이라면 **식물용 LED 조명(식물등)**을 필수적으로 설치해 주세요. 하루 최소 8~12시간 정도 식물등을 쬐어 주면 실내에서도 웃자라지 않고 꽃을 피울 수 있습니다.

### 2. 건조한 사무실 공기 극복하기 (습도 조절 💧)
*   **습도 보충**: 냉난방기가 항상 작동하는 사무실은 공기가 매우 건조합니다. 습도가 낮으면 오렌지 자스민의 잎이 누렇게 마르거나 떨어질 수 있습니다.
*   **분무 및 가습기**: 분무기로 잎 주변에 자주 물을 뿌려주거나, 식물 옆에 소형 개인용 가습기를 틀어두면 큰 도움이 됩니다. 물받침에 자갈을 깔고 물을 조금 부어 화분을 올려두는 것도 좋은 방법입니다.

### 3. 실패 없는 물 주기 규칙 (과습 주의 🪵)
*   **속흙 확인 후 물 주기**: 실내에서는 야외보다 흙이 마르는 속도가 현저히 느립니다. 따라서 날짜를 정해놓고 물을 주면 100% 과습으로 뿌리가 썩어 죽게 됩니다.
*   **확인 방법**: 손가락 한 두 마디 깊이로 흙을 찔러보아 속흙까지 보슬보슬하게 말라 있을 때, 화분 배수구 밑으로 물이 흘러나올 때까지 듬뿍 줍니다. 물을 준 후 화분 받침에 고인 물은 반드시 바로 비워주세요.

### 4. 실내 가드닝의 최대 난제: 통풍 (바람 보내기 💨)
*   **통풍의 중요성**: 오렌지 자스민이 실내에서 죽는 가장 큰 원인 중 하나는 '통풍 부족'입니다. 바람이 통하지 않으면 과습이 오기 쉽고 병충해(응애, 깍지벌레 등)가 발생할 확률이 급격히 높아집니다.
*   **해결책**: 창문을 자주 열어 환기를 시켜주는 것이 가장 좋지만, 여의치 않다면 미니 선풍기나 서큘레이터를 약한 바람으로 회전시켜 식물 주변의 공기를 계속 순환시켜 주세요.

### 5. 사무실 맞춤 온도 관리 🌡️
*   오렌지 자스민이 자라기에 가장 좋은 온도는 15~25℃입니다.
*   **주의할 점**: 냉난방기의 찬바람이나 따뜻한 바람이 식물에 직접 닿지 않도록 해주세요. 온도가 급격히 변하거나 건조한 바람을 맞으면 잎이 우수수 떨어질 수 있습니다. 겨울철 퇴근 시간 이후나 주말에 난방이 꺼져 사무실 온도가 10℃ 이하로 내려가지 않도록 관리해 주세요.`;

  console.log('Filling post title and content...');
  try {
    // Dump the page HTML for debugging if elements are not found
    const bodyText = await page.locator('body').innerText();
    console.log('Page body text (first 300 chars):', bodyText.substring(0, 300));

    // Broad selector list — the CSR form may render inputs/textareas with various attributes.
    // Try multiple selector strategies with a generous timeout for React hydration.
    const titleSelectors = [
      'input[placeholder*="제목"]',
      'input[name="title"]',
      'input[type="text"]',
    ];

    let titleInput = null;
    for (const sel of titleSelectors) {
      console.log(`Trying title selector: ${sel}`);
      const loc = page.locator(sel).first();
      try {
        await loc.waitFor({ state: 'visible', timeout: 15000 });
        titleInput = loc;
        console.log(`Found title input with selector: ${sel}`);
        break;
      } catch {
        console.log(`Selector ${sel} not found, trying next...`);
      }
    }

    if (!titleInput) {
      // Last resort: dump full HTML for debugging
      const html = await page.content();
      console.log('Full page HTML (first 2000 chars):', html.substring(0, 2000));
      throw new Error('Could not find any title input element on the posting page.');
    }

    await titleInput.fill(title);
    console.log('Title filled successfully.');

    // Content area selectors
    const contentSelectors = [
      'textarea[placeholder*="내용"]',
      'textarea[name="content"]',
      'textarea',
      'div[contenteditable="true"]',
      '.toastui-editor-contents',
    ];

    let contentArea = null;
    for (const sel of contentSelectors) {
      console.log(`Trying content selector: ${sel}`);
      const loc = page.locator(sel).first();
      try {
        await loc.waitFor({ state: 'visible', timeout: 10000 });
        contentArea = loc;
        console.log(`Found content area with selector: ${sel}`);
        break;
      } catch {
        console.log(`Selector ${sel} not found, trying next...`);
      }
    }

    if (!contentArea) {
      throw new Error('Could not find any content textarea on the posting page.');
    }

    await contentArea.fill(content);
    console.log('Content filled successfully.');

    // Submit button
    console.log('Clicking the post submit button...');
    const submitSelectors = [
      'button:has-text("등록하기")',
      'button:has-text("등록")',
      'button:has-text("작성")',
      'button[type="submit"]',
    ];

    let submitBtn = null;
    for (const sel of submitSelectors) {
      const loc = page.locator(sel).last();
      try {
        await loc.waitFor({ state: 'visible', timeout: 5000 });
        submitBtn = loc;
        console.log(`Found submit button with selector: ${sel}`);
        break;
      } catch {
        continue;
      }
    }

    if (!submitBtn) {
      throw new Error('Could not find any submit button on the posting page.');
    }

    await submitBtn.click();
    await page.waitForTimeout(3000);
    console.log('Post completed.');
  } catch (err) {
    console.log('Error filling post. Please check the selectors for the posting page.', err);
    throw err;
  }
}

module.exports = { runBot };
