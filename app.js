document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const logEl = document.getElementById('debugLog');
    const scoreRows = document.getElementById('scoreRows');
    
    // スライダー群
    const sliders = {
        x: document.getElementById('adjustX'),
        y: document.getElementById('adjustY'),
        w: document.getElementById('adjustW'),
        h: document.getElementById('adjustH')
    };
    const labels = {
        x: document.getElementById('valX'),
        y: document.getElementById('valY'),
        w: document.getElementById('valW'),
        h: document.getElementById('valH')
    };

    let currentImage = null;
    let rotation = 0;
    let baseGrid = { ox: 0, oy: 0, uw: 0, uh: 0 }; 
    let gridConfig = { ox: 0, oy: 0, uw: 0, uh: 0 };

    function log(msg) {
        const div = document.createElement('div');
        div.innerText = `${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})} > ${msg}`;
        logEl.appendChild(div);
        logEl.scrollTop = logEl.scrollHeight;
    }

    // スコア行生成（＋－がわかるように）
    function initScoreTable() {
        scoreRows.innerHTML = '';
        for (let i = 1; i <= 8; i++) {
            const row = document.createElement('div');
            row.className = 'grid grid-cols-9 items-center py-1 text-center';
            let html = `<div class="text-[9px] font-bold text-slate-300">${i}</div>`;
            for(let j=0; j<8; j++) {
                html += `<div class="px-0.5"><input type="number" class="w-full text-center text-xs py-1.5 bg-slate-50 rounded border border-slate-100 focus:bg-white" placeholder="0"></div>`;
            }
            row.innerHTML = html;
            scoreRows.appendChild(row);
        }
    }
    initScoreTable();

    function updateAdjustment() {
        if (!currentImage) return;
        labels.x.innerText = sliders.x.value;
        labels.y.innerText = sliders.y.value;
        labels.w.innerText = sliders.w.value + 'x';
        labels.h.innerText = sliders.h.value + 'x';
        
        gridConfig.ox = baseGrid.ox + parseInt(sliders.x.value);
        gridConfig.oy = baseGrid.oy + parseInt(sliders.y.value);
        gridConfig.uw = baseGrid.uw * parseFloat(sliders.w.value);
        gridConfig.uh = baseGrid.uh * parseFloat(sliders.h.value);
        drawPreview();
    }

    Object.values(sliders).forEach(s => s.addEventListener('input', updateAdjustment));

    document.getElementById('imageInput').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (f) => {
            const img = new Image();
            img.onload = () => {
                currentImage = img;
                rotation = 0;
                log("画像読み込み完了。初期配置を行います...");
                // 初期値（AI検知なしで安定させる）
                baseGrid = { ox: img.width * 0.15, oy: img.height * 0.2, uw: img.width * 0.7, uh: img.height * 0.5 };
                updateAdjustment();
            };
            img.src = f.target.result;
        };
        reader.readAsDataURL(file);
    };

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

        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = Math.max(4, canvas.width / 150);
        ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);
        
        // 8x8 ガイド
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

    document.getElementById('analyzeBtn').onclick = async () => {
        if (!currentImage) return;
        const btn = document.getElementById('analyzeBtn');
        btn.disabled = true; btn.innerText = "⏳ 解析中...";
        log("解析開始...");

        const worker = await Tesseract.createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        await worker.setParameters({ tessedit_char_whitelist: '0123456789' });

        const inputs = document.querySelectorAll('#scoreRows input');
        const cellW = gridConfig.uw / 8;
        const cellH = gridConfig.uh / 8;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const crop = document.createElement('canvas');
                crop.width = 64; crop.height = 64;
                const cctx = crop.getContext('2d');
                cctx.drawImage(canvas, gridConfig.ox + (c * cellW), gridConfig.oy + (r * cellH), cellW, cellH, 0, 0, 64, 64);
                const { data: { text } } = await worker.recognize(crop);
                inputs[r * 8 + c].value = text.replace(/[^0-9]/g, '');
            }
            log(`行 ${r+1}/8 完了`);
        }
        await worker.terminate();
        btn.disabled = false; btn.innerText = "🎯 解析開始";
        log("✅ 解析完了");
        calcTotals();
    };

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
            el.className = totals[i] >= 0 ? 'text-indigo-600' : 'text-rose-500';
        });
    }
    scoreRows.addEventListener('input', calcTotals);
});
