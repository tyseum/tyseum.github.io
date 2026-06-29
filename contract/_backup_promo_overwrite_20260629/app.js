const form = document.querySelector("#requestForm");
const formMessage = document.querySelector("#formMessage");
const receipt = document.querySelector("#receipt");

const requiredLabels = {
  organization: "기관명",
  contactName: "담당자명",
  phone: "연락처",
  email: "이메일",
  title: "제목",
  category: "구분",
  audience: "대상",
  schedule: "일정",
  summary: "내용 요약",
  consent: "개인정보 및 홍보자료 활용 동의"
};

function getFormData() {
  const data = new FormData(form);
  return {
    organization: data.get("organization")?.trim() || "",
    organizationType: data.get("organizationType") || "미선택",
    contactName: data.get("contactName")?.trim() || "",
    phone: data.get("phone")?.trim() || "",
    email: data.get("email")?.trim() || "",
    title: data.get("title")?.trim() || "",
    category: data.get("category") || "",
    audience: data.get("audience")?.trim() || "",
    schedule: data.get("schedule")?.trim() || "",
    place: data.get("place")?.trim() || "미정",
    applyMethod: data.get("applyMethod")?.trim() || "별도 안내",
    fee: data.get("fee") || "무료",
    summary: data.get("summary")?.trim() || "",
    channels: data.getAll("channels"),
    links: data.get("links")?.trim() || "",
    consent: data.get("consent") === "on",
    files: getFileSummary()
  };
}

function getFileSummary() {
  const fileInputs = [
    { name: "imageFiles", label: "카드뉴스·포스터" },
    { name: "documentFiles", label: "공문 또는 안내문" },
    { name: "videoFiles", label: "영상 원본" }
  ];

  const summaries = fileInputs
    .map(({ name, label }) => {
      const input = form.elements[name];
      const count = input?.files?.length || 0;
      return count ? `${label} ${count}개` : "";
    })
    .filter(Boolean);

  return summaries.length ? summaries.join(", ") : "첨부파일 없음";
}

function validate(data) {
  const missing = Object.entries(requiredLabels)
    .filter(([key]) => (key === "consent" ? !data[key] : !data[key]))
    .map(([, label]) => label);

  if (missing.length) {
    return `${missing.join(", ")} 항목을 확인해주세요.`;
  }

  if (!form.elements.email.checkValidity()) {
    return "이메일 주소 형식을 확인해주세요.";
  }

  return "";
}

function generateReceiptNumber() {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");
  const sequence = String(Math.floor(Math.random() * 900) + 100);
  return `TY-YOUTH-${date}-${sequence}`;
}

function renderReceipt(data, receiptNumber) {
  const channels = data.channels.length ? data.channels.join(", ") : "센터 검토 후 적합 채널 선택";
  const links = data.links || "제출 링크 없음";

  receipt.classList.remove("empty");
  receipt.innerHTML = `
    <div class="receipt-header">
      <div>
        <p class="eyebrow">Submitted</p>
        <h2>홍보요청이 접수되었습니다</h2>
      </div>
      <span class="receipt-number">${escapeHtml(receiptNumber)}</span>
    </div>
    <div class="summary-list">
      ${summaryItem("기관", `${data.organization} (${data.organizationType})`)}
      ${summaryItem("담당자", `${data.contactName} / ${data.phone}`)}
      ${summaryItem("이메일", data.email)}
      ${summaryItem("제목", data.title)}
      ${summaryItem("구분", data.category)}
      ${summaryItem("대상", data.audience)}
      ${summaryItem("일정", data.schedule)}
      ${summaryItem("장소", data.place)}
      ${summaryItem("신청 방법", data.applyMethod)}
      ${summaryItem("희망 홍보 채널", channels)}
      ${summaryItem("첨부자료", data.files)}
      ${summaryItem("영상·신청 링크", links)}
      ${summaryItem("내용 요약", data.summary, true)}
    </div>
    <p class="receipt-guide">
      담당자가 내용을 검토한 뒤 보완이 필요하거나 홍보 일정 조율이 필요한 경우 남겨주신 연락처로 연락드립니다.
      실제 운영에서는 이 접수번호가 구글 스프레드시트의 자동 번호와 연결됩니다.
    </p>
  `;
}

function summaryItem(label, value, wide = false) {
  return `
    <div class="summary-item ${wide ? "wide" : ""}">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(value)}</span>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(message) {
  formMessage.textContent = message;
  formMessage.classList.toggle("active", Boolean(message));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = getFormData();
  const error = validate(data);

  if (error) {
    showMessage(error);
    return;
  }

  showMessage("");
  renderReceipt(data, generateReceiptNumber());
  document.querySelector("#after").scrollIntoView({ behavior: "smooth", block: "start" });
});

form.addEventListener("reset", () => {
  showMessage("");
  receipt.className = "receipt empty";
  receipt.innerHTML = `
    <strong>아직 작성된 요청서가 없습니다.</strong>
    <p>홍보요청서를 작성하면 접수번호와 검토 안내가 이곳에 나타납니다.</p>
  `;
});
