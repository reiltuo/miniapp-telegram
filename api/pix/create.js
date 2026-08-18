const NEXUSPAG_URL = "https://nexuspag.com";

const VALID_PRODUCTS = {
  990:  ["PACK VIP"],
  1990: ["VIP + Chamada de vídeo"],
  999:  ["Acesso VIP promocional"],
  499:  ["Acesso VIP extremo"],
  1739: ["VIP + Chamada de vídeo (25% OFF)"],
  1489: ["VIP + Chamada de vídeo (50% OFF)"],
  749:  ["Chamada de vídeo", "Acesso Close Friends"],
  399:  ["Chamada de vídeo (60% OFF)", "Close Friends (60% OFF)"],
  199:  ["Chamada de vídeo (oferta final)", "Close Friends (oferta final)"],
};

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
    const clientDesc = body.description;
    
    const validDescriptions = VALID_PRODUCTS[amountInCents];
    if (!validDescriptions) {
      return json({ error: "Preço inválido" }, 400);
    }
    
    // Usa a descrição do cliente se for válida, senão usa a primeira padrão
    const product = validDescriptions.includes(clientDesc) ? clientDesc : validDescriptions[0];

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
