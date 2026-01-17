// ==========================================
// 1. 基本設定とSupabase初期化
// ==========================================
const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let statsGrid = null;

// ==========================================
// 2. 共通関数 (グローバル)
// ==========================================

// --- スコアボード合計計算 ---
function calcTotals() {
    const gridBody = document.getElementById('gridBody');
    const inputs = document.querySelectorAll('#gridBody input');
    if (!gridBody || inputs.length === 0) return;

    const totals = [0, 0, 0, 0];
    let invalidLines = [];

    for (let r = 0; r < 8; r++) {
        let lineSum = 0;
        for (let p = 0; p < 4; p++) {
            const plus = parseInt(inputs[(r * 8) + (p * 2)].value) || 0;
            const minus = parseInt(inputs[(r * 8) + (p * 2) + 1].value) || 0;
            const score = plus - minus;
            totals[p] += score;
            lineSum += score;
        }
        
        // 横の合計が0でない行を特定
        const rowLabelCell = gridBody.children[r * 5];
        if (rowLabelCell) {
            if (lineSum !== 0) {
                rowLabelCell.style.backgroundColor = '#fee2e2'; // 薄い赤
                invalidLines.push(r + 1);
            } else {
                rowLabelCell.style.backgroundColor = '';
            }
        }
    }

    const saveBtn = document.getElementById('saveData');
    if (saveBtn) {
        if (invalidLines.length === 0) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `💾 結果を保存 (全行OK ✅)`;
            saveBtn.className = "w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl active:scale-95";
        } else {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `⚠️ 合計を0に (行: ${invalidLines.join(',')})`;
            saveBtn.className = "w-full py-5 bg-slate-600 text-slate-400 font-black rounded-2xl shadow-xl";
        }
    }

    ['A','B','C','D'].forEach((id, i) => {
        const el = document.getElementById(`total${id}`);
        if (el) {
            el.innerText = (totals[i] >= 0 ? '+' : '') + totals[i];
            el.className = `bg-slate-50 py-3 text-center font-black border-t border-slate-400 ${totals[i] >= 0 ? 'text-indigo-600' : 'text-rose-500'}`;
        }
    });
}

// --- 行ごとの自動調整 (整ボタン) ---
window.adjustLine = (rowIdx) => {
    const inputs = document.querySelectorAll('#gridBody input');
    let otherSum = 0;
    for (let p = 0; p < 3; p++) {
        const plus = parseInt(inputs[rowIdx * 8 + p * 2].value) || 0;
        const minus = parseInt(inputs[rowIdx * 8 + p * 2 + 1].value) || 0;
        otherSum += (plus - minus);
    }
    const dPlus = inputs[rowIdx * 8 + 6];
    const dMinus = inputs[rowIdx * 8 + 7];
    if (otherSum > 0) {
        dPlus.value = 0; dMinus.value = otherSum;
    } else {
        dPlus.value = Math.abs(otherSum); dMinus.value = 0;
    }
    calcTotals();
};

