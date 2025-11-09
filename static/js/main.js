// static/js/main.js

// 把所有变量定义放在这里，但先不赋值
let keyboardDiv, authOverlay, pinInput, connectButton, authMessage, physicalKeyboardToggle;
let modeToggle, trackpadArea;
let authToken = null;
let physicalKeyboardEnabled = false;
const activeTouches = {};

// ... (keyboardLayout, CLIENT_KEY_MAP 数据定义保持不变) ...

const keyboardLayout = [
    [ // 第一行: Esc 到 Del
        { key: 'esc', display: 'Esc', u: 15/14 },
        { key: 'f1', display: 'F1', u: 15/14 },
        { key: 'f2', display: 'F2', u: 15/14 },
        { key: 'f3', display: 'F3', u: 15/14 },
        { key: 'f4', display: 'F4', u: 15/14 },
        { key: 'f5', display: 'F5', u: 15/14 },
        { key: 'f6', display: 'F6', u: 15/14 },
        { key: 'f7', display: 'F7', u: 15/14 },
        { key: 'f8', display: 'F8', u: 15/14 },
        { key: 'f9', display: 'F9', u: 15/14 },
        { key: 'f10', display: 'F10', u: 15/14 },
        { key: 'f11', display: 'F11', u: 15/14 },
        { key: 'f12', display: 'F12', u: 15/14 },
        { key: 'del', display: 'del', u: 15/14 }
    ],
    [ // 第二行: ~ 到 Backspace
        { key: '`', display: '`', u: 1 }, { key: '1', display: '1', u: 1 },
        { key: '2', display: '2', u: 1 }, { key: '3', display: '3', u: 1 },
        { key: '4', display: '4', u: 1 }, { key: '5', display: '5', u: 1 },
        { key: '6', display: '6', u: 1 }, { key: '7', display: '7', u: 1 },
        { key: '8', display: '8', u: 1 }, { key: '9', display: '9', u: 1 },
        { key: '0', display: '0', u: 1 }, { key: '-', display: '-', u: 1 },
        { key: '=', display: '=', u: 1 }, { key: 'backspace', display: '⌫', u: 2 }
    ],
    [ // 第三行: Tab 到 \
        { key: 'tab', display: 'Tab', u: 1.5 }, { key: 'q', display: 'Q', u: 1 },
        { key: 'w', display: 'W', u: 1 }, { key: 'e', display: 'E', u: 1 },
        { key: 'r', display: 'R', u: 1 }, { key: 't', display: 'T', u: 1 },
        { key: 'y', display: 'Y', u: 1 }, { key: 'u', display: 'U', u: 1 },
        { key: 'i', display: 'I', u: 1 }, { key: 'o', display: 'O', u: 1 },
        { key: 'p', display: 'P', u: 1 }, { key: '[', display: '[', u: 1 },
        { key: ']', display: ']', u: 1 }, { key: '\\', display: '|', u: 1.5 }
    ],
    [ // 第四行: Caps 到 Enter
        { key: 'caps_lock', display: 'Caps', u: 1.8 }, { key: 'a', display: 'A', u: 1 },
        { key: 's', display: 'S', u: 1 }, { key: 'd', display: 'D', u: 1 },
        { key: 'f', display: 'F', u: 1 }, { key: 'g', display: 'G', u: 1 },
        { key: 'h', display: 'H', u: 1 }, { key: 'j', display: 'J', u: 1 },
        { key: 'k', display: 'K', u: 1 }, { key: 'l', display: 'L', u: 1 },
        { key: ';', display: ';', u: 1 }, { key: "'", display: "'", u: 1 },
        { key: 'enter', display: 'Enter', u: 13.7/6 }
    ],
    [ // 第五行: Shift 到 Shift
        { key: 'shift_l', display: 'Shift', u: 2.4 }, { key: 'z', display: 'Z', u: 1 },
        { key: 'x', display: 'X', u: 1 }, { key: 'c', display: 'C', u: 1 },
        { key: 'v', display: 'V', u: 1 }, { key: 'b', display: 'B', u: 1 },
        { key: 'n', display: 'N', u: 1 }, { key: 'm', display: 'M', u: 1 },
        { key: ',', display: '<', u: 1 }, { key: '.', display: '>', u: 1 },
        { key: '/', display: '?', u: 1 }, { key: 'shift_r', display: 'Shift', u: 16.6/6 }
    ],
    [ // 第六行: Ctrl 到 Ctrl
        { key: 'ctrl_l', display: 'Ctrl', u: 1 },
        { key: 'fn', display: 'Fn', u: 1 },
        { key: 'cmd', display: 'Win', u: 1 },
        { key: 'alt_l', display: 'Alt', u: 1.25 },
        { key: ' ', display: 'Space', u: 5.885 },
        { key: 'alt_r', display: 'Alt', u: 1.25 },
        { key: 'ctrl_r', display: 'Ctrl', u: 1 },
        { key: 'left', display: '←', u: 1 },
        { 
            key: 'arrow_up_down', u: 1, class: 'key-container vertical',
            subKeys: [{ key: 'up', display: '↑' }, { key: 'down', display: '↓' }]
        },
        { key: 'right', display: '→', u: 1 }
    ]
];

