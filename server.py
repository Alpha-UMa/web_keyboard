from flask import Flask, request, jsonify, render_template
from flask_socketio import SocketIO
from flask_cors import CORS
from pynput.keyboard import Controller, Key
from pynput.mouse import Controller as MouseController, Button
import logging
import random
import time
import uuid # 用于生成唯一的持久化令牌
import json
import os
import threading
from collections import deque

EVENT_QUEUE = deque()
QUEUE_LOCK = threading.Lock()

# 配置日志，方便调试
logging.basicConfig(level=logging.INFO)

# --- 新增：集中的、基于文件的令牌存储 ---
TOKEN_DB_FILE = 'authorized_tokens.json'
TOKEN_VALIDITY_SECONDS = 86400 * 7 # 令牌有效期7天 (7 * 24 * 60 * 60)
# TOKEN_VALIDITY_SECONDS = 2592000 # 令牌有效期30天
AUTHORIZED_TOKENS = {} # 改为字典: { "token": creation_timestamp, ... }

def load_and_prune_tokens():
    """
    加载令牌，并移除所有过期的令牌。
    这个函数在服务器启动时和每次需要验证时调用。
    """
    global AUTHORIZED_TOKENS
    if not os.path.exists(TOKEN_DB_FILE):
        AUTHORIZED_TOKENS = {}
        return

    try:
        with open(TOKEN_DB_FILE, 'r') as f:
            tokens_from_file = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        tokens_from_file = {}

    current_time = time.time()
    # 创建一个新的字典，只包含未过期的令牌
    valid_tokens = {
        token: timestamp
        for token, timestamp in tokens_from_file.items()
        if (current_time - timestamp) < TOKEN_VALIDITY_SECONDS
    }

    # 如果有令牌被清理，则重写文件
    if len(valid_tokens) < len(tokens_from_file):
        logging.info(f"Pruned {len(tokens_from_file) - len(valid_tokens)} expired tokens.")
        AUTHORIZED_TOKENS = valid_tokens
        save_tokens()
    else:
        AUTHORIZED_TOKENS = valid_tokens

def save_tokens():
    """将内存中的令牌字典保存到文件"""
    with open(TOKEN_DB_FILE, 'w') as f:
        json.dump(AUTHORIZED_TOKENS, f, indent=4)

def add_token(token):
    """添加一个新令牌，并附带当前时间戳"""
    AUTHORIZED_TOKENS[token] = time.time()
    save_tokens()

def cleanup():
    """删除令牌文件"""
    if os.path.exists(TOKEN_DB_FILE):
        os.remove(TOKEN_DB_FILE)
        logging.info("Token database cleaned up.")

# --- Flask 和 SocketIO 设置 ---
app = Flask(__name__)
socketio = SocketIO(app)
CORS(app)
# --- 关键修正：在初始化 SocketIO 时配置 CORS ---
socketio = SocketIO(app, cors_allowed_origins="*")

# 如果想更安全，可以只允许你的 Nginx 地址，或者允许多个

keyboard = Controller()
# 创建一个 MouseController 实例
mouse = MouseController()

# 存储特殊按键的映射
# pynput 将 'ctrl', 'shift' 等识别为 Key.ctrl, Key.shift
KEY_MAP = {
    'shift': Key.shift, 'shift_l': Key.shift_l, 'shift_r': Key.shift_r,
    'ctrl': Key.ctrl, 'ctrl_l': Key.ctrl_l, 'ctrl_r': Key.ctrl_r,
    'alt': Key.alt, 'alt_l': Key.alt_l, 'alt_r': Key.alt_r,
    'cmd': Key.cmd, 'cmd_l': Key.cmd_l, 'cmd_r': Key.cmd_r, # For macOS
    'win': Key.cmd, # For Windows
    'enter': Key.enter,
    'backspace': Key.backspace,
    'tab': Key.tab,
    'caps_lock': Key.caps_lock,
    'esc': Key.esc,
    'space': Key.space,
    'up': Key.up, 'down': Key.down, 'left': Key.left, 'right': Key.right,
    'f1': Key.f1, 'f2': Key.f2, 'f3': Key.f3, 'f4': Key.f4, 'f5': Key.f5, 'f6': Key.f6, 'f7': Key.f7, 'f8': Key.f8, 'f9': Key.f9, 'f10': Key.f10, 'f11': Key.f11, 'f12': Key.f12,
    # ... 可以继续添加其他功能键 F1-F12 等
}

