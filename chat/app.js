const messages = document.querySelector("#messages");
const composer = document.querySelector("#composer");
const input = document.querySelector("#lead-input");
const sendButton = document.querySelector("#send-button");
const statusLabel = document.querySelector("#contact-status");
const pixModal = document.querySelector("#pix-modal");

const state = {
  step: 0,
  offerStartedAt: 0,
  amount: 3990,
  chargeId: null,
  firstDownsell: null,
  finalDownsell: null,
  statusPolling: null,
};

const scripts = [
  [
    "Oi, posso falar com você por aqui? Este atendimento é automático, mas preparei tudo para explicar como funciona.",
    "Faço uma chamada de vídeo privada para maiores de 18 anos, sem encontro presencial e com pagamento único pelo PIX.",
    "Antes de eu te mostrar os horários, me diz: você procura uma conversa mais tranquila ou algo mais provocante?",
  ],
  [
    "Entendi. A chamada é personalizada e acontece em um ambiente reservado. Você escolhe o ritmo da conversa.",
    "Tenho uma vaga disponível hoje. Qual período funciona melhor para você?",
  ],
  [
    "Consigo organizar nesse período. O acesso custa R$ 39,90 e a confirmação é imediata pelo PIX.",
    "Assim que o pagamento for confirmado, você recebe a orientação para iniciar a chamada.",
  ],
];

function now() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function scrollToLatest() {
  messages.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
}

function addMessage(text, direction = "incoming") {
  const template = document.querySelector(`#${direction}-template`);
  const fragment = template.content.cloneNode(true);
  fragment.querySelector("p").textContent = text;
  fragment.querySelector("time").textContent = now();
  messages.append(fragment);
  scrollToLatest();
}

function showTyping() {
  statusLabel.textContent = "digitando...";
  const bubble = document.createElement("article");
  bubble.className = "message incoming typing";
  bubble.id = "typing";
  bubble.innerHTML = "<i></i><i></i><i></i>";
  messages.append(bubble);
  scrollToLatest();
}

function hideTyping() {
  document.querySelector("#typing")?.remove();
  statusLabel.textContent = "atendimento automatizado";
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function sendSequence(sequence) {
  disableComposer();
  for (const text of sequence) {
    showTyping();
    await wait(900 + Math.min(text.length * 9, 900));
    hideTyping();
    addMessage(text);
    await wait(420);
  }
  enableComposer();
}

function enableComposer() {
  input.disabled = false;
  sendButton.disabled = false;
  input.placeholder = "Digite qualquer resposta";
  input.focus();
}

function disableComposer() {
  input.disabled = true;
  sendButton.disabled = true;
}

function money(amount) {
  return (amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function addOffer({ amount, oldAmount, title, description, className = "" }) {
  state.amount = amount;
  const card = document.createElement("section");
  card.className = `offer-card ${className}`;
  card.innerHTML = `
    <small>${title}</small>
    <strong>${oldAmount ? `<del>${money(oldAmount)}</del>` : ""}${money(amount)}</strong>
    <p>${description}</p>
    <button type="button">Gerar PIX e reservar</button>
  `;
  card.querySelector("button").addEventListener("click", () => createPix(amount));
  messages.append(card);
  scrollToLatest();
}

function startDownsells() {
  state.offerStartedAt = Date.now();
  state.firstDownsell = setTimeout(() => {
    addMessage("Ainda está pensando? Liberei uma condição automática por tempo limitado para você não perder a vaga.");
    addOffer({ amount: 1995, oldAmount: 3990, title: "50% de desconto", description: "Mesma chamada privada por R$ 19,95.", className: "discount" });
  }, 30_000);

  state.finalDownsell = setTimeout(() => {
    addMessage("Esta é a última condição disponível. Depois dela, o valor volta ao normal.");
    addOffer({ amount: 998, oldAmount: 3990, title: "75% de desconto", description: "Última oportunidade por R$ 9,98.", className: "final" });
  }, 120_000);
}

async function advanceConversation(response) {
  addMessage(response, "outgoing");
  input.value = "";
  if (state.step === 0) {
    state.step = 1;
    await sendSequence(scripts[1]);
    return;
  }
  if (state.step === 1) {
    state.step = 2;
    await sendSequence(scripts[2]);
    disableComposer();
    addOffer({ amount: 3990, title: "Chamada de vídeo privada", description: "Pagamento único e confirmação imediata." });
    startDownsells();
    return;
  }
  addMessage("O pagamento pode ser feito no botão de reserva acima.");
}

composer.addEventListener("submit", event => {
  event.preventDefault();
  const response = input.value.trim();
  if (response) advanceConversation(response);
});

async function createPix(amount) {
  clearTimeout(state.firstDownsell);
  clearTimeout(state.finalDownsell);
  state.amount = amount;
  document.querySelector("#pix-total").textContent = money(amount);
  document.querySelector("#pix-code").value = "Gerando cobrança...";
  document.querySelector("#qr-image").removeAttribute("src");
  document.querySelector("#payment-status").textContent = "";
  pixModal.hidden = false;

  try {
    const response = await fetch("/api/pix/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const charge = await response.json();
    if (!response.ok) throw new Error(charge.error || "Não foi possível gerar o PIX");

    state.chargeId = charge.id;
    document.querySelector("#pix-code").value = charge.copyPasteCode;
    document.querySelector("#qr-image").src = charge.qrCodeBase64;
    clearInterval(state.statusPolling);
    state.statusPolling = setInterval(checkPayment, 5000);
  } catch (error) {
    document.querySelector("#payment-status").textContent = error.message;
  }
}

async function checkPayment() {
  if (!state.chargeId) return;
  const response = await fetch(`/api/pix/status?id=${encodeURIComponent(state.chargeId)}`);
  if (!response.ok) return;
  const payment = await response.json();
  if (payment.status === "paid") {
    clearInterval(state.statusPolling);
    clearTimeout(state.firstDownsell);
    clearTimeout(state.finalDownsell);
    document.querySelector("#payment-status").textContent = "Pagamento confirmado. Sua chamada foi reservada.";
  }
}

document.querySelector("#confirm-age").addEventListener("click", async () => {
  document.querySelector("#age-gate").remove();
  await sendSequence(scripts[0]);
});

document.querySelector("#leave-page").addEventListener("click", () => location.replace("about:blank"));
document.querySelector(".back-button").addEventListener("click", () => history.back());
document.querySelector("#close-pix").addEventListener("click", () => { pixModal.hidden = true; });
document.querySelector("#check-payment").addEventListener("click", checkPayment);
document.querySelector("#copy-pix").addEventListener("click", async () => {
  await navigator.clipboard.writeText(document.querySelector("#pix-code").value);
  document.querySelector("#copy-pix").textContent = "Copiado";
  setTimeout(() => { document.querySelector("#copy-pix").textContent = "Copiar"; }, 1400);
});
