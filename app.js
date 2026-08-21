const telegram = window.Telegram?.WebApp;
const CATALOG_PREVIEW_SECONDS = 3;
const VIP_CHANNEL_URL = "https://t.me/+Web0AlQBgcYwM2Zh";
const VIDEO_CALL_URL = "https://t.me/chamadavivibot";

/* ── Preços centralizados (centavos) ───────────────────── */
const PRICES = {
  VIP: 990,
  COMBO: 1990,
  VIDEO_CALL: 1000,
  BUMP: 749,
  BUMP_DS: 499,
  VIP_BUMP: 1739,      // 990 + 749
  VIP_BUMP_DS: 1489,   // 990 + 499
  UPSELL: 749,
  UPSELL_DS1: 399,
  UPSELL_DS2: 199,
};

/* ── Estado ─────────────────────────────────────────────── */
const state = { amount: PRICES.VIP, label: "PACK VIP", chargeId: null, pollTimer: null, creatingCharge: false, paid: false };

const funnel = {
  step: "IDLE",
  videoCallAdded: false,
  vipPaid: false,
  closeFriendsPaid: false,
};

const money = amount => (amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const byId = id => document.getElementById(id);

function resetFunnel() {
  funnel.step = "IDLE";
  funnel.videoCallAdded = false;
  funnel.vipPaid = false;
  funnel.closeFriendsPaid = false;
}

/* ── Telegram ──────────────────────────────────────────── */
telegram?.ready();
telegram?.expand();

/* ── Prévias de vídeo ──────────────────────────────────── */
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

/* ── Seleção de plano ──────────────────────────────────── */
function selectAmount(amount, label) {
  state.amount = Number(amount);
  state.label = label;
  byId("pay-button").textContent = `Pagar ${money(state.amount)} no PIX`;
  byId("total-price").textContent = money(state.amount);
}

document.querySelectorAll("input[name=plan]").forEach(input => input.addEventListener("change", () => {
  document.querySelectorAll(".plan").forEach(plan => plan.classList.toggle("selected", plan.contains(input)));
  selectAmount(input.value, input.dataset.label);
  if (funnel.step !== "IDLE") resetFunnel();
}));

/* ── Modais ─────────────────────────────────────────────── */
function showModal(id) {
  const modal = byId(id);
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  modal.querySelector("button")?.focus();
}
function hideModal(id) { byId(id).hidden = true; document.body.style.overflow = ""; }

function resetAccessPanel() {
  byId("access-panel").hidden = true;
  byId("pix-modal").classList.remove("is-paid");
  byId("cf-section").hidden = true;
  byId("cf-form").hidden = false;
  byId("cf-feedback").hidden = true;
  byId("cf-error").hidden = true;
  byId("cf-error").textContent = "";
  const cfInput = byId("cf-instagram-input");
  if (cfInput) cfInput.value = "";
}

function showAccessPanel() {
  byId("access-panel").hidden = false;
  byId("pix-modal").classList.add("is-paid");
  byId("paid-button").disabled = true;
  byId("paid-button").textContent = "Pagamento confirmado";

  const boughtCombo = (state.amount === PRICES.COMBO);
  const boughtBump = funnel.videoCallAdded;
  if (boughtCombo || boughtBump) {
    byId("video-call-button").hidden = false;
  } else {
    byId("video-call-button").hidden = true;
  }

  const isCloseFriends = (
    funnel.step === "UPSELL_CHECKOUT" ||
    funnel.closeFriendsPaid ||
    (state.label && state.label.includes("Close Friends")) ||
    state.amount === PRICES.UPSELL ||
    state.amount === PRICES.UPSELL_DS1 ||
    state.amount === PRICES.UPSELL_DS2
  );

  if (isCloseFriends) {
    funnel.closeFriendsPaid = true;
    byId("cf-section").hidden = false;
    byId("access-desc").textContent = "Seu pagamento foi confirmado com sucesso!";
  } else {
    byId("cf-section").hidden = true;
    byId("access-desc").textContent = "Seu pagamento foi confirmado. Toque no botão abaixo para entrar no canal VIP.";
  }
}

function openVipChannel() {
  if (telegram?.openTelegramLink) {
    telegram.openTelegramLink(VIP_CHANNEL_URL);
    return;
  }
  window.open(VIP_CHANNEL_URL, "_blank", "noopener,noreferrer");
}

/* ── Fechar modal PIX ──────────────────────────────────── */
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => {
  hideModal(button.dataset.close);
  // Downsells de retenção somente fora do funil
  if (!state.paid && funnel.step === "IDLE") showModal("downsell-one");
}));

