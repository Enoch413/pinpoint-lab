# PINPOINT LAB

Python 3가 설치된 Windows에서 `START.bat`를 실행합니다. Node.js·npm·pip 패키지는 앱 실행에 필요하지 않습니다. 검증 환경은 Python 3.14와 Chrome/Edge입니다.

런처는 `127.0.0.1:8761`에 서버를 열고 응답 파일을 확인한 뒤 브라우저를 엽니다. 같은 앱이 실행 중이면 재사용하며, 다른 프로그램이 포트를 사용하면 오류를 표시하고 해당 프로그램을 종료하지 않습니다. 새 서버의 콘솔 창을 닫거나 Ctrl+C를 누르면 서버가 종료됩니다.

주소: [PINPOINT LAB](http://127.0.0.1:8761/index.html).

실행 파일은 `START.bat`, `launcher.py`, `index.html`, `app/index.html`, `app/vendor/html2canvas.min.js`입니다. 폰트는 HTML에 포함돼 있으며 화면용 외부 폰트가 연결되지 않으면 대체 글꼴을 사용합니다.

분석 JSON을 선택하고 불러온 뒤 교사용/학생용·별점을 고르고 편집·출력합니다. [입력 규칙](INPUT_FORMAT.md)을 참고하세요. 편집은 현재 창의 메모리에만 보관되므로 창을 닫기 전에 출력해 보관해야 합니다. 재불러오기와 페이지 이탈 시 변경 폐기를 확인합니다.

처음 사용하는 경우 첫 화면의 ‘연습용 분석 JSON 다운로드’를 이용하세요. [공개 연습 자료](samples/MASTER_ANALYSIS.sample.json)는 실제 사용자 자료를 포함하지 않습니다. 키보드의 첫 Tab으로 학습지 영역에 건너뛸 수 있고, 지문·요약·문장별 포인트는 제목 탐색을 지원합니다. 작은 화면·터치 환경에서는 주요 편집 컨트롤을 넓히고, 시스템의 모션 축소 설정에서는 회전 로딩을 멈춥니다.

PNG는 지문별로 저장합니다. 학생용은 화면 크기와 무관하게 794px 폭으로 만들며, 긴 지문은 세로로 길어집니다. 저장하는 동안 화면 설정·편집은 잠깐 비활성화됩니다.

## 검사

Node가 있는 개발 환경에서:

```text
node tests/star-filter.cjs
node tests/import-safety.cjs
node tests/output-accuracy.cjs
python -B -X utf8 tests/test_launcher.py
```

로컬 서버와 설치된 Playwright CLI로 각 브라우저 회귀 검사를 실행합니다. 새 세션을 열고 아래 파일을 `run-code --filename=...`으로 실행하세요.

- `tests/modal-import.browser.js`: 네 모달의 키보드·포커스와 불러오기 보존/취소.
- `tests/workflows.browser.js`: 교사/학생·별점 6종·편집·이동·PNG·접근성·모바일 경계.
- `tests/onboarding.browser.js`: 연습 자료 다운로드·불러오기, 문서 탐색, 터치 영역과 모션 축소.

`node tests/producer-contract.cjs <로컬 예제 JSON 경로...>`는 생산자 예제를 복사하거나 내용을 출력하지 않고 파싱합니다. 실제 사용자 자료는 회귀 fixture로 커밋하지 않습니다.
