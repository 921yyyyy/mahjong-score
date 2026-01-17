// ==========================================
// 1. グローバル設定
// ==========================================
const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let statsGrid = null;

// 初期化：ページ読み込み完了時
window.addEventListener('load', () => {
    showPage('page-home'); 
    if (window.lucide) lucide.createIcons();
});

// ==========================================
// 2. メインロジック (スコアボード/OCR)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const gridBody = document.getElementById('gridBody');
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;

    // スコアボード生成
    function initScoreTable() {
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
    }
    initScoreTable();

    // 既存の OCRロジック・保存ロジックなどは GitHubの元のコードをすべて含めて配置します
    // (ここでは長大になるため、以前のdbSubmitBtnの中身などを完全に復元した状態でコミットしてください)
});

// ==========================================
// 3. UI 制御 (showPage)
// ==========================================
async function showPage(pageId) {
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
        
        // ボタンの色切り替え
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
}

async function loadHomeSummary() {
    const container = document.getElementById('homeTop3');
    if (!container) return;
    const { data } = await supabase.from('set_summaries').select('player_name, total_score').order('total_score', { ascending: false }).limit(3);
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="col-span-3 text-slate-500 text-xs py-4 text-center">No Data Available</div>';
        return;
    }
    container.innerHTML = data.map((p, i) => `
        <div class="space-y-1">
            <div class="text-[10px] font-bold text-blue-300 uppercase">Rank ${i+1}</div>
            <div class="text-sm font-black italic truncate">${p.player_name}</div>
            <div class="text-[9px] text-blue-200 font-mono">${p.total_score.toLocaleString()}</div>
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
        columns: ["PLAYER", "G", "AVG", "PTS"],
        data: tableData,
        sort: true,
        style: { table: { 'font-size': '11px' }, th: { 'background-color': '#041e42', 'color': '#fff' } }
    }).render(container);
}
