---
name: mymy-auth
description: 用本地安卓模拟器自动完成手机验证——B站短信验证码登录(验证码经 iPhone webhook 自动取回)与 B站 web 扫码登录(模拟器 App 扫网页二维码)。当需要登录 B站、web 端 B站登录态丢失要扫码恢复、或要自动获取手机短信验证码完成登录时使用。封装为确定性 CLI(模拟器内每步是固定脚本,非 AI 视觉)。
---

# mymy-auth

通过本地 CLI `mymy`(在项目里用 `pnpm cli ...`)控制安卓模拟器,自动完成手机验证。模拟器里的 B站 App 常驻登录,既是「验证码登录」目标,也是 web 端扫码登录的「凭证源」。

## 何时用

- **B站 App 首次登录**:用「手机号 + 短信验证码」,验证码从 iPhone 自动取回。
- **web 端 B站登录态丢失**(重置浏览器后):一条命令让模拟器 App 扫 web 二维码确认,恢复登录。

## 前置(用前确认)

1. 模拟器在线、B站 App 已装、`adb devices` 可见。
2. webhook 服务在跑:`pnpm webhook`(iPhone 快捷指令会把短信 POST 过来)。
3. 元素定位已实测校正(`src/flows/selectors.ts`)——未校正前 B站流程不保证成功。

## 命令清单

```
# B站
pnpm cli bili login --phone <手机号> [--dry-run] [--body-contains 哔哩哔哩]
pnpm cli bili scan-web --qr <二维码图片 URL|本地路径>
pnpm cli bili is-logged-in

# 设备/调试
pnpm cli device screenshot [--out x.png]
pnpm cli device dump-ui [--out dump.xml]      # 抓元素定位用
pnpm cli device window show|hide               # 显示/隐藏模拟器窗口

# 短信
pnpm cli sms latest [--body-contains 哔哩哔哩]

# 服务
pnpm cli webhook --port 7788
```

所有命令输出 JSON,失败退出码 1。多设备时加 `--serial <序列号>`。

## 典型流程

### 1. B站验证码登录
```
pnpm cli webhook          # 先起 webhook(独立终端,保持运行)
pnpm cli bili login --phone 138xxxxxxxx --body-contains 哔哩哔哩
```
内部:握手确认 webhook 通 → 启动 B站 → 输入手机号 → 点「获取验证码」→ iPhone 收码转发 → CLI 取码填入 → 登录。
`--dry-run` 跑到发码前停下,不发短信(用于先验证页面定位)。

### 2. web 扫码登录(恢复 web 登录态)
```
# 拿到 PC 浏览器 B站登录页的二维码图(截图或从 DOM 取 img URL)
pnpm cli bili scan-web --qr ./login-qr.png
# 或:pnpm cli bili scan-web --qr https://passport.bilibili.com/.../qrcode.png
```
内部:二维码图推进模拟器相册 → B站扫一扫「从相册选图」识别 → 点「确认登录 web 端」。

## 抓元素定位(实测校正)

B站改版或定位不准时,在对应页面跑:
```
pnpm cli device dump-ui --out dump.xml   # 看目标元素的 resource-id/text
```
然后回填 `src/flows/selectors.ts`。

## 注意

- **短信谨慎触发**:CLI 发码前会先握手确认 webhook 通,不通就不发(避免反复触发频率限制)。`--dry-run` 可先演练。
- **二维码有时效**(约 1~2 分钟),`scan-web` 步骤要快。
- 详细设计见 [docs/superpowers/specs/2026-07-15-mobile-auth-relay-design.md](docs/superpowers/specs/2026-07-15-mobile-auth-relay-design.md),iPhone 配置见 [docs/iphone-shortcuts.md](docs/iphone-shortcuts.md)。