/* ── Cobrança PIX ──────────────────────────────────────── */
async function createPixCharge() {
  if (state.creatingCharge) return;
  state.creatingCharge = true;
  byId("pay-button").disabled = true;
  byId("paid-button").disabled = true;
  byId("paid-button").textContent = "Já paguei, liberar meu acesso";
  byId("pix-code").value = "Gerando cobrança PIX...";
  byId("qr-image").removeAttribute("src");
  byId("payment-status").textContent = "Gerando uma cobrança segura...";
  resetAccessPanel();
  showModal("pix-modal");
  try {
    const response = await fetch("/api/pix/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: state.amount, description: state.label }) });
    const charge = await response.json().catch(() => ({ error: "Não foi possível gerar o PIX" }));
    if (!response.ok) throw new Error(charge.error || "API PIX indisponível");
    state.chargeId = charge.id;
    byId("pix-code").value = charge.copyPasteCode;
    const qrSrc = charge.qrCodeImage || (charge.qrCodeBase64 ? (charge.qrCodeBase64.startsWith("data:") ? charge.qrCodeBase64 : `data:image/png;base64,${charge.qrCodeBase64}`) : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(charge.copyPasteCode)}`);
    byId("qr-image").src = qrSrc;
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

/* ── Verificação de pagamento ──────────────────────────── */
async function checkPayment() {
  if (!state.chargeId) return;
  try {
    const response = await fetch(`/api/pix/status?id=${encodeURIComponent(state.chargeId)}`);
    if (!response.ok) return;
    const result = await response.json().catch(() => ({}));
    if (result.status === "paid") {
      state.paid = true;
      clearInterval(state.pollTimer);
      telegram?.HapticFeedback?.notificationOccurred("success");

      /* ── Funil: VIP pago sem chamada → iniciar upsell ── */
      if (funnel.step === "VIP_CHECKOUT" && !funnel.videoCallAdded) {
        funnel.vipPaid = true;
        byId("payment-status").textContent = "Pagamento confirmado ✓";
        byId("paid-button").disabled = true;
        byId("paid-button").textContent = "Pagamento confirmado";
        setTimeout(() => {
          hideModal("pix-modal");
          state.paid = false;
          state.chargeId = null;
          state.creatingCharge = false;
          funnel.step = "UPSELL";
          showModal("upsell-offer");
        }, 1200);
        return;
      }

      /* ── Conclusão normal ─────────────────────────────── */
      byId("payment-status").textContent = "Pagamento confirmado. Acesso liberado.";
      showAccessPanel();
      funnel.step = "COMPLETE";
      telegram?.sendData(JSON.stringify({ action: "pix_paid", chargeId: state.chargeId }));
    } else {
      byId("payment-status").textContent = "Pagamento ainda não identificado. Tente novamente em alguns segundos.";
    }
  } catch {
    byId("payment-status").textContent = "Não foi possível consultar o pagamento agora.";
  }
}
function startPaymentPolling() { clearInterval(state.pollTimer); state.pollTimer = setInterval(checkPayment, 5000); }

/* ── Finalizar funil (todos os upsells recusados) ──────── */
function completeFunnel() {
  funnel.step = "COMPLETE";
  state.paid = true;
  selectAmount(PRICES.VIP, "PACK VIP");
  resetAccessPanel();
  byId("payment-status").textContent = "Pagamento confirmado. Acesso liberado.";
  showAccessPanel();
  showModal("pix-modal");
  telegram?.sendData(JSON.stringify({ action: "pix_paid", chargeId: state.chargeId || "" }));
}

/* ═══════════════════════════════════════════════════════════
   EVENT LISTENERS
   ═══════════════════════════════════════════════════════════ */

/* ── Botão Pagar ───────────────────────────────────────── */
byId("pay-button").addEventListener("click", () => {
  const plan = document.querySelector("input[name=plan]:checked");

  // VIP selecionado e funil ainda não iniciado → order bump
  if (plan && Number(plan.value) === PRICES.VIP && funnel.step === "IDLE") {
    funnel.step = "ORDER_BUMP";
    showModal("order-bump");
    return;
  }

  // Se já passou pelo funil, marca como checkout
  if (funnel.step !== "IDLE" && funnel.step !== "COMPLETE") {
    funnel.step = "VIP_CHECKOUT";
  }
  createPixCharge();
});

/* ── Order Bump (chamada R$ 7,49) ──────────────────────── */
byId("bump-accept").addEventListener("click", () => {
  hideModal("order-bump");
  funnel.videoCallAdded = true;
  funnel.step = "VIP_CHECKOUT";
  selectAmount(PRICES.VIP_BUMP, "VIP + Chamada de vídeo (25% OFF)");
  createPixCharge();
});

byId("bump-decline").addEventListener("click", () => {
  hideModal("order-bump");
  funnel.step = "BUMP_DOWNSELL";
  showModal("bump-downsell");
});

/* ── Downsell do Bump (chamada R$ 4,99) ────────────────── */
byId("bump-ds-accept").addEventListener("click", () => {
  hideModal("bump-downsell");
  funnel.videoCallAdded = true;
  funnel.step = "VIP_CHECKOUT";
  selectAmount(PRICES.VIP_BUMP_DS, "VIP + Chamada de vídeo (50% OFF)");
  createPixCharge();
});

byId("bump-ds-decline").addEventListener("click", () => {
  hideModal("bump-downsell");
  funnel.step = "VIP_CHECKOUT";
  selectAmount(PRICES.VIP, "PACK VIP");
  createPixCharge();
});

/* ── Upsell pós-compra (R$ 7,49) ───────────────── */
byId("upsell-accept").addEventListener("click", () => {
  hideModal("upsell-offer");
  funnel.step = "UPSELL_CHECKOUT";
  selectAmount(PRICES.UPSELL, "Acesso Close Friends");
  createPixCharge();
});

byId("upsell-decline").addEventListener("click", () => {
  hideModal("upsell-offer");
  funnel.step = "UPSELL_DS1";
  showModal("upsell-ds1");
});

/* ── Upsell Downsell 1 (R$ 3,99) ───────────────── */
byId("upsell-ds1-accept").addEventListener("click", () => {
  hideModal("upsell-ds1");
  funnel.step = "UPSELL_CHECKOUT";
  selectAmount(PRICES.UPSELL_DS1, "Close Friends (60% OFF)");
  createPixCharge();
});

byId("upsell-ds1-decline").addEventListener("click", () => {
  hideModal("upsell-ds1");
  funnel.step = "UPSELL_DS2";
  showModal("upsell-ds2");
});

/* ── Upsell Downsell 2 (R$ 1,99) ─────── */
byId("upsell-ds2-accept").addEventListener("click", () => {
  hideModal("upsell-ds2");
  funnel.step = "UPSELL_CHECKOUT";
  selectAmount(PRICES.UPSELL_DS2, "Close Friends (oferta final)");
  createPixCharge();
});

byId("upsell-ds2-decline").addEventListener("click", () => {
  hideModal("upsell-ds2");
  completeFunnel();
});

/* ── Handlers existentes ───────────────────────────────── */
byId("paid-button").addEventListener("click", checkPayment);
byId("vip-button").addEventListener("click", openVipChannel);
byId("video-call-button").addEventListener("click", () => {
  if (telegram?.openTelegramLink) {
    telegram.openTelegramLink(VIDEO_CALL_URL);
  } else {
    window.open(VIDEO_CALL_URL, "_blank", "noopener,noreferrer");
  }
});
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

/* ── Envio do Instagram (Close Friends) ─────────────────── */
byId("cf-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = byId("cf-instagram-input");
  const submitBtn = byId("cf-submit-button");
  const errorEl = byId("cf-error");
  const feedbackEl = byId("cf-feedback");
  const handleEl = byId("cf-feedback-handle");

  errorEl.hidden = true;
  errorEl.textContent = "";

  const rawInstagram = input.value.trim().replace(/^@+/, "");
  if (!rawInstagram || rawInstagram.length < 2) {
    errorEl.textContent = "Por favor, digite um usuário válido do Instagram.";
    errorEl.hidden = false;
    input.focus();
    return;
  }

  const formattedHandle = `@${rawInstagram}`;
  submitBtn.disabled = true;
  submitBtn.textContent = "Enviando...";

  try {
    const response = await fetch("/api/instagram/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instagram: formattedHandle,
        chargeId: state.chargeId,
        plan: state.label || "Close Friends",
        amount: state.amount,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || "Não foi possível enviar o Instagram");
    }

    byId("cf-form").hidden = true;
    if (handleEl) handleEl.textContent = formattedHandle;
    if (feedbackEl) feedbackEl.hidden = false;
    telegram?.HapticFeedback?.notificationOccurred("success");
    telegram?.sendData(JSON.stringify({
      action: "close_friends_instagram",
      instagram: formattedHandle,
      chargeId: state.chargeId,
    }));
  } catch (err) {
    errorEl.textContent = err.message || "Erro ao enviar. Tente novamente.";
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Enviar meu Instagram";
  }
});
byId("back-button").addEventListener("click", () => { if (telegram) telegram.close(); else if (funnel.step === "IDLE") showModal("downsell-one"); });

/* ── Downsells de retenção (existentes) ────────────────── */
document.querySelector("[data-next-downsell]").addEventListener("click", () => { hideModal("downsell-one"); showModal("downsell-two"); });
document.querySelectorAll("[data-offer]").forEach(button => button.addEventListener("click", () => { hideModal("downsell-one"); hideModal("downsell-two"); selectAmount(button.dataset.offer, "Acesso VIP promocional"); createPixCharge(); }));
byId("final-exit").addEventListener("click", () => { hideModal("downsell-two"); telegram?.close(); });

/* ── Prova social ──────────────────────────────────────── */
const names = ["Thiago R.", "Lucas M.", "Rafael S.", "Bruno A.", "Marcos V.", "Felipe C.", "João P.", "André L."];
function showSocialProof() {
  byId("proof-name").textContent = names[Math.floor(Math.random() * names.length)];
  byId("social-proof").classList.add("show");
  setTimeout(() => byId("social-proof").classList.remove("show"), 4200);
}
setTimeout(showSocialProof, 1600);
setInterval(showSocialProof, 11000);
