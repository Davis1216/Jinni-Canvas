<div align="center">

# 🎨 Jinni-Canvas

**The Open-Source Multimodal Infinite Canvas for Vision Creators & AI Developers**

*An infinite spatial workspace connecting AI Agents, ComfyUI, Vector Knowledge Bases, and Multimodal Workflows.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-brightgreen.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![VectorDB](https://img.shields.io/badge/Vector%20DB-LanceDB-orange.svg)](https://lancedb.com/)
[![ComfyUI Ready](https://img.shields.io/badge/Workflow-ComfyUI%20%7C%20Flux%20%7C%20LTX-purple.svg)](https://github.com/comfyanonymous/ComfyUI)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](#-quick-start)

[English](README.md) · [简体中文](README_zh.md) · [Mac 使用说明](MAC-使用说明.md) · [Report Bug](https://github.com/Davis1216/Jinni-Canvas/issues) · [Request Feature](https://github.com/Davis1216/Jinni-Canvas/issues)

</div>

---

## 🌟 Highlights

**Jinni-Canvas** is designed to eliminate the fragmentation between generative AI models, vector knowledge bases, and visual design tools. It provides a non-linear, limitless spatial canvas where creators and engineers can brainstorm, execute multi-step node workflows, and interact with AI Copilots in real time.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Jinni-Canvas Spatial UI                        │
│                                                                             │
│  [Prompt Nodes] ──> [ComfyUI / Cloud Model] ──> [Image / Video Output]      │
│         │                                              │                    │
│         └───> [LanceDB Knowledge RAG] ───> [AI Agent Copilot]               │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
    [Adobe Photoshop Connector]                  [Chrome Asset Importer]
```

### ✨ Key Features

- **🚀 High-Performance Infinite Canvas**
  - Ultra-smooth 60FPS pan, zoom, and multi-layer rendering.
  - Interactive nodes: text, markdown, prompts, image grids, and timeline-based video generation.
  - Native gesture support for trackpads, wheel zooming, and keyboard shortcuts.

- **🤖 Native AI Copilot & Multimodal Ecosystem**
  - Built-in support for **OpenAI (Codex / GPT-4o)**, **Google Gemini**, and domestic models.
  - Deep integration with **ComfyUI workflows** (Flux2-Klein, LTX-Director, Z-Image upscale).
  - Out-of-the-box CLI bridges for cloud platforms like **Dreamina (即梦)**, **RunningHub**, and **YZStudio**.

- **🧠 Local Multimodal Knowledge Base (RAG)**
  - Powered by **LanceDB** for lightweight, embedded vector search.
  - Direct ingestion of documents, PDFs, inspiration galleries, and contextual assets.

- **🔌 Studio Connectors & Extensions**
  - **Photoshop Connector**: Direct two-way sync between your Photoshop layers and the canvas.
  - **Chrome Asset Importer**: One-click clip inspiration and web images directly into your infinite space.

- **🔒 Local-First & Privacy Guaranteed**
  - Runs 100% locally on your machine via FastAPI and WebSockets.
  - All API keys, canvas states, and asset caches remain under your local control.

---

## 🖥️ Architecture Overview

```
Jinni-Canvas/
├── main.py                     # FastAPI core backend & WebSocket coordinator
├── jinni_storage.py            # Local persistence & cache management
├── knowledge_base/             # LanceDB vector database & document parsers
├── static/                     # Canvas frontend application (Vanilla JS / Canvas engine)
│   ├── index.html              # Main spatial canvas interface
│   ├── gpt-chat.html           # Interactive Agent Copilot interface
│   ├── js/canvas.js            # Core infinite canvas state & gesture engine
│   └── js/asset-manager.js     # Multimodal media asset manager
├── tools/                      # Ecosystem tools
│   ├── photoshop-asset-connector/  # Photoshop CEP/UXP extension
│   ├── chrome-local-asset-importer/ # Chrome WebExtension importer
│   └── mac_app/ & windows_app/     # Native standalone desktop packaging
└── workflows/                  # Production ComfyUI node workflows (Flux, LTX, etc.)
```

---

## 🚀 Quick Start

### Prerequisites

- **Python**: Version `3.10` or higher recommended.
- **Node.js** (Optional, for building desktop connectors).

---

### Option A: macOS One-Click Launch (Recommended)

1. Clone or download the repository:
   ```bash
   git clone https://github.com/Davis1216/Jinni-Canvas.git
   cd Jinni-Canvas
   ```
2. Double-click `mac-启动服务.command` (Right-click -> Open if prompted with macOS Gatekeeper warning).
3. The launcher will automatically verify dependencies, start the local server, and open your browser at `http://127.0.0.1:3000/`.

---

### Option B: Windows One-Click Launch

1. Double-click `安装依赖.bat` on initial setup.
2. Double-click `run.bat` to launch the application.

---

### Option C: Manual Terminal Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start the local server
python3 main.py

# 3. Access in browser
# Open: http://localhost:3000
```

---

## ⌨️ Shortcuts & Navigation

| Action | Shortcut (macOS) | Shortcut (Windows) |
| :--- | :--- | :--- |
| **Pan Canvas** | Space + Drag / Two-finger Drag | Space + Drag / Middle Click Drag |
| **Zoom In / Out** | Pinch / Wheel Scroll / `Cmd + +` / `Cmd + -` | Wheel Scroll / `Ctrl + +` / `Ctrl + -` |
| **Reset View (100%)** | `Cmd + 0` | `Ctrl + 0` |
| **New Text Node** | `T` | `T` |
| **AI Copilot Sidebar** | `Cmd + K` | `Ctrl + K` |
| **Delete Selected** | `Backspace` / `Delete` | `Delete` |
| **Duplicate Node** | `Cmd + D` | `Ctrl + D` |

---

## 🗺️ Roadmap

- [x] High-performance infinite 2D canvas with multi-touch gestures.
- [x] ComfyUI API bridge and custom workflow runner.
- [x] Embedded vector RAG with LanceDB.
- [x] Chrome asset importer & Adobe Photoshop connector.
- [ ] **OpenAI Native Agent Loop**: Dynamic workflow graph generation via OpenAI Function Calling.
- [ ] **Multiplayer Collaboration**: WebRTC-based real-time peer-to-peer canvas syncing.
- [ ] **End-to-End Canvas CI/CD**: Automated integration testing with Codex Security.

---

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

---

<div align="center">
  <sub>Built with ❤️ by Davis & the Jinni-Canvas Community.</sub>
</div>
