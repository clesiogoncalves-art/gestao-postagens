export async function onRequest(context) {
    const { env } = context;

    // Resgata as variáveis configuradas no painel do Cloudflare
    const codAdmin = env.CORREIOS_COD_ADMIN;
    const user = env.CORREIOS_USER;
    const pass = env.CORREIOS_PASS;

    if (!codAdmin || !user || !pass) {
        return new Response(JSON.stringify({ error: "Credenciais ausentes no servidor." }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // Exemplo de corpo SOAP exigido pela API dos Correios (BuscaEventosLista)
        const xmlBody = `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:res="http://resource.webservice.correios.com.br/">
               <soapenv:Header/>
               <soapenv:Body>
                  <res:buscaEventosLista>
                     <usuario>${user}</usuario>
                     <senha>${pass}</senha>
                     <tipo>L</tipo>
                     <resultado>T</resultado>
                     <lingua>101</lingua>
                     <!-- IMPORTANTE: Substitua pelos seus objetos ou implemente a lógica de busca do CWS -->
                     <objetos>AA123456789BR</objetos> 
                  </res:buscaEventosLista>
               </soapenv:Body>
            </soapenv:Envelope>
        `;

        const correiosResponse = await fetch('https://webservice.correios.com.br/service/rastro', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml;charset=UTF-8',
                'SOAPAction': ''
            },
            body: xmlBody
        });

        if (!correiosResponse.ok) {
            return new Response(JSON.stringify({ error: `Erro na API dos Correios: ${correiosResponse.status}` }), {
                status: correiosResponse.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const xmlText = await correiosResponse.text();
        
        // Aqui você faria o Parse do XML retornado pelos Correios
        // Para este exemplo, vamos retornar um mock no formato esperado pelo seu HTML
        
        const dataFormatada = [
            {
                objeto: "AA123456789BR",
                dataSolicitacao: "17/09/2026 10:00",
                dataPostagem: "17/09/2026 14:00",
                remetente: "Sillion Teste",
                cidade: "Belo Horizonte",
                uf: "MG",
                status: "Objeto postado"
            }
        ];

        return new Response(JSON.stringify(dataFormatada), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
