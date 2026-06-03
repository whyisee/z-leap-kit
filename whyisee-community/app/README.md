# whyisee-community app

自研版 `whyisee.xyz` 社区应用骨架。

## 技术栈

- Astro：公开页面和 SEO 页面
- Hono：API 层
- TypeScript：业务代码、脚本和服务层
- PostgreSQL：首版数据库
- Nginx：生产环境反向代理

## 本地开发

```bash
npm install
npm run db:init
npm run dev
```

默认开发地址：

```text
http://localhost:4321
```

健康检查：

```text
http://localhost:4321/api/health
```

## 数据库

默认数据库配置：

```text
DB_HOST=127.0.0.1
DB_PORT=15432
DB_NAME=zi
DB_USER=postgres
DB_PASSWORD=123456
DB_SCHEMA=ws
PG_DUMP_BIN=pg_dump
```

也可以用环境变量覆盖后启动：

```bash
DB_HOST=127.0.0.1 DB_PORT=15432 DB_NAME=zi DB_USER=postgres DB_PASSWORD=123456 DB_SCHEMA=ws npm run start
```

## 当前已实现

- 首页
- 最新话题
- 分类页
- 标签页
- 项目展示页
- 话题详情页
- RSS
- Sitemap
- Hono API
- PostgreSQL schema
- migration 脚本
- seed 脚本
- 数据库备份脚本

## 下一步

- 管理员登录
- 管理员发布话题
- 管理员编辑话题
- Markdown 编辑器
- 基础搜索
- 邀请制用户互动
