// static/js/main.js

// 把所有变量定义放在这里，但先不赋值
let keyboardDiv, authOverlay, pinInput, connectButton, authMessage, physicalKeyboardToggle;
let modeToggle, trackpadArea;
let authToken = null;
let physicalKeyboardEnabled = false;
let connectionstatus = 1;
const activeTouches = {};

// --- 新的“渲染”函数，现在叫 "初始化交互层" ---
function initInteractionLayer() {
    // 1. 找到当前激活的 SVG 布局
    const svgElement = document.querySelector('.keyboard-layout.active-layout');
    if (!svgElement) {
        console.error("No active keyboard layout found!");
        return;
    }

    const interactionLayer = document.getElementById('interaction-layer');
    
    // 清空旧的交互按键 (用于 resize)
    interactionLayer.innerHTML = '';

    // 获取 SVG 容器的位置和尺寸信息
    const svgRect = svgElement.getBoundingClientRect();

    // 依然遍历 <g> 元素来获取 data-key
    const svgKeyGroups = svgElement.querySelectorAll('.key-shape');

    svgKeyGroups.forEach(svgGroup => {
        const keyData = svgGroup.dataset.key;
        if (!keyData) return;

        // --- 关键修正：不获取 <g> 的边界，而是找到它内部的 <rect> ---
        const keyRectElement = svgGroup.querySelector('rect');
        if (!keyRectElement) {
            console.warn(`Key group with data-key="${keyData}" is missing a <rect> element.`);
            return;
        }
        
        // 获取 <rect> 元素的精确位置和尺寸
        const keyRect = keyRectElement.getBoundingClientRect();

        // 创建一个对应的、看不见的交互 div
        const interactionDiv = document.createElement('div');
        interactionDiv.className = 'interaction-key';
        interactionDiv.dataset.key = keyData;

        // 设置它的绝对位置和尺寸
        // 位置是相对于 SVG 容器的
        interactionDiv.style.left = `${keyRect.left - svgRect.left}px`;
        interactionDiv.style.top = `${keyRect.top - svgRect.top}px`;
        interactionDiv.style.width = `${keyRect.width}px`;
        interactionDiv.style.height = `${keyRect.height}px`;

        // 把这个交互 div 添加到交互层
        interactionLayer.appendChild(interactionDiv);
    });
}

// === 全新的键盘布局切换函数 ===
function switchLayout(layoutName) {
    // 1. 移除所有布局的 .active-layout class，并隐藏它们
    document.querySelectorAll('.keyboard-layout').forEach(svg => {
        svg.classList.remove('active-layout');
        svg.style.display = 'none';
    });

    // 2. 找到目标布局，给它 .active-layout class，并显示它
    const targetLayout = document.querySelector(`.keyboard-layout[data-layout="${layoutName}"]`);
    if (targetLayout) {
        targetLayout.classList.add('active-layout');
        targetLayout.style.display = 'block';

        // 3. 关键：为新的布局重新生成交互层
        initInteractionLayer();
    }
}



// --- 认证核心逻辑 ---
function showAuthScreen(message = '') {
    if (authOverlay) {
        authOverlay.style.display = 'flex';
    }
    if (authMessage) {
        authMessage.textContent = message;
    }
    authToken = null;
    localStorage.removeItem('webKeyboardAuthToken');
}

function hideAuthScreen() {
    if (authOverlay) {
        authOverlay.style.display = 'none';
    }
}

async function authenticateWithPin() {
    const pin = pinInput.value;
    if (pin.length !== 6) {
        authMessage.textContent = 'PIN 必须是 6 位数';
        return;
    }

    try {
        const response = await fetch('/auth/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pin }),
        });

        if (response.ok) {
            const data = await response.json();
            // 正确的执行顺序
            authToken = data.token;
            localStorage.setItem('webKeyboardAuthToken', authToken);
            hideAuthScreen();
            // === 关键：认证成功后，才开始建立 WebSocket 连接 ===
            if (socket) socket.disconnect(); // 断开旧的连接
            setupSocketIO();
        } else {
            const data = await response.json().catch(() => ({ message: '认证失败' }));
            authMessage.textContent = data.message;
        }
    } catch (error) {
        console.error('PIN 认证网络请求失败:', error);
        authMessage.textContent = '连接服务器失败 (网络错误)';
    }
}

