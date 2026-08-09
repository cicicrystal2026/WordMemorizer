<#
.SYNOPSIS
    以 DeepSeek 作为模型后端启动 Claude Code CLI。

.DESCRIPTION
    Claude Code 允许把模型后端换成任何「说 Anthropic Messages 协议」的服务，
    DeepSeek 提供了这样一个兼容端点。本脚本负责：

      1. 从环境变量取密钥（绝不落盘到仓库里）
      2. 起飞前先打一次真实请求，验证端点与模型 ID 确实可用
         —— 模型 ID 写错时，CLI 的报错会淹没在流式输出里很难看出来
      3. 只在当前进程注入环境变量，退出即失效，不污染系统环境

    首次使用先设置密钥（只需一次，之后重开窗口仍在）：

        setx DEEPSEEK_API_KEY "sk-你的密钥"

    然后**关掉这个窗口重开**（setx 不影响当前会话），再运行本脚本。

.EXAMPLE
    .\scripts\dev-deepseek.ps1
    验证后启动 claude

.EXAMPLE
    .\scripts\dev-deepseek.ps1 -Model deepseek-reasoner
    换用推理模型（更慢更贵，做复杂重构时才值得）

.EXAMPLE
    .\scripts\dev-deepseek.ps1 -CheckOnly
    只验证连通性，不启动 CLI
#>
[CmdletBinding()]
param(
    [string]$Model    = 'deepseek-chat',
    [string]$BaseUrl  = 'https://api.deepseek.com/anthropic',
    [string]$RepoPath = 'D:\codex-project\beidancishenqi',
    [switch]$CheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = [Text.Encoding]::UTF8

# PowerShell 5.1 的 Invoke-RestMethod 可能仍按 TLS 1.0 协商，对方只收 1.2+ 时
# 会报「基础连接已关闭」——错误信息完全看不出是协议问题。PowerShell 7 无此问题，
# 但这行加上无害。
[Net.ServicePointManager]::SecurityProtocol =
    [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

function Write-Step ($Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Ok   ($Message) { Write-Host "    $Message" -ForegroundColor Green }
function Write-Warn ($Message) { Write-Host "    $Message" -ForegroundColor Yellow }

# ---------------------------------------------------------------- 前置检查
Write-Step '检查依赖'

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    throw "找不到 claude 命令。先安装：npm install -g @anthropic-ai/claude-code"
}
Write-Ok "claude $(claude --version 2>$null)"

$key = $env:DEEPSEEK_API_KEY
if (-not $key) {
    throw @"
没有找到 DEEPSEEK_API_KEY。

  1. 到 https://platform.deepseek.com 创建 API Key
  2. 运行：setx DEEPSEEK_API_KEY "sk-你的密钥"
  3. 关闭并重开 PowerShell 窗口（setx 对当前窗口不生效）
  4. 重新运行本脚本
"@
}
Write-Ok "密钥已就绪（$($key.Substring(0, [Math]::Min(6, $key.Length)))…）"

# ------------------------------------------------------------ 端点连通性
# 起飞前打一次最小请求。模型 ID 过期或端点改版时，这里会立刻报出来，
# 而不是等 CLI 跑到一半才出现一串看不懂的流式错误。
Write-Step "验证端点 $BaseUrl（模型 $Model）"

$body = @{
    model      = $Model
    max_tokens = 16
    messages   = @(@{ role = 'user'; content = 'ping' })
} | ConvertTo-Json -Depth 5 -Compress

try {
    # 两个认证头都带上：CLI 用 ANTHROPIC_AUTH_TOKEN 时发的是 Authorization，
    # 而 Anthropic 协议原生用 x-api-key。只发一个，可能出现「预检通过但 CLI 连不上」。
    $resp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1/messages" -Body $body `
        -ContentType 'application/json' -TimeoutSec 30 -Headers @{
            'x-api-key'         = $key
            'Authorization'     = "Bearer $key"
            'anthropic-version' = '2023-06-01'
        }
    $first = $resp.content | Where-Object { $_.type -eq 'text' } | Select-Object -First 1
    $text  = if ($first) { $first.text } else { '(无文本内容，但请求成功)' }
    Write-Ok "端点可用，模型回了：$text"
}
catch {
    $detail = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $detail = $_.ErrorDetails.Message }
    throw @"
端点验证失败：$detail

常见原因：
  · 模型 ID 不对 —— 到 https://platform.deepseek.com 看当前可用的模型名，
    用 -Model 参数传进来。deepseek-chat 是指向最新通用模型的别名，
    通常不需要改；出新版本时也是这个别名自动跟进。
  · 密钥无效或余额为零
  · 端点路径变了 —— 用 -BaseUrl 传新地址
"@
}

if ($CheckOnly) {
    Write-Step '仅验证模式，未启动 CLI'
    return
}

# ------------------------------------------------------------ 注入并启动
Write-Step '注入环境变量（仅当前进程）'

$env:ANTHROPIC_BASE_URL   = $BaseUrl
$env:ANTHROPIC_AUTH_TOKEN = $key
$env:ANTHROPIC_MODEL      = $Model
# 后台的小任务（生成标题、总结）也走 DeepSeek，否则会去调 Anthropic 的
# 小模型——那需要另一份账号凭据，没有就会反复报错。
$env:ANTHROPIC_SMALL_FAST_MODEL = $Model
# 换后端时关掉非必要流量，减少无谓的失败重试。
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1'

Write-Ok "ANTHROPIC_BASE_URL = $BaseUrl"
Write-Ok "ANTHROPIC_MODEL    = $Model"

if (Test-Path -LiteralPath $RepoPath) {
    Set-Location -LiteralPath $RepoPath
    Write-Ok "工作目录 $RepoPath"
}
else {
    Write-Warn "$RepoPath 不存在，在当前目录启动。"
}

Write-Step '启动 Claude Code（模型后端：DeepSeek）'
Write-Host @"
    提示：把任务规格喂给它，不要口头描述需求。范例——

    读 AGENTS.md 和 docs/tasks/002-session-logic.md，完整实现这个任务。
    实现完依次跑 npm run typecheck、npm test、npm run lint，三个都过了再告诉我。

"@ -ForegroundColor DarkGray

claude
