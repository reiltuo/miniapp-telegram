const LINKS = {
  conteudos: "https://t.me/+Web0AlQBgcYwM2Zh",
  chamada: "https://t.me/chamadavivibot",
};

// Armazenamento em memória para tracking de IPs por tipo de acesso
const claimedIps = new Map();

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers });
}

export default {
  async fetch(request) {
    const origin = new URL(request.url).origin;
    const url = new URL(request.url);

    // Extrair o tipo de acesso solicitado
    let type = url.searchParams.get("type");
    if (request.method === "POST") {
      try {
        const body = await request.json();
        if (body?.type) type = body.type;
      } catch {}
    }

    if (!type || !LINKS[type]) {
      return json({ error: "Tipo de acesso inválido. Use 'conteudos' ou 'chamada'." }, 400);
    }

    // Extrair o IP real do cliente
    const forwardedHeader = request.headers.get("x-forwarded-for");
    const clientIp = (forwardedHeader ? forwardedHeader.split(",")[0].trim() : null) ||
                     request.headers.get("x-real-ip") ||
                     "unknown_ip";

    // Verificar se já possui cookie de reivindicação
    const cookieHeader = request.headers.get("cookie") || "";
    const cookieKey = `claimed_${type}=true`;
    const hasClaimCookie = cookieHeader.includes(cookieKey);

    // Chave única de IP + Tipo
    const ipKey = `${clientIp}_${type}`;
    const now = Date.now();

    // Se o IP ou Cookie já resgatou este link
    if (hasClaimCookie || (clientIp !== "unknown_ip" && claimedIps.has(ipKey))) {
      const claimDate = claimedIps.get(ipKey) || "anteriormente";
      return json({
        error: "Acesso já utilizado. Este link só pode ser resgatado 1 única vez por dispositivo/IP.",
        alreadyClaimed: true,
        type: type,
      }, 403);
    }

    // Registrar o resgate do IP
    if (clientIp !== "unknown_ip") {
      claimedIps.set(ipKey, now);
    }

    // Definir cookie duradouro para bloquear novo clique neste navegador
    const cookieSet = `claimed_${type}=true; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`;

    const targetUrl = LINKS[type];

    // Se for requisição GET direta de redirecionamento
    if (url.searchParams.get("redirect") === "1") {
      return Response.redirect(targetUrl, 302, {
        headers: { "Set-Cookie": cookieSet }
      });
    }

    // Resposta padrão JSON para o frontend
    return json({
      success: true,
      type: type,
      url: targetUrl,
    }, 200, {
      "Set-Cookie": cookieSet,
    });
  },
};
