const LINKS = {
  conteudos: "https://t.me/+Web0AlQBgcYwM2Zh",
  chamada: "https://t.me/chamadavivibot",
};

const claimedIps = new Map();

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers });
}

export default async function handler(request) {
  const url = new URL(request.url);

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

  const forwardedHeader = request.headers.get("x-forwarded-for") || request.headers.get("client-ip");
  const clientIp = (forwardedHeader ? forwardedHeader.split(",")[0].trim() : null) ||
                   request.headers.get("x-real-ip") ||
                   "unknown_ip";

  const cookieHeader = request.headers.get("cookie") || "";
  const cookieKey = `claimed_${type}=true`;
  const hasClaimCookie = cookieHeader.includes(cookieKey);

  const ipKey = `${clientIp}_${type}`;
  const now = Date.now();

  if (hasClaimCookie || (clientIp !== "unknown_ip" && claimedIps.has(ipKey))) {
    return json({
      error: "Acesso já utilizado. Este link só pode ser resgatado 1 única vez por dispositivo/IP.",
      alreadyClaimed: true,
      type: type,
    }, 403);
  }

  if (clientIp !== "unknown_ip") {
    claimedIps.set(ipKey, now);
  }

  const cookieSet = `claimed_${type}=true; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`;
  const targetUrl = LINKS[type];

  if (url.searchParams.get("redirect") === "1") {
    return Response.redirect(targetUrl, 302, {
      headers: { "Set-Cookie": cookieSet }
    });
  }

  return json({
    success: true,
    type: type,
    url: targetUrl,
  }, 200, {
    "Set-Cookie": cookieSet,
  });
}

export const config = {
  path: "/api/access/claim"
};
