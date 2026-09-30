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

用户数据存储在 `~/Library/Application Support/Jinni Canvas/`。
将 `.app` 放入“应用程序”后即可打开。首次使用为独立的空白工作区；
已有源码版画布可通过应用的导出、导入功能迁移。

## Windows x64

构建环境：Python 3、uv、Go 1.25.6+、Bash 和 curl。支持在 macOS 上交叉编译。

```sh
bash tools/windows_app/build.sh
```

输出 `dist/Jinni Canvas-Windows-x64.exe`。运行需要 Windows 10/11 x64
及 Microsoft Edge WebView2 Runtime。首次打开会解压内置运行时，耗时通常长于后续启动。
EXE 尚未进行 Authenticode 签名。

用户数据存储在 `%LOCALAPPDATA%\Jinni Canvas\`，更新 EXE 会保留这些数据。
缺少 WebView2 时可从 https://developer.microsoft.com/microsoft-edge/webview2/ 安装。
Python 依赖锁定在 `requirements-windows.lock`，不依赖目标机器的 Python 配置。

## 验证

```sh
python3 tools/desktop/smoke_backend.py \
  --python 'dist/Jinni Canvas.app/Contents/Resources/python/bin/python3' \
  --app 'dist/Jinni Canvas.app/Contents/Resources/app'
codesign --verify --deep --strict 'dist/Jinni Canvas.app'
```

Windows CI 会运行内置 Python 启动检查及 EXE `--smoke-test`，验证原生 WebView
加载应用和本地 API。该检查不代表所有用户工作流或显卡性能均已验收。
测试可以设置 `JINNI_DESKTOP_HOME` 使用独立的桌面数据目录。
