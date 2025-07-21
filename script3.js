// **IMPORTANTE**: Substitua os URLs abaixo pelos URLs CSV que você publicou
const GOOGLE_SHEETS_CSV_URLS = {
    "OUTBOUND - GERAL": "https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=1065872384&single=true&output=csv",
    "INBOUND - SDR CLOSER": "https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=1002816741&single=true&output=csv",
    "INBOUND - 25K+": "https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=1452707204&single=true&output=csv",
    "PAAS - GERAL": "https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=976727502&single=true&output=csv",
    "RANKING MÊS META": "https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=1518366484&single=true&output=csv"
};

const categories = [
    { name: "OUTBOUND - GERAL", urlKey: "OUTBOUND - GERAL" },
    { name: "INBOUND - SDR CLOSER", urlKey: "INBOUND - SDR CLOSER" },
    { name: "INBOUND - 25K+", urlKey: "INBOUND - 25K+" },
    { name: "PAAS - GERAL", urlKey: "PAAS - GERAL" },
    { name: "RANKING MÊS META", urlKey: "RANKING MÊS META" }
];

let currentCategoryIndex = 0;
let intervalId;
const dashboardIntervalTime = 60000; // Tempo em milissegundos para trocar de aba (1 minuto)

const dashboardContainer = document.getElementById('dashboard-container');
const dashboardTitle = document.getElementById('dashboard-title');
const metricsGrid = document.getElementById('metrics-grid');
const loadingSpinner = document.getElementById('loading-spinner');

// Mapeamento de Categoria para o formato do nome da imagem
const CATEGORIA_PARA_IMAGEM_MAP = {
    'OUTBOUND - GERAL': 'outbound_geral',
    'INBOUND - SDR CLOSER': 'inbound_sdr_closer',
    'INBOUND - 25K+': 'inbound_25k',
    'PAAS - GERAL': 'paas_geral'
};

// **NOVIDADES PARA A FILA DE ALERTAS**
const alertQueue = []; // A fila de alertas
let isAlertShowing = false; // Flag para controlar se um alerta já está em exibição
const lastAlertTime = {}; // Para controlar o tempo do último alerta por métrica e evitar spam
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

const rocketAlertQueue = [];
let isRocketAlertShowing = false;
const LAST_RANKING_ALERT_TIME = {};
const RANKING_ALERT_COOLDOWN_MS = 60 * 60 * 1000;

const newMeetingAlertQueue = [];
let isNewMeetingAlertShowing = false;
const NEW_MEETING_ALERT_COOLDOWN_MS = 10 * 60 * 1000;


// Mapa para rastrear quais alertas já foram exibidos **nesta sessão/rodada da categoria**
// Isso evita que o pop-up apareça múltiplas vezes para a mesma métrica na mesma categoria
// durante um único ciclo de renderização. Será resetado ao carregar nova categoria.
let displayedAlertsForCategory = {};
let displayedRankingAlertsForCategory = {};
let displayedNewMeetingAlertsForCategory = {};

let lastKnownMeetings = JSON.parse(localStorage.getItem('lastKnownMeetings')) || {};

// Função para formatar o nome da métrica e categoria para o nome do arquivo da imagem
function formatarNomeParaImagem(metrica, categoria) {
    let categoriaFormatada = CATEGORIA_PARA_IMAGEM_MAP[categoria.toUpperCase()];
    if (!categoriaFormatada) {
        categoriaFormatada = categoria.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .replace(/-/g, '_')
            .replace(/([a-z])([0-9])/g, '$1_$2');
    }

    let nomeFormatado = metrica.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .replace(/-/g, '_')
        .replace(/([a-z])([0-9])/g, '$1_$2');

    const fileName = `meta_${nomeFormatado}_${categoriaFormatada}.png`;
    console.log(`[formatarNomeParaImagem] Métrica: '${metrica}', Categoria: '${categoria}', Nome do arquivo gerado: '${fileName}'`);
    return fileName;
}

function formatarNomePessoaParaImagem(nomePessoa){
    return nomePessoa.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
        .replace(/\s+/g, '_') // Substitui espaços por underscores
        + '.png';
}

