# 풀카운트 3D — 소스 코드

## 폴더 구조
- `template.html` — HTML 마크업 + CSS (UI 화면, 버튼, 모달)
- `sim.js` — 순수 야구 로직 (투구 궤적, 타구 물리, 수비·주루 판정, 스윙 판정). 렌더링과 무관해서 node로 단독 테스트 가능
- `src/` — 게임 코드. 파일 이름 순서대로 이어 붙여져서 한 스크립트가 됨
  - `g0_core.js` 렌더러·유틸 / `g1_world.js` 야구장·불꽃놀이 / `g2_figures.js` 선수 모델(얼굴·유니폼 텍스처)·포즈 / `g3_audio.js` 효과음
  - `g4_data.js` **실제 선수 데이터** (tools/gen.py가 생성) / `g4_fx.js` 화면 이펙트(색종이·불꽃·흔들림)
  - `g4_photos.js` 선수 사진 목록 (tools/photos.js가 생성) / `g4_portrait.js` 선수 얼굴(사진·그림·내 사진) / `g4_ui.js` HUD·전광판·타이틀·선수 소개 카드
  - `g5_flow.js` 경기 흐름 (타석, 투구, 판정, 교체, 기록→능력치 변환 `rateHitter`/`ratePitcher`)
  - `g5r_rules.js` 폭투·낫아웃·보크·피치클락 / `g6_play.js` 타구 후 수비·주루 연출
  - `g7_loop.js` 카메라·입력·메인 루프 / `g8_manager.js` 구단 관리·대타·수비교체
  - `g9_modes.js` 시즌·훈련 / `gz_online.js` 온라인 1:1 + 로그인 (서버의 WebSocket 방, claude.ai에선 room) / `gzz_home.js` 홈 화면 탭·내 정보
- `build.py` / `build.js` — 합쳐서 HTML 한 파일로 만드는 스크립트 (같은 일, Python/Node 버전)
- `server/` — 온라인 서버 (Node): `index.js` 정적 파일·회원가입/로그인 API·실시간 방, `store.js` 계정 저장소
- `package.json`, `render.yaml` — Render 배포 설정
- `dist/three.min.js` — three.js r128 (MIT 라이선스)
- `data/`, `tools/` — 선수 데이터 원본(수집한 기록)과 변환 스크립트

## 빌드 (Python 3 필요)
```
python build.py --inline -o dist/fullcount3d.html   # three.js까지 넣은 단일 파일 (오프라인 OK)
python build.py -o dist/index.html                  # three.js를 CDN에서 불러오는 가벼운 버전
python build.py --local -o dist/index.html          # dist/three.min.js를 옆 파일로 참조 (개발용)
```
개발할 땐 `--local`로 빌드하고 `dist` 폴더에서 `python -m http.server 8000` 띄운 뒤
브라우저로 http://localhost:8000 열면 편해. (파일을 그냥 더블클릭해도 대부분 돌아가.)

## 선수 데이터 다시 만들기
`data/*.txt`(수집한 기록)와 `data/names.py`(한글 이름)를 고친 뒤:
```
python tools/parse.py && python tools/gen.py     # → src/g4_data.js 재생성
```

## 선수 사진
- **KBO 공식 사진**: `node tools/kbo_photos.js` → KBO 홈페이지 선수 검색으로 선수 ID를 찾아 `src/g4_kbo.js` 생성
  - 이름 → 현역 + 같은 팀 → 등번호 → 투수/야수 순으로 좁혀서 동명이인 방지. 표기가 다른 외국인 선수 등은 `MANUAL`에 직접 추가
  - 사진 파일은 저장소에 없음. 게임이 KBO 사이트의 사진 주소(`KBO_IMAGE/person/middle/2026/ID.jpg`)를 바로 불러옴 → 시즌이 바뀌면 `YEAR`만 바꿔서 다시 실행
