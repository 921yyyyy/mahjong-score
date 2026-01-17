// history.js (自己診断・強化版)
(function() {
    const listEl = document.getElementById('historyList');

    const init = async () => {
        const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';

        // 1. Supabaseが読み込まれているかチェック
        if (!window.supabase) {
            listEl.innerHTML = `<div class="text-amber-400 text-xs">Supabaseライブラリを待機中...</div>`;
            setTimeout(init, 500);
            return;
        }

        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        try {
            listEl.innerHTML = `<div class="text-center py-10 text-slate-500 italic">データベースに接続中...</div>`;
            
            // 2. データ取得
            const { data, error } = await supabase
                .from('games')
                .select('*');

            if (error) throw error;

            // 3. データが空の場合
            if (!data || data.length === 0) {
                listEl.innerHTML = `<div class="text-center py-10 text-slate-500">保存されたデータが見つかりませんでした</div>`;
                return;
            }

            // 4. 描画処理
            listEl.innerHTML = data.map(game => {
                const dateStr = game.created_at ? new Date(game.created_at).toLocaleDateString('ja-JP') : "不明な日時";
                const names = game.player_names || ["?","?","?","?"];
                const scores = game.scores || [0,0,0,0];

                return `
                    <div class="bg-slate-800 p-5 rounded-3xl border border-slate-700 shadow-xl mb-4">
                        <div class="flex justify-between text-[10px] text-slate-500 mb-3 font-mono">
                            <span>#${game.id}</span>
                            <span>${dateStr}</span>
                        </div>
                        <div class="grid grid-cols-4 gap-2">
                            ${names.map((name, i) => `
                                <div class="text-center">
                                    <div class="text-[10px] text-slate-400 truncate mb-1">${name}</div>
                                    <div class="text-sm font-black ${scores[i] >= 0 ? 'text-indigo-400' : 'text-rose-400'}">
                                        ${scores[i] >= 0 ? '+' : ''}${scores[i]}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).reverse().join('');

        } catch (err) {
            listEl.innerHTML = `
                <div class="p-4 bg-rose-950/30 border border-rose-500/50 rounded-2xl text-rose-400 text-xs">
                    <strong>通信エラーが発生しました</strong><br>
                    ${err.message}
                </div>`;
        }
    };

    // 実行
    init();
})();