// Função para mostrar/esconder o spinner de carregamento
function showLoading(show) {
    loadingSpinner.style.display = show ? 'block' : 'none';
    dashboardContainer.style.opacity = show ? '0.5' : '1';
}

// Função auxiliar para limpar e converter valores para número
function parseNumber(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return NaN;
    if (typeof value === 'number') return value;
    const cleaned = value.replace(/R\$\s*/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
    if (cleaned.endsWith('%')) {
        return parseFloat(cleaned.slice(0, -1)) / 100;
    }
    return parseFloat(cleaned);
}

// Função para buscar dados do CSV usando PapaParse
async function fetchDataCSV(url) {
    showLoading(true);
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                showLoading(false);
                if (results.errors.length > 0) {
                    console.error('Erros no PapaParse:', results.errors);
                    reject(new Error('Erro ao processar CSV: ' + results.errors[0].message));
                } else {
                    resolve(results.data);
                }
            },
            error: function(err) {
                showLoading(false);
                console.error('Erro ao buscar CSV:', err);
                reject(err);
            }
        });
    }).catch(error => {
        Swal.fire({
            icon: 'error',
            title: 'Erro de Carregamento',
            text: `Não foi possível carregar os dados do CSV para o URL: ${url}. Por favor, verifique se o URL está correto e acessível. Detalhes: ${error.message}`,
            confirmButtonText: 'Ok'
        });
        return [];
    });
}

