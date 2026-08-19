const NEXUSPAG_URL = "https://nexuspag.com";

function json(data, status = 200) {
  return Response.json(data, { status });
}

export default async function handler(request) {
  if (request.method !== "GET") {
    return json({ error: "Método não permitido" }, 405);
  }

  const apiKey = process.env.NEXUSPAG_API_KEY;
  if (!apiKey) {
    return json({ error: "NEXUSPAG_API_KEY não configurada" }, 500);
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[a-zA-Z0-9_-]{8,120}$/.test(id)) {
    return json({ error: "Identificador inválido" }, 400);
  }

  try {
    const response = await fetch(`${NEXUSPAG_URL}/api/pix/${encodeURIComponent(id)}`, {
      headers: { "x-api-key": apiKey },
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("NexusPag status error", response.status, result);
      return json({ error: "Não foi possível consultar o pagamento" }, response.status === 404 ? 404 : 502);
    }

    return json({
      id: result.id,
      externalId: result.external_id,
      status: result.status,
      paidAt: result.paid_at,
      expiresAt: result.expires_at,
    });
  } catch (error) {
    console.error("NexusPag unavailable", error);
    return json({ error: "Gateway de pagamento indisponível" }, 502);
  }
}

export const config = {
  path: "/api/pix/status"
};
