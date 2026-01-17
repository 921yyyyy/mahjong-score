document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('imageInput');
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const logEl = document.getElementById('debugLog');
    
    // スライダー（HTML側にある前提）
    const adjustY = document.getElementById('adjustY');
    const adjustH = document.getElementById('adjustH');

    let currentImage = null;
    let rotation = 0;
    // 初期値：画面中央付近にデフォルト枠を表示
    let baseGrid = { ox: 50, oy: 150, uw: 300, uh: 400 }; 
    let gridConfig = { ...baseGrid };

    function log(msg) {
        const div = document.createElement('div');
        div.innerText = `> ${msg}`;
        logEl.appendChild(div);
        logEl.scrollTop = logEl.scrollHeight;
    }

    // 1. 画像読み込み（ここを確実に修正）
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (f) => {
            const img = new Image();
            img.onload = () => {
                log("画像読み込み成功");
                currentImage = img;
                // 画像サイズに合わせて初期枠をセット（横幅の70%くらい）
                baseGrid = {
                    ox: img.width * 0.15,
                    oy: img.height * 0.2,
                    uw: img.width * 0.7,
                    uh: img.height * 0.5
                };
                updateGrid();
                draw();
            };
            img.src = f.target.result;
        };
        reader.readAsDataURL(file);
    });

    function updateGrid() {
        const offY = adjustY ? parseInt(adjustY.value) : 0;
        const scaleH = adjustH ? parseFloat(adjustH.value) : 1.0;
        gridConfig.ox = baseGrid.ox;
        gridConfig.uw = baseGrid.uw;
        gridConfig.oy = baseGrid.oy + offY;
        gridConfig.uh = baseGrid.uh * scaleH;
    }

    function draw() {
        if (!currentImage) return;
        // 回転を考慮したサイズ設定
        const is90 = rotation === 90 || rotation === 270;
        canvas.width = is90 ? currentImage.height : currentImage.width;
        canvas.height = is90 ? currentImage.width : currentImage.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(currentImage, -currentImage.width / 2, -currentImage.height / 2);
        ctx.restore();

        // 赤枠とグリッド描画
        ctx.strokeStyle = "red";
        ctx.lineWidth = canvas.width / 100;
        ctx.strokeRect(gridConfig.ox, gridConfig.oy, gridConfig.uw, gridConfig.uh);

        // 横線（8行分）
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,0,0,0.5)";
        for(let i=1; i<8; i++) {
            let y = gridConfig.oy + (gridConfig.uh/8)*i;
            ctx.beginPath(); ctx.moveTo(gridConfig.ox, y); ctx.lineTo(gridConfig.ox + gridConfig.uw, y); ctx.stroke();
        }
    }

    if(adjustY) adjustY.oninput = () => { updateGrid(); draw(); };
    if(adjustH) adjustH.oninput = () => { updateGrid(); draw(); };

    document.getElementById('rotateBtn').onclick = () => {
        rotation = (rotation + 90) % 360;
        draw();
    };

    // 2. 解析実行（スライダーで合わせた位置を信じる）
    document.getElementById('analyzeBtn').onclick = async () => {
        if (!currentImage) return;
        log("スキャン開始...");
        const worker = await Tesseract.createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        await worker.setParameters({ tessedit_char_whitelist: '0123456789' });

        const inputs = document.querySelectorAll('#scoreRows input');
        const cellW = gridConfig.uw / 8;
        const cellH = gridConfig.uh / 8;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = 64; tempCanvas.height = 64;
                const tCtx = tempCanvas.getContext('2d');
                tCtx.drawImage(canvas, gridConfig.ox + (c * cellW), gridConfig.oy + (r * cellH), cellW, cellH, 0, 0, 64, 64);
                
                const { data: { text } } = await worker.recognize(tempCanvas);
                const val = text.replace(/[^0-9]/g, '');
                inputs[r * 8 + c].value = val;
            }
            log(`${r+1}行目完了...`);
        }
        log("✅ 全工程完了");
        await worker.terminate();
    };
});
