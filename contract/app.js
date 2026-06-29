const AGENCY = "통영시 청년센터";
const RECIPIENT = "통영시 청년센터장 귀하";

const documentGroups = [
  {
    title: "계약서류",
    documents: [
      "용역표준계약서",
      "용역계약 이행 승낙사항",
      "계약보증금납부서",
      "계약보증금지급각서",
      "사용인감계",
      "청렴계약이행서약서",
      "수의계약각서",
      "조세포탈서약서",
      "안전보건관리준수서약서",
      "제한여부확인서",
      "견적서"
    ]
  },
  {
    title: "착수서류",
    documents: ["착수계", "현장대리인계", "참여자명단", "재직증명서", "예정공정표", "착수내역서", "보안각서", "보안각서(현장대리인)"]
  },
  {
    title: "완료서류",
    documents: ["완료계"]
  },
  {
    title: "청구서류",
    documents: ["청구서"]
  }
];

const documents = getDocumentGroups().flatMap((group) => group.documents);

const state = {
  seals: {
    registered: "",
    use: ""
  },
  selectedDocuments: new Set(documents),
  estimateReferenceBalance: null
};

const form = document.querySelector("#contractForm");
const printArea = document.querySelector("#printArea");
const missingBox = document.querySelector("#missingBox");
const documentNav = document.querySelector("#documentNav");
const documentToggles = document.querySelector("#documentToggles");
const inputTabs = document.querySelectorAll("[data-input-tab]");
const inputPanels = document.querySelectorAll("[data-input-panel]");
const estimateUnitGroups = [
  { label: "사람", units: ["명"] },
  { label: "횟수·기간", units: ["회", "일", "시간", "월"] },
  { label: "수량·물품", units: ["개", "매", "장", "부", "권", "대", "통"] },
  { label: "장소·묶음", units: ["개소", "건", "식", "세트", "박스"] }
];
const estimateUnits = estimateUnitGroups.flatMap((group) => group.units);

function getDocumentGroups(data = null) {
  return documentGroups.map((group) => {
    const documentsForGroup = [...group.documents];
    if (group.title === "착수서류" && data?.participants.participant) {
      const index = documentsForGroup.indexOf("재직증명서");
      documentsForGroup.splice(index + 1, 0, "재직증명서(참여자)");
    }
    return { ...group, documents: documentsForGroup };
  });
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === id));
  document.querySelectorAll(".step-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === id);
  });

  if (id === "preview") {
    renderDocumentToggles();
    renderDocuments();
  }
}

function showInputTab(id) {
  inputTabs.forEach((tab) => {
    const isActive = tab.dataset.inputTab === id;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  inputPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.inputPanel === id);
  });
}

function getData() {
  const data = Object.fromEntries(new FormData(form).entries());
  const amount = parseMoney(data.amount);
  const duration = Number(data.duration || 0);
  const guarantee = Math.floor(amount * 0.05);
  const endDate = calculateEndDate(data.startDate, duration);

  return {
    agency: AGENCY,
    contractor: {
      company: data.company || "",
      address: data.address || "",
      ceo: data.ceo || "",
      businessType: data.businessType || "",
      businessEntityType: data.businessEntityType || "",
      businessNumber: data.businessNumber || "",
      phone: data.phone || "",
      contractContact: data.contractContact || "",
      contractContactPhone: data.contractContactPhone || "",
      invoiceEmail: data.invoiceEmail || "",
      accountingContact: data.accountingContact || ""
    },
    contract: {
      contractNo: data.contractNo || "",
      type: data.contractType || "",
      title: data.contractTitle || "",
      date: data.contractDate || "",
      amount,
      guarantee
    },
    period: {
      startDate: data.startDate || "",
      duration,
      endDate
    },
    schedule: getScheduleData(data),
    participants: {
      participant: data.participant || "",
      participantRole: data.participantRole || "",
      participantTask: data.participantTask || "",
      agent: data.agent || "",
      agentRole: data.agentRole || "",
      agentTask: data.agentTask || ""
    },
    claim: {
      amount: parseMoney(data.claimAmount),
      advanceAmount: parseMoney(data.advanceAmount),
      bankName: data.bankName || "",
      bankAccount: data.bankAccount || "",
      accountHolder: data.accountHolder || ""
    },
    estimate: getEstimateData(data),
    seal: state.seals.use,
    seals: {
      registered: state.seals.registered,
      use: state.seals.use
    }
  };
}

function getEstimateData(formData) {
  const total = parseMoney(formData.estimateTotal);
  const supply = total ? Math.round(total / 1.1 / 10) * 10 : 0;
  const vat = total ? total - supply : 0;
  const laborRows = getEstimateRows("labor");
  const operationRows = getEstimateRows("operation");
  const laborTotal = sumEstimateRows(laborRows);
  const operationTotal = sumEstimateRows(operationRows);
  const managementFee = parseMoney(formData.managementFee);
  const profitFee = parseMoney(formData.profitFee);
  const subtotal = laborTotal + operationTotal;
  const managementLimit = Math.floor(subtotal * 0.05);
  const profitBase = subtotal + managementFee;
  const profitLimit = Math.floor(profitBase * 0.1);
  const finalSupply = subtotal + managementFee + profitFee;

  return {
    total,
    supply,
    vat,
    laborRows,
    operationRows,
    laborTotal,
    operationTotal,
    managementFee,
    profitFee,
    subtotal,
    managementLimit,
    profitBase,
    profitLimit,
    finalSupply,
    balance: total ? supply - finalSupply : 0,
    managementRate: subtotal ? (managementFee / subtotal) * 100 : 0,
    profitRate: profitBase ? (profitFee / profitBase) * 100 : 0
  };
}

function getScheduleData(formData) {
  const totalSteps = Math.min(Math.max(Number(formData.scheduleTotalSteps || 10), 1), 20);
  const rows = [...document.querySelectorAll("[data-schedule-row]")]
    .map((row) => {
      const field = (name) => row.querySelector(`[data-schedule-field="${name}"]`)?.value.trim() || "";
      const start = Math.min(Math.max(Number(field("start") || 1), 1), totalSteps);
      const end = Math.min(Math.max(Number(field("end") || start), start), totalSteps);
      return {
        task: field("task"),
        start,
        end,
        note: field("note")
      };
    })
    .filter((row) => row.task);

  return {
    unit: formData.scheduleUnit || "주차",
    totalSteps,
    rows
  };
}

function getEstimateRows(type) {
  return [...document.querySelectorAll(`[data-estimate-row="${type}"]`)]
    .map((row) => {
      const field = (name) => row.querySelector(`[data-estimate-field="${name}"]`)?.value || "";
      const item = {
        type,
        detail: field("detail"),
        qty1: parseMoney(field("qty1")),
        unit1: field("unit1"),
        qty2: parseMoney(field("qty2")),
        unit2: field("unit2"),
        qty3: parseMoney(field("qty3")),
        unit3: field("unit3"),
        unitPrice: parseMoney(field("unitPrice"))
      };
      return { ...item, amount: estimateRowAmount(item) };
    })
    .filter((row) => row.detail || row.amount);
}

function estimateRowAmount(row) {
  const quantities = [row.qty1, row.qty2, row.qty3].filter((value) => value > 0);
  const multiplier = quantities.length ? quantities.reduce((total, value) => total * value, 1) : 1;
  return multiplier * row.unitPrice;
}

function sumEstimateRows(rows) {
  return rows.reduce((total, row) => total + row.amount, 0);
}

function markMissingEstimateUnits() {
  document.querySelectorAll("[data-estimate-row]").forEach((row) => {
    [1, 2, 3].forEach((index) => {
      const qty = row.querySelector(`[data-estimate-field="qty${index}"]`);
      const unit = row.querySelector(`[data-estimate-field="unit${index}"]`);
      if (!qty || !unit) return;
      const hasQuantity = parseMoney(qty.value) > 0;
      unit.classList.toggle("unit-missing", hasQuantity && !unit.value);
    });
  });
}

