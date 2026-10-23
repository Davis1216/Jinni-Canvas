<div align="center">

# 🎨 Jinni-Canvas

**面向视觉创作者与 AI 开发者的开源多模态无限画布**

*连接 AI 智能体、ComfyUI、向量知识库与多模态创作流的无限空间工作台*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-brightgreen.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![VectorDB](https://img.shields.io/badge/Vector%20DB-LanceDB-orange.svg)](https://lancedb.com/)
[![ComfyUI Ready](https://img.shields.io/badge/Workflow-ComfyUI%20%7C%20Flux%20%7C%20LTX-purple.svg)](https://github.com/comfyanonymous/ComfyUI)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](#-快速开始)

[English](README.md) · [简体中文](README_zh.md) · [Mac 使用说明](MAC-使用说明.md) · [提交反馈](https://github.com/Davis1216/Jinni-Canvas/issues) · [需求建议](https://github.com/Davis1216/Jinni-Canvas/issues)

</div>

---

## 🌟 项目亮点

**Jinni-Canvas** 旨在彻底打破生成式 AI 模型、向量知识库与视觉设计软件之间的孤岛。它提供了一个非线性的无边界空间画布，让设计师、开发者和创作者能够自由组织头脑风暴，可视化串联多模态生成节点，并与 AI Copilot 实时协同。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Jinni-Canvas 空间交互界面                          │
│                                                                             │
│  [提示词节点] ──> [ComfyUI / 云端多模态模型] ──> [图像/视频产出节点]         │
│         │                                              │                    │
│         └───> [LanceDB 向量知识库 RAG] ───> [AI Copilot 智能助手]           │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
    [Adobe Photoshop 连接器]                       [Chrome 资产极速采集器]
```

### ✨ 核心特性

- **🚀 高性能无限画布引擎**
  - 流畅的 60FPS 平移、缩放与多层级动态视口渲染；
  - 丰富的节点体系：文本卡片、Markdown 笔记、提示词预设、多图网格、时间轴视频生成节点；
  - 原生手势优化：针对触控板双指滑动、捏合缩放、鼠标滚轮平滑缩放进行了深层调优。

- **🤖 原生 AI 智能体与多模型生态**
  - 内置支持 **OpenAI (Codex / GPT-4o)**、**Google Gemini** 等全球前沿大模型；
  - 深度集成 **ComfyUI 本地工作流**（包括 Flux2-Klein、LTX-Director 电影级运镜、Z-Image 超分等常用工作流）；
  - 开箱即用的第三方云端模型 CLI 桥接（即梦 Dreamina、RunningHub、YZStudio 等）。

- **🧠 本地多模态向量知识库 (RAG)**
  - 基于高性能嵌入式向量数据库 **LanceDB**；
  - 支持一键导入本地文档、PDF 文献、设计参考图库，为画布创作提供情境召回支持。

- **🔌 设计软件与浏览器外设连接**
  - **Photoshop 专属插件**：实现画布资产与 Photoshop 图层的双向实时互通；
  - **Chrome 浏览器扩展**：网页灵感素材一键抓取并即时投递到无限画布。

- **🔒 本地优先与隐私安全**
  - 通过 FastAPI 和 WebSockets 在本地运行服务（100% 本地优先）；
  - 所有的 API 密钥、工作流草稿、项目数据完全由用户掌控在本地硬盘。

---

## 🚀 快速开始

### 系统要求

- **Python**: 推荐 `3.10` 或更高版本。
- **系统**: macOS 10.14+ / Windows 10+ / Linux。

---

### 方法一：macOS 双击运行（推荐）

1. 下载或克隆项目代码：
   ```bash
   git clone https://github.com/Davis1216/Jinni-Canvas.git
   cd Jinni-Canvas
   ```
2. 双击运行 `mac-启动服务.command`（若遇 macOS 安全提示，右键选择“打开”即可）。
3. 脚本将自动检测环境依赖，启动本地服务并在 3 秒内打开浏览器 `http://127.0.0.1:3000/`。

---

### 方法二：Windows 双击运行

1. 初次运行双击 `安装依赖.bat` 完成 Python 库安装。
2. 双击 `run.bat` 即可启动服务。

---

### 方法三：终端通用启动

```bash
# 1. 安装核心依赖
pip install -r requirements.txt

# 2. 启动本地服务
python3 main.py

# 3. 浏览器访问
# 打开: http://localhost:3000
```

---

## ⌨️ 常用快捷键与操作

| 操作动作 | macOS 快捷键 | Windows 快捷键 |
| :--- | :--- | :--- |
| **画布平移** | 空格 + 鼠标拖拽 / 双指滑动 | 空格 + 鼠标拖拽 / 滚轮按下拖拽 |
| **画布缩放** | 双指捏合 / 滚轮 / `Cmd + +` / `Cmd + -` | 滚轮滑动 / `Ctrl + +` / `Ctrl + -` |
| **重置视口 (100%)** | `Cmd + 0` | `Ctrl + 0` |
| **新建文本节点** | `T` | `T` |
| **呼出 AI 助手** | `Cmd + K` | `Ctrl + K` |
| **删除选中元素** | `Backspace` / `Delete` | `Delete` |
| **快速复制节点** | `Cmd + D` | `Ctrl + D` |

---

## 📄 开源许可证

本项目基于 MIT License 协议开源，详见 [`LICENSE`](LICENSE) 文件。
