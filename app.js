// --- Supabase設定 ---
const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MiEHjzKEOTWweOp6h8Xqlg_0WvjDXKw';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const logEl = document.getElementById('debugLog');
    const scoreRows = document.getElementById('scoreRows');
    
    const sliders = { x: document.getElementById('adjustX'), y: document.getElementById('adjustY'), w: document.getElementById('adjustW'), h: document.getElementById('adjustH') };
    const labels = { x: document.getElementById('valX'), y: document.getElementById('valY'), w: document.getElementById('valW'), h: document.getElementById('valH') };

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

    // スコアボード初期化
    function init() {
        scoreRows.innerHTML = '';
        const playerInputs = document.getElementById('playerInputs');
        playerInputs.innerHTML = '';
        for (let i = 1; i <= 8; i++) {
            const row = document.createElement('div');
            row.className = 'grid grid-cols-9 items-center py-1 text-center';
            let html = `<div class="text-[10px] font-bold text-slate-300">${i}</div>`;
            for(let j=0; j<8; j++) html += `<div class="px-0.5"><input type="number" class="w-full text-center text-xs py-2 bg-slate-50 rounded border border-slate-100" placeholder="0"></div>`;
            row.innerHTML = html;
            scoreRows.appendChild(row);
        }
        ['A', 'B', 'C', 'D'].forEach(p => {
            playerInputs.innerHTML += `<input type="text" class="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-sm" placeholder="${p}さんの名前を入力" list="playerList">`;
        });
        loadPlayerSuggestions();
    }

    // 画像描画
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
        // ガイド枠
        ctx.strokeStyle = "#f97316"; ctx.lineWidth = Math.max(5, canvas.width / 120);
        ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);
    }

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
                log("画像読み込み完了。調整してください。");
                baseGrid = { ox: img.width * 0.1, oy: img.height * 0.2, uw: img.width * 0.8, uh: img.height * 0.5 };
                updateAdjustment();
            };
            img.src = f.target.result;
        };
        reader.readAsDataURL(file);
    };

    document.getElementById('rotateBtn').onclick = () => { rotation = (rotation + 90) % 360; drawPreview(); };

    // 解析
    document.getElementById('analyzeBtn').onclick = async () => {
        if (!currentImage) return;
        const btn = document.getElementById('analyzeBtn');
        btn.disabled = true; btn.innerText = "⏳...";
        log("解析中...");
        const worker = await Tesseract.createWorker();
        await worker.loadLanguage('eng'); await worker.initialize('eng');
        await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
        const inputs = document.querySelectorAll('#scoreRows input');
        const cellW = gridConfig.uw / 8; const cellH = gridConfig.uh / 8;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const crop = document.createElement('canvas'); crop.width = 64; crop.height = 64;
                crop.getContext('2d').drawImage(canvas, gridConfig.ox + (c * cellW), gridConfig.oy + (r * cellH), cellW, cellH, 0, 0, 64, 64);
                const { data: { text } } = await worker.recognize(crop);
                inputs[r * 8 + c].value = text.replace(/[^0-9]/g, '');
            }
            log(`解析中: ${r+1}/8行完了`);
        }
        await worker.terminate();
        btn.disabled = false; btn.innerText = "🎯 解析開始";
        log("全解析完了。数値を修正してください。");
        calcTotals();
    };

    function calcTotals() {
        const inputs = document.querySelectorAll('#scoreRows input');
        const totals = [0, 0, 0, 0];
        for(let r = 0; r < 8; r++) {
            for(let p = 0; p < 4; p++) {
                totals[p] += (parseInt(inputs[r*8+p*2].value)||0) - (parseInt(inputs[r*8+p*2+1].value)||0);
            }
        }
        ['A','B','C','D'].forEach((id, i) => {
            const el = document.getElementById(`total${id}`);
            el.innerText = (totals[i] >= 0 ? '+' : '') + totals[i];
            el.className = totals[i] >= 0 ? 'text-indigo-600' : 'text-rose-500';
        });
    }

    // 保存
    async function loadPlayerSuggestions() {
        const { data } = await supabase.from('players').select('name');
        if (data) document.getElementById('playerList').innerHTML = data.map(p => `<option value="${p.name}">`).join('');
    }

    document.getElementById('preSaveBtn').onclick = () => { document.getElementById('saveModal').style.display = 'flex'; };

    document.getElementById('finalSaveBtn').onclick = async () => {
        const btn = document.getElementById('finalSaveBtn');
        btn.disabled = true; btn.innerText = "保存中...";
        const names = Array.from(document.querySelectorAll('#playerInputs input')).map(i => i.value || '未設定');
        const inputs = document.querySelectorAll('#scoreRows input');
        const rawNumbers = Array.from(inputs).map(i => parseInt(i.value) || 0);
        const totals = [0,1,2,3].map(p => {
            let sum = 0; for(let r=0; r<8; r++) sum += (rawNumbers[r*8+p*2] - rawNumbers[r*8+p*2+1]);
            return sum;
        });

        try {
            for (const name of names) if (name !== '未設定') await supabase.from('players').upsert({ name }, { onConflict: 'name' });
            const { error } = await supabase.from('games').insert({ player_names: names, scores: totals, raw_data: { grid: rawNumbers } });
            if (error) throw error;
            alert("クラウドに保存しました！");
            document.getElementById('saveModal').style.display = 'none';
        } catch (e) { alert(e.message); }
        finally { btn.disabled = false; btn.innerText = "保存実行"; loadPlayerSuggestions(); }
    };

    scoreRows.addEventListener('input', calcTotals);
    init();
});
