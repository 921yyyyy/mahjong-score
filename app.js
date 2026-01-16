const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
let currentImage = null;
let rotation = 0;

// 画像読み込み
document.getElementById('imageInput').addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            drawPreview();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
});

// 回転処理
function rotateImage() {
    rotation = (rotation + 90) % 360;
    drawPreview();
}

function drawPreview() {
    if (!currentImage) return;
    const is90 = rotation === 90 || rotation === 270;
    canvas.width = is90 ? currentImage.height : currentImage.width;
    canvas.height = is90 ? currentImage.width : currentImage.height;
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(currentImage, -currentImage.width / 2, -currentImage.height / 2);
}

// 🎯 グリッド解析ロジック
async function startAnalysis() {
    if (!currentImage) return alert("画像を選んでください");
    const btn = document.getElementById('analyzeBtn');
    btn.innerText = "解析中...";
    btn.disabled = true;

    // 画像を8×8のグリッドとして仮定し、各マスを切り出してOCR
    const rows = 8;
    const cols = 8; // 4人 × 2列(+,-)
    const cellW = canvas.width / (cols + 1); // +回数分
    const cellH = canvas.height / rows;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            // 各セルを切り出す
            const cellCanvas = document.createElement('canvas');
            cellCanvas.width = cellW; cellCanvas.height = cellH;
            const cellCtx = cellCanvas.getContext('2d');
            cellCtx.drawImage(canvas, (c + 1) * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);

            // Tesseractでこのセルだけを読み取る
            const { data: { text } } = await Tesseract.recognize(cellCanvas, 'eng', {
                tessedit_char_whitelist: '0123456789' // 数字以外は無視
            });
            
            const num = text.replace(/[^0-9]/g, '');
            if (num) {
                const inputs = document.querySelectorAll('#scoreRows input');
                const targetIdx = (r * cols) + c;
                if (inputs[targetIdx]) inputs[targetIdx].value = num;
            }
        }
    }
    btn.innerText = "解析完了";
    btn.disabled = false;
    calcTotals();
}

// ... 以降、前回のcalcTotalsやsaveSheetの関数をここに含める
