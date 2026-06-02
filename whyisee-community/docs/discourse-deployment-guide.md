# whyisee.xyz Discourse 部署指南

## 1. 当前服务器信息

已知：

- 域名：`whyisee.xyz`
- 服务器：阿里云 VPS
- 配置：2C2G
- 推荐系统：Ubuntu 22.04 / 24.04
- 推荐方案：Discourse 官方 Docker 部署

待确认：

- 阿里云地域：大陆 / 香港 / 新加坡 / 其他
- 操作系统：Ubuntu / CentOS / Debian
- 是否有 root 权限
- SMTP 邮件服务
- 是否需要备案

## 2. 备案判断

如果服务器是阿里云中国大陆地域，例如杭州、上海、北京、深圳、青岛、张家口等，`whyisee.xyz` 指向这台服务器并对外提供网站访问前，通常需要先做 ICP 备案。

如果服务器是阿里云香港、新加坡或其他海外地域，一般不需要 ICP 备案。

建议：

- 大陆服务器：先备案，再正式开放站点
- 海外服务器：可直接部署上线

## 3. 域名规划

有两种选择：

### 方案 A：主域名直接做社区

```text
whyisee.xyz
```

优点：

- 简洁
- 社区就是主产品
- 传播方便

缺点：

- 以后如果想把主域名做成官网/导航，需要调整

### 方案 B：社区放到子域名

```text
community.whyisee.xyz
```

优点：

- 主域名可做首页、项目库、精选内容页
- 社区和其他业务分离

缺点：

- URL 稍长

当前建议：

如果你现在的核心目标就是社区，先用 `whyisee.xyz`。后续需要产品首页时，再考虑把首页放主域，社区迁到 `community.whyisee.xyz`。

## 4. 阿里云安全组

在阿里云控制台开放安全组端口：

```text
22    SSH
80    HTTP
443   HTTPS
```

如果你限制 SSH 来源 IP，更安全。

## 5. DNS 解析

在域名 DNS 控制台添加 A 记录：

```text
主机记录：@
记录类型：A
记录值：VPS 公网 IP
```

可选添加 `www`：

```text
主机记录：www
记录类型：A
记录值：VPS 公网 IP
```

或者如果用子域名：

```text
主机记录：community
记录类型：A
记录值：VPS 公网 IP
```

安装 Discourse 前，建议先不要开启 Cloudflare 代理，避免影响 Let's Encrypt 证书签发。等部署完成后再决定是否接 Cloudflare。

## 6. 登录服务器

```bash
ssh root@你的服务器IP
```

如果不是 root 用户：

```bash
ssh 用户名@你的服务器IP
```

然后切换 root 或使用 `sudo`。

## 7. 更新系统

Ubuntu / Debian：

```bash
apt update
apt upgrade -y
apt install -y git curl
```

CentOS / Alibaba Cloud Linux 不建议首选。如果系统不是 Ubuntu，建议优先重装为 Ubuntu 22.04 / 24.04，能减少很多部署问题。

## 8. 配置 Swap

2G 内存可以跑 Discourse 小社区，但建议加 2G swap。

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

确认：

```bash
free -h
```

## 9. 安装 Discourse

```bash
git clone https://github.com/discourse/discourse_docker.git /var/discourse
cd /var/discourse
./discourse-setup
```

安装过程中会询问：

```text
Hostname for your Discourse?
Email address for admin account(s)?
SMTP server address?
SMTP port?
SMTP user name?
SMTP password?
Let's Encrypt account email?
```

示例：

```text
Hostname: whyisee.xyz
Admin email: admin@whyisee.xyz
SMTP server: smtp.example.com
SMTP port: 587
SMTP user: smtp-user@example.com
SMTP password: your-smtp-password
Let's Encrypt email: admin@whyisee.xyz
```

注意：

- Hostname 必须是真实域名
- 不要填 IP
- DNS 必须已经指向服务器
- 80 / 443 必须开放
- SMTP 必须可用

## 10. SMTP 邮件服务

Discourse 强依赖邮件。注册、找回密码、通知、管理员邀请都需要邮件。

推荐使用第三方 SMTP，不建议自己在 VPS 上搭邮件服务器。

可选：

- 阿里云邮件推送
- 腾讯企业邮箱
- Resend
- Mailgun
- SendGrid

需要配置：

```text
SPF
DKIM
DMARC
```

如果 SMTP 配置错误，用户可能无法注册，管理员账号也可能创建受阻。

