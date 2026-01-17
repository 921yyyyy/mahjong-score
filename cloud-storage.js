console.log("Cloud logic version 1.1 loaded");

// --- Supabase設定 (ご自身のものに書き換えてください) ---
const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('saveData'); // 1の状態にあるボタン
    const modal = document.getElementById('cloudModal');
    const playerInputsArea = document.getElementById('playerInputs');
    const submitBtn = document.getElementById('dbSubmitBtn');

    // 1. 保存ボタンが押されたら名前入力画面を出す
    saveBtn.onclick = () => {
        playerInputsArea.innerHTML = '';
        ['A', 'B', 'C', 'D'].forEach(p => {
            playerInputsArea.innerHTML += `
                <div>
                    <label class="text-[10px] text-slate-400 font-bold ml-1">${p}さんの名前</label>
                    <input type="text" class="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white text-sm" 
                           placeholder="名前を入力" list="playerHistory">
                </div>`;
        });
        modal.style.display = 'flex';
        loadSuggestions();
    };

    // 2. 既存プレイヤーを検索して補完リストに表示
    async function loadSuggestions() {
        const { data } = await supabase.from('players').select('name');
        if (data) {
            const list = document.getElementById('playerHistory');
            list.innerHTML = data.map(p => `<option value="${p.name}">`).join('');
        }
    }

    // 3. 実際にDBへ飛ばす
    submitBtn.onclick = async () => {
        submitBtn.disabled = true;
        submitBtn.innerText = "保存中...";

        const nameInputs = playerInputsArea.querySelectorAll('input');
        const names = Array.from(nameInputs).map(i => i.value || '未設定');
        
        // 1の状態の入力欄から数値をひろい集める
        const scoreInputs = document.querySelectorAll('#gridBody input');
        const rawNumbers = Array.from(scoreInputs).map(i => parseInt(i.value) || 0);
        
        // 合計の計算
        const totals = [0, 1, 2, 3].map(p => {
            let sum = 0;
            for(let r=0; r<8; r++) sum += (rawNumbers[r*8 + p*2] - rawNumbers[r*8 + p*2 + 1]);
            return sum;
        });

        try {
            // プレイヤー登録（ハイブリッド方式：新しい名前なら追加、既存なら更新）
            for (const name of names) {
                if (name !== '未設定') {
                    await supabase.from('players').upsert({ name: name }, { onConflict: 'name' });
                }
            }

            // ゲーム結果（スコアボード単位）の保存
            const { error } = await supabase.from('games').insert({
                player_names: names,
                scores: totals,
                raw_data: { grid: rawNumbers }
            });

            if (error) throw error;
            alert("クラウド保存に成功しました！");
            modal.style.display = 'none';
        } catch (err) {
            alert("エラー: " + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "DBに保存";
        }
    };
});
