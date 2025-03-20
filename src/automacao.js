require("dotenv").config();
const { Builder, By, Key, until } = require("selenium-webdriver");
const path = require("path");
const { lerCSV } = require("./dados");

// URL do sistema
const EDUCARWEB_URL = "https://fraiburgo.educarweb.net.br";

// Credenciais de login
const USUARIO = process.env.USUARIO;
const SENHA = process.env.SENHA;

/**
 * Inicializa o WebDriver do Selenium.
 * @returns {Promise<WebDriver>}
 */
async function iniciarNavegador() {
    let driver = await new Builder().forBrowser("chrome").build();
    return driver;
}

/**
 * Realiza login no EducarWeb.
 * @param {WebDriver} driver
 */
async function fazerLogin(driver) {
    await driver.get(EDUCARWEB_URL);

    // Preenche o usuário
    await driver.findElement(By.id("usuario")).sendKeys(USUARIO);

    // Preenche a senha
    await driver.findElement(By.id("senha")).sendKeys(SENHA);

    // Clica no botão de login
    await driver.findElement(By.id("btnlogin")).click();

    // Aguarda a página intermediária de seleção de portal
    await driver.wait(until.urlContains("selecione-o-portal"), 5000);

    // Clica no botão "Administrador Do Transporte"
    let portalTransporte = await driver.findElement(By.xpath("//span[contains(text(),'Administrador Do Transporte')]"));
    await driver.executeScript("arguments[0].click();", portalTransporte);

    // Aguarda a página principal carregar
    await driver.wait(until.urlContains("/Home"), 5000);
}

/**
 * Navega até a seção de Matrícula Transporte.
 * @param {WebDriver} driver
 */
async function acessarMatriculaTransporte(driver) {
    try {
        // Aguarda a página carregar completamente
        await driver.sleep(2000);

        console.log("🔹 Expandindo o menu 'Matrícula'...");

        // Expande o menu "Matrícula" se não estiver visível
        let menuMatricula = await driver.findElement(By.xpath("//div[contains(text(),'Matrícula')]"));
        await driver.executeScript("arguments[0].scrollIntoView();", menuMatricula);
        await driver.sleep(500);

        let menuAtivo = await menuMatricula.getAttribute("aria-expanded");
        if (menuAtivo === "false") {
            await driver.executeScript("arguments[0].click();", menuMatricula);
            await driver.sleep(2000);
        }

        console.log("✅ Menu 'Matrícula' expandido!");

        // Aguarda até que o link "Matrícula Transporte" esteja visível
        let menuTransporte = await driver.wait(
            until.elementLocated(By.xpath("//a[contains(text(),'Matrícula Transporte')]")),
            5000
        );

        // Clica na opção "Matrícula Transporte"
        await driver.executeScript("arguments[0].click();", menuTransporte);
        console.log("✅ Clicou em 'Matrícula Transporte'!");

        // Aguardar um elemento específico da página de Matrícula Transporte
        console.log("⏳ Aguardando carregamento da página de Matrícula Transporte...");
        await driver.wait(
            until.elementLocated(By.xpath("//input[contains(@placeholder, 'DIGITE AQUI O NOME DA PESSOA')]")),
            15000
        );

        console.log("✅ Página de Matrícula Transporte carregada!");

    } catch (error) {
        console.error("❌ Erro ao acessar a página de Matrícula Transporte:", error);
    }
}

/**
 * Pesquisa um aluno pelo nome e verifica se ele já possui matrícula.
 * Se o aluno não estiver matriculado, clica no nome e aguarda a ativação do botão "Incluir".
 * @param {WebDriver} driver
 * @param {string} nomeAluno
 * @returns {boolean} Retorna `true` se o aluno já tem matrícula, `false` caso contrário.
 */
