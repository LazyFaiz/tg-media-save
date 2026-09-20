# tg-media-save（本地修复版）

基于 https://github.com/eiler2005/tg-media-saver，保留原作者 MIT 许可证及历史。
仅下载当前账号可访问且你有权保存的内容。不收集数据。

## 安装

1. 打开 Chrome 的 chrome://extensions 或 Edge 的 edge://extensions，开启开发者模式。
2. 禁用旧版 TG Media Saver 和同类油猴脚本，避免重复执行。
3. 点击“加载已解压的扩展程序”，选择当前项目的 extension 文件夹。
4. 刷新 Telegram Web，播放媒体后点击下载按钮。

也可解压 dist/tg-media-save-extension.zip 后加载。本项目 README 下载链接指向 LazyFaiz/tg-media-save。
油猴版本使用本项目 tg-media-save.user.js；已移除上游更新地址，避免覆盖本地修复。

## 1.0.2 修复

- 网络异常和指定临时 HTTP 错误最多尝试三次，包括读取响应体时断流；重试保持相同下载偏移。
- 使用 1 MiB 范围请求，校验响应范围、实际字节数和总长度，防止残缺文件被当作成功。
- 已写入部分文件后收到完整响应，先重置文件再保存，避免重复内容。
- 更新复用媒体元素的地址；延迟释放下载 Blob URL。
- 区分网络失败、HTTP 错误和无法直接下载的 MediaSource/失效 blob 地址。

截图中的 Failed to fetch 是通用网络异常，不能单凭截图确定唯一根因。
本修复不会重置 Telegram 会话或注销 Service Worker。若媒体本身无法播放，需恢复网络并刷新页面。
1.0.3 支持 Telegram WebK 在 video.src 保留 HLS 文档描述的媒体：自动转换为同一文档的 stream 地址，不再下载播放器的 MediaSource blob。对于没有可解析原始地址的 blob，仍可能报错。

升级后请在扩展管理页重新加载扩展，并刷新 Telegram 页面。

## 开发与验证

需要 Node.js 18+、Python 3。

```sh
npm run build
npm test
```

源码为 src/content.js，构建生成扩展、油猴脚本及 ZIP。
Git 的 upstream 保留参考仓库地址，未设置自己的 origin，未推送到远程。
自动测试使用模拟响应；真实账号下的播放、下载和文件打开仍需手工验证。
