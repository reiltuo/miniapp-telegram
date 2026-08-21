function json(data, status = 200) {
  return Response.json(data, { status });
}

export default async function handler(request) {
  if (request.method !== "GET") {
    return json({ error: "Método não permitido" }, 405);
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return json({ error: "Identificador não informado" }, 400);
  }

  const publicKey = process.env.OMEGA_PUBLIC_KEY;
  const secretKey = process.env.OMEGA_SECRET_KEY;

  if (publicKey && secretKey) {
    try {
      const response = await fetch(`https://app.omegapayments.com.br/api/v1/gateway/transactions/${encodeURIComponent(id)}`, {
        headers: {
          "x-public-key": publicKey,
          "x-secret-key": secretKey,
        },
      });

      if (response.ok) {
        const result = await response.json().catch(() => ({}));
        const status = result.status === "PAID" || result.status === "COMPLETED" || result.status === "CONFIRMED" ? "paid" : "pending";
        return json({ id, status });
      }
    } catch {}
  }

  // Fallback padrão de resposta de status
  return json({
    id: id,
    status: "pending",
  });
}

export const config = {
  path: "/api/pix/status",
};
