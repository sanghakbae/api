export default function Guide() {
  return (
    <div className="page-pad guide">
      <header className="page-head"><h2>📖 사용법 (처음이어도 괜찮아요)</h2></header>

      <section className="g-card">
        <h3>0. 이게 뭐 하는 곳이야?</h3>
        <p>
          웹사이트는 두 가지를 주고받아요. 하나는 <b>사람이 보는 화면</b>, 다른 하나는 그 화면 뒤에서
          프로그램끼리 주고받는 <b>데이터(=API)</b> 예요.
        </p>
        <p className="g-tip">
          🍱 비유: 식당에서 <b>메뉴판(화면)</b>을 보고 주문하면, 주방에 <b>주문서(API)</b>가 들어가고
          <b>음식(데이터)</b>이 나오죠. 이 사이트는 그 “주문서”를 직접 보내보고, 어떤 음식이 나오는지 확인하는 도구예요.
        </p>
      </section>

      <section className="g-card">
        <h3>1. 메뉴 한눈에 보기</h3>
        <ul className="g-list">
          <li><b>🧪 테스터</b> — 요청을 보내고 결과를 봅니다. (가장 많이 쓰는 곳)</li>
          <li><b>📁 저장된 API</b> — 저장한 요청 목록 + <b>🕘 최근</b>(보낸 기록 자동 저장)</li>
          <li><b>🔍 URL 분석</b> — 사이트 주소만 넣으면 어떤 API를 쓰는지 자동으로 찾아줍니다.</li>
          <li><b>🔑 API 키</b> — 인증 키를 저장해두고 요청에 자동으로 넣습니다.</li>
          <li><b>🍪 세션</b> — 로그인 쿠키를 사이트별로 저장 → 그 사이트 요청에 자동 적용.</li>
          <li><b>🧩 환경변수</b> — 자주 쓰는 값을 <code>{'{{이름}}'}</code> 으로 끼워 쓰기.</li>
        </ul>
      </section>

      <section className="g-card">
        <h3>2. 가장 쉬운 첫 시도 (공개 사이트)</h3>
        <ol className="g-steps">
          <li>왼쪽 <b>🧪 테스터</b> 클릭</li>
          <li>주소칸에 <code>https://httpbin.org/json</code> 입력</li>
          <li>오른쪽 <b>전송</b> 버튼 클릭</li>
          <li>아래에 <b>200</b> 과 데이터가 나오면 성공! 🎉</li>
        </ol>
        <p className="g-tip">초록색 <b>200</b> = 잘 됨. 빨간 숫자(401·403·404·500 등) = 뭔가 막혔거나 잘못됨.</p>
      </section>

      <section className="g-card">
        <h3>3. 로그인이 필요한 사이트(예: 회사 그룹웨어)의 API 가져오기</h3>
        <p>로그인해야 보이는 사이트는, 브라우저가 실제로 보낸 요청을 “통째로 복사”해서 가져오는 게 가장 확실해요.</p>
        <ol className="g-steps">
          <li>그 사이트에 <b>평소처럼 로그인</b>합니다.</li>
          <li>키보드 <b>F12</b> 를 눌러 개발자도구를 엽니다.</li>
          <li>위쪽 탭에서 <b>Network(네트워크)</b> 를 클릭합니다.</li>
          <li>그 아래 필터에서 <b>Fetch/XHR</b> 를 클릭합니다. (이게 API만 보여주는 필터)</li>
          <li>사이트에서 <b>보고 싶은 메뉴/버튼을 눌러봅니다.</b> 그러면 목록에 요청들이 뜹니다.</li>
          <li>그중 하나를 <b>마우스 오른쪽 클릭 → Copy → Copy as cURL</b> 합니다.</li>
          <li>이 사이트의 <b>🧪 테스터</b> 로 와서, 위쪽 <b>📋 cURL 가져오기</b> 버튼을 누릅니다.</li>
          <li>열린 칸에 <b>붙여넣기(Cmd+V / Ctrl+V)</b> → <b>가져오기</b> 클릭.</li>
          <li>주소·헤더·쿠키가 자동으로 채워집니다. <b>전송</b> 누르면 결과가 보여요.</li>
        </ol>
        <p className="g-warn">
          ⚠️ 회사 내부망 사이트는 인터넷(클라우드)에서 접근이 안 됩니다. 이럴 땐 아래 4번을 먼저 하세요.
        </p>
      </section>

      <section className="g-card">
        <h3>4. 회사 내부망 사이트는 “로컬(내 PC)”로</h3>
        <p>내부망 사이트는 <b>내 컴퓨터</b>에서 직접 보내야 닿습니다. 두 가지만 하면 돼요.</p>
        <ol className="g-steps">
          <li>
            내 컴퓨터에서 작은 “분석기”를 켭니다. 프로젝트 폴더에서 터미널을 열고
            <code>npm run worker:dev</code> 를 입력 → 엔터. (<code>localhost:8799</code> 에서 켜짐)
          </li>
          <li>테스터/URL 분석 화면 위쪽 <b>요청 위치</b> 에서 <b>💻 로컬(내 PC)</b> 를 누릅니다.</li>
          <li>이제 3번처럼 cURL을 가져와 <b>전송</b> 하면, 내 PC를 통해 내부망에 닿습니다.</li>
        </ol>
        <p className="g-tip">
          한 번 <b>💻 로컬</b>로 바꾸면 계속 그 상태로 기억돼요. 인터넷 공개 사이트를 테스트할 땐 다시 <b>☁️ 클라우드</b>로 바꾸세요.
        </p>
      </section>

      <section className="g-card">
        <h3>5. 저장하고 다시 쓰기</h3>
        <ul className="g-list">
          <li><b>💾 저장</b> — 테스터에서 만든 요청을 보관. <b>📁 저장된 API</b> 목록에서 다시 불러옵니다.</li>
          <li><b>폴더</b> — 목록에서 항목의 <b>폴더</b> 버튼으로 분류할 수 있어요.</li>
          <li><b>🕘 최근</b> — 전송한 요청은 <b>자동으로 DB에 기록</b>되어, 다른 날·다른 기기에서도 다시 볼 수 있습니다.</li>
          <li><b>cURL 복사</b> — 만든 요청을 cURL 명령으로 복사해서 동료에게 공유할 수 있어요.</li>
        </ul>
      </section>

      <section className="g-card">
        <h3>6. 인증(로그인) 도와주는 기능들</h3>
        <ul className="g-list">
          <li><b>🍪 세션</b> — 로그인 쿠키를 사이트(도메인)별로 저장하면, 그 사이트 요청에 <b>자동으로</b> 붙습니다.</li>
          <li><b>🔑 API 키</b> — 토큰/키를 저장해두고 테스터에서 골라 넣습니다. (Bearer / 헤더 / 쿼리)</li>
          <li><b>🧩 환경변수</b> — 예: <code>baseUrl = https://api.example.com</code> 저장 후, 주소칸에 <code>{'{{baseUrl}}/users'}</code> 처럼 사용.</li>
        </ul>
      </section>

      <section className="g-card">
        <h3>❓ 자주 묻는 질문</h3>
        <p><b>로그인했는데 자꾸 로그인 화면이 나와요.</b><br/>
          → 쿠키 하나만 넣지 말고 <b>Copy as cURL</b>로 통째로 가져오세요. 그리고 내부망이면 <b>💻 로컬</b>로 보내야 합니다.</p>
        <p><b>“대상 사이트에 접근할 수 없습니다”가 떠요.</b><br/>
          → 내부망/VPN 사이트예요. 4번(로컬)으로 하세요.</p>
        <p><b>“탐지된 API 엔드포인트가 없습니다”가 떠요.</b><br/>
          → 그 사이트가 옛날 방식(서버가 화면을 통째로 그림)이라 그래요. 3번처럼 F12로 직접 찾는 게 정확합니다.</p>
        <p><b>빨간 403/401이 나와요.</b><br/>
          → 권한/로그인 문제예요. 세션(쿠키)이 유효한지, 같은 환경(로컬)에서 보냈는지 확인하세요.</p>
      </section>
    </div>
  )
}
