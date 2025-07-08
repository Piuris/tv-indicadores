const CSV_URLS = {
    outbound: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=1065872384&single=true&output=csv',
    inbound25k: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=1452707204&single=true&output=csv',
    inboundsdr: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=1002816741&single=true&output=csv',
    ranking: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=1518366484&single=true&output=csv',
    paas: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=976727502&single=true&output=csv'
}
const CARROSSEL_DISPLAY_TIME = 8000;
const ALERTA_DISPLAY_TIME = 5000;
const UPDATE_INTERVAL_MS = 300000;

let outboundData = [];
let inbound25kData = [];
let inboundsdrData = [];
let paasData = [];
let rankingData = [];
let rocketAnimationQueue = [];

let isRocketAnimating = false;

let outboundIndex = 0;
let inbound25kIndex = 0;
let inboundsdrIndex = 0;
let paasIndex = 0;

let outboundInterval;
let inbound25kInterval;
let inboundsdrInterval;
let paasInterval;

const outboundCarrosselDisplay = document.querySelector('#carrossel-outbound .carrossel-item-display');
const inbound25kCarrosselDisplay = document.querySelector('#carrossel-inbound25k .carrossel-item-display');
const inboundsdrCarrosselDisplay = document.querySelector('#carrossel-inboundsdr .carrossel-item-display');
const paasCarrosselDisplay = document.querySelector('#carrossel-paas .carrossel-item-display');
const rankingBDRSDRList = document.getElementById('ranking-bdr-sdr');
const rankingCloserList = document.getElementById('ranking-closer');
const alertaPopupEl = document.getElementById('alerta-popup');
const alertImageEl = alertaPopupEl.querySelector('.alerta-imagem');
const alertaPessoaPopupEl = document.getElementById('alerta-pessoa-popup');
const alertaPessoaImagemEl = alertaPessoaPopupEl.querySelector('.alerta-pessoa-imagem');
const alertaPessoaNomeEl = alertaPessoaPopupEl.querySelector('.alerta-pessoa-nome');
const alertaPessoaTituloEl = alertaPessoaPopupEl.querySelector('.alerta-titulo-pessoa');
const rocketAlertElement = document.getElementById('alerta-foguete');
const rocketImgElement = document.getElementById('foguete-imagem');
const personImgElement = document.getElementById('pessoa-imagem');

const CATEGORIA_PARA_IMAGEM_MAP = {
    'OUTBOUND - GERAL': 'outbound_geral',
    'INBOUND - SDR CLOSER': 'inbound_sdr_closer',
    'INBOUND - 25K+' : 'inbound_25k',
    'PAAS - GERAL' : 'paas_geral'
}

const displayedMetaAlerts = new Set();
const displayedPersonMetaAlerts = new Set();

function formatarNomePessoaParaImagem(nomePessoa) {
    if (!nomePessoa) return 'pessoa_generica.png';
    let nomeFormatado = nomePessoa.toLowerCase()
                                    .replace(/[^a-z0-9\s-]/g, '')
                                    .replace(/\s+/g, '_')
                                    .replace(/-/g, '_');
    console.log(`[formatarNomePessoaParaImagem] Nome original: '${nomePessoa}', Formatado: '${nomeFormatado}.png'`);
    return `${nomeFormatado}.png`;
}

function showPersonAlertDialog(personImageFileName, personName) {
    alertaPessoaImagemEl.src = `imagens/pessoas/${personImageFileName}`;
    alertaPessoaImagemEl.alt = `Foto de ${personName}`;
    alertaPessoaNomeEl.textContent = personName;

    alertaPessoaPopupEl.classList.remove('hidden');
    alertaPessoaPopupEl.classList.add('active');

    console.log(`[Alerta Pessoa] Exibindo alerta para: ${personName} com imagem: ${personImageFileName}`);

    setTimeout(() => {
        alertaPessoaPopupEl.classList.remove('active');
        alertaPessoaPopupEl.classList.add('hidden');
        console.log(`[Alerta Pessoa] Escondendo alerta para: ${personName}`);
    }, ALERTA_DISPLAY_TIME);
}