// Função para renderizar as métricas no dashboard
function renderDashboard(categoryName, metricsData) {
    dashboardTitle.textContent = categoryName;
    metricsGrid.innerHTML = '';
    
    // Reinicia o controle de alertas exibidos para esta nova categoria
    displayedAlertsForCategory = {};
    displayedRankingAlertsForCategory = {};
    displayedNewMeetingAlertsForCategory = {};

    if (metricsData.length === 0 && categoryName !== "RANKING MÊS META") {
        metricsGrid.innerHTML = `<p>Nenhuma métrica disponível para ${categoryName}.</p>`;
        return;
    }

    if (categoryName === "RANKING MÊS META") {
        if (metricsData.length === 0) {
            metricsGrid.innerHTML = `<p>Nenhum dado de ranking disponível.</p>`;
            return;
        }

        const groupedRankings = metricsData.reduce((acc, curr) => {
            const tipo = curr['Tipo Ranking'];
            if (!acc[tipo]) {
                acc[tipo] = [];
            }
            acc[tipo].push(curr);
            return acc;
        }, {});

        metricsGrid.innerHTML = '';
        metricsGrid.classList.add('ranking-grid'); 

        const rankingTypes = Object.keys(groupedRankings);

        rankingTypes.slice(0, 3).forEach(tipoRanking => {
            const rankingBlock = document.createElement('div');
            rankingBlock.classList.add('ranking-block');

            const blockTitle = document.createElement('h3');
            blockTitle.classList.add('ranking-block-title');
            blockTitle.textContent = tipoRanking;
            rankingBlock.appendChild(blockTitle);

            const rankingList = document.createElement('ol');
            rankingList.classList.add('ranking-list');

            groupedRankings[tipoRanking].slice(0, 3).forEach((item, index) => {
                const listItem = document.createElement('li');
                listItem.classList.add('ranking-item');

                const personPhoto = document.createElement('img');
                personPhoto.classList.add('ranking-person-photo'); // Classe para estilização no CSS
                personPhoto.src = `./imagens/pessoas/${formatarNomePessoaParaImagem(item['Pessoa'])}`;
                personPhoto.alt = item['Pessoa']; // Texto alternativo para acessibilidade
                listItem.appendChild(personPhoto);

                const position = document.createElement('span');
                position.classList.add('ranking-position');
                position.textContent = `${index + 1}º`;
                listItem.appendChild(position);

                const name = document.createElement('span');
                name.classList.add('ranking-person');
                name.textContent = item['Pessoa'];
                listItem.appendChild(name);

                const percent = document.createElement('span');
                percent.classList.add('ranking-percent');
                percent.textContent = item['Percentual'];
                listItem.appendChild(percent);

                rankingList.appendChild(listItem);

                // **NOVO: Detecção de Meta Batida para o Ranking**
                const percentNum = parseNumber(item['Percentual']);
                if (!isNaN(percentNum) && percentNum >= 1.00) {
                    const personName = item['Pessoa'];
                    const alertKey = `ranking-${personName}`; // Chave única para o alerta de ranking
                    
                    console.log(`[RENDER RANKING] Meta batida para ${personName} (${tipoRanking}). Percentual: ${percentNum}`);

                    if (!displayedRankingAlertsForCategory[alertKey]) {
                        console.log(`[RENDER RANKING] Alerta de ranking para ${personName} AINDA NÃO exibido nesta sessão. Adicionando à fila de foguetes!`);
                        rocketAlertQueue.push({ personName: personName }); // Adiciona à fila de foguetes
                        displayedRankingAlertsForCategory[alertKey] = true;
                    } else {
                        console.log(`[RENDER RANKING] Alerta de ranking para ${personName} JÁ exibido nesta sessão. Ignorando.`);
                    }
                }
            });
            rankingBlock.appendChild(rankingList);
            metricsGrid.appendChild(rankingBlock);
        });


        processRocketAlertQueue();
        return; // Retorna para não processar as métricas normais
    }

    // Se não for a categoria de ranking, remove a classe específica de ranking
    metricsGrid.classList.remove('ranking-grid'); 

    metricsData.forEach(metric => {
        const card = document.createElement('div');
        card.classList.add('metric-card');

        const title = document.createElement('h3');
        title.classList.add('metric-title');
        title.textContent = metric.Métrica;
        card.appendChild(title);

        const details = document.createElement('div');
        details.classList.add('metric-details-container');
        details.style.overflowY = 'auto';
        details.style.paddingRight = '5px';

        const fieldsToShow = [
            { label: 'Meta:', key: 'Meta' },
            { label: 'Realizado:', key: 'Realizado' },
            { label: 'Projetado:', key: 'Projetado' },
            { label: 'QTD MÊS -1:', key: 'QTD MÊS -1' },
            { label: 'QTD MÊS 0:', key: 'QTD MÊS 0' },
            { label: 'TPV MÊS -1:', key: 'TPV MÊS -1' },
            { label: 'TPV MÊS 0:', key: 'TPV MÊS 0' },
            { label: 'ROL MÊS -1:', key: 'ROL MÊS -1' },
            { label: 'ROL MÊS 0:', key: 'ROL MÊS 0' },
            { label: 'CONECTADOS:', key: 'CONECTADOS' },
            { label: 'QUALIFICADOS:', key: 'QUALIFICADOS' },
            { label: 'REUNIAO REALIZADA:', key: 'REUNIAO REALIZADA' },
            { label: 'CONTRATO REALIZADO:', key: 'CONTRATO REALIZADO' },
            { label: 'PAAS GANHA:', key: 'PAAS GANHA' },
            { label: 'PAGAMENTO:', key: 'PAGAMENTO' }
        ];

        fieldsToShow.forEach(field => {
            if (metric[field.key] !== undefined && metric[field.key] !== null && String(metric[field.key]).trim() !== '') {
                const detail = document.createElement('p');
                detail.classList.add('metric-detail');
                detail.innerHTML = `<span>${field.label}</span> <span>${metric[field.key]}</span>`;
                details.appendChild(detail);
            }
        });

        card.appendChild(details);

        if (metric['Meta Batida?'] !== undefined && metric['Meta Batida?'] !== null && String(metric['Meta Batida?']).trim() !== '') {
            const metaBatidaPercent = document.createElement('div');
            metaBatidaPercent.className = 'meta-batida-percent';
            metaBatidaPercent.textContent = `Atingimento: ${metric['Meta Batida?']}`;
            details.appendChild(metaBatidaPercent);

            const metaBatidaNum = parseNumber(metric['Meta Batida?']);
            console.log(`[RENDER] Métrica: ${metric.Métrica}, Meta Batida?: '${metric['Meta Batida?']}', Meta Batida Num (parseFloat): ${metaBatidaNum}`);

            if (!isNaN(metaBatidaNum) && metaBatidaNum >= 1.00) { 
                const fullImageUrl = `./imagens/${formatarNomeParaImagem(metric.Métrica, categoryName)}`;
                const alertKey = metric.Métrica; 

                console.log(`[RENDER] Condição Meta Batida (>= 100%) atendida para: ${metric.Métrica}. Tentando exibir alerta.`);
                
                if (!displayedAlertsForCategory[alertKey]) {
                    console.log(`[RENDER] Alerta para ${metric.Métrica} AINDA NÃO exibido nesta sessão da categoria. Adicionando à fila!`);
                    
                    addAlertToQueue(metric.Métrica, fullImageUrl);
                    displayedAlertsForCategory[alertKey] = true;
                } else {
                    console.log(`[RENDER] Alerta para ${metric.Métrica} JÁ exibido nesta sessão da categoria. Ignorando exibição.`);
                }
                
                card.classList.add('alert-active');
            } else {
                card.classList.remove('alert-active');
                console.log(`[RENDER] Meta para ${metric.Métrica} (${(metaBatidaNum * 100).toFixed(2)}%) NÃO batida. Removendo classe 'alert-active'.`);
            }
        }

        metricsGrid.appendChild(card);
    });
    // Processa a fila de alertas normais
    processAlertQueue(); 
}

