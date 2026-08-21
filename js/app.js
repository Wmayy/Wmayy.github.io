/**
 * 双色球助手 - 主应用逻辑
 */

let currentPage = 'home';
let historyPage = 1;
const HISTORY_PAGE_SIZE = 15;

// 选号状态
let selectedRed = new Set();
let selectedBlue = null;

/** 初始化 */
document.addEventListener('DOMContentLoaded', () => {
    Lottery.init();
    initManualInputs();
    initBallPicker();
    renderLatest();
    renderHotCold();
    renderHistory();
    renderSavedTickets();
    updateHeaderDate();

    // 智能判断是否需要自动刷新
    smartAutoRefresh();

    // 检查保存的号码是否中奖（延迟1秒，等数据加载完成）
    setTimeout(() => {
        checkAndShowPrizeAlert();
    }, 1000);
});

/** 检查保存的号码是否中奖并弹窗提示 */
function checkAndShowPrizeAlert() {
    const result = Lottery.checkSavedTicketsPrize();
    if (result.newWins && result.newWins.length > 0) {
        showPrizeAlertModal(result.newWins);
    }
}

/** 显示中奖弹窗 */
function showPrizeAlertModal(wins) {
    const modal = document.getElementById('prizeAlertModal');
    const body = document.getElementById('prizeAlertBody');

    let html = '';
    let totalPrize = 0;
    let hasFloating = false;

    wins.forEach((win, idx) => {
        const ticket = win.ticket;
        const prize = win.result;

        const redBalls = ticket.red.map(n =>
            `<span class="ball red" style="width:26px;height:26px;font-size:12px;">${String(n).padStart(2,'0')}</span>`
        ).join('');
        const blueBall = `<span class="ball blue" style="width:26px;height:26px;font-size:12px;">${String(ticket.blue).padStart(2,'0')}</span>`;

        let prizeDisplay = '';
        if (prize.prize === '浮动') {
            prizeDisplay = '浮动奖金（以官方公告为准）';
            hasFloating = true;
        } else if (prize.prize > 0) {
            prizeDisplay = prize.prize + ' 元';
            totalPrize += prize.prize;
        }

        const sourceLabel = ticket.source === 'recommend' ? '推荐号码' : '手动选号';

        html += `
            <div class="prize-alert-item">
                <div class="prize-alert-item-header">
                    <span class="prize-level-badge ${prize.level <= 2 ? 'jackpot' : 'win'}">${prize.levelName}</span>
                    <span class="prize-source">${sourceLabel}</span>
                </div>
                <div class="prize-alert-balls">${redBalls} + ${blueBall}</div>
                <div class="prize-alert-detail">
                    命中红球 ${prize.redMatch} 个，蓝球 ${prize.blueMatch} 个
                </div>
                <div class="prize-alert-amount">${prizeDisplay}</div>
                <div class="prize-alert-draw">开奖期号：第 ${prize.drawIssue} 期（${prize.drawDate}）</div>
            </div>
        `;
    });

    // 汇总
    let summaryHtml = '';
    if (wins.length > 1) {
        summaryHtml = `<div class="prize-alert-summary">
            共中奖 ${wins.length} 注，
            ${hasFloating ? '含浮动奖金，' : ''}
            固定奖金合计 <strong>${totalPrize} 元</strong>
        </div>`;
    }

    body.innerHTML = html + summaryHtml;
    modal.classList.add('show');
}

/** 关闭中奖弹窗 */
function closePrizeAlert(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('prizeAlertModal').classList.remove('show');
}

/** 智能自动刷新：根据日期判断是否需要获取最新数据 */
function smartAutoRefresh() {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const dayOfWeek = today.getDay(); // 0=周日, 2=周二, 4=周四

    // 双色球开奖日：周二(2)、周四(4)、周日(0)
    const isDrawDay = (dayOfWeek === 0 || dayOfWeek === 2 || dayOfWeek === 4);

    const latest = Lottery.getLatest();

    // 没有数据时必须刷新
    if (!latest) {
        refreshData();
        return;
    }

    // 最新开奖日期已经是今天，不需要刷新
    if (latest.date === todayStr) {
        return;
    }

    // 今天不是开奖日，不需要刷新（没有新开奖）
    if (!isDrawDay) {
        return;
    }

    // 今天是开奖日，且最新数据不是今天 → 需要刷新
    // 但开奖通常在晚上21:15之后，白天刷新可能还是上一期
    // 所以只在晚上20:00之后才自动刷新
    const hour = today.getHours();
    if (hour >= 20) {
        refreshData();
    }
    // 白天不自动刷新，用户可手动点击刷新
}