function launchRocketAlert(personName){
    console.log(`[launchRocketAlert] Tentando lançar foguete para: ${personName}`);
    const personImageFileName = formatarNomePessoaParaImagem(personName);
    const personPhotoUrl = `imagens/pessoas/${personImageFileName}`;
    
    // Pre-carrega a imagem para evitar flickers e garantir que o onerror seja chamado se a imagem não existir
    const img = new Image();
    img.onload = () => {
        console.log(`[launchRocketAlert] Imagem de pessoa carregada com sucesso: ${personPhotoUrl}`);
        rocketAnimationQueue.push({name: personName, photoUrl: personPhotoUrl});
        if(!isRocketAnimating){
            processRocketQueue();
        }
    };
    img.onerror = () => {
        console.warn(`[ALERTA FOGUETE] Imagem NÃO encontrada para '${personName}': ${personPhotoUrl}. Usando genérica.`);
        const genericPhotoUrl = 'imagens/pessoas/pessoa_generica.png';
        rocketAnimationQueue.push({name: personName, photoUrl: genericPhotoUrl});
        if(!isRocketAnimating){
            processRocketQueue();
        }
    };
    img.src = personPhotoUrl; // Inicia o carregamento da imagem
}

function processRocketQueue() {
    if (rocketAnimationQueue.length === 0 || isRocketAnimating) {
        if (isRocketAnimating) {
            console.log("[ROCKET ALERT] Animação já está em andamento. Fila: ", rocketAnimationQueue.length);
        } else {
            console.log("[ROCKET ALERT] Fila de animação vazia.");
        }
        return;
    }

    isRocketAnimating = true;
    const { name, photoUrl } = rocketAnimationQueue.shift();

    console.log(`[ROCKET ALERT] Processando item da fila para: ${name} com foto: ${photoUrl}`);

    personImgElement.src = photoUrl;
    personImgElement.alt = `Foto de ${name}`;

    rocketAlertElement.classList.remove('animate'); // Remover a classe para resetar a animação
    rocketAlertElement.style.transition = 'none'; // Desativar transição para reposicionamento imediato
    rocketAlertElement.style.transform = 'translate(-10vw, 110vh) rotate(0deg)'; // Posição inicial fora da tela (inferior esquerdo)
    rocketAlertElement.style.opacity = 0; // Invisível no início
    rocketAlertElement.classList.remove('hidden'); // Certifica que o elemento não está hidden
    
    // Forçar reflow para aplicar os estilos de reset antes de iniciar a animação
    void rocketAlertElement.offsetWidth; 

    // Reativar transição e adicionar a classe para iniciar a animação
    rocketAlertElement.style.transition = 'transform 4s ease-out, opacity 4s ease-out'; // Duração e tipo de transição
    rocketAlertElement.style.transform = 'translate(0, 0) rotate(0deg)'; // Posição final da animação (onde ele deve "parar" no topo)
    rocketAlertElement.style.opacity = 1; // Visível durante a animação
    rocketAlertElement.classList.add('animate'); // Adiciona a classe que contém a keyframe animation

    // A animação keyframe do CSS (definida na classe .animate)
    // sobrescreve o 'transform' e 'opacity' definidos aqui no JS para a animação.
    // O que eu fiz acima garante que ele comece do canto inferior esquerdo e se torne visível
    // ANTES que a keyframe animation do CSS assuma o controle.

    // A animação real deve ser controlada por keyframes no CSS.
    // O JS apenas dispara o início, reposiciona, e lida com o fim.

    rocketAlertElement.addEventListener('animationend', handleRocketAnimationEnd, { once: true });
    // Adicionamos um fallback caso 'animationend' não dispare por algum motivo inesperado
    setTimeout(handleRocketAnimationEnd, 4500); // Exemplo: 500ms a mais que a duração da transição, se a animação não for keyframe
}

function handleRocketAnimationEnd() {
    console.log("[ROCKET ALERT] Animação do foguete finalizada.");
    // Resetar para o estado inicial/oculto
    rocketAlertElement.classList.remove('animate');
    rocketAlertElement.style.transition = 'none'; // Remover transição para esconder imediatamente
    rocketAlertElement.style.transform = 'translate(-10vw, 110vh) rotate(0deg)'; // Volta para a posição inicial oculta
    rocketAlertElement.style.opacity = 0; // Volta a ser invisível
    rocketAlertElement.classList.add('hidden'); // Esconde o elemento
    
    isRocketAnimating = false; 
    processRocketQueue(); // Tenta processar o próximo da fila
}

async function fetchCsvData(url) {
    const cacheBusterUrl = `${url}&_=${new Date().getTime()}`;
    try{
        console.log(`[fetchCsvData] Buscando dados de: ${cacheBusterUrl}`);
        const response = await fetch(cacheBusterUrl);
        if (!response.ok) {
            console.error(`[FETCH ERROR] Erro HTTP para ${url}: ${response.status} ${response.statusText}`);
            return [];
        }
        const csvText = await response.text();
        console.log(`[fetchCsvData] Dados recebidos de ${url}. Tamanho: ${csvText.length} caracteres.`);
        return parseCsv(csvText);
    }catch (error){
        console.error(`Erro ao buscar dados de ${url}:`, error);
        return [];
    }
}

