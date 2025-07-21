const CSV_URLS = {
    outbound: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=1065872384&single=true&output=csv',
    inbound25k: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=1452707204&single=true&output=csv',
    inboundsdr: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=1002816741&single=true&output=csv',
    ranking: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=1518366484&single=true&output=csv',
    paas: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAqYU8srfDo7tCR0eLbUQjBRU4_5Vyiq35A83BYB5QjekupWfoNT28mLB3H0EzAA8919U3YjM_k0oM/pub?gid=976727502&single=true&output=csv'
};
 
// Configurações de tempo
const CATEGORY_DISPLAY_TIME_MS = 30000; // Tempo que cada tela de categoria fica visível
const ALERT_DISPLAY_TIME_MS = 10000; // Tempo de exibição dos alertas de Meta Batida (pop-up)
const UPDATE_INTERVAL_MS = 300000; // Intervalo para buscar novos dados (5 minutos)
 
// Variáveis de estado e dados
let reunioesAgendadasAnterior = {};
let outboundData = [];
let inbound25kData = [];
let inboundsdrData = [];
let paasData = [];
let rankingData = [];
let rocketAnimationQueue = [];
let animationQueue = []; // Fila para alertas de reunião e meta
let areDataLoaded = false;
let isRocketAnimating = false;
let isAnimating = false; // Controla se um alerta de reunião/meta está ativo
 
// IMPORTANTE: Mapeamento de categorias para nomes de imagem normalizados
const CATEGORIA_PARA_IMAGEM_MAP = {
    'OUTBOUND - GERAL': 'outbound_geral',
    'INBOUND - SDR CLOSER': 'inbound_sdr_closer',
    'INBOUND - 25K+': 'inbound_25k',
    'PAAS - GERAL': 'paas_geral'
};
 
// Configuração do Carrossel de Telas
let currentCategoryIndex = 0;
const CATEGORY_ORDER = [
    { id: 'outbound-metrics-screen', title: 'OUTBOUND - GERAL', dataKey: 'outboundData', dataRef: null }, 
    { id: 'paas-metrics-screen', title: 'PAAS - GERAL', dataKey: 'paasData', dataRef: null }, 
    { id: 'inbound-25k-metrics-screen', title: 'INBOUND - 25K+', dataKey: 'inbound25kData', dataRef: null }, 
    { id: 'inbound-sdr-closer-metrics-screen', title: 'INBOUND - SDR CLOSER', dataKey: 'inboundsdrData', dataRef: null }, 
    { id: 'ranking-screen', title: 'RANKING MÊS', dataKey: 'rankingData', dataRef: null } 
];
let categoryCarouselInterval;
 
 
// Referências aos elementos HTML
const currentCategoryTitleElement = document.getElementById('current-category-title');
const rankingBDRList = document.getElementById('ranking-bdr');
const rankingSDRList = document.getElementById('ranking-sdr');
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
const lastUpdateElement = document.getElementById('last-update');
 
 
const displayedMetaAlerts = new Set();
const displayedPersonMetaAlerts = new Set();
 
// --- Funções de controle de fila de animação ---
function handleAnimationEnd() {
    console.log("[DEBUG_FLUXO] handleAnimationEnd chamada. Resetando isAnimating e processando fila.");
    isAnimating = false; // Libera a flag para o próximo alerta
    // O shift() já foi feito em processNextAnimationInQueue, não precisa aqui novamente
    processNextAnimationInQueue(); // Tenta processar o próximo item na fila
}
 
function processNextAnimationInQueue() {
    console.log(`%c[DEBUG_FLUXO] Chamando processNextAnimationInQueue. Fila: ${animationQueue.length}, isAnimating: ${isAnimating}`, 'color: cyan;');
    if (animationQueue.length > 0 && !isAnimating) {
        isAnimating = true;
        // CORREÇÃO: Usar .shift() aqui para pegar e REMOVER o item da fila IMEDIATAMENTE
        const nextAnimationFunction = animationQueue.shift();
 
        // NOVO LOG DE DEBUG AQUI!
        console.log("%c[DEBUG_FLUXO] Próxima função na fila (tipo/nome):", 'color: lightpink;', nextAnimationFunction); // <--- Adicione esta linha
 
        console.log("%c[DEBUG_FLUXO] Executando próxima animação da fila.", 'color: lightgreen;');
        nextAnimationFunction(); // Executa a função do alerta (que agora exibe E esconde)
    } else {
        console.log("%c[DEBUG_FLUXO] processNextAnimationInQueue não executada. Condições não atendidas.", 'color: orange;');
    }
}
 
