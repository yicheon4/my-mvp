# Persona World (my-mvp)

공개 주소: https://my-mvp-ivory.vercel.app/

## 폴더 역할

| 위치 | 용도 |
| --- | --- |
| `source/` | **기준 원본.** React + TypeScript + Vite 소스. 기능 수정은 여기서만 한다 |
| 최상단 `index.html`, `app.js`, `app.css`, 이미지 | 빌드 결과물. Vercel이 이 파일들을 그대로 배포한다. 직접 고치지 않는다 |
| GitHub (`yicheon4/my-mvp`) | 원본과 배포 파일의 변경 이력 보관 |
| Vercel | `main` 브랜치에 push되면 자동 배포 |

`.vercelignore`가 `source/`를 배포에서 빼 준다.

## 수정 → 배포 순서

```bash
cd source
npm install          # 처음 한 번
npm run dev          # 화면 확인
npm run build
python3 -I scripts/export-github-static.py   # 결과물을 저장소 최상단에 복사
cd ..
git add -A && git commit -m "..." && git push
```

## 단일 HTML (수업 제출용)

수업에서 단일 `index.html` 파일 제출이 필요할 때만 `source/scripts/export-single-html.py`로 따로 만든다(결과: `source/dist/submission/index.html`, Git에 올리지 않음).
제출용 파일이며 개발 원본이 아니다.
