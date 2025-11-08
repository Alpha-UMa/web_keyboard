        const pinInput = document.getElementById('pin-input');
        const connectButton = document.getElementById('connect-button');
        const authMessage = document.getElementById('auth-message');
        const authOverlay = document.getElementById('auth-overlay');
        let authToken = null;

        // ... (keyboardLayout, CLIENT_KEY_MAP 数据定义保持不变) ...

        // --- 认证核心逻辑 ---
        function showAuthScreen(message = '') {
            authOverlay.style.display = 'flex';
            authMessage.textContent = message;
            authToken = null;
            localStorage.removeItem('webKeyboardAuthToken');
        }

        function hideAuthScreen() {
            authOverlay.style.display = 'none';
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

                const data = await response.json();
                if (response.ok) {
                    authToken = data.token;
                    localStorage.setItem('webKeyboardAuthToken', authToken);
                    hideAuthScreen();
                } else {
                    authMessage.textContent = data.message || '认证失败';
                }
            } catch (error) {
                authMessage.textContent = '连接服务器失败';
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

        window.addEventListener('DOMContentLoaded', () => {
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
        });

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

        const keyboardDiv = document.getElementById('keyboard');
        const activeTouches = {}; // { touchId: keyElement, ... }

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

        // --- 物理键盘映射逻辑 ---

        const physicalKeyboardToggle = document.getElementById('physical-keyboard-toggle');
        let physicalKeyboardEnabled = false;

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

        
        /**async function sendKeyEvent(key, action) {
            console.log(`Sending: ${action} ${key}`);
            try {
                // 注意：服务器端的 KEY_MAP 要有 ' ' 对应 Key.space
                const keyToSend = key === ' ' ? 'space' : key;
                await fetch('/key_event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: keyToSend, action }),
                });
            } catch (error) {
                console.error('发送按键事件失败:', error);
            }
        }**/

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

        function touchEndHandler(e) {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                const keyElement = activeTouches[touch.identifier];
                if (keyElement) {
                    handleRelease(keyElement);
                    delete activeTouches[touch.identifier];
                }
            }
        }
        keyboardDiv.addEventListener('touchend', touchEndHandler);
        keyboardDiv.addEventListener('touchcancel', touchEndHandler); // 系统中断触控时也触发

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

        renderKeyboard(); // 页面加载时渲染键盘
