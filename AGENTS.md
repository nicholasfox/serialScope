# SerialScope — 无线通信设备调试工具

## 项目概述
支持串口 + SSH + Telnet 数据源，实时解析设备日志并以示波器 roll-mode 显示波形图。目标平台 Windows 11。

## 技术栈
- **框架**: Tauri 2.x (Rust + WebView2)
- **前端**: React + ECharts
- **串口**: tokio-serial (Rust)
- **SSH**: russh (Rust)
- **Telnet**: tokio::net::TcpStream
- **解析**: JSON 声明式配置驱动通用解析引擎

## 部署形态
`tauri build` 产出 NSIS setup.exe 或 MSI 安装包，安装后即用，无需额外部署 web 服务。前端静态文件内嵌到 Rust 二进制中。

## 日志格式特征（解析器需处理）
- 每行一条完整数据
- 行首标志清晰（如 `TAG:`）
- 大部分字段 `name=value`，逗号分隔
- 数组分组：`groupname={v1,v2,v3}` 或 `(...)`
- 命名分组：`{name1,name2,name3}={v1,v2,v3}`（名称列表 zip 值列表）

## 实施路线

### Phase 1 — 串口 + 波形（当前阶段）
- [ ] 1.1 搭 Tauri + React 项目骨架，打通 IPC 通信
- [ ] 1.2 实现 SerialSource（Rust，tokio-serial），异步读取串口数据流
- [ ] 1.3 实现 JSON 配置驱动的通用解析引擎
- [ ] 1.4 前端 ECharts 波形组件（滚动 roll mode，可选字段绘制）
- [ ] 1.5 基本 UI：连接配置（端口/波特率）、字段选择器、波形显示区、日志原文面板
- [ ] 1.6 Win11 构建测试，出 setup.exe

### Phase 2 — SSH/Telnet 扩展
- [ ] 2.1 实现 SSHSource（russh），交互式 shell session
- [ ] 2.2 实现 TelnetSource（tokio TCP）
- [ ] 2.3 连接管理器 UI：保存多设备配置
- [ ] 2.4 网络模式数据接入解析 + 波形

### Phase 3 — 增强
- [ ] 3.1 录制回放、CSV 导出
- [ ] 3.2 游标测量、波形缩放、触发模式
- [ ] 3.3 多通道叠加显示
- [ ] 3.4 UI 主题/布局自定义

## 关键决策记录
- **前端**: React（2025-07-14）
- **波形库**: ECharts（交互丰富，开箱即用游标/缩放）
- **解析方式**: JSON 声明式配置，不引入 Lua 脚本
- **实施顺序**: 先串口+波形，再扩展网络
