# 🌿 그린메이커 자동화 봇 (Green Maker Auto Bot)

이 프로젝트는 [그린메이커(green-office.uk)](https://green-office.uk/) 커뮤니티 활동을 자동화하기 위한 도구입니다. 매일 정해진 시간에 댓글을 남기고, 매주 수요일에는 유익한 식물 정보를 자동으로 포스팅합니다.

---

## ✨ 주요 기능

- **자동 로그인**: 설정된 계정 정보를 사용하여 안전하게 접속합니다.
* **매일 자동 출석체크 (오전 9시)**: `오늘도 화이팅` 문구와 함께 자동으로 출석체크를 완료합니다.
* **매일 자동 댓글 (오전 8시, 오후 3시)**: 게시판의 글 중 하나를 무작위로 선택하여 "감사합니다." 또는 "멋집니다." 댓글을 작성합니다.
* **수요일 자동 포스팅 (오전 8시)**: "오렌지 자스민" 식물과 관련된 유익한 정보를 담은 게시글을 자동으로 업로드합니다.

---

## 🛠 설치 및 로컬 실행 방법

로컬 환경(내 컴퓨터)에서 테스트하거나 실행하고 싶을 때 다음 단계를 따르세요.

### 1. 사전 요구 사항
- [Node.js](https://nodejs.org/) (v18 이상 권장) 가 설치되어 있어야 합니다.

### 2. 프로젝트 내려받기 및 의존성 설치
```bash
# 레포지토리 클론
git clone https://github.com/leemgs/my-auto-comment.git
cd my-auto-comment

# 필요한 패키지 설치
npm install

# Playwright 브라우저 엔진 설치
npx playwright install chromium
```

### 3. 환경 변수 설정
프로젝트 루트 디렉토리에 `.env` 파일을 만들고 로그인 정보를 입력합니다. ( `.env.example` 파일을 복사해서 사용하세요)

```bash
cp .env.example .env
```

`.env` 파일 내용 예시:
```env
USER_ID=your_id_here
USER_PASSWORD=your_password_here
SITE_URL=https://green-office.uk/
```

### 4. 실행 테스트
```bash
# 자동 댓글 테스트
node index.js comment

# 자동 포스팅 테스트
node index.js post
```

---

## 🤖 GitHub Actions로 자동화하기 (권장)

GitHub Actions를 설정하면 내 컴퓨터를 켜두지 않아도 매일 정해진 시간에 봇이 자동으로 실행됩니다.

### Step 1: 환경 변수(Secrets) 등록
GitHub 레포지토리 페이지에서 다음 설정을 수행합니다.
1. **Settings** 탭 클릭
2. 좌측 사이드바에서 **Secrets and variables > Actions** 클릭
3. **New repository secret** 버튼 클릭
4. 다음 두 항목을 각각 추가합니다:
   - 이름: `USER_ID` / 값: 본인의 그린메이커 아이디
   - 이름: `USER_PASSWORD` / 값: 본인의 그린메이커 비밀번호

### Step 2: 스케줄 확인
이미 `.github/workflows/auto.yml` 파일에 스케줄이 설정되어 있습니다.
- **오전 8시 (KST)**: 댓글 작성 (+ 수요일엔 포스팅 추가 실행)
- **오후 3시 (KST)**: 댓글 작성

---

## ⚠️ 주의 사항 및 면책 조항
- 이 봇은 학습 및 개인적인 편의를 위해 제작되었습니다.
- 커뮤니티 운영 정책을 준수해 주세요. 과도한 자동 활동은 계정 정지의 원인이 될 수 있습니다.
- 본 도구의 사용으로 인해 발생하는 모든 책임은 사용자에게 있습니다.

---

## 📄 라이선스
MIT License