# 创建一个鼠标按键的映射，方便处理
MOUSE_BUTTON_MAP = {
    'left': Button.left,
    'right': Button.right,
    'middle': Button.middle,
}

# --- 新增：认证状态管理 ---
PIN_CODE = None
PIN_EXPIRY = 0
# 使用集合(set)存储已授权的持久化令牌，查询效率更高
AUTHORIZED_TOKENS = set()


# --- 路由：主页 ---
@app.route('/')
def index():
    # 无论是否授权，都返回主页面。授权逻辑由前端JS处理
    return render_template('index.html')


# --- 新增：PIN 认证路由 ---
@app.route('/auth/pin', methods=['POST'])
def auth_pin():
    global PIN_CODE, PIN_EXPIRY # 声明要修改全局变量

    data = request.get_json()
    client_pin = data.get('pin')

    # 验证 PIN 码是否正确且未过期
    if client_pin and client_pin == PIN_CODE and time.time() < PIN_EXPIRY:
        # 1. 生成一个新的、唯一的持久化令牌
        new_token = str(uuid.uuid4())
        # 2. 将其加入授权列表
        add_token(new_token)
        # 3. 让当前 PIN 失效 (重要！确保一次性)
        PIN_CODE = None 
        logging.info(f"PIN auth successful. Issued new token valid for {TOKEN_VALIDITY_SECONDS / 86400:.0f} days.")
        # 4. 将新令牌返回给客户端
        return jsonify({"status": "success", "token": new_token})
    else:
        logging.warning(f"Failed PIN auth attempt with PIN: {client_pin}")
        return jsonify({"status": "error", "message": "Invalid or expired PIN"}), 401


# --- 新增：“守卫”中间件 ---
# --- 修改“守卫”中间件 ---
@app.before_request
def check_auth_token():
    # 关键：每次请求时加载并顺便清理过期的令牌
    load_and_prune_tokens()
    # 对所有需要保护的端点进行检查
    # 如果请求的是认证页、主页或静态文件，则直接放行
    # 稍微优化一下，让 favicon.ico 也通过
    if request.path == '/favicon.ico' or request.endpoint in ['index', 'auth_pin', 'static']:
        return

    # 对于其他所有请求 (如 /key_event)，必须验证令牌
    auth_header = request.headers.get('Authorization')
    token = auth_header.split(' ')[1] if auth_header and auth_header.startswith('Bearer ') else None

    # 现在检查 token 是否在字典的 key 中
    if token and token in AUTHORIZED_TOKENS:
        # 令牌有效，放行
        return
    else:
        # 令牌无效或不存在，拒绝访问
        logging.warning(f"Unauthorized access attempt to '{request.endpoint or request.path}' from {request.remote_addr}")
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    
# 新增：鼠标事件处理路由
# --- WebSocket 事件处理器 (新) ---
# --- 新增：WebSocket 事件处理器 ---

@socketio.on('connect')
def handle_connect():
    """客户端连接时触发"""
    # 可以在这里做一些初始化的事情，比如验证令牌
    logging.info('Client connected')
    # 我们将在每个事件中验证令牌，所以这里暂时不做事

@socketio.on('disconnect')
def handle_disconnect():
    logging.info('Client disconnected')

def check_token_in_payload(data):
    """一个辅助函数，用于检查事件数据中是否包含有效令牌"""
    token = data.get('token')
    if token and token in AUTHORIZED_TOKENS:
        return True
    logging.warning("WebSocket event rejected: Invalid token")
    return False

@socketio.on('text_event')
def handle_ws_key_event(data): # 1. 数据直接作为参数 'data' 传入
    """处理通过 WebSocket 发送的文本事件"""
    load_and_prune_tokens()
    
    # 2. 不再需要 request.get_json()，直接使用 data
    if not check_token_in_payload(data):
        return

    # 从 data 字典中获取信息
    text = data.get('text')
    
    if not text:
        return # 忽略无效数据

    logging.info(f"Received text_event: text='{text}'")

    try:
        keyboard.type(text)
    except Exception as e:
        logging.error(f"Error on typing '{text}': {e}")

