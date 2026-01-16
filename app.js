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
    }

    // 1. 画像読み込み
    imageInput.addEventListener('change', (e) => {
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

    // 2. プレビュー描画
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
        // メインの赤枠
        ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
        ctx.lineWidth = 5;
        ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);
        
        // 分割ガイド
        ctx.strokeStyle = "rgba(255, 0, 0, 0.2)";
        ctx.lineWidth = 1;
        const rows = 8; const cols = 8;
        for(let i=1; i<rows; i++) {
            let y = gridConfig.oy + (gridConfig.uh / rows) * i;
            ctx.beginPath(); ctx.moveTo(gridConfig.ox, y); ctx.lineTo(gridConfig.ox + gridConfig.uw, y); ctx.stroke();
        }
        for(let j=1; j<cols; j++) {
            let x = gridConfig.ox + (gridConfig.uw / cols) * j;
            ctx.beginPath(); ctx.moveTo(x, gridConfig.oy); ctx.lineTo(x, gridConfig.oy + gridConfig.uh); ctx.stroke();
        }
    }

    document.getElementById('rotateBtn').onclick = () => {
        rotation = (rotation + 90) % 360;
        drawPreview();
    };

    // 3. 🎯 解析エンジン（10%絞り込み・三点補正）
    document.getElementById('analyzeBtn').onclick = async () => {
        if (!currentImage) return log("エラー: 画像なし");
        log("解析開始...");
        const btn = document.getElementById('analyzeBtn');
        btn.disabled = true;

        try {
            const worker = await Tesseract.createWorker();
            await worker.loadLanguage('eng');
            await worker.initialize('eng');

            // --- STEP 1: アンカー特定 (横10%に限定) ---
            const scanCanvas = document.createElement('canvas');
            scanCanvas.width = canvas.width * 0.10; // 10%に絞り込み
            scanCanvas.height = canvas.height;
            const sCtx = scanCanvas.getContext('2d');
            sCtx.drawImage(canvas, 0, 0, canvas.width * 0.10, canvas.height, 0, 0, scanCanvas.width, scanCanvas.height);

            const { data } = await worker.recognize(scanCanvas);
            const firstOne = data.words.find(w => w.text.includes("1"));

            if (firstOne) {
                log("'1'を検知。枠を調整します。");
                const charH = firstOne.bbox.y1 - firstOne.bbox.y0;

                // 【上端】1の高さの半分（0.5）下げて氏名・ヘッダーを除外
                gridConfig.oy = firstOne.bbox.y0 + (charH * 0.5);
                
                // 【右端】Dさんマイナス列まで。右側余白を25%カット
                gridConfig.ox = firstOne.bbox.x1 + 5;
                gridConfig.uw = (canvas.width - gridConfig.ox) * 0.75;

                // 【下端】8回分。合計上の余白行を含まないよう16倍に設定
                gridConfig.uh = charH * 16.0; 

                log("グリッド設定完了");
            } else {
                log("アンカー失敗。標準設定適用。");
                gridConfig = { ox: canvas.width*0.18, oy: canvas.height*0.19, uw: canvas.width*0.72, uh: canvas.height*0.62 };
            }
            drawPreview();

            // --- STEP 2: 8x8スキャン ---
            await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
            const inputs = document.querySelectorAll('#scoreRows input');
            const cellW = gridConfig.uw / 8;
            const cellH = gridConfig.uh / 8;

            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const cellCanvas = document.createElement('canvas');
                    cellCanvas.width = 64; cellCanvas.height = 64;
                    const cCtx = cellCanvas.getContext('2d');
                    cCtx.drawImage(canvas, gridConfig.ox + (c * cellW), gridConfig.oy + (r * cellH), cellW, cellH, 0, 0, 64, 64);
                    const { data: { text } } = await worker.recognize(cellCanvas);
                    const num = text.replace(/[^0-9]/g, '');
                    if (num) inputs[(r * 8) + c].value = num;
                }
            }
            log("✅ 全解析完了");
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
            const el = document.getElementById(`total${'ABCD'[p]}`);
            if(el) {
                el.innerText = (pTotal > 0 ? '+' : '') + pTotal;
                el.className = pTotal >= 0 ? 'text-blue-600 font-bold' : 'text-red-500 font-bold';
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
