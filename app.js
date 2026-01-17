document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const logEl = document.getElementById('debugLog');
    const gridBody = document.getElementById('gridBody');
    
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
        div.innerText = `> ${msg}`;
        logEl.appendChild(div);
        logEl.scrollTop = logEl.scrollHeight;
    }

    // --- 本格グリッド生成（行単位の調整ボタンを追加） ---
    function initScoreTable() {
        gridBody.innerHTML = '';
        for (let i = 1; i <= 8; i++) {
            // 回数セル + 行調整ボタン
            const numCell = document.createElement('div');
            numCell.className = 'cell-num flex flex-col items-center justify-center border-b border-slate-100 bg-slate-50 relative';
            numCell.innerHTML = `
                <span class="text-[10px] font-bold">${i}</span>
                <button onclick="adjustLine(${i-1})" class="mt-1 text-[8px] bg-orange-500 text-white px-1.5 py-0.5 rounded shadow-sm active:scale-90 transition-transform">整</button>
            `;
            gridBody.appendChild(numCell);

            for(let p = 0; p < 4; p++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell border-b border-slate-100';
                cell.innerHTML = `
                    <input type="number" class="w-1/2 text-center text-xs py-2 input-plus rounded-sm" placeholder="+">
                    <input type="number" class="w-1/2 text-center text-xs py-2 input-minus rounded-sm" placeholder="-">
                `;
                gridBody.appendChild(cell);
            }
        }
    }
    initScoreTable();

    // 行ごとの自動調整関数（Dさんのプラス/マイナスをいじって合計を0にする）
    window.adjustLine = (rowIdx) => {
        const inputs = document.querySelectorAll('#gridBody input');
        let otherPlayersSum = 0;
        
        // A, B, Cさんの合計を計算
        for(let p = 0; p < 3; p++) {
            const plus = parseInt(inputs[rowIdx * 8 + p * 2].value) || 0;
            const minus = parseInt(inputs[rowIdx * 8 + p * 2 + 1].value) || 0;
            otherPlayersSum += (plus - minus);
        }

        // Dさんの入力欄（プラスは 8k+6, マイナスは 8k+7）
        const dPlusInput = inputs[rowIdx * 8 + 6];
        const dMinusInput = inputs[rowIdx * 8 + 7];

        if (otherPlayersSum > 0) {
            dPlusInput.value = 0;
            dMinusInput.value = otherPlayersSum;
        } else {
            dPlusInput.value = Math.abs(otherPlayersSum);
            dMinusInput.value = 0;
        }
        
        calcTotals();
    };

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
                log("画像読み込み成功。赤枠を数字に合わせてください。");
                baseGrid = { ox: img.width * 0.1, oy: img.height * 0.2, uw: img.width * 0.8, uh: img.height * 0.5 };
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
        ctx.lineWidth = Math.max(5, canvas.width / 120);
        ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(249, 115, 22, 0.5)";
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
        btn.disabled = true; btn.innerText = "⏳ 読込中...";
        log("全マス目をスキャンしています...");

        const worker = await Tesseract.createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        await worker.setParameters({ tessedit_char_whitelist: '0123456789' });

        const inputs = document.querySelectorAll('#gridBody input');
        const cellW = gridConfig.uw / 8;
        const cellH = gridConfig.uh / 8;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const crop = document.createElement('canvas');
                crop.width = 80; crop.height = 80;
                const cctx = crop.getContext('2d');
                cctx.drawImage(canvas, gridConfig.ox + (c * cellW), gridConfig.oy + (r * cellH), cellW, cellH, 0, 0, 80, 80);
                const { data: { text } } = await worker.recognize(crop);
                inputs[r * 8 + c].value = text.replace(/[^0-9]/g, '');
            }
            log(`進捗: ${Math.round((r + 1) / 8 * 100)}% 完了`);
        }
        await worker.terminate();
        btn.disabled = false; btn.innerText = "🎯 スキャン開始";
        log("✅ 解析完了");
        calcTotals();
    };

    // --- 行単位の整合性チェック付き計算 ---
    function calcTotals() {
        const inputs = document.querySelectorAll('#gridBody input');
        const totals = [0, 0, 0, 0];
        let invalidLines = [];

        for(let r = 0; r < 8; r++) {
            let lineSum = 0;
            for(let p = 0; p < 4; p++) {
                const plus = parseInt(inputs[(r * 8) + (p * 2)].value) || 0;
                const minus = parseInt(inputs[(r * 8) + (p * 2) + 1].value) || 0;
                const score = plus - minus;
                totals[p] += score;
                lineSum += score;
            }
            
            // 行ごとの背景色フィードバック（横の合計が0でない場合は赤くする）
            const rowLabelCell = gridBody.children[r * 5];
            if (lineSum !== 0) {
                rowLabelCell.style.backgroundColor = '#fee2e2'; // 赤背景
                invalidLines.push(r + 1);
            } else {
                rowLabelCell.style.backgroundColor = ''; // 通常
            }
        }

        const saveBtn = document.getElementById('saveData');
        if (invalidLines.length === 0) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `💾 結果を保存 (全行OK ✅)`;
            saveBtn.className = "w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95";
        } else {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `⚠️ 横の合計を0にしてください (行: ${invalidLines.join(',')})`;
            saveBtn.className = "w-full py-5 bg-slate-600 text-slate-400 font-black rounded-2xl shadow-xl cursor-not-allowed";
        }

        ['A','B','C','D'].forEach((id, i) => {
            const el = document.getElementById(`total${id}`);
            el.innerText = (totals[i] >= 0 ? '+' : '') + totals[i];
            el.className = `bg-slate-50 py-3 text-center font-black text-sm border-t border-slate-400 ${totals[i] >= 0 ? 'text-indigo-600' : 'text-rose-500'}`;
        });
    }

    gridBody.addEventListener('input', calcTotals);

    // --- クラウド保存ロジック ---
    const initCloud = () => {
        if (!window.supabase) {
            setTimeout(initCloud, 500);
            return;
        }

        const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        const saveBtn = document.getElementById('saveData');
        const modal = document.getElementById('cloudModal');
        const playerInputsArea = document.getElementById('playerInputs');
        const submitBtn = document.getElementById('dbSubmitBtn');

        saveBtn.onclick = () => {
            playerInputsArea.innerHTML = '';
            ['A', 'B', 'C', 'D'].forEach(p => {
                playerInputsArea.innerHTML += `
                    <div class="space-y-1">
                        <label class="text-[10px] text-slate-400 font-bold ml-1">${p}さんの名前</label>
                        <input type="text" class="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white text-sm" 
                               placeholder="名前を入力" list="playerHistory">
                    </div>`;
            });
            modal.style.display = 'flex';
        };

        submitBtn.onclick = async () => {
            submitBtn.disabled = true;
            submitBtn.innerText = "保存中...";
            const names = Array.from(playerInputsArea.querySelectorAll('input')).map(i => i.value || '未設定');
            const scoreInputs = document.querySelectorAll('#gridBody input');
            const rawNumbers = Array.from(scoreInputs).map(i => parseInt(i.value) || 0);
            
            const totals = [0, 1, 2, 3].map(p => {
                let sum = 0;
                for(let r=0; r<8; r++) sum += (rawNumbers[r*8 + p*2] - rawNumbers[r*8 + p*2 + 1]);
                return sum;
            });

            try {
                const { error } = await supabase.from('games').insert({
                    player_names: names,
                    scores: totals,
                    raw_data: { grid: rawNumbers }
                });
                if (error) throw error;
                alert("クラウド保存に成功しました！");
                modal.style.display = 'none';
            } catch (err) {
                alert("エラー: " + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = "DBに保存";
            }
        };
    };
    initCloud();
});
