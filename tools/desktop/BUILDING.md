# Jinni Canvas 桌面版

两个平台均内置 Python 和后端依赖，运行时不需要开发目录或另行安装 Python。
打包仅收录应用源码；个人画布、图片、API 配置和密钥不随安装包分发。

## macOS Apple Silicon

构建环境：Apple Silicon Mac、Xcode Command Line Tools、uv。

```sh
uv python install 3.12
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt websockets
bash tools/mac_app/build_app.sh --standalone
```

输出 `dist/Jinni Canvas.app` 和 `dist/Jinni Canvas-macOS-arm64.zip`。
`--dmg` 另生成带 Applications 快捷方式的 DMG。
Python 必须来自可搬移的 uv 运行时；构建器会拒绝指向包外的运行时符号链接。
应用使用本机 ad-hoc 签名，尚未进行 Developer ID 签名及 Apple 公证；
从其他机器下载时可能需要在系统“隐私与安全性”中允许打开。

将 `.app` 放入“应用程序”后即可打开。首次启动会选择数据存放位置，
默认 `~/.jinni-canvas`；可用原生文件夹选择器或输入完整路径。
向导会检测源码版和旧版 Application Support 数据，复制并校验所选来源，保留原文件。
定位配置保存在 `~/Library/Application Support/Jinni Canvas/storage.json`。

## Windows x64

构建环境：Python 3、uv、Go 1.25.6+、Bash 和 curl。支持在 macOS 上交叉编译。

```sh
bash tools/windows_app/build.sh
```

输出 `dist/Jinni Canvas-Windows-x64.exe`。运行需要 Windows 10/11 x64
及 Microsoft Edge WebView2 Runtime。首次打开会解压内置运行时，耗时通常长于后续启动。
EXE 尚未进行 Authenticode 签名。

用户数据默认存储在 `%USERPROFILE%\.jinni-canvas`，首次启动可选择其他位置。
定位配置保存在 `%APPDATA%\Jinni Canvas\storage.json`；运行时解包缓存仍在
`%LOCALAPPDATA%\Jinni Canvas\`，更新 EXE 不替换所选数据目录。
向导会检测旧版 LocalAppData 数据，复制并校验后再切换。
缺少 WebView2 时可从 https://developer.microsoft.com/microsoft-edge/webview2/ 安装。
Python 依赖锁定在 `requirements-windows.lock`，不依赖目标机器的 Python 配置。
启动器以 UTF-8 模式运行 Python；初始化页面和数据定位配置也明确使用 UTF-8，
兼容中文 Windows 默认 GBK 编码。

## 验证

```sh
python3 tools/desktop/smoke_backend.py \
  --python 'dist/Jinni Canvas.app/Contents/Resources/python/bin/python3' \
  --app 'dist/Jinni Canvas.app/Contents/Resources/app'
codesign --verify --deep --strict 'dist/Jinni Canvas.app'
```

Windows CI 会运行内置 Python 启动检查、`smoke_backend.py --first-run` 首次初始化检查
及 EXE `--smoke-test`。首次初始化检查覆盖 UTF-8 页面、中文数据目录和后端切换，原生检查验证 WebView
加载应用和本地 API。该检查不代表所有用户工作流或显卡性能均已验收。
测试可以设置 `JINNI_DESKTOP_HOME` 使用独立的数据根目录，并通过
`JINNI_STORAGE_CONFIG` 隔离定位配置。`--smoke-test` 使用临时数据跳过向导，
首次初始化另由 `tests/test_jinni_storage.py` 和浏览器向导验收覆盖。
同时提供 `JINNI_DATA_DIR` 与 `JINNI_ASSETS_DIR` 时保留显式路径覆盖并跳过向导。

## 数据与交互

数据根目录统一包含 `data/`（项目、画布、知识库、供应商及界面配置）和
`assets/`（上传图、生成图、素材库）。目录缺失或结构不完整时重新进入向导；
损坏的 JSON 会提示具体文件，原有内容不会直接覆盖。

左下角齿轮打开供应商配置、快捷键和关于页面。画布空白拖动平移，
Shift 拖动框选，按住 K 拖动预览待切断连线，松手确认后删除；撤销可恢复。
上传图和生成图双击预览后可加入素材库。修改快捷键、关闭总开关和恢复默认均在设置中保存。
