document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('imageInput');
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const logEl = document.getElementById('debugLog');
    const scoreRows = document.getElementById('scoreRows');
    
    // スライダー要素
    const adjustY = document.getElementById('adjustY');
    const adjustH = document.getElementById('adjustH');

    let currentImage = null;
    let rotation = 0;
    let baseGrid = { ox: 0, oy: 0, uw: 0, uh: 0 }; // AIが検知した基本座標
    let gridConfig = { ox: 0, oy: 0, uw: 0, uh: 0 }; // 実際に使用する調整後座標

    function log(msg) {
        const div = document.createElement('div');
        div.innerText = `> ${new Date().toLocaleTimeString()}: ${msg}`;
        logEl.appendChild(div);
        logEl.scrollTop = logEl.scrollHeight;
    }

    // スライダーが動いたら再描画
    [adjustY, adjustH].forEach(el => el.addEventListener('input', () => {
        applyAdjustment();
        drawPreview();
    }));

    function applyAdjustment() {
        if (baseGrid.uw === 0) return;
        const offsetYAmt = parseInt(adjustY.value);
        const scaleHAmt = parseFloat(adjustH.value);
        
        gridConfig.oy = baseGrid.oy + offsetYAmt;
        gridConfig.uh = baseGrid.uh * scaleHAmt;
        gridConfig.ox = baseGrid.ox;
        gridConfig.uw = baseGrid.uw;
    }

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (f) => {
            const img = new Image();
            img.onload = () => {
                currentImage = img;
                rotation = 0;
                baseGrid = { ox: 0, oy: 0, uw: 0, uh: 0 };
                // 初期検知を走らせる
                autoDetect();
            };
            img.src = f.target.result;
        };
        reader.readAsDataURL(file);
    });

    async function autoDetect() {
        log("アンカー検知を開始...");
        drawPreview();
        const worker = await Tesseract.createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');

        const scanCanvas = document.createElement('canvas');
        scanCanvas.width = canvas.width * 0.10;
        scanCanvas.height = canvas.height;
        const sCtx = scanCanvas.getContext('2d');
        sCtx.drawImage(canvas, 0, 0, canvas.width * 0.10, canvas.height, 0, 0, scanCanvas.width, scanCanvas.height);

        const { data } = await worker.recognize(scanCanvas);
        const firstOne = data.words.find(w => w.text.includes("1"));

        if (firstOne) {
            log("'1'を検知。スライダーで微調整してください。");
            const charH = firstOne.bbox.y1 - firstOne.bbox.y0;
            baseGrid.ox = firstOne.bbox.x1 + 5;
            baseGrid.oy = firstOne.bbox.y0 + (charH * 0.5);
            baseGrid.uw = (canvas.width - baseGrid.ox) * 0.76;
            baseGrid.uh = charH * 16.0;
            applyAdjustment();
        } else {
            log("アンカー失敗。手動で枠を合わせてください。");
            baseGrid = { ox: canvas.width*0.18, oy: canvas.height*0.2, uw: canvas.width*0.7, uh: canvas.height*0.6 };
            applyAdjustment();
        }
        drawPreview();
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

        if (gridConfig.uw > 0) {
            ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
            ctx.lineWidth = 5;
            ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);
            
            ctx.strokeStyle = "rgba(255, 0, 0, 0.3)";
            ctx.lineWidth = 1;
            for(let i=1; i<8; i++) {
                let y = gridConfig.oy + (gridConfig.uh/8)*i;
                ctx.beginPath(); ctx.moveTo(gridConfig.ox, y); ctx.lineTo(gridConfig.ox+gridConfig.uw, y); ctx.stroke();
            }
        }
    }

    document.getElementById('rotateBtn').onclick = () => {
        rotation = (rotation + 90) % 360;
        drawPreview();
    };

    document.getElementById('analyzeBtn').onclick = async () => {
        if (!currentImage) return;
        log("数値解析中...");
        const btn = document.getElementById('analyzeBtn');
        btn.disabled = true;

        const worker = await Tesseract.createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
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
        btn.disabled = false;
        calcTotals();
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
                ${Array(8).fill().map(() => `<input type="number" class="w-full text-center text-[12px] py-2 bg-slate-50 rounded border-none">`).join('')}
            </div>`;
        scoreRows.appendChild(row);
    }
});
