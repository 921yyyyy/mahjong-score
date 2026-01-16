const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
let currentImage = null;
let rotation = 0;

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

// 2. プレビュー描画（赤いガイド枠を表示）
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

    // 解析範囲（グリッド）のガイドを表示
    drawGuide();
}

function drawGuide() {
    const config = getGridConfig();
    ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
    ctx.lineWidth = 5;
    ctx.strokeRect(config.ox, config.oy, config.uw, config.uh);
    
    // 簡易的なマスの線も描画
    ctx.beginPath();
    for(let i=1; i<8; i++) {
        const x = config.ox + (config.uw / 8) * i;
        ctx.moveTo(x, config.oy); ctx.lineTo(x, config.oy + config.uh);
        const y = config.oy + (config.uh / 8) * i;
        ctx.moveTo(config.ox, y); ctx.lineTo(config.ox + config.uw, y);
    }
    ctx.stroke();
}

// 3. 座標設定（ここを調整して精度を上げます）
function getGridConfig() {
    return {
        ox: canvas.width * 0.18, // 開始位置X（回数列を避ける）
        oy: canvas.height * 0.12, // 開始位置Y（氏名欄を避ける）
        uw: canvas.width * 0.76,  // 有効幅（右端の余白を避ける）
        uh: canvas.height * 0.72  // 有効高（下の合計欄を避ける）
    };
}

// 4. 🎯 高精度解析エンジン
async function startAnalysis() {
    if (!currentImage) return alert("画像を選んでください");
    const btn = document.getElementById('analyzeBtn');
    btn.innerText = "解析中...";
    btn.disabled = true;

    const config = getGridConfig();
    const rows = 8;
    const cols = 8;
    const cellW = config.uw / cols;
    const cellH = config.uh / rows;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cellCanvas = document.createElement('canvas');
            cellCanvas.width = 120; // 少し大きめに
            cellCanvas.height = 120;
            const cCtx = cellCanvas.getContext('2d');

            // 1. マスを切り出し
            cCtx.drawImage(canvas, config.ox + (c * cellW), config.oy + (r * cellH), cellW, cellH, 0, 0, 120, 120);

            // 2. 【重要】画像処理：コントラスト強調（二値化フィルタ）
            const imgData = cCtx.getImageData(0, 0, 120, 120);
            for (let i = 0; i < imgData.data.length; i += 4) {
                const avg = (imgData.data[i] + imgData.data[i+1] + imgData.data[i+2]) / 3;
                const v = avg > 140 ? 255 : 0; // しきい値より明るければ白、暗ければ黒
                imgData.data[i] = imgData.data[i+1] = imgData.data[i+2] = v;
            }
            cCtx.putImageData(imgData, 0, 0);

            // 3. 解析
            const { data: { text } } = await Tesseract.recognize(cellCanvas, 'eng', {
                tessedit_char_whitelist: '0123456789'
            });
            
            const num = text.replace(/[^0-9]/g, '');
            if (num && num.length > 0 && num.length <= 3) { // 3桁以内のみ採用
                const inputs = document.querySelectorAll('#scoreRows input');
                const targetIdx = (r * cols) + c;
                if (inputs[targetIdx]) inputs[targetIdx].value = num;
            }
        }
    }

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

// 入力欄の生成
window.onload = () => {
    const scoreRows = document.getElementById('scoreRows');
    if(!scoreRows) return;
    for (let i = 1; i <= 8; i++) {
        const row = document.createElement('div');
        row.className = 'score-grid items-center border-b border-gray-100 pb-1';
        row.innerHTML = `
            <div class="text-center font-mono text-[10px] text-gray-400">${i}</div>
            ${[1,2,3,4].map(p => `
                <div class="player-col items-center">
                    <input type="number" class="p${p}-plus r${i} w-full text-center text-sm p-2 bg-blue-50 outline-none" placeholder="0" oninput="calcTotals()">
                    <input type="number" class="p${p}-minus r${i} w-full text-center text-sm p-2 bg-red-50 outline-none" placeholder="0" oninput="calcTotals()">
                </div>
            `).join('')}
        `;
        scoreRows.appendChild(row);
    }
};

async function saveSheet() {
    alert("保存機能は前回のロジックを継承してください");
}
