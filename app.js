const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
let currentImage = null;
let rotation = 0;

// 1. 画像読み込みと描画
document.getElementById('imageInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            rotation = 0; // 新しい画像は回転リセット
            drawPreview();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// 2. 回転機能
function rotateImage() {
    rotation = (rotation + 90) % 360;
    drawPreview();
}

function drawPreview() {
    if (!currentImage) return;
    const is90 = rotation === 90 || rotation === 270;
    canvas.width = is90 ? currentImage.height : currentImage.width;
    canvas.height = is90 ? currentImage.width : currentImage.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(currentImage, -currentImage.width / 2, -currentImage.height / 2);
    ctx.restore();
}

// 3. 🎯 構造改革：グリッド分割解析エンジン
async function startAnalysis() {
    if (!currentImage) return alert("画像を選んでください");
    const btn = document.getElementById('analyzeBtn');
    const status = document.getElementById('status');
    
    btn.innerText = "解析中...";
    btn.disabled = true;
    if(status) status.classList.remove('hidden');

    const rows = 8; // 8戦分
    const players = 4;
    const colsPerPlayer = 2; // + と -
    
    // 解析範囲の調整（画像の端にあるクリップボードや余白をカットするための係数）
    // 実際の画像に合わせて微調整が必要な場合があります
    const offsetX = canvas.width * 0.15; // 左側の「回数」列を飛ばす
    const offsetY = canvas.height * 0.1; // 上側の「氏名」行を飛ばす
    const usableW = canvas.width * 0.8;
    const usableH = canvas.height * 0.8;
    
    const cellW = usableW / (players * colsPerPlayer);
    const cellH = usableH / rows;

    for (let r = 0; r < rows; r++) {
        for (let p = 0; p < players; p++) {
            for (let c = 0; c < colsPerPlayer; c++) {
                const isPlus = (c === 0);
                
                // 各セル（＋列、－列）を個別に切り出し
                const cellCanvas = document.createElement('canvas');
                cellCanvas.width = 100; // OCRしやすいサイズに固定
                cellCanvas.height = 100;
                const cCtx = cellCanvas.getContext('2d');
                
                const sourceX = offsetX + (p * colsPerPlayer + c) * cellW;
                const sourceY = offsetY + r * cellH;

                cCtx.drawImage(canvas, sourceX, sourceY, cellW, cellH, 0, 0, 100, 100);

                // Tesseractで数字のみを抽出（ホワイトリスト設定）
                const { data: { text } } = await Tesseract.recognize(cellCanvas, 'eng', {
                    tessedit_char_whitelist: '0123456789'
                });
                
                const num = text.replace(/[^0-9]/g, '');
                if (num && num.length > 0) {
                    const selector = `.p${p+1}-${isPlus ? 'plus' : 'minus'}.r${r+1}`;
                    const input = document.querySelector(selector);
                    if (input) input.value = num;
                }
            }
        }
    }

    btn.innerText = "解析完了";
    btn.disabled = false;
    if(status) status.classList.add('hidden');
    calcTotals();
}

// 4. 計算・保存・初期化（前回のロジックを統合）
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

// 初期化：行の生成
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
                    <input type="number" class="p${p}-plus r${i} w-full text-center text-sm p-2 bg-blue-50 outline-none focus:bg-blue-100" placeholder="0" oninput="calcTotals()">
                    <input type="number" class="p${p}-minus r${i} w-full text-center text-sm p-2 bg-red-50 outline-none focus:bg-red-100" placeholder="0" oninput="calcTotals()">
                </div>
            `).join('')}
        `;
        scoreRows.appendChild(row);
    }
    calcTotals();
};
