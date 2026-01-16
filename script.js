const KAKAO_CHAT_URL = "https://pf.kakao.com/"; 
// script.js
// 모바일에서 "누락 없이" 끝까지 가도록: 한 화면 한 질문 + 다음 버튼은 선택해야 활성화
// 로컬 저장(localStorage)로 새로고침해도 유지

const STORAGE_KEY = "coking_estimator_v1";

const W = (n) => new Intl.NumberFormat("ko-KR").format(n) + "원";

// 평형 가이드 테이블 (요청하신 구조)
const areaTable = [
  { label: "25평대", area: 25, per: 25000, total: 625000 },
  { label: "35평대", area: 35, per: 24000, total: 840000 },
  { label: "45평대", area: 45, per: 23000, total: 1035000 },
  { label: "55평대", area: 55, per: 22000, total: 1210000 },
];

// 질문 정의(1~8)
const steps = [
  {
    key: "region",
    title: "1) 시공 지역",
    hint: "대구/경산만 진행합니다. 기타 지역은 시공이 어렵습니다.",
    options: [
      { value: "대구", text: "대구", tag: "가능" },
      { value: "경산", text: "경산", tag: "가능" },
      { value: "기타", text: "기타 지역", tag: "불가", danger: true, note: "대구/경산 외 지역은 시공이 어렵습니다." },
    ],
    guard: (ans) => (ans === "기타" ? "대구/경산 외 지역은 시공이 어렵습니다." : null),
  },
  {
    key: "year",
    title: "2) 아파트 준공 연도",
    hint: "노후 아파트는 보수 범위가 확대될 수 있어요.",
    options: [
      { value: "1990~2003", text: "1990 ~ 2003년", tag: "노후", note: "노후화로 보수 범위 확대 가능" },
      { value: "2004~2015", text: "2004 ~ 2015년", tag: "일반" },
    ],
  },
  {
    key: "window",
    title: "3) 샷시 종류",
    hint: "샷시 종류에 따라 작업 난이도가 달라질 수 있습니다.",
    options: [
      { value: "알루미늄", text: "알루미늄 샷시", tag: "" },
      { value: "PVC", text: "하이샷시 (PVC)", tag: "" },
    ],
  },
  {
    key: "buildingFloors",
    title: "4) 아파트 전체 층수 (로프 기준)",
    hint: "전체 층수(최고층)가 작업 난이도에 가장 영향이 큽니다.",
    options: [
      { value: "15이하", text: "15층 이하", tag: "" },
      { value: "16~20", text: "16 ~ 20층", tag: "" },
      { value: "21~25", text: "21 ~ 25층", tag: "" },
      { value: "26이상", text: "26층 이상", tag: "불가", danger: true, note: "26층 이상은 시공이 어렵습니다." },
    ],
    guard: (ans) => (ans === "26이상" ? "26층 이상(최고층 기준)은 시공이 어렵습니다." : null),
  },
  {
    key: "unitPos",
    title: "5) 해당 세대 위치",
    hint: "세대 위치(저층/중간/탑층 인접)를 선택해주세요.",
    options: [
      { value: "저층", text: "저층 (1 ~ 5층)", tag: "" },
      { value: "중간층", text: "중간층", tag: "" },
      { value: "탑층인접", text: "탑층 또는 탑층 인접", tag: "" },
    ],
  },
  {
    key: "areaBand",
    title: "6) 평형 선택",
    hint: "평형이 커질수록 평당 단가는 자동 조정됩니다.",
    options: areaTable.map((r) => ({
      value: r.label,
      text: r.label,
      tag: `${Math.round(r.total / 10000)}만원대`,
      note: `가이드 금액: ${W(r.total)} (평당 ${W(r.per)})`,
    })),
  },
  {
    key: "leakPos",
    title: "7) 누수/증상 위치",
    hint: "현재 가장 문제가 되는 위치를 선택해주세요.",
    options: [
      { value: "우리집천장", text: "우리집 천장", tag: "" },
      { value: "우리집바닥", text: "우리집 바닥", tag: "" },
      { value: "아랫집천장", text: "아랫집 천장", tag: "" },
    ],
  },
  {
    key: "history",
    title: "8) 실리콘 시공 이력",
    hint: "기존 코킹이 여러 번 되어 있으면 추가 작업 가능성이 있습니다.",
    options: [
      { value: "준공그대로", text: "준공 상태 그대로", tag: "" },
      { value: "1회", text: "코킹 시공 1회 있음", tag: "+", note: "추가 작업 가능성" },
      { value: "2회이상", text: "코킹 시공 2회 이상 있음", tag: "++", note: "추가 작업 가능성(높음)" },
    ],
  },
];

