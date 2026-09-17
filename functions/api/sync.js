export async function onRequest(context) {
    const { env } = context;

    // Resgata as credenciais cadastradas nas Variáveis do Cloudflare
    const codAdmin = env.CORREIOS_COD_ADMIN;
    const user = env.CORREIOS_USER;
    const pass = env.CORREIOS_PASS;

    if (!codAdmin || !user || !pass) {
        return new Response(JSON.stringify({ error: "Credenciais ausentes no servidor." }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Obtém a data de hoje no formato DD/MM/YYYY exigido pelos Correios
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dataConsulta = `${dd}/${mm}/${yyyy}`;

    // Monta o Envelope SOAP do método acompanharPedidoPorData (Anexo do Manual)
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

    try {
        // Dispara a requisição HTTP com os cabeçalhos de segurança e autenticação CWS
        const response = await fetch('https://logisticareversa.correios.com.br/logisticaReversaWS/logisticareversaWS', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml;charset=UTF-8',
                'Authorization': 'Basic ' + btoa(`${user}:${pass}`),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: xmlBody
        });

        if (!response.ok) {
            return new Response(JSON.stringify({ error: `Erro HTTP Correios: ${response.status}` }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const xmlText = await response.text();

        // Extrai cada bloco de objeto (<coleta>) do XML retornado
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
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
