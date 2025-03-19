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
        await driver.sleep(3000); // Tempo para os dados aparecerem

        // Verifica se o aluno já possui matrícula
        let possuiMatricula = await driver.findElements(By.xpath("//div[@title='Possui Matrícula']"));
        
        if (possuiMatricula.length > 0) {
            console.log(`✅ O aluno ${nomeAluno} já possui matrícula.`);
            return true; // O aluno já está cadastrado
        } else {
            console.log(`❌ O aluno ${nomeAluno} NÃO possui matrícula. Será cadastrado.`);
            return false; // O aluno precisa ser cadastrado
        }

    } catch (error) {
        console.error(`❌ Erro ao pesquisar o aluno ${nomeAluno}:`, error);
        return false;
    }
}

/**
 * Executa o processo completo de login, navegação e pesquisa de alunos.
 */
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
            let nome = aluno.NOME;

            // Pesquisar aluno no sistema
            let jaCadastrado = await pesquisarAluno(driver, nome);

            if (!jaCadastrado) {
                console.log(`📝 Iniciando cadastro de ${nome}...\n`);
                // Aqui vamos chamar a função que fará o cadastro (próximo passo)
            }
        }

    } catch (error) {
        console.error("❌ Erro durante a automação:", error);
    } finally {
        // Fechar o navegador após 10 segundos para visualizar o resultado
        await driver.sleep(10000);
        await driver.quit();
        console.log("🔴 Automação finalizada!");
    }
}

// Executar a automação apenas se o arquivo for chamado diretamente
if (require.main === module) {
    iniciarAutomacao();
}
