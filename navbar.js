(function() {
    // 1. アイコンフォントの読み込み
    const iconLink = document.createElement('link');
    iconLink.href = 'https://fonts.googleapis.com/icon?family=Material+Icons+Round';
    iconLink.rel = 'stylesheet';
    document.head.appendChild(iconLink);

    // 2. スタイルの注入（MLB公式アプリを意識した濃紺とネオンオレンジ）
    const style = document.createElement('style');
    style.innerHTML = `
        .mlb-navbar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 70px;
            background: rgba(7, 13, 28, 0.98); /* 深いネイビー */
            backdrop-filter: blur(15px);
            border-top: 1px solid rgba(249, 115, 22, 0.4);
            display: flex;
            justify-content: space-around;
            align-items: center;
            z-index: 10000;
            padding-bottom: env(safe-area-inset-bottom);
            box-shadow: 0 -10px 25px rgba(0,0,0,0.5);
        }
        .nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-decoration: none;
            color: #475569; /* 未選択は落ち着いたグレー */
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            width: 33%;
            position: relative;
        }
        .nav-item.active {
            color: #f97316; /* 選択時は鮮やかなオレンジ */
        }
        .nav-item.active::after {
            content: '';
            position: absolute;
            top: -12px;
            width: 20px;
            height: 3px;
            background: #f97316;
            border-radius: 0 0 4px 4px;
            box-shadow: 0 2px 10px rgba(249, 115, 22, 0.8);
        }
        .material-icons-round {
            font-size: 26px;
            margin-bottom: 2px;
        }
        .nav-label {
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            font-family: 'Inter', sans-serif;
        }
    `;
    document.head.appendChild(style);

    // 3. ナビゲーションHTML
    const nav = document.createElement('nav');
    nav.className = 'mlb-navbar';
    
    const path = window.location.pathname;
    const currentPage = path.split('/').pop() || 'index.html';

    const menuItems = [
        { name: 'Scan', icon: 'shutter_speed', file: 'index.html' },
        { name: 'Stats', icon: 'leaderboard', file: 'stats.html' },
        { name: 'History', icon: 'history', file: 'history.html' }
    ];

    nav.innerHTML = menuItems.map(item => `
        <a href="${item.file}" class="nav-item ${currentPage === item.file ? 'active' : ''}">
            <span class="material-icons-round">${item.icon}</span>
            <span class="nav-label">${item.name}</span>
        </a>
    `).join('');

    document.body.appendChild(nav);
    document.body.style.paddingBottom = '90px';
})();