- 공식 사진을 못 찾은 선수용 예비: Wikimedia Commons 자유 라이선스 사진 (`node tools/photos.js` → `src/g4_photos.js`, 저작자·라이선스 표시)
  - 이적했는데 Wikidata가 안 따라온 선수는 `tools/photos.js`의 `MANUAL`, 동명이인은 `BLOCK`에 추가
  - 얼굴이 동그라미 가운데 오게 하는 위치는 `tools/photo_focus.json` ([가로, 세로, 확대])
- 사진이 없는 선수는 3D 선수와 같은 얼굴 그림으로 나오고, 구단 탭에서 얼굴을 눌러 **내 사진**을 넣을 수 있음 (그 기기에만 저장)

## 투수 구종
- `node tools/pitch_mix.js` → 네이버 스포츠 문자중계의 공 하나하나(구종·구속)를 모아서 `src/g4_pitchmix.js` 생성
  - 투수는 KBO 선수 ID로 맞춤 (문자중계의 투수 번호 = KBO ID). 최근 경기부터 훑어서 투수마다 250구쯤 모이면 멈춤 (몇 분 걸림)
  - 투수별 구종 목록·구사율·구종별 평균 구속 → 투구 버튼, CPU 투구 선택(볼카운트 보정), 실제 구속에 반영
  - 투구 추적(PTS) 궤적으로 **무브먼트**(PITCHf/x 방식: 40피트~홈 사이 회전 때문에 휜 거리, 인치)와 **릴리스 높이**도 계산
    - 게임은 리그 구종 평균(`PITCH_MV_AVG`)과의 차이만큼 공을 더/덜 휘게 함 (1인치 = 2.54cm). 표본이 적으면 평균 쪽으로 당김
    - 구종별 기본 휘어짐은 `sim.js`의 `PITCHES`(arm = 팔 쪽 가로 m, drop = 떨어짐 m). 커터는 직구와 구별되게 기본값을 키움(글러브 쪽 16cm)
    - 릴리스 높이로 팔 높이(오버핸드·사이드암·언더핸드)를 정해서 투구 동작과 공이 나오는 위치가 바뀜
  - 경기별 요약은 `tools/.cache/`에 저장돼서 다시 돌리면 빠름 (저장소에는 안 올라감)
  - 구종: 직구 FB · 투심 TS(싱커 포함) · 커터 CT · 슬라이더 SL · 스위퍼 ST · 커브 CB · 체인지업 CH · 포크 FK(스플리터 포함). 3% 미만인 구종은 뺌
  - 기록이 40구보다 적은 투수는 예전처럼 추정 구종 사용

## 선수 스킬
- `src/g5s_skills.js`: 스킬 목록(타자 8 · 투수 9)과 자동 배정 — 2026 기록에서 리그 백분위가 높은 장점으로 팀마다 타자 2 · 투수 2
  - 구단 탭 ✨ 스킬에서 바꾸고 저장 (`roster2`의 `sk`), 온라인은 방 시작 때 상대에게 전달
  - 효과 숫자: `sim.js`의 `skillMods`(스윙) · `pitchSpeed` · `pitchSigma` · `makePitch`(마구) · `fatigueOf`, 도루·견제는 `g5_flow.js` `stealChance` · `g5r_rules.js` `pickoff`
- `src/g5u_skillfx.js`: 스킬 연출 (경기 결과와 무관, Math.random만)
  - 컷인(등판·등장·안타·삼진·도루·견제사·병살·위기 탈출), 3D 오라, 투구 꼬리, 임팩트, 스킬별 합성 효과음, 스킬 홈런 슬로모션
  - 내가 칠 때 투구가 시작되면 컷인을 바로 치워서 공을 가리지 않음 · 메뉴의 "스킬 연출"로 끌 수 있음

