/**
 * audio.js — 音频管理模块
 * 使用 Web Audio API 生成提示音，无需音频文件
 */

const AudioManager = {
    audioContext: null,
    volume: 0.8,

    /**
     * 初始化 AudioContext（需要在用户交互后调用）
     */
    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    },

    /**
     * 设置音量 0-1
     */
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    },

    /**
     * 播放提示音 — 番茄钟完成
     * 使用多个振荡器叠加，生成响亮清脆的提示音
     */
    playPomodoroComplete() {
        this.init();
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const vol = this.volume;

        // 创建增益节点控制总音量
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(vol * 0.5, now);
        masterGain.connect(ctx.destination);

        // 音符序列：C E G C' （大三和弦上行，清晰悦耳）
        const notes = [
            { freq: 523.25, start: 0, dur: 0.3 },    // C5
            { freq: 659.25, start: 0.15, dur: 0.3 },  // E5
            { freq: 783.99, start: 0.3, dur: 0.3 },   // G5
            { freq: 1046.50, start: 0.45, dur: 0.6 },  // C6（延长）
        ];

        notes.forEach(note => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.freq, now + note.start);

            // 每个音符的包络
            gain.gain.setValueAtTime(0, now + note.start);
            gain.gain.linearRampToValueAtTime(0.6, now + note.start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, now + note.start + note.dur);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(now + note.start);
            osc.stop(now + note.start + note.dur);
        });

        // 添加低音增强
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(261.63, now); // C4
        bassGain.gain.setValueAtTime(0, now);
        bassGain.gain.linearRampToValueAtTime(0.3, now + 0.02);
        bassGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
        bassOsc.connect(bassGain);
        bassGain.connect(masterGain);
        bassOsc.start(now);
        bassOsc.stop(now + 1.0);

        // 第二次重复，稍高
        const notes2 = [
            { freq: 587.33, start: 0.9, dur: 0.25 },  // D5
            { freq: 739.99, start: 1.05, dur: 0.25 },  // F#5
            { freq: 880.00, start: 1.2, dur: 0.25 },   // A5
            { freq: 1174.66, start: 1.35, dur: 0.5 },   // D6
        ];

        notes2.forEach(note => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.freq, now + note.start);

            gain.gain.setValueAtTime(0, now + note.start);
            gain.gain.linearRampToValueAtTime(0.6, now + note.start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, now + note.start + note.dur);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(now + note.start);
            osc.stop(now + note.start + note.dur);
        });
    },

    /**
     * 播放简短提示音 — 计时器完成
     * 三声短促的"滴滴滴"
     */
    playTimerComplete() {
        this.init();
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const vol = this.volume;

        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(vol * 0.5, now);
        masterGain.connect(ctx.destination);

        // 三声急促的滴滴滴
        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const t = now + i * 0.25;

            osc.type = 'square';
            osc.frequency.setValueAtTime(880, t);

            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.4, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(t);
            osc.stop(t + 0.15);
        }
    },

    /**
     * 播放按钮点击音效
     */
    playClick() {
        this.init();
        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.08);
    },

    /**
     * 开始/暂停音效
     */
    playStart() {
        this.init();
        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(660, now + 0.1);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.2);
    },
};
