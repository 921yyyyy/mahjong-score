document.addEventListener('DOMContentLoaded', () => {
    // ... (初期変数設定、Canvas描画系は以前のものを継承) ...
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const gridBody = document.getElementById('gridBody');
    const sliders = { x: document.getElementById('adjustX'), y: document.getElementById('adjustY'), w: document.getElementById('adjustW'), h: document.getElementById('adjustH') };
    const labels = { w: document.getElementById('valW'), h: document.getElementById('valH') };

    let currentImage = null;
    let rotation = 0;
    let baseGrid = { ox: 0, oy: 0, uw: 0, uh: 0 }; 
    let gridConfig = { ox: 0, oy: 0, uw: 0, uh: 0 };

    function initScoreTable() {
        gridBody.innerHTML = '';
        for (let i = 1; i <= 8; i++) {
            const row = document.createElement('div');
            row.className = 'grid grid-cols-[40px_1fr_1fr_1fr_1fr] divide-x divide-white/5';
            row.innerHTML = `
                <div class="flex items-center justify-center bg-white/5 text-[10px] font-bold text-slate-500">${i}</div>
                ${Array(4).fill(0).map((_, p) => `
                    <div class="p-1 flex flex-col gap-1 bg-black/20">
                        <input type="number" class="w-full text-center text-[10px] py-1 score-plus" placeholder="+">
                        <input type="number" class="w-full text-center text-[10px] py-1 score-minus" placeholder="-">
                    </div>
                `).join('')}
            `;
            gridBody.appendChild(row);
        }
    }
    initScoreTable();

    // 合計計算ロジック
    function calcTotals() {
        const inputs = gridBody.querySelectorAll('input');
        const totals = [0, 0, 0, 0];
        let allLinesOk = true;

        for(let r = 0; r < 8; r++) {
            let lineSum = 0;
            const lineInputs = [];
            for(let p = 0; p < 4; p++) {
                const plus = parseInt(inputs[(r * 8) + (p * 2)].value) || 0;
                const minus = parseInt(inputs[(r * 8) + (p * 2) + 1].value) || 0;
                const score = plus - minus;
                totals[p] += score;
                lineSum += score;
            }
            // 行の背景色で整合性をフィードバック
            const rowDiv = gridBody.children[r];
            if (lineSum !== 0 && lineSum !== 0) { // 入力があるのに行合計が0でない場合
                 const hasInput = Array.from(rowDiv.querySelectorAll('input')).some(i => i.value !== "");
                 if(hasInput) {
                    rowDiv.style.backgroundColor = "rgba(248, 113, 113, 0.1)";
                    allLinesOk = false;
                 }
            } else {
                rowDiv.style.backgroundColor = "";
            }
        }

        ['A','B','C','D'].forEach((id, i) => {
            const el = document.getElementById(`total${id}`);
            el.innerText = (totals[i] >= 0 ? '+' : '') + totals[i];
            el.className = `text-center font-bold ${totals[i] >= 0 ? 'text-blue-400' : 'text-red-400'}`;
        });

        document.getElementById('saveData').disabled = !allLinesOk;
    }
    gridBody.addEventListener('input', calcTotals);

    // Supabase初期化
    const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    document.getElementById('saveData').onclick = () => {
        const modal = document.getElementById('cloudModal');
        const playerInputsArea = document.getElementById('playerInputs');
        playerInputsArea.innerHTML = '';
        ['A', 'B', 'C', 'D'].forEach(p => {
            playerInputsArea.innerHTML += `
                <div class="space-y-1">
                    <label class="text-[9px] text-slate-500 font-black uppercase tracking-widest ml-1">Player ${p}</label>
                    <input type="text" class="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white text-sm focus:border-orange-500 outline-none transition-all" placeholder="Enter name" list="playerHistory">
                </div>`;
        });
        modal.style.display = 'flex';
    };

    document.getElementById('dbSubmitBtn').onclick = async () => {
        const btn = document.getElementById('dbSubmitBtn');
        btn.disabled = true; btn.innerText = "SAVING...";

        const names = Array.from(document.querySelectorAll('#playerInputs input')).map(i => i.value || 'Unknown');
        const inputs = gridBody.querySelectorAll('input');
        const sessionId = `sess_${Date.now()}`; // 今日のセッションID

        try {
            // 1. game_results への保存 (1行ずつ Match ID を変えて保存)
            for (let r = 0; r < 8; r++) {
                const lineScores = [];
                for(let p = 0; p < 4; p++) {
                    lineScores.push((parseInt(inputs[r*8 + p*2].value)||0) - (parseInt(inputs[r*8 + p*2 + 1].value)||0));
                }

                if (lineScores.every(s => s === 0)) continue; // 空行は飛ばす

                const matchId = `match_${Date.now()}_${r}`; // これが重要！
                const sorted = lineScores.map((s, i) => ({s, i})).sort((a,b) => b.s - a.s);
                const ranks = new Array(4);
                sorted.forEach((item, idx) => ranks[item.i] = idx + 1);

                const matchData = names.map((name, i) => ({
                    session_id: sessionId,
                    match_id: matchId,
                    player_name: name,
                    score: lineScores[i],
                    rank: ranks[i],
                    created_at: new Date().toISOString()
                }));
                await supabase.from('game_results').insert(matchData);
            }

            // 2. set_summaries への保存
            const finalScores = [0,1,2,3].map(p => {
                let sum = 0;
                for(let r=0; r<8; r++) sum += (parseInt(inputs[r*8 + p*2].value)||0) - (parseInt(inputs[r*8 + p*2 + 1].value)||0);
                return sum;
            });
            const sSorted = finalScores.map((s, i) => ({s, i})).sort((a,b) => b.s - a.s);
            const fRanks = new Array(4);
            sSorted.forEach((item, idx) => fRanks[item.i] = idx + 1);

            const summaryData = names.map((name, i) => ({
                session_id: sessionId,
                player_name: name,
                total_score: finalScores[i],
                final_rank: fRanks[i],
                created_at: new Date().toISOString()
            }));
            await supabase.from('set_summaries').insert(summaryData);

            alert("SUCCESSFULLY SAVED");
            location.reload();
        } catch (e) {
            alert("ERROR: " + e.message);
        }
    };

    // --- 画像処理系 (簡略化して記載) ---
    document.getElementById('imageInput').onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (f) => {
            const img = new Image();
            img.onload = () => {
                currentImage = img;
                baseGrid = { ox: img.width * 0.1, oy: img.height * 0.2, uw: img.width * 0.8, uh: img.height * 0.5 };
                updateAdjustment();
            };
            img.src = f.target.result;
        };
        reader.readAsDataURL(file);
    };

    function updateAdjustment() {
        if (!currentImage) return;
        labels.w.innerText = sliders.w.value;
        labels.h.innerText = sliders.h.value;
        gridConfig.ox = baseGrid.ox + parseInt(sliders.x.value);
        gridConfig.oy = baseGrid.oy + parseInt(sliders.y.value);
        gridConfig.uw = baseGrid.uw * parseFloat(sliders.w.value);
        gridConfig.uh = baseGrid.uh * parseFloat(sliders.h.value);
        drawPreview();
    }
    Object.values(sliders).forEach(s => s.addEventListener('input', updateAdjustment));

    function drawPreview() {
        if (!currentImage) return;
        canvas.width = currentImage.width; canvas.height = currentImage.height;
        ctx.drawImage(currentImage, 0, 0);
        ctx.strokeStyle = "#f97316"; ctx.lineWidth = 10;
        ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);
    }
});
