const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const logEl = document.getElementById('debugLog');
let currentImage = null;
let rotation = 0;
let gridConfig = { ox: 0, oy: 0, uw: 0, uh: 0 };

// --- 🕵️‍♂️ デバッグログ関数 ---
function log(msg) {
    const div = document.createElement('div');
    div.innerText = `> ${new Date().toLocaleTimeString()}: ${msg}`;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
    console.log(msg);
}

// --- 1. 画像読み込みロジック (最強版) ---
document.getElementById('imageInput').addEventListener('change', (e) => {
    log("ファイル選択を検知");
    const file = e.target.files[0];
    if (!file) {
        log("エラー: ファイルがありません");
        return;
    }
    log(`読込開始: ${file.name} (${Math.round(file.size/1024)}KB)`);

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            log(`画像展開成功: ${img.width}x${img.height}`);
            // iPhoneの高画素写真対策：大きすぎる場合はリサイズを検討するログ
            if (img.width > 3000 || img.height > 3000) log("注意: 高解像度画像のため処理が重くなる可能性があります");
            
            currentImage = img;
            rotation = 0;
            gridConfig = { ox: 0, oy: 0, uw: 0, uh: 0 }; // リセット
            drawPreview();
            log("プレビュー表示完了");
        };
        img.onerror = () => log("エラー: 画像の展開に失敗しました");
        img.src = event.target.result;
    };
    reader.onerror = () => log("エラー: ファイル読み取り失敗");
    reader.readAsDataURL(file);
});

function rotateImage() {
    if (!currentImage) return log("画像がありません");
    rotation = (rotation + 90) % 360;
    drawPreview();
    log(`回転実行: ${rotation}度`);
}

function drawPreview() {
    if (!currentImage) return;
    const is90 = rotation === 90 || rotation === 270;
    canvas.width = is90 ? currentImage.height : currentImage.width;
    canvas.height = is90 ? currentImage.width : currentImage.height;
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(currentImage, -currentImage.width / 2, -currentImage.height / 2);
    ctx.restore();

    if (gridConfig.uw > 0) drawGuide();
}

function drawGuide() {
    ctx.strokeStyle = "rgba(255, 0, 0, 0.6)";
    ctx.lineWidth = Math.max(2, canvas.width / 200); // 画像サイズに合わせる
    ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);
}

// --- 2. 🎯 解析エンジン (高速アンカー検知版) ---
async function startAnalysis() {
    if (!currentImage) return log("エラー: 画像を先に読み込んでください");
    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true;
    log("解析エンジン起動...");

    try {
        log("Tesseract Worker準備中...");
        const worker = await Tesseract.createWorker({
            logger: m => {
                if (m.status === 'recognizing text' && Math.round(m.progress * 100) % 20 === 0) {
                    log(`OCR進捗: ${Math.round(m.progress * 100)}%`);
                }
            }
        });

        await worker.loadLanguage('eng');
        await worker.initialize('eng');

        log("アンカー検知開始 (左10%・縦50%)");
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
            log(`'1'を発見! 位置補正を行います`);
            gridConfig.ox = firstOne.bbox.x1 + (canvas.width * 0.03);
            gridConfig.oy = firstOne.bbox.y0;
            gridConfig.uw = canvas.width * 0.92 - gridConfig.ox;
            gridConfig.uh = canvas.height * 0.88 - gridConfig.oy;
        } else {
            log("アンカー未検出。標準設定を使用します");
            gridConfig = { ox: canvas.width * 0.15, oy: canvas.height * 0.15, uw: canvas.width * 0.78, uh: canvas.height * 0.72 };
        }
        drawPreview();

        log("マス目ごとの詳細解析を開始...");
        await worker.setParameters({ tessedit_char_whitelist: '0123456789' });

        const rows = 8;
        const cols = 8;
        const cellW = gridConfig.uw / cols;
        const cellH = gridConfig.uh / rows;

        for (let r = 0; r < rows; r++) {
            log(`${r+1}戦目をスキャン中...`);
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
        log("✅ 全解析完了");
        await worker.terminate();

    } catch (err) {
        log(`致命的エラー: ${err.message}`);
    } finally {
        btn.innerText = "解析完了";
        btn.disabled = false;
        calcTotals();
    }
}

function calcTotals() {
    [1,2,3,4].forEach(p => {
        let pTotal = 0;
        for(let i=1; i<=8; i++) {
            const plus = (parseInt(document.querySelector(`.p${p}-plus.r${i}`).value) || 0);
            const minus = (parseInt(document.querySelector(`.p${p}-minus.r${i}`).value) || 0);
            pTotal += (plus - minus);
        }
        const el = document.getElementById(`total${'ABCD'[p-1]}`);
        if(el) {
            el.innerText = (pTotal > 0 ? '+' : '') + pTotal;
            el.className = `font-bold ${pTotal >= 0 ? 'text-blue-600' : 'text-red-500'}`;
        }
    });
}

window.onload = () => {
    const scoreRows = document.getElementById('scoreRows');
    for (let i = 1; i <= 8; i++) {
        const row = document.createElement('div');
        row.className = 'score-grid items-center border-b border-gray-100 pb-1';
        row.innerHTML = `<div class="text-center font-mono text-[10px] text-gray-400">${i}</div>
            ${[1,2,3,4].map(p => `
                <div class="player-col">
                    <input type="number" class="p${p}-plus r${i} w-full text-center text-sm p-2 bg-blue-50 outline-none" placeholder="0" oninput="calcTotals()">
                    <input type="number" class="p${p}-minus r${i} w-full text-center text-sm p-2 bg-red-50 outline-none" placeholder="0" oninput="calcTotals()">
                </div>`).join('')}`;
        scoreRows.appendChild(row);
    }
    log("システム準備完了。画像をアップロードしてください。");
};
