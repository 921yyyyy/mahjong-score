const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
let currentImage = null;
let rotation = 0;
let gridConfig = { ox: 0, oy: 0, uw: 0, uh: 0 }; // 自動計算される座標

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

// 2. 🎯 自動キャリブレーション ＋ 解析エンジン
async function startAnalysis() {
    if (!currentImage) return alert("画像を選んでください");
    const btn = document.getElementById('analyzeBtn');
    btn.innerText = "位置を特定中...";
    btn.disabled = true;

    // STEP 1: アンカー（目印）の自動検知
    // 表の左側にある「1」と「8」を探して、表の正確な高さを割り出す
    const worker = await Tesseract.createWorker('eng');
    const { data } = await worker.recognize(canvas);
    
    let firstRowY = null;
    let lastRowY = null;
    let tableLeftX = null;

    data.words.forEach(w => {
        const txt = w.text.trim();
        if (txt === "1") { firstRowY = w.bbox.y0; tableLeftX = w.bbox.x1; }
        if (txt === "8") { lastRowY = w.bbox.y0; }
    });

    // アンカーが見つからない場合のフォールバック（手動設定に近い値）
    if (!firstRowY || !lastRowY) {
        console.log("アンカー検知失敗。標準設定を使用します。");
        gridConfig.ox = canvas.width * 0.18;
        gridConfig.oy = canvas.height * 0.12;
        gridConfig.uw = canvas.width * 0.76;
        gridConfig.uh = canvas.height * 0.72;
    } else {
        // アンカーに基づきグリッドを自動構成
        gridConfig.ox = tableLeftX + (canvas.width * 0.02); // 「1」の右側から開始
        gridConfig.oy = firstRowY;
        gridConfig.uw = canvas.width * 0.95 - gridConfig.ox; // 右端まで
        gridConfig.uh = (lastRowY - firstRowY) * 1.15; // 8行分をカバー
    }

    drawPreview(); // 赤枠を更新表示
    btn.innerText = "各マスを精査中...";

    // STEP 2: グリッド分割解析
    const rows = 8;
    const cols = 8;
    const cellW = gridConfig.uw / cols;
    const cellH = gridConfig.uh / rows;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cellCanvas = document.createElement('canvas');
            cellCanvas.width = 120; cellCanvas.height = 120;
            const cCtx = cellCanvas.getContext('2d');

            // 切り出し座標
            const sx = gridConfig.ox + (c * cellW);
            const sy = gridConfig.oy + (r * cellH);
            cCtx.drawImage(canvas, sx, sy, cellW, cellH, 0, 0, 120, 120);

            // 画像処理（二値化：白黒をはっきりさせて認識率UP）
            const imgData = cCtx.getImageData(0, 0, 120, 120);
            for (let i = 0; i < imgData.data.length; i += 4) {
                const brightness = (imgData.data[i] + imgData.data[i+1] + imgData.data[i+2]) / 3;
                const v = brightness > 150 ? 255 : 0;
                imgData.data[i] = imgData.data[i+1] = imgData.data[i+2] = v;
            }
            cCtx.putImageData(imgData, 0, 0);

            // このマスの数字を読み取る
            const { data: { text } } = await worker.recognize(cellCanvas, {
                tessedit_char_whitelist: '0123456789'
            });
            
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

// 合計計算
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

// 画面起動時の入力欄生成
window.onload = () => {
    const scoreRows = document.getElementById('scoreRows');
    for (let i = 1; i <= 8; i++) {
        const row = document.createElement('div');
        row.className = 'score-grid items-center border-b border-gray-100 pb-1';
        row.innerHTML = `<div class="text-center font-mono text-[10px] text-gray-400">${i}</div>
            ${[1,2,3,4].map(p => `
                <div class="player-col items-center">
                    <input type="number" class="p${p}-plus r${i} w-full text-center text-sm p-2 bg-blue-50 outline-none" placeholder="0" oninput="calcTotals()">
                    <input type="number" class="p${p}-minus r${i} w-full text-center text-sm p-2 bg-red-50 outline-none" placeholder="0" oninput="calcTotals()">
                </div>`).join('')}`;
        scoreRows.appendChild(row);
    }
};

// 保存機能（既存のGitHub連携をここに実装）
async function saveSheet() {
    const setName = document.getElementById('setName')?.value || "無題のシート";
    alert(setName + " を保存します（トークン入力が必要です）");
}
