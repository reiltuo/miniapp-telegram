const telegram = window.Telegram?.WebApp;
const state = { amount: 1699, label: "PACK VIP", chargeId: null, pollTimer: null, creatingCharge: false, paid: false };
const money = amount => (amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const byId = id => document.getElementById(id);
const CATALOG_PREVIEW_SECONDS = 3;

telegram?.ready();
telegram?.expand();

document.querySelectorAll(".video-card[data-video]").forEach(card => {
  const video = card.querySelector("video");
  card.addEventListener("click", async () => {
    document.querySelectorAll(".video-card[data-video] video").forEach(other => {
      if (other !== video) {
        other.pause();
        other.currentTime = 0;
        other.closest(".video-card").classList.remove("playing");
        other.closest(".video-card").setAttribute("aria-pressed", "false");
      }
    });
    if (video.paused) {
      try {
        await video.play();
        card.classList.add("playing");
        card.setAttribute("aria-pressed", "true");
      } catch {
        card.classList.remove("playing");
      }
    } else {
      video.pause();
      card.classList.remove("playing");
      card.setAttribute("aria-pressed", "false");
    }
  });
  video.addEventListener("ended", () => {
    video.currentTime = 0;
    card.classList.remove("playing");
    card.setAttribute("aria-pressed", "false");
  });
  video.addEventListener("timeupdate", () => {
    if (video.currentTime < CATALOG_PREVIEW_SECONDS) return;
    video.pause();
    video.currentTime = 0;
    card.classList.remove("playing");
    card.setAttribute("aria-pressed", "false");
  });
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

function showModal(id) {
  const modal = byId(id);
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  modal.querySelector("button")?.focus();
}
function hideModal(id) { byId(id).hidden = true; document.body.style.overflow = ""; }

document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => {
  hideModal(button.dataset.close);
  if (!state.paid) showModal("downsell-one");
}));

async function createPixCharge() {
  if (state.creatingCharge) return;
  state.creatingCharge = true;
  byId("pay-button").disabled = true;
  byId("paid-button").disabled = true;
  byId("pix-code").value = "Gerando cobrança PIX...";
  byId("qr-image").removeAttribute("src");
  byId("payment-status").textContent = "Gerando uma cobrança segura...";
  showModal("pix-modal");
  try {
    const response = await fetch("/api/pix/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: state.amount, description: state.label }) });
    const charge = await response.json().catch(() => ({ error: "Não foi possível gerar o PIX" }));
    if (!response.ok) throw new Error(charge.error || "API PIX indisponível");
    state.chargeId = charge.id;
    byId("pix-code").value = charge.copyPasteCode;
    byId("qr-image").src = charge.qrCodeBase64.startsWith("data:") ? charge.qrCodeBase64 : `data:image/png;base64,${charge.qrCodeBase64}`;
    byId("payment-status").textContent = "PIX gerado. Aguardando pagamento.";
    byId("paid-button").disabled = false;
    startPaymentPolling();
  } catch (error) {
    byId("pix-code").value = "Não foi possível gerar o código PIX";
    byId("payment-status").textContent = error.message;
  } finally {
    state.creatingCharge = false;
    byId("pay-button").disabled = false;
  }
}

async function checkPayment() {
  if (!state.chargeId) return;
  try {
    const response = await fetch(`/api/pix/status?id=${encodeURIComponent(state.chargeId)}`);
    if (!response.ok) return;
    const result = await response.json().catch(() => ({}));
    if (result.status === "paid") {
      state.paid = true;
      clearInterval(state.pollTimer);
      byId("payment-status").textContent = "Pagamento confirmado. Acesso liberado.";
      telegram?.HapticFeedback?.notificationOccurred("success");
      telegram?.sendData(JSON.stringify({ action: "pix_paid", chargeId: state.chargeId }));
    } else {
      byId("payment-status").textContent = "Pagamento ainda não identificado. Tente novamente em alguns segundos.";
    }
  } catch {
    byId("payment-status").textContent = "Não foi possível consultar o pagamento agora.";
  }
}
function startPaymentPolling() { clearInterval(state.pollTimer); state.pollTimer = setInterval(checkPayment, 5000); }

byId("pay-button").addEventListener("click", createPixCharge);
byId("paid-button").addEventListener("click", checkPayment);
byId("copy-button").addEventListener("click", async () => {
  const pixInput = byId("pix-code");
  try {
    await navigator.clipboard.writeText(pixInput.value);
  } catch {
    pixInput.select();
    document.execCommand("copy");
  }
  byId("copy-button").textContent = "Copiado";
  setTimeout(() => byId("copy-button").textContent = "Copiar", 1600);
});
byId("back-button").addEventListener("click", () => { if (telegram) telegram.close(); else showModal("downsell-one"); });
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