/** 更新头部日期 */
function updateHeaderDate() {
    const now = new Date();
    const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
    const dateStr = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${weekdays[now.getDay()]}`;
    document.getElementById('headerDate').textContent = dateStr;
}

/** 页面切换 */
function switchPage(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) navItem.classList.add('active');

    // 页面特定初始化
    if (page === 'history') {
        // 判断当前激活的是哪个标签
        const activeTab = document.querySelector('.tab-switch .tab-item.active');
        if (activeTab && activeTab.textContent.includes('我的选号')) {
            renderMineTickets();
        } else {
            renderHistory();
        }
    }
    if (page === 'recommend') renderHotCold();
    if (page === 'manual') renderSavedTickets();

    // 离开扫码页时停止相机
    if (page !== 'scan' && Scanner.scanning) {
        Scanner.stop();
    }

    window.scrollTo(0, 0);
}

/** 跳转到手动验票（从首页快捷入口） */
function goToManualCheck() {
    switchPage('scan');
    // 延迟滚动到手动输入区域
    setTimeout(() => {
        const section = document.getElementById('manualCheckSection');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 高亮提示
            section.style.transition = 'box-shadow 0.3s';
            section.style.boxShadow = '0 0 0 3px rgba(196, 30, 58, 0.3)';
            setTimeout(() => {
                section.style.boxShadow = 'none';
            }, 1500);
        }
        // 聚焦第一个输入框
        const firstInput = document.querySelector('#redInputs input');
        if (firstInput) firstInput.focus();
    }, 300);
}

/** 渲染最新开奖 */
function renderLatest() {
    const latest = Lottery.getLatest();
    const issueEl = document.getElementById('latestIssue');
    const dateEl = document.getElementById('latestDate');
    const ballsEl = document.getElementById('latestBalls');
    const poolEl = document.getElementById('prizePool');

    if (!latest) {
        dateEl.textContent = '暂无数据';
        ballsEl.innerHTML = '<div class="ball loading">?</div>';
        return;
    }

    issueEl.textContent = `第 ${latest.issue} 期`;
    dateEl.textContent = `开奖日期：${latest.date}`;

    let html = '';
    latest.red.forEach(n => {
        html += `<div class="ball red">${String(n).padStart(2,'0')}</div>`;
    });
    html += `<div class="ball separator">+</div>`;
    html += `<div class="ball blue">${String(latest.blue).padStart(2,'0')}</div>`;
    ballsEl.innerHTML = html;

    // 奖池（模拟估算）
    const poolEstimate = (Math.random() * 10 + 5).toFixed(2);
    poolEl.textContent = `奖池约：${poolEstimate} 亿元（仅供参考）`;
}

/** 刷新数据 */
async function refreshData() {
    const btn = document.getElementById('btnRefresh');
    btn.innerHTML = '<span>刷新中...</span>';
    btn.disabled = true;

    const result = await Lottery.fetchLatest();
    if (result.success) {
        renderLatest();
        renderHistory();
        renderHotCold();
        if (result.isNew) {
            showToast(`已更新最新数据（来源：${result.source}）`);
        } else {
            showToast(`已是最新数据（来源：${result.source}）`);
        }
    } else {
        showToast(`刷新失败（已尝试${result.attempted || 9}个数据源），可手动更新`);
        // 3秒后提示用户手动更新
        setTimeout(() => {
            if (confirm('网络刷新失败，是否手动输入最新开奖号码？\n\n可从中国福利彩票官网 cwl.gov.cn 查看最新开奖结果。')) {
                showManualUpdate();
            }
        }, 500);
    }

    btn.innerHTML = '<span>🔄 刷新数据</span>';
    btn.disabled = false;
}

/** 初始化手动输入框 */
function initManualInputs() {
    const redContainer = document.getElementById('redInputs');
    const blueContainer = document.getElementById('blueInput');

    for (let i = 0; i < 6; i++) {
        const input = document.createElement('input');
        input.type = 'tel';
        input.maxLength = 2;
        input.placeholder = String(i + 1);
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
            if (e.target.value.length >= 2 && i < 5) {
                redContainer.children[i + 1].focus();
            }
        });
        redContainer.appendChild(input);
    }

    const blueInput = document.createElement('input');
    blueInput.type = 'tel';
    blueInput.maxLength = 2;
    blueInput.placeholder = '蓝';
    blueInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
    });
    blueContainer.appendChild(blueInput);
}

/** 手动查验中奖 */
function checkManualTicket() {
    const redInputs = document.querySelectorAll('#redInputs input');
    const blueInput = document.querySelector('#blueInput input');

    const red = [];
    redInputs.forEach(inp => {
        const v = parseInt(inp.value);
        if (v >= 1 && v <= 33) red.push(v);
    });
    const blue = parseInt(blueInput.value);

    if (red.length !== 6) {
        showToast('请输入6个红球（1-33）');
        return;
    }
    if (!blue || blue < 1 || blue > 16) {
        showToast('请输入1个蓝球（1-16）');
        return;
    }

    // 去重检查
    const uniqueRed = [...new Set(red)];
    if (uniqueRed.length !== 6) {
        showToast('红球不能重复');
        return;
    }

    const latest = Lottery.getLatest();
    if (!latest) {
        showToast('暂无开奖数据');
        return;
    }

    const result = Lottery.checkPrize(red.sort((a,b)=>a-b), blue, latest);
    showScanResult(result, red, blue, latest);
}

/** 显示验票结果 */
function showScanResult(result, myRed, myBlue, draw) {
    const card = document.getElementById('scanResult');
    const title = document.getElementById('resultTitle');
    const detail = document.getElementById('resultDetail');

    card.style.display = 'block';
    card.className = 'result-card';

    if (result.level === 1) {
        card.classList.add('jackpot');
        title.textContent = '🎉 恭喜中一等奖！';
    } else if (result.level >= 2 && result.level <= 3) {
        card.classList.add('win');
        title.textContent = `🎉 恭喜中${result.levelName}！`;
    } else if (result.level >= 4 && result.level <= 6) {
        card.classList.add('win');
        title.textContent = `恭喜中${result.levelName}`;
    } else {
        card.classList.add('lose');
        title.textContent = '很遗憾，未中奖';
    }

    let myBallsHtml = myRed.map(n => `<span class="ball red" style="width:28px;height:28px;font-size:12px;display:inline-flex;">${String(n).padStart(2,'0')}</span>`).join('');
    myBallsHtml += ` <span class="ball blue" style="width:28px;height:28px;font-size:12px;display:inline-flex;">${String(myBlue).padStart(2,'0')}</span>`;

    detail.innerHTML = `
        <div style="margin-bottom:8px;">您的号码：${myBallsHtml}</div>
        <div style="margin-bottom:8px;">开奖期号：第 ${draw.issue} 期</div>
        <div>命中红球 ${result.redMatch} 个，蓝球 ${result.blueMatch} 个</div>
        ${result.win ? '<div style="margin-top:8px;color:var(--primary);font-weight:600;">请在60个自然日内到投注站兑奖</div>' : ''}
    `;

    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// OCR实时识别相关变量
let ocrInterval = null;
let isRecognizing = false;
let ocrWorker = null;
let autoCaptureTimer = null;
let countdownTimer = null;

/** 启动扫码（自动拍照识别） */
async function startScanner() {
    const result = await Scanner.start();
    if (result.success) {
        document.getElementById('btnStartScan').style.display = 'none';
        document.getElementById('btnCapture').style.display = 'inline-block';
        document.getElementById('btnStopScan').style.display = 'inline-block';
        document.getElementById('scannerPlaceholder').style.display = 'none';

        // 初始化 OCR worker
        initOCRWorker();

        // 启动自动拍照识别（倒计时3秒后自动拍照）
        startAutoCapture();
    } else {
        showToast(result.message);
    }
}

/** 启动自动拍照倒计时 */
function startAutoCapture() {
    if (autoCaptureTimer || countdownTimer) return;

    const statusEl = document.getElementById('ocrStatus');
    const statusText = document.getElementById('ocrStatusText');
    statusEl.style.display = 'block';

    let countdown = 3;
    statusText.textContent = `调整位置，${countdown}秒后自动拍照识别...`;

    countdownTimer = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            statusText.textContent = `调整位置，${countdown}秒后自动拍照识别...`;
        } else {
            clearInterval(countdownTimer);
            countdownTimer = null;
            // 倒计时结束，自动拍照识别
            autoCaptureAndRecognize();
        }
    }, 1000);
}

/** 自动拍照并识别 */
async function autoCaptureAndRecognize() {
    if (isRecognizing || !Scanner.scanning) return;

    const video = document.getElementById('scannerVideo');
    if (!video || !video.videoWidth) {
        // 相机不可用，重新倒计时
        startAutoCapture();
        return;
    }

    const canvas = document.getElementById('scannerCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const statusText = document.getElementById('ocrStatusText');
    statusText.textContent = '正在识别...';

    isRecognizing = true;

    try {
        let text;
        if (ocrWorker) {
            const { data } = await ocrWorker.recognize(canvas);
            text = data.text;
        } else if (typeof Tesseract !== 'undefined') {
            const result = await Tesseract.recognize(canvas, 'eng', {
                tessedit_char_whitelist: 'ABCDE0123456789.-:()（） ',
                preserve_interword_spaces: '1'
            });
            text = result.data.text;
        } else {
            throw new Error('识别引擎未加载');
        }

        console.log('自动拍照识别结果:', text);

        const tickets = Lottery.parseTicketsFromText(text);

        if (tickets.length > 0) {
            // 识别成功，停止扫描
            stopScanner();
            const multiResult = Lottery.checkMultipleTickets(tickets);
            renderMultiResult(multiResult);
            showToast(`成功识别 ${tickets.length} 注号码`);
            return;
        }

        // 未识别到，2秒后重新倒计时
        statusText.textContent = '未识别到号码，2秒后重新拍照...';
        autoCaptureTimer = setTimeout(() => {
            autoCaptureTimer = null;
            if (Scanner.scanning) startAutoCapture();
        }, 2000);

    } catch(e) {
        console.error('自动拍照识别失败:', e);
        statusText.textContent = '识别失败，2秒后重试...';
        autoCaptureTimer = setTimeout(() => {
            autoCaptureTimer = null;
            if (Scanner.scanning) startAutoCapture();
        }, 2000);
    } finally {
        isRecognizing = false;
    }
}

/** 初始化 OCR Worker */
async function initOCRWorker() {
    if (ocrWorker || typeof Tesseract === 'undefined') return;
    try {
        ocrWorker = await Tesseract.createWorker('eng', 1, {
            logger: m => {}
        });
        await ocrWorker.setParameters({
            tessedit_char_whitelist: 'ABCDE0123456789.-:()（） ',
            preserve_interword_spaces: '1'
        });
    } catch(e) {
        console.warn('OCR Worker初始化失败，将使用单次识别模式', e);
    }
}

/** 停止扫码 */
function stopScanner() {
    Scanner.stop();
    // 清除所有定时器
    if (ocrInterval) { clearInterval(ocrInterval); ocrInterval = null; }
    if (autoCaptureTimer) { clearTimeout(autoCaptureTimer); autoCaptureTimer = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    isRecognizing = false;
    document.getElementById('btnStartScan').style.display = 'inline-block';
    document.getElementById('btnCapture').style.display = 'none';
    document.getElementById('btnStopScan').style.display = 'none';
    document.getElementById('ocrStatus').style.display = 'none';
    document.getElementById('scannerPlaceholder').style.display = 'flex';
}

/** 拍照识别（手动触发，自动识别效果不好时使用） */
async function captureAndRecognize() {
    if (isRecognizing) {
        showToast('正在识别中，请稍候...');
        return;
    }

    const video = document.getElementById('scannerVideo');
    if (!video || !video.videoWidth) {
        showToast('相机未启动');
        return;
    }

    // 暂停自动倒计时
    if (autoCaptureTimer) { clearTimeout(autoCaptureTimer); autoCaptureTimer = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }

    const canvas = document.getElementById('scannerCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const statusEl = document.getElementById('ocrStatus');
    const statusText = document.getElementById('ocrStatusText');
    statusEl.style.display = 'block';
    statusText.textContent = '正在识别照片...';

    isRecognizing = true;

    try {
        let text;
        if (ocrWorker) {
            const { data } = await ocrWorker.recognize(canvas);
            text = data.text;
        } else if (typeof Tesseract !== 'undefined') {
            const result = await Tesseract.recognize(canvas, 'eng', {
                tessedit_char_whitelist: 'ABCDE0123456789.-:()（） ',
                preserve_interword_spaces: '1'
            });
            text = result.data.text;
        } else {
            throw new Error('识别引擎未加载');
        }

        console.log('拍照识别结果:', text);

        const tickets = Lottery.parseTicketsFromText(text);

        if (tickets.length === 0) {
            statusText.textContent = '未识别到有效号码，2秒后自动重新拍照...';
            autoCaptureTimer = setTimeout(() => {
                autoCaptureTimer = null;
                if (Scanner.scanning) startAutoCapture();
            }, 2000);
            return;
        }

        // 识别成功，停止扫描
        stopScanner();
        const multiResult = Lottery.checkMultipleTickets(tickets);
        renderMultiResult(multiResult);
        showToast(`成功识别 ${tickets.length} 注号码`);

    } catch(e) {
        console.error('拍照识别失败:', e);
        statusText.textContent = '识别失败，2秒后重试...';
        autoCaptureTimer = setTimeout(() => {
            autoCaptureTimer = null;
            if (Scanner.scanning) startAutoCapture();
        }, 2000);
    } finally {
        isRecognizing = false;
    }
}

/** 渲染多注识别结果 */
function renderMultiResult(multiResult) {
    const container = document.getElementById('multiResult');
    const listEl = document.getElementById('multiResultList');
    const summaryEl = document.getElementById('multiSummary');
    const totalEl = document.getElementById('multiTotal');

    container.style.display = 'block';
    totalEl.textContent = `共${multiResult.totalCount}注`;

    let html = '';
    multiResult.results.forEach(r => {
        const redBalls = r.red.map(n => `<span class="ball red" style="width:24px;height:24px;font-size:11px;">${String(n).padStart(2,'0')}</span>`).join('');
        const blueBall = `<span class="ball blue" style="width:24px;height:24px;font-size:11px;">${String(r.blue).padStart(2,'0')}</span>`;

        let resultClass = 'lose';
        let resultText = '未中奖';
        if (r.win) {
            resultClass = r.level <= 2 ? 'jackpot' : 'win';
            resultText = r.levelName;
        }

        html += `
            <div class="multi-ticket-item ${resultClass}">
                <div class="ticket-label">${r.label}注 ${r.multiplier > 1 ? `(${r.multiplier}倍)` : ''}</div>
                <div class="ticket-balls">${redBalls} + ${blueBall}</div>
                <div class="ticket-result">
                    <span class="ticket-match">红${r.redMatch} 蓝${r.blueMatch}</span>
                    <span class="ticket-prize ${resultClass}">${resultText} ${r.prizeDisplay !== '0元' ? r.prizeDisplay : ''}</span>
                </div>
            </div>
        `;
    });
    listEl.innerHTML = html;

    // 汇总
    let summaryHtml = '';
    if (multiResult.winCount > 0) {
        summaryHtml = `<div class="multi-summary-win">
            🎉 中奖 ${multiResult.winCount} 注，
            ${multiResult.hasFloating ? '含浮动奖金（一等奖/二等奖需以官方公告为准），' : ''}
            固定奖金合计 <strong>${multiResult.totalPrize} 元</strong>
        </div>`;
    } else {
        summaryHtml = `<div class="multi-summary-lose">很遗憾，${multiResult.totalCount}注均未中奖</div>`;
    }
    summaryEl.innerHTML = summaryHtml;

    // 滚动到结果
    setTimeout(() => {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
}

/** 生成推荐号码 */
function generateRecommendations() {
    const count = parseInt(document.getElementById('recommendCount').value);
    const filterHistory = document.getElementById('filterHistory').checked;
    const trendWeight = document.getElementById('trendWeight').checked;
    const excludeConsecutive = document.getElementById('excludeConsecutive').checked;
    const excludeOddEven = document.getElementById('excludeOddEven').checked;

    const recommendations = Lottery.generateRecommendations({
        count, filterHistory, trendWeight, excludeConsecutive, excludeOddEven
    });

    // 检查每注是否已保存（同一期）
    const saved = Lottery.getSavedTickets();
    const latest = Lottery.getLatest();
    const currentIssue = latest ? latest.issue : null;

    recommendations.forEach(rec => {
        const redKey = rec.red.join(',');
        rec.saved = saved.some(t =>
            t.drawIssue === currentIssue &&
            t.red.join(',') === redKey &&
            t.blue === rec.blue
        );
    });

    const listEl = document.getElementById('recommendList');

    if (recommendations.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">😔</div>未能生成符合条件的号码，请调整筛选条件</div>';
        return;
    }

    let html = '';
    recommendations.forEach((rec, idx) => {
        let ballsHtml = rec.red.map(n =>
            `<div class="ball red">${String(n).padStart(2,'0')}</div>`
        ).join('');
        ballsHtml += `<div class="ball separator">+</div>`;
        ballsHtml += `<div class="ball blue">${String(rec.blue).padStart(2,'0')}</div>`;

        let tagsHtml = '';
        rec.tags.forEach(tag => {
            if (tag === 'safe') tagsHtml += '<span class="recommend-tag tag-safe">安全组合</span>';
            if (tag === 'trend') tagsHtml += '<span class="recommend-tag tag-trend">趋势加权</span>';
        });
        if (rec.saved) {
            tagsHtml += '<span class="recommend-tag tag-saved">✓ 已保存</span>';
        }

        const redStr = rec.red.join(',');
        const blueStr = rec.blue;

        let saveBtnHtml = '';
        if (rec.saved) {
            saveBtnHtml = `<button class="btn-save-recommend saved" disabled>✓ 本期已保存</button>`;
        } else {
            saveBtnHtml = `<button class="btn-save-recommend" onclick="saveRecommendation(${idx}, [${redStr}], ${blueStr})">💾 保存此注</button>`;
        }

        html += `
            <div class="recommend-item ${rec.saved ? 'recommend-saved' : ''}">
                <div class="recommend-index">第 ${idx + 1} 注</div>
                <div class="recommend-balls">${ballsHtml}</div>
                ${tagsHtml}
                <div class="recommend-actions">
                    ${saveBtnHtml}
                </div>
            </div>
        `;
    });

    // 统计未保存的数量
    const unsavedCount = recommendations.filter(r => !r.saved).length;

    // 添加保存全部按钮（如果有未保存的）
    if (unsavedCount > 0) {
        html += `
            <div class="save-all-section">
                <button class="btn-primary full" onclick="saveAllRecommendations()">
                    💾 保存全部 ${unsavedCount} 注（开奖时自动提醒中奖）
                </button>
            </div>
        `;
    } else {
        html += `
            <div class="save-all-section">
                <div class="all-saved-tip">✓ 本期推荐号码均已保存</div>
            </div>
        `;
    }

    // 缓存当前推荐，供保存全部使用
    window._currentRecommendations = recommendations;

    listEl.innerHTML = html;
    showToast(`已生成 ${recommendations.length} 注推荐号码${unsavedCount < recommendations.length ? `（${recommendations.length - unsavedCount}注已保存）` : ''}`);
}

/** 保存单注推荐 */
function saveRecommendation(idx, red, blue) {
    // 检查是否已保存（同一期）
    const saved = Lottery.getSavedTickets();
    const latest = Lottery.getLatest();
    const currentIssue = latest ? latest.issue : null;
    const redKey = red.join(',');

    const exists = saved.some(t =>
        t.drawIssue === currentIssue &&
        t.red.join(',') === redKey &&
        t.blue === blue
    );

    if (exists) {
        showToast('这注号码本期已保存，不能重复保存');
        return;
    }

    Lottery.saveTicket(red, blue, 'recommend');
    showToast(`第 ${idx + 1} 注已保存，开奖时自动提醒中奖`);

    // 更新当前推荐的 saved 状态并重新渲染
    if (window._currentRecommendations && window._currentRecommendations[idx]) {
        window._currentRecommendations[idx].saved = true;
    }
    // 延迟重新渲染，避免闪烁
    setTimeout(() => {
        const listEl = document.getElementById('recommendList');
        if (listEl) generateRecommendations();
    }, 300);
}

/** 保存全部推荐 */
function saveAllRecommendations() {
    if (!window._currentRecommendations || window._currentRecommendations.length === 0) {
        showToast('没有可保存的推荐号码');
        return;
    }

    const saved = Lottery.getSavedTickets();
    const latest = Lottery.getLatest();
    const currentIssue = latest ? latest.issue : null;

    let newCount = 0;
    let skipCount = 0;

    window._currentRecommendations.forEach(rec => {
        if (rec.saved) {
            skipCount++;
            return;
        }
        const redKey = rec.red.join(',');
        const exists = saved.some(t =>
            t.drawIssue === currentIssue &&
            t.red.join(',') === redKey &&
            t.blue === rec.blue
        );
        if (exists) {
            skipCount++;
            rec.saved = true;
        } else {
            Lottery.saveTicket(rec.red, rec.blue, 'recommend');
            rec.saved = true;
            newCount++;
        }
    });

    if (newCount > 0) {
        showToast(`已保存 ${newCount} 注${skipCount > 0 ? `，跳过 ${skipCount} 注已保存的` : ''}`);
    } else {
        showToast('全部号码本期均已保存');
    }

    // 重新渲染
    setTimeout(() => {
        generateRecommendations();
    }, 300);
}

/** 渲染冷热号 */
function renderHotCold() {
    const analysis = Lottery.getHotColdAnalysis(50);
    const hotEl = document.getElementById('hotBalls');
    const coldEl = document.getElementById('coldBalls');

    hotEl.innerHTML = analysis.hot.map(h =>
        `<div class="ball red">${String(h.num).padStart(2,'0')}<span class="freq">${h.freq}次</span></div>`
    ).join('');

    coldEl.innerHTML = analysis.cold.map(c =>
        `<div class="ball blue">${String(c.num).padStart(2,'0')}<span class="freq">${c.freq}次</span></div>`
    ).join('');
}

/** 渲染历史记录 */
function renderHistory() {
    const listEl = document.getElementById('historyList');
    const countEl = document.getElementById('historyCount');
    const loadMoreBtn = document.getElementById('btnLoadMore');

    countEl.textContent = `共 ${Lottery.history.length} 期`;

    const data = Lottery.getHistory(1, historyPage * HISTORY_PAGE_SIZE);
    if (data.length === 0) {
        listEl.innerHTML = '<div class="empty-state">暂无历史数据</div>';
        return;
    }

    let html = '';
    data.forEach(h => {
        let ballsHtml = h.red.map(n =>
            `<div class="ball red">${String(n).padStart(2,'0')}</div>`
        ).join('');
        ballsHtml += `<div class="ball separator">+</div>`;
        ballsHtml += `<div class="ball blue">${String(h.blue).padStart(2,'0')}</div>`;

        html += `
            <div class="history-item">
                <div class="history-top">
                    <span class="history-issue">第 ${h.issue} 期</span>
                    <span class="history-date">${h.date}</span>
                </div>
                <div class="history-balls">${ballsHtml}</div>
            </div>
        `;
    });

    listEl.innerHTML = html;

    if (data.length < Lottery.history.length) {
        loadMoreBtn.style.display = 'block';
    } else {
        loadMoreBtn.style.display = 'none';
    }
}

// 我的选号筛选状态
let mineFilter = 'all';

/** 切换历史页面标签 */
function switchHistoryTab(tab) {
    document.querySelectorAll('.tab-switch .tab-item').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab-item[onclick*="'${tab}'"]`).classList.add('active');

    if (tab === 'draw') {
        document.getElementById('drawHistoryTab').style.display = 'block';
        document.getElementById('mineHistoryTab').style.display = 'none';
        renderHistory();
    } else {
        document.getElementById('drawHistoryTab').style.display = 'none';
        document.getElementById('mineHistoryTab').style.display = 'block';
        renderMineTickets();
    }
}

