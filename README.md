# TG Media Save

**简体中文** | [English](README.en.md) | [Русский](README.ru.md)

项目仓库：[LazyFaiz/tg-media-save](https://github.com/LazyFaiz/tg-media-save)。安装后的扩展名称为 **TG Media Save**，项目和发行文件使用 `tg-media-save`。

基于 [eiler2005/tg-media-saver](https://github.com/eiler2005/tg-media-saver)，保留原作者署名与 [MIT 许可证](LICENSE)。仅保存当前账号可访问且你有权保存的内容；不发送消息，不收集数据。

## 功能

为 Telegram Web 的图片、视频、GIF 和语音提供下载按钮。提供 Chrome / Edge MV3 扩展和 Tampermonkey / Violentmonkey 用户脚本，共用一份源码。项目与 Telegram 无隶属关系。

- 媒体旁的下载按钮，以及左下角用于保存最近捕获媒体的悬浮按钮。
- 从有效文档描述中读取文件名和大小；普通 Blob 使用自动生成的文件名。
- 支持 WebK HLS / MediaSource 原始文件来源解析、分段下载及临时错误重试。
- 不代替用户登录、发帖或发送消息，不收集数据，无运行时第三方依赖。

## 当前版本：1.0.5

2026-09-21，用户在此前报错的 Telegram WebK 视频上确认可以下载。该案例使用 MediaSource 播放器，原始 HLS 地址被 `blob:` 地址覆盖；1.0.5 在覆盖前记录来源，下载对应的原始文件。

49 项自动测试通过。该实测结论针对本次视频下载案例，不代表所有客户端、媒体类型及油猴环境均已验证。

## 安装

1. [下载扩展 ZIP](https://github.com/LazyFaiz/tg-media-save/raw/main/dist/tg-media-save-extension.zip) 并解压；也可以直接使用本仓库的 `extension/` 文件夹。
2. 打开 Chrome 的 `chrome://extensions` 或 Edge 的 `edge://extensions`，开启开发者模式。
3. 禁用旧版 TG Media Saver 和重复的同类脚本。
4. 点击“加载已解压的扩展程序”，选择包含 `manifest.json` 的文件夹。
5. **刷新 Telegram 网页，再重新打开并播放视频**，点击媒体旁的下载按钮。

油猴版本使用 [tg-media-save.user.js](tg-media-save.user.js)，与扩展二选一。当前脚本没有显式 `@updateURL` / `@downloadURL`，升级时请重新安装本仓库版本，不依赖自动更新。

## 使用

1. 打开 Telegram Web，播放视频或音频，或打开图片，让页面加载媒体。
2. 点击媒体旁的下载按钮，或左下角用于保存最近捕获媒体的悬浮按钮。
3. 若浏览器显示保存对话框，选择保存位置，等待下载完成。

请遵守 Telegram 使用条款及内容所有者的版权要求。

## 升级

1. 获取最新代码或安装包，更新浏览器实际加载的文件夹。
2. 在扩展管理页重新加载 **TG Media Save**，确认版本为 **1.0.5**。
3. **刷新 Telegram 页面，然后重新打开视频**。只重新加载扩展无法捕获旧页面已经创建的媒体来源。
4. 播放后点击下载。

## 下载机制与限制

- WebK HLS / MediaSource：按媒体元素记录原始地址，将有效的同源 HLS 文档地址转换为 stream 请求，不用最近一次网络请求猜测视频。
- 普通 Blob：捕获创建时的文件引用，支持保存地址后来被撤销的文件。缓存最多 32 项、合计 512 MiB，每项保留五分钟；超限淘汰旧项，超大文件不缓存。
- 分段下载：每次最多请求 1 MiB，临时网络错误最多尝试三次，并校验范围、字节数和总长度。
- 支持 File System Access API 时分段写入磁盘，否则在内存中组装文件。普通 Blob 保存使用浏览器下载。
- MediaSource 不是普通文件；若未捕获原始地址，不能直接下载其 blob。播放器实现变化也可能影响适配。

## 故障排查

先确认页面已刷新、视频已重新打开。若仍失败，在 **Telegram 网页**的开发者工具 Console 运行：

```js
JSON.stringify(tgSaver.diagnose())
```

输出含版本、捕获功能状态、缓存大小及媒体来源类型，不含完整媒体 URL 或消息内容。

| 字段 | 含义 |
|---|---|
| `sourceCaptureInstalled` | 原始来源捕获是否安装成功 |
| `blobCaptureInstalled` | Blob / MediaSource 类型捕获是否安装成功 |
| `sourceType: "stream"` | 已解析为文件下载地址 |
| `capturedType: "MediaSource"` | 捕获到播放器对象，但当前没有解析到原始文件地址 |
| `capturedType: "not-retained"` | 该地址没有缓存；对于 stream 来源属于正常情况 |
| `readyState: 0` | 此媒体元素尚未加载，页面可能同时存在空闲元素 |

报告问题时附上诊断输出、报错文字以及视频是否能播放。`Failed to fetch` 本身不能区分网络故障、失效 Blob 和 MediaSource。若视频也不能播放，先恢复网络并刷新 Telegram；不要启用 Service Worker 的 “Bypass for network”。详见 [故障排查](docs/TROUBLESHOOTING.md)。

## 开发

需要 Node.js 18+ 和 Python 3（`python` 在 PATH 中），运行时无第三方依赖。

```sh
npm run build
npm test
```

仅编辑 `src/content.js`，构建会生成扩展脚本、油猴脚本和 ZIP。版本以 `extension/manifest.json` 为准。`scripts/build.sh` 是调用 `python3 scripts/build.py` 的兼容入口。

[架构说明](docs/ARCHITECTURE.md) · [测试说明](test/README.md) · [更新日志](CHANGELOG.md)