function calculateEndDate(startDate, duration) {
  if (!startDate || !duration) return "";
  const date = new Date(`${startDate}T00:00:00`);
  date.setDate(date.getDate() + duration - 1);
  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function monthCountInclusive(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || end < start) return 0;
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
}

function scheduleStepLabels(data) {
  const schedule = data.schedule;
  const steps = Array.from({ length: schedule.totalSteps }, (_, index) => index + 1);
  if (schedule.unit !== "월") return steps.map(String);

  const start = parseDate(data.period.startDate);
  if (!start) return steps.map((step) => `${step}월`);

  const months = steps.map((_, index) => addMonths(start, index));
  const hasMultipleYears = new Set(months.map((date) => date.getFullYear())).size > 1;
  return months.map((date) => {
    const month = date.getMonth() + 1;
    return hasMultipleYears ? `${date.getFullYear()}.${month}` : `${month}월`;
  });
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function formatDateDots(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}.`;
}

function formatContractPeriod(data) {
  const start = formatDate(data.period.startDate);
  const end = formatDate(data.period.endDate);
  const duration = data.period.duration ? ` (총 ${data.period.duration}일)` : "";
  if (!start && !end) return duration.trim();
  return `${start} 부터 ${end} 까지${duration}`;
}

function formatParticipantPeriod(data) {
  const start = formatDateDots(data.period.startDate);
  const end = formatDateDots(data.period.endDate);
  return `${start} ~ ${end}`;
}

function parseMoney(value) {
  return Number(String(value || "").replace(/[^\d]/g, "")) || 0;
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function amountInKorean(value) {
  const units = ["", "만", "억", "조"];
  let number = Math.floor(Number(value || 0));
  if (!number) return "영";
  const chunks = [];
  while (number > 0) {
    chunks.push(number % 10000);
    number = Math.floor(number / 10000);
  }
  return chunks
    .map((chunk, index) => (chunk ? `${chunkToKorean(chunk)}${units[index]}` : ""))
    .reverse()
    .join(" ");
}

function chunkToKorean(value) {
  const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const units = ["", "십", "백", "천"];
  return String(value)
    .padStart(4, "0")
    .split("")
    .map((digit, index) => {
      const n = Number(digit);
      if (!n) return "";
      const unit = units[3 - index];
      return `${n === 1 && unit ? "" : digits[n]}${unit}`;
    })
    .join("");
}

function syncComputedFields() {
  formatMoneyInputs();
  applyScheduleRecommendation();
  const data = getData();
  form.elements.guarantee.value = data.contract.amount ? formatMoney(data.contract.guarantee) : "";
  form.elements.endDate.value = data.period.endDate ? formatDate(data.period.endDate) : "";
  syncAmountDisplays(data);
  syncEstimateSummary(data);
  markMissingEstimateUnits();
}

function recommendScheduleScale(duration, startDate = "") {
  const days = Number(duration || 0);
  if (!days) return { unit: "주차", totalSteps: 10, label: "공기(일)를 입력하면 기준과 칸 수를 추천합니다." };
  if (days <= 10) {
    return { unit: "일", totalSteps: Math.min(days, 20), label: `${days}일 공기 기준으로 일 단위를 추천합니다.` };
  }
  if (days <= 60) {
    const weeks = Math.ceil(days / 7);
    return { unit: "주차", totalSteps: Math.min(weeks, 20), label: `${days}일 공기 기준으로 주차 단위를 추천합니다.` };
  }
  const endDate = calculateEndDate(startDate, days);
  const months = monthCountInclusive(startDate, endDate) || Math.ceil(days / 30);
  return { unit: "월", totalSteps: Math.min(months, 20), label: `${days}일 공기 기준으로 계약기간의 실제 월 표시를 추천합니다.` };
}

function applyScheduleRecommendation() {
  const durationInput = form.elements.duration;
  const unitInput = form.elements.scheduleUnit;
  const totalStepsInput = form.elements.scheduleTotalSteps;
  const note = document.querySelector("[data-schedule-recommendation]");
  if (!durationInput || !unitInput || !totalStepsInput) return;
  const recommendation = recommendScheduleScale(durationInput.value, form.elements.startDate?.value);
  const recommendationKey = `${durationInput.value || ""}|${form.elements.startDate?.value || ""}`;
  if (durationInput.dataset.lastRecommendedDuration !== recommendationKey) {
    unitInput.value = recommendation.unit;
    totalStepsInput.value = recommendation.totalSteps;
    durationInput.dataset.lastRecommendedDuration = recommendationKey;
  }
  if (note) note.textContent = `${recommendation.label} 필요하면 기준과 전체 칸 수는 직접 수정할 수 있습니다.`;
}

function alertEstimateFeeLimit(inputName) {
  const data = getData();
  const checks = {
    managementFee: [data.estimate.managementFee, data.estimate.managementLimit],
    profitFee: [data.estimate.profitFee, data.estimate.profitLimit]
  };
  const [value, limit] = checks[inputName] || [];
  if (value > limit) {
    alert(`한도 금액 ${formatMoney(limit)}을 초과하였습니다`);
    form.elements[inputName].value = "";
    syncComputedFields();
  }
}

function formatMoneyInputs() {
  ["amount", "claimAmount", "advanceAmount", "estimateTotal", "managementFee", "profitFee"].forEach((name) => {
    const input = form.elements[name];
    if (!input) return;
    const value = parseMoney(input.value);
    input.value = value ? value.toLocaleString("ko-KR") : "";
  });

  document.querySelectorAll('[data-estimate-field="qty1"], [data-estimate-field="qty2"], [data-estimate-field="qty3"], [data-estimate-field="unitPrice"]').forEach((input) => {
    const value = parseMoney(input.value);
    input.value = value ? value.toLocaleString("ko-KR") : "";
  });
}

function syncAmountDisplays(data) {
  const values = {
    amount: data.contract.amount,
    guarantee: data.contract.guarantee,
    claimAmount: data.claim.amount,
    advanceAmount: data.claim.advanceAmount
  };

  Object.entries(values).forEach(([name, value]) => {
    const target = document.querySelector(`[data-korean-for="${name}"]`);
    if (!target) return;
    target.textContent = value ? `금 ${amountInKorean(value)}원` : "";
  });
}

function syncEstimateSummary(data) {
  const setText = (selector, value) => {
    const target = document.querySelector(selector);
    if (target) target.textContent = formatMoney(value);
  };
  setText("[data-estimate-supply]", data.estimate.supply);
  setText("[data-estimate-vat]", data.estimate.vat);
  setText("[data-estimate-subtotal]", data.estimate.subtotal);
  setText("[data-estimate-management-limit]", data.estimate.managementLimit);
  setText("[data-estimate-profit-limit]", data.estimate.profitLimit);
  setText("[data-estimate-management-used]", data.estimate.managementFee);
  setText("[data-estimate-profit-used]", data.estimate.profitFee);
  setText("[data-estimate-management-remaining]", Math.max(data.estimate.managementLimit - data.estimate.managementFee, 0));
  setText("[data-estimate-profit-remaining]", Math.max(data.estimate.profitLimit - data.estimate.profitFee, 0));
  setText("[data-estimate-final-supply]", data.estimate.finalSupply);
  const balanceCard = document.querySelector("[data-estimate-balance-card]");
  const balanceMessage = document.querySelector("[data-estimate-balance-message]");
  if (balanceCard && balanceMessage) {
    const hasTotal = data.estimate.total > 0;
    const hasFeeInput = data.estimate.managementFee > 0 || data.estimate.profitFee > 0;
    const hasReferenceBalance = state.estimateReferenceBalance !== null;
    const displayBalance = hasReferenceBalance && data.estimate.balance !== 0 ? state.estimateReferenceBalance : data.estimate.balance;
    const shouldShowBalance = hasTotal && (hasFeeInput || hasReferenceBalance);
    balanceCard.classList.toggle("empty", !shouldShowBalance);
    balanceCard.classList.toggle("over", shouldShowBalance && displayBalance < 0);
    balanceCard.classList.toggle("matched", shouldShowBalance && displayBalance === 0);
    balanceMessage.innerHTML = !shouldShowBalance
      ? "<span>E. 최종 차액</span><em>일반관리비와 기업이윤을 입력하면 계산됩니다.</em>"
      : displayBalance > 0
        ? `<span>E. 최종 차액</span><strong class="adjustment-line">입력한 총사업비와 같아지려면 <b>+${formatMoney(displayBalance)}</b> 만큼 조정이 필요합니다.</strong><em>${estimateAdjustmentHint(data.estimate, displayBalance)}</em>`
      : displayBalance < 0
          ? `<span>E. 최종 차액</span><strong class="adjustment-line">입력한 총사업비와 같아지려면 <b>-${formatMoney(Math.abs(displayBalance))}</b> 만큼 조정이 필요합니다.</strong><em>일반관리비 또는 기업이윤에서 ${formatMoney(Math.abs(displayBalance))}을 줄이면 0원이 됩니다.</em>`
          : "<span>E. 최종 차액</span><strong>0원</strong><em>공급가액과 입력 금액이 맞습니다.</em>";
  }

}

function estimateAdjustmentHint(estimate, balanceValue = estimate.balance) {
  const balance = Math.max(balanceValue, 0);
  const managementRemaining = Math.max(estimate.managementLimit - estimate.managementFee, 0);
  const profitRemaining = Math.max(estimate.profitLimit - estimate.profitFee, 0);
  if (!balance) return "";
  if (balance <= profitRemaining) return `기업이윤에 ${formatMoney(balance)}을 더 입력하면 0원이 됩니다.`;
  if (balance <= managementRemaining) return `일반관리비에 ${formatMoney(balance)}을 더 입력하면 0원이 됩니다.`;
  if (balance <= managementRemaining + profitRemaining) {
    return `일반관리비와 기업이윤에 나누어 ${formatMoney(balance)}을 더 입력하면 0원이 됩니다.`;
  }
  return `남은 한도 안에서는 ${formatMoney(balance)}을 모두 채우기 어렵습니다. 인건비 또는 운영비 조정이 필요합니다.`;
}

function requiredMissing(data) {
  const checks = [
    ["업체명", data.contractor.company],
    ["주소", data.contractor.address],
    ["대표자", data.contractor.ceo],
    ["사업자등록번호", data.contractor.businessNumber],
    ["세금계산서 수신 이메일", data.contractor.invoiceEmail],
    ["계약명", data.contract.title],
    ["계약일자", data.contract.date],
    ["계약금액", data.contract.amount],
    ["착수일자", data.period.startDate],
    ["공기", data.period.duration]
  ];
  return checks.filter(([, value]) => !value).map(([label]) => label);
}

function renderDocumentToggles() {
  const groups = getDocumentGroups(getData());
  groups.flatMap((group) => group.documents).forEach((name) => state.selectedDocuments.add(name));
  documentToggles.innerHTML = groups
    .map(
      (group, index) => `
        <section class="document-toggle-group">
          <h4><span class="title-badge">${index + 1}</span> ${group.title}</h4>
          <div class="toggle-grid">
            ${group.documents
              .map(
                (name) => `
                  <label>
                    <input type="checkbox" value="${name}" ${state.selectedDocuments.has(name) ? "checked" : ""} />
                    <span>${name}</span>
                  </label>
                `
              )
              .join("")}
          </div>
        </section>
      `
    )
    .join("");

  documentToggles.addEventListener("change", (event) => {
    if (event.target.type !== "checkbox") return;
    if (event.target.checked) state.selectedDocuments.add(event.target.value);
    else state.selectedDocuments.delete(event.target.value);
    renderDocuments();
  });
}

function renderDocuments() {
  const data = getData();
  const missing = requiredMissing(data);
  if (missing.length) {
    missingBox.hidden = false;
    missingBox.textContent = `필수 입력값을 확인해주세요: ${missing.join(", ")}`;
  } else {
    missingBox.hidden = true;
  }

  const groups = getDocumentGroups(data);
  const renderList = groups.flatMap((group) => group.documents);
  const selectedList = renderList.filter((name) => state.selectedDocuments.has(name));
  printArea.innerHTML = selectedList
    .map((name) => renderDocPage(name, data))
    .join("");
  renderDocumentNav(groups);
}

function renderSingleDocument(name) {
  const data = getData();
  printArea.innerHTML = renderDocPage(name, data);
  renderDocumentNav([{ title: "견적서", documents: [name] }]);
}

function documentId(name) {
  return `doc-${name.replace(/[^가-힣a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function renderDocumentNav(groups) {
  documentNav.innerHTML = `
    <strong>문서 바로가기</strong>
    <a class="document-nav-top" href="#preview">맨 위로 이동</a>
    <nav>
      ${groups
        .map((group, index) => {
          const names = group.documents.filter((name) => state.selectedDocuments.has(name));
          if (!names.length) return "";
          return `
            <section class="document-nav-group">
              <h4><span>${index + 1}</span>${group.title}</h4>
              ${names.map((name) => `<a href="#${documentId(name)}">${name}</a>`).join("")}
            </section>
          `;
        })
        .join("")}
    </nav>
  `;
}

function sealMarkup(data, seal = data.seals?.use || data.seal) {
  if (!seal) return `<span class="seal-slot"></span>`;
  return `<span class="seal-slot"><img src="${seal}" alt="인감" /></span>`;
}

function commonSignature(data) {
  return contractorSignatureTable(data);
}

function pledgeSignature(data, signerLabel = "대 표 자") {
  return contractorSignatureTable(data, signerLabel);
}

function contractorSignatureTable(data, signerLabel = "대 표 자") {
  const signer = signerLabel.includes("현장대리인") ? data.participants.agent || data.contractor.ceo : data.contractor.ceo;
  return `
    <div class="doc-date">${formatDate(data.contract.date) || "　　　　년 　　월 　　일"}</div>
    <table class="doc-table signature-table party-signature">
      <tbody>
        <tr><th>상호명 :</th><td>${data.contractor.company || ""}</td></tr>
        <tr><th>사업자등록번호 :</th><td>${data.contractor.businessNumber || ""}</td></tr>
        <tr><th>주　　소 :</th><td>${data.contractor.address || ""}</td></tr>
        <tr><th>${signerLabel} :</th><td>${signer || ""} ${sealMarkup(data)}</td></tr>
      </tbody>
    </table>
    <div class="recipient">${RECIPIENT}</div>
  `;
}

function contractInfoTable(data, rows = [], options = {}) {
  const { includeAmount = true, includePeriod = true } = options;
  const contractNoRow = data.contract.contractNo
    ? `<tr><th>계약번호</th><td>${data.contract.contractNo}</td><th>계약일자</th><td>${formatDate(data.contract.date)}</td></tr>`
    : `<tr><th>계약일자</th><td colspan="3">${formatDate(data.contract.date)}</td></tr>`;
  const amountRow = includeAmount
    ? `<tr><th>계약금액</th><td colspan="3">${formatMoney(data.contract.amount)} (금 ${amountInKorean(data.contract.amount)}원)</td></tr>`
    : "";
  const extraRows = rows
    .map(([a, b, c = "", d = ""]) =>
      c || d ? `<tr><th>${a}</th><td>${b}</td><th>${c}</th><td>${d}</td></tr>` : `<tr><th>${a}</th><td colspan="3">${b}</td></tr>`
    )
    .join("");

  return `
    <table class="doc-table official-table">
      <colgroup>
        <col class="label-col" />
        <col class="value-col" />
        <col class="label-col" />
        <col class="value-col" />
      </colgroup>
      <tbody>
        <tr><th>계약건명</th><td colspan="3">${data.contract.title || ""}</td></tr>
        ${contractNoRow}
        ${amountRow}
        ${includePeriod ? `<tr><th>계약이행기간</th><td colspan="3">${formatContractPeriod(data)}</td></tr>` : ""}
        ${extraRows}
      </tbody>
    </table>
  `;
}

function stampBox(title, seal = "", emptyText = "") {
  return `
    <div class="stamp-box">
      <div class="stamp-title">${title}</div>
      <div class="stamp-frame">${seal ? `<img src="${seal}" alt="${title}" />` : emptyText}</div>
    </div>
  `;
}

function restrictionRows() {
  return [
    "발주기관의 소속 고위공직자, 배우자, 고위공직자의 직계존속·비속 또는 생계를 같이하는 배우자의 직계존속·비속에 해당하는가?",
    "계약 업무를 법령상·사실상 담당하는 공직자, 배우자, 공직자의 직계존속·비속 또는 생계를 같이하는 배우자의 직계존속·비속에 해당하는가?",
    "발주기관(산하기관)의 감독기관 소속 고위공직자, 배우자, 고위공직자의 직계존속·비속 또는 생계를 같이하는 배우자의 직계존속·비속에 해당하는가?",
    "발주기관(자회사)의 모회사 소속 고위공직자, 배우자, 고위공직자의 직계존속·비속 또는 생계를 같이하는 배우자의 직계존속·비속에 해당하는가?",
    "상임위원회 위원의 국회의원, 배우자, 국회의원의 직계존속·비속 또는 생계를 같이하는 배우자의 직계존속·비속에 해당하는가?",
    "공공기관을 감사 또는 조사하는 지방의회의 의원, 배우자, 의원의 직계존속·비속 또는 생계를 같이하는 배우자의 직계존속·비속에 해당하는가?",
    "①부터 ⑥까지 어느 하나에 해당하는 사람이 대표자인 법인 또는 단체에 해당하는가?",
    "①부터 ⑥까지 어느 하나에 해당하는 사람과 특수한 관계의 사업자에 해당하는가?"
  ];
}

function entityTypeMarks(type) {
  return {
    individual: type === "individual" ? "[√] 개인" : "[ ] 개인",
    corporation: type === "corporation" ? "[√] 법인" : "[ ] 법인",
    group: type === "group" ? "[√] 단체" : "[ ] 단체",
    other: type === "other" ? "[√] 기타" : "[ ] 기타"
  };
}

function participantRows(data) {
  const period = formatParticipantPeriod(data);
  const rows = [
    `<tr><td>${data.participants.agent || data.contractor.ceo || ""}</td><td>${data.participants.agentRole || "현장대리인"}</td><td>${data.participants.agentTask || "계약 수행 총괄"}</td><td>${period}</td></tr>`
  ];

  if (data.participants.participant) {
    rows.push(
      `<tr><td>${data.participants.participant}</td><td>${data.participants.participantRole || "참여자"}</td><td>${data.participants.participantTask || data.contract.title || ""}</td><td>${period}</td></tr>`
    );
  }

  return rows.join("");
}

function claimAmount(data) {
  return data.claim.amount || data.contract.amount;
}

function estimateTotalAmount(data) {
  return data.estimate.total || data.contract.amount;
}

function estimateBasis(row) {
  return [
    row.qty1 ? `${row.qty1.toLocaleString("ko-KR")} ${row.unit1}`.trim() : "",
    row.qty2 ? `${row.qty2.toLocaleString("ko-KR")} ${row.unit2}`.trim() : "",
    row.qty3 ? `${row.qty3.toLocaleString("ko-KR")} ${row.unit3}`.trim() : ""
  ]
    .filter(Boolean)
    .join(" × ");
}

function estimateRowsHtml(rows, fallbackType) {
  if (!rows.length) {
    return `<tr><td>${fallbackType}</td><td></td><td></td><td></td><td class="money-cell">0원</td></tr>`;
  }
  return rows
    .map(
      (row, index) => `
        <tr>
          <td>${index === 0 ? (row.type === "labor" ? "인건비" : "운영비") : ""}</td>
          <td>${row.detail || ""}</td>
          <td>${estimateBasis(row)}</td>
          <td class="money-cell">${formatMoney(row.unitPrice)}</td>
          <td class="money-cell">${formatMoney(row.amount)}</td>
        </tr>`
    )
    .join("");
}

function estimateAttachmentTable(data, title = "붙임. 견적내역서") {
  const estimate = data.estimate;
  return `
    <section class="estimate-attachment">
      <h3>${title}</h3>
      <table class="doc-table estimate-doc-table">
        <colgroup>
          <col class="estimate-type-col" />
          <col class="estimate-detail-col" />
          <col class="estimate-basis-col" />
          <col class="estimate-price-col" />
          <col class="estimate-amount-col" />
        </colgroup>
        <thead><tr><th>항목</th><th>세부내역</th><th>산출근거</th><th>단가</th><th>금액</th></tr></thead>
        <tbody>
          ${estimateRowsHtml(estimate.laborRows, "인건비")}
          <tr class="estimate-subtotal"><th colspan="4">인건비 계</th><td class="money-cell">${formatMoney(estimate.laborTotal)}</td></tr>
          ${estimateRowsHtml(estimate.operationRows, "운영비")}
          <tr class="estimate-subtotal"><th colspan="4">운영비 계</th><td class="money-cell">${formatMoney(estimate.operationTotal)}</td></tr>
          <tr><th colspan="4">일반관리비</th><td class="money-cell">${formatMoney(estimate.managementFee)}</td></tr>
          <tr><th colspan="4">기업이윤</th><td class="money-cell">${formatMoney(estimate.profitFee)}</td></tr>
          <tr class="estimate-total-row"><th colspan="4">공급가액</th><td class="money-cell">${formatMoney(estimate.finalSupply || estimate.supply)}</td></tr>
          <tr><th colspan="4">부가세</th><td class="money-cell">${formatMoney(estimate.vat)}</td></tr>
          <tr class="estimate-total-row"><th colspan="4">최종견적금액</th><td class="money-cell">${formatMoney(estimate.total || estimate.finalSupply + estimate.vat)}</td></tr>
        </tbody>
      </table>
    </section>
  `;
}

function startupDetailTable(data) {
  return estimateAttachmentTable(data, "착수내역");
}

function schedulePlanTable(data) {
  const schedule = data.schedule;
  const rows = schedule.rows.length
    ? schedule.rows
    : [{ task: data.contract.title || "과업 수행", start: 1, end: schedule.totalSteps, note: "" }];
  const steps = Array.from({ length: schedule.totalSteps }, (_, index) => index + 1);
  const stepLabels = scheduleStepLabels(data);
  const notesByStep = steps.map((step) =>
    rows
      .filter((row) => row.note && row.end === step)
      .map((row) => row.note)
      .join(" / ")
  );

  return `
    <table class="doc-table schedule-plan-table">
      <colgroup>
        <col class="schedule-task-col" />
        ${steps.map(() => `<col class="schedule-step-col" />`).join("")}
      </colgroup>
      <thead>
        <tr>
          <th class="schedule-corner"><span>과업내용</span><em>공정(${schedule.unit})</em></th>
          ${stepLabels.map((label) => `<th>${label}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row, index) => `
              <tr>
                <th>${index + 1}. ${row.task}</th>
                ${steps.map((step) => `<td class="${step >= row.start && step <= row.end ? "active-step" : ""}">${step >= row.start && step <= row.end ? "<span></span>" : ""}</td>`).join("")}
              </tr>
            `
          )
          .join("")}
        <tr class="schedule-note-row">
          <th>보고</th>
          ${notesByStep.map((note) => `<td>${note}</td>`).join("")}
        </tr>
      </tbody>
    </table>
  `;
}

function acceptanceTerms(data) {
  return `
    <div class="acceptance-info">${contractInfoTable(data, [["지체상금율", "1,000분의 1.3 (0.13%/일)", "", ""]])}</div>
    <div class="doc-body compact acceptance-intro">아래 내용을 확인하고 승낙합니다.</div>
    <div class="doc-body compact acceptance-body">
1. 본인(법인)은 계약서, 과업지시서 및 견적서의 내용을 확인하였으며, 계약이행기간 내에 해당 용역을 성실히 완료하겠습니다.

2. 발주처의 사정 또는 과업 내용의 조정이 필요한 경우, 상호 협의에 따라 계약금액 또는 과업 내용을 조정할 수 있음을 승낙합니다.

3. 정당한 사유 없이 계약이행기간 내 용역을 완료하지 못한 경우, 계약서에 정한 지체상금율에 따라 지체상금이 부과될 수 있음을 확인합니다.

4. 대금은 용역 완료 후 검사 또는 확인 절차를 거쳐 지급됨을 확인합니다.

5. 완료 후 제출한 성과품에 보완이 필요한 경우, 발주처의 요청에 따라 성실히 보완하겠습니다.
    </div>
    ${contractorSignatureTable(data)}
  `;
}

function employmentCertificate(data, person, role) {
  return `${contractInfoTable(data, [], { includeAmount: false })}
      <table class="doc-table simple-info-table">
        <colgroup>
          <col class="simple-label-col" />
          <col class="simple-value-col" />
        </colgroup>
        <tbody>
          <tr><th>성명</th><td>${person || ""}</td></tr>
          <tr><th>소속</th><td>${data.contractor.company || ""}</td></tr>
          <tr><th>직위</th><td>${role || ""}</td></tr>
          <tr><th>용도</th><td>${data.contract.title || ""} 계약 제출용</td></tr>
        </tbody>
      </table>
      <p class="doc-body">상기와 같이 재직하고 있음을 증명합니다.</p>${contractorSignatureTable(data)}`;
}

function metaRows(data, extra = []) {
  const rows = [
    ["발주처", data.agency],
    ["계약건명", data.contract.title],
    ...(data.contract.contractNo ? [["계약번호", data.contract.contractNo]] : []),
    ["계약금액", `${formatMoney(data.contract.amount)} (금 ${amountInKorean(data.contract.amount)}원)`],
    ["계약일자", formatDate(data.contract.date)],
    ["계약이행기간", formatContractPeriod(data)]
  ].concat(extra);

  return `
    <table class="doc-meta official-table">
      <colgroup>
        <col class="label-col" />
        <col class="value-col" />
        <col class="label-col" />
        <col class="value-col" />
      </colgroup>
      <tbody>
        ${rows.map(([key, value]) => `<tr><th>${key}</th><td colspan="3">${value || ""}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
}

function contractorRows(data) {
  return `
    <table class="doc-table simple-info-table">
      <colgroup>
        <col class="simple-label-col" />
        <col class="simple-value-col" />
      </colgroup>
      <tbody>
        <tr><th>상호명</th><td>${data.contractor.company}</td></tr>
        <tr><th>사업자등록번호</th><td>${data.contractor.businessNumber}</td></tr>
        <tr><th>주소</th><td>${data.contractor.address}</td></tr>
        <tr><th>대표자</th><td>${data.contractor.ceo}</td></tr>
      </tbody>
    </table>
  `;
}

function renderDocPage(name, data) {
  const body = docBody(name, data);
  return `
    <article id="${documentId(name)}" class="doc-page page-break">
      <h2>${name}</h2>
      ${body}
    </article>
  `;
}

function docBody(name, data) {
  const generic = {
    "계약보증금납부서": `${contractInfoTable(data, [["계약보증금액", `${formatMoney(data.contract.guarantee)} (금 ${amountInKorean(data.contract.guarantee)}원)`, "보증금납부방법", "보증서 또는 각서"]])}
      <p class="doc-body">위의 금액을 계약보증금으로 납부합니다.</p>
      ${contractorSignatureTable(data)}`,
    "계약보증금지급각서": `${contractInfoTable(data, [["계약보증금액", `${formatMoney(data.contract.guarantee)} (금 ${amountInKorean(data.contract.guarantee)}원)`, "", ""]])}
      <div class="doc-body compact">본인(법인)은 위 계약과 관련하여 계약보증금 납부를 면제받습니다. 다만 계약보증금 귀속 사유가 발생할 경우, 위 계약보증금액을 즉시 납부할 것을 확약하며 이에 각서를 제출합니다.</div>
      ${contractorSignatureTable(data)}`,
    "사용인감계": `${contractInfoTable(data)}
      <div class="stamp-row">
        ${stampBox("인감증명서", data.seals?.registered)}
        ${stampBox("사용인감", data.seals?.use)}
      </div>
      <div class="doc-body compact">위 인장은 본인이 사용하는 인장으로서 아래 용도로 사용하겠으며, 위 인장 사용으로 인한 법률상의 모든 책임을 본인이 질 것을 확약하고 이에 사용인감계를 제출합니다.

※ 용도: ${data.agency}와 체결하는 『${data.contract.title || "계약건명"}』 계약 및 관련 제출서류 일체</div>
      ${contractorSignatureTable(data)}`,
    "청렴계약이행서약서": `${metaRows(data)}
      <div class="doc-body compact">본인(법인)은 부패 없는 공정하고 투명한 계약 이행이 중요함을 인식하고, ${data.agency}의 청렴계약제 시행 취지에 동참합니다. 또한 『${data.contract.title || "계약건명"}』 계약과 관련하여 본인(법인)은 물론 협력업체, 하도급업체의 임직원 및 대리인이 아래 서약내용을 성실히 이행할 것을 서약합니다.

서 약 내 용

1. 위의 사업과 관련하여 계약에서부터 준공 또는 납품에 이르기까지 제반 계약 사항을 성실히 이행할 것이며, 부실시공, 불량자재의 사용 및 납품 등 계약사항을 위반하거나 품질을 떨어뜨리는 어떠한 행위도 하지 않겠습니다.

2. 위 사업의 계약체결과 이행 그리고 공사 시행과 준공 또는 납품 등의 전 과정을 통하여 어떠한 경우에도 뇌물공여나 청탁으로 관계공무원을 회유하여 편의를 제공받는 등 불법을 묵인하도록 요청하지 않으며, 관계공무원의 어떠한 불법·부당한 요구도 단호히 거절하겠습니다.

3. 위의 서약은 당사의 양심과 명예를 걸고 반드시 지킬 것이며, 만약 이를 위반한 사실이 밝혀질 경우 관계법령에 따른 처분은 물론 ${data.agency}가 발주하는 모든 공사, 용역, 물품 등에 대하여 참가 제한 처분을 받은 날로부터 2년 동안 스스로 참가하지 않겠으며, 이와 관련한 처분에 대하여 이의를 제기하지 않겠습니다.</div>${pledgeSignature(data)}`,
    "수의계약각서": `<div class="doc-body compact exclusion-list">본인(법인)은 귀 기관과 수의계약을 체결함에 있어서 수의계약 배제사유 중 어느 사유에도 해당되지 않으며, 차후에 이러한 사실이 발견된 경우 계약의 해지 또는 해제 및 부정당업자의 제재처분을 받아도 하등의 이유를 제기하지 않겠습니다.

<strong class="inline-section-title">수의계약 배제사유</strong>
<div class="exclusion-items">
  <p>1. 견적서 제출 마감일 현재 부도·파산·해산·영업정지 등이 확정된 경우</p>
  <p>2. 입찰참가자격 제한기간 중에 있는 자(법 제31조 제5항에 해당되는 경우 예외)</p>
  <p>3. 견적서 제출 마감일을 기준으로 법 제31조 또는 다른 법령에 따라 부실이행, 담합행위, 입찰·계약 서류의 허위·위조 제출, 입찰·낙찰·계약이행 관련 뇌물 제공으로 부정당업자 제재 처분을 받고 그 종료일로부터 3개월이 지나지 아니한 자(법 제31조 제5항에 해당되는 경우 예외)</p>
  <p>4. 공사 또는 기술용역의 경우 기술자 보유현황이 관련법령에 따른 업종등록 기준에 미달하는 자<br><span>※ 기술자보유현황의 심사는 「낙찰자결정기준」 제1장 입찰참가자격 사전심사기준 제5절 “4”의 그 밖에 해당공사 수행능력상 결격여부, 제2장의2 기술·학술연구 용역 적격심사 세부기준 &lt;별표&gt;의 기술인력 평가방법을 준용한다. 이때 ‘입찰공고일’은 ‘안내공고일’로 ‘적격심사서류 제출마감일’은 ‘견적서 제출마감일’로 본다.</span></p>
  <p>5. 견적서 제출 마감일 기준 최근 3개월 이내에 해당 지방자치단체의 입찰·계약 및 그 이행과 관련하여 10일 이상 지연배상금 부과, 정당한 이행명령 거부, 불법하도급, 5회 이상 하자보수 또는 물의를 일으키는 등 신용이 떨어져 계약 체결이 곤란하다고 판단되는 자</p>
  <p>6. 견적서 제출 마감일 기준 최근 3개월 이내에 해당 지방자치단체와의 계약 및 그 이행과 관련하여 정당한 이유 없이 계약에 응하지 아니하거나 포기서를 제출한 사실이 있는 자<br><span>※ 정당한 이유 없이 계약을 체결하지 아니하는 경우는 법 제31조에 따른 입찰참가자격 제한에는 해당되지 아니하나 수의계약 배제사유에 해당됨.</span></p>
  <p>7. 수의계약 체결일 현재 법 제33조에 해당하는 자<br><span>① 지방자치단체의 장 또는 지방의회의원의 배우자인 사업자(법인은 대표자)</span><br><span>② 지방자치단체의 장 또는 지방의회의원(배우자 포함)의 직계 존·비속인 사업자</span><br><span>③ 지방자치단체의 장 또는 지방의회의원이 자본금 총액의 50% 이상을 소유한 자</span><br><span>④ 지방자치단체의 장 또는 지방의회의원 가족(배우자, 직계존·비속)의 합산금액이 자본금 총액의 50% 이상을 소유한 사업자</span><br><span>⑤ 지방자치단체의 장 또는 지방의회의원 소유업체의 계열회사 등</span></p>
  <p>8. 발주기관이 제한한 자격요건 등을 충족하지 아니한 자</p>
  <p>9. 그 밖에 계약담당자가 계약이행능력이 없다고 판단되는 명백한 증거가 있는 자</p>
  <p>10. 「재난 및 안전관리 기본법」 제60조에 따라 특별재난지역으로 선포된 지역의 재난복구공사(용역)의 경우 결격여부 심사일 현재 계약금액 5천만원 이상 해당업종 관급공사 또는 계약금액 2천만원 이상 관급용역이 3건 이상인 자. 다만, 동시에 여러 건의 수의계약 체결 예정자로 선정된 경우에는 기존 계약을 포함하여 3건까지 수의계약을 체결할 수 있다.<br><span>(단, 제3절의 “1”에 따른 2인 이상 견적서 제출 수의계약에 한한다)</span></p>
</div></div>${pledgeSignature(data)}`,
    "용역계약 이행 승낙사항": acceptanceTerms(data),
    "조세포탈서약서": `<div class="doc-body compact">본인(법인)은 「지방계약법」 제31조의5에 따른 조세포탈 등을 한 자가 아님을 서약합니다. 만일 다음 각 호의 사유에 해당되어 유죄판결이 확정된 날부터 2년이 지나지 않는 사실이 발견된 때에는 계약을 해제·해지하는 등의 불이익을 감수하겠으며, 「지방계약법 시행령」 제93조에 따라 부정당업자의 입찰참가자격제한 처분을 받겠습니다.

1. 「관세법」 제270조에 따른 부정한 방법으로 관세를 면탈하거나 감면 또는 환급받은 세액이 5억원 이상인 자

2. 「국제조세조정에 관한 법률」 제34조제1항에 따른 해외금융계좌의 신고의무를 위반하고, 그 신고의무 위반금액이 「조세범 처벌법」 제16조에 따른 금액을 초과하는 자

3. 「외국환거래법」 제18조에 따른 자본거래의 신고의무를 위반하고, 그 신고의무 위반금액이 같은 법 제29조제1항제3호에 따른 금액을 초과하는 자

4. 「조세범 처벌법」 제3조에 따른 조세 포탈세액이나 환급·공제받은 세액이 5억원 이상인 자

5. 「지방세기본법」 제102조에 따른 지방세 포탈세액이나 환급·공제 세액이 5억원 이상인 자</div>${pledgeSignature(data)}`,
    "안전보건관리준수서약서": `<div class="safety-pledge">
      <p class="doc-body">산업재해예방을 위하여 관련 법규에서 정한 필수사항을 철저히 준수할 것을 다음과 같이 서약합니다.</p>
      <div class="safety-law-row">
        <strong>「산업안전보건법, 중대재해처벌법」 등 관련 법규를 준수하겠습니다.</strong>
        <div>
          <div>: 예 ( O )</div>
          <div>: 아니오 ( )</div>
        </div>
      </div>
      <p class="doc-body">본인(법인)은 본 용역을 수행함에 있어 위에 언급한 내용대로 계약을 성실히 이행할 것이며, 만일 이를 이행하지 않을 경우 계약해지, 입찰참가 자격제한조치 등 불이익 처분을 받더라도 하등의 이의를 제기하지 아니할 것을 확약하고 안전보건관리 준수 서약서를 제출합니다.</p>
      ${contractorSignatureTable(data)}
    </div>`,
    "제한여부확인서": `<p class="doc-body compact form-help-text">• 해당하는 [ ]에 √ 표시를 합니다.</p>
      <table class="doc-table contract-form restriction-summary-table">
        ${(() => {
          const contact = data.contractor.contractContactPhone || data.contractor.phone || "";
          return `
        <tbody>
          <tr>
            <th rowspan="4" class="vertical-head">계약자</th>
            <th class="group-head">발주처</th>
            <td colspan="4" class="strong-value">${data.agency}</td>
          </tr>
          <tr>
            <th rowspan="3" class="group-head">계약<br>상대자</th>
            <th class="item-head">상호명</th>
            <td class="strong-value">${data.contractor.company || ""}</td>
            <th class="item-head">사업자등록번호</th>
            <td class="strong-value">${data.contractor.businessNumber || ""}</td>
          </tr>
          <tr>
            <th class="item-head">주소</th>
            <td colspan="3" class="strong-value">${data.contractor.address || ""}</td>
          </tr>
          <tr>
            <th class="item-head">대표자</th>
            <td class="strong-value">${data.contractor.ceo || ""}</td>
            <th class="item-head">전화번호</th>
            <td class="strong-value">${contact}</td>
          </tr>
          <tr><th rowspan="3" class="vertical-head">계약내용</th><th colspan="2" class="group-head">계약건명</th><td colspan="3">${data.contract.title || ""}</td></tr>
          <tr><th colspan="2" class="group-head">계약금액</th><td colspan="3">${formatMoney(data.contract.amount)} (금 ${amountInKorean(data.contract.amount)}원정)</td></tr>
          <tr><th colspan="2" class="group-head">수의계약 사유</th><td colspan="3">「지방계약법 시행령」 제25조제1항에 따른 수의계약</td></tr>
        </tbody>
          `;
        })()}
      </table>
      <table class="doc-table restriction-checks">
        <colgroup>
          <col class="check-no-col" />
          <col class="check-text-col" />
          <col class="check-option-col" />
          <col class="check-option-col" />
          <col class="check-option-col" />
        </colgroup>
        <thead><tr><th colspan="5">수의계약 체결 제한 확인사항</th></tr></thead>
        <tbody>
          ${restrictionRows().map((text, index) => `<tr><th>${index + 1}</th><td>${text}</td><td><span class="check-mark">[ ]</span><span>예</span></td><td><span class="check-mark">[√]</span><span>아니오</span></td><td><span class="check-mark">[ ]</span><span>해당없음</span></td></tr>`).join("")}
        </tbody>
      </table>
      <div class="doc-body compact restriction-confirm">「공직자의 이해충돌 방지법」 제12조에 따른 수의계약 체결 제한에 대하여 위와 같이 확인합니다.

만약 위 사항이 사실과 다른 경우에는 어떠한 처벌이나 불이익도 감수할 것을 서약합니다.</div>
      ${contractorSignatureTable(data)}`,
    "견적서": `${contractInfoTable(data, [["견적금액", `${formatMoney(estimateTotalAmount(data))} (금 ${amountInKorean(estimateTotalAmount(data))}원)`, "", ""]])}
      <p class="doc-body">위와 같이 견적서를 제출합니다.</p>
      ${estimateAttachmentTable(data)}
      ${contractorSignatureTable(data)}`,
    "착수계": `${contractInfoTable(data, [["착수일", formatDate(data.period.startDate), "완료예정일", `${formatDate(data.period.endDate)}${data.period.duration ? ` (공기 ${data.period.duration}일)` : ""}`]], { includeAmount: false, includePeriod: false })}
      <p class="doc-body">위와 같이 착수계를 제출합니다.</p>
      ${contractorSignatureTable(data)}`,
    "현장대리인계": `${contractInfoTable(data, [], { includeAmount: false })}
      <table class="doc-table simple-info-table">
        <colgroup>
          <col class="simple-label-col" />
          <col class="simple-value-col" />
        </colgroup>
        <tbody>
          <tr><th>성명</th><td>${data.participants.agent || data.contractor.ceo}</td></tr>
          <tr><th>소속</th><td>${data.contractor.company || ""}</td></tr>
          <tr><th>직위</th><td>${data.participants.agentRole || ""}</td></tr>
          <tr><th>담당업무</th><td>${data.participants.agentTask || "계약 수행 및 현장 관리 책임"}</td></tr>
        </tbody>
      </table>
      <p class="doc-body">위 사람을 본 용역의 현장대리인으로 정하여 제출합니다.</p>${contractorSignatureTable(data)}`,
    "참여자명단": `${contractInfoTable(data, [], { includeAmount: false })}
      <table class="doc-table participant-table">
        <colgroup>
          <col class="participant-name-col" />
          <col class="participant-role-col" />
          <col class="participant-task-col" />
          <col class="participant-period-col" />
        </colgroup>
        <thead><tr><th>성명</th><th>직위</th><th>투입업무</th><th>투입기간</th></tr></thead>
        <tbody>${participantRows(data)}</tbody>
      </table>${contractorSignatureTable(data)}`,
    "재직증명서": employmentCertificate(data, data.participants.agent || data.contractor.ceo, data.participants.agentRole || ""),
    "재직증명서(참여자)": employmentCertificate(data, data.participants.participant, data.participants.participantRole || ""),
    "예정공정표": `${contractInfoTable(data, [], { includeAmount: false })}
      ${schedulePlanTable(data)}${contractorSignatureTable(data)}`,
    "착수내역서": `${contractInfoTable(data, [], { includeAmount: false })}
      ${startupDetailTable(data)}${contractorSignatureTable(data)}`,
    "보안각서": `${contractInfoTable(data, [], { includeAmount: false })}
      <div class="doc-body compact">본인(법인)은 ${data.agency}와 계약 체결한 용역을 시행함에 있어 다음 사항을 준수할 것을 각서로 제출합니다.

1. 본인(법인)은 본 용역을 시행함에 있어 일체의 정보를 절대 누설하지 않을 것을 동의하며, 보안사항을 철저히 이행하겠습니다.

2. 보안 사항을 외부에 누설하여 중대한 문제점을 야기한 경우에는 보안관계법규에 의거 처벌받음은 물론, 어떠한 제재조치를 취하여도 이의를 제기하지 않을 것을 서약합니다.</div>${pledgeSignature(data)}`,
    "보안각서(현장대리인)": `${contractInfoTable(data, [["현장대리인", data.participants.agent || data.contractor.ceo, "", ""]], { includeAmount: false })}
      <div class="doc-body compact">본인(법인)은 ${data.agency}와 계약 체결한 용역을 시행함에 있어 다음 사항을 준수할 것을 각서로 제출합니다.

1. 본인(법인)은 본 용역을 시행함에 있어 일체의 정보를 절대 누설하지 않을 것을 동의하며, 보안사항을 철저히 이행하겠습니다.

2. 보안 사항을 외부에 누설하여 중대한 문제점을 야기한 경우에는 보안관계법규에 의거 처벌받음은 물론, 어떠한 제재조치를 취하여도 이의를 제기하지 않을 것을 서약합니다.</div>${pledgeSignature(data, "현장대리인")}`,
    "완료계": `<div class="supervisor-box">계약담당자 확인 <span>(인)</span></div>
      ${contractInfoTable(data, [["실지완료일", "　　　　년 　　월 　　일", "", ""]], { includeAmount: false })}
      <p class="doc-body">위와 같이 건을 완료하였기에 완료계를 제출합니다.</p>
      ${contractorSignatureTable(data)}`,
    "청구서": `${contractInfoTable(data, [["선금금액", formatMoney(data.claim.advanceAmount), "청구금액", `${formatMoney(claimAmount(data))} (금 ${amountInKorean(claimAmount(data))}원)`]])}
      <p class="doc-body">위와 같이 계약 금액을 청구합니다.</p>
      <table class="doc-table claim-table">
        <colgroup>
          <col class="claim-label-col" />
          <col class="claim-value-col" />
          <col class="claim-label-col" />
          <col class="claim-value-col" />
        </colgroup>
        <tbody>
          <tr><th>은행명</th><td>${data.claim.bankName || ""}</td><th>계좌번호</th><td>${data.claim.bankAccount || ""}</td></tr>
          <tr><th>예금주명</th><td colspan="3">${data.claim.accountHolder || data.contractor.company || ""}</td></tr>
        </tbody>
      </table>
      ${contractorSignatureTable(data)}`
  };

  if (name === "용역표준계약서") {
    return `
      ${data.contract.contractNo ? `<div class="contract-number">계약번호 ${data.contract.contractNo}</div>` : ""}
      <table class="doc-table contract-form">
        <tbody>
          <tr>
            <th rowspan="5" class="vertical-head">계약자</th>
            <th class="group-head">발주처</th>
            <td colspan="4" class="strong-value">${data.agency}</td>
          </tr>
          <tr>
            <th rowspan="4" class="group-head">계약<br>상대자</th>
            <th class="item-head">상호명</th>
            <td class="strong-value">${data.contractor.company || ""}</td>
            <th class="item-head">사업자등록번호</th>
            <td class="strong-value">${data.contractor.businessNumber || ""}</td>
          </tr>
          <tr>
            <th class="item-head">주소</th>
            <td colspan="3" class="strong-value">${data.contractor.address || ""}</td>
          </tr>
          <tr>
            <th class="item-head">대표자</th>
            <td class="strong-value">${data.contractor.ceo || ""}</td>
            <th class="item-head">전화번호</th>
            <td class="strong-value">${data.contractor.phone || ""}</td>
          </tr>
          <tr>
            <th class="item-head">세금계산서 이메일</th>
            <td colspan="3" class="strong-value allow-wrap">${data.contractor.invoiceEmail || ""} ${data.contractor.accountingContact ? `(담당자: ${data.contractor.accountingContact})` : "(담당자:    )"}</td>
          </tr>
          <tr><th rowspan="6" class="vertical-head">계약내용</th><th colspan="2" class="group-head">계약건명</th><td colspan="3">${data.contract.title || ""}</td></tr>
          <tr><th colspan="2" class="group-head">계약금액</th><td colspan="3">${formatMoney(data.contract.amount)} (금 ${amountInKorean(data.contract.amount)}원정)</td></tr>
          <tr><th colspan="2" class="group-head">계약보증금</th><td colspan="3">${formatMoney(data.contract.guarantee)} (금 ${amountInKorean(data.contract.guarantee)}원정)</td></tr>
          <tr><th colspan="2" class="group-head">지체상금율</th><td colspan="3">1,000분의 1.3 (0.13%/일)</td></tr>
          <tr><th colspan="2" class="group-head">계약이행기간</th><td colspan="3">${formatContractPeriod(data)}</td></tr>
          <tr><th colspan="2" class="group-head">기타사항</th><td colspan="3">기타의 사항은 지방계약법령 및 규칙, 회계예규, 입찰 및 계약집행기준, 용역계약 일반조건 등에 따른다.</td></tr>
        </tbody>
      </table>
      <div class="doc-body compact">발주처와 계약상대자는 상호 대등한 입장에서 위 용역에 대한 계약을 체결하고, 신의에 따라 성실히 계약상의 의무를 이행할 것을 확약합니다.</div>
      ${contractorSignatureTable(data)}
    `;
  }

  return generic[name] || `${metaRows(data)}${commonSignature(data)}`;
}

function updateSealStatus(type = null) {
  const types = type ? [type] : ["registered", "use"];
  types.forEach((sealType) => {
    const label = sealType === "registered" ? "인감증명서상 인감" : "사용인감";
    const seal = state.seals[sealType];
    const preview = document.querySelector(`[data-seal-preview="${sealType}"]`);
    const status = document.querySelector(`[data-seal-status="${sealType}"]`);
    if (!preview || !status) return;

    if (seal) {
      preview.src = seal;
      preview.classList.add("visible");
      status.textContent = `${label} 이미지가 반영됨`;
      status.classList.add("ready");
      status.classList.remove("muted");
    } else {
      preview.removeAttribute("src");
      preview.classList.remove("visible");
      status.textContent = sealType === "registered" ? "미등록, 사용인감계에서 직접 날인 가능" : "미등록, 출력 후 직접 날인 필요";
      status.classList.remove("ready");
      status.classList.add("muted");
    }
  });
}

function unitSelectMarkup(field, selected = "") {
  return `
    <select data-estimate-field="${field}">
      ${unitOptionsMarkup(selected)}
    </select>
  `;
}

function unitOptionsMarkup(selected = "") {
  return `
    <option value=""${selected ? "" : " selected"}>선택</option>
    ${estimateUnitGroups
      .map(
        (group) => `
          <optgroup label="${group.label}">
            ${group.units.map((unit) => `<option value="${unit}"${unit === selected ? " selected" : ""}>${unit}</option>`).join("")}
          </optgroup>`
      )
      .join("")}
  `;
}

function hydrateEstimateUnitSelects(root = document) {
  root.querySelectorAll("select[data-estimate-field^='unit']").forEach((select) => {
    const selected = select.dataset.selectedUnit || select.value || "";
    select.innerHTML = unitOptionsMarkup(selected);
  });
}

function resetEstimate() {
  ["estimateTotal", "managementFee", "profitFee"].forEach((name) => {
    if (form.elements[name]) form.elements[name].value = "";
  });

  document.querySelector('[data-estimate-rows="labor"]').innerHTML = estimateRowTemplate("labor");
  document.querySelector('[data-estimate-rows="operation"]').innerHTML = estimateRowTemplate("operation");
  hydrateEstimateUnitSelects();
  syncComputedFields();
  renderDocuments();
}

function estimateRowTemplate(type) {
  const firstUnit = type === "labor" ? "명" : "";
  return `
    <div class="estimate-row" data-estimate-row="${type}">
      <input data-estimate-field="detail" placeholder="세부내역" />
      <input data-estimate-field="qty1" inputmode="numeric" placeholder="수량" />
      ${unitSelectMarkup("unit1", firstUnit)}
      <input data-estimate-field="qty2" inputmode="numeric" placeholder="수량" />
      ${unitSelectMarkup("unit2")}
      <input data-estimate-field="qty3" inputmode="numeric" placeholder="수량" />
      ${unitSelectMarkup("unit3")}
      <input data-estimate-field="unitPrice" inputmode="numeric" placeholder="단가" />
      <button type="button" class="secondary row-remove" data-remove-estimate-row>삭제</button>
    </div>
  `;
}

function scheduleRowTemplate() {
  return `
    <div class="schedule-input-row" data-schedule-row>
      <input data-schedule-field="task" placeholder="과업내용" />
      <input data-schedule-field="start" type="number" min="1" value="1" />
      <input data-schedule-field="end" type="number" min="1" value="1" />
      <input data-schedule-field="note" placeholder="보고/비고" />
      <button type="button" class="secondary row-remove" data-remove-schedule-row>삭제</button>
    </div>
  `;
}

document.querySelectorAll("[data-screen]").forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.screen));
});

document.querySelectorAll("[data-next]").forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.next));
});

inputTabs.forEach((tab) => {
  tab.addEventListener("click", () => showInputTab(tab.dataset.inputTab));
});

form.addEventListener("input", syncComputedFields);
form.addEventListener("change", syncComputedFields);

["managementFee", "profitFee"].forEach((name) => {
  form.elements[name]?.addEventListener("keyup", () => alertEstimateFeeLimit(name));
  form.elements[name]?.addEventListener("focus", () => {
    state.estimateReferenceBalance = getData().estimate.balance;
    syncComputedFields();
  });
  form.elements[name]?.addEventListener("blur", () => {
    state.estimateReferenceBalance = null;
    syncComputedFields();
  });
});

form.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-estimate-row]");
  if (addButton) {
    const type = addButton.dataset.addEstimateRow;
    document.querySelector(`[data-estimate-rows="${type}"]`)?.insertAdjacentHTML("beforeend", estimateRowTemplate(type));
    syncComputedFields();
    return;
  }

  const removeButton = event.target.closest("[data-remove-estimate-row]");
  if (removeButton) {
    removeButton.closest("[data-estimate-row]")?.remove();
    syncComputedFields();
  }

  const addScheduleButton = event.target.closest("[data-add-schedule-row]");
  if (addScheduleButton) {
    document.querySelector("[data-schedule-rows]")?.insertAdjacentHTML("beforeend", scheduleRowTemplate());
    syncComputedFields();
    return;
  }

  const removeScheduleButton = event.target.closest("[data-remove-schedule-row]");
  if (removeScheduleButton) {
    removeScheduleButton.closest("[data-schedule-row]")?.remove();
    syncComputedFields();
  }
});

document.querySelectorAll("[data-seal-input]").forEach((input) => {
  input.addEventListener("change", () => {
    const type = input.dataset.sealInput;
    const file = input.files?.[0];
    if (!type || !file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      state.seals[type] = String(reader.result || "");
      updateSealStatus(type);
      renderDocuments();
    });
    reader.readAsDataURL(file);
  });
});

document.querySelectorAll("[data-remove-seal]").forEach((button) => {
  button.addEventListener("click", () => {
    const type = button.dataset.removeSeal;
    if (!type) return;
    state.seals[type] = "";
    const input = document.querySelector(`[data-seal-input="${type}"]`);
    if (input) input.value = "";
    updateSealStatus(type);
    renderDocuments();
  });
});

document.querySelector("#printPdf").addEventListener("click", () => {
  renderDocuments();
  const data = getData();
  const safeCompany = (data.contractor.company || "업체명").replace(/[\\/:*?"<>|]/g, "");
  const safeTitle = (data.contract.title || "계약명").replace(/[\\/:*?"<>|]/g, "");
  document.title = `계약서류_${safeCompany}_${safeTitle}`;
  window.print();
});

document.querySelector("#resetEstimate")?.addEventListener("click", resetEstimate);

document.querySelector("#printEstimatePdf")?.addEventListener("click", () => {
  const data = getData();
  const previousTitle = document.title;
  const safeCompany = (data.contractor.company || "업체명").replace(/[\\/:*?"<>|]/g, "");
  const safeTitle = (data.contract.title || "계약명").replace(/[\\/:*?"<>|]/g, "");
  renderSingleDocument("견적서");
  document.title = `견적서_${safeCompany}_${safeTitle}`;
  window.print();
  setTimeout(() => {
    document.title = previousTitle;
    renderDocuments();
  }, 300);
});

hydrateEstimateUnitSelects();
renderDocumentToggles();
syncComputedFields();
updateSealStatus();
renderDocuments();
