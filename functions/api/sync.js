export async function onRequest(context) {
    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*'
    };

    if (context.request.method === 'OPTIONS') {
        return new Response(null, { headers });
    }

    try {
        const env = context.env || {};
        const codAdmin = env.CORREIOS_COD_ADMIN;
        const user = env.CORREIOS_USER;
        const pass = env.CORREIOS_PASS;

        if (!codAdmin || !user || !pass) {
            return new Response(JSON.stringify({ 
                status: 'error',
                message: "Credenciais não encontradas nas variáveis do Cloudflare.",
                debug: { codAdmin: !!codAdmin, user: !!user, pass: !!pass }
            }), { status: 200, headers });
        }

        // Codificação Base64 compatível com o Cloudflare Worker
        const authString = `${user}:${pass}`;
        const base64Auth = btoa(authString);

        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        const dataConsulta = `${dd}/${mm}/${yyyy}`;

        const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.logisticareversa.correios.com.br/">
   <soapenv:Header/>
   <soapenv:Body>
      <ser:acompanharPedidoPorData>
         <codAdministrativo>${codAdmin}</codAdministrativo>
         <tipoSolicitacao>A</tipoSolicitacao>
         <data>${dataConsulta}</data>
      </ser:acompanharPedidoPorData>
   </soapenv:Body>
</soapenv:Envelope>`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        let response;
        try {
            response = await fetch('https://logisticareversa.correios.com.br/logisticaReversaWS/logisticareversaWS', {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml;charset=UTF-8',
                    'Authorization': `Basic ${base64Auth}`,
                    'User-Agent': 'Mozilla/5.0'
                },
                body: xmlBody,
                signal: controller.signal
            });
        } catch (netErr) {
            clearTimeout(timeoutId);
            return new Response(JSON.stringify({
                status: 'warning',
                message: 'Servidor dos Correios não respondeu dentro do tempo limite.',
                details: netErr.message
            }), { status: 200, headers });
        }
        clearTimeout(timeoutId);

        const xmlText = await response.text();

        if (!response.ok) {
            return new Response(JSON.stringify({
                status: 'error',
                message: `Correios retornaram HTTP ${response.status}`,
                raw: xmlText.substring(0, 200)
            }), { status: 200, headers });
        }

        const coletasMatches = xmlText.match(/<coleta>[\s\S]*?<\/coleta>/g) || [];

        const listaFormatada = coletasMatches.map(itemXml => {
            const getTag = (tag) => {
                const m = itemXml.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`));
                return m ? m[1].trim() : '';
            };

            const etiqueta = getTag('numero_etiqueta');
            const pedido = getTag('numero_pedido');
            const statusDesc = getTag('descricao_status');
            const dataAtt = getTag('data_atualizacao');
            const remetenteCtrl = getTag('controle_cliente');

            return {
                objeto: etiqueta || pedido || 'S/N',
                dataSolicitacao: dataAtt || dataConsulta,
                dataPostagem: dataAtt || '-',
                difDias: '0 dia(s)',
                remetente: remetenteCtrl || 'Não Informado',
                cidade: 'Origem Correios',
                uf: 'MG',
                status: statusDesc || 'Aguardando Objeto na Agência'
            };
        });

        return new Response(JSON.stringify(listaFormatada), { status: 200, headers });

    } catch (err) {
        return new Response(JSON.stringify({ 
            status: 'error',
            message: 'Erro interno na função Cloudflare',
            error: err.stack || err.message || String(err)
        }), { status: 200, headers });
    }
}
