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
                    validateAll();
                }
            });
        });
    }

    // セッション合計や各種計算の更新
    function updateCalculations() {
        const data = table.getData();
        const scoreTotals = { a: 0, b: 0, c: 0, d: 0 };
        const tips = { a: 0, b: 0, c: 0, d: 0 };

        data.forEach(row => {
            if(row.type === "score") {
                scoreTotals.a += Number(row.a) || 0;
                scoreTotals.b += Number(row.b) || 0;
                scoreTotals.c += Number(row.c) || 0;
                scoreTotals.d += Number(row.d) || 0;
            } else if(row.type === "tip") {
                tips.a = Number(row.a) || 0;
                tips.b = Number(row.b) || 0;
                tips.c = Number(row.c) || 0;
                tips.d = Number(row.d) || 0;
            }
        });

        const totalsArray = [scoreTotals.a, scoreTotals.b, scoreTotals.c, scoreTotals.d];
        const maxScore = Math.max(...totalsArray);

        // Diff(点数差), Coin(計算) の行を特定して更新
        const rows = table.getRows();
        rows.forEach(row => {
            const rowData = row.getData();
            if(rowData.type === "diff") {
                row.update({
                    a: scoreTotals.a - maxScore,
                    b: scoreTotals.b - maxScore,
                    c: scoreTotals.c - maxScore,
                    d: scoreTotals.d - maxScore
                });
            } else if(rowData.type === "coin") {
                row.update({
                    a: (scoreTotals.a * 20) + (tips.a * 50),
                    b: (scoreTotals.b * 20) + (tips.b * 50),
                    c: (scoreTotals.c * 20) + (tips.c * 50),
                    d: (scoreTotals.d * 20) + (tips.d * 50)
                });
            }
        });
    }

    // 列設定の共通関数
    const createScoreColumn = (title, field) => ({
        title: title,
        field: field,
        editor: "number",
        hozAlign: "center",
        headerSort: false,
        resizable: false,
        editorParams: { elementAttributes: { inputmode: "decimal" } },
        editable: (cell) => {
            const rowData = cell.getRow().getData();
            return rowData.type === "score" || rowData.type === "tip";
        },
        formatter: function(cell) {
            const val = cell.getValue();
            const rowData = cell.getRow().getData();
            
            // フッター（合計・計算行）の背景色と同化しないようにスタイル調整
            if (rowData.type !== "score") {
                cell.getElement().style.backgroundColor = "#2d3748";
                cell.getElement().style.color = "#ffffff";
                cell.getElement().style.fontWeight = "bold";
            }

            if (val > 0) return `<span style="color:#60a5fa; font-weight:800;">+${val}</span>`;
            if (val < 0) return `<span style="color:#f87171; font-weight:800;">${val}</span>`;
            return val === 0 ? "0" : "";
        },
        cellDblClick: function(e, cell) {
            let val = cell.getValue();
            if (val && (cell.getRow().getData().type === "score" || cell.getRow().getData().type === "tip")) {
                cell.setValue(Number(val) * -1);
                validateAll();
            }
        }
    });

    // 2. スコア表 (Tabulator) の定義
    const table = new Tabulator("#score-table", {
        data: [
            {type: "score", a: null, b: null, c: null, d: null},
            {type: "score", a: null, b: null, c: null, d: null},
            {type: "score", a: null, b: null, c: null, d: null},
            {type: "score", a: null, b: null, c: null, d: null},
            {type: "diff", label: "DIFF", a: 0, b: 0, c: 0, d: 0},
            {type: "tip", label: "TIP", a: 0, b: 0, c: 0, d: 0},
            {type: "coin", label: "COIN", a: 0, b: 0, c: 0, d: 0}
        ],
        layout: "fitColumns",
        columns: [
            {
                title: "NO", 
                field: "label",
                width: 40, 
                hozAlign: "center", 
                headerSort: false,
                formatter: (cell) => {
                    const data = cell.getRow().getData();
                    return data.type === "score" ? cell.getRow().getPosition() : `<strong>${data.label}</strong>`;
                }
            },
            createScoreColumn("A", "a"),
            createScoreColumn("B", "b"),
            createScoreColumn("C", "c"),
            createScoreColumn("D", "d"),
            {
                title: "BAL", width: 50, hozAlign: "center", headerSort: false,
                formatter: function(cell) {
                    const d = cell.getData();
                    if(d.type !== "score") return "";
                    const sum = (Number(d.a)||0) + (Number(d.b)||0) + (Number(d.c)||0) + (Number(d.d)||0);
                    return sum === 0 ? "✅" : `<span style="color:#f87171; font-size:10px;">${sum > 0 ? '+' : ''}${sum}</span>`;
                },
                cellClick: function(e, cell) {
                    const row = cell.getRow();
                    const d = row.getData();
                    if(d.type !== "score") return;
                    const currentSumABC = (Number(d.a)||0) + (Number(d.b)||0) + (Number(d.c)||0);
                    row.update({ d: -currentSumABC });
                    validateAll();
                }
            }
        ],
        cellEdited: () => {
            updateCalculations();
            validateAll();
        }
    });

    document.getElementById("add-row").onclick = () => {
        // スコア行をチップ行の前に追加する
        const tipRow = table.getRows().find(r => r.getData().type === "tip");
        table.addRow({type: "score", a:null, b:null, c:null, d:null}, false, tipRow);
    };

    // 3. バリデーション
    function validateAll() {
        const data = table.getData();
        const names = Object.values(playerSelects).map(s => s.getValue());
        const hasNames = names.every(n => n !== "");
        
        let allRowsOk = true;
        data.forEach(row => {
            if(row.type === "score") {
                const sum = (Number(row.a)||0) + (Number(row.b)||0) + (Number(row.c)||0) + (Number(row.d)||0);
                const hasData = (row.a !== null || row.b !== null || row.c !== null || row.d !== null);
                if (hasData && sum !== 0) allRowsOk = false;
            }
        });

        const btn = document.getElementById('submit-btn');
        btn.disabled = !(hasNames && allRowsOk);
        document.getElementById('status-badge').innerText = btn.disabled ? "Check Inputs..." : "Ready to Sync";
    }

    // 4. 保存処理
    document.getElementById('submit-btn').onclick = async () => {
        const btn = document.getElementById('submit-btn');
        btn.disabled = true; btn.innerText = "SYNCING...";

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
            const scoreTotals = [0, 0, 0, 0];
            const tips = [0, 0, 0, 0];
            const coins = [0, 0, 0, 0];
            const allResults = [];

            // データの仕分け
            rows.forEach(row => {
                const vals = [Number(row.a)||0, Number(row.b)||0, Number(row.c)||0, Number(row.d)||0];
                if(row.type === "score") {
                    if (vals.every(v => v === 0)) return;
                    
                    const sorted = vals.map((s, i) => ({s, i})).sort((a,b) => b.s - a.s);
                    const ranks = new Array(4);
                    sorted.forEach((item, rIdx) => ranks[item.i] = rIdx + 1);

                    names.forEach((name, i) => {
                        allResults.push({
                            game_id: gameRecord.id,
                            player_id: playerMaster.find(m => m.name === name).id,
                            player_name: name,
                            score: vals[i],
                            rank: ranks[i]
                        });
                        scoreTotals[i] += vals[i];
                    });
                } else if(row.type === "tip") {
                    vals.forEach((v, i) => tips[i] = v);
                } else if(row.type === "coin") {
                    vals.forEach((v, i) => coins[i] = v);
                }
            });

            await sb.from('game_results').insert(allResults);

            const fSorted = scoreTotals.map((s, i) => ({s, i})).sort((a,b) => b.s - a.s);
            const fRanks = new Array(4);
            fSorted.forEach((item, rIdx) => fRanks[item.i] = rIdx + 1);

            const summaryRecords = names.map((name, i) => ({
                game_id: gameRecord.id,
                player_id: playerMaster.find(m => m.name === name).id,
                player_name: name,
                total_score: scoreTotals[i],
                final_rank: fRanks[i],
                tips: tips[i], // 追加カラム
                coins: coins[i] // 追加カラム
            }));
            await sb.from('set_summaries').insert(summaryRecords);

            alert("SUCCESS");
            location.href = "history.html";

        } catch (err) {
            alert("DB ERROR: " + err.message);
            btn.disabled = false;
        }
    };

    initRoster();
});