@socketio.on('key_event')
def handle_ws_key_event(data): # 1. 数据直接作为参数 'data' 传入
    """处理通过 WebSocket 发送的键盘事件"""
    load_and_prune_tokens()
    
    # 2. 不再需要 request.get_json()，直接使用 data
    if not check_token_in_payload(data):
        return

    # 从 data 字典中获取信息
    key_str = data.get('key')
    action = data.get('action')
    
    if not key_str or not action:
        return # 忽略无效数据

    logging.info(f"Received key_event: key='{key_str}', action='{action}'")
    
    # 将网页传来的键名转换为 pynput 可以识别的对象
    # 如果是特殊键，从 KEY_MAP 中查找；否则，直接使用字符
    key_to_process = KEY_MAP.get(key_str.lower(), key_str)
    try:
        if action == 'down':
            keyboard.press(key_to_process)
        elif action == 'up':
            keyboard.release(key_to_process)
    except Exception as e:
        logging.error(f"Pynput key error on '{key_str}': {e}")

@socketio.on('mouse_event')
def handle_ws_mouse_event(data):
    # 这个函数现在变得和你的 /mouse_event 路由一样简单
    # 它只负责接收数据并放入队列
    #logging.info("data: %s", data)

    if not check_token_in_payload(data):
        return

    # 不再需要解析 event_type，直接把整个 data 包扔进去
    with QUEUE_LOCK:
        EVENT_QUEUE.append(data)

def consumer():
    mouse = MouseController()
    MERGE_WINDOW = 0.005
    while True:
        start = time.time()
        local_batch = []
        with QUEUE_LOCK:
            while EVENT_QUEUE:
                local_batch.append(EVENT_QUEUE.popleft())
        if not local_batch:
            time.sleep(0.001)
            continue
        for ev in local_batch:
            t = ev.get("type")
            if t == "move":
                dx = ev.get("dx", 0)
                dy = ev.get("dy", 0)
                mouse.move(dx, dy)

            elif t == "click":
                btn = ev.get("button","left")
                button = MOUSE_BUTTON_MAP.get(btn)
                if button:
                    mouse.click(button)
                logging.info(f"Received action: {t}, {btn}")

            elif t == 'press':
                btn = ev.get("button","left")
                button = MOUSE_BUTTON_MAP.get(btn)
                if button:
                    mouse.press(button)
                logging.info(f"Received action: {t}, {btn}")

            elif t == 'release':
                btn = ev.get("button","left")
                button = MOUSE_BUTTON_MAP.get(btn)
                if button:
                    mouse.release(button)
                logging.info(f"Received action: {t}, {btn}")

            elif t == "scroll":
                dx = ev.get("dx", 0)
                dy = ev.get("dy", 0)
                mouse.scroll(dx, dy)
                #logging.info(f"Received action: {event_type}")
        elapsed = time.time() - start
        if elapsed < MERGE_WINDOW:
            time.sleep(MERGE_WINDOW - elapsed)

# --- 主程序入口修改 ---
if __name__ == '__main__':
    # 关键：在启动时调用一次，清理掉所有旧的过期令牌
    load_and_prune_tokens()

    threading.Thread(target=consumer, daemon=True).start()

    # 1. 生成一个6位数的 PIN 码
    PIN_CODE = f"{random.randint(0, 999999):06d}"
    # 2. 设置5分钟的有效期
    PIN_EXPIRY = time.time() + 300 
    
    print("=" * 40)
    print("      WEB KEYBOARD SERVER STARTED")
    print("=" * 40)
    print(f"  Your one-time PIN is: {PIN_CODE[:3]}-{PIN_CODE[3:]}")
    print("  This PIN will expire in 5 minutes.")
    print("  Enter this PIN on the web page to connect.")
    print("=" * 40)
    # 监听在本地，局域网内的其他设备通过 nginx 反向代理访问
    # debug=True 会在代码修改后自动重启，但生产环境请关闭
    # debug=False 在这里很重要，因为 debug 模式会运行两次初始化，可能导致 PIN 码问题 
    socketio.run(app, host='127.0.0.1', port=18000, debug=False)