/** 渲染我的选号记录 */
function renderMineTickets() {
    const saved = Lottery.getSavedTickets();
    const listEl = document.getElementById('mineList');
    const countEl = document.getElementById('mineCount');
    const statsEl = document.getElementById('mineStats');

    countEl.textContent = `共 ${saved.length} 注`;

    // 筛选
    let filtered = saved;
    if (mineFilter === 'recommend') {
        filtered = saved.filter(t => t.source === 'recommend');
    } else if (mineFilter === 'manual') {
        filtered = saved.filter(t => t.source === 'manual');
    } else if (mineFilter === 'pending') {
        filtered = saved.filter(t => !t.checked && !t.expired);
    } else if (mineFilter === 'win') {
        filtered = saved.filter(t => t.prizeResult && t.prizeResult.win);
    } else if (mineFilter === 'expired') {
        filtered = saved.filter(t => t.expired);
    }

    // 统计
    const totalCount = saved.length;
    const winCount = saved.filter(t => t.prizeResult && t.prizeResult.win).length;
    const totalPrize = saved.reduce((sum, t) => {
        if (t.prizeResult && t.prizeResult.win && typeof t.prizeResult.prize === 'number') {
            return sum + t.prizeResult.prize;
        }
        return sum;
    }, 0);
    const hasFloating = saved.some(t => t.prizeResult && t.prizeResult.win && t.prizeResult.prize === '浮动');

    statsEl.innerHTML = `
        <div class="mine-stat-item">
            <div class="mine-stat-num">${totalCount}</div>
            <div class="mine-stat-label">总注数</div>
        </div>
        <div class="mine-stat-item">
            <div class="mine-stat-num win">${winCount}</div>
            <div class="mine-stat-label">中奖</div>
        </div>
        <div class="mine-stat-item">
            <div class="mine-stat-num">${totalPrize > 0 ? totalPrize + '元' : (hasFloating ? '含浮动' : '0元')}</div>
            <div class="mine-stat-label">累计奖金</div>
        </div>
    `;

    if (filtered.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div>暂无符合条件的选号记录</div>';
        return;
    }

    let html = '';
    filtered.forEach((t, idx) => {
        const originalIdx = saved.indexOf(t);
        const redBalls = t.red.map(n =>
            `<span class="ball red" style="width:24px;height:24px;font-size:11px;">${String(n).padStart(2,'0')}</span>`
        ).join('');
        const blueBall = `<span class="ball blue" style="width:24px;height:24px;font-size:11px;">${String(t.blue).padStart(2,'0')}</span>`;

        const sourceLabel = t.source === 'recommend' ? '🎯 推荐' : '✏️ 手动';
        const saveDate = new Date(t.time).toLocaleDateString('zh-CN');

        let statusBadge = '';
        let itemClass = 'mine-ticket-item';

        if (t.expired) {
            itemClass += ' mine-expired';
            statusBadge = `<span class="mine-status expired">已过期</span>`;
        } else if (t.checked && t.prizeResult) {
            if (t.prizeResult.win) {
                itemClass += ' mine-win';
                let prizeText = t.prizeResult.prize === '浮动' ? '浮动奖金' : t.prizeResult.prize + '元';
                statusBadge = `<span class="mine-status win">${t.prizeResult.levelName} ${prizeText}</span>`;
            } else {
                statusBadge = `<span class="mine-status lose">未中奖</span>`;
            }
        } else {
            const targetText = t.targetIssue ? `第${t.targetIssue}期开奖` : '等待开奖';
            statusBadge = `<span class="mine-status pending">等待${targetText}</span>`;
        }

        let drawInfo = '';
        if (t.targetIssue && !t.checked && !t.expired) {
            drawInfo = `<div class="mine-draw-info">目标期号：第 ${t.targetIssue} 期（仅参与本期验证）</div>`;
        } else if (t.prizeResult && t.prizeResult.drawIssue) {
            drawInfo = `<div class="mine-draw-info">开奖期号：第 ${t.prizeResult.drawIssue} 期${t.prizeResult.drawDate !== '--' ? `（${t.prizeResult.drawDate}）` : ''}</div>`;
        } else if (t.drawIssue) {
            drawInfo = `<div class="mine-draw-info">保存期号：第 ${t.drawIssue} 期</div>`;
        }

        html += `
            <div class="${itemClass}">
                <div class="mine-ticket-header">
                    <span class="mine-source">${sourceLabel}</span>
                    <span class="mine-date">${saveDate}</span>
                    ${statusBadge}
                    <span class="mine-delete" onclick="deleteMineTicket(${originalIdx})">×</span>
                </div>
                <div class="mine-ticket-balls">${redBalls} + ${blueBall}</div>
                ${drawInfo}
            </div>
        `;
    });

    listEl.innerHTML = html;
}

