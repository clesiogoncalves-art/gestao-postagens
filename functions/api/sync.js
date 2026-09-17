export async function onRequest(context) {
    try {
        const env = context.env || {};

        const codAdmin = env.CORREIOS_COD_ADMIN;
        const user = env.CORREIOS_USER;
        const pass = env.CORREIOS_PASS;

        if (!codAdmin || !user || !pass) {
            return new Response(JSON.stringify({ 
                error: "Credenciais ausentes nas variáveis do Cloudflare.", 
                details: { COD_ADMIN: !!codAdmin, USER: !!user, PASS: !!pass } 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

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

        const authString = `${user}:${pass}`;
        const base64Auth = typeof btoa === 'function' 
            ? btoa(unescape(encodeURIComponent(authString))) 
            : '';

        const response = await fetch('https://logisticareversa.correios.com.br/logisticaReversaWS/logisticareversaWS', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml;charset=UTF-8',
                'Authorization': `Basic ${base64Auth}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            body: xmlBody
        });

        const xmlText = await response.text();

        if (!response.ok) {
            return new Response(JSON.stringify({ 
                error: `Correios retornaram HTTP ${response.status}`, 
                respostaBruta: xmlText.substring(0, 300) 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        const coletasMatches = xmlText.match(/<coleta>[\s\S]*?<\/coleta>/g) || [];

        const listaFormatada = coletasMatches.map(itemXml => {
            const extract = (tag) => {
                const m = itemXml.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`));
                return m ? m[1].trim() : '';
            };

            const etiqueta = extract('numero_etiqueta');
            const pedido = extract('numero_pedido');
            const statusDesc = extract('descricao_status');
            const dataAtt = extract('data_atualizacao');
            const remetenteCtrl = extract('controle_cliente');

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

        return new Response(JSON.stringify(listaFormatada), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ 
            error: "Falha na execução do Cloudflare Worker", 
            mensagem: err.message || String(err) 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}
