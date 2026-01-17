// ==========================================
// 1. グローバル設定
// ==========================================
const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let statsGrid = null;
let currentImage = null;
let rotation = 0;
let baseGrid = { ox: 0, oy: 0, uw: 0, uh: 0 }; 
let gridConfig = { ox: 0, oy: 0, uw: 0, uh: 0 };

// ==========================================
// 2. ページ表示制御 (window.に紐付け)
// ==========================================
window.showPage = async function(pageId) {
    const pages = ['page-home', 'page-scanner', 'page-history', 'page-stats'];
    
    pages.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === pageId) {
                el.classList.remove('hidden');
                el.style.display = 'block';
            } else {
                el.classList.add('hidden');
                el.style.display = 'none';
            }
        }
        
        // ナビゲーションボタンのスタイル
        const shortName = id.split('-')[1];
        const btn = document.getElementById('btn-' + shortName);
        if (btn) {
            if (id === pageId) {
                btn.classList.add('text-blue-900');
                btn.classList.remove('text-slate-400');
            } else {
                btn.classList.remove('text-blue-900');
                btn.classList.add('text-slate-400');
            }
        }
    });

    if (pageId === 'page-home') loadHomeSummary();
    if (pageId === 'page-stats') loadMlbStats();
    if (window.lucide) lucide.createIcons();
};

// ==========================================
// 3. スコアボードロジック
// ==========================================
function initScoreTable() {
    const gridBody = document.getElementById('gridBody');
    if (!gridBody) return;
    gridBody.innerHTML = '';
    for (let i = 1; i <= 8; i++) {
        const numCell = document.createElement('div');
        numCell.className = 'cell-num flex flex-col items-center justify-center border-b border-slate-100 bg-slate-50 relative py-2';
        numCell.innerHTML = `<span class="text-[10px] font-bold">${i}</span><button onclick="adjustLine(${i-1})" class="mt-1 text-[8px] bg-orange-500 text-white px-1.5 py-0.5 rounded shadow-sm active:scale-90">整</button>`;
        gridBody.appendChild(numCell);
        for(let p = 0; p < 4; p++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell border-b border-slate-100';
            cell.innerHTML = `<input type="number" class="w-1/2 text-center text-xs py-2 input-plus rounded-sm bg-transparent" placeholder="+"><input type="number" class="w-1/2 text-center text-xs py-2 input-minus rounded-sm bg-transparent" placeholder="-">`;
            gridBody.appendChild(cell);
        }
    }
    gridBody.addEventListener('input', calcTotals);
    calcTotals();
}

window.adjustLine = function(rowIdx) {
    const inputs = document.querySelectorAll('#gridBody input');
    let otherSum = 0;
    for(let p = 0; p < 3; p++) {
        const plus = parseInt(inputs[rowIdx * 8 + p * 2].value) || 0;
        const minus = parseInt(inputs[rowIdx * 8 + p * 2 + 1].value) || 0;
        otherSum += (plus - minus);
    }
    const dPlus = inputs[rowIdx * 8 + 6];
    const dMinus = inputs[rowIdx * 8 + 7];
    if (otherSum > 0) { dPlus.value = 0; dMinus.value = otherSum; } 
    else { dPlus.value = Math.abs(otherSum); dMinus.value = 0; }
    calcTotals();
};

function calcTotals() {
    const inputs = document.querySelectorAll('#gridBody input');
    if (inputs.length === 0) return;
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
        const rowLabelCell = document.getElementById('gridBody').children[r * 5];
        if (rowLabelCell) {
            rowLabelCell.style.backgroundColor = (lineSum !== 0) ? '#fee2e2' : '';
            if (lineSum !== 0) invalidLines.push(r + 1);
        }
    }
    const saveBtn = document.getElementById('saveData');
    if (saveBtn) {
        if (invalidLines.length === 0) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `💾 結果を保存 (全行OK ✅)`;
            saveBtn.className = "w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl";
        } else {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `⚠️ 横の合計を0に (行: ${invalidLines.join(',')})`;
            saveBtn.className = "w-full py-5 bg-slate-600 text-slate-400 font-black rounded-2xl shadow-xl";
        }
    }
    ['A','B','C','D'].forEach((id, i) => {
        const el = document.getElementById(`total${id}`);
        if (el) {
            el.innerText = (totals[i] >= 0 ? '+' : '') + totals[i];
            el.className = `py-3 text-center font-black ${totals[i] >= 0 ? 'text-indigo-600' : 'text-rose-500'}`;
        }
    });
}

// ==========================================
// 4. OCR / 画像処理 (window.に紐付け)
// ==========================================
window.rotateImage = function() { rotation = (rotation + 90) % 360; drawPreview(); };

