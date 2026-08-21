const OMEGA_API_URL = "https://app.omegapayments.com.br/api/v1/gateway/pix/receive";

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

// Gerador de CPF válido para compras anônimas seguras
function generateValidCPF() {
  const r = () => Math.floor(Math.random() * 9);
  const n = [r(), r(), r(), r(), r(), r(), r(), r(), r()];
  let d1 = n.reduce((acc, v, i) => acc + v * (10 - i), 0) % 11;
  d1 = d1 < 2 ? 0 : 11 - d1;
  n.push(d1);
  let d2 = n.reduce((acc, v, i) => acc + v * (11 - i), 0) % 11;
  d2 = d2 < 2 ? 0 : 11 - d2;
  n.push(d2);
  return `${n.slice(0,3).join("")}.${n.slice(3,6).join("")}.${n.slice(6,9).join("")}-${n.slice(9).join("")}`;
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Método não permitido" }, 405);
  }

  const publicKey = process.env.OMEGA_PUBLIC_KEY;
  const secretKey = process.env.OMEGA_SECRET_KEY;

  if (!publicKey || !secretKey) {
    console.error("OMEGA_PUBLIC_KEY ou OMEGA_SECRET_KEY não configuradas.");
    return json({ error: "Chaves da Omega Payments não configuradas no servidor" }, 500);
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

  const product = validDescriptions.includes(clientDesc) ? clientDesc : validDescriptions[0];
  const amountInReais = Number((amountInCents / 100).toFixed(2));

  const uniqueIdentifier = `miniapp-${crypto.randomUUID().slice(0, 18)}`;
  const origin = new URL(request.url).origin;

  const payload = {
    identifier: uniqueIdentifier,
    amount: amountInReais,
    client: {
      name: "Cliente Telegram",
      email: "cliente.telegram@miniapp.com",
      phone: "(11) 98765-4321",
      document: generateValidCPF(),
    },
    products: [
      {
        id: `prod-${amountInCents}`,
        name: product,
        quantity: 1,
        price: amountInReais,
      },
    ],
    callbackUrl: `${origin}/api/webhooks/omegapay`,
  };

  try {
    const response = await fetch(OMEGA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-public-key": publicKey,
        "x-secret-key": secretKey,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.pix?.code) {
      console.error("Erro ao criar PIX na Omega Payments:", response.status, result);
      const errMsg = result.message || result.error || "Não foi possível gerar a cobrança PIX";
      return json({ error: errMsg }, response.status >= 400 && response.status < 500 ? response.status : 502);
    }

    const pixCode = result.pix.code;
    const qrImageUrl = result.pix.image || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCode)}`;

    return json({
      id: result.transactionId || uniqueIdentifier,
      externalId: uniqueIdentifier,
      status: result.status || "OK",
      copyPasteCode: pixCode,
      qrCodeImage: qrImageUrl,
      qrCodeBase64: result.pix.base64 || "",
    });
  } catch (error) {
    console.error("Omega Payments indisponível", error);
    return json({ error: "Gateway de pagamento indisponível" }, 502);
  }
}

export const config = {
  path: "/api/pix/create",
};