// **NOVA FUNÇÃO:** Adiciona um alerta à fila
function addAlertToQueue(metricName, imageUrl) {
    const currentTime = Date.now();
    const alertIdentifier = `${metricName}`; // Identificador para o cooldown

    // Verifica o cooldown para esta métrica
    if (lastAlertTime[alertIdentifier] && (currentTime - lastAlertTime[alertIdentifier] < ALERT_COOLDOWN_MS)) {
        console.log(`[Queue] Alerta para ${metricName} em cooldown. Ignorando adição à fila.`);
        return; // Não adiciona à fila se estiver em cooldown
    }

    // Adiciona o alerta à fila
    alertQueue.push({ metricName, imageUrl });
    console.log(`[Queue] Alerta para ${metricName} adicionado à fila. Tamanho da fila: ${alertQueue.length}`);
    lastAlertTime[alertIdentifier] = currentTime; // Atualiza o tempo do último alerta
}

// **NOVA FUNÇÃO:** Processa o próximo alerta na fila
async function processAlertQueue() {
    console.log(`[Queue] Tentando processar fila. Fila vazia: ${alertQueue.length === 0}, Alerta em exibição: ${isAlertShowing}`);
    if (alertQueue.length > 0 && !isAlertShowing) {
        isAlertShowing = true;
        const nextAlert = alertQueue.shift(); // Remove o primeiro alerta da fila
        console.log(`[Queue] Exibindo próximo alerta da fila: ${nextAlert.metricName}`);
        
        // NOVIDADE: showAlertSuccess agora recebe um callback para liberar a fila
        await showAlertSuccess(nextAlert.metricName, nextAlert.imageUrl);
        
        isAlertShowing = false; // Libera a flag após o alerta fechar
        console.log(`[Queue] Alerta para ${nextAlert.metricName} fechado. Processando próxima.`);
        // Chama a si mesma para verificar o próximo alerta na fila
        processAlertQueue(); 
    }
}


function addRocketAlertToQueue(personName) {
    const currentTime = Date.now();
    const alertIdentifier = `ranking-${personName}`; // Identificador específico para rankings

    if (LAST_RANKING_ALERT_TIME[alertIdentifier] && (currentTime - LAST_RANKING_ALERT_TIME[alertIdentifier] < RANKING_ALERT_COOLDOWN_MS)) {
        console.log(`[Rocket Queue] Alerta de ranking para ${personName} em cooldown. Ignorando adição à fila.`);
        return;
    }

    rocketAlertQueue.push({ personName: personName });
    console.log(`[Rocket Queue] Alerta de ranking para ${personName} adicionado à fila de foguetes. Tamanho da fila: ${rocketAlertQueue.length}`);
    LAST_RANKING_ALERT_TIME[alertIdentifier] = currentTime;
}

