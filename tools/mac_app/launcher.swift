import Cocoa
import WebKit
import Foundation

// MARK: - Global Reference for Signals
private var globalDelegate: AppDelegate?

private func handleSignal(_ sig: Int32) {
    globalDelegate?.stopServer()
    exit(0)
}

// MARK: - Native App Delegate
@available(macOS 11.3, *)
class CanvasWebView: WKWebView {
    override func willOpenMenu(_ menu: NSMenu, with event: NSEvent) {
        // 过滤 WebKit 默认浏览器调试项（如“在新窗口中打开帧框”、“检查元素”等）
        let forbidden = ["帧", "Frame", "新窗口", "新标签", "检查", "Inspect", "重新载入", "Reload", "返回", "前进", "Back", "Forward"]
        menu.items.removeAll { item in
            forbidden.contains { item.title.contains($0) }
        }
    }

    override func scrollWheel(with event: NSEvent) {
        super.scrollWheel(with: event)
    }
}

@available(macOS 11.3, *)
class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    var window: NSWindow!
    var webView: CanvasWebView!
    var loadingView: NSView!
    var statusLabel: NSTextField!
    var progressIndicator: NSProgressIndicator!

    var pythonProcess: Process?
    var stdinPipe: Pipe?
    var serverURL = URL(string: "http://127.0.0.1:3000/")!
    var desktopHome: URL?
    var projectDir: URL!
    var pythonPath: URL!
    var logFileURL: URL!
    var isStopping = false
    var isServerReady = false
    var pollTimer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        globalDelegate = self
        signal(SIGINT, handleSignal)
        signal(SIGTERM, handleSignal)

        NSApp.setActivationPolicy(.regular)

        // 1. 初始化标准菜单（包含撤销、复制、粘贴、全选等快捷键，保证输入框交互正常）
        setupStandardMenus()

        // 2. 创建并立即显示原生桌面主窗口
        setupMainWindow()

        // 3. 智能定位项目与 Python 运行时
        guard locateProjectAndPython() else {
            updateStatus("错误：未找到项目主程序或 Python 运行环境")
            showErrorAlert(
                title: "运行环境缺失",
                message: "未找到 Jinni Canvas 主程序或 Python 虚拟环境。\n请确保在项目目录下，或先运行 ./mac-安装依赖.sh 初始环境。"
            )
            return
        }

        setupLogFile()
        selectServerPort()
        startServer()
        pollServerAndLoadWebUI()
    }

    func applicationWillTerminate(_ notification: Notification) {
        stopServer()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if let win = window {
            win.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
        return true
    }

    // MARK: - Standard macOS Menus
    func setupStandardMenus() {
        let mainMenu = NSMenu()

        // App Menu
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu
        appMenu.addItem(withTitle: "关于 Jinni Canvas", action: #selector(openAbout), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "在系统浏览器中打开", action: #selector(openInExternalBrowser), keyEquivalent: "b")
        appMenu.addItem(withTitle: "打开输出资源文件夹", action: #selector(openOutputFolder), keyEquivalent: "o")
        appMenu.addItem(withTitle: "打开数据存储文件夹", action: #selector(openDataFolder), keyEquivalent: "")
        appMenu.addItem(withTitle: "查看后台服务日志", action: #selector(openLogs), keyEquivalent: "l")
        appMenu.addItem(withTitle: "重启后台服务", action: #selector(restartServer), keyEquivalent: "R")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "退出 Jinni Canvas", action: #selector(quitApp), keyEquivalent: "q")

        // Edit Menu (保证复制粘贴在输入框中生效)
        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "编辑")
        editMenuItem.submenu = editMenu
        for (title, selector, key) in [("撤销", "undo:", "z"), ("重做", "redo:", "Z"),
                                      ("剪切", "cut:", "x"), ("复制", "copy:", "c"),
                                      ("粘贴", "paste:", "v"), ("全选", "selectAll:", "a")] {
            let item = editMenu.addItem(withTitle: title, action: #selector(routeCanvasEdit(_:)), keyEquivalent: key)
            item.target = self
            item.representedObject = selector
        }

        // View Menu
        let viewMenuItem = NSMenuItem()
        mainMenu.addItem(viewMenuItem)
        let viewMenu = NSMenu(title: "视图")
        viewMenuItem.submenu = viewMenu
        viewMenu.addItem(withTitle: "刷新画布", action: #selector(reloadWebUI), keyEquivalent: "r")
        viewMenu.addItem(NSMenuItem.separator())
        for (title, selector, key) in [("放大", "zoomIn", "+"), ("缩小", "zoomOut", "-"), ("实际大小", "zoomReset", "0")] {
            let item = viewMenu.addItem(withTitle: title, action: #selector(routeCanvasEdit(_:)), keyEquivalent: key)
            item.target = self
            item.representedObject = selector
        }
        viewMenu.addItem(NSMenuItem.separator())
        viewMenu.addItem(withTitle: "进入全屏幕", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")

        // Window Menu
        let windowMenuItem = NSMenuItem()
        mainMenu.addItem(windowMenuItem)
        let windowMenu = NSMenu(title: "窗口")
        windowMenuItem.submenu = windowMenu
        windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "缩放", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowMenu.addItem(NSMenuItem.separator())
        windowMenu.addItem(withTitle: "前置所有窗口", action: #selector(NSWindow.orderFrontRegardless), keyEquivalent: "")

        NSApp.mainMenu = mainMenu
    }

    // MARK: - Native Main Window
    func setupMainWindow() {
        let screenRect = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let winWidth: CGFloat = min(1440, screenRect.width * 0.94)
        let winHeight: CGFloat = min(960, screenRect.height * 0.94)
        let rect = NSRect(
            x: screenRect.midX - winWidth / 2,
            y: screenRect.midY - winHeight / 2,
            width: winWidth,
            height: winHeight
        )

        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Jinni Canvas"
        window.titleVisibility = .visible
        window.titlebarAppearsTransparent = false
        window.minSize = NSSize(width: 1024, height: 680)
        window.delegate = self
        window.backgroundColor = NSColor(calibratedRed: 0.99, green: 0.99, blue: 1.0, alpha: 1.0)
        window.isReleasedWhenClosed = false

        let contentView = NSView(frame: window.contentView!.bounds)
        contentView.autoresizingMask = [.width, .height]
        window.contentView = contentView

        // WKWebView 配置
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "chooseDataDirectory")
        config.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "saveCanvasExport")
        let prefs = config.preferences
        prefs.setValue(false, forKey: "developerExtrasEnabled")
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        webView = CanvasWebView(frame: contentView.bounds, configuration: config)
        webView.allowsMagnification = false
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.alphaValue = 0.0
        contentView.addSubview(webView)

        // Loading 覆盖层
        setupLoadingView(in: contentView)

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func setupLoadingView(in parent: NSView) {
        loadingView = NSView(frame: parent.bounds)
        loadingView.autoresizingMask = [.width, .height]
        loadingView.wantsLayer = true
        loadingView.layer?.backgroundColor = NSColor(calibratedRed: 0.98, green: 0.98, blue: 0.99, alpha: 1.0).cgColor

        progressIndicator = NSProgressIndicator()
        progressIndicator.style = .spinning
        progressIndicator.controlSize = .regular
        progressIndicator.sizeToFit()
        progressIndicator.startAnimation(nil)

        let titleLabel = NSTextField(labelWithString: "Jinni Canvas")
        titleLabel.font = NSFont.systemFont(ofSize: 22, weight: .bold)
        titleLabel.textColor = NSColor.labelColor
        titleLabel.alignment = .center

        statusLabel = NSTextField(labelWithString: "正在启动原生智能画布服务，请稍候...")
        statusLabel.font = NSFont.systemFont(ofSize: 13, weight: .regular)
        statusLabel.textColor = NSColor.secondaryLabelColor
        statusLabel.alignment = .center

        let stack = NSStackView(views: [titleLabel, progressIndicator, statusLabel])
        stack.orientation = .vertical
        stack.alignment = .centerX
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false

        loadingView.addSubview(stack)
        parent.addSubview(loadingView)

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: loadingView.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: loadingView.centerYAnchor)
        ])
    }

    func updateStatus(_ text: String) {
        DispatchQueue.main.async {
            self.statusLabel?.stringValue = text
        }
    }

    func transitionToWebUI() {
        guard !isServerReady else { return }
        isServerReady = true

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.updateStatus("服务已就绪，正在呈现画布...")

            // 更新网页缓存，同时保留 localStorage 中的界面设置。
            let dataStore = WKWebsiteDataStore.default()
            let types: Set<String> = [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache]
            dataStore.removeData(ofTypes: types, modifiedSince: Date.distantPast) { [weak self] in
                guard let self = self else { return }
                let request = URLRequest(url: self.serverURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
                self.webView.load(request)

                NSAnimationContext.runAnimationGroup({ context in
                    context.duration = 0.4
                    self.webView.animator().alphaValue = 1.0
                    self.loadingView.animator().alphaValue = 0.0
                }, completionHandler: {
                    self.loadingView.isHidden = true
                })
            }
        }
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "chooseDataDirectory", message.frameInfo.isMainFrame,
              let url = message.frameInfo.request.url, url.host == "127.0.0.1",
              url.port == serverURL.port else { return }
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.canCreateDirectories = true
        panel.allowsMultipleSelection = false
        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let path = panel.url?.path,
                  let data = try? JSONSerialization.data(withJSONObject: [path]),
                  let literal = String(data: data, encoding: .utf8) else { return }
            self.webView.evaluateJavaScript("window.jinniDirectorySelected?.(\(literal)[0])", completionHandler: nil)
        }
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.name == "saveCanvasExport", let url = message.frameInfo.request.url,
              url.scheme == "http", url.host == "127.0.0.1", url.port == serverURL.port,
              let body = message.body as? [String: String], let filename = body["filename"],
              ["json", "zip"].contains((filename as NSString).pathExtension.lowercased()),
              let encoded = body["base64"], let data = Data(base64Encoded: encoded) else {
            replyHandler(nil, "无效的导出请求"); return
        }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = (filename as NSString).lastPathComponent
        panel.canCreateDirectories = true
        if let directory = UserDefaults.standard.string(forKey: "jinni_export_directory") { panel.directoryURL = URL(fileURLWithPath: directory) }
        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let destination = panel.url else { replyHandler(["status":"cancelled"], nil); return }
            do {
                try data.write(to: destination, options: .atomic)
                UserDefaults.standard.set(destination.deletingLastPathComponent().path, forKey: "jinni_export_directory")
                replyHandler(["status":"saved", "path":destination.path], nil)
            } catch { replyHandler(["status":"error", "message":"无法写入所选位置，请检查目录权限和可用空间"], nil) }
        }
    }

    // MARK: - Smart Path Resolution
    func locateProjectAndPython() -> Bool {
        let bundleURL = Bundle.main.bundleURL

        let resources = bundleURL.appendingPathComponent("Contents/Resources")
        let bundledMain = resources.appendingPathComponent("app/main.py")
        if FileManager.default.fileExists(atPath: bundledMain.path) {
            projectDir = resources.appendingPathComponent("app")
            pythonPath = resources.appendingPathComponent("python/bin/python3")
            let override = ProcessInfo.processInfo.environment["JINNI_DESKTOP_HOME"]
            desktopHome = override.map { URL(fileURLWithPath: $0) }
                ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!.appendingPathComponent("Jinni Canvas")
            try? FileManager.default.createDirectory(at: desktopHome!, withIntermediateDirectories: true)
            return FileManager.default.fileExists(atPath: pythonPath.path)
        }

        var candidates: [URL] = [
            bundleURL.appendingPathComponent("Contents/Resources/app"),
            bundleURL.deletingLastPathComponent(),
            URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        ]

        if let savedPath = UserDefaults.standard.string(forKey: "jinni_project_dir") {
            candidates.insert(URL(fileURLWithPath: savedPath), at: 0)
        }

        for dir in candidates {
            let mainPy = dir.appendingPathComponent("main.py")
            if FileManager.default.fileExists(atPath: mainPy.path) {
                projectDir = dir
                UserDefaults.standard.set(dir.path, forKey: "jinni_project_dir")
                break
            }
        }

        guard let proj = projectDir else { return false }

        // 查找可用 Python
        let pythonCandidates: [URL] = [
            bundleURL.appendingPathComponent("Contents/Resources/venv/bin/python"),
            proj.appendingPathComponent(".venv/bin/python")
        ]

        for py in pythonCandidates {
            if FileManager.default.fileExists(atPath: py.path) {
                pythonPath = py
                return true
            }
        }

        // 查找系统 Python
        for p in ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"] {
            if FileManager.default.fileExists(atPath: p) {
                pythonPath = URL(fileURLWithPath: p)
                return true
            }
        }

        return false
    }

    // MARK: - Logging Setup
    func setupLogFile() {
        logFileURL = (desktopHome ?? projectDir).appendingPathComponent("server.log")
        if !FileManager.default.fileExists(atPath: logFileURL.path) {
            FileManager.default.createFile(atPath: logFileURL.path, contents: nil, attributes: nil)
        }
    }

    func appendLog(_ text: String) {
        guard let url = logFileURL else { return }
        if let data = (text + "\n").data(using: .utf8),
           let fileHandle = try? FileHandle(forWritingTo: url) {
            fileHandle.seekToEndOfFile()
            fileHandle.write(data)
            try? fileHandle.close()
        }
    }

    // MARK: - Port Cleanup
    func selectServerPort() {
        for port in 3000..<3100 {
            let fd = socket(AF_INET, SOCK_STREAM, 0)
            guard fd >= 0 else { continue }
            var address = sockaddr_in()
            address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
            address.sin_family = sa_family_t(AF_INET)
            address.sin_port = UInt16(port).bigEndian
            address.sin_addr.s_addr = inet_addr("127.0.0.1")
            let result = withUnsafePointer(to: &address) {
                $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                    Darwin.bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
                }
            }
            close(fd)
            if result == 0 {
                serverURL = URL(string: "http://127.0.0.1:\(port)/")!
                return
            }
        }
    }

    // MARK: - Launch & Manage Background Server
    func startServer() {
        appendLog("==========================================")
        appendLog("启动 Jinni Canvas 原生服务: \(Date())")
        appendLog("项目路径: \(projectDir.path)")
        appendLog("Python: \(pythonPath.path)")
        appendLog("==========================================")

        let process = Process()
        process.executableURL = pythonPath
        process.arguments = ["main.py"]
        process.currentDirectoryURL = projectDir

        // 关键防护：创建开放的标准输入管道，彻底防止 Uvicorn 因 stdin EOF 自动退出！
        let stdin = Pipe()
        self.stdinPipe = stdin
        process.standardInput = stdin

        var env = ProcessInfo.processInfo.environment
        env["PYTHONUNBUFFERED"] = "1"
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        env["JINNI_HOST"] = "127.0.0.1"
        env["JINNI_PORT"] = String(serverURL.port ?? 3000)
        if let legacy = UserDefaults.standard.string(forKey: "jinni_project_dir") {
            env["JINNI_LEGACY_PROJECT"] = legacy
        }
        if let home = desktopHome {
            env["JINNI_DESKTOP_BUNDLE"] = "1"
            env["JINNI_LEGACY_ROOT"] = home.path
        }
        let extraPaths = [
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
            "/usr/local/bin",
            FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".local/bin").path,
            FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".cargo/bin").path
        ]
        let curPath = env["PATH"] ?? ""
        var pathList = curPath.components(separatedBy: ":")
        for p in extraPaths.reversed() {
            if FileManager.default.fileExists(atPath: p) && !pathList.contains(p) {
                pathList.insert(p, at: 0)
            }
        }
        env["PATH"] = pathList.joined(separator: ":")
        process.environment = env

        if let logHandle = try? FileHandle(forWritingTo: logFileURL) {
            logHandle.seekToEndOfFile()
            process.standardOutput = logHandle
            process.standardError = logHandle
        }

        process.terminationHandler = { [weak self] proc in
            guard let self = self else { return }
            self.appendLog("后台服务已停止 (退出码: \(proc.terminationStatus))")
            if !self.isStopping && !self.isServerReady {
                DispatchQueue.main.async {
                    self.updateStatus("后台服务启动异常 (退出码 \(proc.terminationStatus))")
                    self.showErrorAlert(
                        title: "服务启动异常",
                        message: "Jinni Canvas 后台服务启动退出。\n可点击“查看日志”了解详细信息。"
                    )
                }
            }
        }

        do {
            try process.run()
            self.pythonProcess = process
        } catch {
            appendLog("启动失败: \(error.localizedDescription)")
            showErrorAlert(title: "启动错误", message: error.localizedDescription)
        }
    }

    func stopServer() {
        isStopping = true
        pollTimer?.invalidate()
        pollTimer = nil

        if let proc = pythonProcess, proc.isRunning {
            appendLog("正在停止后台服务...")
            proc.terminate()
            for _ in 0..<15 {
                if !proc.isRunning { break }
                Thread.sleep(forTimeInterval: 0.1)
            }
            if proc.isRunning {
                kill(proc.processIdentifier, SIGKILL)
            }
            appendLog("后台服务已停止。")
        }
        stdinPipe = nil
    }

    // MARK: - Health Check & Load UI
    func pollServerAndLoadWebUI() {
        var attempts = 0
        let maxAttempts = 60

        pollTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }

            if self.isServerReady || self.isStopping {
                timer.invalidate()
                return
            }

            attempts += 1
            if attempts > maxAttempts {
                timer.invalidate()
                if let proc = self.pythonProcess, !proc.isRunning { return }
                self.updateStatus("启动超时，请查看服务日志")
                self.showErrorAlert(title: "连接超时", message: "服务未能在 30 秒内就绪，请查看服务日志。")
                return
            }

            var request = URLRequest(url: self.serverURL)
            request.timeoutInterval = 0.4
            let task = URLSession.shared.dataTask(with: request) { _, response, _ in
                if let httpResp = response as? HTTPURLResponse, httpResp.statusCode < 500 {
                    DispatchQueue.main.async {
                        timer.invalidate()
                        self.transitionToWebUI()
                    }
                }
            }
            task.resume()
        }
    }

    // MARK: - Actions
    @objc func reloadWebUI() {
        let request = URLRequest(url: self.serverURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        webView?.load(request)
    }

    @objc func openInExternalBrowser() {
        NSWorkspace.shared.open(serverURL)
    }

    @objc func routeCanvasEdit(_ sender: NSMenuItem) {
        let key = sender.keyEquivalent.lowercased()
        let shift = sender.keyEquivalent != key
        guard let data = try? JSONSerialization.data(withJSONObject: [key]),
              let literal = String(data: data, encoding: .utf8),
              let fallback = sender.representedObject as? String else { return }
        webView.evaluateJavaScript("window.JinniNativeKey?.(\(literal)[0], \(shift)) === true") { value, _ in
            if value as? Bool != true { NSApp.sendAction(Selector(fallback), to: nil, from: sender) }
        }
    }

    func selectedDataRoot() -> URL {
        let env = ProcessInfo.processInfo.environment
        if let override = env["JINNI_DESKTOP_HOME"] { return URL(fileURLWithPath: override) }
        let config = env["JINNI_STORAGE_CONFIG"].map { URL(fileURLWithPath: $0) }
            ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/Jinni Canvas/storage.json")
        if let data = try? Data(contentsOf: config),
           let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let root = value["root"] as? String { return URL(fileURLWithPath: root) }
        return FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".jinni-canvas")
    }

    @objc func openOutputFolder() {
        let outputDir = selectedDataRoot().appendingPathComponent("assets/output")
        if !FileManager.default.fileExists(atPath: outputDir.path) {
            try? FileManager.default.createDirectory(at: outputDir, withIntermediateDirectories: true)
        }
        NSWorkspace.shared.open(outputDir)
    }

    @objc func openDataFolder() {
        let target = selectedDataRoot()
        NSWorkspace.shared.open(target)
    }

    @objc func openLogs() {
        if let url = logFileURL {
            NSWorkspace.shared.open(url)
        }
    }

    @objc func zoomIn() {
        webView.pageZoom += 0.1
    }

    @objc func zoomOut() {
        webView.pageZoom = max(0.5, webView.pageZoom - 0.1)
    }

    @objc func zoomReset() {
        webView.pageZoom = 1.0
    }

    @objc func openAbout() {
        let alert = NSAlert()
        alert.messageText = "Jinni Canvas for macOS"
        alert.informativeText = "AI 智能画布与生图创作工作台\n服务端口: \(serverURL.port ?? 3000)\n本地原生桌面客户端"
        alert.alertStyle = .informational
        alert.runModal()
    }

    @objc func restartServer() {
        stopServer()
        isStopping = false
        isServerReady = false
        loadingView.isHidden = false
        loadingView.alphaValue = 1.0
        webView.alphaValue = 0.0
        updateStatus("正在重启服务...")
        selectServerPort()
        startServer()
        pollServerAndLoadWebUI()
    }

    @objc func quitApp() {
        NSApp.terminate(nil)
    }

    func showErrorAlert(title: String, message: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = .critical
        alert.addButton(withTitle: "确定")
        alert.addButton(withTitle: "查看日志")
        if alert.runModal() == .alertSecondButtonReturn {
            openLogs()
        }
    }

    // WKWebView UIDelegate
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            if let targetURL = navigationAction.request.url {
                if targetURL.host == "127.0.0.1" || targetURL.host == "localhost" {
                    webView.load(navigationAction.request)
                } else {
                    NSWorkspace.shared.open(targetURL)
                }
            }
        }
        return nil
    }

    // 支持网页中所有的 JavaScript alert() 弹窗
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = "提示"
        alert.informativeText = message
        alert.alertStyle = .informational
        alert.addButton(withTitle: "确定")
        alert.runModal()
        completionHandler()
    }

    // 支持网页中所有的 JavaScript confirm() 确认弹窗
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = "确认操作"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: "确定")
        alert.addButton(withTitle: "取消")
        let response = alert.runModal()
        completionHandler(response == .alertFirstButtonReturn)
    }

    // 支持网页中的 JavaScript prompt() 输入弹窗
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = NSAlert()
        alert.messageText = prompt
        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24))
        input.stringValue = defaultText ?? ""
        alert.accessoryView = input
        alert.addButton(withTitle: "确定")
        alert.addButton(withTitle: "取消")
        let response = alert.runModal()
        if response == .alertFirstButtonReturn {
            completionHandler(input.stringValue)
        } else {
            completionHandler(nil)
        }
    }

    // WKDownloadDelegate - 支持图片导出和文件下载
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let downloads = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first!
        var destination = downloads.appendingPathComponent(suggestedFilename)
        var index = 1
        let nameWithoutExt = (suggestedFilename as NSString).deletingPathExtension
        let ext = (suggestedFilename as NSString).pathExtension

        while FileManager.default.fileExists(atPath: destination.path) {
            let newName = ext.isEmpty ? "\(nameWithoutExt)_\(index)" : "\(nameWithoutExt)_\(index).\(ext)"
            destination = downloads.appendingPathComponent(newName)
            index += 1
        }
        completionHandler(destination)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }
}

// MARK: - Main Entry Point
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
