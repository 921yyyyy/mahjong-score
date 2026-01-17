// ==========================================
// 1. グローバル設定（DB接続・共通変数）
// ==========================================
const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let statsGrid = null; // Grid.jsのインスタンス保持用

// ==========================================
// 2. メインロジック（DOM読み込み後）
// ==========================================
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

    // --- スコアテーブル初期化 ---
    function initScoreTable() {
        gridBody.innerHTML = '';
        for (let i = 1; i <= 8; i++) {
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

    // 行ごとの自動調整
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
        if (otherPlayersSum > 0) {
            dPlusInput.value = 0; dMinusInput.value = otherPlayersSum;
        } else {
            dPlusInput.value = Math.abs(otherPlayersSum); dMinusInput.value = 0;
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
        ctx.strokeStyle = "#f97316"; ctx.lineWidth = Math.max(5, canvas.width / 120);
        ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);
    }

    document.getElementById('rotateBtn').onclick = () => { rotation = (rotation + 90) % 360; drawPreview(); };

    document.getElementById('analyzeBtn').onclick = async () => {
        if (!currentImage) return;
        const btn = document.getElementById('analyzeBtn');
        btn.disabled = true; btn.innerText = "⏳ 読込中...";
        log("スキャン開始...");
        const worker = await Tesseract.createWorker();
        await worker.loadLanguage('eng'); await worker.initialize('eng');
        await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
        const inputs = document.querySelectorAll('#gridBody input');
        const cellW = gridConfig.uw / 8; const cellH = gridConfig.uh / 8;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const crop = document.createElement('canvas'); crop.width = 80; crop.height = 80;
                const cctx = crop.getContext('2d');
                cctx.drawImage(canvas, gridConfig.ox + (c * cellW), gridConfig.oy + (r * cellH), cellW, cellH, 0, 0, 80, 80);
                const { data: { text } } = await worker.recognize(crop);
                inputs[r * 8 + c].value = text.replace(/[^0-9]/g, '');
            }
        }
        await worker.terminate();
        btn.disabled = false; btn.innerText = "🎯 スキャン開始";
        log("✅ 解析完了");
        calcTotals();
    };

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
                totals[p] += score; lineSum += score;
            }
            const rowLabelCell = gridBody.children[r * 5];
            rowLabelCell.style.backgroundColor = (lineSum !== 0) ? '#fee2e2' : '';
            if (lineSum !== 0) invalidLines.push(r + 1);
        }
        const saveBtn = document.getElementById('saveData');
        if (invalidLines.length === 0) {
            saveBtn.disabled = false; saveBtn.innerHTML = `💾 結果を保存 (全行OK ✅)`;
            saveBtn.className = "w-full py-5 bg-emerald-600 text-white font-black rounded-2xl";
        } else {
            saveBtn.disabled = true; saveBtn.innerHTML = `⚠️ 合計を0に (行: ${invalidLines.join(',')})`;
            saveBtn.className = "w-full py-5 bg-slate-600 text-slate-400 font-black rounded-2xl";
        }
        ['A','B','C','D'].forEach((id, i) => {
            const el = document.getElementById(`total${id}`);
            el.innerText = (totals[i] >= 0 ? '+' : '') + totals[i];
            el.style.color = totals[i] >= 0 ? '#1d4ed8' : '#be123c';
        });
    }
    gridBody.addEventListener('input', calcTotals);

    // --- 保存処理 ---
    const saveBtn = document.getElementById('saveData');
    const modal = document.getElementById('cloudModal');
    const playerInputsArea = document.getElementById('playerInputs');
    const submitBtn = document.getElementById('dbSubmitBtn');

    saveBtn.onclick = () => {
        playerInputsArea.innerHTML = ['A', 'B', 'C', 'D'].map(p => `
            <div class="space-y-1">
                <label class="text-[10px] text-slate-400 font-bold">${p}さんの名前</label>
                <input type="text" class="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white text-sm" list="playerHistory">
            </div>`).join('');
        modal.style.display = 'flex';
    };

    submitBtn.onclick = async () => {
        submitBtn.disabled = true; submitBtn.innerText = "保存中...";
        const names = Array.from(playerInputsArea.querySelectorAll('input')).map(i => i.value || '未設定');
        const scoreInputs = document.querySelectorAll('#gridBody input');
        const rawNumbers = Array.from(scoreInputs).map(i => parseInt(i.value) || 0);

        const getRanks = (scores, useTiedRank = false) => {
            const sorted = scores.map((s, i) => ({ s, i })).sort((a, b) => b.s !== a.s ? b.s - a.s : a.i - b.i);
            const ranks = new Array(4);
            sorted.forEach((item, i) => {
                if (useTiedRank && i > 0 && item.s === sorted[i - 1].s) ranks[item.i] = ranks[sorted[i - 1].i];
                else ranks[item.i] = i + 1;
            });
            return ranks;
        };

        try {
            await supabase.from('players').upsert(names.filter(n => n !== '未設定').map(n => ({ name: n })), { onConflict: 'name' });
            const { data: playerData } = await supabase.from('players').select('id, name').in('name', names);
            const { data: gameData, error: gameError } = await supabase.from('games').insert({ player_names: names, raw_data_full: { grid: rawNumbers } }).select().single();
            if (gameError) throw gameError;

            const allGameResults = [];
            for (let r = 0; r < 8; r++) {
                const lineScores = [0, 1, 2, 3].map(p => (rawNumbers[r * 8 + p * 2] || 0) - (rawNumbers[r * 8 + p * 2 + 1] || 0));
                if (lineScores.every(s => s === 0)) continue;
                const lineRanks = getRanks(lineScores, false);
                names.forEach((name, i) => {
                    const pObj = playerData.find(pd => pd.name === name);
                    allGameResults.push({ game_id: gameData.id, player_id: pObj?.id, player_name: name, score: lineScores[i], rank: lineRanks[i] });
                });
            }
            await supabase.from('game_results').insert(allGameResults);

            const finalScores = [0,1,2,3].map(p => {
                let s = 0; for(let r=0; r<8; r++) s += (rawNumbers[r*8+p*2]||0)-(rawNumbers[r*8+p*2+1]||0); return s;
            });
            const finalRanks = getRanks(finalScores, true);
            const finalSummaries = names.map((name, i) => ({
                game_id: gameData.id, player_id: playerData.find(pd => pd.name === name)?.id, player_name: name, total_score: finalScores[i], final_rank: finalRanks[i]
            }));
            await supabase.from('set_summaries').insert(finalSummaries);

            alert("保存完了！"); modal.style.display = 'none';
            updatePlayerSuggestions();
            loadHomeSummary(); // 保存後にホーム画面を更新
        } catch (err) { alert("エラー: " + err.message); }
        finally { submitBtn.disabled = false; submitBtn.innerText = "DBに保存"; }
    };
});

