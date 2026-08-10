<#
.SYNOPSIS
    构建并部署到 Cloudflare Workers。

.DESCRIPTION
    顺序是：三道门 → 构建 → 把真实资源标识写进产物 → 部署。
    三道门放在最前面，是因为部署失败可以重来，部署上去的坏版本孩子会直接撞上。

    首次部署前必须先做完 docs/deployment-mightybug.md 的「一次性准备」，
    否则会因为 D1 不存在而失败。

.EXAMPLE
    .\scripts\deploy.ps1
    完整流程

.EXAMPLE
    .\scripts\deploy.ps1 -SkipGates
    跳过检查直接发（只在刚跑过检查、只改了配置时用）
#>
[CmdletBinding()]
param(
    [switch]$SkipGates,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = [Text.Encoding]::UTF8

function Write-Step ($Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Ok   ($Message) { Write-Host "    $Message" -ForegroundColor Green }

if (-not (Test-Path -LiteralPath 'deploy.json')) {
    throw "当前目录不是项目根目录（找不到 deploy.json）。先 cd 到仓库根目录。"
}

# ------------------------------------------------------------------ 三道门
if (-not $SkipGates) {
    Write-Step '检查：类型'
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw "typecheck 未通过，不部署。" }
    Write-Ok '通过'

    Write-Step '检查：测试'
    npm test
    if ($LASTEXITCODE -ne 0) { throw "测试未通过，不部署。" }
    Write-Ok '通过'

    Write-Step '检查：lint'
    npx eslint . --ignore-pattern dist --ignore-pattern .next
    if ($LASTEXITCODE -ne 0) { throw "lint 未通过，不部署。" }
    Write-Ok '通过'
}
else {
    Write-Step '已跳过三道门（-SkipGates）'
}

# -------------------------------------------------------------------- 构建
# npm test 里已经跑过一次 build，但那次是为了测试；这里重跑保证产物与当前源码一致。
Write-Step '构建'
npm run build
if ($LASTEXITCODE -ne 0) { throw "构建失败。" }
Write-Ok 'dist/ 已生成'

# ---------------------------------------------------- 写入真实资源标识
Write-Step '写入 D1 / R2 / 域名'
node scripts/patch-wrangler.mjs
if ($LASTEXITCODE -ne 0) { throw "配置写入失败，见上方提示。" }

if ($DryRun) {
    Write-Step '仅演练，未部署（-DryRun）'
    return
}

# -------------------------------------------------------------------- 部署
Write-Step '部署到 Cloudflare'
npx wrangler deploy -c dist/server/wrangler.json
if ($LASTEXITCODE -ne 0) { throw "部署失败。若提示未登录，先运行 npx wrangler login。" }

$domains = (Get-Content -Raw -LiteralPath 'deploy.json' | ConvertFrom-Json).customDomains
Write-Step '完成'
foreach ($d in $domains) { Write-Host "    https://$d" -ForegroundColor Green }
Write-Host "`n首次部署后别忘了：" -ForegroundColor Cyan
Write-Host "    npx wrangler d1 execute <库名> --remote --file=./drizzle/0000_loud_tana_nile.sql"
Write-Host "    npx wrangler secret put APP_PASSCODE"