## 음악
- `src/g3m_music.js`: 전부 WebAudio로 합성하는 오리지널 곡 (실제 응원가·등장곡은 저작권 때문에 안 씀)
  - 배경: 타이틀 테마 · 응원 비트(우리 공격) · 구장 오르간(상대 공격) — 투구 중엔 소리를 줄임
  - 등장곡: 선수 이름으로 시드를 정해 같은 선수는 늘 같은 곡, 스킬(없으면 선수 유형)에 따라 록·일렉트로·에픽·펑크·힙합·행진곡·트로트·K팝·로파이
  - 신호: 플레이볼 · 홈런 · 득점 · 삼진 · 공수교대 · 승리 · 패배, 마무리 투수 등판 테마
  - 브라우저 정책상 첫 터치 뒤부터 소리가 남 · 메뉴 "음악" 스위치와 타이틀의 🎵 버튼으로 끄고 켬

## 타자 성향
- `node tools/batter_tend.js` → 정규시즌 전체 문자중계의 투구 위치·결과와 타석 결과로 `src/g4_battend.js` 생성
  - 코스 13칸(존 안 3×3 + 존 밖 위·아래·몸쪽·바깥쪽)마다 스윙률·헛스윙률·타율, 당겨치기/밀어치기 비율, 땅볼 비율
  - CPU 타자: 코스별로 잘 참거나 잘 따라가고, 헛스윙이 많거나 적고, 강한 코스는 더 세게 침. 타구 방향·발사각도 성향대로
  - 내가 던질 때 존 패드에 그 타자의 **핫존**(칸별 타율, 빨강 강함 · 파랑 약함), 타자 소개 카드에 작은 핫존
  - 내가 칠 때도 화면의 스트라이크 존에 내 타자의 핫·콜드 존 (공이 날아오는 동안엔 숫자를 빼고 색만, 메뉴에서 끄기 가능)
  - `tools/relay.js`: 두 조사 도구가 같이 쓰는 문자중계 모으기·캐시(`tools/.cache/relay2`)

## 테스트용 주소 해시
- `#auto&speed=3&inn=3&home=1` : 자동 플레이 (양쪽 다 자동)
- `#fast` : 렌더링을 줄여서 느린 PC에서 빠르게 테스트
- `#force=wp,balk` : 폭투·보크 강제로 자주 발생
- `#auto&mode=none` : 자동 플레이만 켜고 경기는 시작 안 함 → 두 창에서 온라인 방을 만들고 들어가면 자동으로 끝까지 대전 (동기화 테스트용)

## 참고
- 능력치 공식은 `src/g5_flow.js`의 `rateHitter` / `ratePitcher`
- 난타전/투수전 밸런스: `sim.js`의 `FT`(수비 속도), `cpuSwing`의 `pc`(컨택)·`evMean`(타구 속도)
- 온라인 1:1은 서버가 각자의 presence(작은 JSON)만 중계하고, 경기 계산은 두 기기가 같은 시드로 똑같이 함
  - 타자 쪽 대타·대주자·도루는 '요청'만 보내고, 투수 쪽 기기가 공과 공 사이에 적용한 뒤 `subok` 신호를 보내면 그때 적용 → 두 기기가 항상 같은 공 직전에 바뀜
  - 투수 쪽 수비 교체·투수 교체·고의4구·견제·수비 위치 작전은 바로 적용하고 신호를 보냄 (주자 리드 작전은 타자 쪽 요청처럼 처리) (타자 쪽은 다음 공 신호 전에 순서대로 적용)
  - 연결이 끊기면 90초까지 기다리고, 재접속하면 presence에 남아 있는 최근 행동(24개)으로 이어서 계속함
  - 통신 규칙을 바꾸면 `gz_online.js`의 `PROTO`를 올릴 것 — 버전이 다른 기기끼리는 방에 못 들어감

## 온라인 서버 (로컬 실행)
```
npm install
npm run dev          # 빌드 + 서버 → http://localhost:8000
```
환경변수: `PORT`(기본 8000), `SECRET`(로그인 토큰 서명 키 — 없으면 재시작 때마다 다시 로그인),
`DATABASE_URL`(PostgreSQL 주소 — 없으면 `data_server/users.json` 파일에 저장)

API: `POST /api/signup`, `POST /api/login` ({name, pw}) → {token, user} / `GET /api/me` / `POST /api/result` / WebSocket `/ws?token=..&peer=..`