// ==========================================
// 3. 集計・表示用関数（HUB / STATS）
// ==========================================
async function updatePlayerSuggestions() {
    const { data } = await supabase.from('players').select('name');
    if (data) {
        const names = [...new Set(data.map(p => p.name))];
        document.getElementById('playerHistory').innerHTML = names.map(n => `<option value="${n}">`).join('');
    }
}

async function loadHomeSummary() {
    const { data, error } = await supabase.from('set_summaries').select('player_name, total_score').order('total_score', { ascending: false }).limit(3);
    const container = document.getElementById('homeTop3');
    if (error || !data || data.length === 0) {
        container.innerHTML = '<div class="col-span-3 text-slate-500 text-xs py-4 italic">No data available</div>';
        return;
    }
    container.innerHTML = data.map((p, i) => `
        <div class="space-y-1">
            <div class="text-[10px] font-bold text-blue-400 uppercase">Rank ${i+1}</div>
            <div class="text-lg font-black italic truncate text-white">${p.player_name}</div>
            <div class="text-[10px] text-slate-400 font-mono">${p.total_score >= 0 ? '+' : ''}${p.total_score}</div>
        </div>`).join('');
}

async function loadMlbStats() {
    const { data, error } = await supabase.from('game_results').select('*');
    if (error) return;
    const statsMap = data.reduce((acc, cur) => {
        if (!acc[cur.player_name]) acc[cur.player_name] = { name: cur.player_name, g: 0, sumR: 0, w: 0, t2: 0, pts: 0 };
        const p = acc[cur.player_name];
        p.g++; p.sumR += cur.rank; if (cur.rank === 1) p.w++; if (cur.rank <= 2) p.t2++; p.pts += cur.score;
        return acc;
    }, {});
    const tableData = Object.values(statsMap).map(p => [p.name, p.g, (p.sumR / p.g).toFixed(2), ((p.w / p.g) * 100).toFixed(1) + '%', ((p.t2 / p.g) * 100).toFixed(1) + '%', p.pts]);
    const container = document.getElementById('mlb-grid-container');
    container.innerHTML = ''; // クリア
    statsGrid = new gridjs.Grid({
        columns: ["PLAYER", "G", "AVG", "W%", "T2%", "PTS"],
        data: tableData, sort: true, search: true,
        style: { table: { color: '#000' }, th: { 'background-color': '#041e42', color: '#fff' } }
    }).render(container);
}

// 履歴読み込み（既存の関数をSPA用に調整）
async function loadHistory() {
    const container = document.getElementById('cards-container');
    const { data, error } = await supabase.from('games').select('*').order('created_at', { ascending: false });
    if (error) return;
    container.innerHTML = data.map(game => `
        <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg">
            <div class="flex justify-between text-[10px] text-slate-500 mb-2 font-mono">
                <span>ID: ${game.id}</span>
                <span>${new Date(game.created_at).toLocaleDateString()}</span>
            </div>
            <div class="grid grid-cols-4 gap-2 text-center">
                ${game.player_names.map((n, i) => `
                    <div>
                        <div class="text-[9px] text-slate-400 truncate">${n}</div>
                        <div class="text-xs font-bold ${game.scores[i] >= 0 ? 'text-blue-400' : 'text-rose-400'}">${game.scores[i]}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// ==========================================
// 4. 初期化実行
// ==========================================
window.addEventListener('load', () => {
    updatePlayerSuggestions();
    loadHomeSummary();
    if (window.lucide) lucide.createIcons();
});
