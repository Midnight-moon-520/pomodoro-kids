/**
 * app.js — 番茄钟主应用逻辑
 * 番茄钟模式、计时器模式、UI 交互、庆祝动画
 */

const App = {
    // --- 状态 ---
    state: {
        // 番茄钟
        pomodoroMode: 'focus',         // 'focus' | 'break'
        pomodoroSeconds: 25 * 60,      // 剩余秒数
        pomodoroTotal: 25 * 60,        // 总秒数
        pomodoroRunning: false,
        pomodoroInterval: null,

        // 计时器
        timerSeconds: 5 * 60,          // 设定秒数
        timerRemaining: 5 * 60,        // 剩余秒数
        timerRunning: false,
        timerInterval: null,

        // 设置
        settings: {},

        // 当前页面
        currentPage: 'pagePomodoro',
    },

    // --- 初始化 ---
    init() {
        this.state.settings = StorageManager.getSettings();
        this.applyTheme(this.state.settings.theme);
        this.applySettings();
        this.updateStreakDisplay();
        this.updateTodayStats();
        this.updatePomodoroDisplay();
        this.updateTimerDisplay();
        this.bindEvents();
        this.initPWA();

        // 恢复 AudioContext（iOS 限制）
        document.addEventListener('click', () => AudioManager.init(), { once: true });
        document.addEventListener('touchstart', () => AudioManager.init(), { once: true });
    },

    // --- 事件绑定 ---
    bindEvents() {
        // 底部导航
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchPage(btn.dataset.page));
        });

        // 番茄钟模式切换
        document.getElementById('modeFocus').addEventListener('click', () => this.switchMode('focus'));
        document.getElementById('modeBreak').addEventListener('click', () => this.switchMode('break'));

        // 番茄钟控制
        document.getElementById('btnStartPause').addEventListener('click', () => this.togglePomodoro());
        document.getElementById('btnReset').addEventListener('click', () => this.resetPomodoro());

        // 计时器时间调整
        document.querySelectorAll('.time-adjust').forEach(btn => {
            btn.addEventListener('click', () => this.adjustTimer(btn.dataset.target, btn.dataset.action));
        });

        // 计时器模板
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setTimerPreset(
                parseInt(btn.dataset.min),
                parseInt(btn.dataset.sec)
            ));
        });

        // 计时器控制
        document.getElementById('btnTimerStart').addEventListener('click', () => this.toggleTimer());
        document.getElementById('btnTimerReset').addEventListener('click', () => this.resetTimer());

        // 主题切换
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // 设置弹窗
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        document.getElementById('closeSettings').addEventListener('click', () => this.closeSettings());
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('settingsModal')) {
                this.closeSettings();
            }
        });

        // 设置项变化
        document.getElementById('settingFocusTime').addEventListener('input', (e) => {
            document.getElementById('settingFocusValue').textContent = e.target.value;
        });
        document.getElementById('settingBreakTime').addEventListener('input', (e) => {
            document.getElementById('settingBreakValue').textContent = e.target.value;
        });
        document.getElementById('settingVolume').addEventListener('input', (e) => {
            document.getElementById('settingVolumeValue').textContent = e.target.value + '%';
        });

        // 关闭设置时保存
        document.getElementById('closeSettings').addEventListener('click', () => {
            this.saveSettings();
        });

        // 清除记录
        document.getElementById('btnClearRecords').addEventListener('click', () => {
            if (confirm('确定要清除所有学习记录吗？这个操作不能撤销哦！')) {
                StorageManager.clearAll();
                this.updateRecordsPage();
                this.updateStreakDisplay();
                this.updateTodayStats();
            }
        });

        // 庆祝动画关闭
        document.getElementById('celebrationDismiss').addEventListener('click', () => {
            this.hideCelebration();
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault();
                if (this.state.currentPage === 'pagePomodoro') {
                    this.togglePomodoro();
                } else if (this.state.currentPage === 'pageTimer') {
                    this.toggleTimer();
                }
            }
        });

        // 页面可见性变化时处理
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // 页面隐藏时记录时间戳用于后台计时
                this._backgroundTimestamp = Date.now();
            } else {
                // 页面恢复时补偿时间
                if (this._backgroundTimestamp && this.state.pomodoroRunning) {
                    const elapsed = Math.floor((Date.now() - this._backgroundTimestamp) / 1000);
                    if (elapsed > 0 && elapsed < 3600) { // 忽略超过1小时的差距
                        this.state.pomodoroSeconds = Math.max(0, this.state.pomodoroSeconds - elapsed);
                        this.updatePomodoroDisplay();
                        if (this.state.pomodoroSeconds <= 0) {
                            this.completePomodoro();
                        }
                    }
                }
                if (this._backgroundTimestamp && this.state.timerRunning) {
                    const elapsed = Math.floor((Date.now() - this._backgroundTimestamp) / 1000);
                    if (elapsed > 0 && elapsed < 3600) {
                        this.state.timerRemaining = Math.max(0, this.state.timerRemaining - elapsed);
                        this.updateTimerDisplay();
                        if (this.state.timerRemaining <= 0) {
                            this.completeTimer();
                        }
                    }
                }
                this._backgroundTimestamp = null;
            }
        });
    },

    // ============================================================
    //  番茄钟逻辑
    // ============================================================

    switchMode(mode) {
        if (this.state.pomodoroRunning) {
            if (!confirm('切换模式会重置当前计时，确定要切换吗？')) return;
            this.stopPomodoro();
        }

        this.state.pomodoroMode = mode;
        this.resetPomodoro();

        // 更新模式按钮
        document.getElementById('modeFocus').classList.toggle('active', mode === 'focus');
        document.getElementById('modeBreak').classList.toggle('active', mode === 'break');

        // 更新进度环颜色
        const ringContainer = document.querySelector('.timer-ring-container');
        ringContainer.classList.toggle('break-mode', mode === 'break');

        // 更新开始按钮颜色（学习=橙色，休息=绿色）
        const startBtn = document.getElementById('btnStartPause');
        if (mode === 'break') {
            startBtn.style.background = 'var(--color-break)';
            startBtn.style.boxShadow = '0 4px 12px rgba(102, 187, 106, 0.35)';
        } else {
            startBtn.style.background = 'var(--color-focus)';
            startBtn.style.boxShadow = '0 4px 12px rgba(255, 140, 66, 0.35)';
        }
    },

    togglePomodoro() {
        AudioManager.init();
        if (this.state.pomodoroRunning) {
            this.pausePomodoro();
        } else {
            this.startPomodoro();
        }
    },

    startPomodoro() {
        if (this.state.pomodoroSeconds <= 0) {
            this.resetPomodoro();
        }

        this.state.pomodoroRunning = true;

        const btn = document.getElementById('btnStartPause');
        btn.querySelector('.btn-icon').textContent = '⏸️';
        btn.querySelector('.btn-text').textContent = '暂停';

        AudioManager.playStart();

        this.state.pomodoroInterval = setInterval(() => {
            this.state.pomodoroSeconds--;
            this.updatePomodoroDisplay();

            if (this.state.pomodoroSeconds <= 0) {
                this.completePomodoro();
            }
        }, 1000);
    },

    pausePomodoro() {
        this.stopPomodoro(false);
        const btn = document.getElementById('btnStartPause');
        btn.querySelector('.btn-icon').textContent = '▶️';
        btn.querySelector('.btn-text').textContent = '继续';
    },

    stopPomodoro(resetRunning = true) {
        if (this.state.pomodoroInterval) {
            clearInterval(this.state.pomodoroInterval);
            this.state.pomodoroInterval = null;
        }
        if (resetRunning) {
            this.state.pomodoroRunning = false;
        }
    },

    resetPomodoro() {
        this.stopPomodoro();
        const btn = document.getElementById('btnStartPause');
        btn.querySelector('.btn-icon').textContent = '▶️';
        btn.querySelector('.btn-text').textContent = '开始';

        const totalSeconds = this.state.pomodoroMode === 'focus'
            ? this.state.settings.focusTime * 60
            : this.state.settings.breakTime * 60;

        this.state.pomodoroSeconds = totalSeconds;
        this.state.pomodoroTotal = totalSeconds;
        this.updatePomodoroDisplay();
    },

    completePomodoro() {
        this.stopPomodoro();

        const btn = document.getElementById('btnStartPause');
        btn.querySelector('.btn-icon').textContent = '▶️';
        btn.querySelector('.btn-text').textContent = '开始';

        // 播放提示音
        AudioManager.playPomodoroComplete();

        // 振动
        if (this.state.settings.vibrate && navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 400]);
        }

        // 记录完成
        if (this.state.pomodoroMode === 'focus') {
            const minutes = Math.round(this.state.pomodoroTotal / 60);
            StorageManager.addPomodoro(minutes);
            this.updateTodayStats();
            this.updateStreakDisplay();
            this.showCelebration();
        }

        // 重置计时
        const totalSeconds = this.state.pomodoroMode === 'focus'
            ? this.state.settings.focusTime * 60
            : this.state.settings.breakTime * 60;
        this.state.pomodoroSeconds = totalSeconds;
        this.state.pomodoroTotal = totalSeconds;
        this.updatePomodoroDisplay();

        // 更新记录页面（如果之前打开过）
        if (this.state.currentPage === 'pageRecords') {
            this.updateRecordsPage();
        }
    },

    updatePomodoroDisplay() {
        const total = this.state.pomodoroTotal;
        const remaining = this.state.pomodoroSeconds;
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;

        document.getElementById('pomodoroMinutes').textContent = String(minutes).padStart(2, '0');
        document.getElementById('pomodoroSeconds').textContent = String(seconds).padStart(2, '0');

        // 更新进度环
        const circumference = 2 * Math.PI * 90; // ≈565.49
        const progress = total > 0 ? remaining / total : 1;
        const offset = circumference * (1 - progress);
        document.getElementById('timerRingProgress').style.strokeDashoffset = offset;

        // 更新页面标题
        const displayMin = String(minutes).padStart(2, '0');
        const displaySec = String(seconds).padStart(2, '0');
        const modeLabel = this.state.pomodoroMode === 'focus' ? '📖' : '☕';
        document.title = `${modeLabel} ${displayMin}:${displaySec} - 番茄钟`;
    },

    // ============================================================
    //  计时器逻辑
    // ============================================================

    adjustTimer(target, action) {
        if (this.state.timerRunning) return;

        if (target === 'timerMin') {
            let val = Math.floor(this.state.timerSeconds / 60);
            val += action === 'up' ? 1 : -1;
            val = Math.max(0, Math.min(99, val));
            const sec = this.state.timerSeconds % 60;
            this.state.timerSeconds = val * 60 + sec;
        } else if (target === 'timerSec') {
            let val = this.state.timerSeconds % 60;
            val += action === 'up' ? 5 : -5;
            val = Math.max(0, Math.min(55, val));
            const min = Math.floor(this.state.timerSeconds / 60);
            this.state.timerSeconds = min * 60 + val;
        }

        // 确保最小1秒
        if (this.state.timerSeconds < 1) this.state.timerSeconds = 1;

        this.state.timerRemaining = this.state.timerSeconds;
        this.updateTimerDisplay();
        this.updatePresetSelection();
    },

    setTimerPreset(min, sec) {
        if (this.state.timerRunning) {
            this.stopTimer();
            this.resetTimer();
        }
        this.state.timerSeconds = min * 60 + sec;
        this.state.timerRemaining = this.state.timerSeconds;
        this.updateTimerDisplay();
        this.updatePresetSelection();

        const btn = document.getElementById('btnTimerStart');
        btn.querySelector('.btn-icon').textContent = '▶️';
        btn.querySelector('.btn-text').textContent = '开始计时';
    },

    updatePresetSelection() {
        document.querySelectorAll('.preset-btn').forEach(btn => {
            const pMin = parseInt(btn.dataset.min);
            const pSec = parseInt(btn.dataset.sec);
            const isMatch = (pMin * 60 + pSec) === this.state.timerSeconds;
            btn.classList.toggle('selected', isMatch);
        });
    },

    toggleTimer() {
        AudioManager.init();
        if (this.state.timerRunning) {
            this.pauseTimer();
        } else {
            this.startTimer();
        }
    },

    startTimer() {
        if (this.state.timerRemaining <= 0) {
            this.resetTimer();
        }

        this.state.timerRunning = true;

        const btn = document.getElementById('btnTimerStart');
        btn.querySelector('.btn-icon').textContent = '⏸️';
        btn.querySelector('.btn-text').textContent = '暂停';

        AudioManager.playStart();

        this.state.timerInterval = setInterval(() => {
            this.state.timerRemaining--;
            this.updateTimerDisplay();

            if (this.state.timerRemaining <= 0) {
                this.completeTimer();
            }
        }, 1000);
    },

    pauseTimer() {
        this.stopTimer(false);
        const btn = document.getElementById('btnTimerStart');
        btn.querySelector('.btn-icon').textContent = '▶️';
        btn.querySelector('.btn-text').textContent = '继续';
    },

    stopTimer(resetRunning = true) {
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
            this.state.timerInterval = null;
        }
        if (resetRunning) {
            this.state.timerRunning = false;
        }
    },

    resetTimer() {
        this.stopTimer();
        const btn = document.getElementById('btnTimerStart');
        btn.querySelector('.btn-icon').textContent = '▶️';
        btn.querySelector('.btn-text').textContent = '开始计时';
        this.state.timerRemaining = this.state.timerSeconds;
        this.updateTimerDisplay();
    },

    completeTimer() {
        this.stopTimer();

        const btn = document.getElementById('btnTimerStart');
        btn.querySelector('.btn-icon').textContent = '▶️';
        btn.querySelector('.btn-text').textContent = '开始计时';

        AudioManager.playTimerComplete();

        if (this.state.settings.vibrate && navigator.vibrate) {
            navigator.vibrate([300, 100, 300]);
        }

        this.state.timerRemaining = this.state.timerSeconds;
        this.updateTimerDisplay();
    },

    updateTimerDisplay() {
        const total = this.state.timerSeconds;
        const remaining = this.state.timerRunning ? this.state.timerRemaining : this.state.timerSeconds;

        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        document.getElementById('timerMinDisplay').textContent = String(minutes).padStart(2, '0');
        document.getElementById('timerSecDisplay').textContent = String(seconds).padStart(2, '0');

        const cdMin = Math.floor(remaining / 60);
        const cdSec = remaining % 60;
        document.getElementById('timerCDMinutes').textContent = String(cdMin).padStart(2, '0');
        document.getElementById('timerCDSeconds').textContent = String(cdSec).padStart(2, '0');
    },

    // ============================================================
    //  页面导航
    // ============================================================

    switchPage(pageId) {
        // 隐藏所有页面
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        // 显示目标页面
        document.getElementById(pageId).classList.add('active');

        // 更新导航
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === pageId);
        });

        this.state.currentPage = pageId;

        // 更新记录页面
        if (pageId === 'pageRecords') {
            this.updateRecordsPage();
        }
    },

    // ============================================================
    //  学习记录
    // ============================================================

    updateTodayStats() {
        document.getElementById('todayPomodoros').textContent = StorageManager.getTodayPomodoros();
        document.getElementById('todayMinutes').textContent = StorageManager.getTodayMinutes();
    },

    updateStreakDisplay() {
        const streak = StorageManager.getStreak();
        document.getElementById('streakDays').textContent = streak;

        const total = StorageManager.getTotalPomodoros();
        const level = StorageManager.getLevel(total);
        document.getElementById('levelBadge').textContent = `${level.emoji} ${level.name}`;
    },

    updateRecordsPage() {
        const today = StorageManager.getTodayPomodoros();
        const total = StorageManager.getTotalPomodoros();
        const streak = StorageManager.getStreak();
        const level = StorageManager.getLevel(total);

        document.getElementById('recordTodayPomodoros').textContent = today;
        document.getElementById('recordTotalPomodoros').textContent = total;
        document.getElementById('recordStreakDays').textContent = streak;
        document.getElementById('recordLevel').textContent = `${level.emoji} ${level.name}`;

        // 热力图
        this.renderHeatmap();

        // 记录列表
        this.renderRecordsList();
    },

    renderHeatmap() {
        const weekData = StorageManager.getWeekData();
        const grid = document.getElementById('heatmapGrid');
        grid.innerHTML = '';

        const maxPomodoros = Math.max(...weekData.map(d => d.pomodoros), 1);

        weekData.forEach(day => {
            const div = document.createElement('div');
            div.className = 'heatmap-day';

            const label = document.createElement('span');
            label.className = 'heatmap-label';
            label.textContent = day.dayName;

            const block = document.createElement('div');
            block.className = 'heatmap-block';
            if (day.isToday) block.classList.add('today');

            // 根据番茄数确定等级
            if (day.pomodoros > 0) {
                const ratio = day.pomodoros / maxPomodoros;
                if (ratio <= 0.25) block.classList.add('level-1');
                else if (ratio <= 0.5) block.classList.add('level-2');
                else if (ratio <= 0.75) block.classList.add('level-3');
                else block.classList.add('level-4');
            }

            const count = document.createElement('span');
            count.className = 'heatmap-count';
            count.textContent = day.pomodoros;

            div.appendChild(label);
            div.appendChild(block);
            div.appendChild(count);
            grid.appendChild(div);
        });
    },

    renderRecordsList() {
        const records = StorageManager.getRecentRecords(14);
        const list = document.getElementById('recordsList');

        if (records.length === 0) {
            list.innerHTML = '<p class="records-empty">还没有学习记录哦，加油！💪</p>';
            return;
        }

        list.innerHTML = records.map(r => {
            const d = new Date(r.date + 'T00:00:00');
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            const weekday = weekdays[d.getDay()];
            const dateDisplay = `${r.date} (周${weekday})`;

            return `
                <div class="record-item">
                    <span class="record-date">${dateDisplay}</span>
                    <div class="record-detail">
                        <span>🍅 ×</span>
                        <span class="record-pomodoros">${r.pomodoros}</span>
                        <span>| ⏱️ ${r.minutes}分钟</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    // ============================================================
    //  庆祝动画
    // ============================================================

    showCelebration() {
        const overlay = document.getElementById('celebrationOverlay');
        const emoji = document.getElementById('celebrationEmoji');
        const text = document.getElementById('celebrationText');
        const sub = document.getElementById('celebrationSub');

        // 随机鼓励语
        const encouragements = [
            { emoji: '🎉', text: '太棒了！', sub: '你完成了一个番茄钟！' },
            { emoji: '🌟', text: '真厉害！', sub: '继续保持这个状态！' },
            { emoji: '💪', text: '了不起！', sub: '专注的你最帅！' },
            { emoji: '🏆', text: '冠军！', sub: '又一个番茄钟完成啦！' },
            { emoji: '⭐', text: '超赞！', sub: '努力学习的小天才！' },
            { emoji: '🚀', text: '飞起来了！', sub: '学习就像坐火箭！' },
        ];

        const pick = encouragements[Math.floor(Math.random() * encouragements.length)];
        emoji.textContent = pick.emoji;
        text.textContent = pick.text;
        sub.textContent = pick.sub;

        overlay.classList.add('show');
        this.createConfetti();
    },

    hideCelebration() {
        document.getElementById('celebrationOverlay').classList.remove('show');
        document.getElementById('confettiContainer').innerHTML = '';
    },

    createConfetti() {
        const container = document.getElementById('confettiContainer');
        container.innerHTML = '';

        const colors = [
            '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF',
            '#FF8C42', '#9B59B6', '#1ABC9C', '#E74C3C',
            '#3498DB', '#F39C12', '#2ECC71', '#E91E63',
        ];

        const shapes = ['square', 'circle'];

        for (let i = 0; i < 80; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';

            const color = colors[Math.floor(Math.random() * colors.length)];
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            const left = Math.random() * 100;
            const size = 6 + Math.random() * 14;
            const duration = 1.5 + Math.random() * 2.5;
            const delay = Math.random() * 0.8;

            piece.style.cssText = `
                left: ${left}%;
                top: -20px;
                width: ${size}px;
                height: ${shape === 'circle' ? size : size * 1.5}px;
                background: ${color};
                border-radius: ${shape === 'circle' ? '50%' : '3px'};
                animation: confettiFall ${duration}s ${delay}s linear forwards;
            `;

            container.appendChild(piece);
        }
    },

    // ============================================================
    //  主题切换
    // ============================================================

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        this.applyTheme(next);
        this.state.settings.theme = next;
        this.saveSettings();
    },

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = document.querySelector('#themeToggle .icon');
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';

        // 更新 theme-color meta
        const meta = document.querySelector('meta[name="theme-color"]');
        meta.content = theme === 'dark' ? '#1A1D2E' : '#4A90D9';

        // 更新状态栏样式
        const statusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
        statusBar.content = theme === 'dark' ? 'black-translucent' : 'default';
    },

    // ============================================================
    //  设置
    // ============================================================

    openSettings() {
        const s = this.state.settings;
        document.getElementById('settingFocusTime').value = s.focusTime;
        document.getElementById('settingFocusValue').textContent = s.focusTime;
        document.getElementById('settingBreakTime').value = s.breakTime;
        document.getElementById('settingBreakValue').textContent = s.breakTime;
        document.getElementById('settingVolume').value = s.volume;
        document.getElementById('settingVolumeValue').textContent = s.volume + '%';
        document.getElementById('settingVibrate').checked = s.vibrate;

        document.getElementById('settingsModal').classList.add('show');
    },

    closeSettings() {
        document.getElementById('settingsModal').classList.remove('show');
    },

    saveSettings() {
        const settings = {
            focusTime: parseInt(document.getElementById('settingFocusTime').value),
            breakTime: parseInt(document.getElementById('settingBreakTime').value),
            volume: parseInt(document.getElementById('settingVolume').value),
            vibrate: document.getElementById('settingVibrate').checked,
            theme: this.state.settings.theme,
        };

        this.state.settings = settings;
        StorageManager.setSettings(settings);

        AudioManager.setVolume(settings.volume / 100);

        // 如果番茄钟未运行，重置时间
        if (!this.state.pomodoroRunning) {
            const totalSeconds = this.state.pomodoroMode === 'focus'
                ? settings.focusTime * 60
                : settings.breakTime * 60;
            this.state.pomodoroSeconds = totalSeconds;
            this.state.pomodoroTotal = totalSeconds;
            this.updatePomodoroDisplay();
        }
    },

    applySettings() {
        const s = this.state.settings;
        const totalSeconds = s.focusTime * 60;
        this.state.pomodoroSeconds = totalSeconds;
        this.state.pomodoroTotal = totalSeconds;
        AudioManager.setVolume(s.volume / 100);
        this.updatePomodoroDisplay();
    },

    // ============================================================
    //  PWA 安装
    // ============================================================

    initPWA() {
        // 注册 Service Worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').then(reg => {
                    console.log('SW registered:', reg.scope);
                }).catch(err => {
                    console.log('SW registration failed:', err);
                });
            });
        }

        // 安装提示
        let deferredPrompt;
        const installBanner = document.getElementById('installBanner');
        const installBtn = document.getElementById('installBtn');
        const installClose = document.getElementById('installClose');

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;

            // 显示安装横幅（延迟一点避免太突兀）
            setTimeout(() => {
                installBanner.classList.add('show');
            }, 2000);
        });

        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log('Install outcome:', outcome);
                deferredPrompt = null;
            }
            installBanner.classList.remove('show');
        });

        installClose.addEventListener('click', () => {
            installBanner.classList.remove('show');
        });

        // 已安装则隐藏横幅
        window.addEventListener('appinstalled', () => {
            installBanner.classList.remove('show');
            console.log('App installed!');
        });

        // iOS Safari 检测 — 提示用户如何安装
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
            navigator.standalone;

        if (isIOS && !isStandalone && !deferredPrompt) {
            // iOS 上无法自动触发安装提示，显示手动提示
            setTimeout(() => {
                installBanner.querySelector('span').textContent =
                    '📲 点击分享按钮 → 添加到主屏幕';
                installBanner.querySelector('.install-btn').style.display = 'none';
                installBanner.classList.add('show');
            }, 3000);
        }
    },
};

// --- 启动应用 ---
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
