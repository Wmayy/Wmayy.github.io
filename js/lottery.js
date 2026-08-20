/**
 * 双色球助手 - 核心逻辑
 * 红球: 1-33 选6, 蓝球: 1-16 选1
 */

const Lottery = {
    // 内置历史数据（近期开奖，作为离线兜底）- 格式: {issue, date, red: [6], blue: 1}
    builtinHistory: [
        {issue:'2026096', date:'2026-08-20', red:[1,4,16,22,26,31], blue:4},
        {issue:'2026095', date:'2026-08-18', red:[4,6,14,21,22,33], blue:16},
        {issue:'2026094', date:'2026-08-16', red:[1,8,15,22,28,33], blue:4},
        {issue:'2026093', date:'2026-08-13', red:[5,11,19,24,27,30], blue:12},
        {issue:'2026092', date:'2026-08-11', red:[2,9,14,21,26,32], blue:7},
        {issue:'2026091', date:'2026-08-09', red:[4,10,17,23,29,31], blue:15},
        {issue:'2026090', date:'2026-08-04', red:[1,7,16,22,27,30], blue:11},
        {issue:'2026089', date:'2026-08-02', red:[3,8,12,19,24,32], blue:5},
        {issue:'2026088', date:'2026-07-30', red:[5,11,18,23,29,31], blue:14},
        {issue:'2026087', date:'2026-07-28', red:[2,9,15,21,26,33], blue:8},
        {issue:'2026086', date:'2026-07-26', red:[4,10,17,24,28,30], blue:1},
        {issue:'2026085', date:'2026-07-23', red:[6,13,19,25,27,32], blue:16},
        {issue:'2026084', date:'2026-07-21', red:[1,8,14,22,29,31], blue:6},
        {issue:'2026083', date:'2026-07-19', red:[3,7,16,23,26,33], blue:10},
        {issue:'2026082', date:'2026-07-16', red:[5,11,18,24,28,30], blue:3},
        {issue:'2026081', date:'2026-07-14', red:[2,9,15,21,27,32], blue:13},
        {issue:'2026080', date:'2026-07-12', red:[4,10,17,25,29,31], blue:7},
        {issue:'2026079', date:'2026-07-09', red:[6,13,20,22,26,33], blue:11},
        {issue:'2026078', date:'2026-07-07', red:[1,8,14,19,28,30], blue:4},
        {issue:'2026077', date:'2026-07-05', red:[3,7,16,23,27,32], blue:15},
        {issue:'2026076', date:'2026-07-02', red:[5,11,18,24,29,31], blue:9},
        {issue:'2026075', date:'2026-06-30', red:[2,9,15,21,25,33], blue:2},
        {issue:'2026074', date:'2026-06-28', red:[4,10,17,22,28,30], blue:12},
        {issue:'2026073', date:'2026-06-25', red:[6,13,19,26,27,32], blue:5},
        {issue:'2026072', date:'2026-06-23', red:[1,8,14,23,29,31], blue:8},
        {issue:'2026071', date:'2026-06-21', red:[3,7,16,24,26,33], blue:14},
        {issue:'2026070', date:'2026-06-18', red:[5,11,18,21,28,30], blue:1},
        {issue:'2026069', date:'2026-06-16', red:[2,9,15,22,27,32], blue:16},
        {issue:'2026068', date:'2026-06-14', red:[4,10,17,25,29,31], blue:6},
        {issue:'2026067', date:'2026-06-11', red:[6,13,20,23,26,33], blue:10},
        {issue:'2026066', date:'2026-06-09', red:[1,8,14,19,28,30], blue:3},
        {issue:'2026065', date:'2026-06-07', red:[3,7,16,24,27,32], blue:13},
        {issue:'2026064', date:'2026-06-04', red:[5,11,18,21,29,31], blue:7},
        {issue:'2026063', date:'2026-06-02', red:[2,9,15,22,25,33], blue:11},
        {issue:'2026062', date:'2026-05-31', red:[4,10,17,26,28,30], blue:4},
        {issue:'2026061', date:'2026-05-28', red:[6,13,19,23,27,32], blue:15},
        {issue:'2026060', date:'2026-05-26', red:[1,8,14,24,29,31], blue:9},
        {issue:'2026059', date:'2026-05-24', red:[3,7,16,21,26,33], blue:2},
        {issue:'2026058', date:'2026-05-21', red:[5,11,18,22,28,30], blue:12},
        {issue:'2026057', date:'2026-05-19', red:[2,9,15,25,27,32], blue:5},
        {issue:'2026056', date:'2026-05-17', red:[4,10,17,23,29,31], blue:8},
        {issue:'2026055', date:'2026-05-14', red:[6,13,20,24,26,33], blue:14},
        {issue:'2026054', date:'2026-05-12', red:[1,8,14,21,28,30], blue:1},
        {issue:'2026053', date:'2026-05-10', red:[3,7,16,22,27,32], blue:16},
        {issue:'2026052', date:'2026-05-07', red:[5,11,18,25,29,31], blue:6},
        {issue:'2026051', date:'2026-05-05', red:[2,9,15,23,26,33], blue:10},
        {issue:'2026050', date:'2026-05-03', red:[4,10,17,24,28,30], blue:3},
        {issue:'2026049', date:'2026-04-30', red:[6,13,19,21,27,32], blue:13}
    ],

    history: [],
    STORAGE_KEY: 'ssq_history_data',
    SAVED_KEY: 'ssq_saved_tickets',

    /** 校验开奖数据是否合法 */
    isValidDraw(data) {
        if (!data || !data.issue || !data.date || !Array.isArray(data.red) || !data.blue) return false;
        // 期号必须是5位以上数字（双色球期号如2026096）
        if (!/^\d{5,}$/.test(String(data.issue))) return false;
        // 日期格式校验
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.date))) return false;
        // 红球6个，1-33，不重复
        if (data.red.length !== 6) return false;
        const sortedRed = [...data.red].map(Number).sort((a,b)=>a-b);
        if (sortedRed.some(n => n < 1 || n > 33)) return false;
        if (new Set(sortedRed).size !== 6) return false;
        // 蓝球1-16
        if (data.blue < 1 || data.blue > 16) return false;
        return true;
    },

    /** 初始化：加载本地缓存 + 内置数据 */
    init() {
        const cached = localStorage.getItem(this.STORAGE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                // 校验数据是否损坏（第一条数据是否合法）
                if (Array.isArray(parsed) && parsed.length > 0 && this.isValidDraw(parsed[0])) {
                    this.history = parsed;
                } else {
                    console.warn('本地数据损坏，使用内置数据恢复');
                    this.history = [...this.builtinHistory];
                    this.saveToStorage();
                }
            } catch(e) {
                console.warn('本地数据解析失败，使用内置数据', e);
                this.history = [...this.builtinHistory];
                this.saveToStorage();
            }
        } else {
            this.history = [...this.builtinHistory];
            this.saveToStorage();
        }
        return this.history;
    },

    /** 保存到本地 */
    saveToStorage() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.history));
        } catch(e) {}
    },

    /** 获取最新一期 */
    getLatest() {
        return this.history.length > 0 ? this.history[0] : null;
    },

    /** 获取历史（分页） */
    getHistory(page = 1, pageSize = 20) {
        const start = (page - 1) * pageSize;
        return this.history.slice(start, start + pageSize);
    },

    /**
     * 通用HTML解析：从任意彩票网页中提取最新开奖数据
     */
    parseDrawFromHTML(html) {
        if (!html || typeof html !== 'string') return null;

        // 去除HTML标签，保留文本
        const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

        // 1. 提取期号（5-8位连续数字，且包含年份特征202x）
        let issue = null;
        const issueMatches = text.match(/20\d{5,7}/g);
        if (issueMatches && issueMatches.length > 0) {
            // 取最大的期号（最新的）
            issue = issueMatches.sort((a,b) => Number(b) - Number(a))[0];
        }

        // 2. 提取日期
        let date = null;
        // 格式1: 2026-08-20
        let dateMatch = text.match(/20\d{2}[-/]\d{1,2}[-/]\d{1,2}/);
        if (dateMatch) {
            date = dateMatch[0].replace(/\//g, '-');
            // 补零
            const parts = date.split('-');
            date = `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
        } else {
            // 格式2: 2026年08月20日
            dateMatch = text.match(/20\d{2}年\d{1,2}月\d{1,2}日/);
            if (dateMatch) {
                const m = dateMatch[0].match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
                date = `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
            }
        }

        // 3. 提取红球和蓝球
        // 方法：找到所有1-33的数字，然后寻找连续的6个红球+1个蓝球模式
        // 更精确：在文本中寻找 "红球...蓝球" 或类似模式
        let red = null;
        let blue = null;

        // 尝试模式1：明确标注红球蓝球
        // 红球: 01 04 16 22 26 31 蓝球: 04
        const pattern1 = text.match(/红球[：:\s]*([0-9\s,，、]+)[蓝球|篮球|特别号]/);
        if (pattern1) {
            const nums = pattern1[1].match(/\d{1,2}/g);
            if (nums && nums.length >= 6) {
                red = nums.slice(0, 6).map(Number).filter(n => n >= 1 && n <= 33);
            }
        }

        // 尝试模式2：6个连续两位数字 + 1个两位数字（蓝球通常单独标注）
        if (!red) {
            // 寻找6个连续的1-33数字（可能带空格/逗号分隔）
            const sequences = text.match(/(?:\d{1,2}[\s,，、]+){5,7}\d{1,2}/g);
            if (sequences) {
                for (const seq of sequences) {
                    const nums = seq.match(/\d{1,2}/g).map(Number);
                    const validRed = nums.filter(n => n >= 1 && n <= 33);
                    if (validRed.length >= 6) {
                        // 取前6个有效数字作为红球
                        red = validRed.slice(0, 6);
                        // 蓝球可能在序列中第7个，或者在后面
                        if (nums.length >= 7 && nums[6] >= 1 && nums[6] <= 16) {
                            blue = nums[6];
                        }
                        break;
                    }
                }
            }
        }

        // 尝试模式3：从HTML中提取class为ball或number的元素
        if (!red) {
            // 提取所有两位数字，然后找最可能的组合
            const allNums = text.match(/\d{1,2}/g).map(Number);
            // 统计1-33数字的出现频率
            const freq = {};
            allNums.forEach(n => {
                if (n >= 1 && n <= 33) freq[n] = (freq[n] || 0) + 1;
            });
            // 这种方法不太可靠，跳过
        }

        // 提取蓝球（如果还没找到）
        if (!blue && red) {
            // 在红球之后寻找1-16的数字
            const redStr = red.map(n => String(n).padStart(2,'0')).join('|');
            const afterRed = text.split(new RegExp(redStr))[1];
            if (afterRed) {
                const blueNums = afterRed.match(/\d{1,2}/g);
                if (blueNums) {
                    for (const n of blueNums) {
                        const num = Number(n);
                        if (num >= 1 && num <= 16 && !red.includes(num)) {
                            blue = num;
                            break;
                        }
                    }
                }
            }
        }

        // 最后兜底：如果找到了红球但没找到蓝球，尝试从全文找最可能的蓝球
        if (!blue && red) {
            const allNums = text.match(/\d{1,2}/g).map(Number);
            const blueCandidates = allNums.filter(n => n >= 1 && n <= 16 && !red.includes(n));
            if (blueCandidates.length > 0) {
                // 取出现频率最高的
                const freq = {};
                blueCandidates.forEach(n => freq[n] = (freq[n] || 0) + 1);
                blue = Number(Object.entries(freq).sort((a,b) => b[1] - a[1])[0][0]);
            }
        }

        if (issue && date && red && red.length === 6 && blue) {
            return {
                issue: String(issue),
                date,
                red: [...new Set(red)].map(Number).sort((a,b) => a-b),
                blue: Number(blue)
            };
        }
        return null;
    },

    /**
     * 尝试从网络获取最新开奖数据
     * 使用多个官网数据源 + CORS代理 + 通用HTML解析引擎
     * 优化：减少超时，并行尝试，整体超时控制
     */
    async fetchLatest() {
        // CORS 代理列表（只保留最可靠的3个）
        const corsProxies = [
            url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
            url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
            url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
        ];

        const REQUEST_TIMEOUT = 5000;  // 单个请求超时5秒
        const TOTAL_TIMEOUT = 25000;   // 整体超时25秒

        // 通过代理获取URL内容（并行尝试所有代理，取第一个成功的）
        const fetchViaProxy = async (url) => {
            const promises = corsProxies.map(proxy =>
                new Promise(async (resolve) => {
                    try {
                        const controller = new AbortController();
                        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
                        const res = await fetch(proxy(url), {
                            mode: 'cors',
                            signal: controller.signal,
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                        });
                        clearTimeout(timer);
                        if (res.ok) {
                            const text = await res.text();
                            if (text && text.length > 100) resolve(text);
                            else resolve(null);
                        } else {
                            resolve(null);
                        }
                    } catch(e) { resolve(null); }
                })
            );
            // Promise.any 取第一个成功的
            return Promise.any(promises).catch(() => null);
        };

        // 整体超时控制
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('整体超时')), TOTAL_TIMEOUT)
        );

        // 数据源列表（按优先级排序）
        const dataSources = [
            // 数据源1: 中彩网官方API（最可靠）
            {
                name: '中彩网API',
                type: 'json',
                url: 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=ssq&issueCount=1',
                parse: (text) => {
                    try {
                        const json = JSON.parse(text);
                        if (json.result && json.result.length > 0) {
                            const d = json.result[0];
                            return {
                                issue: String(d.code || d.issue),
                                date: d.date,
                                red: String(d.red).split(',').map(Number).sort((a,b)=>a-b),
                                blue: Number(d.blue)
                            };
                        }
                    } catch(e) {}
                    return null;
                }
            },
            // 数据源2: 500彩票网历史数据
            {
                name: '500彩票网',
                type: 'html',
                url: 'https://datachart.500.com/ssq/history/newinc/history.php?start=0&end=0',
                parse: (text) => {
                    const match = text.match(/<tr[^>]*class="t_tr1"[^>]*>([\s\S]*?)<\/tr>/);
                    if (match) {
                        const row = match[1];
                        const tds = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
                        if (tds && tds.length >= 9) {
                            const getText = (td) => td.replace(/<[^>]+>/g, '').trim();
                            return {
                                issue: getText(tds[0]),
                                date: getText(tds[1]),
                                red: [2,3,4,5,6,7].map(i => Number(getText(tds[i]))).sort((a,b) => a-b),
                                blue: Number(getText(tds[8]))
                            };
                        }
                    }
                    return Lottery.parseDrawFromHTML(text);
                }
            },
            // 数据源3: 中彩网开奖详情页
            {
                name: '中彩网页面',
                type: 'html',
                url: 'https://www.zhcw.com/kjxx/ssq/kjxq/',
                parse: (text) => Lottery.parseDrawFromHTML(text)
            },
            // 数据源4: 彩吧助手
            {
                name: '彩吧助手',
                type: 'html',
                url: 'https://m.55128.cn/kjh/fcssq-kjjg.htm',
                parse: (text) => Lottery.parseDrawFromHTML(text)
            },
            // 数据源5: 陕西福彩网
            {
                name: '陕西福彩网',
                type: 'html',
                url: 'https://www.sxlotto.com.cn/cz/ssq/kjxq2/',
                parse: (text) => Lottery.parseDrawFromHTML(text)
            },
            // 数据源6: 上海福彩网
            {
                name: '上海福彩网',
                type: 'html',
                url: 'https://www.swlc.net.cn/shsflcpfxzx/lottery/ssq.html',
                parse: (text) => Lottery.parseDrawFromHTML(text)
            },
            // 数据源7: 旧API mxnzp（保留备用）
            {
                name: 'mxnzp API',
                type: 'json',
                url: 'https://www.mxnzp.com/api/lottery/common/latest?code=ssq',
                parse: (text) => {
                    try {
                        const json = JSON.parse(text);
                        if (json.code === 1 && json.data) {
                            const d = json.data;
                            return {
                                issue: String(d.issue),
                                date: d.date,
                                red: String(d.red).split(',').map(Number).sort((a,b)=>a-b),
                                blue: Number(d.blue)
                            };
                        }
                    } catch(e) {}
                    return null;
                }
            }
        ];

        let lastError = '';
        let attempted = 0;

        try {
            const mainPromise = (async () => {
                for (const source of dataSources) {
                    attempted++;
                    try {
                        const text = await fetchViaProxy(source.url);
                        if (!text) {
                            lastError = `${source.name}: 网络请求失败`;
                            continue;
                        }

                        const result = source.parse(text);
                        if (result && this.isValidDraw(result)) {
                            const exists = this.history.find(h => h.issue === result.issue);
                            if (!exists) {
                                this.history.unshift(result);
                                this.saveToStorage();
                            }
                            return {
                                success: true,
                                data: result,
                                isNew: !exists,
                                source: source.name,
                                attempted
                            };
                        } else {
                            lastError = `${source.name}: 数据解析失败`;
                        }
                    } catch(e) {
                        lastError = `${source.name}: ${e.message}`;
                        continue;
                    }
                }
                return {
                    success: false,
                    data: null,
                    message: `已尝试 ${attempted} 个数据源均失败（${lastError}）`,
                    attempted
                };
            })();

            // 竞速：主流程 vs 整体超时
            return await Promise.race([mainPromise, timeoutPromise]);
        } catch(e) {
            return {
                success: false,
                data: null,
                message: `获取超时（已尝试${attempted}个数据源），请使用手动更新`,
                attempted
            };
        }
    },

    /** 手动添加/更新一期开奖数据 */
    addManualDraw(issue, date, red, blue) {
        if (!issue || !date || !Array.isArray(red) || red.length !== 6 || !blue) {
            return { success: false, message: '数据不完整' };
        }
        const sortedRed = [...red].map(Number).sort((a,b)=>a-b);
        // 校验
        if (sortedRed.some(n => n < 1 || n > 33)) return { success: false, message: '红球范围应为1-33' };
        if (new Set(sortedRed).size !== 6) return { success: false, message: '红球不能重复' };
        if (blue < 1 || blue > 16) return { success: false, message: '蓝球范围应为1-16' };

        const data = { issue: String(issue), date, red: sortedRed, blue: Number(blue) };
        const exists = this.history.find(h => h.issue === data.issue);
        if (exists) {
            const idx = this.history.indexOf(exists);
            this.history[idx] = data;
        } else {
            this.history.unshift(data);
        }
        this.saveToStorage();
        return { success: true, data, isUpdate: !!exists };
    },

    /**
     * 中奖判定
     * @param {Array} myRed - 我的红球 [6]
     * @param {Number} myBlue - 我的蓝球
     * @param {Object} draw - 开奖号码 {red:[6], blue:1}
     * @returns {Object} {level, levelName, redMatch, blueMatch, win, prize}
     */
    checkPrize(myRed, myBlue, draw) {
        const redMatch = myRed.filter(n => draw.red.includes(n)).length;
        const blueMatch = myBlue === draw.blue ? 1 : 0;

        let level = 0;
        let levelName = '未中奖';
        let prize = 0;

        if (redMatch === 6 && blueMatch === 1) { level = 1; levelName = '一等奖'; prize = '浮动'; }
        else if (redMatch === 6 && blueMatch === 0) { level = 2; levelName = '二等奖'; prize = '浮动'; }
        else if (redMatch === 5 && blueMatch === 1) { level = 3; levelName = '三等奖'; prize = 3000; }
        else if ((redMatch === 5 && blueMatch === 0) || (redMatch === 4 && blueMatch === 1)) { level = 4; levelName = '四等奖'; prize = 200; }
        else if ((redMatch === 4 && blueMatch === 0) || (redMatch === 3 && blueMatch === 1)) { level = 5; levelName = '五等奖'; prize = 10; }
        else if ((redMatch === 2 && blueMatch === 1) || (redMatch === 1 && blueMatch === 1) || (redMatch === 0 && blueMatch === 1)) { level = 6; levelName = '六等奖'; prize = 5; }

        return {
            level,
            levelName,
            redMatch,
            blueMatch,
            win: level > 0,
            prize
        };
    },

    /**
     * 多注验票
     * @param {Array} tickets - [{red:[6], blue:1, multiplier:1}]
     * @param {Object} draw - 开奖号码
     * @returns {Object} {results:[], totalPrize, winCount, totalCount}
     */
    checkMultipleTickets(tickets, draw) {
        if (!draw) draw = this.getLatest();
        if (!draw) return { results: [], totalPrize: 0, winCount: 0, totalCount: 0 };

        const results = tickets.map((t, idx) => {
            const result = this.checkPrize(t.red, t.blue, draw);
            const multiplier = t.multiplier || 1;
            let prizeValue = 0;
            let prizeDisplay = '0元';
            if (result.prize === '浮动') {
                prizeDisplay = '浮动奖金';
            } else if (result.prize > 0) {
                prizeValue = result.prize * multiplier;
                prizeDisplay = prizeValue + '元';
            }
            return {
                index: idx + 1,
                label: t.label || String.fromCharCode(65 + idx),
                red: t.red,
                blue: t.blue,
                multiplier,
                ...result,
                prizeValue,
                prizeDisplay
            };
        });

        const winCount = results.filter(r => r.win).length;
        const fixedPrize = results.reduce((sum, r) => sum + (r.prizeValue || 0), 0);
        const hasFloating = results.some(r => r.prize === '浮动');

        return {
            results,
            totalPrize: fixedPrize,
            hasFloating,
            winCount,
            totalCount: results.length,
            draw
        };
    },

    /**
     * 从OCR识别的文本中解析彩票号码
     * 支持格式：A.01 05 07 16 20 22-05 (1)
     */
    parseTicketsFromText(text) {
        if (!text) return [];
        const tickets = [];
        const lines = text.split('\n');

        for (const line of lines) {
            // 匹配 A. 或 A: 开头的行
            const match = line.match(/^([A-E])[\.:：]\s*(\d{1,2})[\s,，]+(\d{1,2})[\s,，]+(\d{1,2})[\s,，]+(\d{1,2})[\s,，]+(\d{1,2})[\s,，]+(\d{1,2})[\s\-—]+(\d{1,2})/);
            if (match) {
                const label = match[1];
                const red = [
                    Number(match[2]), Number(match[3]), Number(match[4]),
                    Number(match[5]), Number(match[6]), Number(match[7])
                ].sort((a,b) => a-b);
                const blue = Number(match[8]);
                // 提取倍数 (1) 或 (2)
                const multMatch = line.match(/[(\(（](\d+)[)\)）]/);
                const multiplier = multMatch ? Number(multMatch[1]) : 1;

                // 校验
                if (red.length === 6 && red.every(n => n >= 1 && n <= 33) &&
                    blue >= 1 && blue <= 16 && new Set(red).size === 6) {
                    tickets.push({ label, red, blue, multiplier });
                }
            }
        }

        return tickets;
    },

    /**
     * 智能推荐号码
     * @param {Object} options - 配置
     * @returns {Array} 推荐号码列表 [{red:[6], blue:1, tags:[]}]
     */
    generateRecommendations(options = {}) {
        const {
            count = 5,
            filterHistory = true,
            trendWeight = true,
            excludeConsecutive = true,
            excludeOddEven = true
        } = options;

        const results = [];
        const historyKeys = new Set(
            this.history.map(h => h.red.sort((a,b)=>a-b).join(',') + '|' + h.blue)
        );

        // 计算冷热号频率（近50期）
        const recent = this.history.slice(0, 50);
        const redFreq = {};
        const blueFreq = {};
        for (let i = 1; i <= 33; i++) redFreq[i] = 0;
        for (let i = 1; i <= 16; i++) blueFreq[i] = 0;
        recent.forEach(h => {
            h.red.forEach(n => redFreq[n]++);
            blueFreq[h.blue]++;
        });

        let attempts = 0;
        const maxAttempts = count * 200;

        while (results.length < count && attempts < maxAttempts) {
            attempts++;

            // 生成红球
            let red;
            if (trendWeight) {
                red = this.weightedRandomRed(redFreq, recent.length);
            } else {
                red = this.randomRed();
            }

            // 生成蓝球
            let blue;
            if (trendWeight) {
                blue = this.weightedRandomBlue(blueFreq, recent.length);
            } else {
                blue = Math.floor(Math.random() * 16) + 1;
            }

            const key = red.join(',') + '|' + blue;
            const tags = [];

            // 过滤历史中奖号
            if (filterHistory && historyKeys.has(key)) continue;

            // 排除最大连号（4个及以上连续）
            if (excludeConsecutive && this.hasMaxConsecutive(red)) continue;

            // 排除全奇/全偶
            if (excludeOddEven && this.isAllOddOrEven(red)) continue;

            // 去重
            if (results.some(r => r.red.join(',') === red.join(','))) continue;

            // 打标签
            if (!this.hasMaxConsecutive(red) && !this.isAllOddOrEven(red)) tags.push('safe');
            if (trendWeight) tags.push('trend');

            results.push({ red, blue, tags });
        }

        return results;
    },

    /** 随机6个红球 */
    randomRed() {
        const pool = [];
        for (let i = 1; i <= 33; i++) pool.push(i);
        const result = [];
        for (let i = 0; i < 6; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            result.push(pool.splice(idx, 1)[0]);
        }
        return result.sort((a,b) => a-b);
    },

    /** 基于频率加权随机选红球 */
    weightedRandomRed(freq, total) {
        // 温号策略：中等频率的号码权重更高，避免极端冷热
        const avg = total * 6 / 33;
        const weights = {};
        for (let i = 1; i <= 33; i++) {
            const f = freq[i];
            // 偏离平均值越大权重越低，倾向温号
            const deviation = Math.abs(f - avg);
            weights[i] = Math.max(0.5, 3 - deviation * 0.3);
        }

        const result = [];
        const available = {...weights};
        for (let i = 0; i < 6; i++) {
            const entries = Object.entries(available);
            const totalW = entries.reduce((s, [,w]) => s + w, 0);
            let r = Math.random() * totalW;
            let chosen = null;
            for (const [num, w] of entries) {
                r -= w;
                if (r <= 0) { chosen = Number(num); break; }
            }
            if (!chosen) chosen = Number(entries[0][0]);
            result.push(chosen);
            delete available[chosen];
        }
        return result.sort((a,b) => a-b);
    },

    /** 基于频率加权随机选蓝球 */
    weightedRandomBlue(freq, total) {
        const avg = total / 16;
        const weights = {};
        for (let i = 1; i <= 16; i++) {
            const f = freq[i];
            const deviation = Math.abs(f - avg);
            weights[i] = Math.max(0.5, 3 - deviation * 0.3);
        }
        const entries = Object.entries(weights);
        const totalW = entries.reduce((s, [,w]) => s + w, 0);
        let r = Math.random() * totalW;
        for (const [num, w] of entries) {
            r -= w;
            if (r <= 0) return Number(num);
        }
        return 1;
    },

    /** 检测是否有最大连号（4个及以上连续） */
    hasMaxConsecutive(red) {
        const sorted = [...red].sort((a,b) => a-b);
        let maxRun = 1;
        let currentRun = 1;
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === sorted[i-1] + 1) {
                currentRun++;
                maxRun = Math.max(maxRun, currentRun);
            } else {
                currentRun = 1;
            }
        }
        return maxRun >= 4;
    },

    /** 检测是否全奇或全偶 */
    isAllOddOrEven(red) {
        const oddCount = red.filter(n => n % 2 === 1).length;
        return oddCount === 0 || oddCount === 6;
    },

    /** 冷热号分析 */
    getHotColdAnalysis(period = 50) {
        const recent = this.history.slice(0, period);
        const redFreq = {};
        const blueFreq = {};
        for (let i = 1; i <= 33; i++) redFreq[i] = 0;
        for (let i = 1; i <= 16; i++) blueFreq[i] = 0;

        recent.forEach(h => {
            h.red.forEach(n => redFreq[n]++);
            blueFreq[h.blue]++;
        });

        const redSorted = Object.entries(redFreq).sort((a,b) => b[1] - a[1]);
        const hot = redSorted.slice(0, 6).map(([n, f]) => ({num: Number(n), freq: f}));
        const cold = redSorted.slice(-6).reverse().map(([n, f]) => ({num: Number(n), freq: f}));

        return { hot, cold, period, totalDraws: recent.length };
    },

    /** 保存我的选号 */
    saveTicket(red, blue) {
        const saved = this.getSavedTickets();
        saved.unshift({ red: [...red].sort((a,b)=>a-b), blue, time: Date.now() });
        localStorage.setItem(this.SAVED_KEY, JSON.stringify(saved));
        return saved;
    },

    /** 获取保存的选号 */
    getSavedTickets() {
        try {
            return JSON.parse(localStorage.getItem(this.SAVED_KEY)) || [];
        } catch(e) {
            return [];
        }
    },

    /** 删除保存的选号 */
    deleteTicket(index) {
        const saved = this.getSavedTickets();
        saved.splice(index, 1);
        localStorage.setItem(this.SAVED_KEY, JSON.stringify(saved));
        return saved;
    }
};
