document.addEventListener('DOMContentLoaded', async () => {
    const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let playerSelects = {};

    // 1. プレイヤーマスターの初期化
    async function initRoster() {
        const { data: players } = await sb.from('players').select('name');
        const options = players ? players.map(p => ({ value: p.name, text: p.name })) : [];

        ['pA', 'pB', 'pC', 'pD'].forEach(id => {
            playerSelects[id] = new TomSelect(`#${id}`, {
                options: options,
                create: true,
                maxItems: 1,
                render: {
                    option_create: (data, escape) => `<div class="create">ADD NEW: <strong>${escape(data.input)}</strong></div>`,
                },
                onChange: () => {
                    updatePlayerTotals(); // プレイヤー名変更時も合計を更新
                    validateAll();
                }
            });
        });
    }

    // セッション合計（プレイヤーごとの合計値）を表示する関数
    function updatePlayerTotals() {
        const data = table.getData();
        const totals = { a: 0, b: 0, c: 0, d: 0 };
        
        data.forEach(row => {
            totals.a += Number(row.a) || 0;
            totals.b += Number(row.b) || 0;
            totals.c += Number(row.c) || 0;
            totals.d += Number(row.d) || 0;
        });

        // 画面上の合計表示エリアを更新（もしHTML側にIDがあれば反映）
        ['a', 'b', 'c', 'd'].forEach(id => {
            const el = document.getElementById(`total-${id}`);
            if (el) {
                el.innerText = totals[id];
                el.style.color = totals[id] >= 0 ? "#60a5fa" : "#f87171"; // 青または赤
            }
        });
        
        // Tabulatorのフッターに合計を表示する設定（テーブル定義側で対応）
    }

    // スコア列の設定
    const createScoreColumn = (title, field) => ({
        title: title,
        field: field,
        editor: "number",
        hozAlign: "center",
        headerSort: false,
        resizable: false,
        bottomCalc: "sum", // プレイヤーごとの合計値を表示
        editorParams: {
            elementAttributes: { inputmode: "decimal" }
        },
        // スコアの色分け：プラスは青系、マイナスは赤系
        formatter: function(cell) {
            const val = cell.getValue();
            if (val > 0) return `<span style="color:#60a5fa; font-weight:800;">+${val}</span>`;
            if (val < 0) return `<span style="color:#f87171; font-weight:800;">${val}</span>`;
            return val === 0 ? "0" : "";
        },
        cellDblClick: function(e, cell) {
            let val = cell.getValue();
            if (val) {
                cell.setValue(Number(val) * -1);
                validateAll();
            }
        }
    });

    // 2. スコア表 (Tabulator) の定義
    const table = new Tabulator("#score-table", {
        data: Array(4).fill().map(() => ({ a: null, b: null, c: null, d: null })),
        layout: "fitColumns",
        columnDefaults: { tooltip: false },
        columns: [
            {title: "NO", formatter: "rownum", width: 40, hozAlign: "center", headerSort: false, resizable: false},
            createScoreColumn("A", "a"),
            createScoreColumn("B", "b"),
            createScoreColumn("C", "c"),
            createScoreColumn("D", "d"),
            {
                title: "BAL", width: 50, hozAlign: "center", headerSort: false, resizable: false,
                formatter: function(cell) {
                    const d = cell.getData();
                    const sum = (Number(d.a)||0) + (Number(d.b)||0) + (Number(d.c)||0) + (Number(d.d)||0);
                    return sum === 0 ? "✅" : `<span style="color:#f87171; font-size:10px;">${sum > 0 ? '+' : ''}${sum}</span>`;
                },
                // バグ修正：正確な不足分を算出してDに代入する
                cellClick: function(e, cell) {
                    const row = cell.getRow();
                    const d = row.getData();
                    // A, B, C の合計を計算し、その逆数を D に設定する
                    const currentSumABC = (Number(d.a)||0) + (Number(d.b)||0) + (Number(d.c)||0);
                    row.update({ d: -currentSumABC });
                    validateAll();
                }
            }
        ],
        cellEdited: () => {
            updatePlayerTotals();
            validateAll();
        }
    });

    document.getElementById("add-row").onclick = () => table.addRow({a:null, b:null, c:null, d:null});

    // 3. バリデーション
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

    // 4. 保存処理
    document.getElementById('submit-btn').onclick = async () => {
        const btn = document.getElementById('submit-btn');
        btn.disabled = true; btn.innerText = "SYNCING TO CLOUD...";

        try {
            const names = Object.values(playerSelects).map(s => s.getValue());
            
            for(const name of names) {
                await sb.from('players').upsert({ name: name }, { onConflict: 'name' });
            }
            const { data: playerMaster } = await sb.from('players').select('id, name').in('name', names);

            const { data: gameRecord, error: gErr } = await sb.from('games').insert({
                player_names: names,
                game_date: new Date().toISOString().split('T')[0]
            }).select().single();
            if (gErr) throw gErr;

            const rows = table.getData();
            const allResults = [];
            const totals = [0, 0, 0, 0];

            for (const [idx, row] of rows.entries()) {
                const scores = [Number(row.a)||0, Number(row.b)||0, Number(row.c)||0, Number(row.d)||0];
                if (scores.every(s => s === 0)) continue;

                const sorted = scores.map((s, i) => ({s, i})).sort((a,b) => b.s - a.s);
                const ranks = new Array(4);
                sorted.forEach((item, rIdx) => ranks[item.i] = rIdx + 1);

                names.forEach((name, i) => {
                    const pInfo = playerMaster.find(m => m.name === name);
                    allResults.push({
                        game_id: gameRecord.id,
                        player_id: pInfo.id,
                        player_name: name,
                        score: scores[i],
                        rank: ranks[i]
                    });
                    totals[i] += scores[i];
                });
            }

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
