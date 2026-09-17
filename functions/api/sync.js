export async function onRequest(context) {
  const { env } = context;
  const pass = env.CORREIOS_PASS;
  const user = env.CORREIOS_USER;
  const contrato = env.CORREIOS_CONTRATO;

  // Lógica de integração com os Correios...
  return new Response(JSON.stringify({ status: "OK" }), {
    headers: { "Content-Type": "application/json" }
  });
}
