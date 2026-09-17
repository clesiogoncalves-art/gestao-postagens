export async function onRequest(context) {
    // Lê a variável de ambiente cadastrada no Cloudflare
    const token = context.env.CLICKUP_TOKEN || context.env.CORREIOS_USER;

    return new Response(JSON.stringify({ message: "Backend conectado com sucesso!", token_status: !!token }), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}