const state = {
  step: 0,
  answers: {},
};

// ===== DOM =====
const stepLabel = document.getElementById("stepLabel");
const progressFill = document.getElementById("progressFill");
const qTitle = document.getElementById("qTitle");
const qHint = document.getElementById("qHint");
const optionsEl = document.getElementById("options");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const resetBtn = document.getElementById("resetBtn");
const guardBox = document.getElementById("guardBox");

const summaryMini = document.getElementById("summaryMini");
const basePrice = document.getElementById("basePrice");
const addNote = document.getElementById("addNote");
const rangePrice = document.getElementById("rangePrice");
const copyBtn = document.getElementById("copyBtn");
const kakaoBtn = document.getElementById("kakaoBtn");

// TODO: 네 카톡 채널 링크로 교체 (예: https://pf.kakao.com/_xxxx/chat )
const KAKAO_CHAT_URL = "https://pf.kakao.com/"; // <- 여기에 채널 URL 넣기
kakaoBtn.href = KAKAO_CHAT_URL;

// ===== Helpers =====
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return;
  try{
    const parsed = JSON.parse(raw);
    if(parsed && typeof parsed === "object"){
      state.step = Number.isInteger(parsed.step) ? parsed.step : 0;
      state.answers = parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {};
    }
  }catch{ /* ignore */ }
}

function setGuard(message){
  if(message){
    guardBox.hidden = false;
    guardBox.textContent = message;
  }else{
    guardBox.hidden = true;
    guardBox.textContent = "";
  }
}

function currentStep(){
  return steps[state.step];
}

function answerForStep(stepKey){
  return state.answers[stepKey] ?? null;
}

function formatMiniSummary(){
  const a = state.answers;
  const parts = [];
  if(a.region) parts.push(a.region);
  if(a.year) parts.push(a.year.replace("~", " ~ "));
  if(a.buildingFloors) parts.push(a.buildingFloors);
  if(a.areaBand) parts.push(a.areaBand);
  return parts.length ? parts.join(" · ") : "아직 선택 전";
}

function getAreaRow(){
  const label = state.answers.areaBand;
  if(!label) return null;
  return areaTable.find(r => r.label === label) ?? null;
}

// 추가작업 가능성(가이드) — 너무 공격적으로 금액 확정하지 않고 “범위”로만
function computeAddRange(){
  // 기본: 0 ~ 0
  let min = 0, max = 0;

  // 노후 연식은 추가 가능성
  if(state.answers.year === "1990~2003"){
    min += 50000; max += 100000; // 가이드: +5~10
  }

  // 실리콘 이력
  if(state.answers.history === "1회"){
    min += 50000; max += 80000;
  } else if(state.answers.history === "2회이상"){
    min += 80000; max += 120000;
  }

  // 최고층(전체 층수)
  if(state.answers.buildingFloors === "21~25"){
    min += 30000; max += 60000;
  } else if(state.answers.buildingFloors === "16~20"){
    min += 10000; max += 30000;
  }

  // 탑층 인접은 작업 난이도 체감(가이드 소폭)
  if(state.answers.unitPos === "탑층인접"){
    min += 10000; max += 30000;
  }

  return { min, max };
}

function updatePriceBox(){
  summaryMini.textContent = formatMiniSummary();

  const row = getAreaRow();
  if(!row){
    basePrice.textContent = "-";
    addNote.textContent = "-";
    rangePrice.textContent = "-";
    return;
  }

  basePrice.textContent = `${W(row.total)} (가이드)`;

  const add = computeAddRange();
  const addText = (add.min === 0 && add.max === 0)
    ? "추가 없음(가이드)"
    : `+ ${Math.round(add.min/10000)} ~ ${Math.round(add.max/10000)}만원 가능`;

  addNote.textContent = addText;

  const minTotal = row.total + add.min;
  const maxTotal = row.total + add.max;

  rangePrice.textContent = `${Math.round(minTotal/10000)} ~ ${Math.round(maxTotal/10000)}만원대`;

  // 컷 조건이면 안내 강조
  const guardMsg =
    (state.answers.region === "기타")
      ? "대구/경산 외 지역은 시공이 어렵습니다."
      : (state.answers.buildingFloors === "26이상")
        ? "26층 이상(최고층 기준)은 시공이 어렵습니다."
        : null;

  setGuard(guardMsg);
}

