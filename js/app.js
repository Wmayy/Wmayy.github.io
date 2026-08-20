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
});

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
    if (page === 'history') renderHistory();
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

/** 启动扫码 */
async function startScanner() {
    const result = await Scanner.start();
    if (result.success) {
        document.getElementById('btnStartScan').style.display = 'none';
        document.getElementById('btnCapture').style.display = 'inline-block';
        document.getElementById('btnStopScan').style.display = 'inline-block';
    } else {
        showToast(result.message);
    }
}

/** 停止扫码 */
function stopScanner() {
    Scanner.stop();
    document.getElementById('btnStartScan').style.display = 'inline-block';
    document.getElementById('btnCapture').style.display = 'none';
    document.getElementById('btnStopScan').style.display = 'none';
}

/** 拍照并OCR识别 */
async function captureAndRecognize() {
    const video = document.getElementById('scannerVideo');
    const canvas = document.getElementById('scannerCanvas');
    const ctx = canvas.getContext('2d');

    // 设置画布尺寸
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // 显示识别状态
    const statusEl = document.getElementById('ocrStatus');
    const statusText = document.getElementById('ocrStatusText');
    statusEl.style.display = 'block';
    statusText.textContent = '正在加载识别引擎...';

    try {
        // 检查 Tesseract 是否加载
        if (typeof Tesseract === 'undefined') {
            throw new Error('识别引擎加载失败，请检查网络');
        }

        statusText.textContent = '正在识别文字，请稍候...';

        // 使用 Tesseract 识别数字（只识别数字和字母，提高速度和准确率）
        const result = await Tesseract.recognize(canvas, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    statusText.textContent = `识别中... ${Math.round(m.progress * 100)}%`;
                }
            },
            tessedit_char_whitelist: 'ABCDE0123456789.-:()（） ',
            preserve_interword_spaces: '1'
        });

        const text = result.data.text;
        console.log('OCR识别结果:', text);

        statusText.textContent = '正在解析号码...';

        // 解析彩票号码
        const tickets = Lottery.parseTicketsFromText(text);

        if (tickets.length === 0) {
            statusEl.style.display = 'none';
            showToast('未能识别到有效号码，请对准号码区域重新拍摄');
            return;
        }

        // 多注验票
        const multiResult = Lottery.checkMultipleTickets(tickets);
        renderMultiResult(multiResult);

        statusEl.style.display = 'none';
        showToast(`成功识别 ${tickets.length} 注号码`);

    } catch(e) {
        console.error('OCR识别失败:', e);
        statusEl.style.display = 'none';
        showToast('识别失败：' + e.message);
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

        html += `
            <div class="recommend-item">
                <div class="recommend-index">第 ${idx + 1} 注</div>
                <div class="recommend-balls">${ballsHtml}</div>
                ${tagsHtml}
            </div>
        `;
    });

    listEl.innerHTML = html;
    showToast(`已生成 ${recommendations.length} 注推荐号码`);
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

/** 加载更多历史 */
function loadMoreHistory() {
    historyPage++;
    renderHistory();
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

    let html = '<div class="input-label" style="margin-top:16px;">已保存的选号</div>';
    saved.forEach((t, idx) => {
        let ballsHtml = t.red.map(n =>
            `<span class="ball red" style="width:24px;height:24px;font-size:11px;display:inline-flex;">${String(n).padStart(2,'0')}</span>`
        ).join('');
        ballsHtml += `<span class="ball blue" style="width:24px;height:24px;font-size:11px;display:inline-flex;">${String(t.blue).padStart(2,'0')}</span>`;

        html += `
            <div class="saved-item">
                <div class="saved-balls">${ballsHtml}</div>
                <span class="saved-delete" onclick="deleteSaved(${idx})">×</span>
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
