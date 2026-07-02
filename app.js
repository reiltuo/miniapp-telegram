const telegram = window.Telegram?.WebApp;
const state = { amount: 1699, label: "PACK VIP", chargeId: null, pollTimer: null };
const money = amount => (amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const byId = id => document.getElementById(id);

telegram?.ready();
telegram?.expand();

document.querySelectorAll(".video-card").forEach(card => {
  const video = card.querySelector("video");
  card.addEventListener("click", () => {
    document.querySelectorAll(".video-card video").forEach(other => { if (other !== video) { other.pause(); other.closest(".video-card").classList.remove("playing"); } });
    if (video.paused) { video.play(); card.classList.add("playing"); } else { video.pause(); card.classList.remove("playing"); }
  });
  video.addEventListener("ended", () => card.classList.remove("playing"));
});

function selectAmount(amount, label) {
  state.amount = Number(amount);
  state.label = label;
  byId("pay-button").textContent = `Pagar ${money(state.amount)} no PIX`;
  byId("total-price").textContent = money(state.amount);
}

document.querySelectorAll("input[name=plan]").forEach(input => input.addEventListener("change", () => {
  document.querySelectorAll(".plan").forEach(plan => plan.classList.toggle("selected", plan.contains(input)));
  selectAmount(input.value, input.dataset.label);
}));

function showModal(id) { byId(id).hidden = false; document.body.style.overflow = "hidden"; }
function hideModal(id) { byId(id).hidden = true; document.body.style.overflow = ""; }

document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => {
  hideModal(button.dataset.close);
  showModal("downsell-one");
}));

async function createPixCharge() {
  byId("pix-code").value = "Gerando cobrança PIX...";
  byId("qr-image").removeAttribute("src");
  byId("payment-status").textContent = "";
  showModal("pix-modal");
  try {
    const response = await fetch("/api/pix/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: state.amount, description: state.label }) });
    if (!response.ok) throw new Error("API PIX indisponível");
    const charge = await response.json();
    state.chargeId = charge.id;
    byId("pix-code").value = charge.copyPasteCode;
    byId("qr-image").src = charge.qrCodeBase64.startsWith("data:") ? charge.qrCodeBase64 : `data:image/png;base64,${charge.qrCodeBase64}`;
    startPaymentPolling();
  } catch {
    byId("pix-code").value = "Configure o endpoint /api/pix/create no backend";
    byId("payment-status").textContent = "Modo de demonstração. Consulte o README para integrar o gateway.";
    byId("qr-image").src = "assets/qr-placeholder.svg";
  }
}

async function checkPayment() {
  if (!state.chargeId) return;
  const response = await fetch(`/api/pix/status?id=${encodeURIComponent(state.chargeId)}`);
  if (!response.ok) return;
  const result = await response.json();
  if (result.status === "paid") {
    clearInterval(state.pollTimer);
    byId("payment-status").textContent = "Pagamento confirmado. Acesso liberado.";
    telegram?.HapticFeedback?.notificationOccurred("success");
    telegram?.sendData(JSON.stringify({ action: "pix_paid", chargeId: state.chargeId }));
  }
}
function startPaymentPolling() { clearInterval(state.pollTimer); state.pollTimer = setInterval(checkPayment, 5000); }

byId("pay-button").addEventListener("click", createPixCharge);
byId("paid-button").addEventListener("click", checkPayment);
byId("copy-button").addEventListener("click", async () => { await navigator.clipboard.writeText(byId("pix-code").value); byId("copy-button").textContent = "Copiado"; setTimeout(() => byId("copy-button").textContent = "Copiar", 1600); });
byId("back-button").addEventListener("click", () => { if (telegram) telegram.BackButton.isVisible ? telegram.BackButton.hide() : telegram.close(); else showModal("downsell-one"); });
document.querySelector("[data-next-downsell]").addEventListener("click", () => { hideModal("downsell-one"); showModal("downsell-two"); });
document.querySelectorAll("[data-offer]").forEach(button => button.addEventListener("click", () => { hideModal("downsell-one"); hideModal("downsell-two"); selectAmount(button.dataset.offer, "Acesso VIP promocional"); createPixCharge(); }));
byId("final-exit").addEventListener("click", () => { hideModal("downsell-two"); telegram?.close(); });

const names = ["Thiago R.", "Lucas M.", "Rafael S.", "Bruno A.", "Marcos V.", "Felipe C.", "João P.", "André L."];
function showSocialProof() {
  byId("proof-name").textContent = names[Math.floor(Math.random() * names.length)];
  byId("social-proof").classList.add("show");
  setTimeout(() => byId("social-proof").classList.remove("show"), 4200);
}
setTimeout(showSocialProof, 1600);
setInterval(showSocialProof, 11000);
