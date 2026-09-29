# 小米手环羽球计分 → Apple Watch 原生应用移植方案

> **状态:已搁置,未实施。** 本文档为 2026-09 规划存档,对应分支仅包含此方案,不含任何移植代码。
> 如未来重启移植,直接按本方案从「实施步骤」开始。

## 背景

当前项目是小米手环 10/10 Pro 的 Vela 快应用(纯前端,无蓝牙协议代码),核心功能:

- 上下半屏记分(上半屏=对方红色、下半屏=我方蓝色)
- 单击 +1(短震动)、双击 −1(200ms 判定窗口)、按下高亮
- 21 分制胜负判定:20:20 后净胜 2 分,29:29 后 30 分封顶
- 胜负弹层 + 10 秒倒计时自动清零 + 「继续查看」
- 常亮不息屏、3 秒闲置调暗、触摸恢复

Apple Watch 无法运行 Vela 快应用,唯一途径是用 Swift/SwiftUI 编写原生 watchOS 应用。

## 前置条件(需先完成)

1. **安装 Xcode**(当前 Mac 未装,仅命令行工具):从 Mac App Store 安装(需 Apple ID,下载约 10+GB),首次启动时按提示补装 watchOS 模拟器运行时。CLT 无法构建 watchOS 应用,这步无法绕过。
2. `brew install xcodegen` — 用声明式 `project.yml` 生成 .xcodeproj,避免手写 pbxproj。

## 交互与功能决策(已确认)

- 交互与手环完全一致:上半屏=对方、下半屏=我方;单击 +1(短震动)、双击 −1、按下高亮
- 常亮:**仅适配 AOD**(不接 HealthKit)。用 `isLuminanceReduced` 环境值渲染调暗的简化比分;亮屏时长依赖系统设置(建议:手表设置里把「返回表盘」设为 1 小时/永不)
- 部署:免费 Apple ID 侧载(7 天签名,见文末步骤)

## 新增目录(同仓库,不改动现有 src/)

```
applewatch/
├── ScoreKit/                          # 平台无关纯逻辑 Swift Package,Mac 上可直接 swift test
│   ├── Package.swift
│   ├── Sources/ScoreKit/
│   │   ├── TapScore.swift             # ← src/common/tapScore.js(200ms 单双击窗口,时钟可注入)
│   │   ├── BadmintonRules.swift       # ← src/common/badminton.js(21/净胜2/30封顶)
│   │   └── MatchState.swift           # ← score.ux 状态机(比分/胜负/10s倒计时/继续查看/清零)
│   └── Tests/ScoreKitTests/
│       ├── TapScoreTests.swift        # ← scripts/test-tapScore.mjs(注入 mock 时钟)
│       └── BadmintonRulesTests.swift  # ← scripts/test-badminton.mjs(12 组表驱动用例)
└── WatchApp/
    ├── project.yml                    # XcodeGen:watchOS App target(watchOS 10+,依赖本地 ScoreKit)
    ├── Sources/
    │   ├── ScoreboardWatchApp.swift   # @main 入口
    │   ├── ScoreView.swift            # ← score.ux 模板:红/蓝半屏、比分大字、胜负弹层
    │   ├── AODScoreView.swift         # isLuminanceReduced 时的调暗简化比分
    │   ├── ScoreZoneStyle.swift       # 自定义 ButtonStyle 实现按压高亮
    │   ├── ScoreViewModel.swift       # 桥接 ScoreKit;计时器驱动 10s 倒计时
    │   └── Haptics.swift              # WKInterfaceDevice.play(.click) 替代 @system.vibrator
    └── Assets.xcassets                # AppIcon(由 src/common/logo.png 改制)
```

## 功能映射

| 手环版 (Vela) | Apple Watch 版 (watchOS) |
|---|---|
| `onclick` + `createTapHandler` 200ms 窗口 | Button action → 同样的 TapScore 逻辑(SwiftUI 原生移植,行为一致) |
| `@system.vibrator` 短震(+1 时) | `WKInterfaceDevice.current().play(.click)` |
| touchstart/touchend 按压高亮 | 自定义 `ButtonStyle.isPressed` 深色态 |
| `@system.brightness` 常亮+3s 调暗+触摸恢复 | `isLuminanceReduced` AOD 调暗视图(系统级息屏/AOD 由设置保证) |
| 胜负弹层 + 10s 倒计时自动清零 + 继续查看 | MatchState 状态机 + SwiftUI overlay,1:1 移植 |

## 实施步骤

1. 安装 Xcode(约 10+GB 下载)+ `brew install xcodegen`
2. 创建 `ScoreKit` 包并移植三个逻辑模块,`swift test` 全绿(单双击窗口、0 分下限、12 组胜负用例、10s 倒计时)
3. 创建 `WatchApp`:写 `project.yml` → `xcodegen generate` → 移植 UI(半屏布局用 GeometryReader 平分屏高,红 `#e53935`/蓝 `#1e88e5`、圆角、按压变深色)→ 模拟器 `xcodebuild` 编译通过
4. 模拟器截图人工验收(交互、胜负弹层、AOD 态)
5. 写 `applewatch/README.md`:真机侧载步骤 + 与手环版的差异说明

## 真机侧载步骤(免费 Apple ID)

1. Xcode → Settings → Accounts 登录 Apple ID(免费即可)
2. iPhone 与 Apple Watch 已配对并连接
3. 选择真机 destination(经配对 iPhone)→ Signing & Capabilities 选 Personal Team,Bundle ID 改为唯一值(如 `com.<你的名字>.scoreboard.watch`)
4. Run 安装;**7 天后签名过期,需重新 Run 一次续签**
5. 手表若提示不受信任:设置 → 通用 → 开发者模式 打开并信任证书

## 与手环版的明确差异

- 不再由应用控制亮度/常亮(watchOS 无公开 API),由 AOD + 系统设置替代
- 需 iPhone + 配对的 Apple Watch 才能真机安装;模拟器仅可验证功能
