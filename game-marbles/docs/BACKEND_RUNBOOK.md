# Game Marbles 后端本地运行

这份文档用于本地启动、停止和排查 `game-marbles` 的 API 服务。

## 服务说明

- 前端开发服务：通常是 `http://localhost:5173/`
- 后端 API 服务：默认是 `http://localhost:4325/api`
- 健康检查：`http://localhost:4325/api/health`
- 运行时文件：
  - PID：`tmp/backend/api.pid`
  - 日志：`tmp/backend/api.log`

前端和后端是两个服务。只启动 Vite 前端时，游戏会显示本地缓存状态，登录、同步存档、战斗结算上报等后端能力不会在线。

## 首次配置

1. 安装依赖：

```bash
npm install
```

2. 创建环境变量文件：

```bash
cp .env.example .env
```

3. 按本机 Postgres 配置编辑 `.env`：

```bash
SITE_URL=http://localhost:4325
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=game_marbles
DB_USER=postgres
DB_PASSWORD=你的数据库密码
DB_SCHEMA=ws
VITE_API_URL=http://localhost:4325/api
```

4. 确认数据库存在。

如果本机当前用户有权限，可以直接：

```bash
createdb game_marbles
```

如果使用 `postgres` 用户，可以按本机环境执行类似命令：

```bash
createdb -U postgres game_marbles
```

## 启停命令

同时启动前后端：

```bash
npm run services:start
```

同时停止前后端：

```bash
npm run services:stop
```

同时重启前后端：

```bash
npm run services:restart
```

查看前后端状态：

```bash
npm run services:status
```

查看前后端日志：

```bash
npm run services:logs
```

持续跟随前后端日志：

```bash
./scripts/services.sh logs -f
```

启动后端：

```bash
npm run backend:start
```

停止后端：

```bash
npm run backend:stop
```

重启后端：

```bash
npm run backend:restart
```

查看状态：

```bash
npm run backend:status
```

查看日志：

```bash
npm run backend:logs
```

持续跟随日志：

```bash
./scripts/backend.sh logs -f
```

## 日常开发启动顺序

推荐直接一键启动：

```bash
npm run services:start
```

如果需要分开排查，再按下面顺序手动启动。

1. 先启动后端：

```bash
npm run backend:start
```

2. 再启动前端：

```bash
npm run dev -- --port 5173
```

如果刚刚修改了 `.env` 里的 `VITE_API_URL`，需要重启前端开发服务，因为 Vite 只在启动时读取环境变量。

## 脚本行为

`scripts/backend.sh start` 会执行：

1. 自动加载 `.env`，再加载 `.env.local` 覆盖同名变量。
2. 检查数据库连接：`npm run server:check`。
3. 执行迁移：`npm run server:migrate`。
4. 后台启动 API：`server/src/index.ts`。
5. 等待 `/api/health` 返回成功。

如果只想临时跳过数据库检查：

```bash
SKIP_DB_CHECK=1 npm run backend:start
```

如果只想临时跳过迁移：

```bash
SKIP_MIGRATE=1 npm run backend:start
```

## 排查

### 端口没有监听

```bash
npm run backend:status
npm run backend:logs
```

也可以直接检查：

```bash
lsof -nP -iTCP:4325 -sTCP:LISTEN
```

### 数据库连接失败

常见原因：

- Postgres 没启动。
- `.env` 里的 `DB_USER` / `DB_PASSWORD` 不对。
- `DB_NAME=game_marbles` 还没创建。
- 本机 Postgres 不接受 TCP 连接到 `127.0.0.1:5432`。

先单独检查：

```bash
npm run server:check
```

如果看到：

```text
Error: connect ECONNREFUSED 127.0.0.1:5432
```

说明 `DB_HOST:DB_PORT` 没有 Postgres 在监听。可以先检查端口：

```bash
lsof -nP -iTCP:5432 -sTCP:LISTEN
```

如果你用 Homebrew 安装 Postgres，常见启动方式是：

```bash
brew services start postgresql@16
```

如果版本不是 `16`，先用下面命令看本机实际服务名：

```bash
brew services list | grep postgres
```

### 前端仍然显示本地缓存

确认后端健康：

```bash
curl http://localhost:4325/api/health
```

确认 `.env` 里有：

```bash
VITE_API_URL=http://localhost:4325/api
```

然后重启前端开发服务。浏览器里如果还没有账号，需要在游戏首页注册或登录；未登录状态不会调用需要账号的同步接口。

### 端口冲突

如果 `4325` 被占用，可以在 `.env` 里改：

```bash
SITE_URL=http://localhost:4330
PORT=4330
VITE_API_URL=http://localhost:4330/api
```

之后重启后端和前端。