function parseCsv(csv) {
    const rawLines = csv.split('\n').map(line => line.trim()).filter(line => line !== '');
    if (rawLines.length === 0) {
        console.warn("CSV vazio após filtragem.");
        return [];
    }

    let headerLineIndex = -1;
    for (let i = 0; i < rawLines.length; i++) {
        // Ajuste a verificação para 'Métrica' ou 'Tipo Ranking' se necessário.
        // Às vezes, há um BOM ou caracteres invisíveis no início.
        if (rawLines[i].startsWith('Métrica') || rawLines[i].startsWith('Tipo Ranking')) {
            headerLineIndex = i;
            break;
        }
    }

    if (headerLineIndex === -1) {
        console.error("Erro: Não foi possível encontrar a linha de cabeçalho válida no CSV.");
        console.error("Primeiras 5 linhas do CSV:", rawLines.slice(0, 5));
        return [];
    }

    const originalCsvHeaders = rawLines[headerLineIndex].split(',').map(header => header.trim());
    const normalizedHeaders = originalCsvHeaders.map(header => {
        if (header.toUpperCase() === 'META BATIDA') return 'Meta Batida?'; 
        if (header.toUpperCase().startsWith('NOVOS GAN')) return 'NOVOS GANHOS'; 
        if (header.toUpperCase().startsWith('TPV REALIZA')) return 'TPV REALIZADO';
        if (header.toUpperCase().startsWith('NOVO ROL R')) return 'NOVO ROL REALIZADA';
        return header;
    });

    console.log("Cabeçalhos Originais do CSV:", originalCsvHeaders);
    console.log("Cabeçalhos Normalizados (usados como chaves):", normalizedHeaders);

    const result = [];

    for (let i = headerLineIndex + 1; i < rawLines.length; i++) {
        const values = rawLines[i].split(',').map(value => value.trim());

        // Preenche com strings vazias se faltarem valores para o cabeçalho
        while (values.length < normalizedHeaders.length) {
            values.push('');
        }
        // Trunca se houver valores extras
        if (values.length > normalizedHeaders.length) {
            values.splice(normalizedHeaders.length);
        }

        let row = {};
        for (let j = 0; j < normalizedHeaders.length; j++) {
            row[normalizedHeaders[j]] = values[j];
        }
        // Adiciona um log para cada linha parseada para verificar os dados
        // console.log(`Linha ${i + 1} parseada:`, row); 
        result.push(row);
    }
    console.log("Resultado final do parseCsv (array de objetos):", result);
    return result;
}

function formatarNomeParaImagem(metrica, categoria){
    let categoriaFormatada = categoria.toLowerCase();
    let nomeFormatado = metrica.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '_').replace(/-/g, '_');
    console.log(`[formatarNomeParaImagem] Métrica: '${metrica}', Categoria: '${categoria}', Formatado: 'meta_${nomeFormatado}_${categoriaFormatada}.png'`);
    return `meta_${nomeFormatado}_${categoriaFormatada}.png`
}


function updateCarouselItem(displayElement, item, categoryIdentifier) {
    if (!item) {
        displayElement.innerHTML = "<p>Nenhum dado disponível.</p>";
        return;
    }
    displayElement.innerHTML = `
        <div class="metric-block">
            <h4>${item.Métrica || 'N/A'}</h4>
            <p><strong>Meta:</strong> ${item.Meta || 'N/A'}</p>
            <p><strong>Realizado:</strong> ${item.Realizado || 'N/A'}</p>
            <p><strong>Projetado:</strong> ${item.Projetado || 'N/A'}</p>
        </div>
        ${item['QTD MÊS -1'] ? `<div class="metric-block extra-metrics">
            <p><strong>QTD MÊS -1:</strong> ${item['QTD MÊS -1']}</p>
            <p><strong>QTD MÊS 0:</strong> ${item['QTD MÊS 0']}</p>
        </div>` : ''}
        ${item['TPV MÊS -1'] ? `<div class="metric-block extra-metrics">
            <p><strong>TPV MÊS -1:</strong> ${item['TPV MÊS -1']}</p>
            <p><strong>TPV MÊS 0:</strong> ${item['TPV MÊS 0']}</p>
        </div>` : ''}
        ${item['ROL MÊS -1'] ? `<div class="metric-block extra-metrics">
            <p><strong>ROL MÊS -1:</strong> ${item['ROL MÊS -1']}</p>
            <p><strong>ROL MÊS 0:</strong> ${item['ROL MÊS 0']}</p>
        </div>` : ''}
    `;

    if (item['Meta Batida?'] && item['Meta Batida?'].toUpperCase() === 'SIM') {
        const metricaNome = item.Métrica;
        const metaId = `${categoryIdentifier}_${metricaNome}`;
        if (!displayedMetaAlerts.has(metaId)){
            const nomeArquivoImagem = formatarNomeParaImagem(metricaNome, categoryIdentifier);
            showAlertDialog(nomeArquivoImagem);
            displayedMetaAlerts.add(metaId);
            console.log(`[Meta Batida Carrossel] Disparando alerta para meta: '${metricaNome}' na categoria '${categoryIdentifier}'`);
        } else {
            console.log(`[Meta Batida Carrossel] Alerta para meta: '${metricaNome}' já exibido. Ignorando.`);
        }
    }
}

