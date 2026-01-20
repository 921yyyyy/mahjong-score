const S_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
const S_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
const sb = window.supabase.createClient(S_URL, S_KEY);

async function initHistory() {
    try {
        // 1. Session（日別集計）を取得
        // history.js の initHistory 内
const { data: results, error } = await sb.from('game_results')
    .select('*')
    // .order('created_at', { ascending: true }) // ←これを消して、下に入れ替え
    .order('game_date', { ascending: false }) // 1. まず日付の新しい順にする
    .order('created_at', { ascending: false }); // 2. 同じ日付内なら時間の新しい順にする


        if (sError) throw sError;

        // 2. 日付ごとにグループ化（同じ日の4人を1枚のカードへ）
        const sessions = {};
        sessionData.forEach(row => {
            const dateKey = new Date(row.created_at).toLocaleDateString('ja-JP');
            if (!sessions[dateKey]) sessions[dateKey] = [];
            sessions[dateKey].push(row);
        });

        const swiperWrapper = document.getElementById('history-swiper-wrapper');
        const historyList = document.getElementById('history-list');

        Object.keys(sessions).forEach((date, index) => {
            const players = sessions[date].sort((a, b) => a.final_rank - b.final_rank);
            // カード生成 (Sessionデータを使用)
            const cardHtml = createSessionCard(players, date);

            // Swiper（直近5件）
            if (index < 5) {
                const slide = document.createElement('div');
                slide.className = 'swiper-slide';
                slide.innerHTML = cardHtml;
                swiperWrapper.appendChild(slide);
            }
            
            // 下部リスト
            const listItem = document.createElement('div');
            listItem.innerHTML = cardHtml;
            historyList.appendChild(listItem);
        });

        // 3. Swiperの初期化（Coverflowエフェクト）
        new Swiper(".mySwiper", {
            effect: "coverflow",
            grabCursor: true,
            centeredSlides: true,
            slidesPerView: "auto",
            coverflowEffect: {
                rotate: 30,
                stretch: 0,
                depth: 100,
                modifier: 1,
                slideShadows: true,
            },
            pagination: { el: ".swiper-pagination" },
        });

    } catch (e) {
        console.error(e);
    }
}

function createSessionCard(players, date) {
    const winner = players[0];
    // Session ID（または日付等）を元に詳細を呼べるようにする
    const sessionId = players[0].session_id || date;

    return `
        <div class="game-card p-5 mb-4 border-t-2 border-orange-500/50" onclick="showSessionDetail('${sessionId}')">
            <div class="flex justify-between items-center mb-4">
                <div>
                    <span class="text-[10px] text-orange-500 font-black tracking-[0.2em] uppercase">Session Report</span>
                    <h3 class="text-xl font-black italic tracking-tighter">${date}</h3>
                </div>
                <div class="bg-orange-500 text-black px-2 py-1 text-[9px] font-black uppercase italic">Daily Final</div>
            </div>
            
            <div class="grid grid-cols-1 gap-2">
                ${players.map(p => `
                    <div class="flex items-center justify-between bg-white/5 p-2 rounded-sm border border-white/5">
                        <div class="flex items-center space-x-3">
                            <span class="text-lg font-black italic w-6 text-center ${p.final_rank === 1 ? 'text-yellow-400' : 'text-slate-500'}">${p.final_rank}</span>
                            <span class="text-xs font-bold uppercase tracking-tight">${p.player_name}</span>
                        </div>
                        <div class="text-right">
                            <span class="text-[10px] text-slate-500 block leading-none">TOTAL PTS</span>
                            <span class="text-sm font-mono font-black ${p.total_score >= 0 ? 'text-blue-400' : 'text-red-400'}">
                                ${p.total_score > 0 ? '+' : ''}${p.total_score}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
                <span class="text-[9px] text-slate-500 font-bold uppercase">Click to view each matches</span>
                <div class="flex -space-x-2">
                    ${players.map(() => `<div class="w-4 h-4 rounded-full border border-[#070d1c] bg-slate-700"></div>`).join('')}
                </div>
            </div>
        </div>
    `;
}

// 試合詳細表示用関数（Matchデータを引っ張る）
window.showSessionDetail = async function(sessionId) {
    // ここでモーダルを開き、その日の game_results を抽出して表示するロジックを次で作ります
    console.log("Loading Match details for session:", sessionId);
    alert("この日の各半荘データ（Match）を読み込みます。詳細モーダルを構築しますか？");
};

initHistory();
