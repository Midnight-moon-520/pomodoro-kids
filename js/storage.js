/**
 * storage.js — 数据持久化管理模块
 * 使用 LocalStorage 存储学习记录和设置
 */

const StorageManager = {
    KEYS: {
        RECORDS: 'pomodoro_records',
        SETTINGS: 'pomodoro_settings',
        STREAK: 'pomodoro_streak',
    },

    /**
     * 获取所有学习记录
     * @returns {Object} { 'YYYY-MM-DD': { pomodoros: number, minutes: number } }
     */
    getRecords() {
        try {
            const data = localStorage.getItem(this.KEYS.RECORDS);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Failed to read records:', e);
            return {};
        }
    },

    /**
     * 保存学习记录
     * @param {Object} records
     */
    setRecords(records) {
        try {
            localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(records));
        } catch (e) {
            console.error('Failed to save records:', e);
        }
    },

    /**
     * 记录完成一个番茄钟
     * @param {number} minutes — 此次番茄钟的时长（分钟）
     */
    addPomodoro(minutes) {
        const today = this.getDateKey();
        const records = this.getRecords();

        if (!records[today]) {
            records[today] = { pomodoros: 0, minutes: 0 };
        }

        records[today].pomodoros += 1;
        records[today].minutes += minutes;

        // 保留最近90天的记录
        const keys = Object.keys(records).sort();
        while (keys.length > 90) {
            delete records[keys.shift()];
        }

        this.setRecords(records);
        this.updateStreak();
    },

    /**
     * 获取今日番茄数
     */
    getTodayPomodoros() {
        const records = this.getRecords();
        const today = this.getDateKey();
        return records[today] ? records[today].pomodoros : 0;
    },

    /**
     * 获取今日学习分钟数
     */
    getTodayMinutes() {
        const records = this.getRecords();
        const today = this.getDateKey();
        return records[today] ? records[today].minutes : 0;
    },

    /**
     * 获取总番茄数
     */
    getTotalPomodoros() {
        const records = this.getRecords();
        return Object.values(records).reduce((sum, day) => sum + day.pomodoros, 0);
    },

    /**
     * 获取总学习分钟数
     */
    getTotalMinutes() {
        const records = this.getRecords();
        return Object.values(records).reduce((sum, day) => sum + day.minutes, 0);
    },

    /**
     * 更新连续学习天数
     */
    updateStreak() {
        const records = this.getRecords();
        const dates = Object.keys(records).filter(date => {
            return records[date].pomodoros > 0;
        }).sort().reverse();

        if (dates.length === 0) {
            this.setStreak(0);
            return;
        }

        const today = this.getDateKey();
        const yesterday = this.getDateKey(-1);

        // 最近学习日必须是今天或昨天才能连续
        const latest = dates[0];
        if (latest !== today && latest !== yesterday) {
            this.setStreak(0);
            return;
        }

        // 从最近学习日开始往前数
        let streak = 0;
        let currentDate = new Date(latest + 'T00:00:00');

        for (const dateStr of dates) {
            const checkDate = new Date(dateStr + 'T00:00:00');
            const diffDays = Math.round((currentDate - checkDate) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else if (diffDays === 1) {
                streak++;
                currentDate = checkDate;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }

        this.setStreak(streak);
    },

    /**
     * 获取连续天数
     */
    getStreak() {
        try {
            const data = localStorage.getItem(this.KEYS.STREAK);
            return data ? parseInt(data, 10) : 0;
        } catch (e) {
            return 0;
        }
    },

    /**
     * 设置连续天数
     */
    setStreak(days) {
        localStorage.setItem(this.KEYS.STREAK, days.toString());
    },

    /**
     * 获取本周每天的数据（用于热力图）
     * @returns {Array} [{ dayName, date, pomodoros, isToday }]
     */
    getWeekData() {
        const records = this.getRecords();
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
        const weekData = [];
        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

        // 本周一为起点
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset);

        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            const dateKey = this.formatDate(date);
            const dayData = records[dateKey];
            const isToday = dateKey === this.getDateKey();

            weekData.push({
                dayName: dayNames[date.getDay()],
                date: dateKey,
                pomodoros: dayData ? dayData.pomodoros : 0,
                isToday,
            });
        }

        return weekData;
    },

    /**
     * 获取最近 N 天的记录列表
     */
    getRecentRecords(limit = 14) {
        const records = this.getRecords();
        return Object.entries(records)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, limit)
            .map(([date, data]) => ({
                date,
                ...data,
            }));
    },

    /**
     * 清除所有记录
     */
    clearAll() {
        localStorage.removeItem(this.KEYS.RECORDS);
        localStorage.removeItem(this.KEYS.STREAK);
    },

    /**
     * 保存设置
     */
    getSettings() {
        try {
            const data = localStorage.getItem(this.KEYS.SETTINGS);
            return data ? JSON.parse(data) : {
                focusTime: 25,
                breakTime: 5,
                volume: 80,
                vibrate: true,
                theme: 'light',
            };
        } catch (e) {
            return {
                focusTime: 25,
                breakTime: 5,
                volume: 80,
                vibrate: true,
                theme: 'light',
            };
        }
    },

    /**
     * 获取设置
     */
    setSettings(settings) {
        localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
    },

    /**
     * 获取今天的日期键 YYYY-MM-DD
     */
    getDateKey(offset = 0) {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return this.formatDate(d);
    },

    /**
     * 格式化日期
     */
    formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    /**
     * 获取专注等级
     * @param {number} totalPomodoros
     * @returns {Object} { emoji, name, nextThreshold, progress }
     */
    getLevel(totalPomodoros) {
        const levels = [
            { min: 0, emoji: '🌱', name: '新手' },
            { min: 5, emoji: '🌿', name: '入门' },
            { min: 15, emoji: '🪴', name: '进阶' },
            { min: 30, emoji: '🌳', name: '达人' },
            { min: 60, emoji: '⭐', name: '精英' },
            { min: 100, emoji: '🌟', name: '大师' },
            { min: 200, emoji: '👑', name: '传奇' },
            { min: 500, emoji: '🏆', name: '冠军' },
        ];

        let currentLevel = levels[0];
        let nextLevel = levels[1] || null;

        for (let i = levels.length - 1; i >= 0; i--) {
            if (totalPomodoros >= levels[i].min) {
                currentLevel = levels[i];
                nextLevel = levels[i + 1] || null;
                break;
            }
        }

        const progress = nextLevel
            ? Math.round(((totalPomodoros - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100)
            : 100;

        return { ...currentLevel, nextLevel, progress };
    },
};