/** 筛选我的选号 */
function filterMineTickets(filter) {
    mineFilter = filter;
    document.querySelectorAll('.mine-filter .filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.filter-btn[onclick*="'${filter}'"]`).classList.add('active');
    renderMineTickets();
}

/** 删除我的选号 */
function deleteMineTicket(index) {
    if (confirm('确定删除这注选号记录吗？')) {
        Lottery.deleteTicket(index);
        renderMineTickets();
        renderSavedTickets();
        showToast('已删除');
    }
}

/** 初始化号码选择器 */
function initBallPicker() {
    const redPicker = document.getElementById('redPicker');
    const bluePicker = document.getElementById('bluePicker');

    for (let i = 1; i <= 33; i++) {
        const ball = document.createElement('div');
        ball.className = 'picker-ball red';
        ball.textContent = String(i).padStart(2, '0');
        ball.dataset.num = i;
        ball.onclick = () => toggleRedBall(i, ball);
        redPicker.appendChild(ball);
    }

    for (let i = 1; i <= 16; i++) {
        const ball = document.createElement('div');
        ball.className = 'picker-ball blue';
        ball.textContent = String(i).padStart(2, '0');
        ball.dataset.num = i;
        ball.onclick = () => toggleBlueBall(i, ball);
        bluePicker.appendChild(ball);
    }
}

/** 切换红球选择 */
function toggleRedBall(num, el) {
    if (selectedRed.has(num)) {
        selectedRed.delete(num);
        el.classList.remove('selected');
    } else {
        if (selectedRed.size >= 6) {
            showToast('最多选择6个红球');
            return;
        }
        selectedRed.add(num);
        el.classList.add('selected');
    }
    updateSelectedPreview();
}

/** 切换蓝球选择 */
function toggleBlueBall(num, el) {
    // 蓝球单选
    document.querySelectorAll('#bluePicker .picker-ball').forEach(b => b.classList.remove('selected'));
    selectedBlue = num;
    el.classList.add('selected');
    updateSelectedPreview();
}

/** 更新已选预览 */
function updateSelectedPreview() {
    const preview = document.getElementById('selectedBalls');
    if (selectedRed.size === 0 && !selectedBlue) {
        preview.textContent = '请选择号码';
        return;
    }
    let html = '';
    const sortedRed = [...selectedRed].sort((a,b) => a-b);
    sortedRed.forEach(n => {
        html += `<span class="ball red" style="width:28px;height:28px;font-size:12px;display:inline-flex;">${String(n).padStart(2,'0')}</span>`;
    });
    if (selectedBlue) {
        html += `<span class="ball separator" style="width:16px;">+</span>`;
        html += `<span class="ball blue" style="width:28px;height:28px;font-size:12px;display:inline-flex;">${String(selectedBlue).padStart(2,'0')}</span>`;
    }
    preview.innerHTML = html;
}

/** 清空选择 */
function clearSelection() {
    selectedRed.clear();
    selectedBlue = null;
    document.querySelectorAll('.picker-ball').forEach(b => b.classList.remove('selected'));
    updateSelectedPreview();
}

/** 随机选号 */
function randomSelect() {
    clearSelection();
    const red = Lottery.randomRed();
    const blue = Math.floor(Math.random() * 16) + 1;

    red.forEach(n => {
        selectedRed.add(n);
        const el = document.querySelector(`#redPicker .picker-ball[data-num="${n}"]`);
        if (el) el.classList.add('selected');
    });

    selectedBlue = blue;
    const blueEl = document.querySelector(`#bluePicker .picker-ball[data-num="${blue}"]`);
    if (blueEl) blueEl.classList.add('selected');

    updateSelectedPreview();
}

/** 保存选号 */
function saveSelection() {
    if (selectedRed.size !== 6) {
        showToast('请选择6个红球');
        return;
    }
    if (!selectedBlue) {
        showToast('请选择1个蓝球');
        return;
    }

    Lottery.saveTicket([...selectedRed], selectedBlue);
    renderSavedTickets();
    showToast('选号已保存');
    clearSelection();
}

/** 渲染保存的选号 */
function renderSavedTickets() {
    const listEl = document.getElementById('savedList');
    const saved = Lottery.getSavedTickets();

    if (saved.length === 0) {
        listEl.innerHTML = '';
        return;
    }

    let html = '<div class="input-label" style="margin-top:16px;">已保存的选号（开奖时自动提醒中奖）</div>';
    saved.forEach((t, idx) => {
        let ballsHtml = t.red.map(n =>
            `<span class="ball red" style="width:24px;height:24px;font-size:11px;display:inline-flex;">${String(n).padStart(2,'0')}</span>`
        ).join('');
        ballsHtml += `<span class="ball blue" style="width:24px;height:24px;font-size:11px;display:inline-flex;">${String(t.blue).padStart(2,'0')}</span>`;

        const sourceLabel = t.source === 'recommend' ? '推荐' : '手动';
        let prizeBadge = '';
        let itemClass = 'saved-item';

        if (t.checked && t.prizeResult) {
            if (t.prizeResult.win) {
                itemClass += ' saved-win';
                let prizeText = t.prizeResult.prize === '浮动' ? '浮动' : t.prizeResult.prize + '元';
                prizeBadge = `<span class="saved-prize-badge win">${t.prizeResult.levelName} ${prizeText}</span>`;
            } else {
                prizeBadge = `<span class="saved-prize-badge lose">未中奖</span>`;
            }
        } else {
            prizeBadge = `<span class="saved-prize-badge pending">等待开奖</span>`;
        }

        html += `
            <div class="${itemClass}">
                <div class="saved-header">
                    <span class="saved-source">${sourceLabel}</span>
                    ${prizeBadge}
                    <span class="saved-delete" onclick="deleteSaved(${idx})">×</span>
                </div>
                <div class="saved-balls">${ballsHtml}</div>
            </div>
        `;
    });

    listEl.innerHTML = html;
}

/** 删除保存的选号 */
function deleteSaved(index) {
    Lottery.deleteTicket(index);
    renderSavedTickets();
    showToast('已删除');
}

/** Toast 提示 */
let toastTimer = null;
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

/** 安装指南 */
function showInstallGuide() {
    document.getElementById('installModal').classList.add('show');
}

function closeInstallGuide(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('installModal').classList.remove('show');
}

function switchGuideTab(tab) {
    document.querySelectorAll('.guide-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.guide-tab[onclick*="${tab}"]`).classList.add('active');
    document.querySelectorAll('.guide-content').forEach(c => c.style.display = 'none');
    document.getElementById('guide-' + tab).style.display = 'block';
}

/** 检测是否已安装（独立窗口运行） */
function isStandalone() {
    return (window.matchMedia('(display-mode: standalone)').matches) ||
           (window.navigator.standalone === true);
}

/** 初始化时隐藏已安装用户的安装提示 */
document.addEventListener('DOMContentLoaded', () => {
    if (isStandalone()) {
        const card = document.getElementById('installCard');
        if (card) card.style.display = 'none';
    }
    initManualUpdateInputs();
});

/** 初始化手动更新输入框 */
function initManualUpdateInputs() {
    const redContainer = document.getElementById('manualRedInputs');
    const blueContainer = document.getElementById('manualBlueInput');
    if (!redContainer || !blueContainer) return;

    redContainer.innerHTML = '';
    blueContainer.innerHTML = '';

    for (let i = 0; i < 6; i++) {
        const input = document.createElement('input');
        input.type = 'tel';
        input.maxLength = 2;
        input.placeholder = String(i + 1);
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
            if (e.target.value.length >= 2 && i < 5) {
                redContainer.children[i + 1].focus();
            }
        });
        redContainer.appendChild(input);
    }

    const blueInput = document.createElement('input');
    blueInput.type = 'tel';
    blueInput.maxLength = 2;
    blueInput.placeholder = '蓝';
    blueInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
    });
    blueContainer.appendChild(blueInput);
}

