<#
.SYNOPSIS
    把 GitHub 上的 WordMemorizer 仓库同步到本地。

.DESCRIPTION
    本地仓库不存在就克隆，已存在就抓取并切到指定分支。
    只做快进合并，不会覆盖你本地未提交的改动——检测到脏工作区会直接停下来。

.EXAMPLE
    .\sync-from-github.ps1
    用默认参数同步到 D:\codex-project\beidancishenqi

.EXAMPLE
    .\sync-from-github.ps1 -Branch main
    改同步 main 分支
#>
[CmdletBinding()]
param(
    [string]$RepoPath  = 'D:\codex-project\beidancishenqi',
    [string]$RemoteUrl = 'https://github.com/cicicrystal2026/wordmemorizer.git',
    [string]$Branch    = 'claude/word-memorizer-product-design-b63tz4'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = [Text.Encoding]::UTF8

function Write-Step ($Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Ok   ($Message) { Write-Host "    $Message" -ForegroundColor Green }
function Write-Warn ($Message) { Write-Host "    $Message" -ForegroundColor Yellow }

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "找不到 git。请先安装 Git for Windows：https://git-scm.com/download/win"
}

# ---------------------------------------------------------------- 克隆或复用
if (-not (Test-Path -LiteralPath (Join-Path $RepoPath '.git'))) {
    if (Test-Path -LiteralPath $RepoPath) {
        $entries = Get-ChildItem -LiteralPath $RepoPath -Force
        if ($entries) {
            throw "$RepoPath 已存在且非空，但不是 git 仓库。请先手动清理或改用 -RepoPath 指定别处。"
        }
    }
    Write-Step "本地没有仓库，开始克隆到 $RepoPath"
    $parent = Split-Path -Parent $RepoPath
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    git clone $RemoteUrl $RepoPath
    if ($LASTEXITCODE -ne 0) { throw "克隆失败。" }
    Write-Ok "克隆完成"
}

Push-Location -LiteralPath $RepoPath
try {
    # ------------------------------------------------------------ 校验 remote
    Write-Step '检查远程地址'
    $currentUrl = (git remote get-url origin 2>$null)
    if ($LASTEXITCODE -ne 0) {
        git remote add origin $RemoteUrl
        Write-Ok "已添加 origin -> $RemoteUrl"
    }
    elseif ($currentUrl.TrimEnd('/') -ne $RemoteUrl.TrimEnd('/') -and
            $currentUrl.TrimEnd('/') -ne $RemoteUrl.TrimEnd('/').Replace('.git', '')) {
        Write-Warn "当前 origin 是 $currentUrl，与预期的 $RemoteUrl 不一致，保持原样不改动。"
    }
    else {
        Write-Ok $currentUrl
    }

    # ------------------------------------------------------- 保护未提交改动
    Write-Step '检查工作区状态'
    $dirty = git status --porcelain
    if ($dirty) {
        Write-Host $dirty
        throw "工作区有未提交的改动。请先 git commit 或 git stash，避免同步时丢失。"
    }
    Write-Ok '工作区干净'

    # ---------------------------------------------------------------- 抓取
    Write-Step '从 GitHub 抓取'
    git fetch origin --prune
    if ($LASTEXITCODE -ne 0) { throw "抓取失败，检查网络或仓库权限。" }
    Write-Ok '抓取完成'

    # ------------------------------------------------------------ 切换分支
    Write-Step "切换到分支 $Branch"
    $remoteRef = git ls-remote --heads origin $Branch
    if (-not $remoteRef) {
        Write-Warn "GitHub 上还没有分支 $Branch。"
        Write-Warn "如果你还没导入 bundle，请先运行 import-bundle.ps1，再从本地推上去。"
        $Branch = 'main'
        Write-Warn "本次改为同步 main。"
    }

    $localExists = git show-ref --verify --quiet "refs/heads/$Branch"; $localExists = ($LASTEXITCODE -eq 0)
    if ($localExists) {
        git checkout $Branch
        git merge --ff-only "origin/$Branch"
        if ($LASTEXITCODE -ne 0) {
            throw "无法快进合并。本地分支与远程有分叉，请手动处理：git log --oneline --graph --all"
        }
    }
    else {
        git checkout -b $Branch "origin/$Branch"
    }
    Write-Ok (git log --oneline -1)

    # ---------------------------------------------------------------- 汇总
    Write-Step '同步完成'
    Write-Host "    仓库路径 : $RepoPath"
    Write-Host "    当前分支 : $(git rev-parse --abbrev-ref HEAD)"
    Write-Host "    最新提交 : $(git log --oneline -1)"
    Write-Host "`n下一步，本地跑起来：" -ForegroundColor Cyan
    Write-Host "    cd `"$RepoPath`""
    Write-Host "    npm install"
    Write-Host "    npm run dev"
}
finally {
    Pop-Location
}