// --- 事件发送 (修改后) ---
// 新的事件发送函数，现在它只是简单地 emit 事件
function sendKeyEvent(key, action) {
    if (socket && authToken) {
        socket.emit('key_event', { key, action, token: authToken });
    }
}

function sendtextEvent(text) {
    if (socket && authToken) {
        socket.emit('text_event', { text, token: authToken });
    }
}

async function sendclipboardText() {
  try {
    const text = await navigator.clipboard.readText();
    debounce(sendtextEvent(text),100);
  } catch (error) {
    console.error(error.message);
  }
}


// --- 修改事件监听逻辑，现在监听交互层 ---
function setupEventListeners() {
    const interactionLayer = document.getElementById('interaction-layer');

    let activeTouches = {};
    let physicalKeyboardEnabled = false;

    // --- 统一的 Press 和 Release 处理器 ---
    const handlePress = (keyData) => {
        if (!keyData) return;
        // 视觉反馈：给对应的 SVG 元素添加 .pressed class
        // 找到当前激活的 SVG
        const activeSVG = document.querySelector('.keyboard-layout.active-layout');
        if (!activeSVG) return;
        
        const svgKey = activeSVG.querySelector(`.key-shape[data-key="${keyData}"]`);
        if (svgKey) svgKey.classList.add('pressed');
        // --- 关键改动：解析组合键 ---
        const keys = keyData.split('|');

        // 如果是组合键
        if (keys.length > 1) {
            // 先按下所有的修饰键 (除了最后一个)
            for (let i = 0; i < keys.length - 1; i++) {
                sendKeyEvent(keys[i], 'down');
            }
            // 然后按下并立即抬起主键 (最后一个键)
            const mainKey = keys[keys.length - 1];
            sendKeyEvent(mainKey, 'down');
            // 我们可以加一个非常短暂的延时再抬起，模拟真实操作
            setTimeout(() => {
                sendKeyEvent(mainKey, 'up');
                // 最后，按相反的顺序抬起所有修饰键
                for (let i = keys.length - 2; i >= 0; i--) {
                    sendKeyEvent(keys[i], 'up');
                }
            }, 50); // 50ms 的延时，感觉更像一次“敲击”
        } 
        // 如果是单个按键
        else {
            sendKeyEvent(keyData, 'down'); // 发送事件 (WebSocket)
        }
    };

    const handleRelease = (keyData) => {
        if (!keyData) return;

        const activeSVG = document.querySelector('.keyboard-layout.active-layout');
        if (!activeSVG) return;
        
        const svgKey = activeSVG.querySelector(`.key-shape[data-key="${keyData}"]`);
        if (svgKey) svgKey.classList.remove('pressed');

        const keys = keyData.split('|');

        // --- 关键改动：只处理单个按键的抬起 ---
        // 组合键的抬起逻辑已经在 handlePress 中处理完了
        if (keys.length === 1) {
            sendKeyEvent(keyData, 'up');
        }
        // 对于组合键，抬起时不执行任何操作，因为它的生命周期在按下时就已完成
    };

    // --- 触控事件 (作用于交互层) ---
    interactionLayer.addEventListener('touchstart', (e) => {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (target && target.classList.contains('interaction-key')) {
                activeTouches[touch.identifier] = target;
                handlePress(target.dataset.key);
            }
        }
    });

    interactionLayer.addEventListener('touchend', (e) => {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const target = activeTouches[touch.identifier];
            if (target) {
                handleRelease(target.dataset.key);
                delete activeTouches[touch.identifier];
            }
        }
    });

    // touchcancel 也很重要
    interactionLayer.addEventListener('touchcancel', (e) => {
        // 行为和 touchend 类似
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const target = activeTouches[touch.identifier];
            if (target) {
                handleRelease(target.dataset.key);
                delete activeTouches[touch.identifier];
            }
        }
    });
    
    // --- 鼠标事件 (也作用于交互层，用于桌面端调试) ---
    let isMouseDown = false;
    let lastMouseDownKey = null;
    
    interactionLayer.addEventListener('mousedown', (e) => {
        const target = e.target;
        if (target?.classList.contains('interaction-key')) {
            isMouseDown = true;
            lastMouseDownKey = target.dataset.key;
            handlePress(lastMouseDownKey);
        }
    });

    // 监听 document 的 mouseup，这样即使鼠标拖到别处松开也能触发
    document.addEventListener('mouseup', () => {
        if (isMouseDown && lastMouseDownKey) {
            handleRelease(lastMouseDownKey);
        }
        isMouseDown = false;
        lastMouseDownKey = null;
    });

    // --- 物理键盘事件 (作用于全局 window) ---
    physicalKeyboardToggle.addEventListener('change', (e) => {
        physicalKeyboardEnabled = e.target.checked;
        console.log(`物理键盘映射已 ${physicalKeyboardEnabled ? '启用' : '禁用'}`);
    });
    
    window.addEventListener('keydown', (e) => {
        if (!physicalKeyboardEnabled) return;
        
        // 阻止浏览器的默认行为，比如输入文字、触发快捷键等
        e.preventDefault();

        // 如果按键一直按着，浏览器会连续触发 keydown，我们只处理第一次
        if (e.repeat) return;
        
        // 将浏览器的 event.key 转换为我们的 data-key
        const key = normalizeForClientMap(e);

        handlePress(key);
    });

    window.addEventListener('keyup', (e) => {
        if (!physicalKeyboardEnabled) return;
        e.preventDefault();
        if (e.repeat) return;
        const key = normalizeForClientMap(e);
        handleRelease(key);
    });

}

