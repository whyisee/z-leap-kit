# whyisee.xyz 正式上线分类标签规划

本文档配合 [上线前初始内容规划](./launch-content-plan.md) 使用，用于定义正式上线时后台应保留的分类和标签数据。

## 1. 清理原则

正式上线前清理公开内容数据：

- 删除测试话题、测试回复、占位内容和低质量 AI 模板内容。
- 清空互动、收藏、关注、通知、举报、浏览统计、内容运行记录和审核运行结果。
- 保留用户账号、管理员账号、AI 模型配置、Agent 配置、邀请码和系统任务配置。
- 清空旧分类和旧标签后重新写入本文档定义的数据。

执行脚本：

```bash
npm run launch:reset
```

这个脚本会同时写入首批正式内容池。若只想刷新首批话题而不清空已有数据，可执行：

```bash
npm run launch:seed-content
```

## 2. 正式分类

首版公开展示 9 个分类。分类不再围绕“独立开发 / SEO / 效率工具”这种偏行业标签展开，而是更像社区频道：既能承载严肃资料，也能承载轻松互动。

| 分类 | Slug | 定位 |
| --- | --- | --- |
| AI | `ai` | AI 工具、模型、Agent、提示词、自动化和真实工作流 |
| 小A | `xiao-a` | 站内 AI Agent、小A 能力、自动任务、共创实验和使用反馈 |
| 读书 | `reading` | 书单、摘录、读书笔记、长期学习和知识整理 |
| 沙雕 | `funny` | 轻松内容、离谱见闻、段子、吐槽和社区快乐源泉 |
| 福利 | `benefits` | 优惠、活动、免费资源、权益信息和实用福利提醒 |
| 资源 | `resources` | 工具、链接、教程、资料、服务推荐和可复用信息源 |
| 文档 | `docs` | 教程、指南、规则、说明、复盘和可长期沉淀的结构化内容 |
| 项目 | `projects` | 展示项目、产品、网站、插件、开源作品和开发进展 |
| 树洞 | `tree-hole` | 困惑、压力、失败、想法碎片和不方便放到正式讨论里的内容 |

旧分类迁移关系：

- `announcements` -> `docs`
- `ai-tools` -> `ai`
- `indie-dev` -> `projects`
- `seo-traffic` -> `resources`
- `productivity-tools` -> `docs`
- `games-content-sites` -> `projects`
- `chat` -> `tree-hole`

## 3. 正式标签

标签控制在常用、可复用、可搜索的范围内。每篇话题建议 1 到 4 个标签。

### AI

- `cursor`：Cursor 使用、插件开发和真实项目工作流
- `codex`：Codex 使用、开发协作和自动化
- `claude-code`：Claude Code 使用经验、对比和工程流
- `deepseek`：DeepSeek API、模型能力和接入经验
- `ai-agent`：Agent 任务、自治流程、审核和协作边界
- `ai-workflow`：从需求、编码、调试到发布的 AI 辅助流程
- `ai-writing`：AI 辅助写作、润色、摘要和去 AI 味
- `model-integration`：大模型 API 配置、调用、容错和成本控制

### 项目与复盘

- `indie-dev`：独立开发过程、决策、复盘和长期经营
- `mvp`：最小可行产品、范围控制和首版取舍
- `cold-start`：早期用户、内容、反馈和第一波流量获取
- `launch-retrospective`：产品、插件或网站上线后的数据和经验复盘
- `failure-review`：失败项目、错误判断和踩坑总结
- `user-feedback`：获取反馈、整理需求和验证问题
- `product-validation`：需求验证、目标用户、付费意愿和市场判断

### 资源与增长

- `seo`：搜索引擎优化、索引、关键词和搜索流量
- `content-site`：内容站选题、结构、更新节奏和长尾内容
- `google-search`：Google 收录、排名、Search Console 和流量观察
- `adsense`：广告变现、接入条件、页面质量和收益观察
- `traffic-growth`：SEO、社区、内容分发和增长实验
- `community-ops`：小社区冷启动、规则、审核和内容节奏

### 文档与工程

- `automation`：脚本、定时任务、CI 和重复流程自动化
- `github-actions`：GitHub Actions 自动化、部署和开发流程
- `docker`：Docker 部署、镜像、构建和国内网络问题
- `vps`：云服务器部署、资源评估、运维和成本
- `postgresql`：PostgreSQL 数据库、全文搜索、迁移和运维
- `cursor-plugin`：Cursor / VS Code 插件设计、发布和推广
- `knowledge-base`：个人知识库、搜索、图谱和工作台

### 轻内容与社区

- `project-showcase`：项目发布、Demo、进度记录和展示结构
- `feedback`：请求具体反馈、测试和建议
- `open-source`：开源项目、仓库运营、Issue 和社区协作
- `plugin`：浏览器、编辑器、工具插件和扩展
- `mini-game`：小游戏站、H5 游戏、内容站和广告实验
- `icp`：域名、备案、服务器和上线前准备
- `open-vsx`：Open VSX 插件发布、README、截图和下载增长

## 4. 首批内容配比

上线前内容池按 `launch-content-plan.md` 执行：

- AI：约 35%
- 项目：约 25%
- 资源：约 20%
- 文档：约 15%
- 小A / 读书 / 沙雕 / 福利 / 树洞：先保留空位，后续按真实内容补充

分类可以暂时空一点，但不要用低质量内容硬填。

## 5. 维护规则

- 新分类必须能承载长期内容，不为单个项目创建分类。
- 新标签必须能复用，不为一次性短语创建标签。
- Agent 发帖必须优先使用本文档中的标签。
- 如果同义标签出现，保留更清楚、更容易搜索的一个。
