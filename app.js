// ==========================================
// 1. 基本設定
// ==========================================
const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let statsGrid = null;

// ==========================================
// 2. 画面遷移 (グローバル公開)
// ==========================================
window.showPage = function(pageId) {
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
    });
    if (pageId === 'page-home') loadHomeSummary();
    if (pageId === 'page-stats') loadMlbStats();
    if (window.lucide) lucide.createIcons();
};

// ==========================================
// 3. スコアボード復元 (整ボタン・合計チェック付)
// ==========================================
function initScoreTable() {
    const gridBody = document.getElementById('gridBody');
    if (!gridBody) return;
    gridBody.innerHTML = '';
    for (let i = 1; i <= 8; i++) {
        const numCell = document.createElement('div');
        numCell.className = 'cell-num flex flex-col items-center justify-center border-b border-slate-100 bg-slate-50 py-2';
        numCell.innerHTML = `
            <span class="text-[10px] font-bold">${i}</span>
            <button onclick="window.adjustLine(${i-1})" class="mt-1 text-[8px] bg-orange-500 text-white px-1.5 py-0.5 rounded shadow-sm">整</button>
        `;
        gridBody.appendChild(numCell);
        for (let p = 0; p < 4; p++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell border-b border-slate-100';
            cell.innerHTML = `<div class="flex h-full"><input type="number" class="w-1/2 text-center text-xs py-2 input-plus" placeholder="+"><input type="number" class="w-1/2 text-center text-xs py-2 input-minus" placeholder="-"></div>`;
            gridBody.appendChild(cell);
        }
    }
    gridBody.addEventListener('input', calcTotals);
    calcTotals();
}

window.adjustLine = function(rowIdx) {
    const inputs = document.querySelectorAll('#gridBody input');
    let otherSum = 0;
    for (let p = 0; p < 3; p++) {
        const plus = parseInt(inputs[rowIdx * 8 + p * 2].value) || 0;
        const minus = parseInt(inputs[rowIdx * 8 + p * 2 + 1].value) || 0;
        otherSum += (plus - minus);
    }
    const dPlus = inputs[rowIdx * 8 + 6]; const dMinus = inputs[rowIdx * 8 + 7];
    if (otherSum > 0) { dPlus.value = 0; dMinus.value = otherSum; } 
    else { dPlus.value = Math.abs(otherSum); dMinus.value = 0; }
    calcTotals();
};

function calcTotals() {
    const inputs = document.querySelectorAll('#gridBody input');
    const totals = [0, 0, 0, 0];
    let invalidLines = [];
    for (let r = 0; r < 8; r++) {
        let lineSum = 0;
        for (let p = 0; p < 4; p++) {
            const plus = parseInt(inputs[(r * 8) + (p * 2)].value) || 0;
            const minus = parseInt(inputs[(r * 8) + (p * 2) + 1].value) || 0;
            const score = plus - minus; totals[p] += score; lineSum += score;
        }
        const rowLabel = document.getElementById('gridBody').children[r * 5];
        if (rowLabel) {
            rowLabel.style.backgroundColor = (lineSum !== 0) ? '#fee2e2' : '';
            if (lineSum !== 0) invalidLines.push(r + 1);
        }
    }
    const saveBtn = document.getElementById('saveData');
    if (saveBtn) {
        saveBtn.disabled = invalidLines.length > 0;
        saveBtn.innerHTML = invalidLines.length === 0 ? `💾 結果を保存 (全行OK ✅)` : `⚠️ 合計0に (行: ${invalidLines.join(',')})`;
        saveBtn.className = `w-full py-5 font-black rounded-2xl shadow-xl ${invalidLines.length === 0 ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-slate-400 cursor-not-allowed'}`;
    }
    ['A','B','C','D'].forEach((id, i) => {
        const el = document.getElementById(`total${id}`);
        if (el) {
            el.innerText = (totals[i] >= 0 ? '+' : '') + totals[i];
            el.style.color = totals[i] >= 0 ? '#4f46e5' : '#e11d48';
        }
    });
}

// ==========================================
// 4. データロード
// ==========================================
async function loadHomeSummary() {
    const container = document.getElementById('homeTop3');
    if (!container) return;
    const { data } = await supabase.from('set_summaries').select('player_name, total_score').order('total_score', { ascending: false }).limit(3);
    if (!data || data.length === 0) { container.innerHTML = '<div class="col-span-3 text-center py-4 text-slate-400 text-[10px]">NO DATA</div>'; return; }
    container.innerHTML = data.map((p, i) => `<div class="space-y-1"><div class="text-[9px] font-black text-blue-300">RANK ${i+1}</div><div class="text-xs font-black italic truncate">${p.player_name}</div><div class="text-[9px] text-blue-100 font-mono">${p.total_score.toLocaleString()}</div></div>`).join('');
}

async function loadMlbStats() {
    const container = document.getElementById('mlb-grid-container');
    if (!container) return;
    const { data } = await supabase.from('game_results').select('*');
    if (!data) return;
    const statsMap = data.reduce((acc, cur) => {
        if (!acc[cur.player_name]) acc[cur.player_name] = { name: cur.player_name, g: 0, avgR: 0, pts: 0 };
        acc[cur.player_name].g++; acc[cur.player_name].avgR += cur.rank; acc[cur.player_name].pts += cur.score;
        return acc;
    }, {});
    const tableData = Object.values(statsMap).map(p => [p.name, p.g, (p.avgR / p.g).toFixed(2), p.pts]);
    if (statsGrid) statsGrid.destroy();
    statsGrid = new gridjs.Grid({ columns: ["PLAYER", "G", "AVG", "PTS"], data: tableData, sort: true, style: { table: { 'font-size': '11px' } } }).render(container);
}

// ==========================================
// 5. 初期化
// ==========================================
window.addEventListener('load', () => {
    initScoreTable();
    window.showPage('page-home');
});
