document.addEventListener('DOMContentLoaded', async () => {
    const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let playerSelects = {};

    async function initRoster() {
        const { data: players } = await sb.from('players').select('name');
        const options = players ? players.map(p => ({ value: p.name, text: p.name })) : [];
        ['pA', 'pB', 'pC', 'pD'].forEach(id => {
            playerSelects[id] = new TomSelect(`#${id}`, {
                options: options, create: true, maxItems: 1,
                render: { option_create: (data, escape) => `<div class="create">ADD: <strong>${escape(data.input)}</strong></div>` },
                onChange: () => validateAll()
            });
        });
    }

    function updateCalculations() {
        const data = table.getData();
        const scoreTotals = { a: 0, b: 0, c: 0, d: 0 };
        const tips = { a: 0, b: 0, c: 0, d: 0 };

        data.forEach(row => {
            if(row.type === "score") {
                scoreTotals.a += Number(row.a) || 0; scoreTotals.b += Number(row.b) || 0;
                scoreTotals.c += Number(row.c) || 0; scoreTotals.d += Number(row.d) || 0;
            } else if(row.type === "tip") {
                tips.a = Number(row.a) || 0; tips.b = Number(row.b) || 0;
                tips.c = Number(row.c) || 0; tips.d = Number(row.d) || 0;
            }
        });

        const maxScore = Math.max(scoreTotals.a, scoreTotals.b, scoreTotals.c, scoreTotals.d);
        const rows = table.getRows();
        rows.forEach(row => {
            const rowData = row.getData();
            if(rowData.type === "diff") {
                row.update({ a: scoreTotals.a - maxScore, b: scoreTotals.b - maxScore, c: scoreTotals.c - maxScore, d: scoreTotals.d - maxScore });
            } else if(rowData.type === "coin") {
                row.update({ a: (scoreTotals.a * 20) + (tips.a * 50), b: (scoreTotals.b * 20) + (tips.b * 50), c: (scoreTotals.c * 20) + (tips.c * 50), d: (scoreTotals.d * 20) + (tips.d * 50) });
            } else if(rowData.type === "total") {
                row.update({ a: scoreTotals.a, b: scoreTotals.b, c: scoreTotals.c, d: scoreTotals.d });
            }
        });
    }

    const createScoreColumn = (title, field) => ({
        title: title, field: field, editor: "number", hozAlign: "center", headerSort: false, 
        width: 85, // MLB Statsに合わせた固定幅
        editorParams: { elementAttributes: { inputmode: "decimal" } },
        editable: (cell) => ["score", "tip"].includes(cell.getRow().getData().type),
        formatter: function(cell) {
            const val = cell.getValue();
            const rowData = cell.getRow().getData();
            const el = cell.getElement();

            // Stats画面と共通の文字サイズ設定
            el.style.fontSize = "11px";
            el.style.padding = "8px 5px";

            if (["score", "tip"].includes(rowData.type)) {
                el.style.backgroundColor = "#ffffff";
                el.style.color = "#1e293b"; // 通常は黒
                if (val > 0) return `<span class="pts-positive" style="color:#1d4ed8; font-weight:800;">+${val}</span>`;
                if (val < 0) return `<span class="pts-negative" style="color:#be123c; font-weight:800;">${val}</span>`;
            } else {
                // 特殊行（DIFF, COIN, TOTAL）はstats.html風の背景
                el.style.backgroundColor = rowData.type === "coin" ? "#f1f5f9" : "#f8fafc";
                el.style.color = "#041e42";
                el.style.fontWeight = "900";
                if (rowData.type === "coin") el.style.color = "#f97316";
                return val;
            }
            return val === 0 ? "0" : (val || "");
        },
        cellEditing: (cell) => {
            // 入力中の文字色を黒に固定
            const input = cell.getElement().querySelector("input");
            if (input) input.style.color = "#000";
        },
        cellDblClick: (e, cell) => {
            let val = cell.getValue();
            if (val && ["score", "tip"].includes(cell.getRow().getData().type)) {
                cell.setValue(Number(val) * -1);
                validateAll();
            }
        }
    });

    const table = new Tabulator("#score-table", {
        data: [
            {type: "score", a: null, b: null, c: null, d: null},
            {type: "score", a: null, b: null, c: null, d: null},
            {type: "score", a: null, b: null, c: null, d: null},
            {type: "score", a: null, b: null, c: null, d: null},
            {type: "total", label: "TOTAL", a: 0, b: 0, c: 0, d: 0},
            {type: "diff", label: "DIFF", a: 0, b: 0, c: 0, d: 0},
            {type: "tip", label: "TIP", a: null, b: null, c: null, d: null},
            {type: "coin", label: "COIN", a: 0, b: 0, c: 0, d: 0}
        ],
        layout: "fitDataFill",
        headerVisible: true,
        columns: [
            {
                title: "NO", field: "label", width: 65, hozAlign: "center", headerSort: false,
                formatter: (cell) => {
                    const data = cell.getRow().getData();
                    const el = cell.getElement();
                    el.style.backgroundColor = "#041e42";
                    el.style.color = "#ffffff";
                    el.style.fontSize = "9px";
                    el.style.fontWeight = "bold";
                    el.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
                    return data.type === "score" ? cell.getRow().getPosition() : data.label;
                }
            },
            createScoreColumn("A", "a"), createScoreColumn("B", "b"), createScoreColumn("C", "c"), createScoreColumn("D", "d"),
            {
                title: "BAL", width: 65, hozAlign: "center", headerSort: false,
                formatter: (cell) => {
                    const d = cell.getData();
                    if(d.type !== "score") return "";
                    const sum = (Number(d.a)||0) + (Number(d.b)||0) + (Number(d.c)||0) + (Number(d.d)||0);
                    if (sum === 0) return `<span style="color:#64748b; font-size:9px;">OK</span>`;
                    // 計算ボタン：MLB.comのボタン風
                    return `<button style="background:#f97316; color:white; font-size:8px; padding:2px 6px; border-radius:4px; font-weight:900;">CALC</button>`;
                },
                cellClick: (e, cell) => {
                    const row = cell.getRow();
                    const d = row.getData();
                    if(d.type !== "score") return;
                    row.update({ d: -((Number(d.a)||0) + (Number(d.b)||0) + (Number(d.c)||0)) });
                    validateAll();
                }
            }
        ],
        cellEdited: () => { updateCalculations(); validateAll(); }
    });

    document.getElementById("add-row").onclick = () => {
        const totalRow = table.getRows().find(r => r.getData().type === "total");
        table.addRow({type: "score", a:null, b:null, c:null, d:null}, false, totalRow);
    };

    function validateAll() {
        const data = table.getData();
        const names = Object.values(playerSelects).map(s => s.getValue());
        const hasNames = names.every(n => n !== "");
        let allRowsOk = true;
        data.forEach(row => {
            if(row.type === "score") {
                const sum = (Number(row.a)||0) + (Number(row.b)||0) + (Number(row.c)||0) + (Number(row.d)||0);
                if ((row.a !== null || row.b !== null || row.c !== null || row.d !== null) && sum !== 0) allRowsOk = false;
            }
        });
        const btn = document.getElementById('submit-btn');
        btn.disabled = !(hasNames && allRowsOk);
        document.getElementById('status-badge').innerText = btn.disabled ? "ANALYZING..." : "SYNC READY";
    }

    document.getElementById('submit-btn').onclick = async () => {
        const btn = document.getElementById('submit-btn');
        btn.disabled = true; btn.innerText = "UPLOADING...";
        try {
            const names = Object.values(playerSelects).map(s => s.getValue());
            for(const name of names) await sb.from('players').upsert({ name: name }, { onConflict: 'name' });
            const { data: playerMaster } = await sb.from('players').select('id, name').in('name', names);
            const { data: gameRecord, error: gErr } = await sb.from('games').insert({ player_names: names, game_date: new Date().toISOString().split('T')[0] }).select().single();
            if (gErr) throw gErr;

            const rows = table.getData();
            const scoreTotals = [0, 0, 0, 0];
            const tips = [0, 0, 0, 0];
            const coins = [0, 0, 0, 0];
            const allResults = [];

            rows.forEach(row => {
                const vals = [Number(row.a)||0, Number(row.b)||0, Number(row.c)||0, Number(row.d)||0];
                if(row.type === "score") {
                    if (vals.every(v => v === 0)) return;
                    const sorted = vals.map((s, i) => ({s, i})).sort((a,b) => b.s - a.s);
                    const ranks = new Array(4);
                    sorted.forEach((item, rIdx) => ranks[item.i] = rIdx + 1);
                    names.forEach((name, i) => {
                        allResults.push({ game_id: gameRecord.id, player_id: playerMaster.find(m => m.name === name).id, player_name: name, score: vals[i], rank: ranks[i] });
                        scoreTotals[i] += vals[i];
                    });
                } else if(row.type === "tip") { vals.forEach((v, i) => tips[i] = v);
                } else if(row.type === "coin") { vals.forEach((v, i) => coins[i] = v); }
            });

            await sb.from('game_results').insert(allResults);
            const summaryRecords = names.map((name, i) => ({
                game_id: gameRecord.id, player_id: playerMaster.find(m => m.name === name).id,
                player_name: name, total_score: scoreTotals[i], final_rank: 0, tips: tips[i], coins: coins[i]
            }));
            await sb.from('set_summaries').insert(summaryRecords);
            alert("RECORD FINALIZED");
            location.href = "history.html";
        } catch (err) { alert(err.message); btn.disabled = false; }
    };
    initRoster();
});
