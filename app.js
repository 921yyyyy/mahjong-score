// --- Supabase接続設定 (メモした内容に書き換えてください) ---
const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MiEHjzKEOTWweOp6h8Xqlg_0WvjDXKw';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const gridBody = document.getElementById('gridBody');
    const playerInputs = document.getElementById('playerInputs');

    // 1. グリッドとモーダル入力欄の生成
    function init() {
        gridBody.innerHTML = '';
        playerInputs.innerHTML = '';
        for (let i = 1; i <= 8; i++) {
            gridBody.innerHTML += `<div class="flex items-center justify-center text-[10px] font-bold text-slate-500 border-b border-slate-800">${i}</div>`;
            for (let p = 0; p < 4; p++) {
                gridBody.innerHTML += `
                    <div class="grid-cell border-b border-slate-800">
                        <input type="number" class="input-plus" placeholder="0">
                        <input type="number" class="input-minus" placeholder="0">
                    </div>`;
            }
        }
        ['A', 'B', 'C', 'D'].forEach(p => {
            playerInputs.innerHTML += `
                <div>
                    <label class="text-[10px] font-bold text-slate-400">${p}さんの名前</label>
                    <input type="text" class="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-sm" placeholder="名前を入力（自動補完）" list="playerList">
                </div>`;
        });
        document.body.insertAdjacentHTML('beforeend', '<datalist id="playerList"></datalist>');
        loadPlayerSuggestions();
    }

    // プレイヤー名の自動補完候補をDBから取得
    async function loadPlayerSuggestions() {
        const { data } = await supabase.from('players').select('name');
        const list = document.getElementById('playerList');
        if (data) list.innerHTML = data.map(p => `<option value="${p.name}">`).join('');
    }

    // 保存処理
    document.getElementById('preSaveBtn').onclick = () => {
        document.getElementById('saveModal').style.display = 'flex';
    };

    document.getElementById('finalSaveBtn').onclick = async () => {
        const btn = document.getElementById('finalSaveBtn');
        btn.disabled = true;
        btn.innerText = "保存中...";

        const names = Array.from(document.querySelectorAll('#playerInputs input')).map(i => i.value || '未設定');
        const inputs = document.querySelectorAll('#gridBody input');
        
        // 数値データの抽出
        const rawNumbers = Array.from(inputs).map(i => parseInt(i.value) || 0);
        const totals = [0, 1, 2, 3].map(p => {
            let sum = 0;
            for(let r=0; r<8; r++) {
                sum += (rawNumbers[r*8 + p*2] - rawNumbers[r*8 + p*2 + 1]);
            }
            return sum;
        });

        try {
            // 1. プレイヤーをDBに（未登録なら）保存
            for (const name of names) {
                if (name !== '未設定') {
                    await supabase.from('players').upsert({ name: name }, { onConflict: 'name' });
                }
            }

            // 2. ゲーム結果を保存
            const { error } = await supabase.from('games').insert({
                player_names: names,
                scores: totals,
                raw_data: { grid: rawNumbers }
            });

            if (error) throw error;
            alert("クラウドに保存しました！");
            document.getElementById('saveModal').style.display = 'none';
        } catch (err) {
            alert("エラーが発生しました: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = "DBに保存";
            loadPlayerSuggestions();
        }
    };

    // --- ここに以前のキャンバス描画・解析ロジック（1の状態）を結合 ---
    // (長くなるため、画像解析と合計計算の部分は「1の状態」からそのまま移植してください)
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

    // --- 本格グリッド生成 ---
    function initScoreTable() {
        gridBody.innerHTML = '';
        for (let i = 1; i <= 8; i++) {
            // 回数セル
            const numCell = document.createElement('div');
            numCell.className = 'cell-num flex items-center justify-center border-b border-slate-100';
            numCell.innerText = i;
            gridBody.appendChild(numCell);

            // A〜Dさんの入力セル
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
                // 初期値を設定
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

        // 調整枠
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = Math.max(5, canvas.width / 120);
        ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);
        
        // 8x8 ガイド
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

    function calcTotals() {
        const inputs = document.querySelectorAll('#gridBody input');
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
            el.className = `bg-slate-50 py-3 text-center font-black text-sm border-t border-slate-400 ${totals[i] >= 0 ? 'text-indigo-600' : 'text-rose-500'}`;
        });
    }
    gridBody.addEventListener('input', calcTotals);
});

    init();
});

