from flask import Flask, request, jsonify, render_template
from pynput.keyboard import Controller, Key
import logging
import random
import time
import uuid # 用于生成唯一的持久化令牌
import json
import os
import atexit # 用于在程序退出时清理文件

# 配置日志，方便调试
logging.basicConfig(level=logging.INFO)

# --- 新增：集中的、基于文件的令牌存储 ---
TOKEN_DB_FILE = 'authorized_tokens.json'
AUTHORIZED_TOKENS = set()

def load_tokens():
    """从文件加载令牌到内存"""
    global AUTHORIZED_TOKENS
    if os.path.exists(TOKEN_DB_FILE):
        with open(TOKEN_DB_FILE, 'r') as f:
            try:
                tokens = json.load(f)
                AUTHORIZED_TOKENS = set(tokens)
            except json.JSONDecodeError:
                AUTHORIZED_TOKENS = set()
    else:
        AUTHORIZED_TOKENS = set()

def save_tokens():
    """将内存中的令牌保存到文件"""
    with open(TOKEN_DB_FILE, 'w') as f:
        json.dump(list(AUTHORIZED_TOKENS), f)

def add_token(token):
    """添加一个新令牌并立即保存"""
    AUTHORIZED_TOKENS.add(token)
    save_tokens()

def cleanup():
    """程序退出时删除令牌文件"""
    if os.path.exists(TOKEN_DB_FILE):
        os.remove(TOKEN_DB_FILE)
        logging.info("Token database cleaned up.")

# 注册退出清理函数
atexit.register(cleanup)

app = Flask(__name__)
keyboard = Controller()

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
    global PIN_CODE # 声明要修改全局变量

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
        logging.info(f"PIN a'u'th successful. Issued token: ...{new_token[-6:]}")
        # 4. 将新令牌返回给客户端
        return jsonify({"status": "success", "token": new_token})
    else:
        logging.warning(f"Failed PIN auth attempt with PIN: {client_pin}")
        return jsonify({"status": "error", "message": "Invalid or expired PIN"}), 401


# --- 新增：“守卫”中间件 ---
@app.before_request
def check_auth_token():
    # 关键：在每次请求开始时，都从文件重新加载最新的令牌列表
    load_tokens()
    # 对所有需要保护的端点进行检查
    # 如果请求的是认证页、主页或静态文件，则直接放行
    # 稍微优化一下，让 favicon.ico 也通过
    if request.path == '/favicon.ico' or request.endpoint in ['index', 'auth_pin', 'static']:
        return

    # 对于其他所有请求 (如 /key_event)，必须验证令牌
    auth_header = request.headers.get('Authorization')
    token = auth_header.split(' ')[1] if auth_header and auth_header.startswith('Bearer ') else None

    if token and token in AUTHORIZED_TOKENS:
        # 令牌有效，放行
        return
    else:
        # 令牌无效或不存在，拒绝访问
        logging.warning(f"Unauthorized access attempt to '{request.endpoint}' from {request.remote_addr}")
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

# --- 按键事件处理路由 (不变) ---
# 接收按键事件的 API
@app.route('/key_event', methods=['POST'])
def handle_key_event():
    # 因为有 before_request 守卫，能进入这里的请求都已是授权的
    data = request.get_json()
    if not data or 'key' not in data or 'action' not in data:
        return jsonify({"status": "error", "message": "Invalid data"}), 400

    key_str = data['key']
    action = data['action']
    
    # 将网页传来的键名转换为 pynput 可以识别的对象
    # 如果是特殊键，从 KEY_MAP 中查找；否则，直接使用字符
    key_to_process = KEY_MAP.get(key_str.lower(), key_str)
    
    logging.info(f"Received action: {action}, key: {key_str} -> {key_to_process}")

    try:
        if action == 'down':
            keyboard.press(key_to_process)
        elif action == 'up':
            keyboard.release(key_to_process)
        else:
            return jsonify({"status": "error", "message": "Invalid action"}), 400
        
        return jsonify({"status": "success"})
    except Exception as e:
        logging.error(f"Error processing key: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# --- 主程序入口修改 ---
if __name__ == '__main__':
    # 首次启动时，确保旧的令牌文件被清理
    cleanup() 
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
    # 监听在 0.0.0.0 上，这样局域网内的其他设备才能访问
    # debug=True 会在代码修改后自动重启，但生产环境请关闭
    # debug=False 在这里很重要，因为 debug 模式会运行两次初始化，可能导致 PIN 码问题 
    app.run(host='0.0.0.0', port=15000, ssl_context=('cert.pem', 'key.pem'), debug=False)