// 全ての処理を DOMContentLoaded 内に収めて紐付けミスを防ぐ
document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('imageInput');
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const logEl = document.getElementById('debugLog');
    const scoreRows = document.getElementById('scoreRows');
    
    let currentImage = null;
    let rotation = 0;

    function log(msg) {
        const div = document.createElement('div');
        div.innerText = `> ${new Date().toLocaleTimeString()}: ${msg}`;
        logEl.appendChild(div);
        logEl.scrollTop = logEl.scrollHeight;
        console.log(msg);
    }

    log("JavaScript 読み込み完了。待機中...");

    // 1. 画像読み込み処理
    imageInput.addEventListener('change', (e) => {
        log("ファイル選択を検知しました");
        const file = e.target.files[0];
        if (!file) return;

        log(`読込中: ${file.name}`);
        const reader = new FileReader();
        reader.onload = (f) => {
            const img = new Image();
            img.onload = () => {
                log(`画像展開成功: ${img.width}x${img.height}`);
                currentImage = img;
                rotation = 0;
                drawPreview();
            };
            img.src = f.target.result;
        };
        reader.readAsDataURL(file);
    });

    // 2. プレビュー描画処理
    function drawPreview() {
        if (!currentImage) return;
        const is90 = rotation === 90 || rotation === 270;
        canvas.width = is90 ? currentImage.height : currentImage.width;
        canvas.height = is90 ? currentImage.width : currentImage.height;
        
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(currentImage, -currentImage.width / 2, -currentImage.height / 2);
        ctx.restore();
        log("キャンバスに描画しました");
    }

    // 3. 回転ボタン
    document.getElementById('rotateBtn').onclick = () => {
        if (!currentImage) return log("画像がありません");
        rotation = (rotation + 90) % 360;
        drawPreview();
    };

    // 4. 解析開始ボタン
    document.getElementById('analyzeBtn').onclick = async () => {
        if (!currentImage) return log("エラー: 画像がありません");
        log("解析エンジンを起動します...");
        // ここに解析ロジック（前回の startAnalysis 内容）が入ります
        // まずは画像が出るか確認するため簡易ログのみ
        log("Tesseract 準備中...");
        try {
            const worker = await Tesseract.createWorker();
            await worker.loadLanguage('eng');
            await worker.initialize('eng');
            log("準備完了。位置特定を開始...");
            // ... 解析処理 ...
            await worker.terminate();
        } catch (e) {
            log("解析エラー: " + e.message);
        }
    };

    // 5. スコア行の生成
    for (let i = 1; i <= 8; i++) {
        const row = document.createElement('div');
        row.className = 'flex items-center border-b border-gray-100 py-1 text-center';
        row.innerHTML = `
            <div class="w-8 text-[10px] text-gray-400">${i}</div>
            <div class="flex-1 grid grid-cols-4 gap-1 px-1">
                <input type="number" class="w-full text-center text-sm p-2 bg-blue-50 rounded" placeholder="0">
                <input type="number" class="w-full text-center text-sm p-2 bg-blue-50 rounded" placeholder="0">
                <input type="number" class="w-full text-center text-sm p-2 bg-blue-50 rounded" placeholder="0">
                <input type="number" class="w-full text-center text-sm p-2 bg-blue-50 rounded" placeholder="0">
            </div>
        `;
        scoreRows.appendChild(row);
    }
    log("スコア入力欄を生成しました");
});
