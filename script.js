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

    return `${nomeFormatado}.png`;
}

function showPersonAlertDialog(personImageFileName, personName) {
    alertaPessoaImagemEl.src = `imagens/pessoas/${personImageFileName}`;
    alertaPessoaImagemEl.alt = `Foto de ${personName}`;
    alertaPessoaNomeEl.textContent = personName;

    alertaPessoaPopupEl.classList.remove('hidden');
    alertaPessoaPopupEl.classList.add('active');

    setTimeout(() => {
        alertaPessoaPopupEl.classList.remove('active');
        alertaPessoaPopupEl.classList.add('hidden');
    }, ALERTA_DISPLAY_TIME);
}

async function fetchCsvData(url) {

    const cacheBusterUrl = `${url}&_=${new Date().getTime()}`;
    try{
        const response = await fetch(cacheBusterUrl);
        const csvText = await response.text();
        return parseCsv(csvText);
    }catch (error){
        console.error(`Erro ao buscar dados de ${url}:`, error);
        return [];
    }
}

function parseCsv(csv) {
    const rawLines = csv.split('\n').map(line => line.trim()).filter(line => line !== '');
    if (rawLines.length === 0) return [];

    let headerLineIndex = -1;
    for (let i = 0; i < rawLines.length; i++) {
        if (rawLines[i].startsWith('Métrica') || rawLines[i].startsWith('Tipo Ranking')) {
            headerLineIndex = i;
            break;
        }
    }

    if (headerLineIndex === -1) {
        console.error("Erro: Não foi possível encontrar a linha de cabeçalho válida no CSV.");
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

        console.log(`Linha ${i + 1} (raw): "${rawLines[i]}"`);
        console.log(`Linha ${i + 1} (parsed values):`, values);
        console.log(`Expected headers.length: ${normalizedHeaders.length}, Actual values.length: ${values.length}`);

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
        }

    }
}

function startCarousel(data, displayElement, currentIndex, intervalVar, categoryIdentifier) {
    if (!data || data.length === 0) {
        displayElement.innerHTML = "<p>Carregando dados...</p>";
        return;
    }

    if (intervalVar) {
        clearInterval(intervalVar);
    }

    const updateFn = () => {
        const currentItem = data[currentIndex];
        console.log(`[${categoryIdentifier}] Item a ser exibido no carrossel:`, currentItem);
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


    const allBDRSDR = rankingData.filter(item => 
        item['Tipo Ranking'] && 
        item['Tipo Ranking'].trim().toUpperCase() === 'TOP 5 BDR & SDR' &&
        item.Pessoa.trim() !== ''
    );

    const allCloser = rankingData.filter(item => 
        item['Tipo Ranking'] && 
        item['Tipo Ranking'].trim().toUpperCase() === 'TOP 3' &&
        item.Pessoa.trim() !== ''
    );

    const topBDRSDR = allBDRSDR.slice(0, 5);
    const topCloser = allCloser.slice(0, 3);

    topBDRSDR.forEach(person => {
        console.log("Ranking BDR/SDR - Objeto Pessoa:", person);
        const li = document.createElement('li');
        li.textContent = `${person.Pessoa}: ${person.Percentual}`;
        rankingBDRSDRList.appendChild(li);
        if (person['Meta Batida?'] && person['Meta Batida?'].toUpperCase() === 'SIM') {
            const personName = person.Pessoa;
            const personMetaId = `pessoa_${personName}_${person['Tipo Ranking']}`;

            if (!displayedPersonMetaAlerts.has(personMetaId)) {
                const personImageFileName = formatarNomePessoaParaImagem(personName);
                showPersonAlertDialog(personImageFileName, personName);
                displayedPersonMetaAlerts.add(personMetaId);
            }
        }
    });

    topCloser.forEach(person => {
        console.log("Ranking Closer - Objeto Pessoa:", person);
        const li = document.createElement('li');
        li.textContent = `${person.Pessoa}: ${person.Percentual}`;
        rankingCloserList.appendChild(li);
        if (person['Meta Batida?'] && person['Meta Batida?'].toUpperCase() === 'SIM') {
            const personName = person.Pessoa;
            const personMetaId = `pessoa_${personName}_${person['Tipo Ranking']}`;

            if (!displayedPersonMetaAlerts.has(personMetaId)) {
                const personImageFileName = formatarNomePessoaParaImagem(personName);
                showPersonAlertDialog(personImageFileName, personName);
                displayedPersonMetaAlerts.add(personMetaId);
            }
        }
    });
}

function showAlertDialog(imageFileName) {
    alertImageEl.src = `imagens/${imageFileName}`;
    alertImageEl.alt = "Meta Batida!";

    alertaPopupEl.classList.remove('hidden');
    alertaPopupEl.classList.add('active');
    setTimeout(() => {
        alertaPopupEl.classList.remove('active');
        alertaPopupEl.classList.add('hidden');
    }, ALERTA_DISPLAY_TIME);
}

async function initDashboard() {
    outboundData = await fetchCsvData(CSV_URLS.outbound);
    inbound25kData = await fetchCsvData(CSV_URLS.inbound25k);
    inboundsdrData = await fetchCsvData(CSV_URLS.inboundsdr);
    paasData = await fetchCsvData(CSV_URLS.paas);
    rankingData = await fetchCsvData(CSV_URLS.ranking);

    outboundInterval = startCarousel(outboundData, outboundCarrosselDisplay, outboundIndex, outboundInterval, CATEGORIA_PARA_IMAGEM_MAP["OUTBOUND - GERAL"]);
    inbound25kInterval = startCarousel(inbound25kData, inbound25kCarrosselDisplay, inbound25kIndex, inbound25kInterval, CATEGORIA_PARA_IMAGEM_MAP["INBOUND - 25K+"]);
    inboundsdrInterval = startCarousel(inboundsdrData, inboundsdrCarrosselDisplay, inboundsdrIndex, inboundsdrInterval, CATEGORIA_PARA_IMAGEM_MAP["INBOUND - SDR CLOSER"]);
    paasInterval = startCarousel(paasData, paasCarrosselDisplay, paasIndex, paasInterval, CATEGORIA_PARA_IMAGEM_MAP["PAAS - GERAL"]);


    updateRanking();
    updateLastUpdateTime();
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