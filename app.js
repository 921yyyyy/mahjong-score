document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('imageInput');
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const logEl = document.getElementById('debugLog');
    const scoreRows = document.getElementById('scoreRows');
    
    let currentImage = null;
    let rotation = 0;
    let gridConfig = { ox: 0, oy: 0, uw: 0, uh: 0 };

    function log(msg) {
        const div = document.createElement('div');
        div.innerText = `> ${new Date().toLocaleTimeString()}: ${msg}`;
        logEl.appendChild(div);
        logEl.scrollTop = logEl.scrollHeight;
        console.log(msg);
    }

    log("JavaScript 読み込み完了。待機中...");

    imageInput.addEventListener('change', (e) => {
        log("ファイル選択を検知");
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (f) => {
            const img = new Image();
            img.onload = () => {
                log(`画像展開成功: ${img.width}x${img.height}`);
                currentImage = img;
                rotation = 0;
                gridConfig = { ox: 0, oy: 0, uw: 0, uh: 0 };
                drawPreview();
            };
            img.src = f.target.result;
        };
        reader.readAsDataURL(file);
    });

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
        ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
        ctx.lineWidth = Math.max(4, canvas.width / 120);
        ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);
        
        // 分割ガイド線
        ctx.strokeStyle = "rgba(255, 0, 0, 0.3)";
        ctx.lineWidth = 1;
        for(let i=1; i<8; i++) {
            let y = gridConfig.oy + (gridConfig.uh / 8) * i;
            ctx.beginPath(); ctx.moveTo(gridConfig.ox, y); ctx.lineTo(gridConfig.ox + gridConfig.uw, y); ctx.stroke();
        }
    }

    document.getElementById('rotateBtn').onclick = () => {
        if (!currentImage) return;
        rotation = (rotation + 90) % 360;
        drawPreview();
    };

    document.getElementById('analyzeBtn').onclick = async () => {
        if (!currentImage) return log("エラー: 画像なし");
        log("解析開始...");
        const btn = document.getElementById('analyzeBtn');
        btn.disabled = true;

        try {
            const worker = await Tesseract.createWorker({
                logger: m => {
                    if (m.status === 'recognizing text' && Math.round(m.progress * 100) % 25 === 0) log(`進捗: ${Math.round(m.progress * 100)}%`);
                }
            });
            await worker.loadLanguage('eng');
            await worker.initialize('eng');

            // --- STEP 1: アンカー検知 & 広域座標補正 ---
            const scanCanvas = document.createElement('canvas');
            scanCanvas.width = canvas.width * 0.15;
            scanCanvas.height = canvas.height * 0.50;
            const sCtx = scanCanvas.getContext('2d');
            sCtx.drawImage(canvas, 0, 0, canvas.width * 0.15, canvas.height * 0.50, 0, 0, scanCanvas.width, scanCanvas.height);

            await worker.setParameters({ tessedit_char_whitelist: '1', tessedit_pageseg_mode: '11' });
            const { data } = await worker.recognize(scanCanvas);
            const firstOne = data.words.find(w => w.text.includes("1"));

            if (firstOne) {
                log(`'1'を検知。座標を広域補正します。`);
                const charH = firstOne.bbox.y1 - firstOne.bbox.y0;
                
                // 【左端】Aさんのプラス列を拾うため、1の文字のすぐ右から開始
                gridConfig.ox = firstOne.bbox.x1 + (canvas.width * 0.01); 
                
                // 【上端】ヘッダーを避け、1行目の数字の頭から開始
                gridConfig.oy = firstOne.bbox.y0 + (charH * 0.45); 
                
                // 【横幅】Dさんのマイナス列まで（画像右側の余裕を82%確保）
                const availableW = canvas.width - gridConfig.ox;
                gridConfig.uw = availableW * 0.83; 

                // 【高さ】8行目の下まで届くように18.8倍に設定
                gridConfig.uh = charH * 18.8; 
            } else {
                log("標準比率を適用。");
                gridConfig = { ox: canvas.width * 0.16, oy: canvas.height * 0.17, uw: canvas.width * 0.76, uh: canvas.height * 0.72 };
            }
            drawPreview();

            // --- STEP 2: マス目解析 ---
            await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
            const rows = 8; const cols = 8;
            const cellW = gridConfig.uw / cols;
            const cellH = gridConfig.uh / rows;
            const inputs = document.querySelectorAll('#scoreRows input');

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cellCanvas = document.createElement('canvas');
                    cellCanvas.width = 64; cellCanvas.height = 64;
                    const cCtx = cellCanvas.getContext('2d');
                    // マスの中心部を厚めに切り出す
                    cCtx.drawImage(canvas, gridConfig.ox + (c * cellW), gridConfig.oy + (r * cellH), cellW, cellH, 0, 0, 64, 64);

                    const { data: { text } } = await worker.recognize(cellCanvas);
                    const num = text.replace(/[^0-9]/g, '');
                    if (num) inputs[(r * cols) + c].value = num;
                }
            }
            log("✅ 解析完了。");
            await worker.terminate();
        } catch (e) {
            log("エラー: " + e.message);
        } finally {
            btn.disabled = false;
            calcTotals();
        }
    };

    function calcTotals() {
        const inputs = document.querySelectorAll('#scoreRows input');
        for(let p = 0; p < 4; p++) {
            let pTotal = 0;
            for(let i = 0; i < 8; i++) {
                const plus = parseInt(inputs[(i * 8) + (p * 2)].value) || 0;
                const minus = parseInt(inputs[(i * 8) + (p * 2) + 1].value) || 0;
                pTotal += (plus - minus);
            }
            const totalEl = document.getElementById(`total${'ABCD'[p]}`);
            if(totalEl) {
                totalEl.innerText = (pTotal > 0 ? '+' : '') + pTotal;
                totalEl.className = pTotal >= 0 ? 'text-blue-600' : 'text-red-500';
            }
        }
    }

    for (let i = 1; i <= 8; i++) {
        const row = document.createElement('div');
        row.className = 'flex items-center border-b border-gray-100 py-1 text-center';
        row.innerHTML = `<div class="w-8 text-[10px] text-gray-400 font-mono">${i}</div>
            <div class="flex-1 grid grid-cols-8 gap-0.5 px-1">
                ${Array(8).fill().map(() => `<input type="number" class="w-full text-center text-[12px] py-2 bg-slate-50 rounded border-none outline-none">`).join('')}
            </div>`;
        scoreRows.appendChild(row);
    }
    document.querySelectorAll('#scoreRows input').forEach(input => input.addEventListener('input', calcTotals));
});
