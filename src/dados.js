const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

/**
 * Lê os dados do arquivo CSV e retorna um array de objetos.
 * @param {string} filePath Caminho do arquivo CSV.
 * @returns {Promise<Array>} Retorna uma promessa com os dados dos alunos.
 */
function lerCSV(filePath) {
    return new Promise((resolve, reject) => {
        const resultados = [];
        fs.createReadStream(filePath)
            .pipe(csv({ separator: "," })) // Define o separador como vírgula
            .on("data", (data) => resultados.push(data))
            .on("end", () => resolve(resultados))
            .on("error", (error) => reject(error));
    });
}

// Teste da leitura do CSV
if (require.main === module) {
    const caminhoCSV = path.join(__dirname, "../data/alunos.csv");
    lerCSV(caminhoCSV)
        .then((dados) => console.log("Dados do CSV carregados:", dados))
        .catch((err) => console.error("Erro ao ler CSV:", err));
}

module.exports = { lerCSV };
