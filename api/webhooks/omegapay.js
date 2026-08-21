function json(data, status = 200) {
  return Response.json(data, { status });
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Método não permitido" }, 405);
  }

  let event;
  try {
    event = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  console.log("Notificação de Webhook Omega Payments recebida:", event);

  // Status confirmados comuns
  const isPaid = (
    event.status === "PAID" ||
    event.status === "COMPLETED" ||
    event.status === "CONFIRMED" ||
    event.status === "OK" ||
    event.event === "payment.confirmed" ||
    event.event === "pix.paid"
  );

  if (isPaid) {
    console.log("✅ Pagamento confirmado via Omega Payments!", {
      transactionId: event.transactionId || event.id || event.identifier,
      amount: event.amount,
      status: event.status,
    });
  }

  return json({ received: true });
}

export const config = {
  path: "/api/webhooks/omegapay",
};