// 客户端的按键名到我们 data-key 的映射表
// 因为 event.key 的值可能和我们自定义的 data-key 不完全一致
const CLIENT_KEY_MAP = {
    'Control': 'ctrl_l', // 我们不区分左右，统一发左边
    'Shift': 'shift_l',
    'Alt': 'alt_l',
    'Meta': 'cmd',         // macOS 的 Command 或 Windows 的 Win 键
    'ArrowUp': 'up',
    'ArrowDown': 'down',
    'ArrowLeft': 'left',
    'ArrowRight': 'right',
    'CapsLock': 'caps_lock',
    ' ': ' ' // 空格键 event.key 就是一个空格
};

function renderKeyboard() {
    keyboardDiv.innerHTML = ''; // 清空
    keyboardLayout.forEach(rowLayout => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'row';

        rowLayout.forEach(keyInfo => {
            const keyDiv = document.createElement('div');
            keyDiv.className = 'key';
            keyDiv.dataset.key = keyInfo.key || keyInfo.display;

            // 如果 u 值不是 1，就设置 --key-u 变量
            if (keyInfo.u && keyInfo.u !== 1) {
                keyDiv.style.setProperty('--key-u', keyInfo.u);
            }
            
            // 如果有附加 class (用于容器)
            if (keyInfo.class) {
                keyDiv.classList.add(...keyInfo.class.split(' '));
            }

            // 处理子按键
            if (keyInfo.subKeys) {
                keyInfo.subKeys.forEach(subKeyInfo => {
                    const subKeyDiv = document.createElement('div');
                    // 子按键也应用 .key class 以便事件代理能捕捉到，再加上 .sub-key
                    subKeyDiv.className = 'key sub-key'; 
                    subKeyDiv.textContent = subKeyInfo.display;
                    subKeyDiv.dataset.key = subKeyInfo.key;
                    keyDiv.appendChild(subKeyDiv);
                });
            } else {
                keyDiv.textContent = keyInfo.display;
            }

            rowDiv.appendChild(keyDiv);
        });
        keyboardDiv.appendChild(rowDiv);
    });
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
async function sendKeyEvent(key, action) {
    if (!authToken) {
        console.error("无法发送事件：未认证");
        showAuthScreen("会话已失效，请重新认证");
        return;
    }

    try {
        const keyToSend = key === ' ' ? 'space' : key;
        const response = await fetch('/key_event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}` // 关键：带上令牌
            },
            body: JSON.stringify({ key: keyToSend, action }),
        });

        if (!response.ok) {
            // 如果令牌失效，服务器会返回 401
            if (response.status === 401) {
                showAuthScreen("认证已过期，请重新输入 PIN");
            } else {
                console.error(`服务器错误: ${response.status}`);
            }
        }
    } catch (error) {
        console.error('发送按键事件失败:', error);
        showAuthScreen("与服务器的连接已断开");
    }
}

function handlePress(element) {
    if (!element) return;
    element.classList.add('pressed');
    sendKeyEvent(element.dataset.key, 'down');
}

function handleRelease(element) {
    if (!element) return;
    element.classList.remove('pressed');
    sendKeyEvent(element.dataset.key, 'up');
}

