function json(data, status = 200) {
  return Response.json(data, { status });
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Método não permitido" }, 405);
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!botToken || !adminChatId) {
    console.error("Variáveis TELEGRAM_BOT_TOKEN ou TELEGRAM_ADMIN_CHAT_ID não configuradas.");
    return json({ error: "Configuração do Telegram pendente no servidor" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const rawInstagram = body.instagram ? String(body.instagram).trim().replace(/^@+/, "") : "";
  if (!rawInstagram || rawInstagram.length < 2) {
    return json({ error: "Nome de usuário do Instagram inválido" }, 400);
  }

  const instagramHandle = `@${rawInstagram}`;
  const chargeId = body.chargeId || "Não informado";
  const plan = body.plan || "Acesso Close Friends";
  const amountFormatted = body.amount ? `R$ ${(Number(body.amount) / 100).toFixed(2).replace(".", ",")}` : "R$ 7,49";
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const message = [
    `⭐️ <b>NOVO CLOSE FRIENDS LIBERADO!</b>`,
    ``,
    `👤 <b>Instagram:</b> <code>${instagramHandle}</code>`,
    `🔗 <b>Perfil:</b> <a href="https://instagram.com/${rawInstagram}">instagram.com/${rawInstagram}</a>`,
    `📦 <b>Produto:</b> ${plan}`,
    `💰 <b>Valor:</b> ${amountFormatted}`,
    `🆔 <b>ID Transação:</b> <code>${chargeId}</code>`,
    `🕒 <b>Horário:</b> ${now}`,
  ].join("\n");

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      console.error("Telegram API error", response.status, result);
      return json({ error: "Erro ao enviar notificação no Telegram" }, 502);
    }

    return json({ success: true, instagram: instagramHandle });
  } catch (error) {
    console.error("Falha ao comunicar com a API do Telegram", error);
    return json({ error: "Gateway do Telegram indisponível" }, 502);
  }
}

export const config = {
  path: "/api/instagram/submit"
};
