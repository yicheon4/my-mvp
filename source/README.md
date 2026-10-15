# Persona World · 모바일 체험 MVP

선택한 2번 보랏빛·골드 비주얼 노벨 콘셉트. React + TypeScript + Vite.

## 실행

`npm ci` 후 `npm run dev -- --host 0.0.0.0 --port 4173`.
현재 작업 중에는 개발 서버를 실행해 두었습니다. 같은 Wi-Fi에서 Mac의 로컬 IP와 4173 포트로 접속할 수 있습니다. 학교/공용 Wi-Fi가 기기 간 접속을 차단하면 이 방법은 동작하지 않습니다.

## 구현 범위

- 나의 역할, 세 명의 룸메이트, 대화 장면 선택
- 음성 인식(지원 브라우저) → 전송 전 확인; 직접 입력과 예시 문장 대체 경로
- 브라우저 음성 합성으로 대사/저장한 표현 듣기
- 준비된 시나리오 답변과 문맥별 표현 추천. 생성형 AI 연결 아님
- 대화 기록, 피드백, 선택 저장, 중복 방지
- 메모장 한국어 뜻 수정 및 삭제, 새 대화/이어하기
- localStorage로 같은 브라우저에 기록 보존
- iPhone / Pixel 모바일 프리뷰

## 제한

실제 마이크 인식은 브라우저 지원, 권한, 네트워크에 달려 있습니다. 인식 서비스는 브라우저 공급자 서버를 사용할 수 있습니다. LAN의 HTTP 접속에서는 음성 인식을 비활성화하고 글 입력으로 전환합니다. 실제 휴대폰 마이크 사용은 HTTPS 배포 후 기기에서 확인해야 합니다. 녹음, 설치형 네이티브 앱, 실제 AI 응답, 서버 동기화, 로그인, 결제, 캐릭터 애니메이션은 이 체험 버전에 포함되지 않습니다.

## 검증

`npm run build`, `npm run check:runtime`. 브라우저에서 대화 → 추천 표현 → 선택 저장 → 뜻 수정 → 새로고침 후 보존을 확인했습니다. 시각 검수 결과는 design-qa.md.

## 기술 자료

- SpeechRecognition: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
- Phosphor icons: https://github.com/phosphor-icons/react

캐릭터 일러스트는 본 프로젝트를 위해 생성했습니다. 원본 UI 이미지를 배경으로 붙인 것이 아니라 캐릭터 배경과 실제 UI 컴포넌트를 분리했습니다.