async function processRocketAlertQueue() {
    console.log(`[Rocket Queue] Tentando processar fila de foguetes. Fila vazia: ${rocketAlertQueue.length === 0}, Alerta de foguete em exibição: ${isRocketAlertShowing}`);
    // Verifica se a fila normal está vazia ou se não está mostrando alerta normal
    if (rocketAlertQueue.length > 0 && !isRocketAlertShowing && !isAlertShowing) { 
        isRocketAlertShowing = true;
        const nextRocketAlert = rocketAlertQueue.shift();
        console.log(`[Rocket Queue] Exibindo próximo alerta de foguete para: ${nextRocketAlert.personName}`);
        await showRocketAlert(nextRocketAlert.personName); // Chama a nova função de alerta de foguete
        isRocketAlertShowing = false;
        console.log(`[Rocket Queue] Alerta de foguete para ${nextRocketAlert.personName} fechado. Processando próxima.`);
        // Chama a si mesma para verificar o próximo alerta na fila de foguetes
        processRocketAlertQueue(); 
    }
}

async function showRocketAlert(personName) {
    const personImageUrl = `./imagens/pessoas/${formatarNomePessoaParaImagem(personName)}`;
    const rocketImageUrl = `./imagens/foguete.png`;

    console.log(`[Rocket Alert] Preparando alerta de foguete para ${personName}. Foto: ${personImageUrl}`);

    // Cria os elementos do foguete e da pessoa
    const rocketDiv = document.createElement('div');
    rocketDiv.id = 'rocket-alert-container';
    rocketDiv.innerHTML = `
        <img id="rocket-base" src="${rocketImageUrl}" alt="Foguete">
        <img id="person-photo" src="${personImageUrl}" alt="${personName}">
        <div id="meta-batida-text">META BATIDA!</div>
    `;
    document.body.appendChild(rocketDiv);

    // SweetAlert para "Meta Batida!"
    const swalPromise = Swal.fire({
        title: '🎉 Parabéns!',
        html: `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <img src="${personImageUrl}" alt="${personName}" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid #ffcc00; margin-bottom: 15px;">
                <p style="font-size: 1.8em; margin: 0; color: #aaffaa; font-weight: bold;">Meta Batida por ${personName}!</p>
            </div>
        `,
        showConfirmButton: false,
        timer: 4000, // Tempo de exibição do SweetAlert
        timerProgressBar: true,
        customClass: {
            popup: 'swal2-popup custom-swal-popup ranking-swal-popup', // Nova classe para diferenciar
            title: 'swal2-title ranking-swal-title',
            htmlContainer: 'swal2-html-container ranking-swal-html-container'
        },
        background: '#4a3770',
        color: '#f0f0f0',
        iconColor: '#4CAF50'
    });

    // Espera um pouco para a animação começar e o SweetAlert aparecer
    await new Promise(resolve => setTimeout(resolve, 100)); 

    // Adiciona a classe para iniciar a animação do foguete
    rocketDiv.classList.add('animate-rocket');

    // Espera até que a animação do foguete termine (ou um tempo limite)
    // O tempo aqui deve ser pelo menos o tempo da animação CSS
    await new Promise(resolve => setTimeout(resolve, 5000)); // Animação de 3s

    // Remove o foguete do DOM após a animação
    if (rocketDiv.parentNode) {
        rocketDiv.parentNode.removeChild(rocketDiv);
    }
    console.log(`[Rocket Alert] Foguete para ${personName} removido.`);

    // Garante que o SweetAlert seja fechado se ainda estiver aberto
    // await swalPromise; // Isso espera o swal fechar pelo timer ou user click.
                      // Se o swal dura 4s e a animacao 3s, o swal ainda estará lá.
                      // O ideal é que o tempo do swal e da animacao sejam compatíveis.
    
    // Para garantir que a promessa seja resolvida apenas quando AMBOS os eventos (SweetAlert e animação) terminarem
    // podemos aguardar a promessa do SweetAlert também.
    // Se a animação do foguete termina antes do SweetAlert, o SweetAlert continua até seu timer.
    // Se o SweetAlert fecha antes da animação, a animação continua em segundo plano e depois remove o foguete.
    return new Promise(resolve => {
        swalPromise.then(() => resolve()); // Resolve quando o SweetAlert fechar
        // Se a animação for muito mais longa que o swal, o foguete pode sumir antes. Ajuste os timers.
        // Ou você pode usar setTimeout para remover o foguete se a imagem não carregar e o SweetAlert fechar.
    });
}

