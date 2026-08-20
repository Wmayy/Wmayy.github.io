/**
 * 扫码模块 - 使用 jsQR 识别二维码/条码
 */
const Scanner = {
    video: null,
    canvas: null,
    ctx: null,
    stream: null,
    scanning: false,
    animationId: null,

    /** 初始化 */
    init() {
        this.video = document.getElementById('scannerVideo');
        this.canvas = document.getElementById('scannerCanvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    },

    /** 启动相机扫码 */
    async start() {
        if (this.scanning) return;
        this.init();

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            this.video.srcObject = this.stream;
            await this.video.play();

            document.getElementById('scannerPlaceholder').style.display = 'none';
            document.getElementById('btnStartScan').style.display = 'none';
            document.getElementById('btnStopScan').style.display = 'block';

            this.scanning = true;
            this.tick();
            return { success: true };
        } catch(e) {
            console.error('Camera error:', e);
            return { success: false, message: '无法访问相机，请检查权限或使用手动输入' };
        }
    },

    /** 停止扫码 */
    stop() {
        this.scanning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.video.srcObject = null;

        document.getElementById('scannerPlaceholder').style.display = 'flex';
        document.getElementById('btnStartScan').style.display = 'block';
        document.getElementById('btnStopScan').style.display = 'none';
    },

    /** 扫描循环 */
    tick() {
        if (!this.scanning) return;

        if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert'
            });

            if (code && code.data) {
                this.onScanSuccess(code.data);
                return;
            }
        }

        this.animationId = requestAnimationFrame(() => this.tick());
    },

    /** 扫码成功回调 */
    onScanSuccess(data) {
        this.stop();
        showToast('扫码成功：' + data.substring(0, 30));

        // 尝试从扫码内容解析号码
        const parsed = this.parseTicketData(data);
        if (parsed) {
            // 填充到手动输入框
            this.fillManualInput(parsed.red, parsed.blue);
            setTimeout(() => checkManualTicket(), 500);
        } else {
            showToast('未能识别彩票号码，请手动输入');
        }
    },

    /**
     * 解析彩票数据
     * 彩票二维码通常包含期号、号码等信息，格式因地区而异
     * 尝试多种格式解析
     */
    parseTicketData(data) {
        if (!data) return null;
        const str = String(data);

        // 尝试匹配 6个红球(1-33) + 1个蓝球(1-16)
        // 格式1: 逗号分隔 "01,02,03,04,05,06+07"
        let m = str.match(/(\d{1,2})[,\s]+(\d{1,2})[,\s]+(\d{1,2})[,\s]+(\d{1,2})[,\s]+(\d{1,2})[,\s]+(\d{1,2})[+\s|]+(\d{1,2})/);
        if (m) {
            const red = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])]
                .filter(n => n >= 1 && n <= 33);
            const blue = Number(m[7]);
            if (red.length === 6 && blue >= 1 && blue <= 16) {
                return { red: red.sort((a,b)=>a-b), blue };
            }
        }

        // 格式2: 纯数字串 12位红球(每2位) + 2位蓝球
        m = str.match(/(\d{12})(\d{2})/);
        if (m) {
            const red = [];
            for (let i = 0; i < 6; i++) {
                red.push(Number(m[1].substring(i*2, i*2+2)));
            }
            const blue = Number(m[2]);
            const validRed = red.filter(n => n >= 1 && n <= 33);
            if (validRed.length === 6 && blue >= 1 && blue <= 16) {
                return { red: validRed.sort((a,b)=>a-b), blue };
            }
        }

        return null;
    },

    /** 填充手动输入 */
    fillManualInput(red, blue) {
        const redInputs = document.querySelectorAll('#redInputs input');
        red.forEach((n, i) => {
            if (redInputs[i]) redInputs[i].value = n;
        });
        const blueInput = document.querySelector('#blueInput input');
        if (blueInput) blueInput.value = blue;
    }
};
