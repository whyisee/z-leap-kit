# whyisee.xyz 静态备案首页

这是 `whyisee.xyz` 的纯静态首页，用于备案阶段和社区正式上线前的占位展示。

## 文件

- `index.html`：首页内容
- `styles.css`：页面样式
- `assets/site-mark.svg`：站点标识
- `robots.txt`：爬虫配置
- `sitemap.xml`：站点地图
- `nginx.example.conf`：Nginx 示例配置

## 部署

把本目录下的文件上传到站点根目录即可，例如：

```bash
/var/www/whyisee.xyz/
  index.html
  styles.css
  robots.txt
  sitemap.xml
  assets/site-mark.svg
```

Nginx 的 `root` 指向该目录，首页文件使用 `index.html`。
可以参考 `nginx.example.conf`。

备案号下来后，把 `index.html` 底部的 `ICP备案号：备案完成后展示` 改成实际备案号，并链接到工信部备案系统。
