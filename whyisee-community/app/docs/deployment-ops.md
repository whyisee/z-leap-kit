# whyisee-community 部署与启停文档

## 目标

本文档记录 whyisee-community 在 VPS 上的基础部署、启停、日志查看和机器人任务运行方式。

当前推荐方式：

- 使用 `npm run build` 构建 Astro 服务端产物。
- 使用 `systemd` 管理 Node 服务。
- 第一版让机器人自动任务随 Web 服务一起运行，减少部署复杂度。

## 目录约定

下面示例假设项目部署在：

```bash
/opt/whyisee-community/app
```

如果你的实际目录不同，把命令里的路径替换成实际路径即可。

## 环境变量

生产环境至少需要配置：

```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=4321

DB_HOST=127.0.0.1
DB_PORT=15432
DB_NAME=zi
DB_USER=postgres
DB_PASSWORD=123456
DB_SCHEMA=ws
```

机器人调度相关变量：

```bash
# 默认开启。设为 0 时，Web 服务不启动内置调度器。
BOT_SCHEDULER_ENABLED=1

# 内置调度器轮询间隔，默认 5000。
BOT_SCHEDULER_INTERVAL_MS=5000

# 每轮最多处理几个自动任务，默认 1。
BOT_SCHEDULER_TASK_LIMIT=1

# 使用 http://服务器IP:端口 临时调试登录时设为 false。
# 正式 HTTPS 域名部署时建议设为 true，或删掉该项使用生产默认值。
AUTH_COOKIE_SECURE=false
```

## 首次部署

进入应用目录：

```bash
cd /opt/whyisee-community/app
```

安装依赖：

```bash
npm install
```

执行数据库迁移：

```bash
npm run migrate
```

构建：

```bash
npm run build
```

手动启动验证：

```bash
HOST=0.0.0.0 PORT=4321 npm run start
```

浏览器访问：

```text
http://服务器IP:4321
```

确认能访问后，再交给 systemd 管理。

## systemd 服务

创建服务文件：

```bash
sudo vim /etc/systemd/system/whyisee-community.service
```

内容示例：

```ini
[Unit]
Description=whyisee community
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/whyisee-community/app
Environment=NODE_ENV=production
Environment=HOST=0.0.0.0
Environment=PORT=4321
Environment=DB_HOST=127.0.0.1
Environment=DB_PORT=15432
Environment=DB_NAME=zi
Environment=DB_USER=postgres
Environment=DB_PASSWORD=123456
Environment=DB_SCHEMA=ws
Environment=BOT_SCHEDULER_ENABLED=1
Environment=BOT_SCHEDULER_INTERVAL_MS=5000
Environment=BOT_SCHEDULER_TASK_LIMIT=1
Environment=AUTH_COOKIE_SECURE=false
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

加载配置：

```bash
sudo systemctl daemon-reload
```

设置开机自启：

```bash
sudo systemctl enable whyisee-community
```

启动服务：

```bash
sudo systemctl start whyisee-community
```

## 常用启停命令

查看状态：

```bash
sudo systemctl status whyisee-community
```

启动：

```bash
sudo systemctl start whyisee-community
```

停止：

```bash
sudo systemctl stop whyisee-community
```

重启：

```bash
sudo systemctl restart whyisee-community
```

查看实时日志：

```bash
sudo journalctl -u whyisee-community -f
```

查看最近 200 行日志：

```bash
sudo journalctl -u whyisee-community -n 200 --no-pager
```

## 更新部署

拉取或上传新代码后：

```bash
cd /opt/whyisee-community/app
npm install
npm run migrate
npm run build
sudo systemctl restart whyisee-community
```

确认服务状态：

```bash
sudo systemctl status whyisee-community
```

## 机器人自动任务

默认情况下，Web 服务启动后会自动启动内置调度器。

这个调度器会处理：

- 自动审核待发布话题。
- 到期的自动机器人任务。
- 原有的 `@bot` 提及任务队列。

因此第一版部署只需要运行 `whyisee-community` 一个服务。

后台查看入口：

```text
/admin/bot-jobs
```

这里可以查看：

- 自动任务配置。
- 最近运行记录。
- AI 审核结果。
- 提及任务队列。

## 独立 worker 模式

如果后续任务量变大，可以关闭 Web 服务内置调度器，改用独立 worker。

Web 服务中设置：

```ini
Environment=BOT_SCHEDULER_ENABLED=0
```

然后新增 worker 服务：

```bash
sudo vim /etc/systemd/system/whyisee-bot-worker.service
```

内容示例：

```ini
[Unit]
Description=whyisee bot worker
After=network.target whyisee-community.service

[Service]
Type=simple
WorkingDirectory=/opt/whyisee-community/app
Environment=NODE_ENV=production
Environment=BOT_WORKER_LOOP=1
Environment=BOT_WORKER_INTERVAL_MS=5000
Environment=BOT_WORKER_TASK_LIMIT=1
Environment=DB_HOST=127.0.0.1
Environment=DB_PORT=15432
Environment=DB_NAME=zi
Environment=DB_USER=postgres
Environment=DB_PASSWORD=123456
Environment=DB_SCHEMA=ws
ExecStart=/usr/bin/npm run bot:worker
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启用 worker：

```bash
sudo systemctl daemon-reload
sudo systemctl enable whyisee-bot-worker
sudo systemctl start whyisee-bot-worker
```

查看 worker 日志：

```bash
sudo journalctl -u whyisee-bot-worker -f
```

## 推荐部署策略

2C2G VPS 第一版建议：

- 只运行 `whyisee-community.service`。
- 保持 `BOT_SCHEDULER_ENABLED=1`。
- 自动任务频率先保持 5 秒轮询，单轮只处理 1 个任务。
- 后续内容量上来后，再拆出 `whyisee-bot-worker.service`。

## 常见问题

### 登录后还是未登录

如果你用的是：

```text
http://服务器IP:4321
```

并且服务是生产构建，默认登录 cookie 会带 `Secure`。浏览器不会在 HTTP 页面保存 `Secure` cookie，所以登录后会立刻变回未登录状态。

临时调试方案是在环境变量里加入：

```bash
AUTH_COOKIE_SECURE=false
```

然后重新构建并重启：

```bash
npm run build
sudo systemctl restart whyisee-community
```

正式上线建议使用 HTTPS 域名，并把配置改回：

```bash
AUTH_COOKIE_SECURE=true
```

或者删除该环境变量，使用生产默认值。

### 页面能打开，但自动审核不运行

先看后台：

```text
/admin/bot-jobs
```

检查：

- 自动任务是否为启用。
- 下次运行时间是否已经到期。
- 最近运行里是否有失败记录。
- AI 配置是否已经设置默认模型和 API Key。

再看日志：

```bash
sudo journalctl -u whyisee-community -f
```

### 服务启动失败

查看日志：

```bash
sudo journalctl -u whyisee-community -n 200 --no-pager
```

重点检查：

- 数据库是否能连接。
- `npm run build` 是否已执行。
- `WorkingDirectory` 是否正确。
- `/usr/bin/npm` 路径是否正确。

如果 npm 不在 `/usr/bin/npm`，使用：

```bash
which npm
```

然后替换 systemd 文件里的 `ExecStart`。
