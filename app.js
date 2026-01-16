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

    // 1. 画像読み込み
    imageInput.addEventListener('change', (e) => {
        log("ファイル選択を検知");
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (f) => {
            const img = new Image();
            img.onload = () => {
                log(`読込成功: ${img.width}x${img.height}`);
                currentImage = img;
                rotation = 0;
                gridConfig = { ox: 0, oy: 0, uw: 0, uh: 0 };
                drawPreview();
            };
            img.src = f.target.result;
        };
        reader.readAsDataURL(file);
    });

    // 2. プレビュー描画（ガイド線付き）
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
        
        // 8行分の横分割線を表示
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

    // 3. 🎯 解析エンジン（アンカー検知強化版）
    document.getElementById('analyzeBtn').onclick = async () => {
        if (!currentImage) return log("エラー: 画像なし");
        log("解析開始（1-3アンカー探索）...");
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

            // --- STEP 1: アンカー検知 & 座標自動補正 ---
            // 左端15%エリアを二値化して精度向上
            const scanCanvas = document.createElement('canvas');
            scanCanvas.width = canvas.width * 0.15;
            scanCanvas.height = canvas.height * 0.60;
            const sCtx = scanCanvas.getContext('2d');
            sCtx.drawImage(canvas, 0, 0, canvas.width * 0.15, canvas.height * 0.60, 0, 0, scanCanvas.width, scanCanvas.height);

            // 二値化フィルタ（OCR用）
            const imgData = sCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
            for (let i = 0; i < imgData.data.length; i += 4) {
                const avg = (imgData.data[i] + imgData.data[i+1] + imgData.data[i+2]) / 3;
                const v = avg > 140 ? 255 : 0; 
                imgData.data[i] = imgData.data[i+1] = imgData.data[i+2] = v;
            }
            sCtx.putImageData(imgData, 0, 0);

            await worker.setParameters({ tessedit_char_whitelist: '123', tessedit_pageseg_mode: '11' });
            const { data } = await worker.recognize(scanCanvas);
            const anchor = data.words.find(w => ["1", "2", "3"].some(num => w.text.includes(num)));

            if (anchor) {
                const foundNum = anchor.text.match(/[1-3]/)[0];
                log(`アンカー'${foundNum}'を検知成功`);
                const charH = anchor.bbox.y1 - anchor.bbox.y0;
                
                // 1行目の位置を推定
                const offsetRows = parseInt(foundNum) - 1;
                const estimatedY1 = anchor.bbox.y0 - (charH * 1.5 * offsetRows);

                // 【課題解決】各マージン設定
                gridConfig.ox = anchor.bbox.x1 + 5; 
                gridConfig.oy = estimatedY1 + (charH * 0.6); // 氏名・ヘッダー追い出し
                gridConfig.uw = (canvas.width - gridConfig.ox) * 0.76; // 5人目追い出し
                gridConfig.uh = charH * 19.5; // 8行目までカバー
                log("グリッドを自動確定しました");
            } else {
                log("アンカー検知失敗。標準比率を適用。");
                gridConfig = { ox: canvas.width * 0.18, oy: canvas.height * 0.17, uw: canvas.width * 0.72, uh: canvas.height * 0.65 };
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
                    // マスの中心付近をスキャン
                    cCtx.drawImage(canvas, gridConfig.ox + (c * cellW), gridConfig.oy + (r * cellH), cellW, cellH, 0, 0, 64, 64);
                    const { data: { text } } = await worker.recognize(cellCanvas);
                    const num = text.replace(/[^0-9]/g, '');
                    if (num) inputs[(r * cols) + c].value = num;
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

    // 合計計算
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
                totalEl.className = pTotal >= 0 ? 'text-blue-600 font-bold' : 'text-red-500 font-bold';
            }
        }
    }

    // スコア行の生成
    for (let i = 1; i <= 8; i++) {
        const row = document.createElement('div');
        row.className = 'flex items-center border-b border-gray-100 py-1 text-center';
        row.innerHTML = `<div class="w-8 text-[10px] text-gray-400 font-mono">${i}</div>
            <div class="flex-1 grid grid-cols-8 gap-0.5 px-1">
                ${Array(8).fill().map(() => `<input type="number" class="w-full text-center text-[11px] py-2 bg-slate-50 rounded border-none outline-none">`).join('')}
            </div>`;
        scoreRows.appendChild(row);
    }
    document.querySelectorAll('#scoreRows input').forEach(input => input.addEventListener('input', calcTotals));
    log("システム準備完了。");
});
