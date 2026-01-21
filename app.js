// app.js の 1行目付近
document.addEventListener('DOMContentLoaded', async () => {
     const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';

    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // ★ここから挿入
    const dateInput = document.getElementById('game-date');
    dateInput.value = new Date().toISOString().split('T')[0];
    // ★ここまで挿入

    let playerSelects = {};

    let rowCount = 0;

    async function initRoster() {
        const { data: players } = await sb.from('players').select('name');
        const options = (players || []).map(p => ({ value: p.name, text: p.name }));
        ['pA', 'pB', 'pC', 'pD'].forEach(id => {
            playerSelects[id] = new TomSelect(`#${id}`, { options, create: true, maxItems: 1, placeholder: id.slice(-1), onChange: validateAll });
        });
    }

    // 入力イベント（半角強制・色付け）
    function setupInputEvents(input) {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^-0-9.]/g, ''); // 半角数字強制
            updateCalcs(); 
            validateAll();
        });
        // ダブルタップでマイナス反転
        input.addEventListener('dblclick', (e) => {
            const val = Number(e.target.value);
            if(val !== 0) {
                e.target.value = val * -1;
                updateCalcs();
                validateAll();
            }
        });
    }

    function addMatchRow() {
        rowCount++;
        const tr = document.createElement('tr');
        tr.className = 'match-row';
        tr.innerHTML = `
            <td class="col-label">${rowCount}</td>
            <td><input type="number" inputmode="decimal" class="score-input sc-in" data-col="a"></td>
            <td><input type="number" inputmode="decimal" class="score-input sc-in" data-col="b"></td>
            <td><input type="number" inputmode="decimal" class="score-input sc-in" data-col="c"></td>
            <td><input type="number" inputmode="decimal" class="score-input sc-in" data-col="d"></td>
            <td class="bal-cell"></td>
        `;
        document.getElementById('match-body').appendChild(tr);
        tr.querySelectorAll('input').forEach(setupInputEvents);
    }

    function updateCalcs() {
        const totals = { a: 0, b: 0, c: 0, d: 0 };
        const tips = { a: 0, b: 0, c: 0, d: 0 };

        // スコア計算
        document.querySelectorAll('.match-row').forEach(row => {
            let rowSum = 0;
            let hasInput = false;
            ['a', 'b', 'c', 'd'].forEach(col => {
                const raw = row.querySelector(`[data-col="${col}"]`).value;
                if(raw !== "") hasInput = true;
                const val = Number(raw) || 0;
                totals[col] += val;
                rowSum += val;
                const input = row.querySelector(`[data-col="${col}"]`);
                input.classList.toggle('pts-positive', val > 0);
                input.classList.toggle('pts-negative', val < 0);
            });
            const balCell = row.querySelector('.bal-cell');
            if(!hasInput) { balCell.innerHTML = ""; }
            else {
                balCell.innerHTML = rowSum === 0 ? '<span style="color:#22c55e;">OK</span>' : `<button class="btn-calc" onclick="runCalc(this)">CALC</button>`;
            }
        });

        // チップ計算
        let tipSum = 0;
        let tipHasInput = false;
        ['a', 'b', 'c', 'd'].forEach(col => {
            const raw = document.querySelector(`.tip-in[data-col="${col}"]`).value;
            if(raw !== "") tipHasInput = true;
            const val = Number(raw) || 0;
            tips[col] = val;
            tipSum += val;
            const input = document.querySelector(`.tip-in[data-col="${col}"]`);
            input.classList.toggle('pts-positive', val > 0);
            input.classList.toggle('pts-negative', val < 0);
        });
        const tipBalCell = document.getElementById('tip-bal-cell');
        if(!tipHasInput) { tipBalCell.innerHTML = ""; }
        else {
            tipBalCell.innerHTML = tipSum === 0 ? '<span style="color:#22c55e;">OK</span>' : `<button class="btn-calc" onclick="runCalc(this, true)">CALC</button>`;
        }

        ['a', 'b', 'c', 'd'].forEach(col => {
            const max = Math.max(...Object.values(totals));
            document.getElementById(`tot-${col}`).innerText = totals[col];
            document.getElementById(`dif-${col}`).innerText = totals[col] - max;
            document.getElementById(`coin-${col}`).innerText = (totals[col] * 20) + (tips[col] * 50);
        });
    }

    window.runCalc = (btn) => {
    const row = btn.closest('tr');
    const inputs = Array.from(row.querySelectorAll('.score-input'));
    
    // 1. 完全に未入力（空文字）のセルだけを抽出
    const emptyInputs = inputs.filter(i => i.value === "");

    // 未入力が1つもない場合は、何もせず終了（または最後の列を調整対象にする）
    if (emptyInputs.length === 0) return;

    // 2. 未入力が複数ある場合は、その中の「最初の1つ」をターゲットにする
    // (例: A, Bのみ入力してCALCを押すと、Cが計算され、Dは空のまま残る)
    const target = emptyInputs[0];
    const targetCol = target.getAttribute('data-col');
    
    // 3. ターゲット以外の「入力済み」の数値だけを合計
    let otherSum = 0;
    inputs.forEach(i => {
        if (i.getAttribute('data-col') !== targetCol) {
            otherSum += Number(i.value) || 0;
        }
    });

    // 4. 合計を0にするための数値を流し込む
    target.value = -otherSum;

    updateCalcs(); 
    validateAll();
};


    function validateAll() {
        const matchRows = Array.from(document.querySelectorAll('.match-row'));
        const activeRows = matchRows.filter(row => Array.from(row.querySelectorAll('.sc-in')).some(i => i.value !== ""));
        
        const rowsValid = activeRows.length > 0 && activeRows.every(row => {
            const vals = Array.from(row.querySelectorAll('.sc-in')).map(i => Number(i.value) || 0);
            return vals.reduce((s, v) => s + v, 0) === 0;
        });

        const tipInputs = Array.from(document.querySelectorAll('.tip-in'));
        const tipHasInput = tipInputs.some(i => i.value !== "");
        const tipValid = !tipHasInput || tipInputs.map(i => Number(i.value) || 0).reduce((s, v) => s + v, 0) === 0;

        const playersSet = Object.values(playerSelects).every(s => s.getValue() !== "");
        const btn = document.getElementById('submit-btn');
        btn.disabled = !(rowsValid && tipValid && playersSet);
        document.getElementById('status-badge').innerText = btn.disabled ? "Checking Stats..." : "Ready to Sync";
    }

        document.getElementById('submit-btn').onclick = async () => {
        const btn = document.getElementById('submit-btn');
        
        // ★ここから追加・変更
        const selectedDateStr = document.getElementById('game-date').value; 
        const gameTime = new Date();
        const [year, month, day] = selectedDateStr.split('-');
        gameTime.setFullYear(year, month - 1, day);
        const finalTimestamp = gameTime.toISOString();
        // ★ここまで追加・変更

        btn.disabled = true; btn.innerText = "SYNCING...";
        try {
            const names = Object.values(playerSelects).map(s => s.getValue());
            for(const n of names) await sb.from('players').upsert({ name: n }, { onConflict: 'name' });
            const { data: mstr } = await sb.from('players').select('id, name').in('name', names);
            
            // ★ game_date と created_at を上書き
            const { data: game, error: gErr } = await sb.from('games').insert({ 
                player_names: names, 
                game_date: selectedDateStr,
                created_at: finalTimestamp 
            }).select().single();
            if (gErr) throw gErr;

            const results = [];
            document.querySelectorAll('.match-row').forEach(row => {
                const inputs = Array.from(row.querySelectorAll('.sc-in'));
                if(inputs.every(i => i.value === "")) return; 
                const vals = inputs.map(i => Number(i.value) || 0);
                const sorted = [...vals].sort((a, b) => b - a);
                names.forEach((name, i) => {
                    results.push({ 
                        game_id: game.id, 
                        player_id: mstr.find(m => m.name === name).id,
                        player_name: name,
                        score: vals[i],
                        rank: sorted.indexOf(vals[i]) + 1,
                        created_at: finalTimestamp // ★追加
                    });
                });
            });

            // --- 既存のコード (ここから) ---
            const summaries = names.map((name, i) => ({
                game_id: game.id,
                player_id: mstr.find(m => m.name === name).id,
                player_name: name,
                total_score: Number(document.getElementById(`tot-${['a','b','c','d'][i]}`).innerText),
                tips: Number(document.querySelector(`.tip-in[data-col="${['a','b','c','d'][i]}"]`).value) || 0,
                coins: Number(document.getElementById(`coin-${['a','b','c','d'][i]}`).innerText),
                final_rank: 0,
                created_at: finalTimestamp
            }));

            // ★ここから挿入：Sessionの順位(final_rank)を計算する
            const sortedSummaries = [...summaries].sort((a, b) => b.total_score - a.total_score);
            summaries.forEach(s => {
                s.final_rank = sortedSummaries.findIndex(sorted => sorted.player_name === s.player_name) + 1;
            });
            // ★ここまで挿入

            await sb.from('game_results').insert(results);
// --- 既存のコード (ここまで) ---


        
            // --- 既存の insert 処理のあとに追加 ---
            await sb.from('set_summaries').insert(summaries);

                        // ★ここから「操作ログ」の保存（game.id を紐付け！）
            const logData = {
                action_type: 'SYNC',
                target_game_id: game.id, // すでに上で定義されている game.id を使用
                player_names: names,
                details: `${names.join(', ')} の対局結果を保存`,
                raw_data: {
                    match_results: results,
                    summaries: summaries
                }
            };
            await sb.from('action_logs').insert(logData);
            // ★ここまで追加


            location.href = "history.html";

        } catch (e) { alert(e.message); btn.disabled = false; }
    };

    document.getElementById('add-row').onclick = addMatchRow;
    document.querySelectorAll('.tip-in').forEach(setupInputEvents);
    initRoster();
    for(let i=0; i<3; i++) addMatchRow();
});
// --- 既存のコードが上にある ---
// ... (中略) ...
// location.href = "history.html"; などが最後にあるはず

// ==========================================
// ★ ここから末尾に追記：裏管理モード起動ロジック
// ==========================================
let entryTapCount = 0;
let entryTapTimer;

// DOMが読み込まれてからボタンを探すようにイベントリスナーで囲むとより確実です
document.addEventListener('DOMContentLoaded', () => {
    const entryTrigger = document.getElementById('admin-trigger');

    if (entryTrigger) {
        entryTrigger.addEventListener('click', () => {
            entryTapCount++;
            
            // 2秒以内に連続で叩かないとリセット
            clearTimeout(entryTapTimer);
            entryTapTimer = setTimeout(() => {
                entryTapCount = 0;
            }, 2000);

            if (entryTapCount === 5) {
                entryTapCount = 0;
                const pass = prompt("Enter Admin Password:");
                
                if (pass === "Gemini") {
                    alert("ACCESS GRANTED.");
                    location.href = "admin.html";
                } else if (pass !== null) {
                    alert("Invalid Password.");
                }
            }
        });
    }
});

