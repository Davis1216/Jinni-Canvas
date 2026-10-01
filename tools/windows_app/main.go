//go:build windows

package main

import (
	"archive/zip"
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	_ "embed"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
	"unsafe"

	webview "github.com/jchv/go-webview2"
	"golang.org/x/sys/windows"
)

//go:embed payload.zip
var payload []byte

var smokeTest = len(os.Args) == 2 && os.Args[1] == "--smoke-test"

func message(text string) {
	title, _ := syscall.UTF16PtrFromString("Jinni Canvas")
	body, _ := syscall.UTF16PtrFromString(text)
	syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(body)), uintptr(unsafe.Pointer(title)), 0x10)
}

func unpack(root string) (string, error) {
	digest := sha256.Sum256(payload)
	target := filepath.Join(root, "runtime", fmt.Sprintf("%x", digest[:8]))
	if _, err := os.Stat(filepath.Join(target, ".complete")); err == nil {
		return target, nil
	}
	if err := os.MkdirAll(filepath.Dir(target), 0700); err != nil {
		return "", err
	}
	staging, err := os.MkdirTemp(filepath.Dir(target), "extract-")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(staging)
	archive, err := zip.NewReader(bytes.NewReader(payload), int64(len(payload)))
	if err != nil {
		return "", err
	}
	for _, entry := range archive.File {
		name := filepath.FromSlash(entry.Name)
		if filepath.IsAbs(name) || strings.Contains(name, ":") {
			return "", fmt.Errorf("invalid bundled path")
		}
		dest := filepath.Join(staging, name)
		if !strings.HasPrefix(dest, staging+string(os.PathSeparator)) {
			return "", fmt.Errorf("invalid bundled path")
		}
		if entry.FileInfo().IsDir() {
			if err := os.MkdirAll(dest, 0700); err != nil {
				return "", err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(dest), 0700); err != nil {
			return "", err
		}
		if err := extractFile(entry, dest); err != nil {
			return "", err
		}
	}
	if err := os.WriteFile(filepath.Join(staging, ".complete"), []byte("ok"), 0600); err != nil {
		return "", err
	}
	if err := os.Rename(staging, target); err != nil {
		return "", err
	}
	return target, nil
}
func extractFile(entry *zip.File, dest string) error {
	src, err := entry.Open()
	if err != nil {
		return err
	}
	defer src.Close()
	dst, err := os.OpenFile(dest, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(dst, src)
	closeErr := dst.Close()
	if copyErr != nil {
		return copyErr
	}
	return closeErr
}
func availablePort() (int, error) {
	for port := 3000; port < 3100; port++ {
		listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err == nil {
			listener.Close()
			return port, nil
		}
	}
	return 0, fmt.Errorf("没有可用的本地服务端口")
}
func run() error {
	mutexName, _ := windows.UTF16PtrFromString("Local\\JinniCanvasDesktop")
	mutex, err := windows.CreateMutex(nil, false, mutexName)
	if err == windows.ERROR_ALREADY_EXISTS {
		return fmt.Errorf("Jinni Canvas 已在运行，请使用已打开的窗口")
	}
	if err != nil {
		return err
	}
	defer windows.CloseHandle(mutex)
	base, err := os.UserCacheDir()
	if err != nil {
		return err
	}
	root := filepath.Join(base, "Jinni Canvas")
	if override := os.Getenv("JINNI_DESKTOP_HOME"); override != "" {
		root = override
	}
	if err := os.MkdirAll(root, 0700); err != nil {
		return err
	}
	content, err := unpack(root)
	if err != nil {
		return err
	}
	port, err := availablePort()
	if err != nil {
		return err
	}
	address := fmt.Sprintf("http://127.0.0.1:%d/", port)
	log, err := os.OpenFile(filepath.Join(root, "server.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer log.Close()
	command := exec.Command(filepath.Join(content, "python", "python.exe"), filepath.Join(content, "app", "main.py"))
	command.Dir = filepath.Join(content, "app")
	command.Env = append(os.Environ(),
		"JINNI_DESKTOP_BUNDLE=1",
		"PYTHONUNBUFFERED=1", "PYTHONDONTWRITEBYTECODE=1",
		"JINNI_HOST=127.0.0.1", fmt.Sprintf("JINNI_PORT=%d", port),
		"JINNI_LEGACY_ROOT="+root)
	if smokeTest {
		// CI checks the normal WebView with disposable data; interactive setup
		// has its own acceptance test and must not block this unattended check.
		dataRoot, err := os.MkdirTemp("", "jinni-desktop-smoke-")
		if err != nil {
			return err
		}
		defer os.RemoveAll(dataRoot)
		command.Env = append(command.Env,
			"JINNI_DATA_DIR="+filepath.Join(dataRoot, "data"),
			"JINNI_ASSETS_DIR="+filepath.Join(dataRoot, "assets"),
			"JINNI_KB_DATA_DIR="+filepath.Join(dataRoot, "data", "knowledge_base"))
	}
	command.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	command.Stdout, command.Stderr = log, log
	if err := command.Start(); err != nil {
		return err
	}
	done := make(chan error, 1)
	go func() { done <- command.Wait() }()
	defer command.Process.Kill()
	client := &http.Client{Timeout: time.Second}
	ready := false
	for deadline := time.Now().Add(60 * time.Second); time.Now().Before(deadline); {
		select {
		case err := <-done:
			return fmt.Errorf("后台服务退出：%v。请查看 %s", err, log.Name())
		default:
		}
		response, err := client.Get(address)
		if err == nil {
			response.Body.Close()
			if response.StatusCode == 200 {
				ready = true
				break
			}
		}
		time.Sleep(200 * time.Millisecond)
	}
	if !ready {
		return fmt.Errorf("服务启动超时，请查看 %s", log.Name())
	}
	view := webview.NewWithOptions(webview.WebViewOptions{
		DataPath: filepath.Join(root, "webview"), AutoFocus: true,
		WindowOptions: webview.WindowOptions{Title: "Jinni Canvas", Width: 1440, Height: 900, Center: true},
	})
	if view == nil {
		return fmt.Errorf("无法创建窗口。请安装 Microsoft Edge WebView2 Runtime：https://developer.microsoft.com/microsoft-edge/webview2/")
	}
	defer view.Destroy()
	exportNonce := make([]byte, 32)
	if _, err := rand.Read(exportNonce); err != nil {
		return err
	}
	exportToken := hex.EncodeToString(exportNonce)
	if err := view.Bind("jinniSaveExportNative", func(token, filename, encoded string) (map[string]string, error) {
		if token != exportToken {
			return nil, fmt.Errorf("无效的导出来源")
		}
		filename = filepath.Base(filename)
		ext := strings.ToLower(filepath.Ext(filename))
		if ext != ".json" && ext != ".zip" {
			return nil, fmt.Errorf("不支持的导出格式")
		}
		data, err := base64.StdEncoding.DecodeString(encoded)
		if err != nil {
			return nil, fmt.Errorf("导出内容无效")
		}
		last, _ := os.ReadFile(filepath.Join(root, "export-directory.txt"))
		picker := exec.Command("powershell.exe", "-NoProfile", "-STA", "-Command", `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $p = New-Object System.Windows.Forms.SaveFileDialog; $p.FileName = $env:JINNI_EXPORT_NAME; $p.InitialDirectory = $env:JINNI_EXPORT_DIRECTORY; $p.OverwritePrompt = $true; if ($p.ShowDialog() -eq 'OK') { [Console]::Write($p.FileName) }`)
		picker.Env = append(os.Environ(), "JINNI_EXPORT_NAME="+filename, "JINNI_EXPORT_DIRECTORY="+string(last))
		picker.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		output, err := picker.Output()
		if err != nil {
			return nil, fmt.Errorf("无法打开另存为窗口")
		}
		target := strings.TrimSpace(strings.TrimPrefix(string(output), "\ufeff"))
		if target == "" {
			return map[string]string{"status": "cancelled"}, nil
		}
		tmp, err := os.CreateTemp(filepath.Dir(target), ".jinni-export-*")
		if err != nil {
			return nil, fmt.Errorf("导出目录不可写")
		}
		defer os.Remove(tmp.Name())
		_, writeErr := tmp.Write(data)
		closeErr := tmp.Close()
		if writeErr != nil || closeErr != nil {
			return nil, fmt.Errorf("导出写入失败")
		}
		src, _ := windows.UTF16PtrFromString(tmp.Name())
		dst, _ := windows.UTF16PtrFromString(target)
		if err := windows.MoveFileEx(src, dst, windows.MOVEFILE_REPLACE_EXISTING|windows.MOVEFILE_WRITE_THROUGH); err != nil {
			return nil, fmt.Errorf("无法保存导出文件")
		}
		_ = os.WriteFile(filepath.Join(root, "export-directory.txt"), []byte(filepath.Dir(target)), 0600)
		return map[string]string{"status": "saved", "path": target}, nil
	}); err != nil {
		return err
	}
	originJSON, _ := json.Marshal(strings.TrimSuffix(address, "/"))
	tokenJSON, _ := json.Marshal(exportToken)
	view.Init(fmt.Sprintf(`if(location.origin===%s){window.jinniSaveExport=(name,data)=>window.jinniSaveExportNative(%s,name,data)}`, originJSON, tokenJSON))
	if err := view.Bind("chooseDataDirectory", func(token string) (string, error) {
		// Only the local setup document knows this per-start nonce. The endpoint
		// disappears once initialization hands control to the normal backend.
		request, err := http.NewRequest(http.MethodPost, address+"api/setup/directory-picker", nil)
		if err != nil {
			return "", err
		}
		request.Header.Set("Origin", strings.TrimSuffix(address, "/"))
		request.Header.Set("X-Setup-Token", token)
		response, err := (&http.Client{Timeout: 3 * time.Second}).Do(request)
		if err != nil {
			return "", fmt.Errorf("目录选择仅在初始化页面可用")
		}
		response.Body.Close()
		if response.StatusCode != http.StatusOK {
			return "", fmt.Errorf("目录选择仅在初始化页面可用")
		}
		picker := exec.Command("powershell.exe", "-NoProfile", "-STA", "-Command", `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $picker = New-Object System.Windows.Forms.FolderBrowserDialog; $picker.Description = 'Jinni Canvas data folder'; if ($picker.ShowDialog() -eq 'OK') { [Console]::Write($picker.SelectedPath) }`)
		picker.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		output, err := picker.Output()
		return strings.TrimSpace(strings.TrimPrefix(string(output), "\ufeff")), err
	}); err != nil {
		return err
	}

	var smokeResult chan error
	if smokeTest {
		smokeResult = make(chan error, 1)
		if err := view.Bind("desktopSmokeResult", func(problem string) {
			var result error
			if problem != "" {
				result = fmt.Errorf("WebView smoke test: %s", problem)
			}
			select {
			case smokeResult <- result:
				view.Dispatch(view.Terminate)
			default:
			}
		}); err != nil {
			return err
		}
		view.Init(`window.addEventListener('DOMContentLoaded', async () => {
            if (window !== window.top) return;
            try {
                if (!document.querySelector('iframe')) throw new Error('Application shell missing');
                for (const path of ['/api/projects', '/api/canvases', '/api/inspiration-space']) {
                    const response = await fetch(path);
                    if (!response.ok) throw new Error(path + ': ' + response.status);
                    await response.json();
                }
                await desktopSmokeResult('');
            } catch (error) { await desktopSmokeResult(String(error)); }
        });`)
		timer := time.AfterFunc(45*time.Second, func() {
			view.Dispatch(view.Terminate)
		})
		defer timer.Stop()
	}
	view.Navigate(address)
	view.Run()
	if smokeTest {
		select {
		case result := <-smokeResult:
			return result
		default:
			return fmt.Errorf("WebView smoke test timed out or window closed")
		}
	}
	return nil
}
func main() {
	runtime.LockOSThread()
	if err := run(); err != nil {
		if smokeTest {
			fmt.Fprintln(os.Stderr, err)
		} else {
			message(err.Error())
		}
		os.Exit(1)
	}
}
