const S_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
const S_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
const sb = window.supabase.createClient(S_URL, S_KEY);

async function initHistory() {
    try {
        // 1. 全データ取得（最新順）
        const { data, error } = await sb
            .from('game_results')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 2. 対局ごとにグループ化 (match_id または created_at をキーにする)
        // ここでは便宜上、同じ日時のものを1つの対局とみなすロジックにしています
        const matches = {};
        data.forEach(row => {
            const key = row.match_id || row.created_at; 
            if (!matches[key]) matches[key] = [];
            matches[key].push(row);
        });

        const swiperWrapper = document.getElementById('history-swiper-wrapper');
        const historyList = document.getElementById('history-list');

        // 3. 各対局をカード化して表示
        Object.keys(matches).forEach((key, index) => {
            const players = matches[key].sort((a, b) => a.rank - b.rank); // 1位から順に並べる
            const date = new Date(players[0].created_at).toLocaleDateString('ja-JP');
            
            // カードのHTML作成
            const cardHtml = createGameCard(players, date);

            // 直近3件はSwiper（ハイライト）へ、それ以降はリストへ
            if (index < 5) {
                const slide = document.createElement('div');
                slide.className = 'swiper-slide';
                slide.innerHTML = cardHtml;
                swiperWrapper.appendChild(slide);
            }
            
            const listItem = document.createElement('div');
            listItem.innerHTML = cardHtml;
            historyList.appendChild(listItem);
        });

        // 4. Swiperの初期化
        new Swiper(".mySwiper", {
            effect: "cards", // MLBカードっぽく重なるエフェクト
            grabCursor: true,
            pagination: { el: ".swiper-pagination" },
        });

    } catch (e) {
        console.error(e);
    }
}

function createGameCard(players, date) {
    // 1位のプレイヤー情報を取得（カードのメイン顔にするため）
    const winner = players[0];
    
    return `
        <div class="game-card p-4 mb-4" onclick="showMatchDetail('${players[0].match_id}')">
            <div class="flex justify-between items-start mb-3 border-b border-white/10 pb-2">
                <div>
                    <span class="text-[10px] text-orange-500 font-bold uppercase tracking-widest">${date}</span>
                    <h3 class="text-lg font-black italic uppercase leading-none">Match Report</h3>
                </div>
                <div class="text-right">
                    <span class="text-[10px] text-slate-400 block uppercase font-bold">Winner</span>
                    <span class="text-sm font-bold text-yellow-400">${winner.player_name}</span>
                </div>
            </div>
            
            <div class="space-y-1">
                ${players.map(p => `
                    <div class="flex items-center justify-between bg-black/20 p-2 rounded">
                        <div class="flex items-center space-x-3">
                            <span class="rank-badge rank-${p.rank} text-xs">${p.rank}</span>
                            <span class="text-xs font-bold ${p.rank === 1 ? 'text-white' : 'text-slate-300'}">${p.player_name}</span>
                        </div>
                        <span class="text-xs font-mono font-bold ${p.score >= 0 ? 'text-blue-400' : 'text-red-400'}">
                            ${p.score > 0 ? '+' : ''}${p.score}
                        </span>
                    </div>
                `).join('')}
            </div>
            
            <div class="mt-3 text-center">
                <button class="text-[9px] uppercase tracking-widest text-slate-500 font-bold hover:text-orange-400 transition">
                    View Full Box Score →
                </button>
            </div>
        </div>
    `;
}

// モーダル表示（後ほど実装）
window.showMatchDetail = function(matchId) {
    alert("Match Detail: " + matchId + "\\n詳細モーダルの実装に進みますか？");
};

initHistory();