// FUNÇÃO: exibir pop-up de sucesso com imagem
async function showAlertSuccess(metricName, imageUrl) {
    if (typeof Swal === 'undefined') {
        console.error('SweetAlert2 não está carregado. Certifique-se de que o script SweetAlert2.js está incluído ANTES do seu script3.js.');
        return;
    }
    console.log(`%c[showAlertSuccess] Chamado para: ${metricName}, Imagem: ${imageUrl}`, 'color: yellow; font-weight: bold;');

    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            console.log(`%c[showAlertSuccess] Imagem carregada com sucesso: ${imageUrl}. Exibindo SweetAlert.`, 'color: lightgreen; font-weight: bold;');
            Swal.fire({
                html: `<img src="${imageUrl}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;">`,
                icon: undefined,
                showConfirmButton: false,
                timer: 5000,
                timerProgressBar: true,
                customClass: {
                    container: 'swal2-container',
                    popup: 'swal2-popup custom-swal-popup',
                    image: 'swal2-image',
                    content: 'swal2-content',
                    htmlContainer: 'swal2-html-container',
                },
                background: '#4a3770',
                color: '#f0f0f0',
                iconColor: '#4CAF50',
                showClass: {
                    popup: 'animate__animated animate__zoomIn'
                },
                hideClass: {
                    popup: 'animate__animated animate__zoomOut'
                },
                willClose: () => { // NOVIDADE: SweetAlert2 callback quando o pop-up está prestes a fechar
                    console.log(`[showAlertSuccess] SweetAlert para ${metricName} está fechando.`);
                    resolve(); // Resolve a Promise quando o alerta fechar
                }
            });
        };
        img.onerror = () => {
            console.warn(`%c[showAlertSuccess] Imagem NÃO encontrada ou falha ao carregar: ${imageUrl}. Exibindo alerta SEM imagem.`, 'color: orange; font-weight: bold;');
            Swal.fire({
                html: `<p style="font-size: 2em; margin-bottom: 0;">🎉 Meta Batida!</p>`,
                icon: 'success',
                showConfirmButton: false,
                timer: 5000,
                timerProgressBar: true,
                customClass: {
                    container: 'swal2-container',
                    popup: 'swal2-popup custom-swal-popup',
                },
                background: '#4a3770',
                color: '#f0f0f0',
                iconColor: '#4CAF50',
                showClass: {
                    popup: 'animate__animated animate__zoomIn'
                },
                hideClass: {
                    popup: 'animate__animated animate__zoomOut'
                }
            });
        };
        img.src = imageUrl;
    });
}

async function checkNewMeetings(rankingData) {
    console.log('[checkNewMeetings] Verificando novas reuniões agendadas...');
    let updatedMeetings = {};
    let changesDetected = false;

    for (const item of rankingData) {
        const personName = item['Pessoa'];
        const currentMeetings = parseNumber(item['Reuniao Agendada']); // Certifique-se que o nome da coluna está correto

        updatedMeetings[personName] = currentMeetings; // Atualiza o valor atual

        // Verifica se é um número válido e se o valor anterior existe e é menor que o atual
        if (!isNaN(currentMeetings) && lastKnownMeetings[personName] !== undefined && currentMeetings > lastKnownMeetings[personName]) {
            console.log(`[checkNewMeetings] Aumento detectado para ${personName}: De ${lastKnownMeetings[personName]} para ${currentMeetings}`);
            // Adiciona à fila de alertas de nova reunião
            addNewMeetingAlertToQueue(personName);
            changesDetected = true;
        } else if (lastKnownMeetings[personName] === undefined && !isNaN(currentMeetings) && currentMeetings > 0) {
            // Se for a primeira vez que vemos a pessoa e já tem reuniões, consideramos como um "novo registro" inicial
            // Podemos adicionar um alerta inicial aqui se desejado, mas por enquanto vamos focar nos aumentos.
            console.log(`[checkNewMeetings] Primeiro registro para ${personName} com ${currentMeetings} reuniões.`);
        }
    }

    // Atualiza o lastKnownMeetings com os valores mais recentes
    lastKnownMeetings = updatedMeetings;
    localStorage.setItem('lastKnownMeetings', JSON.stringify(lastKnownMeetings));
    console.log('[checkNewMeetings] lastKnownMeetings atualizado e salvo no localStorage.');

    if (changesDetected) {
        // Processa a fila de alertas de nova reunião após a verificação
        processNewMeetingAlertQueue();
    }
}

