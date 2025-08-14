// server.js - Nosso Detetive Robô
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Habilita o CORS para que seu index.html possa se comunicar com esta API
app.use(cors());
// Permite que a API entenda requisições com corpo em JSON (com até 50mb para a imagem)
app.use(express.json({ limit: '50mb' }));

// Rota de "saúde" para verificar se a API está no ar
app.get('/', (req, res) => {
    res.send('API de Investigação SIP-IA está no ar!');
});

// A rota principal que fará a busca da imagem
app.post('/search-by-image', async (req, res) => {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
        return res.status(400).json({ error: 'Nenhuma imagem fornecida.' });
    }

    console.log("Recebida requisição de busca. Iniciando o Puppeteer...");

    let browser = null;
    try {
        // Inicia o navegador invisível. As 'args' são CRÍTICAS para funcionar no Render.
        (async () => {
            const browserFetcher = puppeteer.createBrowserFetcher();
            const revisionInfo = browserFetcher.revisionInfo(puppeteer._preferredRevision);
        
            const browser = await puppeteer.launch({
                headless: true,
                executablePath: revisionInfo.executablePath,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process', // Evita múltiplos processos no ambiente Render
                    '--disable-gpu'
                ]
            });
        
            console.log('Chrome iniciado com sucesso!');
            await browser.close();
        })();
        const page = await browser.newPage();
        
        // Vai para a página de busca reversa de imagens do Google
        await page.goto('https://images.google.com/searchbyimage/upload');

        // Pega o input de arquivo e faz o upload da nossa imagem
        const buffer = Buffer.from(imageBase64.split(',')[1], 'base64');
        const fileInput = await page.$('input[type=file]');
        await fileInput.uploadFile({
            buffer,
            filename: 'evidence.png',
            contentType: 'image/png'
        });

        console.log("Imagem enviada ao Google. Aguardando resultados...");
        
        // Aguarda a página de resultados carregar e procura pelo "melhor palpite"
        await page.waitForSelector('div[aria-level="3"]', { timeout: 20000 }); // Espera até 20 segundos
        
        const bestGuess = await page.evaluate(() => {
            const guessElement = document.querySelector('div[aria-level="3"]');
            return guessElement ? guessElement.textContent : null;
        });
        
        console.log("Melhor palpite do Google:", bestGuess);

        if (!bestGuess) {
            return res.status(404).json({ error: 'O Google não conseguiu identificar a imagem.' });
        }
        
        res.json({ name: bestGuess });

    } catch (error) {
        console.error("Erro durante o scraping:", error);
        res.status(500).json({ error: 'Falha ao buscar a imagem na web.' });
    } finally {
        if (browser) {
            await browser.close();
            console.log("Navegador fechado.");
        }
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