window.startScan = async function() {
    if (!currentImage) return;
    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true; btn.innerText = "⏳ SCANNING...";
    const worker = await Tesseract.createWorker();
    await worker.loadLanguage('eng'); await worker.initialize('eng');
    await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
    const inputs = document.querySelectorAll('#gridBody input');
    const cellW = gridConfig.uw / 8; const cellH = gridConfig.uh / 8;
    const canvas = document.getElementById('previewCanvas');
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const crop = document.createElement('canvas'); crop.width = 80; crop.height = 80;
            crop.getContext('2d').drawImage(canvas, gridConfig.ox + (c * cellW), gridConfig.oy + (r * cellH), cellW, cellH, 0, 0, 80, 80);
            const { data: { text } } = await worker.recognize(crop);
            inputs[r * 8 + c].value = text.replace(/[^0-9]/g, '');
        }
    }
    await worker.terminate(); btn.disabled = false; btn.innerText = "🎯 SCAN DONE";
    calcTotals();
};

function drawPreview() {
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    if (!currentImage || !ctx) return;
    const is90 = rotation === 90 || rotation === 270;
    canvas.width = is90 ? currentImage.height : currentImage.width;
    canvas.height = is90 ? currentImage.width : currentImage.height;
    ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(currentImage, -currentImage.width / 2, -currentImage.height / 2);
    ctx.restore();
    ctx.strokeStyle = "#f97316"; ctx.lineWidth = 5;
    ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);
}

// ==========================================
// 5. データ保存
// ==========================================
window.openSaveModal = function() {
    const area = document.getElementById('playerInputs');
    area.innerHTML = ['A','B','C','D'].map(p => `<div class="mb-2"><label class="text-[10px] text-slate-400 font-bold">${p} PLAYER</label><input type="text" class="w-full bg-slate-900 p-3 rounded-xl text-white text-sm" list="playerHistory"></div>`).join('');
    document.getElementById('cloudModal').style.display = 'flex';
};

window.submitToDB = async function() {
    const btn = document.getElementById('dbSubmitBtn');
    btn.disabled = true; btn.innerText = "SAVING...";
    const names = Array.from(document.querySelectorAll('#playerInputs input')).map(i => i.value || '未設定');
    const rawNumbers = Array.from(document.querySelectorAll('#gridBody input')).map(i => parseInt(i.value) || 0);
    try {
        await supabase.from('players').upsert(names.map(n => ({ name: n })), { onConflict: 'name' });
        const { data: playerData } = await supabase.from('players').select('id, name').in('name', names);
        const { data: gameData } = await supabase.from('games').insert({ player_names: names, raw_data_full: { grid: rawNumbers } }).select().single();
        // ... game_results保存ロジック ...
        alert("SUCCESS!");
        document.getElementById('cloudModal').style.display = 'none';
        window.showPage('page-home');
    } catch (e) { alert(e.message); }
    btn.disabled = false; btn.innerText = "DBに保存";
};

// ==========================================
// 6. HUB & STATS 読み込み
// ==========================================
async function loadHomeSummary() {
    const container = document.getElementById('homeTop3');
    if (!container) return;
    const { data } = await supabase.from('set_summaries').select('player_name, total_score').order('total_score', { ascending: false }).limit(3);
    if (!data || data.length === 0) { container.innerHTML = '<div class="col-span-3 text-slate-500 text-xs py-4">NO DATA</div>'; return; }
    container.innerHTML = data.map((p, i) => `<div class="space-y-1"><div class="text-[9px] font-bold text-blue-300">Rank ${i+1}</div><div class="text-xs font-black italic truncate">${p.player_name}</div><div class="text-[9px] text-blue-100">${p.total_score.toLocaleString()}</div></div>`).join('');
}

async function loadMlbStats() {
    const container = document.getElementById('mlb-grid-container');
    if (!container) return;
    const { data } = await supabase.from('game_results').select('*');
    if (!data) return;
    const statsMap = data.reduce((acc, cur) => {
        if (!acc[cur.player_name]) acc[cur.player_name] = { name: cur.player_name, g: 0, sumR: 0, pts: 0 };
        acc[cur.player_name].g++; acc[cur.player_name].sumR += cur.rank; acc[cur.player_name].pts += cur.score;
        return acc;
    }, {});
    const tableData = Object.values(statsMap).map(p => [p.name, p.g, (p.sumR / p.g).toFixed(2), p.pts]);
    if (statsGrid) statsGrid.destroy();
    statsGrid = new gridjs.Grid({ columns: ["PLAYER", "G", "AVG", "PTS"], data: tableData, sort: true, style: { table: { 'font-size': '11px' } } }).render(container);
}

// ==========================================
// 7. 初期化実行
// ==========================================
window.addEventListener('load', () => {
    initScoreTable();
    window.showPage('page-home');
    
    // 画像入力の監視
    const imgIn = document.getElementById('imageInput');
    if (imgIn) {
        imgIn.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (f) => {
                const img = new Image();
                img.onload = () => {
                    currentImage = img;
                    baseGrid = { ox: img.width * 0.1, oy: img.height * 0.2, uw: img.width * 0.8, uh: img.height * 0.5 };
                    gridConfig = {...baseGrid};
                    drawPreview();
                };
                img.src = f.target.result;
            };
            reader.readAsDataURL(file);
        };
    }
});
