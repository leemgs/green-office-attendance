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

  // ── Check for time-restriction rejection ──
  // The site rejects attendance outside weekdays 06:00-11:00 KST with this message.
  const bodyText = await page.locator('body').innerText();
  const rejectionMessage = '출석 가능 시간은 평일 오전 6시~11시입니다';
  if (bodyText.includes(rejectionMessage)) {
    const errorMsg = `ATTENDANCE_TIME_REJECTED: 출석이 거부되었습니다. 사이트 메시지: "${rejectionMessage}"`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // ── Check if already checked in ──
  const alreadyCheckedPhrases = ['출석 완료', '이미 출석', '오늘 출석을 완료'];
  for (const phrase of alreadyCheckedPhrases) {
    if (bodyText.includes(phrase)) {
      console.log(`Already checked in today (detected: "${phrase}"). Skipping.`);
      return;
    }
  }

  console.log('Selecting attendance option: 출근 완료!');
  const optionBtn = page.locator('button:has-text("출근 완료!")');
  if (await optionBtn.isVisible()) {
    await optionBtn.click();
  } else {
    console.log('Option "출근 완료!" not found, searching for alternatives...');
    const altOptions = ["오늘도 화이팅", "좋은 아침입니다", "커피 한 잔 하실래요?", "오늘도 무사히", "직접 입력"];
    let found = false;
    for (const opt of altOptions) {
      const btn = page.locator(`button:has-text("${opt}")`);
      if (await btn.isVisible()) {
        await btn.click();
        found = true;
        console.log(`Selected alternative option: "${opt}"`);
        break;
      }
    }
    if (!found) {
      console.log('Page body text (first 500 chars):', bodyText.substring(0, 500));
      throw new Error('ATTENDANCE_NO_OPTION: 출석 옵션 버튼을 찾을 수 없습니다.');
    }
  }

  console.log('Clicking the final attendance button...');
  const submitBtn = page.locator('button:has-text("출석하기")').first();
  await submitBtn.click();
  
  await page.waitForTimeout(3000);

  // ── Verify after submit — check for late rejection ──
  const afterText = await page.locator('body').innerText();
  if (afterText.includes(rejectionMessage)) {
    const errorMsg = `ATTENDANCE_TIME_REJECTED: 출석 제출 후 거부되었습니다. 사이트 메시지: "${rejectionMessage}"`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.log('Attendance completed successfully.');
}

async function handlePost(page) {
  console.log('Navigating to posting page...');
  await page.goto(`${SITE_URL}posts/new`, { waitUntil: 'networkidle', timeout: 30000 });

  // This is a Next.js CSR page — wait for React to mount the category selection screen.
  console.log('Waiting for Next.js CSR hydration...');
  await page.waitForTimeout(5000);

  const kstDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = kstDate.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat

  let categoryName = "긍정 문구";
  let title = "💡 [오늘의 명언] 긍정적인 하루를 시작하세요";
  let content = "오늘 하루도 작은 목표를 세우고 하나씩 달성해보는 건 어떨까요?\n\n여러분의 오늘 하루도 의미 있는 작은 성취들로 가득하길 응원합니다! 🙌";

  if (day === 5) {
    categoryName = "동료 칭찬";
    
    let selectedName = "동료";
    try {
      const fs = require('fs');
      const path = require('path');
      const coworkersFile = path.join(__dirname, 'data', 'coworkers.txt');
      
      if (fs.existsSync(coworkersFile)) {
        const fileContent = fs.readFileSync(coworkersFile, 'utf8');
        const names = fileContent
          .split(/\r?\n/)
          .map(name => name.trim())
          .filter(name => name.length > 0);
          
        if (names.length > 0) {
          const randomIndex = Math.floor(Math.random() * names.length);
          selectedName = names[randomIndex];
          console.log(`Selected co-worker for praise: ${selectedName}`);
        } else {
          console.log('coworkers.txt is empty.');
        }
      } else {
        console.log(`coworkers.txt not found at ${coworkersFile}`);
      }
    } catch (fsError) {
      console.error('Error reading coworkers.txt:', fsError);
    }

    title = `${selectedName}을 칭찬합니다.`;
    content = `${selectedName}님과 함께 근무할 수 있어 무척 든든하고 행복합니다.\n` +
              `언제나 따뜻한 미소와 적극적인 배려로 동료들에게 큰 힘이 되어 주셔서 깊이 감사드립니다.\n\n` +
              `우리 모두 서로 격려하고 고마움을 나누는 밝은 직장 분위기가 이어지길 바라며, ${selectedName}님의 행복한 하루를 응원합니다! 👍`;
  } else if (day === 3) {
    // 수요일: "긍정 문구" 카테고리로 "알면 도움이 되는 생활 정보" 포스팅.
    // data/life-tips.json 목록을 ISO 주차 번호로 순환 선택 → 매주 새로운 내용이 등록됩니다.
    categoryName = "긍정 문구";
    try {
      const fs = require('fs');
      const path = require('path');
      const tipsFile = path.join(__dirname, 'data', 'life-tips.json');

      if (fs.existsSync(tipsFile)) {
        const tips = JSON.parse(fs.readFileSync(tipsFile, 'utf8'));
        if (Array.isArray(tips) && tips.length > 0) {
          // 연중 주차(week-of-year)로 인덱스를 정해 매주 다음 글이 순서대로 등록되도록 함
          const startOfYear = new Date(kstDate.getFullYear(), 0, 1);
          const weekOfYear = Math.floor((kstDate - startOfYear) / (7 * 24 * 60 * 60 * 1000));
          const tip = tips[weekOfYear % tips.length];
          title = `💡 [알면 도움이 되는 생활 정보] ${tip.title}`;
          content = tip.content;
          console.log(`Selected life tip (week ${weekOfYear}): ${tip.title}`);
        } else {
          console.log('life-tips.json is empty, using fallback content.');
        }
      } else {
        console.log(`life-tips.json not found at ${tipsFile}, using fallback content.`);
      }
    } catch (tipError) {
      console.error('Error reading life-tips.json, using fallback content:', tipError);
    }
  } else {
    categoryName = "긍정 문구";
    try {
      console.log('Fetching daily quote from API...');
      const response = await fetch('https://korean-advice-open-api.vercel.app/api/advice');
      if (response.ok) {
        const data = await response.json();
        title = `💡 [오늘의 명언] ${data.author}의 한마디`;
        content = `"${data.message}"\n\n- ${data.author} (${data.authorProfile || '명언'}) -`;
        console.log(`Successfully fetched quote: ${title}`);
      } else {
        console.log(`Failed to fetch quote, status: ${response.status}`);
      }
    } catch (apiError) {
      console.log('Error fetching quote API, using fallback content:', apiError.message);
    }
  }

  try {
    // ── Step 1: Select the post category ──
    // The page first shows a category picker: "어떤 글을 작성하시겠어요?"
    //   - 긍정 문구 (+10 물방울)
    //   - 동료 칭찬 (+30 물방울)
    //   - 퀘스트 (준비중)
    // We need to click categoryName before the title/content form appears.
    console.log(`Selecting post category: ${categoryName}...`);

    const categorySelectors = [
      `text=${categoryName}`,
      `:text("${categoryName}")`,
      `div:has-text("${categoryName}")`,
      `button:has-text("${categoryName}")`,
      `a:has-text("${categoryName}")`,
    ];

    let categoryClicked = false;
    for (const sel of categorySelectors) {
      console.log(`Trying category selector: ${sel}`);
      try {
        const loc = page.locator(sel).first();
        await loc.waitFor({ state: 'visible', timeout: 10000 });
        await loc.click();
        categoryClicked = true;
        console.log(`Clicked category with selector: ${sel}`);
        break;
      } catch {
        console.log(`Category selector ${sel} not found, trying next...`);
      }
    }

    if (!categoryClicked) {
      // Maybe the category was already selected (page remembered last choice)
      console.log('Could not find category buttons. Checking if form is already visible...');
    }

    // Wait for the form to render after category selection
    console.log('Waiting for post form to appear...');
    await page.waitForTimeout(3000);

    // Log the page state after category selection
    const bodyText = await page.locator('body').innerText();
    console.log('Page body text after category (first 500 chars):', bodyText.substring(0, 500));

    // ── Step 2: Fill the title ──
    console.log('Filling post title...');
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
        await loc.waitFor({ state: 'visible', timeout: 10000 });
        titleInput = loc;
        console.log(`Found title input with selector: ${sel}`);
        break;
      } catch {
        console.log(`Selector ${sel} not found, trying next...`);
      }
    }

    if (!titleInput) {
      const html = await page.content();
      console.log('Full page HTML (first 3000 chars):', html.substring(0, 3000));
      throw new Error('Could not find any title input element on the posting page.');
    }

    await titleInput.fill(title);
    console.log('Title filled successfully.');

    // ── Step 3: Fill the content ──
    console.log('Filling post content...');
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

    // ── Step 4: Submit ──
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
    console.log('Post completed successfully!');
  } catch (err) {
    console.log('Error during post submission:', err);
    throw err;
  }
}

module.exports = { runBot };
