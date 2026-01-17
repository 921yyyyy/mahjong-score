// ==========================================
// 1. グローバル設定 & Supabase初期化
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
// 2. ページ初期化
// ==========================================
window.addEventListener('load', () => {
    initScoreTable(); // スコアボード生成
    showPage('page-home'); // 初期表示はHUB
    updatePlayerSuggestions(); // プレイヤー名候補取得
    if (window.lucide) lucide.createIcons();
});

// ==========================================
// 3. 画面制御ロジック (デグレード防止の要)
// ==========================================

// スコアボード生成
function initScoreTable() {
    const gridBody = document.getElementById('gridBody');
    if (!gridBody) return;
    gridBody.innerHTML = '';
    for (let i = 1; i <= 8; i++) {
        const numCell = document.createElement('div');
        numCell.className = 'cell-num flex flex-col items-center justify-center border-b border-slate-100 bg-slate-50 relative';
        numCell.innerHTML = `<span class="text-[10px] font-bold">${i}</span><button onclick="adjustLine(${i-1})" class="mt-1 text-[8px] bg-orange-500 text-white px-1.5 py-0.5 rounded shadow-sm active:scale-90 transition-transform">整</button>`;
        gridBody.appendChild(numCell);
        for(let p = 0; p < 4; p++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell border-b border-slate-100';
            cell.innerHTML = `<input type="number" class="w-1/2 text-center text-xs py-2 input-plus rounded-sm" placeholder="+"><input type="number" class="w-1/2 text-center text-xs py-2 input-minus rounded-sm" placeholder="-">`;
            gridBody.appendChild(cell);
        }
    }
    // 入力イベント設定
    gridBody.addEventListener('input', calcTotals);
    calcTotals();
}

// 行調整（Dさんを自動入力）
window.adjustLine = (rowIdx) => {
    const inputs = document.querySelectorAll('#gridBody input');
    let otherPlayersSum = 0;
    for(let p = 0; p < 3; p++) {
        const plus = parseInt(inputs[rowIdx * 8 + p * 2].value) || 0;
        const minus = parseInt(inputs[rowIdx * 8 + p * 2 + 1].value) || 0;
        otherPlayersSum += (plus - minus);
    }
    const dPlusInput = inputs[rowIdx * 8 + 6];
    const dMinusInput = inputs[rowIdx * 8 + 7];
    if (otherPlayersSum > 0) { dPlusInput.value = 0; dMinusInput.value = otherPlayersSum; } 
    else { dPlusInput.value = Math.abs(otherPlayersSum); dMinusInput.value = 0; }
    calcTotals();
};

// 合計計算
function calcTotals() {
    const gridBody = document.getElementById('gridBody');
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
        const rowLabelCell = gridBody.children[r * 5];
        if (rowLabelCell) {
            if (lineSum !== 0) { rowLabelCell.style.backgroundColor = '#fee2e2'; invalidLines.push(r + 1); } 
            else { rowLabelCell.style.backgroundColor = ''; }
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
            saveBtn.innerHTML = `⚠️ 横の合計を0に (行: ${invalidLines.join(',')})`;
            saveBtn.className = "w-full py-5 bg-slate-600 text-slate-400 font-black rounded-2xl shadow-xl cursor-not-allowed";
        }
    }
    ['A','B','C','D'].forEach((id, i) => {
        const el = document.getElementById(`total${id}`);
        if (el) {
            el.innerText = (totals[i] >= 0 ? '+' : '') + totals[i];
            el.className = `py-3 text-center font-black ${totals[i] >= 0 ? 'text-indigo-400' : 'text-rose-400'}`;
        }
    });
}

// ==========================================
// 4. 画像処理 & OCR
// ==========================================

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
    ctx.strokeStyle = "#f97316"; ctx.lineWidth = Math.max(5, canvas.width / 120);
    ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);
}

// イベント設定（ファイル選択）
document.addEventListener('change', (e) => {
    if (e.target.id === 'imageInput') {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (f) => {
            const img = new Image();
            img.onload = () => {
                currentImage = img; rotation = 0;
                baseGrid = { ox: img.width * 0.1, oy: img.height * 0.2, uw: img.width * 0.8, uh: img.height * 0.5 };
                updateAdjustment();
            };
            img.src = f.target.result;
        };
        reader.readAsDataURL(file);
    }
    // スライダー連動
    if (['adjustX','adjustY','adjustW','adjustH'].includes(e.target.id)) updateAdjustment();
});

function updateAdjustment() {
    const sliders = {
        x: document.getElementById('adjustX'), y: document.getElementById('adjustY'),
        w: document.getElementById('adjustW'), h: document.getElementById('adjustH')
    };
    if (!currentImage || !sliders.x) return;
    gridConfig.ox = baseGrid.ox + parseInt(sliders.x.value);
    gridConfig.oy = baseGrid.oy + parseInt(sliders.y.value);
    gridConfig.uw = baseGrid.uw * parseFloat(sliders.w.value);
    gridConfig.uh = baseGrid.uh * parseFloat(sliders.h.value);
    drawPreview();
}