// === 新增：节流工具函数 ===
function throttle(func, delay) {
    let timeoutId = null;
    let lastArgs = null;
    let lastThis = null;

    return function(...args) {
        lastArgs = args;
        lastThis = this;

        if (!timeoutId) {
            timeoutId = setTimeout(() => {
                func.apply(lastThis, lastArgs);
                timeoutId = null; // 执行完毕，重置计时器
            }, delay);
        }
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

    // 模式切换逻辑
    modeToggle.addEventListener('change', (e) => {
        if (e.target.value === 'trackpad') {
            document.body.classList.add('trackpad-mode');
        } else {
            document.body.classList.remove('trackpad-mode');
        }
    });

    // 绑定触控板事件
    setupTrackpadListeners();

    renderKeyboard(); // 渲染键盘

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
    } else {
        showAuthScreen();
        console.log("未找到本地令牌，需要认证。");
    }
    // --- 所有事件监听器也放在这里 ---
    // 物理键盘
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
        const key = e.key.length > 1 ? (CLIENT_KEY_MAP[e.key] || e.key.toLowerCase()) : e.key;

        // 视觉反馈：让虚拟键盘上对应的按键也亮起来
        const keyElement = document.querySelector(`[data-key="${key}"]`);
        if (keyElement) {
            keyElement.classList.add('pressed');
        }

        sendKeyEvent(key, 'down');
    });

    window.addEventListener('keyup', (e) => {
        if (!physicalKeyboardEnabled) return;

        e.preventDefault();

        const key = e.key.length > 1 ? (CLIENT_KEY_MAP[e.key] || e.key.toLowerCase()) : e.key;

        // 视觉反馈：熄灭按键
        const keyElement = document.querySelector(`[data-key="${key}"]`);
        if (keyElement) {
            keyElement.classList.remove('pressed');
        }

        sendKeyEvent(key, 'up');
    });

    // --- 完善的触控事件处理 ---
    keyboardDiv.addEventListener('touchstart', (e) => {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
            const keyElement = targetElement?.closest('.key');
            if (keyElement) {
                activeTouches[touch.identifier] = keyElement;
                handlePress(keyElement);
            }
        }
    });

    const touchEndHandler = (e) => {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const keyElement = activeTouches[touch.identifier];
            if (keyElement) {
                keyElement.classList.remove('pressed');
                sendKeyEvent(keyElement.dataset.key, 'up');
                delete activeTouches[touch.identifier];
            }
        }
    };
    keyboardDiv.addEventListener('touchend', touchEndHandler);
    keyboardDiv.addEventListener('touchcancel', touchEndHandler);

    // --- 鼠标事件 (用于桌面调试) ---
    let isMouseDown = false;
    let lastMouseDownKey = null;

    keyboardDiv.addEventListener('mousedown', (e) => {
        const keyElement = e.target.closest('.key');
        if (keyElement) {
            isMouseDown = true;
            lastMouseDownKey = keyElement;
            handlePress(keyElement);
        }
    });

    document.addEventListener('mouseup', () => {
        if (isMouseDown && lastMouseDownKey) {
            handleRelease(lastMouseDownKey);
        }
        isMouseDown = false;
        lastMouseDownKey = null;
    });


});

// === 新增：触控板手势识别核心 ===

// === 替换/新增：触控板逻辑的全局变量 ===

// 手势识别常量
const TAP_TIMEOUT = 250;       // 单击超时，适当延长以容错
const DOUBLE_TAP_WINDOW = 350; // 双击间隔
const DRAG_THRESHOLD = 5;      // 移动多少像素后算作移动/拖拽

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
    tapTimer: null
};

// 鼠标速度/滚动速度系数
const MOUSE_SPEED_FACTOR = 3.5; // 可以调整
const SCROLL_SPEED_FACTOR = 0.1; // 可以调整

async function sendMouseEvent(type, payload = {}) {
    if (!authToken) return; // 借用现有的认证
    
    payload.type = type;
    try {
        await fetch('/mouse_event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        console.error('发送鼠标事件失败:', error);
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
        const dx = touch.clientX - touchState.lastX;
        const dy = touch.clientY - touchState.lastY;

        // 计算从开始到现在的总位移
        const totalMoveX = touch.clientX - touchState.startX;
        const totalMoveY = touch.clientY - touchState.startY;
        const moveDistance = Math.sqrt(totalMoveX * totalMoveX + totalMoveY * totalMoveY);

        // --- 只要移动超过阈值，就不再可能是点击 ---
        if (moveDistance > DRAG_THRESHOLD) {
            touchState.isTap = false;
        }

        // 如果不是点击，才处理移动相关逻辑
        if (!touchState.isTap) {
            // -- 多指移动 -> 滚动 --
            if (touches.length > 1) {
                touchState.isScrolling = true;
                sendMouseEvent('scroll', { dx: 0, dy: dy * SCROLL_SPEED_FACTOR });
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
                if (new Date().getTime() - touchState.lastMoveTime < 30) return; // 简易节流
                touchState.lastMoveTime = new Date().getTime();
                let effective1 = 1;
                // 添加一个简单的非线性曲线
                // 当绝对值很小时，进一步减小其效果
                if (Math.abs(dx * dy) < 25) {
                    effective1 = 0.5;
                }
                sendMouseEvent('move', { dx: effective1 * dx * MOUSE_SPEED_FACTOR, dy: effective1 * dy * MOUSE_SPEED_FACTOR });
            }
        }
        
        touchState.lastX = touch.clientX;
        touchState.lastY = touch.clientY;
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