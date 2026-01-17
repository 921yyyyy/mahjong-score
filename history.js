const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function loadHistory() {
    const listEl = document.getElementById('historyList');
    
    // データを最新順に取得
    const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        listEl.innerHTML = `<div class="text-red-400">エラー: ${error.message}</div>`;
        return;
    }

    if (!data || data.length === 0) {
        listEl.innerHTML = `<div class="text-center py-10 text-slate-500">履歴がありません</div>`;
        return;
    }

    listEl.innerHTML = data.map(game => {
        const date = new Date(game.created_at).toLocaleDateString('ja-JP');
        return `
            <div class="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg">
                <div class="flex justify-between text-[10px] text-slate-500 mb-3 font-bold">
                    <span>ID: ${game.id}</span>
                    <span>${date}</span>
                </div>
                <div class="grid grid-cols-4 gap-2">
                    ${game.player_names.map((name, i) => `
                        <div class="text-center">
                            <div class="text-[10px] text-slate-400 truncate">${name}</div>
                            <div class="font-black ${game.scores[i] >= 0 ? 'text-indigo-400' : 'text-rose-400'}">
                                ${game.scores[i] >= 0 ? '+' : ''}${game.scores[i]}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

loadHistory();
