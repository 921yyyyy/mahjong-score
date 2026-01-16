// 全ての処理を DOMContentLoaded 内に収めて紐付けミスを防ぐ
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

    // 1. 画像読み込み処理
    imageInput.addEventListener('change', (e) => {
        log("ファイル選択を検知しました");
        const file = e.target.files[0];
        if (!file) return;

        log(`読込中: ${file.name}`);
        const reader = new FileReader();
        reader.onload = (f) => {
            const img = new Image();
            img.onload = () => {
                log(`画像展開成功: ${img.width}x${img.height}`);
                currentImage = img;
                rotation = 0;
                gridConfig = { ox: 0, oy: 0, uw: 0, uh: 0 }; // 新規画像時はリセット
                drawPreview();
            };
            img.src = f.target.result;
        };
        reader.readAsDataURL(file);
    });

    // 2. プレビュー描画処理
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
        log("プレビューを更新しました");
    }

    function drawGuide() {
        ctx.strokeStyle = "rgba(255, 0, 0, 0.7)";
        ctx.lineWidth = Math.max(3, canvas.width / 150);
        ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);
        
        // グリッドの分割線も薄く表示して確認しやすくする
        ctx.strokeStyle = "rgba(255, 0, 0, 0.3)";
        ctx.lineWidth = 1;
        const rows = 8; const cols = 8;
        for(let i=1; i<rows; i++) {
            let y = gridConfig.oy + (gridConfig.uh / rows) * i;
            ctx.beginPath(); ctx.moveTo(gridConfig.ox, y); ctx.lineTo(gridConfig.ox + gridConfig.uw, y); ctx.stroke();
        }
    }

    // 3. 回転ボタン
    document.getElementById('rotateBtn').onclick = () => {
        if (!currentImage) return log("画像がありません");
        rotation = (rotation + 90) % 360;
        drawPreview();
    };

    // 4. 🎯 解析開始ボタン（座標補正ロジック含む）
    document.getElementById('analyzeBtn').onclick = async () => {
        if (!currentImage) return log("エラー: 画像がありません");
        log("解析エンジンを起動します...");
        const btn = document.getElementById('analyzeBtn');
        btn.disabled = true;

        try {
            const worker = await Tesseract.createWorker({
                logger: m => {
                    if (m.status === 'recognizing text' && Math.round(m.progress * 100) % 25 === 0) {
                        log(`進捗: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });
            await worker.loadLanguage('eng');
            await worker.initialize('eng');

            // --- STEP 1: 高速アンカー検知 & 座標補正 ---
            log("アンカー検知中 (横10%・縦50%)...");
            const scanCanvas = document.createElement('canvas');
            scanCanvas.width = canvas.width * 0.10;
            scanCanvas.height = canvas.height * 0.50;
            const sCtx = scanCanvas.getContext('2d');
            sCtx.drawImage(canvas, 0, 0, canvas.width * 0.10, canvas.height * 0.50, 0, 0, scanCanvas.width, scanCanvas.height);

            await worker.setParameters({ tessedit_char_whitelist: '1', tessedit_pageseg_mode: '11' });
            const { data } = await worker.recognize(scanCanvas);
            const firstOne = data.words.find(w => w.text.includes("1"));

            if (firstOne) {
                log(`'1'を発見。グリッドを最適化します。`);
                const charH = firstOne.bbox.y1 - firstOne.bbox.y0;
                
                // 【補正1】上端：1の文字の少し下から（氏名行を除外）
                gridConfig.oy = firstOne.bbox.y0 + (charH * 0.2); 
                
                // 【補正2】右端：A〜Dさんまで（5人目を除外）
                const availableW = canvas.width - firstOne.bbox.x1;
                gridConfig.ox = firstOne.bbox.x1 + (canvas.width * 0.05);
                gridConfig.uw = availableW * 0.76; // 右側の5人目列を切り捨て

                // 【補正3】下端：8行分に固定（余白・合計行を除外）
                gridConfig.uh = charH * 13.8; 
            } else {
                log("アンカー未検出。標準比率を適用。");
                gridConfig = { ox: canvas.width * 0.21, oy: canvas.height * 0.19, uw: canvas.width * 0.68, uh: canvas.height * 0.62 };
            }
            drawPreview();

            // --- STEP 2: マス目解析 ---
            log("数値スキャン開始...");
            await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
            const rows = 8; const cols = 8;
            const cellW = gridConfig.uw / cols;
            const cellH = gridConfig.uh / rows;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cellCanvas = document.createElement('canvas');
                    cellCanvas.width = 80; cellCanvas.height = 80;
                    const cCtx = cellCanvas.getContext('2d');
                    cCtx.drawImage(canvas, gridConfig.ox + (c * cellW), gridConfig.oy + (r * cellH), cellW, cellH, 0, 0, 80, 80);

                    const { data: { text } } = await worker.recognize(cellCanvas);
                    const num = text.replace(/[^0-9]/g, '');
                    if (num) {
                        const inputs = document.querySelectorAll('#scoreRows input');
                        inputs[(r * cols) + c].value = num;
                    }
                }
            }
            log("✅ 全工程完了。合計を算出します。");
            await worker.terminate();
        } catch (e) {
            log("エラー: " + e.message);
        } finally {
            btn.disabled = false;
            calcTotals();
        }
    };

    // 5. 合計計算・スコア入力欄生成
    function calcTotals() {
        for(let p = 0; p < 4; p++) {
            let pTotal = 0;
            const inputs = document.querySelectorAll('#scoreRows input');
            for(let i = 0; i < 8; i++) {
                // p0: A+, p1: A-, p2: B+... という並びを想定
                // 実際は 1行(8列)ごとにループしているので index = (i*8) + (p*2) か (i*8) + (p*2)+1
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
        row.innerHTML = `
            <div class="w-8 text-[10px] text-gray-400 font-mono">${i}</div>
            <div class="flex-1 grid grid-cols-8 gap-0.5 px-1">
                ${Array(8).fill().map(() => `<input type="number" class="w-full text-center text-[11px] py-2 bg-slate-50 rounded border-none outline-none focus:bg-white" placeholder="0">`).join('')}
            </div>
        `;
        scoreRows.appendChild(row);
    }
    // 入力欄へのイベントリスナー一括付与
    document.querySelectorAll('#scoreRows input').forEach(input => {
        input.addEventListener('input', calcTotals);
    });
    
    log("システム準備完了。");
});
