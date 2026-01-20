document.addEventListener('DOMContentLoaded', async () => {
    const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let playerSelects = {};
    let rowCount = 0;

    // 1. マスターデータ取得
    async function initRoster() {
        const { data: players } = await sb.from('players').select('name');
        const options = (players || []).map(p => ({ value: p.name, text: p.name }));
        ['pA', 'pB', 'pC', 'pD'].forEach(id => {
            playerSelects[id] = new TomSelect(`#${id}`, { options, create: true, maxItems: 1, placeholder: id.slice(-1), onChange: validateAll });
        });
    }

    // 2. 行生成（ピュアHTML）
    function addMatchRow() {
        rowCount++;
        const tr = document.createElement('tr');
        tr.className = 'match-row';
        tr.innerHTML = `
            <td class="col-label">${rowCount}</td>
            <td><input type="number" class="score-input sc-in" data-col="a"></td>
            <td><input type="number" class="score-input sc-in" data-col="b"></td>
            <td><input type="number" class="score-input sc-in" data-col="c"></td>
            <td><input type="number" class="score-input sc-in" data-col="d"></td>
            <td class="bal-cell"></td>
        `;
        document.getElementById('match-body').appendChild(tr);
        tr.querySelectorAll('input').forEach(i => i.addEventListener('input', () => { updateCalcs(); validateAll(); }));
    }

    // 3. 計算ロジック
    function updateCalcs() {
        const totals = { a: 0, b: 0, c: 0, d: 0 };
        const tips = { a: 0, b: 0, c: 0, d: 0 };

        document.querySelectorAll('.match-row').forEach(row => {
            let rowSum = 0;
            ['a', 'b', 'c', 'd'].forEach(col => {
                const val = Number(row.querySelector(`[data-col="${col}"]`).value) || 0;
                totals[col] += val;
                rowSum += val;
                
                const input = row.querySelector(`[data-col="${col}"]`);
                input.classList.toggle('pts-positive', val > 0);
                input.classList.toggle('pts-negative', val < 0);
            });
            const balCell = row.querySelector('.bal-cell');
            balCell.innerHTML = rowSum === 0 ? '<span style="color:#22c55e;">OK</span>' : `<button class="btn-calc" onclick="runCalc(this)">CALC</button>`;
        });

        ['a', 'b', 'c', 'd'].forEach(col => {
            const tVal = Number(document.querySelector(`.tip-in[data-col="${col}"]`).value) || 0;
            tips[col] = tVal;
            const max = Math.max(...Object.values(totals));
            document.getElementById(`tot-${col}`).innerText = totals[col];
            document.getElementById(`dif-${col}`).innerText = totals[col] - max;
            document.getElementById(`coin-${col}`).innerText = (totals[col] * 20) + (tips[col] * 50);
        });
    }

    window.runCalc = (btn) => {
        const row = btn.closest('tr');
        const vals = ['a', 'b', 'c'].map(c => Number(row.querySelector(`[data-col="${c}"]`).value) || 0);
        row.querySelector('[data-col="d"]').value = -(vals.reduce((s, v) => s + v, 0));
        updateCalcs(); validateAll();
    };

    function validateAll() {
        const rowsValid = Array.from(document.querySelectorAll('.match-row')).every(row => {
            const vals = Array.from(row.querySelectorAll('.sc-in')).map(i => Number(i.value) || 0);
            return vals.some(v => v !== 0) && vals.reduce((s, v) => s + v, 0) === 0;
        });
        const playersSet = Object.values(playerSelects).every(s => s.getValue() !== "");
        const btn = document.getElementById('submit-btn');
        btn.disabled = !(rowsValid && playersSet);
        document.getElementById('status-badge').innerText = btn.disabled ? "Checking Stats..." : "Ready to Sync";
    }

    // 4. DB保存（DX重視）
    document.getElementById('submit-btn').onclick = async () => {
        const btn = document.getElementById('submit-btn');
        btn.disabled = true; btn.innerText = "SYNCING...";
        
        try {
            const names = Object.values(playerSelects).map(s => s.getValue());
            // プレイヤー名からIDを取得/登録
            for(const n of names) await sb.from('players').upsert({ name: n }, { onConflict: 'name' });
            const { data: mstr } = await sb.from('players').select('id, name').in('name', names);

            // games登録 -> ID取得
            const { data: game, error: gErr } = await sb.from('games').insert({ player_names: names, game_date: new Date().toISOString().split('T')[0] }).select().single();
            if (gErr) throw gErr;

            const results = [];
            document.querySelectorAll('.match-row').forEach(row => {
                const vals = ['a', 'b', 'c', 'd'].map(col => Number(row.querySelector(`[data-col="${col}"]`).value) || 0);
                const sorted = vals.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
                names.forEach((name, i) => {
                    results.push({ 
                        game_id: game.id, 
                        player_id: mstr.find(m => m.name === name).id,
                        player_name: name,
                        score: vals[i],
                        rank: sorted.findIndex(x => x.i === i) + 1
                    });
                });
            });

            const summaries = names.map((name, i) => ({
                game_id: game.id,
                player_id: mstr.find(m => m.name === name).id,
                player_name: name,
                total_score: Number(document.getElementById(`tot-${['a','b','c','d'][i]}`).innerText),
                tips: Number(document.querySelector(`.tip-in[data-col="${['a','b','c','d'][i]}"]`).value) || 0,
                coins: Number(document.getElementById(`coin-${['a','b','c','d'][i]}`).innerText),
                final_rank: 0 // 必要に応じ事後計算
            }));

            await sb.from('game_results').insert(results);
            await sb.from('set_summaries').insert(summaries);
            
            location.href = "history.html";
        } catch (e) { alert(e.message); btn.disabled = false; }
    };

    document.getElementById('add-row').onclick = addMatchRow;
    document.querySelectorAll('.tip-in').forEach(i => i.addEventListener('input', updateCalcs));
    
    initRoster();
    for(let i=0; i<3; i++) addMatchRow();
});