async function pesquisarAluno(driver, nomeAluno) {
    try {
        console.log(`🔎 Pesquisando aluno: ${nomeAluno}...`);

        // Localiza o campo de pesquisa e insere o nome do aluno
        let campoPesquisa = await driver.wait(
            until.elementLocated(By.xpath("//input[contains(@placeholder, 'DIGITE AQUI O NOME DA PESSOA')]")),
            5000
        );
        await campoPesquisa.clear();
        await campoPesquisa.sendKeys(nomeAluno);

        // Clica no botão "Pesquisar"
        let botaoPesquisar = await driver.findElement(By.xpath("//button[contains(span/text(), 'Pesquisar')]"));
        await driver.executeScript("arguments[0].click();", botaoPesquisar);

        // Aguarda os resultados carregarem
        await driver.sleep(3000);

        // Verifica se o aluno já possui matrícula
        let possuiMatricula = await driver.findElements(By.xpath("//div[@title='Possui Matrícula']"));
        if (possuiMatricula.length > 0) {
            console.log(`✅ O aluno ${nomeAluno} já possui matrícula.`);
            return true;
        }

        console.log(`📌 O aluno ${nomeAluno} NÃO possui matrícula. Tentando seleção...`);

        // **1️⃣ Localiza a linha do aluno na tabela**
        let alunoLinha = await driver.wait(
            until.elementLocated(By.xpath(`//div[contains(@class, 'x-grid-cell-inner') and text()='${nomeAluno}']/ancestor::tr`)),
            5000
        );

        // **1️⃣ Simula um movimento de mouse antes de clicar**
        let actions = driver.actions({ async: true });
        await actions.move({ origin: alunoLinha }).perform();
        await driver.sleep(500);

        // **2️⃣ Clica no nome do aluno (tentativa padrão)**
        try {
            await alunoLinha.click();
            console.log(`✅ Primeiro clique no aluno ${nomeAluno} realizado.`);
        } catch (error) {
            console.warn("⚠️ Clique normal falhou, tentando via JavaScript...");
            await driver.executeScript("arguments[0].click();", alunoLinha);
            console.log(`✅ Clique via JavaScript no aluno ${nomeAluno} realizado.`);
        }

        // **3️⃣ Aguarda a interface processar**
        await driver.sleep(1500);

        // **4️⃣ Confirma que a linha foi realmente selecionada**
        let linhaSelecionada = await driver.wait(
            until.elementLocated(By.xpath(`//tr[contains(@class, 'x-grid-row-selected') and descendant::div[text()='${nomeAluno}']]`)),
            5000
        );

        console.log(`✅ Confirmação: O aluno ${nomeAluno} foi selecionado corretamente!`);

        return false;

    } catch (error) {
        console.error(`❌ Erro ao pesquisar o aluno ${nomeAluno}:`, error);
        return false;
    }
}

/**
 * Realiza o cadastro de um aluno no sistema.
 * @param {WebDriver} driver
 * @param {Object} aluno Dados do aluno extraídos do CSV.
 */
async function cadastrarAluno(driver, aluno) {
    try {
        console.log(`📝 Iniciando cadastro de ${aluno.NOME}...`);

        // Aguarda o botão "Incluir" correto ficar disponível
        console.log("⌛ Aguardando botão 'Incluir' ativar...");
        let botaoIncluir = await driver.wait(
            until.elementLocated(By.xpath("//button[@id='ext-gen1323' and not(@disabled)]")),
            8000
        );

        // Garante que o botão está visível antes de clicar
        await driver.executeScript("arguments[0].scrollIntoView();", botaoIncluir);
        await driver.sleep(1000);
        await driver.executeScript("arguments[0].click();", botaoIncluir);
        console.log("✅ Botão 'Incluir' clicado!");
        await driver.sleep(2000); // Tempo para abrir o formulário

        // Aguarda o carregamento do formulário
        console.log("⌛ Aguardando o carregamento do formulário...");
        await driver.wait(
            until.elementLocated(By.xpath("//input[@name='cboTrajetoMatriculaTransporte']")),
            15000
        );
        await driver.sleep(2000);
        console.log("✅ Formulário carregado!");
        await preencherFormulario(driver, aluno);

    } catch (error) {
        console.error(`❌ Erro ao cadastrar o aluno ${aluno.NOME}:`, error);
    }
}

/**
 * Preenche o formulário de matrícula para transporte escolar.
 * @param {WebDriver} driver
 * @param {Object} aluno - Objeto contendo informações do aluno (inclui nome, turno, localidade e ano).
 */
