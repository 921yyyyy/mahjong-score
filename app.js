document.addEventListener('DOMContentLoaded', async () => {
    const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let playerSelects = {};

    // 1. プレイヤーマスター(playersテーブル)からデータを取得してTomSelectを初期化
    async function initRoster() {
        const { data: players, error } = await sb.from('players').select('name');
        const options = players ? players.map(p => ({ value: p.name, text: p.name })) : [];

        ['pA', 'pB', 'pC', 'pD'].forEach(id => {
            playerSelects[id] = new TomSelect(`#${id}`, {
                options: options,
                create: true, // 新規プレイヤーはその場で登録可能に
                maxItems: 1,
                onChange: () => validateAll()
            });
        });
    }

    // 2. スコア表 (Tabulator) の定義
    const table = new Tabulator("#score-table", {
        data: Array(4).fill().map(() => ({ a: null, b: null, c: null, d: null })),
        layout: "fitColumns",
        headerVisible: true,
        columns: [
            {title: "NO", formatter: "rownum", width: 40, hozAlign: "center", headerSort: false},
            {title: "A", field: "a", editor: "number", hozAlign: "center", headerSort: false},
            {title: "B", field: "b", editor: "number", hozAlign: "center", headerSort: false},
            {title: "C", field: "c", editor: "number", hozAlign: "center", headerSort: false},
            {title: "D", field: "d", editor: "number", hozAlign: "center", headerSort: false},
            {
                title: "BAL", width: 50, hozAlign: "center", headerSort: false,
                formatter: function(cell) {
                    const d = cell.getData();
                    const sum = (Number(d.a)||0) + (Number(d.b)||0) + (Number(d.c)||0) + (Number(d.d)||0);
                    return sum === 0 ? "✅" : "❌";
                }
            }
        ],
        cellEdited: () => validateAll()
    });

    document.getElementById("add-row").onclick = () => table.addRow({a:null, b:null, c:null, d:null});

    // 3. バリデーション（保存ボタンの制御）
    function validateAll() {
        const data = table.getData();
        const names = Object.values(playerSelects).map(s => s.getValue());
        const hasNames = names.every(n => n !== "");
        
        let allRowsOk = true;
        data.forEach(row => {
            const sum = (Number(row.a)||0) + (Number(row.b)||0) + (Number(row.c)||0) + (Number(row.d)||0);
            const hasData = (row.a !== null || row.b !== null || row.c !== null || row.d !== null);
            if (hasData && sum !== 0) allRowsOk = false;
        });

        const btn = document.getElementById('submit-btn');
        btn.disabled = !(hasNames && allRowsOk);
        document.getElementById('status-badge').innerText = btn.disabled ? "Check Inputs..." : "Ready to Sync";
    }

    // 4. 保存処理 (DB構成に準拠)
    document.getElementById('submit-btn').onclick = async () => {
        const btn = document.getElementById('submit-btn');
        btn.disabled = true; btn.innerText = "SYNCING TO CLOUD...";

        try {
            const names = Object.values(playerSelects).map(s => s.getValue());
            
            // ① playersテーブルへの登録/更新（playerマスターを活かす）
            for(const name of names) {
                await sb.from('players').upsert({ name: name }, { onConflict: 'name' });
            }
            const { data: playerMaster } = await sb.from('players').select('id, name').in('name', names);

            // ② gamesテーブルへの親レコード登録
            const { data: gameRecord, error: gErr } = await sb.from('games').insert({
                player_names: names,
                game_date: new Date().toISOString().split('T')[0]
            }).select().single();
            if (gErr) throw gErr;

            const rows = table.getData();
            const allResults = [];
            const totals = [0, 0, 0, 0];

            // ③ 各行を Match として解析して明細保存
            for (const [idx, row] of rows.entries()) {
                const scores = [Number(row.a)||0, Number(row.b)||0, Number(row.c)||0, Number(row.d)||0];
                if (scores.every(s => s === 0)) continue;

                // 順位計算
                const sorted = scores.map((s, i) => ({s, i})).sort((a,b) => b.s - a.s);
                const ranks = new Array(4);
                sorted.forEach((item, rIdx) => ranks[item.i] = rIdx + 1);

                names.forEach((name, i) => {
                    const pInfo = playerMaster.find(m => m.name === name);
                    allResults.push({
                        game_id: gameRecord.id, // 親ID紐付け
                        player_id: pInfo.id,    // playerテーブルのID紐付け
                        player_name: name,
                        score: scores[i],
                        rank: ranks[i]
                    });
                    totals[i] += scores[i];
                });
            }

            // ④ game_results と set_summaries へ一括保存
            await sb.from('game_results').insert(allResults);

            const fSorted = totals.map((s, i) => ({s, i})).sort((a,b) => b.s - a.s);
            const fRanks = new Array(4);
            fSorted.forEach((item, rIdx) => fRanks[item.i] = rIdx + 1);

            const summaryRecords = names.map((name, i) => {
                const pInfo = playerMaster.find(m => m.name === name);
                return {
                    game_id: gameRecord.id,
                    player_id: pInfo.id,
                    player_name: name,
                    total_score: totals[i],
                    final_rank: fRanks[i]
                };
            });
            await sb.from('set_summaries').insert(summaryRecords);

            alert("SUCCESS: DATA SYNCED");
            location.href = "history.html";

        } catch (err) {
            alert("DB ERROR: " + err.message);
            btn.disabled = false; btn.innerText = "RETRY UPLOAD";
        }
    };

    initRoster();
});