function render(){
  const s = currentStep();
  const totalSteps = steps.length;

  stepLabel.textContent = `${state.step + 1} / ${totalSteps}`;
  progressFill.style.width = `${((state.step + 1) / totalSteps) * 100}%`;

  qTitle.textContent = s.title;
  qHint.textContent = s.hint ?? "";

  optionsEl.innerHTML = "";
  const selected = answerForStep(s.key);

  for(const opt of s.options){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "opt" + (selected === opt.value ? " opt--selected" : "");
    btn.setAttribute("data-value", opt.value);

    const left = document.createElement("div");
    left.innerHTML = `<div>${escapeHtml(opt.text)}${opt.note ? `<small>${escapeHtml(opt.note)}</small>` : ""}</div>`;

    const right = document.createElement("div");
    right.className = "tag";
    if(opt.danger){
      right.style.borderColor = "rgba(255,93,93,.55)";
      right.style.color = "#ffd6d6";
    }
    right.textContent = opt.tag || "선택";

    btn.appendChild(left);
    btn.appendChild(right);

    btn.addEventListener("click", () => {
      state.answers[s.key] = opt.value;
      saveState();

      // guard 메시지 업데이트
      const msg = typeof s.guard === "function" ? s.guard(opt.value) : null;
      setGuard(msg);

      // 다음 버튼 활성화
      nextBtn.disabled = false;

      // 선택 반영
      render();
      updatePriceBox();
    });

    optionsEl.appendChild(btn);
  }

  prevBtn.disabled = state.step === 0;

  // 선택이 있어야 다음 활성화
  nextBtn.disabled = !answerForStep(s.key);

  // 컷 조건은 “다음으로 갈 수는 있지만” 최종에 확실히 안내(필터링)
  const guardMsg = typeof s.guard === "function" ? s.guard(selected) : null;
  setGuard(guardMsg);

  updatePriceBox();
}

function next(){
  if(state.step < steps.length - 1){
    state.step += 1;
    saveState();
    render();
    scrollToTopCard();
  }else{
    // 마지막 스텝이면 요약 영역으로 안내
    scrollToSummary();
  }
}

function prev(){
  if(state.step > 0){
    state.step -= 1;
    saveState();
    render();
    scrollToTopCard();
  }
}

function resetAll(){
  state.step = 0;
  state.answers = {};
  saveState();
  render();
  scrollToTopCard();
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function scrollToTopCard(){
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollToSummary(){
  const el = document.querySelector(".summary");
  if(el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildConsultText(){
  const a = state.answers;
  const row = getAreaRow();
  const add = computeAddRange();
  const minTotal = row ? row.total + add.min : null;
  const maxTotal = row ? row.total + add.max : null;

  const parts = [];
  parts.push(`(자동견적 입력 요약)`);
  if(a.region) parts.push(`- 지역: ${a.region}`);
  if(a.year) parts.push(`- 준공: ${a.year}`);
  if(a.window) parts.push(`- 샷시: ${a.window}`);
  if(a.buildingFloors) parts.push(`- 전체층수: ${a.buildingFloors}`);
  if(a.unitPos) parts.push(`- 세대위치: ${a.unitPos}`);
  if(a.areaBand) parts.push(`- 평형: ${a.areaBand}`);
  if(a.leakPos) parts.push(`- 누수위치: ${a.leakPos}`);
  if(a.history) parts.push(`- 시공이력: ${a.history}`);

  if(row && minTotal != null && maxTotal != null){
    parts.push(`- 예상범위(참고): ${Math.round(minTotal/10000)}~${Math.round(maxTotal/10000)}만원대`);
  }

  parts.push("");
  parts.push("사진(필수) : 누수 위치 / 외부 실리콘 상태");
  parts.push("주소(선택) : 외관·로드뷰 확인용");
  parts.push("");
  parts.push("※ 최종 금액/시공 여부는 사진 확인 후 안내됩니다.");

  return parts.join("\n");
}

// ===== 이벤트 =====
nextBtn.addEventListener("click", next);
prevBtn.addEventListener("click", prev);
resetBtn.addEventListener("click", resetAll);

copyBtn.addEventListener("click", async () => {
  const text = buildConsultText();
  try{
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "복사 완료!";
    setTimeout(()=> (copyBtn.textContent = "상담 예시 복사"), 1200);
  }catch{
    alert("복사에 실패했습니다. 모바일 브라우저 설정을 확인해주세요.");
  }
});

// 초기 로드
loadState();
render();