function startCarousel(data, displayElement, currentIndex, intervalVar, categoryIdentifier) {
    if (!data || data.length === 0) {
        displayElement.innerHTML = "<p>Carregando dados...</p>";
        console.warn(`[startCarousel] Nenhum dado para o carrossel: ${categoryIdentifier}`);
        return;
    }

    if (intervalVar) {
        clearInterval(intervalVar);
    }

    const updateFn = () => {
        const currentItem = data[currentIndex];
        console.log(`[${categoryIdentifier}] Item a ser exibido no carrossel (Index: ${currentIndex}):`, currentItem);
        updateCarouselItem(displayElement, data[currentIndex], categoryIdentifier);
        currentIndex = (currentIndex + 1) % data.length;
        if (displayElement === outboundCarrosselDisplay) outboundIndex = currentIndex;
        else if (displayElement === inbound25kCarrosselDisplay) inbound25kIndex = currentIndex;
        else if (displayElement === inboundsdrCarrosselDisplay) inboundsdrIndex = currentIndex;
        else if (displayElement === paasCarrosselDisplay) paasIndex = currentIndex;
    };

    updateFn(); // Exibe o primeiro item imediatamente
    intervalVar = setInterval(updateFn, CARROSSEL_DISPLAY_TIME);
    return intervalVar;
}

function updateRanking() {
    rankingBDRSDRList.innerHTML = '';
    rankingCloserList.innerHTML = '';

    if (!rankingData || rankingData.length === 0) {
        console.warn("[updateRanking] Nenhum dado de ranking disponível.");
        rankingBDRSDRList.innerHTML = "<li>Nenhum dado de ranking BDR/SDR disponível.</li>";
        rankingCloserList.innerHTML = "<li>Nenhum dado de ranking Closer disponível.</li>";
        return;
    }

    const allBDRSDR = rankingData.filter(item => 
        item['Tipo Ranking'] && 
        item['Tipo Ranking'].trim().toUpperCase() === 'TOP 5 BDR & SDR' &&
        item.Pessoa && item.Pessoa.trim() !== '' // Verifica se a pessoa existe e não é vazia
    );

    const allCloser = rankingData.filter(item => 
        item['Tipo Ranking'] && 
        item['Tipo Ranking'].trim().toUpperCase() === 'TOP 3' &&
        item.Pessoa && item.Pessoa.trim() !== '' // Verifica se a pessoa existe e não é vazia
    );

    console.log("[updateRanking] Dados filtrados para BDR/SDR:", allBDRSDR);
    console.log("[updateRanking] Dados filtrados para Closer:", allCloser);

    const topBDRSDR = allBDRSDR.slice(0, 5);
    const topCloser = allCloser.slice(0, 3);

    if (topBDRSDR.length === 0) {
        rankingBDRSDRList.innerHTML = "<li>Nenhum top BDR/SDR para exibir.</li>";
    }
    topBDRSDR.forEach(person => {
        console.log("Ranking BDR/SDR - Objeto Pessoa:", person);
        const li = document.createElement('li');
        li.textContent = `${person.Pessoa}: ${person.Percentual || 'N/A'}`;
        rankingBDRSDRList.appendChild(li);
        if (person['Meta Batida?'] && person['Meta Batida?'].toUpperCase() === 'SIM') {
            const personName = person.Pessoa;
            const personMetaId = `pessoa_${personName}_${person['Tipo Ranking']}`;

            if (!displayedPersonMetaAlerts.has(personMetaId)) {
                console.log(`[Meta Batida Ranking] Disparando alerta de foguete para: '${personName}' (BDR/SDR)`);
                const personImageFileName = formatarNomePessoaParaImagem(personName);
                showPersonAlertDialog(personImageFileName, personName);
                launchRocketAlert(personName);
                displayedPersonMetaAlerts.add(personMetaId);
            } else {
                console.log(`[Meta Batida Ranking] Alerta para '${personName}' (BDR/SDR) já exibido. Ignorando.`);
            }
        }
    });

    if (topCloser.length === 0) {
        rankingCloserList.innerHTML = "<li>Nenhum top Closer para exibir.</li>";
    }
    topCloser.forEach(person => {
        console.log("Ranking Closer - Objeto Pessoa:", person);
        const li = document.createElement('li');
        li.textContent = `${person.Pessoa}: ${person.Percentual || 'N/A'}`;
        rankingCloserList.appendChild(li);
        if (person['Meta Batida?'] && person['Meta Batida?'].toUpperCase() === 'SIM') {
            const personName = person.Pessoa;
            const personMetaId = `pessoa_${personName}_${person['Tipo Ranking']}`;

            if (!displayedPersonMetaAlerts.has(personMetaId)) {
                console.log(`[Meta Batida Ranking] Disparando alerta de foguete para: '${personName}' (Closer)`);
                const personImageFileName = formatarNomePessoaParaImagem(personName);
                showPersonAlertDialog(personImageFileName, personName);
                launchRocketAlert(personName);
                displayedPersonMetaAlerts.add(personMetaId);
            } else {
                console.log(`[Meta Batida Ranking] Alerta para '${personName}' (Closer) já exibido. Ignorando.`);
            }
        }
    });
}

