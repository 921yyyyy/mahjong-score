const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
let currentImage = null;
let rotation = 0;
let gridConfig = { ox: 0, oy: 0, uw: 0, uh: 0 };

// 1. 画像読み込み
document.getElementById('imageInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            rotation = 0;
            gridConfig = { ox: 0, oy: 0, uw: 0, uh: 0 }; // リセット
            drawPreview();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

function rotateImage() {
    rotation = (rotation + 90) % 360;
    drawPreview();
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
    ctx.lineWidth = 4;
    ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);
}

// 2. 🎯 高速自動検知 ＋ 解析エンジン
async function startAnalysis() {
    if (!currentImage) return alert("画像を選んでください");
    const btn = document.getElementById('analyzeBtn');
    btn.innerText = "位置を特定中...";
    btn.disabled = true;

    // --- STEP 1: 高速アンカーサーチ (限定エリアスキャン) ---
    const worker = await Tesseract.createWorker('eng');
    
    // 左端の25%・上端の40%だけを切り出した一時的なキャンバスを作成
    const scanCanvas = document.createElement('canvas');
    scanCanvas.width = canvas.width * 0.25;
    scanCanvas.height = canvas.height * 0.4;
    const sCtx = scanCanvas.getContext('2d');
    sCtx.drawImage(canvas, 0, 0, canvas.width * 0.25, canvas.height * 0.4, 0, 0, scanCanvas.width, scanCanvas.height);

    // 「1」という文字だけを狙い撃ちで探す設定
    await worker.setParameters({
        tessedit_char_whitelist: '1',
        tessedit_pageseg_mode: '11' // SPARSE_TEXT
    });

    const { data } = await worker.recognize(scanCanvas);
    const firstOne = data.words.find(w => w.text.includes("1"));

    if (firstOne) {
        // 目印が見つかったら、そこを起点にグリッドを自動計算
        gridConfig.ox = firstOne.bbox.x1 + (canvas.width * 0.02);
        gridConfig.oy = firstOne.bbox.y0;
        gridConfig.uw = canvas.width * 0.92 - gridConfig.ox;
        gridConfig.uh = canvas.height * 0.88 - gridConfig.oy;
        drawPreview(); // 赤枠を表示
    } else {
        // 見つからない場合は標準比率を使用
        gridConfig = {
            ox: canvas.width * 0.15,
            oy: canvas.height * 0.12,
            uw: canvas.width * 0.8,
            uh: canvas.height * 0.75
        };
        console.log("アンカー未検出。標準設定を適用。");
    }

    // --- STEP 2: 各マスの詳細解析 (Workerを使い回し) ---
    btn.innerText = "データ解析中...";
    await worker.setParameters({ tessedit_char_whitelist: '0123456789' });

    const rows = 8;
    const cols = 8;
    const cellW = gridConfig.uw / cols;
    const cellH = gridConfig.uh / rows;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cellCanvas = document.createElement('canvas');
            cellCanvas.width = 100; cellCanvas.height = 100;
            const cCtx = cellCanvas.getContext('2d');
            cCtx.drawImage(canvas, gridConfig.ox + (c * cellW), gridConfig.oy + (r * cellH), cellW, cellH, 0, 0, 100, 100);

            // 二値化処理
            const imgData = cCtx.getImageData(0, 0, 100, 100);
            for (let i = 0; i < imgData.data.length; i += 4) {
                const avg = (imgData.data[i] + imgData.data[i+1] + imgData.data[i+2]) / 3;
                const v = avg > 145 ? 255 : 0;
                imgData.data[i] = imgData.data[i+1] = imgData.data[i+2] = v;
            }
            cCtx.putImageData(imgData, 0, 0);

            const { data: { text } } = await worker.recognize(cellCanvas);
            const num = text.replace(/[^0-9]/g, '');
            if (num && num.length <= 3) {
                const inputs = document.querySelectorAll('#scoreRows input');
                const targetIdx = (r * cols) + c;
                if (inputs[targetIdx]) inputs[targetIdx].value = num;
            }
        }
    }

    await worker.terminate();
    btn.innerText = "解析完了";
    btn.disabled = false;
    calcTotals();
    document.getElementById('scoreRows').scrollIntoView({ behavior: 'smooth' });
}

function calcTotals() {
    [1,2,3,4].forEach(p => {
        let pTotal = 0;
        for(let i=1; i<=8; i++) {
            const plus = parseInt(document.querySelector(`.p${p}-plus.r${i}`).value) || 0;
            const minus = parseInt(document.querySelector(`.p${p}-minus.r${i}`).value) || 0;
            pTotal += (plus - minus);
        }
        const el = document.getElementById(`total${'ABCD'[p-1]}`);
        if(el) {
            el.innerText = (pTotal > 0 ? '+' : '') + pTotal;
            el.className = `text-center font-mono font-bold text-sm ${pTotal >= 0 ? 'text-blue-600' : 'text-red-500'}`;
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
};
