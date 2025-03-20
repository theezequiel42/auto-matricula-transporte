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
            .on("data", (data) => {
                // Normaliza os campos removendo espaços extras e garantindo letras maiúsculas
                const aluno = {
                    NOME: data.NOME?.trim().toUpperCase() || "",
                    ANO: data.ANO?.trim() || "",
                    LOCALIDADE: data.LOCALIDADE?.trim().toUpperCase() || "",
                    LINHA: data.LINHA?.trim().toUpperCase() || "",
                    TURNO: data.TURNO?.trim().toUpperCase() || "",
                };

                resultados.push(aluno);
            })
            .on("end", () => resolve(resultados))
            .on("error", (error) => reject(error));
    });
}

module.exports = { lerCSV };