// --- Funções de Alerta ---
function showReuniaoRollingAlert(nomePessoa, fotoPessoaUrl) {
    if (!reuniaoRollingAlertElement || !reuniaoPersonPhotoElement || !reuniaoMessageElement) {
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
 
    const animationEndHandler = () => {
        reuniaoRollingAlertElement.classList.remove('active');
        reuniaoRollingAlertElement.classList.add('hidden');
        reuniaoRollingAlertElement.removeEventListener('animationend', animationEndHandler);
        handleAnimationEnd();
    };
 
    reuniaoRollingAlertElement.addEventListener('animationend', animationEndHandler, { once: true });
 
    setTimeout(() => {
        if (reuniaoRollingAlertElement.classList.contains('active')) {
            console.warn("[ALERTA REUNIÃO ROLANDO] Fallback de timeout acionado.");
            reuniaoRollingAlertElement.classList.remove('active');
            reuniaoRollingAlertElement.classList.add('hidden');
            handleAnimationEnd();
        }
    }, 6500);
}
 
function showAlertDialog(imageFileName) {
    if (!alertaPopupEl || !alertImageEl) {
        console.error("Elementos do alerta popup (alertaPopupEl ou alertImageEl) não encontrados. Verifique os IDs.");
        return;
    }
 
    const imageUrl = `imagens/${imageFileName}`;
    console.log(`%c[Alerta Geral Meta] Criando lógica de exibição para imagem: ${imageUrl}`, 'color: lime;'); // Novo log
 
    const alertDisplayLogic = () => { // <--- ESTA É A FUNÇÃO QUE QUEREMOS NA FILA
        console.log(`%c[DEBUG_ALERTA_LOGIC] alertDisplayLogic - Iniciada para imagem: ${imageUrl}`, 'color: lightblue;');
        const img = new Image();
 
        img.onload = () => {
            console.log(`%c[DEBUG_ALERTA_LOGIC] Imagem '${imageUrl}' carregada com SUCESSO. Exibindo alerta.`, 'color: green;');
            alertImageEl.src = imageUrl;
            alertaPopupEl.classList.remove('hidden');
            alertaPopupEl.classList.add('active');
 
            console.log(`%c[Alerta Geral Meta] Alerta '${imageFileName}' exibido com sucesso.`, 'color: #00FF00;');
 
            setTimeout(() => {
                if (alertaPopupEl.classList.contains('active')) {
                    alertaPopupEl.classList.remove('active');
                    alertaPopupEl.classList.add('hidden');
                    console.log(`%c[Alerta Geral Meta] Escondendo alerta '${imageFileName}' via timeout.`, 'color: #FFD700;');
                } else {
                    console.warn(`%c[Alerta Geral Meta] Alerta '${imageFileName}' já estava inativo ao tentar esconder.`, 'color: #FF8C00;');
                }
                handleAnimationEnd(); 
            }, ALERT_DISPLAY_TIME_MS);
        };
 
        img.onerror = (e) => {
            console.error(`%c[Alerta Geral Meta] ERRO ao carregar imagem '${imageUrl}'. Detalhes:`, 'color: red;', e);
            handleAnimationEnd(); 
        };
 
        console.log(`%c[DEBUG_ALERTA_LOGIC] Definindo img.src para: ${imageUrl}`, 'color: yellow;');
        img.src = imageUrl; // INICIA o carregamento da imagem
    };
 
    // Adiciona a função de exibição/ocultação do alerta à fila
    animationQueue.push(alertDisplayLogic);
    console.log(`%c[Alerta Geral Meta] Alerta '${imageFileName}' adicionado à fila. Fila atual: ${animationQueue.length} itens.`, 'color: #ADD8E6;');
 
    // NOTA: REMOVEMOS O if (!isAnimating) { processNextAnimationInQueue(); } DAQUI!
    // Ele será chamado AGORA APÓS CADA showAlertDialog
}
 
function showPersonAlertDialog(personImageFileName, personName) {
    if (!alertaPessoaPopupEl || !alertaPessoaImagemEl || !alertaPessoaNomeEl || !alertaPessoaTituloEl) {
        console.error("Elementos do alerta pessoa popup não encontrados.");
        return;
    }
 
    const imageUrl = `imagens/pessoas/${personImageFileName}`;
    console.log(`[Alerta Pessoa] Tentando exibir alerta para: ${personName} com imagem: ${imageUrl}`);
 
    const img = new Image();
    img.onload = () => {
        alertaPessoaImagemEl.src = imageUrl;
        alertaPessoaImagemEl.alt = `Foto de ${personName}`;
        alertaPessoaNomeEl.textContent = personName;
 
        alertaPessoaPopupEl.classList.remove('hidden');
        alertaPessoaPopupEl.classList.add('active');
 
        console.log(`[Alerta Pessoa] Exibindo alerta para: ${personName} com imagem: ${personImageFileName}`);
 
        animationQueue.push(() => {
            const hideTimeout = setTimeout(() => {
                if (alertaPessoaPopupEl.classList.contains('active')) { 
                    alertaPessoaPopupEl.classList.remove('active');
                    alertaPessoaPopupEl.classList.add('hidden');
                    console.log(`[Alerta Pessoa] Escondendo alerta para: ${personName} via timeout.`);
                    handleAnimationEnd();
                }
            }, ALERT_DISPLAY_TIME_MS);
        });
 
        if (!isAnimating) {
            processNextAnimationInQueue();
        }
    };
    img.onerror = () => {
        console.warn(`[Alerta Pessoa] Imagem NÃO encontrada para '${personName}': ${imageUrl}. Usando genérica.`);
        alertaPessoaImagemEl.src = 'imagens/pessoas/pessoa_generica.png';
        alertaPessoaImagemEl.alt = `Foto de ${personName}`;
        alertaPessoaNomeEl.textContent = personName;
 
        alertaPessoaPopupEl.classList.remove('hidden');
        alertaPessoaPopupEl.classList.add('active');
 
        console.log(`[Alerta Pessoa] Exibindo alerta para: ${personName} com imagem genérica.`);
 
        animationQueue.push(() => {
            const hideTimeout = setTimeout(() => {
                if (alertaPessoaPopupEl.classList.contains('active')) {
                    alertaPessoaPopupEl.classList.remove('active');
                    alertaPessoaPopupEl.classList.add('hidden');
                    console.log(`[Alerta Pessoa] Escondendo alerta para: ${personName} (genérico) via timeout.`);
                    handleAnimationEnd();
                }
            }, ALERT_DISPLAY_TIME_MS);
        });
 
        if (!isAnimating) {
            processNextAnimationInQueue();
        }
    };
    img.src = imageUrl;
}
 
function launchRocketAlert(personName) {
    console.log(`[launchRocketAlert] Tentando lançar foguete para: ${personName}`);
    const personImageFileName = formatarNomePessoaParaImagem(personName);
    const personPhotoUrl = `imagens/pessoas/${personImageFileName}`;
 
    const img = new Image();
    img.onload = () => {
        console.log(`[launchRocketAlert] Imagem de pessoa carregada com sucesso: ${personPhotoUrl}`);
        rocketAnimationQueue.push({ name: personName, photoUrl: personPhotoUrl });
        if (!isRocketAnimating) {
            processRocketQueue();
        }
    };
    img.onerror = () => {
        console.warn(`[ALERTA FOGUETE] Imagem NÃO encontrada para '${personName}': ${personPhotoUrl}. Usando genérica.`);
        const genericPhotoUrl = 'imagens/pessoas/pessoa_generica.png';
        rocketAnimationQueue.push({ name: personName, photoUrl: genericPhotoUrl });
        if (!isRocketAnimating) {
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
 
// --- Funções de Carregamento e Parse de Dados ---
async function fetchCsvData(url) {
    const cacheBusterUrl = `${url}&_=${new Date().getTime()}`;
    try {
        console.log(`[fetchCsvData] Buscando dados de: ${cacheBusterUrl}`);
        const response = await fetch(cacheBusterUrl);
        if (!response.ok) {
            console.error(`[FETCH ERROR] Erro HTTP para ${url}: ${response.status} ${response.statusText}`);
            return [];
        }
        const csvText = await response.text();
        console.log(`[fetchCsvData] Dados recebidos de ${url}. Tamanho: ${csvText.length} caracteres.`);
        return parseCsv(csvText);
    } catch (error) {
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
        if (rawLines[i].startsWith('Métrica') || rawLines[i].startsWith('Tipo Ranking') || rawLines[i].startsWith('Pessoa')) {
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
        // Normalização de cabeçalhos
        if (header.toUpperCase() === 'META BATIDA') return 'Meta Batida?';
        if (header.toUpperCase().startsWith('NOVOS GAN')) return 'Novos Ganhos';
        if (header.toUpperCase().startsWith('TPV REALIZA')) return 'TPV Realizado';
        if (header.toUpperCase().startsWith('NOVO ROL R')) return 'Novo ROL Realizada';
        if (header.toUpperCase() === 'ATIVIDADE TOTAL' || header.toUpperCase() === 'ATIVIDADE') return 'Atividade';
        if (header.toUpperCase() === 'NOVO LEADS TRABALHADOS') return 'Novos Leads Trabalhados';
        if (header.toUpperCase() === 'REUNIÕES AGENDADAS') return 'Reuniões Agendadas';
        if (header.toUpperCase() === 'REUNIÃO REALIZADA') return 'Reunião Realizada';
        if (header.toUpperCase() === 'CONTRATO ASSINADO') return 'Contrato Assinado';
        if (header.toUpperCase() === 'PAAS GANHA') return 'PAAS Ganha';
        if (header.toUpperCase() === 'PAGAMENTO') return 'Pagamento';
        if (header.toUpperCase() === 'LEADS') return 'Leads';
        if (header.toUpperCase() === 'QUALIFICADOS') return 'Qualificados';
        if (header.toUpperCase() === 'CONECTADOS') return 'Conectados';
        if (header.toUpperCase() === 'REUNIAO AGENDADA') return 'Reuniao Agendada'; 
 
        return header;
    });
 
    console.log("Cabeçalhos Originais do CSV:", originalCsvHeaders);
    console.log("Cabeçalhos Normalizados (usados como chaves):", normalizedHeaders);
 
    const result = [];
    for (let i = headerLineIndex + 1; i < rawLines.length; i++) {
        const values = rawLines[i].split(',').map(value => value.trim());
 
        if (values.length < normalizedHeaders.length) {
            while (values.length < normalizedHeaders.length) {
                values.push('');
            }
        } else if (values.length > normalizedHeaders.length) {
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
 
// --- Funções de Formatação de Nomes ---
function formatarNomePessoaParaImagem(nomePessoa) {
    if (!nomePessoa) return 'pessoa_generica.png';
    let nomeFormatado = nomePessoa.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .replace(/-/g, '_');
    console.log(`[formatarNomePessoaParaImagem] Nome original: '${nomePessoa}', Formatado: '${nomeFormatado}.png'`);
    return `${nomeFormatado}.png`;
}
 
function formatarNomeParaImagem(metrica, categoria) {
    // A função de normalização de categoria (se você estiver usando um mapa externo)
    let categoriaFormatada = (CATEGORIA_PARA_IMAGEM_MAP[categoria.toUpperCase()] || categoria.toLowerCase())
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .replace(/-/g, '_')
        // Adiciona um underscore entre letra e número (ex: inbound25k -> inbound_25k)
        .replace(/([a-z])([0-9])/g, '$1_$2'); 
 
    // Normalização da métrica
    let nomeFormatado = metrica.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .replace(/-/g, '_')
        // Adiciona um underscore entre letra e número
        .replace(/([a-z])([0-9])/g, '$1_$2'); 
 
    console.log(`[formatarNomeParaImagem] Métrica: '${metrica}', Categoria: '${categoria}', Formatado: 'meta_${nomeFormatado}_${categoriaFormatada}.png'`);
    return `meta_${nomeFormatado}_${CATEGORIA_PARA_IMAGEM_MAP[categoria.toUpperCase()]}.png`;
}
 
 
// --- Lógica de Preenchimento das Telas de Métricas ---
function populateMetricsScreen(screenElement, metricsData, categoryTitle) {
    const metricsGrid = screenElement.querySelector('.metrics-grid');
    if (!metricsGrid) {
        console.error("Elemento .metrics-grid não encontrado na tela:", screenElement.id);
        return;
    }
 
    metricsGrid.innerHTML = '';
    if (!metricsData || metricsData.length === 0) {
        metricsGrid.innerHTML = `<p style="color:white;">Nenhum dado disponível para ${categoryTitle}.</p>`;
        return;
    }
 
    metricsData.forEach(metric => {
        const metricCard = document.createElement('div');
        metricCard.classList.add('metric-card');
 
        const title = document.createElement('h4');
        title.textContent = metric['Métrica'] || 'Métrica Desconhecida';
        metricCard.appendChild(title);
 
        const meta = document.createElement('p');
        meta.innerHTML = `<strong>Meta:</strong> ${metric['Meta'] || 'N/A'}`;
        metricCard.appendChild(meta);
 
        const realizado = document.createElement('p');
        realizado.innerHTML = `<strong>Realizado:</strong> ${metric['Realizado'] || 'N/A'}`;
        metricCard.appendChild(realizado);
 
        const projetado = document.createElement('p');
        projetado.innerHTML = `<strong>Projetado:</strong> ${metric['Projetado'] || 'N/A'}`;
        metricCard.appendChild(projetado);
 
        if (metric['Meta Batida?']) {
            const metaBatidaSpan = document.createElement('span');
            metaBatidaSpan.classList.add('meta-batida');
            metaBatidaSpan.textContent = metric['Meta Batida?'];
            if (metric['Meta Batida?'].toUpperCase() === 'SIM') {
                metaBatidaSpan.classList.add('meta-batida-sim');
            } else {
                metaBatidaSpan.classList.add('meta-batida-nao');
            }
            metricCard.appendChild(metaBatidaSpan);
 
            const metricaNome = metric['Métrica'];
            const metaId = `${categoryTitle}_${metricaNome}`;
            if (metric['Meta Batida?'].toUpperCase() === 'SIM' && !displayedMetaAlerts.has(metaId)) {
                const nomeArquivoImagem = formatarNomeParaImagem(metricaNome, categoryTitle);
                animationQueue.push(() => showAlertDialog(nomeArquivoImagem));
                displayedMetaAlerts.add(metaId);
                console.log(`[Meta Batida Carrossel] Disparando alerta para meta: '${metricaNome}' na categoria '${categoryTitle}'`);
                if (!isAnimating) {
                    processNextAnimationInQueue();
                }
            }
        }
        metricsGrid.appendChild(metricCard);
    });
}
 
// --- Lógica do Carrossel de Categorias ---
function showNextCategory() {
    if (!areDataLoaded) {
        console.warn("[showNextCategory] Dados ainda não foram completamente carregados. Tentando novamente na próxima iteração.");
        return;
    }
 
    // Oculta todas as telas de categoria
    const allCategoryScreens = document.querySelectorAll('.category-screen');
    allCategoryScreens.forEach(screen => {
        screen.classList.remove('active');
    });
 
    // Incrementa e reseta o índice
    currentCategoryIndex = (currentCategoryIndex + 1) % CATEGORY_ORDER.length;
    const nextCategory = CATEGORY_ORDER[currentCategoryIndex];
 
    currentCategoryTitleElement.textContent = nextCategory.title;
 
    const nextScreen = document.getElementById(nextCategory.id);
    if (nextScreen) {
        // Exibe a próxima tela
        nextScreen.classList.add('active');
 
        if (nextCategory.id === 'ranking-screen') {
            updateRanking();
        } else {
            const dataForScreen = nextCategory.dataRef; 
            console.log(`[showNextCategory] Verificando dados para '${nextCategory.title}' (${nextCategory.dataKey}):`, dataForScreen);
            if (dataForScreen && dataForScreen.length > 0) { 
                populateMetricsScreen(nextScreen, dataForScreen, nextCategory.title);
            } else {
                console.warn(`[showNextCategory] Dados para '${nextCategory.title}' (${nextCategory.dataKey}) não encontrados ou estão vazios. Exibindo mensagem de erro.`);
                nextScreen.querySelector('.metrics-grid').innerHTML = `<p style="color:white;">Nenhum dado disponível para ${nextCategory.title}.</p>`;
            }
        }
    } else {
        console.error(`[showNextCategory] Tela da categoria '${nextCategory.id}' não encontrada.`);
    }
    updateLastUpdateTime();
}
 
// --- Lógica de Atualização de Ranking e Checagem de Reuniões ---
function updateRankingAndCheckReunioes(novosDadosRanking) {
    console.log("[updateRankingAndCheckReunioes] Novos Dados Ranking Recebidos:", novosDadosRanking);
 
    novosDadosRanking.forEach(pessoa => {
        const nome = pessoa.Pessoa;
        const reunioesAtuais = parseInt(pessoa['Reuniao Agendada'] || 0);
        const fotoUrl = `imagens/pessoas/${formatarNomePessoaParaImagem(nome)}`;
 
        console.log(`[DEBUG REUNIAO] Pessoa: ${nome}, Reuniões Anteriores: ${reunioesAgendadasAnterior[nome]}, Reuniões Atuais: ${reunioesAtuais}, URL da Foto (gerada): ${fotoUrl}`);
 
        if (reunioesAgendadasAnterior[nome] !== undefined && reunioesAtuais > reunioesAgendadasAnterior[nome]) {
            const reunioesIncremento = reunioesAtuais - reunioesAgendadasAnterior[nome];
            console.log(`[ALERTA REUNIÃO - DISPARADO] ${nome} agendou mais ${reunioesIncremento} reunião(ões)! Total: ${reunioesAtuais}`);
            animationQueue.push(() => showReuniaoRollingAlert(nome, fotoUrl));
 
            if (!isAnimating) {
                processNextAnimationInQueue();
            }
        }
        reunioesAgendadasAnterior[nome] = reunioesAtuais;
    });
}
 
function updateRanking() {
    rankingBDRList.innerHTML = '';
    rankingSDRList.innerHTML = '';
    rankingCloserList.innerHTML = '';
 
    if (!rankingData || rankingData.length === 0) {
        console.warn("[updateRanking] Nenhum dado de ranking disponível.");
        rankingBDRList.innerHTML = "<li style='color:white;'>Nenhum dado de ranking BDR disponível.</li>";
        rankingSDRList.innerHTML = "<li style='color:white;'>Nenhum dado de ranking SDR disponível.</li>";
        rankingCloserList.innerHTML = "<li style='color:white;'>Nenhum dado de ranking Closer disponível.</li>";
        return;
    }
 
    const allBDR = rankingData.filter(item =>
        item['Tipo Ranking'] &&
        item['Tipo Ranking'].trim().toUpperCase() === 'TOP 3 BDR' &&
        item.Pessoa && item.Pessoa.trim() !== ''
    );
 
    const allSDR = rankingData.filter(item =>
        item['Tipo Ranking'] &&
        item['Tipo Ranking'].trim().toUpperCase() === 'TOP 3 SDR' &&
        item.Pessoa && item.Pessoa.trim() !== ''
    );
 
    const allCloser = rankingData.filter(item =>
        item['Tipo Ranking'] &&
        item['Tipo Ranking'].trim().toUpperCase() === 'TOP 3 CLOSER' &&
        item.Pessoa && item.Pessoa.trim() !== ''
    );
 
    console.log("[updateRanking] Dados filtrados para BDR:", allBDR);
    console.log("[updateRanking] Dados filtrados para SDR:", allSDR);
    console.log("[updateRanking] Dados filtrados para Closer:", allCloser);
 
    const topBDR = allBDR.slice(0, 3);
    const topSDR = allSDR.slice(0, 3);
    const topCloser = allCloser.slice(0, 3);
 
    if (topBDR.length === 0) {
        rankingBDRList.innerHTML = "<li>Nenhum top BDR para exibir.</li>";
    }
    topBDR.forEach(person => {
        console.log("Ranking BDR - Objeto Pessoa:", person);
        const li = document.createElement('li');
        li.textContent = `${person.Pessoa}: ${person.Percentual || 'N/A'}`;
        rankingBDRList.appendChild(li);
 
        if (person['Meta Batida?'] && person['Meta Batida?'].toUpperCase() === 'SIM') {
            const personName = person.Pessoa;
            const personMetaId = `pessoa_${personName}_${person['Tipo Ranking']}`;
 
            if (!displayedPersonMetaAlerts.has(personMetaId)) {
                console.log(`[Meta Batida Ranking] Disparando alerta de foguete para: '${personName}' (BDR)`);
                showPersonAlertDialog(formatarNomePessoaParaImagem(personName), personName);
                launchRocketAlert(personName);
                displayedPersonMetaAlerts.add(personMetaId);
            } else {
                console.log(`[Meta Batida Ranking] Alerta para '${personName}' (BDR) já exibido. Ignorando.`);
            }
        }
    });
 
    if (topSDR.length === 0) {
        rankingSDRList.innerHTML = "<li>Nenhum top SDR para exibir.</li>";
    }
    topSDR.forEach(person => {
        console.log("Ranking SDR - Objeto Pessoa:", person);
        const li = document.createElement('li');
        li.textContent = `${person.Pessoa}: ${person.Percentual || 'N/A'}`;
        rankingSDRList.appendChild(li);
 
        if (person['Meta Batida?'] && person['Meta Batida?'].toUpperCase() === 'SIM') {
            const personName = person.Pessoa;
            const personMetaId = `pessoa_${personName}_${person['Tipo Ranking']}`;
 
            if (!displayedPersonMetaAlerts.has(personMetaId)) {
                console.log(`[Meta Batida Ranking] Disparando alerta de foguete para: '${personName}' (SDR)`);
                showPersonAlertDialog(formatarNomePessoaParaImagem(personName), personName);
                launchRocketAlert(personName);
                displayedPersonMetaAlerts.add(personMetaId);
            } else {
                console.log(`[Meta Batida Ranking] Alerta para '${personName}' (SDR) já exibido. Ignorando.`);
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
                showPersonAlertDialog(formatarNomePessoaParaImagem(personName), personName);
                launchRocketAlert(personName);
                displayedPersonMetaAlerts.add(personMetaId);
            } else {
                console.log(`[Meta Batida Ranking] Alerta para '${personName}' (Closer) já exibido. Ignorando.`);
            }
        }
    });
}
 
function updateLastUpdateTime() {
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    lastUpdateElement.textContent = `Última atualização: ${formattedTime}`;
}
 
 
// --- Função de Inicialização e Atualização de Dados ---
async function initDashboard() {
    console.log("Iniciando Dashboard...");
 
    // Carrega todos os dados iniciais
    outboundData = await fetchCsvData(CSV_URLS.outbound);
    console.log('[INIT] outboundData carregado:', outboundData.length, 'itens.');
 
    inbound25kData = await fetchCsvData(CSV_URLS.inbound25k);
    console.log('[INIT] inbound25kData carregado:', inbound25kData.length, 'itens.');
 
    inboundsdrData = await fetchCsvData(CSV_URLS.inboundsdr);
    console.log('[INIT] inboundsdrData carregado:', inboundsdrData.length, 'itens.');
 
    rankingData = await fetchCsvData(CSV_URLS.ranking);
    console.log('[INIT] rankingData carregado:', rankingData.length, 'itens.');
 
    paasData = await fetchCsvData(CSV_URLS.paas);
    console.log('[INIT] paasData carregado:', paasData.length, 'itens.');
 
 
    // Associa os dados carregados aos objetos da CATEGORY_ORDER
    CATEGORY_ORDER[0].dataRef = outboundData;
    CATEGORY_ORDER[1].dataRef = paasData;
    CATEGORY_ORDER[2].dataRef = inbound25kData;
    CATEGORY_ORDER[3].dataRef = inboundsdrData;
    CATEGORY_ORDER[4].dataRef = rankingData; 
 
    areDataLoaded = true;
    console.log("[INIT] Todos os dados foram carregados.");
 
    // Define os valores iniciais para a checagem de "Reuniões Agendadas"
    rankingData.forEach(pessoa => {
        reunioesAgendadasAnterior[pessoa.Pessoa] = parseInt(pessoa['Reuniao Agendada'] || 0);
    });
    console.log("[INIT] reunioesAgendadasAnterior inicializado:", reunioesAgendadasAnterior);
 
 
    // Inicia o carrossel de categorias
    showNextCategory(); // Exibe a primeira categoria
    categoryCarouselInterval = setInterval(showNextCategory, CATEGORY_DISPLAY_TIME_MS);
 
    // Configura o intervalo para buscar novos dados periodicamente
    setInterval(async () => {
        console.log("[UPDATE] Buscando novos dados...");
 
        // Busca os novos dados
        const newOutboundData = await fetchCsvData(CSV_URLS.outbound);
        const newInbound25kData = await fetchCsvData(CSV_URLS.inbound25k);
        const newInboundsdrData = await fetchCsvData(CSV_URLS.inboundsdr);
        const newPaasData = await fetchCsvData(CSV_URLS.paas);
        const newRankingData = await fetchCsvData(CSV_URLS.ranking);
 
        // Verifica novas metas batidas para as categorias (métricas)
 
        // Outbound
        newOutboundData.forEach(newMetric => {
            const oldMetric = outboundData.find(m => m.Métrica === newMetric.Métrica);
            if (newMetric['Meta Batida?'] && newMetric['Meta Batida?'].toUpperCase() === 'SIM' && 
                (!oldMetric || oldMetric['Meta Batida?'].toUpperCase() !== 'SIM')) {
                const metricaNome = newMetric['Métrica'];
                const metaId = `OUTBOUND - GERAL_${metricaNome}`;
                if (!displayedMetaAlerts.has(metaId)) {
                    const nomeArquivoImagem = formatarNomeParaImagem(metricaNome, 'OUTBOUND - GERAL');
                    animationQueue.push(() => showAlertDialog(nomeArquivoImagem));
                    displayedMetaAlerts.add(metaId);
                    if (!isAnimating) processNextAnimationInQueue();
                }
            }
        });
 
        // Inbound 25K+
        newInbound25kData.forEach(newMetric => {
            const oldMetric = inbound25kData.find(m => m.Métrica === newMetric.Métrica);
            if (newMetric['Meta Batida?'] && newMetric['Meta Batida?'].toUpperCase() === 'SIM' && 
                (!oldMetric || oldMetric['Meta Batida?'].toUpperCase() !== 'SIM')) {
                const metricaNome = newMetric['Métrica'];
                const metaId = `INBOUND - 25K+_${metricaNome}`;
                if (!displayedMetaAlerts.has(metaId)) {
                    const nomeArquivoImagem = formatarNomeParaImagem(metricaNome, 'INBOUND - 25K+');
                    animationQueue.push(() => showAlertDialog(nomeArquivoImagem));
                    displayedMetaAlerts.add(metaId);
                    if (!isAnimating) processNextAnimationInQueue();
                }
            }
        });
 
        // Inbound SDR Closer
        newInboundsdrData.forEach(newMetric => {
            const oldMetric = inboundsdrData.find(m => m.Métrica === newMetric.Métrica);
            if (newMetric['Meta Batida?'] && newMetric['Meta Batida?'].toUpperCase() === 'SIM' && 
                (!oldMetric || oldMetric['Meta Batida?'].toUpperCase() !== 'SIM')) {
                const metricaNome = newMetric['Métrica'];
                const metaId = `INBOUND - SDR CLOSER_${metricaNome}`;
                if (!displayedMetaAlerts.has(metaId)) {
                    const nomeArquivoImagem = formatarNomeParaImagem(metricaNome, 'INBOUND - SDR CLOSER');
                    animationQueue.push(() => showAlertDialog(nomeArquivoImagem));
                    displayedMetaAlerts.add(metaId);
                    if (!isAnimating) processNextAnimationInQueue();
                }
            }
        });
 
        // PAAS - GERAL
        newPaasData.forEach(newMetric => {
            const oldMetric = paasData.find(m => m.Métrica === newMetric.Métrica);
            if (newMetric['Meta Batida?'] && newMetric['Meta Batida?'].toUpperCase() === 'SIM' && 
                (!oldMetric || oldMetric['Meta Batida?'].toUpperCase() !== 'SIM')) {
                const metricaNome = newMetric['Métrica'];
                const metaId = `PAAS - GERAL_${metricaNome}`;
                if (!displayedMetaAlerts.has(metaId)) {
                    const nomeArquivoImagem = formatarNomeParaImagem(metricaNome, 'PAAS - GERAL');
                    animationQueue.push(() => showAlertDialog(nomeArquivoImagem));
                    displayedMetaAlerts.add(metaId);
                    if (!isAnimating) processNextAnimationInQueue();
                }
            }
        });
 
        // Atualiza os dados globais e verifica reuniões/ranking
        outboundData = newOutboundData;
        inbound25kData = newInbound25kData;
        inboundsdrData = newInboundsdrData;
        paasData = newPaasData;
 
        updateRankingAndCheckReunioes(newRankingData); 
        rankingData = newRankingData; 
 
        // Reassocia os dataRefs após a atualização dos dados
        CATEGORY_ORDER[0].dataRef = outboundData;
        CATEGORY_ORDER[1].dataRef = paasData;
        CATEGORY_ORDER[2].dataRef = inbound25kData;
        CATEGORY_ORDER[3].dataRef = inboundsdrData;
        CATEGORY_ORDER[4].dataRef = rankingData;
 
        updateLastUpdateTime();
        console.log("[UPDATE] Dados atualizados com sucesso.");
 
        // Se a tela atual for de métricas (não ranking), precisamos repopular com os dados mais recentes
        const currentActiveScreen = document.querySelector('.category-screen.active');
        const currentCategory = CATEGORY_ORDER[currentCategoryIndex];
 
        if (currentActiveScreen && currentCategory.id !== 'ranking-screen') {
            populateMetricsScreen(currentActiveScreen, currentCategory.dataRef, currentCategory.title);
        }
 
    }, UPDATE_INTERVAL_MS);
}
 
// Inicia o dashboard quando o DOM estiver completamente carregado
document.addEventListener('DOMContentLoaded', initDashboard);