const CODE_TO_BASE = {
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
  ControlLeft: 'ctrl_l',
  ControlRight: 'ctrl_r',
  ShiftLeft: 'shift_l',
  ShiftRight: 'shift_r',
  AltLeft: 'alt_l',
  AltRight: 'alt_r',
  MetaLeft: 'cmd_l',
  MetaRight: 'cmd_r'
};

// 客户端的按键名到我们 data-key 的映射表
// 因为 event.key 的值可能和我们自定义的 data-key 不完全一致
const CLIENT_KEY_MAP = {
    'arrowup': 'up',
    'arrowdown': 'down',
    'arrowleft': 'left',
    'arrowright': 'right',
    'capslock': 'caps_lock',
    'control': 'ctrl',
    'meta': 'cmd',
    'shift': 'shift',
    'escape': 'esc',
    'printscreen': 'print_screen',
    'pageup': 'page_up',
    'pagedown': 'page_down',
    'numlock': 'num_lock',
    'scrolllock': 'scroll_lock',
    ' ': ' ',
};

function baseFromEvent(e) {
  const code = e.code || '';
  if (code.startsWith('Key')) return code.slice(3).toLowerCase(); // KeyA -> 'a'
  if (code.startsWith('Digit')) return code.slice(5); // Digit1 -> '1'
  if (CODE_TO_BASE[code]) return CODE_TO_BASE[code];
  // 回退：如果没有 code 或不在映射中，用 e.key 的“去 Shift”形式（字母小写）
  const k = e.key || '';
  return k.length === 1 ? k.toLowerCase() : k; // 非单字符按原样或按 CLIENT_KEY_MAP 处理
}

function normalizeForClientMap(e) {
  const base = baseFromEvent(e);
  // CLIENT_KEY_MAP 优先映射 base（未被 Shift 修改的字符）
  const base2 = base.toLowerCase();
  return CLIENT_KEY_MAP[base2] || base2;
}

