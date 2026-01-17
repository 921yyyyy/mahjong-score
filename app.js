document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('imageInput');
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const logEl = document.getElementById('debugLog');
    const scoreRows = document.getElementById('scoreRows');
    
    // スライダー連携
    const adjustY = document.getElementById('adjustY');
    const adjustH = document.getElementById('adjustH');
    const valY = document.getElementById('valY');
    const valH = document.getElementById('valH');

    let currentImage = null;
    let rotation = 0;
    let baseGrid = { ox: 0, oy: 0, uw: 0, uh: 0 }; 
    let gridConfig = { ox: 0, oy: 0, uw: 0, uh: 0 };

    function log(msg) {
        const div = document.createElement('div');
        div.className = "mb-1 border-l-2 border-emerald-800 pl-2";
        div.innerText = `${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})} > ${msg}`;
        logEl.appendChild(div);
        logEl.scrollTop = logEl.scrollHeight;
    }

    // --- 1. スコアボードの初期化 (8列×8行) ---
    function initScoreTable() {
        scoreRows.innerHTML = '';
        for (let i = 1; i <= 8; i++) {
            const row = document.createElement('div');
            row.className = 'grid grid-cols-9 items-center text-center py-2 group hover:bg-slate-50 transition-colors';
            let cells = `<div class="text-[10px] font-bold text-slate-300">${i}</div>`;
            for(let j=0; j<8; j++) {
                cells += `<div class="px-0.5"><input type="number" class="w-full text-center text-xs py-2 bg-slate-50 border border-transparent rounded focus:border-indigo-300 focus:bg-white transition-all" placeholder="-"></div>`;
            }
            row.innerHTML = cells;
            scoreRows.appendChild(row);
        }
    }
    initScoreTable();

    // --- 2. スライダー操作の即時反映 ---
    function updateAdjustment() {
        if (!currentImage) return;
        valY.innerText = `${adjustY.value}px`;
        valH.innerText = `${adjustH.value}x`;
        
        gridConfig.ox = baseGrid.ox;
        gridConfig.uw = baseGrid.uw;
        gridConfig.oy = baseGrid.oy + parseInt(adjustY.value);
        gridConfig.uh = baseGrid.uh * parseFloat(adjustH.value);
        drawPreview();
    }

    [adjustY, adjustH].forEach(el => el.addEventListener('input', updateAdjustment));

    // --- 3. 画像読み込み & アンカー検知 ---
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (f) => {
            const img = new Image();
            img.onload = () => {
                log("画像を読み込みました。解析の準備をしています...");
                currentImage = img;
                rotation = 0;
                detectAnchor();
            };
            img.src = f.target.result;
        };
        reader.readAsDataURL(file);
    });

    async function detectAnchor() {
        const worker = await Tesseract.createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        
        canvas.width = currentImage.width;
        canvas.height = currentImage.height;
        ctx.drawImage(currentImage, 0, 0);

        // 左側10%エリアで「1」を探す
        const { data } = await worker.recognize(canvas, { 
            rectangle: { left: 0, top: 0, width: canvas.width * 0.15, height: canvas.height } 
        });
        const anchor = data.words.find(w => w.text.includes("1") || w.text.includes("I"));

        if (anchor) {
            log("'1'行目を特定しました。自動調整を行います。");
            const h = anchor.bbox.y1 - anchor.bbox.y0;
            baseGrid = {
                ox: anchor.bbox.x1 + 10,
                oy: anchor.bbox.y0 + (h * 0.5),
                uw: (canvas.width - anchor.bbox.x1) * 0.72,
                uh: h * 17
            };
        } else {
            log("アンカー検知に失敗しました。標準枠を表示します。スライダーで合わせてください。");
            baseGrid = { ox: canvas.width * 0.18, oy: canvas.height * 0.18, uw: canvas.width * 0.7, uh: canvas.height * 0.6 };
        }
        updateAdjustment();
        await worker.terminate();
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

        // 調整用の赤枠
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = Math.max(4, canvas.width / 150);
        ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);
        
        // 8x8のガイド線
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(249, 115, 22, 0.4)";
        for(let i=1; i<8; i++) {
            let y = gridConfig.oy + (gridConfig.uh/8)*i;
            ctx.beginPath(); ctx.moveTo(gridConfig.ox, y); ctx.lineTo(gridConfig.ox + gridConfig.uw, y); ctx.stroke();
        }
        for(let j=1; j<8; j++) {
            let x = gridConfig.ox + (gridConfig.uw/8)*j;
            ctx.beginPath(); ctx.moveTo(x, gridConfig.oy); ctx.lineTo(x, gridConfig.oy + gridConfig.uh); ctx.stroke();
        }
    }

    document.getElementById('rotateBtn').onclick = () => {
        rotation = (rotation + 90) % 360;
        drawPreview();
    };

    // --- 4. 順次解析エンジン (フリーズ防止策) ---
    document.getElementById('analyzeBtn').onclick = async () => {
        if (!currentImage) return;
        const btn = document.getElementById('analyzeBtn');
        btn.disabled = true;
        btn.innerText = "⏳ 解析中...";
        log("マス目解析を開始します。しばらくお待ちください...");

        const worker = await Tesseract.createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        await worker.setParameters({ tessedit_char_whitelist: '0123456789' });

        const inputs = document.querySelectorAll('#scoreRows input');
        const cellW = gridConfig.uw / 8;
        const cellH = gridConfig.uh / 8;

        // 1マスずつ順番にOCRにかける（ブラウザのフリーズを防ぐ）
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const crop = document.createElement('canvas');
                crop.width = 64; crop.height = 64;
                const cctx = crop.getContext('2d');
                // canvasの画像情報を元に切り出し
                cctx.drawImage(canvas, gridConfig.ox + (c * cellW), gridConfig.oy + (r * cellH), cellW, cellH, 0, 0, 64, 64);
                
                const { data: { text } } = await worker.recognize(crop);
                const val = text.replace(/[^0-9]/g, '');
                inputs[r * 8 + c].value = val;
            }
            log(`進捗: ${Math.round((r + 1) / 8 * 100)}% 完了`);
        }

        log("✅ すべての解析が完了しました。合計を算出します。");
        await worker.terminate();
        btn.disabled = false;
        btn.innerText = "🎯 解析開始";
        calcTotals();
    };

    // --- 合計計算 ---
    function calcTotals() {
        const inputs = document.querySelectorAll('#scoreRows input');
        const totals = [0, 0, 0, 0];
        for(let r = 0; r < 8; r++) {
            for(let p = 0; p < 4; p++) {
                const plus = parseInt(inputs[(r * 8) + (p * 2)].value) || 0;
                const minus = parseInt(inputs[(r * 8) + (p * 2) + 1].value) || 0;
                totals[p] += (plus - minus);
            }
        }
        ['A','B','C','D'].forEach((id, i) => {
            const el = document.getElementById(`total${id}`);
            el.innerText = (totals[i] >= 0 ? '+' : '') + totals[i];
            el.className = `flex items-center justify-center font-black ${totals[i] >= 0 ? 'text-indigo-600' : 'text-rose-500'}`;
        });
    }

    scoreRows.addEventListener('input', calcTotals);
});