async function preencherFormulario(driver, aluno) {
    try {
        console.log(`📝 Tentando preencher o formulário para ${aluno.NOME}...`);

        // **1️⃣ Aguarda a renderização do modal**
        console.log("⌛ Aguardando a exibição do formulário...");
        let modalForm = await driver.wait(
            until.elementLocated(By.xpath("//div[contains(@class,'x-window') and contains(@role, 'dialog')]")),
            5000
        );
        console.log("✅ Formulário modal identificado.");

        // **2️⃣ Garante que o modal está visível**
        await driver.wait(until.elementIsVisible(modalForm), 5000);
        console.log("✅ Modal carregado e visível.");

        await driver.sleep(1000); // Garantir carregamento do modal

        console.log(`📝 Tentando preencher o formulário para ${aluno.NOME}...`);

        // **1️⃣ Verifica se os dados do aluno são válidos**
        if (!aluno || !aluno.TURNO || !aluno.LOCALIDADE || !aluno.ANO) {
            console.error(`❌ Erro: Informações do aluno estão incompletas.`);
            console.error(`🔍 Dados do aluno:`, aluno);
            return;
        }

        // **3️⃣ Selecionar Turno**
        // Mapeia os turnos do CSV para os valores esperados no sistema
        const turnosMap = {
            "MATUTINO": "Manhã",
            "VESPERTINO": "Tarde",
            "NOTURNO": "Noite",
            "INTEGRAL": "Integral"
        };

        // **3️⃣ Selecionar Turno (digitando e pressionando TAB)**
        console.log(`⌛ Digitando turno: ${aluno.TURNO}...`);

        try {
            // Aguarda o elemento (dropdow TURNO) estar visível
        let element = await driver.wait(
            until.elementLocated(By.id('ext-gen1780')),
            10000
        );

        // Move o cursor até o elemento antes de clicar
        await driver.actions().move({ origin: element }).perform();

        // Aguarda o elemento estar clicável e clica
        await driver.wait(until.elementIsVisible(element), 5000);
        await driver.wait(until.elementIsEnabled(element), 5000);
        await element.click();

        console.log("Elemento clicado com sucesso!");
            let campoTurno = await driver.wait(
                until.elementLocated(By.id("ext-gen1776")),
                5000
            );

            await driver.actions().move({ origin: campoTurno }).perform();
            await campoTurno.clear();

            let turnoConvertido = turnosMap[aluno.TURNO.toUpperCase()] || aluno.TURNO; // Converte para o formato correto
            await campoTurno.sendKeys(turnoConvertido);
            await driver.sleep(300); // Aguarda processamento

            // Pressiona TAB para confirmar a entrada e mudar de campo
            await campoTurno.sendKeys(Key.TAB);
            await driver.sleep(800); // Aguarda a atualização da interface

            console.log(`✅ Turno digitado: ${turnoConvertido}`);
        } catch (error) {
            console.error(`❌ Erro ao preencher o turno para ${aluno.NOME}:`, error);
        }

        // **4️⃣ Selecionar Unidade de Ensino (digitando e pressionando TAB)**
        console.log(`⌛ Digitando unidade de ensino...`);

        try {
            let campoUnidade = await driver.wait(
                until.elementLocated(By.id("ext-gen1790")),
                5000
            );

            // **Garante que o campo está interagível antes de digitar**
            await driver.executeScript("arguments[0].focus();", campoUnidade);
            await campoUnidade.click(); // Clica para garantir que está ativo
            await driver.sleep(500);

            await campoUnidade.clear();
            await campoUnidade.sendKeys("EEB G");
            await driver.sleep(300);

            // Pressiona TAB para confirmar a entrada
            await campoUnidade.sendKeys(Key.TAB);
            await driver.sleep(800); // Aguarda atualização

            console.log(`✅ Unidade de ensino preenchida.`);
        } catch (error) {
            console.error(`❌ Erro ao preencher a unidade para ${aluno.NOME}:`, error);
        }

        // **5️⃣ Selecionar Modalidade**
        console.log(`⌛ Selecionando modalidade...`);
        let botaoModalidade = await driver.findElement(By.id("ext-gen1800"));
        await driver.actions().move({ origin: botaoModalidade }).perform();
        await botaoModalidade.click();
        await driver.sleep(500);

        let opcaoModalidade = await driver.wait(
            until.elementLocated(By.xpath("//li[contains(text(),'MÉDIO')]")),
            5000
        );
        await driver.actions().move({ origin: opcaoModalidade }).perform();
        await opcaoModalidade.click();
        console.log(`✅ Modalidade selecionada: MÉDIO`);

        // **6️⃣ Selecionar Série**
        console.log(`⌛ Selecionando série: ${aluno.ANO}º ano...`);
        let botaoSerie = await driver.findElement(By.id("ext-gen1810"));
        await driver.actions().move({ origin: botaoSerie }).perform();
        await botaoSerie.click();
        await driver.sleep(500);

        let opcaoSerie = await driver.wait(
            until.elementLocated(By.xpath(`//li[contains(text(),'${aluno.ANO} ANO')]`)),
            5000
        );
        await driver.actions().move({ origin: opcaoSerie }).perform();
        await opcaoSerie.click();
        console.log(`✅ Série selecionada: ${aluno.ANO}º ano`);

        // **7️⃣ Selecionar Trajeto**
        console.log(`⌛ Selecionando trajeto baseado na localidade e turno...`);
        let botaoTrajeto = await driver.findElement(By.id("ext-gen1820"));
        await driver.actions().move({ origin: botaoTrajeto }).perform();
        await botaoTrajeto.click();
        await driver.sleep(500);

        let trajetoXPath;
        switch (aluno.TURNO.toUpperCase()) {
            case "MATUTINO":
                trajetoXPath = `//li[contains(text(),'${aluno.LOCALIDADE}') and (contains(text(),'(M)') or contains(text(),'(M/V)'))]`;
                break;
            case "VESPERTINO":
                trajetoXPath = `//li[contains(text(),'${aluno.LOCALIDADE}') and (contains(text(),'(V)') or contains(text(),'(M/V)'))]`;
                break;
            case "NOTURNO":
                trajetoXPath = `//li[contains(text(),'${aluno.LOCALIDADE}') and contains(text(),'(N)')]`;
                break;
            case "INTEGRAL":
                trajetoXPath = `//li[contains(text(),'${aluno.LOCALIDADE}') and not(contains(text(),'(N)'))]`;
                break;
            default:
                console.warn(`⚠️ Turno não reconhecido (${aluno.TURNO}). Selecionando primeira opção disponível.`);
                trajetoXPath = `//li[contains(text(),'${aluno.LOCALIDADE}')]`;
        }

        let opcaoTrajeto = await driver.wait(
            until.elementLocated(By.xpath(trajetoXPath)),
            5000
        );
        await driver.actions().move({ origin: opcaoTrajeto }).perform();
        await opcaoTrajeto.click();
        console.log(`✅ Trajeto selecionado: ${aluno.LOCALIDADE} - ${aluno.TURNO}`);

        // **8️⃣ Clicar em "Salvar"**
        console.log(`⌛ Salvando matrícula...`);
        let botaoSalvar = await driver.findElement(By.id("ext-gen1835"));
        await driver.actions().move({ origin: botaoSalvar }).perform();
        await botaoSalvar.click();
        console.log(`✅ Matrícula de ${aluno.NOME} salva com sucesso!`);

    } catch (error) {
        console.error(`❌ Erro ao preencher o formulário para ${aluno.NOME}:`, error);
    }
}

