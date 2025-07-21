const CSV_URLS = {
    outbound: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=1065872384&single=true&output=csv',
    inbound25k: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=1452707204&single=true&output=csv',
    inboundsdr: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=1002816741&single=true&output=csv',
    ranking: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=1518366484&single=true&output=csv',
    paas: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=976727502&single=true&output=csv'
}
const CARROSSEL_DISPLAY_TIME = 20000;
const ALERTA_DISPLAY_TIME = 5000;
const UPDATE_INTERVAL_MS = 300000;

let reunioesAgendadasAnterior = {};

let outboundData = [];
let inbound25kData = [];
let inboundsdrData = [];
let paasData = [];
let rankingData = [];
let rocketAnimationQueue = [];
let animationQueue = [];

let isRocketAnimating = false;
let isAnimating = false;

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
const reuniaoRollingAlertElement = document.getElementById('alerta-reuniao-rolando');
const reuniaoPersonPhotoElement = document.getElementById('reuniao-pessoa-foto');
const reuniaoMessageElement = document.getElementById('reuniao-mensagem');

const CATEGORIA_PARA_IMAGEM_MAP = {
    'OUTBOUND - GERAL': 'outbound_geral',
    'INBOUND - SDR CLOSER': 'inbound_sdr_closer',
    'INBOUND - 25K+' : 'inbound_25k',
    'PAAS - GERAL' : 'paas_geral'
}

const displayedMetaAlerts = new Set();
const displayedPersonMetaAlerts = new Set();

function handleAnimationEnd(){
    isAnimating = false;
    animationQueue.shift();
    processNextAnimationInQueue();
}

function showReuniaoRollingAlert(nomePessoa, fotoPessoaUrl){
    if(!reuniaoRollingAlertElement || !reuniaoPersonPhotoElement || !reuniaoMessageElement){
        console.error("Elementos do alerta reunião rolando não encontrados.");
        handleAnimationEnd();
        return;
    }

    console.log(`[ALERTA REUNIÃO ROLANDO] Disparando alerta para: ${nomePessoa}`);
    reuniaoPersonPhotoElement.src = fotoPessoaUrl;
    reuniaoMessageElement.textContent = `${nomePessoa} agendou reunião!`;

    reuniaoRollingAlertElement.style.setProperty('--alert-width', `${reuniaoRollingAlertElement.offsetWidth}px`);

    reuniaoRollingAlertElement.classList.remove('hidden');
    reuniaoRollingAlertElement.classList.add('active');

    reuniaoRollingAlertElement.addEventListener('animationend', () => {
        reuniaoRollingAlertElement.classList.remove('active');
        reuniaoRollingAlertElement.classList.add('hidden');
        handleAnimationEnd();
    }, {once : true});

    setTimeout(() => {
        if(reuniaoRollingAlertElement.classList.contains('active')){
            console.warn("[ALERTA REUNIÃO ROLANDO] Fallback de timeout acionado.");
            reuniaoRollingAlertElement.classList.remove('active');
            reuniaoRollingAlertElement.classList.add('hidden');
            handleAnimationEnd();
        }
    }, 6500);
}

function processNextAnimationInQueue(){
    if(animationQueue.length > 0 && !isAnimating){
        isAnimating = true;
        const nextAnimationFunction = animationQueue[0];
        nextAnimationFunction();
    }
}

function updateRankingAndCheckReunioes(novosDadosRanking){
    console.log("[updateRankingAndCheckReunioes] Novos Dados Ranking Recebidos:", novosDadosRanking);
    novosDadosRanking.forEach(pessoa => {
        const nome = pessoa.Pessoa;
        const reunioesAtuais = parseInt(pessoa['Reuniao Agendada'] || 0);
        
        const fotoUrl = `imagens/pessoas/${formatarNomePessoaParaImagem(nome)}`;

        console.log(`[DEBUG REUNIAO] Pessoa: ${nome}, Reuniões Anteriores: ${reunioesAgendadasAnterior[nome]}, Reuniões Atuais: ${reunioesAtuais}, URL da Foto (gerada): ${fotoUrl}`);

        if(reunioesAgendadasAnterior[nome] !== undefined && reunioesAtuais > reunioesAgendadasAnterior[nome]){
            const reunioesIncremento = reunioesAtuais - reunioesAgendadasAnterior[nome];
            console.log(`[ALERTA REUNIÃO - DISPARADO] ${nome} agendou mais ${reunioesIncremento} reunião(ões)! Total: ${reunioesAtuais}`);
            animationQueue.push(() => showReuniaoRollingAlert(nome, fotoUrl));

            if(!isAnimating){
                processNextAnimationInQueue();
            }
        }

        reunioesAgendadasAnterior[nome] = reunioesAtuais; 

        const listItem = document.querySelector(`li[data-nome="${nome}"]`);
        if(listItem){
            listItem.dataset.reunioes = reunioesAtuais;
            const reunioesSpan = listItem.querySelector('.reunioes-agendadas');
            if(reunioesSpan){
                reunioesSpan.textContent = `Reuniões: ${reunioesAtuais}`;
            }
        }
    });
}

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
    img.src = personPhotoUrl;
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

    rocketAlertElement.classList.remove('animate');
    rocketAlertElement.style.transition = 'none';
    rocketAlertElement.style.transform = 'translate(-10vw, 110vh) rotate(0deg)';
    rocketAlertElement.style.opacity = 0;
    rocketAlertElement.classList.remove('hidden');

    void rocketAlertElement.offsetWidth; 
    rocketAlertElement.style.transition = 'transform 4s ease-out, opacity 4s ease-out';
    rocketAlertElement.style.transform = 'translate(0, 0) rotate(0deg)';
    rocketAlertElement.style.opacity = 1;
    rocketAlertElement.classList.add('animate');

    rocketAlertElement.addEventListener('animationend', handleRocketAnimationEnd, { once: true });
    setTimeout(handleRocketAnimationEnd, 4500);
}

function handleRocketAnimationEnd() {
    console.log("[ROCKET ALERT] Animação do foguete finalizada.");
    rocketAlertElement.classList.remove('animate');
    rocketAlertElement.style.transition = 'none';
    rocketAlertElement.style.transform = 'translate(-10vw, 110vh) rotate(0deg)';
    rocketAlertElement.style.opacity = 0;
    rocketAlertElement.classList.add('hidden');
    
    isRocketAnimating = false; 
    processRocketQueue();
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

        while (values.length < normalizedHeaders.length) {
            values.push('');
        }
        if (values.length > normalizedHeaders.length) {
            values.splice(normalizedHeaders.length);
        }

        let row = {};
        for (let j = 0; j < normalizedHeaders.length; j++) {
            row[normalizedHeaders[j]] = values[j];
        } 
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

    updateFn();
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
        item.Pessoa && item.Pessoa.trim() !== ''
    );

    const allCloser = rankingData.filter(item => 
        item['Tipo Ranking'] && 
        item['Tipo Ranking'].trim().toUpperCase() === 'TOP 3' &&
        item.Pessoa && item.Pessoa.trim() !== ''
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

    const newRankingData = await fetchCsvData(CSV_URLS.ranking);

    updateRankingAndCheckReunioes(newRankingData);

    rankingData = newRankingData;
    console.log("Ranking Data carregado e processado para alertas:", rankingData.length);

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