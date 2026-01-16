const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const logEl = document.getElementById('debugLog');

// 画面にログを出す関数
function log(msg) {
    const div = document.createElement('div');
    div.innerText = `> ${new Date().toLocaleTimeString()}: ${msg}`;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
    console.log(msg);
}

// 🎯 高度なデバッグ・解析エンジン
async function startAnalysis() {
    if (!currentImage) return alert("画像を選んでください");
    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true;
    log("解析プロセス開始...");

    try {
        log("Tesseract Worker作成中...");
        const worker = await Tesseract.createWorker({
            logger: m => {
                if(m.status === 'recognizing text') {
                    // 進捗を50%刻みくらいでログ出し
                    if(Math.round(m.progress * 100) % 50 === 0) log(`進捗: ${Math.round(m.progress * 100)}%`);
                }
            }
        });

        log("言語データ(eng)読み込み中...");
        await worker.loadLanguage('eng');
        await worker.initialize('eng');

        // --- STEP 1: アンカー検知のデバッグ ---
        log("アンカー検知（左端10%・縦50%）実行中...");
        const scanCanvas = document.createElement('canvas');
        scanCanvas.width = canvas.width * 0.10;
        scanCanvas.height = canvas.height * 0.50;
        const sCtx = scanCanvas.getContext('2d');
        sCtx.drawImage(canvas, 0, 0, canvas.width * 0.10, canvas.height * 0.50, 0, 0, scanCanvas.width, scanCanvas.height);

        await worker.setParameters({
            tessedit_char_whitelist: '1',
            tessedit_pageseg_mode: '11'
        });

        const { data } = await worker.recognize(scanCanvas);
        const firstOne = data.words.find(w => w.text.includes("1"));

        if (firstOne) {
            log(`アンカー'1'を発見! 座標: y=${firstOne.bbox.y0}`);
            gridConfig.ox = firstOne.bbox.x1 + (canvas.width * 0.05);
            gridConfig.oy = firstOne.bbox.y0;
            gridConfig.uw = canvas.width * 0.90 - gridConfig.ox;
            gridConfig.uh = canvas.height * 0.85 - gridConfig.oy;
        } else {
            log("アンカー未発見。標準設定(fallback)を適用します。");
            gridConfig = { ox: canvas.width * 0.18, oy: canvas.height * 0.15, uw: canvas.width * 0.78, uh: canvas.height * 0.70 };
        }
        drawPreview();

        // --- STEP 2: メイン解析 ---
        log("各マスの数値解析を開始します...");
        await worker.setParameters({ tessedit_char_whitelist: '0123456789' });

        const rows = 8;
        const cols = 8;
        const cellW = gridConfig.uw / cols;
        const cellH = gridConfig.uh / rows;

        for (let r = 0; r < rows; r++) {
            log(`${r+1}戦目を解析中...`);
            for (let c = 0; c < cols; c++) {
                const cellCanvas = document.createElement('canvas');
                cellCanvas.width = 100; cellCanvas.height = 100;
                const cCtx = cellCanvas.getContext('2d');
                cCtx.drawImage(canvas, gridConfig.ox + (c * cellW), gridConfig.oy + (r * cellH), cellW, cellH, 0, 0, 100, 100);

                const { data: { text } } = await worker.recognize(cellCanvas);
                const num = text.replace(/[^0-9]/g, '');
                if (num) {
                    const inputs = document.querySelectorAll('#scoreRows input');
                    inputs[(r * cols) + c].value = num;
                }
            }
        }

        log("全解析が完了しました！");
        await worker.terminate();

    } catch (e) {
        log(`致命的エラー: ${e.message}`);
    } finally {
        btn.innerText = "解析完了";
        btn.disabled = false;
        calcTotals();
    }
}