// 回転
window.rotateImage = () => { rotation = (rotation + 90) % 360; drawPreview(); };

// OCRスキャン実行
window.startScan = async () => {
    if (!currentImage) return;
    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true; btn.innerText = "⏳ スキャン中...";
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
    await worker.terminate(); btn.disabled = false; btn.innerText = "🎯 スキャン完了";
    calcTotals();
};

// ==========================================
// 5. データ保存 & 読み込み
// ==========================================

window.openSaveModal = () => {
    const area = document.getElementById('playerInputs');
    area.innerHTML = ['A','B','C','D'].map(p => `<div class="mb-2"><label class="text-[10px] text-slate-400 font-bold">${p}さんの名前</label><input type="text" class="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white text-sm" list="playerHistory"></div>`).join('');
    document.getElementById('cloudModal').style.display = 'flex';
};

window.submitToDB = async () => {
    const btn = document.getElementById('dbSubmitBtn');
    btn.disabled = true; btn.innerText = "保存中...";
    const names = Array.from(document.querySelectorAll('#playerInputs input')).map(i => i.value || '未設定');
    const rawNumbers = Array.from(document.querySelectorAll('#gridBody input')).map(i => parseInt(i.value) || 0);

    try {
        await supabase.from('players').upsert(names.map(n => ({ name: n })), { onConflict: 'name' });
        const { data: playerData } = await supabase.from('players').select('id, name').in('name', names);
        const { data: gameData } = await supabase.from('games').insert({ player_names: names, raw_data_full: { grid: rawNumbers } }).select().single();

        const allResults = [];
        for (let r = 0; r < 8; r++) {
            const lineScores = [0,1,2,3].map(p => (rawNumbers[r*8+p*2]||0)-(rawNumbers[r*8+p*2+1]||0));
            if (lineScores.every(s => s === 0)) continue;
            const sorted = [...lineScores].map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
            const ranks = new Array(4); sorted.forEach((it, i) => ranks[it.i] = i + 1);
            names.forEach((name, i) => {
                const pObj = playerData.find(pd => pd.name === name);
                allResults.push({ game_id: gameData.id, player_id: pObj?pObj.id:null, player_name: name, score: lineScores[i], rank: ranks[i] });
            });
        }
        if (allResults.length > 0) await supabase.from('game_results').insert(allResults);
        alert("クラウド保存完了！");
        document.getElementById('cloudModal').style.display = 'none';
        loadHomeSummary();
    } catch (e) { alert("エラー: " + e.message); }
    btn.disabled = false; btn.innerText = "DBに保存";
};

async function updatePlayerSuggestions() {
    const { data } = await supabase.from('players').select('name');
    if (data) {
        const list = document.getElementById('playerHistory');
        if (list) list.innerHTML = [...new Set(data.map(p => p.name))].map(n => `<option value="${n}">`).join('');
    }
}

// ==========================================
// 6. ページ表示制御
// ==========================================

async function showPage(pageId) {
    const pages = ['page-home', 'page-scanner', 'page-history', 'page-stats'];
    pages.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === pageId) ? 'block' : 'none';
        
        const btnId = 'btn-' + id.split('-')[1];
        const btn = document.getElementById(btnId);
        if (btn) {
            if (id === pageId) {
                btn.classList.add('text-blue-900'); btn.classList.remove('text-slate-400');
            } else {
                btn.classList.remove('text-blue-900'); btn.classList.add('text-slate-400');
            }
        }
    });

    if (pageId === 'page-home') loadHomeSummary();
    if (pageId === 'page-stats') loadMlbStats();
    if (window.lucide) lucide.createIcons();
}

async function loadHomeSummary() {
    const container = document.getElementById('homeTop3');
    if (!container) return;
    const { data } = await supabase.from('set_summaries').select('player_name, total_score').order('total_score', { ascending: false }).limit(3);
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="col-span-3 text-slate-500 text-[10px] py-4 text-center">NO DATA</div>';
        return;
    }
    container.innerHTML = data.map((p, i) => `
        <div class="space-y-1">
            <div class="text-[9px] font-bold text-blue-300 uppercase">Rank ${i+1}</div>
            <div class="text-xs font-black italic truncate">${p.player_name}</div>
            <div class="text-[9px] text-blue-100 font-mono">${p.total_score.toLocaleString()}</div>
        </div>
    `).join('');
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
    statsGrid = new gridjs.Grid({
        columns: ["PLAYER", "G", "AVG", "PTS"], data: tableData, sort: true,
        style: { table: { 'font-size': '11px' }, th: { 'background-color': '#041e42', 'color': '#fff' } }
    }).render(container);
}