// (需要一个 debounce 工具函数来防止事件过于频繁地触发)
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// --- 主程序入口和事件监听 ---
window.addEventListener('DOMContentLoaded', () => {
    // 关键：在这里初始化所有 DOM 相关的变量
    keyboardDiv = document.getElementById('keyboard');
    authOverlay = document.getElementById('auth-overlay');
    pinInput = document.getElementById('pin-input');
    connectButton = document.getElementById('connect-button');
    authMessage = document.getElementById('auth-message');
    physicalKeyboardToggle = document.getElementById('physical-keyboard-toggle');
    modeToggle = document.getElementById('mode-toggle');
    trackpadArea = document.getElementById('trackpad-area');

    const themeToggle = document.getElementById('theme-toggle');
    // 防止初次闪烁：在CSS里默认隐藏过渡，JS加载后再启用
    //document.documentElement.style.setProperty('--transition', '0ms');

    // 初始化主题
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentTheme = saved || (prefersDark ? 'dark' : 'light');
    if (currentTheme === 'dark') themeToggle.checked = true;
    
    requestAnimationFrame(() => {
    document.documentElement.style.setProperty('--transition', '300ms cubic-bezier(.2,.9,.2,1)');
    });

    // 切换事件（使用 classList.toggle/replace 更稳健）
    themeToggle.addEventListener('change', (e) => {
    const next = e.target.checked ? 'dark' : 'light';
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${next}`);
    localStorage.setItem('theme', next);
    });

    // 模式切换逻辑
    modeToggle.addEventListener('change', (e) => {
        if (e.target.value === 'trackpad') {
            document.body.classList.add('trackpad-mode');
        } else{
            document.body.classList.remove('trackpad-mode');
            switchLayout(e.target.value);
        }
    });

      const wrap = document.getElementById('fabWrap');
      const main = document.getElementById('fabMain');
      const popList = document.getElementById('popList');

      let open = false;
      function setOpen(state){
        open = !!state;
        wrap.classList.toggle('open', open);
        main.setAttribute('aria-expanded', String(open));
        wrap.setAttribute('aria-expanded', String(open));
        popList.setAttribute('aria-hidden', String(!open));
        // 动画后如果关闭则禁用弹出项的 pointer-events（保持流畅）
        if(!open){
          // 允许动画完成后禁用
          setTimeout(()=> {
            // no-op here (pointer-events controlled by CSS .open), kept for extensibility
          }, 250);
        }
      }

      main.addEventListener('click', (e) => {
        setOpen(!open);
      });

      // 点击弹出按钮的处理示例
      document.getElementById('pop1').addEventListener('click', async () => {
        // 在这里放置按钮1的行为
        const inputElement = document.getElementById('input-area-container'); // 或其他你想全屏的元素

        let wakeLock = null;

        try {
            if (document.fullscreenElement) {
                // 退出全屏
                await document.exitFullscreen();
                if (wakeLock) await wakeLock.release();
                wakeLock = null;
            } else {
                // 进入全屏
                await inputElement.requestFullscreen();
                // 请求屏幕常亮
                if ('wakeLock' in navigator) {
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('屏幕常亮已激活');
                }
            }
        } catch(err) {
            console.error(`全屏或屏幕常亮失败: ${err.name}`, err.message);
        }
        setOpen(false);
      });
      document.getElementById('pop2').addEventListener('click', () => {
        // 在这里放置按钮2的行为
        sendclipboardText();
        setOpen(false);
      });

      // 点击页面其他地方关闭菜单（可选）
      document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target) && open) setOpen(false);
      });

    // 绑定触控板事件
    setupTrackpadListeners();

    // 渲染键盘
    switchLayout("default");
    //initInteractionLayer();
    // 监听事件
    setupEventListeners();

    // 监听窗口大小变化，重新计算交互层
    window.addEventListener('resize', debounce(initInteractionLayer, 100));

    // 绑定认证按钮事件
    connectButton.addEventListener('click', authenticateWithPin);
    pinInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') authenticateWithPin();
    });
    
    // 尝试从本地加载令牌
    const storedToken = localStorage.getItem('webKeyboardAuthToken');
    if (storedToken) {
        authToken = storedToken;
        hideAuthScreen();
        console.log("已加载本地认证令牌。");
        // 我们假设它是有效的。第一次发送事件时会进行最终验证。
        // 如果有令牌，直接尝试连接 WebSocket
        setupSocketIO();
    } else {
        showAuthScreen();
        console.log("未找到本地令牌，需要认证。");
    }

});

// === 新增：触控板手势识别核心 ===

// === 替换/新增：触控板逻辑的全局变量 ===

// 手势识别常量
const TAP_TIMEOUT = 250;       // 单击超时，适当延长以容错
const DOUBLE_TAP_WINDOW = 350; // 双击间隔
const DRAG_THRESHOLD = 5;      // 移动多少像素后算作移动/拖拽

let socket;

// === 替换/重写 sendKeyEvent 和 sendMouseEvent ===
function setupSocketIO() {
    // 建立连接
    socket = io({
        secure: true, // 因为我们用了 https
        auth: {
            token: authToken  // 在 handshake 中发送 token
        },
        reconnection: true,
        reconnectionAttempts: 5,  // 最多重连 5 次
        reconnectionDelay: 2000,  // 每次重连间隔 2 秒
    });

    socket.on('connect', () => {
        console.log('Socket.IO connected!');
        hideAuthScreen(); // 连接成功后隐藏认证界面
        updateStatus(3);
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket.IO disconnected:', reason);
        // 断网、刷新、服务器重启可能都引发这个事件
        // 不做 token 清理
        if (reason === 'io client disconnect') {
            // Client 手动断开
        } else {
            console.log('连接中断，正在重连...');
            updateStatus(2);
        }
    });

    socket.on('connect_error', (reason) => {
        console.error('connect_error:', reason);
        // 检查服务器发回的错误是否是认证失败
        if (reason == 'Error: Connection refused by server') {
            console.warn('Token 失效，需重新认证');
            showAuthScreen('认证失效，请重新登录');
        } else {
            console.log('连接失败，将尝试重新连接...');
            updateStatus(2);
        }
    });

    socket.io.on('reconnect_failed', () => {
        console.warn("重连失败，放弃重试。");
        console.log("连接失败，请点击重试");
        updateStatus(1);
    });

    // 如果需要，可以监听服务器发来的错误信息
    socket.on('error', (data) => {
        console.error('Socket.IO error:', data.message);
    });
}

function updateStatus(status) {
    connectionstatus = status;
    const el = document.getElementById('connection-status');
    if (connectionstatus == 1) {
        el.innerHTML = `<span class="status-dot red"></span> 断线中，点击连接`;
        // 手动重连
        el.onclick = () => {
            if (connectionstatus == 1) {
                setupSocketIO();   // 重新 init socket
            }
        };
    } else if (connectionstatus == 2) {
        el.innerHTML = `<span class="status-dot yellow"></span> 尝试连接中`;
        el.onclick = null;
    } else if (connectionstatus == 3) {
        el.innerHTML = `<span class="status-dot green"></span> 已连接`;
        el.onclick = null;
    }
}

// 状态机变量
let touchState = {
    startX: 0, startY: 0, // 本次触摸的起始点
    lastX: 0, lastY: 0,   // 上一个移动事件的点
    startTime: 0,         // 本次触摸的开始时间
    
    isTap: true,          // 是否可能是一次点击？
    isDragging: false,    // 是否是拖拽状态？
    
    // 多指相关
    isMultiTouch: false,  // 是否是多指触摸？
    isScrolling: false,   // 是否是滚动状态？
    inMultiTouchCooldown: false, // 是否在多指触摸的冷却期

    // 单击/双击相关
    lastTapTime: 0,
    tapCount: 0,
    tapTimer: null,

    // 用于低通滤波的平滑坐标
    smoothX: 0,
    smoothY: 0,
    isFirstMove: true // 标记是否是移动的第一次事件
};

// 鼠标速度/滚动速度系数
const MOUSE_SPEED_FACTOR = 3.5; // 可以调整
const SCROLL_SPEED_FACTOR = 0.1; // 可以调整

// === 新增：低通滤波器的权重 ===
// 这个值在 0 到 1 之间。值越小，平滑效果越强，但跟随感会略有下降（感觉“黏”一些）。
// 值越大，跟随感越强，但平滑效果越弱。0.2 是一个不错的起始值。
const SMOOTHING_FACTOR = 0.2; 

// 新的鼠标事件发送函数，现在它只是简单地 emit 事件
function sendMouseEvent(type, payload = {}) {
    if (socket && authToken) {
        payload.type = type;
        payload.token = authToken;
        socket.emit('mouse_event', payload);
        //alert("sendMouseEvent")
    }
}

// === 全新设计的 setupTrackpadListeners 函数 ===
function setupTrackpadListeners() {
    
    // --- TOUCH START ---
    trackpadArea.addEventListener('touchstart', (e) => {
        e.preventDefault();
        
        const touches = e.touches;
        const touch = touches[0];
        const currentTime = new Date().getTime();
        // --- 关键：在触摸开始时，用当前手指位置重置平滑坐标和滤波器 ---
        touchState.smoothX = touch.clientX;
        touchState.smoothY = touch.clientY;
        touchState.isFirstMove = true;

        // --- 关键修正：如果正在多指冷却期，忽略新的触摸事件 ---
        if (touchState.inMultiTouchCooldown) {
            return;
        }
        // --- 当从单指变为多指时，进入冷却期 ---
        if (touches.length > 1 && !touchState.isMultiTouch) {
            touchState.inMultiTouchCooldown = true;
            // 设置一个短暂的冷却时间，比如 100ms
            setTimeout(() => {
                touchState.inMultiTouchCooldown = false;
            }, 100);
        }

        // --- 重置大部分状态 ---
        clearTimeout(touchState.tapTimer);
        touchState.isTap = true;
        touchState.isDragging = false;
        touchState.isScrolling = false;

        // --- 记录初始状态 ---
        touchState.startX = touch.clientX;
        touchState.startY = touch.clientY;
        touchState.lastX = touch.clientX;
        touchState.lastY = touch.clientY;
        touchState.startTime = currentTime;

        if (touches.length > 1) {
            touchState.isMultiTouch = true;
        } else {
            touchState.isMultiTouch = false;
            // 处理单击/双击计数
            if (currentTime - touchState.lastTapTime < DOUBLE_TAP_WINDOW) {
                touchState.tapCount++;
            } else {
                touchState.tapCount = 1;
            }
            touchState.lastTapTime = currentTime;
        }
    });

    // --- TOUCH MOVE ---
    trackpadArea.addEventListener('touchmove', (e) => {
        e.preventDefault();
        
        const touches = e.touches;
        if (touches.length === 0) return;
        
        const touch = touches[0];

        // 计算从开始到现在的总位移
        const totalMoveX = touch.clientX - touchState.startX;
        const totalMoveY = touch.clientY - touchState.startY;
        const moveDistance = Math.sqrt(totalMoveX * totalMoveX + totalMoveY * totalMoveY);

    // --- 单指移动的全新处理方式 ---
    
        // 1. 应用低通滤波器
        // 公式: smooth_coord = (current_coord * factor) + (previous_smooth_coord * (1 - factor))
        touchState.smoothX = (touch.clientX * SMOOTHING_FACTOR) + (touchState.smoothX * (1.0 - SMOOTHING_FACTOR));
        touchState.smoothY = (touch.clientY * SMOOTHING_FACTOR) + (touchState.smoothY * (1.0 - SMOOTHING_FACTOR));

        // 2. 计算平滑后的位移
        // 如果是第一次移动，位移是相对于触摸起始点的平滑位置
        // 否则，是相对于上一次的平滑位置
        let dx1, dy1;
        if (touchState.isFirstMove) {
            dx1 = touchState.smoothX - touchState.startX;
            dy1 = touchState.smoothY - touchState.startY;
            touchState.isFirstMove = false;
        } else {
            dx1 = touchState.smoothX - touchState.lastX;
            dy1 = touchState.smoothY - touchState.lastY;
        }

        // --- 只要移动超过阈值，就不再可能是点击 ---
        if (moveDistance > DRAG_THRESHOLD) {
            touchState.isTap = false;
        }

        // 如果不是点击，才处理移动相关逻辑
        if (!touchState.isTap) {
            // -- 多指移动 -> 滚动 --
            if (touches.length > 1) {
                touchState.isScrolling = true;
                sendMouseEvent('scroll', { dx1: 0, dy: dy1 * SCROLL_SPEED_FACTOR });
            } 
            // -- 单指移动 --
            else if (!touchState.isMultiTouch) { // 确保不是从多指变回单指
                // -- 双击并拖动 -> 拖拽 --
                if (touchState.tapCount >= 2 && !touchState.isDragging) {
                    touchState.isDragging = true;
                    sendMouseEvent('press', { button: 'left' });
                }
                // -- 普通移动/拖拽中 --
                // 在 touchmove 的 sendMouseEvent('move', ...) 前面加一行
                //if (new Date().getTime() - touchState.lastMoveTime < 30) return; // 简易节流
                touchState.lastMoveTime = new Date().getTime();

                sendMouseEvent('move', { dx: dx1 * MOUSE_SPEED_FACTOR, dy: dy1 * MOUSE_SPEED_FACTOR });
            }
        }
        
        touchState.lastX = touch.clientX;
        touchState.lastY = touch.clientY;
        // 5. 更新“上一次”的平滑坐标
        touchState.lastX = touchState.smoothX;
        touchState.lastY = touchState.smoothY;
    });

    // --- TOUCH END ---
    trackpadArea.addEventListener('touchend', (e) => {
        e.preventDefault();

        // --- 关键修正：只有当所有手指都抬起时，才处理点击逻辑 ---
        // e.touches.length 是屏幕上【还剩下】的手指数
        if (e.touches.length > 0) {
            return; // 还有手指在屏幕上，不是手势的结束
        }

        // (现在，当代码执行到这里时，我们能确保这是最后一个手指抬起的时刻)
        
        // --- 拖拽结束 ---
        if (touchState.isDragging) {
            sendMouseEvent('release', { button: 'left' });
            touchState.isDragging = false;
            touchState.tapCount = 0; // 重置
            return; // 拖拽结束，不再处理任何点击
        }

        // --- 滚动结束 ---
        if (touchState.isScrolling) {
            touchState.isScrolling = false;
            return; // 滚动结束，不再处理任何点击
        }

        // --- 处理点击事件 ---
        // 只有当 isTap 标志位仍然为 true 时，才可能是点击
        if (touchState.isTap) {
            // -- 多指点击 -> 右键 --
            if (touchState.isMultiTouch) {
                // 因为现在只有在所有手指抬起时才触发，所以这里只会执行一次
                sendMouseEvent('click', { button: 'right' });
                // 重置 tapCount 防止干扰
                touchState.tapCount = 0; 
            }
            // -- 单指点击 -> 左键 --
            else {
                // 用计时器来区分单击和双击的开始
                if (touchState.tapCount === 1) {
                    touchState.tapTimer = setTimeout(() => {
                        sendMouseEvent('click', { button: 'left' });
                    }, TAP_TIMEOUT);
                } 
                // 如果是双击（第二次点击），则不发任何事件，等待拖动
                // 真正的双击左键行为在现实中很少用，我们简化为“双击并拖动”（才不是，你就从来不用双击打开文件吗￣へ￣）
                // 双击
                else if (touchState.tapCount >= 2) {
                    // 清除可能存在的单击计时器
                    clearTimeout(touchState.tapTimer);
                    // 立即发送第二次左键点击
                    sendMouseEvent('click', { button: 'left' });
                    // 重置 tapCount
                    touchState.tapCount = 0;
                }
            }
        }
    });
}