function showAlertDialog(imageFileName) {
    alertImageEl.src = `imagens/${imageFileName}`;
    alertImageEl.alt = "Meta Batida!";

    alertaPopupEl.classList.remove('hidden');
    alertaPopupEl.classList.add('active');
    console.log(`[Alerta Geral] Exibindo alerta de meta batida: ${imageFileName}`);
    setTimeout(() => {
        alertaPopupEl.classList.remove('active');
        alertaPopupEl.classList.add('hidden');
        console.log(`[Alerta Geral] Escondendo alerta de meta batida: ${imageFileName}`);
    }, ALERTA_DISPLAY_TIME);
}

async function initDashboard() {
    console.log("Iniciando Dashboard...");
    outboundData = await fetchCsvData(CSV_URLS.outbound);
    inbound25kData = await fetchCsvData(CSV_URLS.inbound25k);
    inboundsdrData = await fetchCsvData(CSV_URLS.inboundsdr);
    paasData = await fetchCsvData(CSV_URLS.paas);
    rankingData = await fetchCsvData(CSV_URLS.ranking);

    // Reinicia os carrosséis e seus índices a cada atualização
    outboundIndex = 0;
    inbound25kIndex = 0;
    inboundsdrIndex = 0;
    paasIndex = 0;

    outboundInterval = startCarousel(outboundData, outboundCarrosselDisplay, outboundIndex, outboundInterval, CATEGORIA_PARA_IMAGEM_MAP["OUTBOUND - GERAL"]);
    inbound25kInterval = startCarousel(inbound25kData, inbound25kCarrosselDisplay, inbound25kIndex, inbound25kInterval, CATEGORIA_PARA_IMAGEM_MAP["INBOUND - 25K+"]);
    inboundsdrInterval = startCarousel(inboundsdrData, inboundsdrCarrosselDisplay, inboundsdrIndex, inboundsdrInterval, CATEGORIA_PARA_IMAGEM_MAP["INBOUND - SDR CLOSER"]);
    paasInterval = startCarousel(paasData, paasCarrosselDisplay, paasIndex, paasInterval, CATEGORIA_PARA_IMAGEM_MAP["PAAS - GERAL"]);

    updateRanking();
    updateLastUpdateTime();
    console.log("Dashboard atualizado.");
}

function updateLastUpdateTime(){
    let lastUpdateElement = document.getElementById('last-update');
    if(!lastUpdateElement){
        lastUpdateElement = document.createElement('p');
        lastUpdateElement.id = 'last-update';
        lastUpdateElement.style.color = '#A8A7BC';
        lastUpdateElement.style.fontSize = '0.9em';
        lastUpdateElement.style.marginTop = '20px';
        document.getElementById('main-content-wrapper').appendChild(lastUpdateElement);
    }
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    lastUpdateElement.textContent = `última atualização: ${formattedTime}`;
}

initDashboard();

setInterval(initDashboard, UPDATE_INTERVAL_MS);