## 11. 中国网络模板

如果服务器在中国大陆，拉取 Docker 镜像或安装依赖可能较慢。可以在 `/var/discourse/containers/app.yml` 的 `templates:` 下增加：

```yaml
  - "templates/web.china.template.yml"
```

然后重建：

```bash
cd /var/discourse
./launcher rebuild app
```

注意：是否需要这个模板取决于实际网络情况。先按官方安装跑，卡住再加。

## 12. 访问网站

安装完成后访问：

```text
https://whyisee.xyz
```

或：

```text
https://community.whyisee.xyz
```

按页面提示创建管理员账号。

如果邮件不可用，可以进入容器手动创建管理员：

```bash
cd /var/discourse
./launcher enter app
rails admin:create
```

## 13. 常用维护命令

进入目录：

```bash
cd /var/discourse
```

查看日志：

```bash
./launcher logs app
```

重启：

```bash
./launcher restart app
```

重建：

```bash
./launcher rebuild app
```

进入容器：

```bash
./launcher enter app
```

查看容器：

```bash
./launcher status app
```

## 14. 首次后台配置

进入后台后，先配置：

```text
站点名称：Why I See
站点域名：whyisee.xyz
默认语言：中文
允许英文内容：是
注册方式：先开放注册或邀请制
Logo：先用文字，后续再设计
深色主题：开启或安装深色主题
```

## 15. 首版分类

创建分类：

```text
公告
AI 工具
独立开发
效率工具
SEO 与流量
项目展示
小游戏与内容站
闲聊
```

建议：

- `公告` 只允许管理员发帖
- `项目展示` 要求使用模板
- `SEO 与流量` 禁止刷量、互点、灰产
- `小游戏与内容站` 明确禁止盗版采集和侵权内容

## 16. 首版标签

创建常用标签：

```text
cursor
codex
deepseek
claude-code
ai-agent
seo
adsense
search-console
open-vsx
github-pages
cloudflare
独立开发
插件
小游戏
内容站
复盘
求反馈
踩坑
教程
收入记录
```

## 17. 基础规则页

需要准备：

- 社区准则
- 隐私政策
- 服务条款
- 新人指南
- 项目展示模板
- 上线复盘模板
- 流量实验模板

核心规则：

```text
允许 AI 辅助写作，但帖子必须包含个人经验、真实截图、数据、代码、项目链接或明确判断。纯 AI 生成内容会被折叠或删除。
```

禁止：

```text
广告互点
刷量
灰产
违法违规项目
侵权游戏/内容采集
无意义营销
纯 AI 水文
```

## 18. 首批种子帖

上线前建议先发 8-10 个帖子：

```text
为什么要做 whyisee.xyz
新人指南：这里适合讨论什么
项目展示模板
上线复盘模板
流量实验模板
Cursor 插件 Open VSX 发布后没人下载，我做了哪些分析
GitHub Pages 做 SEO 是否够用
游戏站接广告这件事到底难在哪里
DeepSeek API 在个人工具里的几种用法
你的第一个独立开发项目应该怎么选题
```

## 19. 2C2G 服务器注意事项

2C2G 可以作为早期社区起点，但不要做太重的二开或运行太多额外服务。

建议：

- 加 swap
- 不装太多插件
- 定期备份
- 图片上传限制合理设置
- 后期有流量后升级到 4G 或 8G

## 20. 备份

必须开启自动备份。

建议：

- 每日备份
- 备份上传到对象存储或异地存储
- 不要只放在同一台服务器

Discourse 后台可以配置备份，也可以后续用阿里云 OSS 存储备份。

## 21. 上线检查清单

- [ ] 域名解析正确
- [ ] 80 / 443 安全组开放
- [ ] HTTPS 正常
- [ ] SMTP 正常
- [ ] 管理员账号可登录
- [ ] 注册邮件可收到
- [ ] 找回密码邮件可收到
- [ ] 分类创建完成
- [ ] 标签创建完成
- [ ] 社区规则页完成
- [ ] 隐私政策和服务条款完成
- [ ] 首批种子帖完成
- [ ] 备份开启
- [ ] 搜索引擎允许抓取

## 22. 下一步

拿到以下信息后，可以继续写一份精确到你服务器的安装记录：

```text
服务器地域：
系统版本：
公网 IP：
使用主域还是子域：
SMTP 服务商：
管理员邮箱：
是否已备案：
```
