# Web 键盘控制系统

基于 Flask + SocketIO + pynput 的实时网络键盘和鼠标控制系统。在浏览器中虚拟键盘和触控板，通过网络实时控制本地系统的键盘输入和鼠标操作。

## 主要功能

- 网页虚拟键盘，支持多种布局切换
- 虚拟触控板，支持鼠标移动、点击、滚动
- PIN 码认证，安全的 Token 授权机制
- 发送剪贴板文字
- 组合键支持（如 Ctrl+C）
- 物理键盘映射（可选）
- 亮色/深色主题切换
- 内网跨设备访问（需 nginx 反向代理）

## 系统要求

- Python 3.7+
- pynput
- Flask
- flask-socketio
- flask-cors

## 快速开始

### 0. 双击运行（可选）

运行打包后的文件并跳过步骤 1、2

### 1. 安装依赖

```bash
pip install pynput flask flask-socketio flask-cors
```

### 2. 运行服务器

```bash
python server.py
```

服务器启动后，控制台会输出一个 6 位数的一次性 PIN 码，有效期 5 分钟：

```
========================================
      WEB KEYBOARD SERVER STARTED
========================================
  Your one-time PIN is: 123456
  This PIN will expire in 5 minutes.
  Enter this PIN on the web page to connect.
========================================
```

### 3. 浏览器访问

本地访问：`http://127.0.0.1:18000`

输入 PIN 码完成认证，即可开始控制。

*本地访问仅供测试。*

## 认证流程

1. 服务器启动时生成 6 位 PIN 码（有效期 5 分钟）
2. 客户端输入 PIN 码，发送至 `/auth/pin` 端点
3. 验证成功后获得 Bearer Token（有效期 7 天）
4. Token 本地存储在 `localStorage`，所有 WebSocket 事件需携带 Token
5. Token 在服务器端持久化至 `authorized_tokens.json`

之后 7 天内可以直接使用已存储的 Token，无需重新输入 PIN 码。

## 内网访问配置

*建议只在网络条件极佳的环境下使用。*

系统默认仅监听本地回环地址 `127.0.0.1:18000`，其他设备的访问需要通过 nginx 反向代理实现。

### nginx 配置示例

```conf
server {
    listen       443 ssl;
    server_name  test;

    ssl_certificate      s/cert.pem;
    ssl_certificate_key  s/key.pem;
       
    ssl_session_cache    shared:SSL:1m;
    ssl_session_timeout  5m;

    ssl_ciphers  HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers  on;

    location / {
        proxy_set_header Host $host;
        proxy_set_header X-Real-Ip $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_pass http://127.0.0.1:18000/;
    }
    
    location /socket.io {
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        
        proxy_pass http://127.0.0.1:18000/socket.io;
    }
}
```

配置要点：
- HTTP 至 HTTPS 的 SSL/TLS 加密传输
- WebSocket 升级支持（Location /socket.io）
- 长连接超时配置（86400s）

配置完成后，内网设备可通过 `https:// + 内网ip` 访问系统。

## 项目结构

```
.
├── server.py                # Flask 应用，SocketIO 事件处理，pynput 控制
├── templates/
│   └── index.html           # 虚拟键盘界面，SVG 布局定义
├── static/
│   ├── js/
│   │   ├── main.js          # 前端事件处理，SocketIO 连接逻辑
│   │   └── socket.io.min.js # SocketIO 客户端库
│   ├── css/
│   │   └── style.css        # 样式，主题变量定义
│   └── images/
├── authorized_tokens.json   # Token 持久化存储（运行时生成）
└── README.md
```

## 键盘布局

目前支持多种布局模式，可通过页面上方的"模式"下拉菜单切换：

- 键盘：标准 QWERTY 布局
- 键盘2：备用布局
- 快捷键盘：常用快捷键预设
- 触控板：虚拟鼠标和触控板

## WebSocket 事件

- 键盘控制：

```javascript
socket.emit('key_event', { key: 'a', action: 'down', token: authToken });
socket.emit('key_event', { key: 'ctrl', action: 'up', token: authToken });
socket.emit('text_event', { text: 'hello', token: authToken });
```

- 鼠标控制：

```javascript
// 移动
socket.emit('mouse_event', { type: 'move', dx: 10, dy: -5, token: authToken });
// 点击
socket.emit('mouse_event', { type: 'click', button: 'right', token: authToken });
// 按住
socket.emit('mouse_event', { type: 'press', button: 'left', token: authToken });
// 释放
socket.emit('mouse_event', { type: 'release', button: 'left', token: authToken });
// 滚动
socket.emit('mouse_event', { type: 'scroll', dx: 0, dy: 3, token: authToken });
```

## 开发说明

### 添加新按键

1. 编辑 `templates/index.html` 中的 SVG 键盘布局
2. 为新按键元素添加 `data-key` 属性
3. 前端会自动生成交互层

### 添加新布局

1. 在 `index.html` 中新增 SVG 元素，设置 `data-layout` 属性
2. 在模式选择器中添加对应选项
3. 调用 `switchLayout(layoutName)` 即可切换

### 修改认证参数

在 `server.py` 中修改以下常量：

- `TOKEN_VALIDITY_SECONDS`：Token 有效期（默认 7 天）
- 服务器启动逻辑中的 PIN 码有效期（目前 5 分钟）

## 许可证

MIT