async function iniciarAutomacao() {
    let driver = await iniciarNavegador();

    try {
        console.log("🟢 Iniciando automação...");

        await fazerLogin(driver);
        console.log("✅ Login realizado com sucesso!");

        await acessarMatriculaTransporte(driver);
        console.log("✅ Página de Matrícula Transporte acessada!");

        // Lê os alunos do CSV
        const caminhoCSV = path.join(__dirname, "../data/alunos.csv");
        const alunos = await lerCSV(caminhoCSV);

        for (const aluno of alunos) {
            console.log(`🔍 Processando aluno:`, aluno); // Log para verificar os dados

            if (!aluno.NOME || !aluno.TURNO || !aluno.LOCALIDADE || !aluno.ANO) {
                console.error(`⚠️ Dados do aluno incompletos! Pulando aluno:`, aluno);
                continue;
            }

            let jaCadastrado = await pesquisarAluno(driver, aluno.NOME);
            if (!jaCadastrado) {
                await cadastrarAluno(driver, aluno);
            }
        }

    } catch (error) {
        console.error("❌ Erro durante a automação:", error);
    } finally {
        await driver.sleep(10000);
        await driver.quit();
        console.log("🔴 Automação finalizada!");
    }
}

// Executar a automação apenas se o arquivo for chamado diretamente
if (require.main === module) {
    iniciarAutomacao();
}
