const NEXUSPAG_URL = "https://nexuspag.com";

const PRODUCTS = new Map([
  [1699, "PACK VIP"],
  [3000, "VIP + Chamada de vídeo via WhatsApp"],
  [999, "Acesso VIP promocional"],
  [499, "Acesso VIP extremo"],
]);

function json(data, status = 200) {
  return Response.json(data, { status });
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json({ error: "Método não permitido" }, 405);
    }

    if (!process.env.NEXUSPAG_API_KEY) {
      return json({ error: "NEXUSPAG_API_KEY não configurada" }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "JSON inválido" }, 400);
    }

    const amountInCents = Number(body.amount);
    const product = PRODUCTS.get(amountInCents);
    if (!product) {
      return json({ error: "Produto ou preço inválido" }, 400);
    }

    const externalId = `miniapp-${crypto.randomUUID()}`;
    const origin = new URL(request.url).origin;
    const payload = {
      amount: amountInCents / 100,
      description: product,
      external_id: externalId,
      webhook_url: `${origin}/api/webhooks/nexuspag`,
      expiration: 1800,
    };

    try {
      const response = await fetch(`${NEXUSPAG_URL}/api/pix/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.NEXUSPAG_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.transaction) {
        console.error("NexusPag create error", response.status, result);
        return json({ error: "Não foi possível gerar o PIX" }, response.status >= 400 && response.status < 500 ? response.status : 502);
      }

      const transaction = result.transaction;
      return json({
        id: transaction.id,
        externalId: transaction.external_id,
        status: transaction.status,
        copyPasteCode: transaction.pix_copia_cola,
        qrCodeBase64: transaction.qr_code_base64,
        expiresAt: transaction.expires_at,
      });
    } catch (error) {
      console.error("NexusPag unavailable", error);
      return json({ error: "Gateway de pagamento indisponível" }, 502);
    }
  },
};