// ==========================================
// 3. メイン処理 (DOMContentLoaded)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const gridBody = document.getElementById('gridBody');
    if (!gridBody) return;

    // --- 【重要】入力行の生成 ---
    function initScoreTable() {
        gridBody.innerHTML = '';
        for (let i = 1; i <= 8; i++) {
            const numCell = document.createElement('div');
            numCell.className = 'cell-num flex flex-col items-center justify-center border-b border-slate-100 bg-slate-50 relative';
            numCell.innerHTML = `
                <span class="text-[10px] font-bold text-slate-800">${i}</span>
                <button onclick="adjustLine(${i-1})" class="mt-1 text-[8px] bg-orange-500 text-white px-1.5 py-0.5 rounded shadow-sm">整</button>
            `;
            gridBody.appendChild(numCell);

            for (let p = 0; p < 4; p++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell border-b border-slate-100';
                cell.innerHTML = `
                    <input type="number" class="w-1/2 text-center text-xs py-2 input-plus rounded-sm" placeholder="+">
                    <input type="number" class="w-1/2 text-center text-xs py-2 input-minus rounded-sm" placeholder="-">
                `;
                gridBody.appendChild(cell);
            }
        }
        calcTotals();
    }

    initScoreTable();
    gridBody.addEventListener('input', calcTotals);

    // --- OCR関連 ---
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    let currentImage = null;
    let rotation = 0;
    let baseGrid = { ox: 0, oy: 0, uw: 0, uh: 0 };
    let gridConfig = { ox: 0, oy: 0, uw: 0, uh: 0 };

    const sliders = {
        x: document.getElementById('adjustX'),
        y: document.getElementById('adjustY'),
        w: document.getElementById('adjustW'),
        h: document.getElementById('adjustH')
    };
    
    function draw() {
        if (!currentImage || !ctx) return;
        canvas.width = (rotation % 180 === 0) ? currentImage.width : currentImage.height;
        canvas.height = (rotation % 180 === 0) ? currentImage.height : currentImage.width;
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rotation * Math.PI / 180);
        ctx.drawImage(currentImage, -currentImage.width / 2, -currentImage.height / 2);
        ctx.restore();
        ctx.strokeStyle = "#f97316"; ctx.lineWidth = 5;
        ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);
    }

    Object.values(sliders).forEach(s => s && s.addEventListener('input', () => {
        if (!currentImage) return;
        gridConfig.ox = baseGrid.ox + parseInt(sliders.x.value);
        gridConfig.oy = baseGrid.oy + parseInt(sliders.y.value);
        gridConfig.uw = baseGrid.uw * parseFloat(sliders.w.value);
        gridConfig.uh = baseGrid.uh * parseFloat(sliders.h.value);
        draw();
    }));

    document.getElementById('imageInput').onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (f) => {
            const img = new Image();
            img.onload = () => {
                currentImage = img;
                baseGrid = { ox: img.width * 0.1, oy: img.height * 0.2, uw: img.width * 0.8, uh: img.height * 0.5 };
                gridConfig = {...baseGrid};
                draw();
            };
            img.src = f.target.result;
        };
        reader.readAsDataURL(e.target.files[0]);
    };

    document.getElementById('analyzeBtn').onclick = async () => {
        const btn = document.getElementById('analyzeBtn');
        btn.disabled = true; btn.innerText = "⏳...";
        const worker = await Tesseract.createWorker();
        await worker.loadLanguage('eng'); await worker.initialize('eng');
        await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
        const inputs = document.querySelectorAll('#gridBody input');
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const crop = document.createElement('canvas'); crop.width = 80; crop.height = 80;
                crop.getContext('2d').drawImage(canvas, gridConfig.ox + (c * (gridConfig.uw/8)), gridConfig.oy + (r * (gridConfig.uh/8)), gridConfig.uw/8, gridConfig.uh/8, 0, 0, 80, 80);
                const { data: { text } } = await worker.recognize(crop);
                inputs[r * 8 + c].value = text.replace(/[^0-9]/g, '');
            }
        }
        await worker.terminate();
        btn.disabled = false; btn.innerText = "🎯 スキャン開始";
        calcTotals();
    };

    // --- データ保存 ---
    document.getElementById('saveData').onclick = () => {
        const area = document.getElementById('playerInputs');
        area.innerHTML = ['A','B','C','D'].map(p => `
            <div class="mb-2"><label class="text-[10px] text-slate-400 font-bold">${p}さんの名前</label>
            <input type="text" class="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white text-sm" list="playerHistory"></div>
        `).join('');
        document.getElementById('cloudModal').style.display = 'flex';
    };

    document.getElementById('dbSubmitBtn').onclick = async () => {
        const names = Array.from(document.querySelectorAll('#playerInputs input')).map(i => i.value || '未設定');
        const rawNumbers = Array.from(document.querySelectorAll('#gridBody input')).map(i => parseInt(i.value) || 0);
        try {
            await supabase.from('players').upsert(names.map(n => ({ name: n })), { onConflict: 'name' });
            const { data: pData } = await supabase.from('players').select('id, name').in('name', names);
            const { data: gData } = await supabase.from('games').insert({ player_names: names, raw_data_full: { grid: rawNumbers } }).select().single();
            
            // --- ここに詳細保存ロジックを追加 ---
            
            alert("クラウド保存に成功しました！");
            document.getElementById('cloudModal').style.display = 'none';
            loadHomeSummary();
        } catch (e) { alert("エラー: " + e.message); }
    };

    loadHomeSummary();
});

// ==========================================
// 4. データ読み込み関数
// ==========================================

async function loadHomeSummary() {
    const container = document.getElementById('homeTop3');
    if (!container) return;
    const { data, error } = await supabase.from('set_summaries').select('player_name, total_score').order('total_score', { ascending: false }).limit(3);
    if (error || !data || data.length === 0) {
        container.innerHTML = '<div class="col-span-3 text-slate-500 text-xs py-4 text-center">No Data</div>';
        return;
    }
    container.innerHTML = data.map((p, i) => `
        <div class="space-y-1">
            <div class="text-[10px] font-bold text-blue-400 uppercase">Rank ${i+1}</div>
            <div class="text-sm font-black italic truncate">${p.player_name}</div>
            <div class="text-[9px] text-slate-400 font-mono">${p.total_score.toLocaleString()} PTS</div>
        </div>
    `).join('');
}

async function loadMlbStats() {
    const container = document.getElementById('mlb-grid-container');
    if (!container) return;
    const { data, error } = await supabase.from('game_results').select('*');
    if (error || !data) return;
    
    const statsMap = data.reduce((acc, cur) => {
        if (!acc[cur.player_name]) acc[cur.player_name] = { name: cur.player_name, g: 0, sumR: 0, pts: 0 };
        acc[cur.player_name].g++; acc[cur.player_name].sumR += cur.rank; acc[cur.player_name].pts += cur.score;
        return acc;
    }, {});
    
    const tableData = Object.values(statsMap).map(p => [p.name, p.g, (p.sumR / p.g).toFixed(2), p.pts]);

    if (statsGrid) statsGrid.destroy();
    statsGrid = new gridjs.Grid({
        columns: ["PLAYER", "G", "AVG", "PTS"],
        data: tableData, sort: true,
        style: { table: { 'font-size': '12px' }, th: { 'background-color': '#041e42', 'color': '#fff' } }
    }).render(container);
}
