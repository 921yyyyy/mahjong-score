// ==========================================
// 1. 基本設定とSupabase初期化
// ==========================================
const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// グローバル変数
let statsGrid = null;
let currentImage = null;
let rotation = 0;
let baseGrid = { ox: 0, oy: 0, uw: 0, uh: 0 }; 
let gridConfig = { ox: 0, oy: 0, uw: 0, uh: 0 };

// ==========================================
// 2. ページ遷移 (最優先：ここが動かないと何も見えない)
// ==========================================
window.showPage = function(pageId) {
    console.log("Showing page:", pageId);
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

    // ページごとの読み込み
    if (pageId === 'page-home') loadHomeSummary();
    if (pageId === 'page-stats') loadMlbStats();
    if (pageId === 'page-scanner') {
        // スキャナーを開いた時にスコアボードがなければ作る
        const gridBody = document.getElementById('gridBody');
        if (gridBody && gridBody.children.length === 0) {
            initScoreTable();
        }
    }
    
    if (window.lucide) lucide.createIcons();
};

// ==========================================
// 3. リアル仕様スコアボードの復元
// ==========================================
function initScoreTable() {
    const gridBody = document.getElementById('gridBody');
    if (!gridBody) return;
    
    gridBody.innerHTML = '';
    // 写真にあった通りの8行構成
    for (let i = 1; i <= 8; i++) {
        // 行番号と「整」ボタン
        const numCell = document.createElement('div');
        numCell.className = 'cell-num flex flex-col items-center justify-center border-b border-slate-100 bg-slate-50 py-2';
        numCell.innerHTML = `
            <span class="text-[10px] font-bold">${i}</span>
            <button onclick="adjustLine(${i-1})" class="mt-1 text-[8px] bg-orange-500 text-white px-1.5 py-0.5 rounded shadow-sm">整</button>
        `;
        gridBody.appendChild(numCell);

        // A, B, C, Dさんの入力欄
        for (let p = 0; p < 4; p++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell border-b border-slate-100 flex';
            cell.innerHTML = `
                <input type="number" class="w-1/2 text-center text-xs py-2 input-plus" placeholder="+">
                <input type="number" class="w-1/2 text-center text-xs py-2 input-minus" placeholder="-">
            `;
            gridBody.appendChild(cell);
        }
    }
    gridBody.addEventListener('input', calcTotals);
    calcTotals();
}

// 4名の合計計算（合計が0でない行を赤くする機能含む）
function calcTotals() {
    const inputs = document.querySelectorAll('#gridBody input');
    if (inputs.length === 0) return;
    
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
        
        // 横の合計チェック（赤背景）
        const rowLabelCell = document.getElementById('gridBody').children[r * 5];
        if (rowLabelCell) {
            if (lineSum !== 0) {
                rowLabelCell.style.backgroundColor = '#fee2e2';
                invalidLines.push(r + 1);
            } else {
                rowLabelCell.style.backgroundColor = '';
            }
        }
    }

    // 保存ボタンの状態更新
    const saveBtn = document.getElementById('saveData');
    if (saveBtn) {
        if (invalidLines.length === 0) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `💾 結果を保存 (全行OK ✅)`;
            saveBtn.className = "w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl";
        } else {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `⚠️ 合計を0に (行: ${invalidLines.join(',')})`;
            saveBtn.className = "w-full py-5 bg-slate-600 text-slate-400 font-black rounded-2xl shadow-xl";
        }
    }

    // 下部合計表示
    ['A','B','C','D'].forEach((id, i) => {
        const el = document.getElementById(`total${id}`);
        if (el) {
            el.innerText = (totals[i] >= 0 ? '+' : '') + totals[i];
            el.style.color = totals[i] >= 0 ? '#4f46e5' : '#e11d48';
        }
    });
}

// Dさんのスコアを自動調整する「整」ボタン
window.adjustLine = function(rowIdx) {
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
// 4. データ読み込み (HUB & STATS)
// ==========================================
async function loadHomeSummary() {
    const container = document.getElementById('homeTop3');
    if (!container) return;
    const { data } = await supabase.from('set_summaries').select('player_name, total_score').order('total_score', { ascending: false }).limit(3);
    
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="col-span-3 text-center py-4 text-slate-500 text-xs">NO DATA</div>';
        return;
    }
    container.innerHTML = data.map((p, i) => `
        <div class="space-y-1">
            <div class="text-[9px] font-bold text-blue-300">RANK ${i+1}</div>
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
        columns: ["PLAYER", "G", "AVG", "PTS"],
        data: tableData,
        sort: true,
        style: { table: { 'font-size': '11px' }, th: { 'background-color': '#041e42', 'color': '#fff' } }
    }).render(container);
}

// ==========================================
// 5. 初期化実行 (すべてが読み込まれたら)
// ==========================================
window.addEventListener('load', () => {
    // 最初の表示をセット
    showPage('page-home');
    
    // スキャナー用画像入力の監視
    const imgIn = document.getElementById('imageInput');
    if (imgIn) {
        imgIn.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (f) => {
                const img = new Image();
                img.onload = () => {
                    currentImage = img;
                    // キャンバス描画などのOCR系処理（必要ならここに復活）
                };
                img.src = f.target.result;
            };
            reader.readAsDataURL(file);
        };
    }
});