function addNewMeetingAlertToQueue(personName) {
    const currentTime = Date.now();
    const alertIdentifier = `new-meeting-${personName}`;

    if (lastAlertTime[alertIdentifier] && (currentTime - lastAlertTime[alertIdentifier] < NEW_MEETING_ALERT_COOLDOWN_MS)) {
        console.log(`[New Meeting Queue] Alerta de nova reunião para ${personName} em cooldown. Ignorando adição à fila.`);
        return;
    }

    newMeetingAlertQueue.push({ personName: personName });
    console.log(`[New Meeting Queue] Alerta de nova reunião para ${personName} adicionado à fila. Tamanho da fila: ${newMeetingAlertQueue.length}`);
    lastAlertTime[alertIdentifier] = currentTime; // Reutiliza lastAlertTime para gerenciar cooldown
}

async function processNewMeetingAlertQueue() {
    console.log(`[New Meeting Queue] Tentando processar fila de novas reuniões. Fila vazia: ${newMeetingAlertQueue.length === 0}, Alerta em exibição: ${isNewMeetingAlertShowing}`);
    // Verifica se outras filas estão vazias/não ativas antes de mostrar este alerta
    if (newMeetingAlertQueue.length > 0 && !isNewMeetingAlertShowing && !isAlertShowing && !isRocketAlertShowing) {
        isNewMeetingAlertShowing = true;
        const nextAlert = newMeetingAlertQueue.shift();
        console.log(`[New Meeting Queue] Exibindo próximo alerta de nova reunião para: ${nextAlert.personName}`);
        await showNewMeetingAlert(nextAlert.personName);
        isNewMeetingAlertShowing = false;
        console.log(`[New Meeting Queue] Alerta de nova reunião para ${nextAlert.personName} fechado. Processando próxima.`);
        processNewMeetingAlertQueue();
    }
}

async function showNewMeetingAlert(personName) {
    const personImageUrl = `./imagens/pessoas/${formatarNomePessoaParaImagem(personName)}`;
    console.log(`[New Meeting Alert] Exibindo alerta de nova reunião para ${personName}. Foto: ${personImageUrl}`);

    const alertBanner = document.createElement('div');
    alertBanner.id = 'new-meeting-alert-banner';
    alertBanner.innerHTML = `
        <img src="${personImageUrl}" alt="${personName}" class="new-meeting-person-photo">
        <span>Nova Reunião Agendada!</span>
        <span class="new-meeting-person-name">${personName}</span>
    `;
    document.body.appendChild(alertBanner);

    // Adiciona a classe para iniciar a animação
    alertBanner.classList.add('animate-slide-in');

    // Remove o banner após a animação (duração deve corresponder ao CSS)
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 segundos para a animação e exibição

    if (alertBanner.parentNode) {
        alertBanner.parentNode.removeChild(alertBanner);
    }
    console.log(`[New Meeting Alert] Banner de nova reunião para ${personName} removido.`);
}



// Função para carregar e exibir a próxima categoria
async function loadNextCategory() {
    dashboardContainer.style.opacity = '0';
    await new Promise(resolve => setTimeout(resolve, 500));

    const category = categories[currentCategoryIndex];
    console.log(`%c[DASHBOARD] Carregando categoria: ${category.name}`, 'color: cyan; font-weight: bold;');
    const data = await fetchDataCSV(GOOGLE_SHEETS_CSV_URLS[category.urlKey]);
    renderDashboard(category.name, data); // renderDashboard adiciona à fila e chama processAlertQueue

    dashboardContainer.style.opacity = '1';

    currentCategoryIndex = (currentCategoryIndex + 1) % categories.length;
}

// Inicia o dashboard quando a página é carregada
document.addEventListener('DOMContentLoaded', () => {
    console.log('%c[DASHBOARD] DOMContentLoaded - Iniciando dashboard.', 'color: green; font-weight: bold;');
    loadNextCategory();
    intervalId = setInterval(loadNextCategory, dashboardIntervalTime);
});