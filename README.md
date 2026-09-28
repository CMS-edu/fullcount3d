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
  - 구종: 직구 FB · 투심 TS(싱커 포함) · 커터 CT · 슬라이더 SL · 스위퍼 ST · 커브 CB · 체인지업 CH · 포크 FK(스플리터 포함). 3% 미만인 구종은 뺌
  - 기록이 40구보다 적은 투수는 예전처럼 추정 구종 사용

## 테스트용 주소 해시
- `#auto&speed=3&inn=3&home=1` : 자동 플레이 (양쪽 다 자동)
- `#fast` : 렌더링을 줄여서 느린 PC에서 빠르게 테스트
- `#force=wp,balk` : 폭투·보크 강제로 자주 발생

## 참고
- 능력치 공식은 `src/g5_flow.js`의 `rateHitter` / `ratePitcher`
- 난타전/투수전 밸런스: `sim.js`의 `FT`(수비 속도), `cpuSwing`의 `pc`(컨택)·`evMean`(타구 속도)
- 온라인 1:1은 서버가 각자의 presence(작은 JSON)만 중계하고, 경기 계산은 두 기기가 같은 시드로 똑같이 함

## 온라인 서버 (로컬 실행)
```
npm install
npm run dev          # 빌드 + 서버 → http://localhost:8000
```
환경변수: `PORT`(기본 8000), `SECRET`(로그인 토큰 서명 키 — 없으면 재시작 때마다 다시 로그인),
`DATABASE_URL`(PostgreSQL 주소 — 없으면 `data_server/users.json` 파일에 저장)

API: `POST /api/signup`, `POST /api/login` ({name, pw}) → {token, user} / `GET /api/me` / `POST /api/result` / WebSocket `/ws?token=..&peer=..`
