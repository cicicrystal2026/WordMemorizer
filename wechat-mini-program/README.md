# 微信小程序版

这是“背单词开挂神器”的原生微信小程序第一版，包含学生端、家长端、拍照导入、AI 补全和云端发音接口。

## 已包含

- 学生今日任务、学习进度、高考听力风格标准英语发音
- 拍照或相册选择单词表，双重 OCR 比对，逐项人工确认后才能入库
- 腾讯云英文 OCR + 高精度 OCR 双重识别云函数
- 腾讯混元 AI 补充音标、词性、释义、搭配和例句
- 腾讯云 TTS 生成高考听力风格 MP3，并缓存到云存储
- 学生 6 位绑定码与家长绑定
- 家长查看今日完成量、正确率、错词、学习时长和近 7 天趋势

## 开始运行

1. 在微信公众平台注册小程序并取得 AppID。
2. 用微信开发者工具导入本目录。
3. 把 `project.config.json` 的 `appid` 改为真实 AppID。
4. 创建微信云开发环境，把 `miniprogram/app.js` 中的 `YOUR_CLOUD_ENV_ID` 改为环境 ID。
5. 在云开发控制台创建集合：
   - `users`
   - `word_lists`
   - `study_progress`
   - `bind_codes`
   - `bindings`
   所有集合都应设置为“客户端不可直接读写”，仅允许云函数访问。
6. 分别右键 `cloudfunctions` 下的四个函数，选择“上传并部署：云端安装依赖”。

## 云函数环境变量

在云开发控制台为 OCR/TTS/AI 函数配置：

```text
TENCENT_SECRET_ID=
TENCENT_SECRET_KEY=
TENCENT_REGION=ap-guangzhou
HUNYUAN_API_KEY=
HUNYUAN_BASE_URL=https://api.hunyuan.cloud.tencent.com/v1/chat/completions
HUNYUAN_MODEL=hunyuan-turbos-latest
TTS_GAOKAO_VOICE_TYPE=101050
```

密钥只能放在云函数环境变量中，不能写进小程序前端代码。

发音统一使用腾讯云英文精品音色，默认音色 ID 为 101050，语速设置为清晰、略慢的考试听力风格。它是对高考听力风格的模拟，不是考试院原始录音；正式真机测试后可在环境变量中更换腾讯云英文音色。

## 上线前必须补齐

- 小程序名称、头像、服务类目和隐私保护指引
- 相机/相册用途说明
- 腾讯云 OCR、TTS、混元服务开通
- 真机测试 iPhone 和 Android 的音频播放
- 家长绑定、解绑和删除学习数据入口