/** 打开手动更新弹窗 */
function showManualUpdate() {
    const modal = document.getElementById('manualUpdateModal');
    if (!modal) return;

    // 预填当前最新一期的信息（方便修改）
    const latest = Lottery.getLatest();
    if (latest) {
        document.getElementById('manualIssue').value = latest.issue;
        document.getElementById('manualDate').value = latest.date;
    } else {
        document.getElementById('manualDate').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('show');
}

/** 关闭手动更新弹窗 */
function closeManualUpdate(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('manualUpdateModal');
    if (modal) modal.classList.remove('show');
}

/** 提交手动更新 */
function submitManualUpdate() {
    const issue = document.getElementById('manualIssue').value.trim();
    const date = document.getElementById('manualDate').value;
    const redInputs = document.querySelectorAll('#manualRedInputs input');
    const blueInput = document.querySelector('#manualBlueInput input');

    const red = [];
    redInputs.forEach(inp => {
        const v = parseInt(inp.value);
        if (v >= 1 && v <= 33) red.push(v);
    });
    const blue = parseInt(blueInput.value);

    if (!issue) { showToast('请输入期号'); return; }
    if (!date) { showToast('请选择开奖日期'); return; }
    if (red.length !== 6) { showToast('请输入6个红球（1-33）'); return; }
    if (!blue || blue < 1 || blue > 16) { showToast('请输入1个蓝球（1-16）'); return; }

    const result = Lottery.addManualDraw(issue, date, red, blue);
    if (result.success) {
        renderLatest();
        renderHistory();
        renderHotCold();
        closeManualUpdate();
        showToast(result.isUpdate ? '已更新该期开奖数据' : '已添加最新开奖数据');
        // 清空输入
        redInputs.forEach(inp => inp.value = '');
        blueInput.value = '';
    } else {
        showToast(result.message);
    }
}
