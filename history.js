const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function loadHistory() {
    const listEl = document.getElementById('historyList');
    
    try {
        console.log("Fetching data...");
        // 一旦、並び替え(order)なしで全データを取ってみる（原因切り分けのため）
        const { data, error } = await supabase
            .from('games')
            .select('*');

        if (error) throw error;

        console.log("Data received:", data);

        if (!data || data.length === 0) {
            listEl.innerHTML = `<div class="text-center py-10 text-slate-500">履歴がまだありません</div>`;
            return;
        }

        // 取得したデータを表示（created_atがない場合も考慮して || を使用）
        listEl.innerHTML = data.map(game => {
            const dateStr = game.created_at ? new Date(game.created_at).toLocaleDateString('ja-JP') : "日付なし";
            
            // player_names や scores が存在するかチェック（安全策）
            const names = game.player_names || ["?","?","?","?"];
            const scores = game.scores || [0,0,0,0];

            return `
                <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg mb-4">
                    <div class="flex justify-between text-[10px] text-slate-500 mb-3 font-bold">
                        <span>ID: ${game.id}</span>
                        <span>${dateStr}</span>
                    </div>
                    <div class="grid grid-cols-4 gap-2">
                        ${names.map((name, i) => `
                            <div class="text-center">
                                <div class="text-[10px] text-slate-400 truncate">${name}</div>
                                <div class="font-black ${scores[i] >= 0 ? 'text-indigo-400' : 'text-rose-400'}">
                                    ${scores[i] >= 0 ? '+' : ''}${scores[i]}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).reverse().join(''); // orderの代わりに、配列を逆順にして最新を上にする

    } catch (err) {
        console.error("Critical Error:", err);
        listEl.innerHTML = `<div class="text-red-400 p-4 bg-red-900/20 rounded-xl">
            エラーが発生しました:<br>${err.message}
        </div>`;
    }
}

// 実行
loadHistory();
