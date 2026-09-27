# 풀카운트 3D — 소스 코드

## 폴더 구조
- `template.html` — HTML 마크업 + CSS (UI 화면, 버튼, 모달)
- `sim.js` — 순수 야구 로직 (투구 궤적, 타구 물리, 수비·주루 판정, 스윙 판정). 렌더링과 무관해서 node로 단독 테스트 가능
- `src/` — 게임 코드. 파일 이름 순서대로 이어 붙여져서 한 스크립트가 됨
  - `g0_core.js` 렌더러·유틸 / `g1_world.js` 야구장 / `g2_figures.js` 선수 모델·포즈 / `g3_audio.js` 효과음
  - `g4_data.js` **실제 선수 데이터** (tools/gen.py가 생성) / `g4_ui.js` HUD·전광판·타이틀
  - `g5_flow.js` 경기 흐름 (타석, 투구, 판정, 교체, 기록→능력치 변환 `rateHitter`/`ratePitcher`)
  - `g5r_rules.js` 폭투·낫아웃·보크·피치클락 / `g6_play.js` 타구 후 수비·주루 연출
  - `g7_loop.js` 카메라·입력·메인 루프 / `g8_manager.js` 구단 관리·대타·수비교체
  - `g9_modes.js` 시즌·훈련 / `gz_online.js` 온라인 1:1 + 로그인 화면 (서버의 WebSocket 방, claude.ai에선 room)
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
