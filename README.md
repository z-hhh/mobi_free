# MOBI-FREE 🚴

一个基于 Web Bluetooth API 的椭圆机控制台，支持多种蓝牙协议。无需安装 App，支持 PWA，这也是一个带有后台服务的完整 Web 应用示例。

## 功能特性

- **多协议支持**：支持 FTMS 标准协议及莫比 V1/V2、环通等私有协议
- **实时数据**：显示速度、踏频、功率、距离、卡路里、阻力等数据
- **阻力控制**：支持 10-24 档阻力调节（针对莫比机型优化）
- **PWA 支持**：可安装到桌面或手机主屏幕，支持离线加载
- **匿名统计**：集成了 Cloudflare Analytics Engine (仅在 Cloudflare 环境启用)

## 支持协议

应用会自动根据设备广播的服务 UUID 识别协议：

- **FTMS (Fitness Machine Service)**: 标准蓝牙健身设备协议
- **Mobi V2**: 莫比新款机型私有协议
- **Mobi V1**: 莫比旧款机型私有协议
- **HuanTong**: 环通仪表盘协议

## 使用说明

### 环境要求

需要支持 Web Bluetooth API 的浏览器：
- **Android/Windows/Mac**: Chrome, Edge
- **iOS/iPadOS**: 必须使用 [Bluefy](https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055) 浏览器 (Safari 不支持 Web Bluetooth)

### 操作步骤

1. 确保椭圆机已通电且未连接其他 App
2. 打开应用点击右上角蓝牙图标
3. 在弹出的设备列表中选择你的设备
4. 连接成功后即可看到实时数据并控制阻力

## 开发指南

### 本地运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 构建

```bash
# 构建生产版本
npm run build
```

## 部署

### Cloudflare Pages (推荐)

本项目专门针对 Cloudflare Pages 进行了优化，包含后端统计服务。

1. Fork 本仓库
2. 在 Cloudflare Dashboard 创建 Pages 项目并连接 Git 仓库
3. 构建配置会自动从 `wrangler.jsonc` 读取，无需额外配置
4. 部署完成后，应用会自动启用后端统计服务

### GitHub Pages / 其他静态托管

也可以部署为纯静态网站，虽然没有后端统计功能，但核心控制功能完全可用。

1. 配置构建命令为 `npm run build`
2. 配置发布目录为 `dist`

## 环境变量

- `VITE_ENABLE_ANALYTICS`: 用于本地强制启用统计 (可选，默认仅在 Cloudflare 构建环境启用)
- `WORKERS_CI`: Cloudflare 构建环境标识

## 技术栈

- **前端**: React, TypeScript, Vite, Tailwind CSS
- **蓝牙**: Web Bluetooth API
- **PWA**: vite-plugin-pwa
- **后端**: Cloudflare Pages Functions, Workers Analytics Engine

## 交流反馈

QQ 群：1073767295

## 许可证

MIT License
