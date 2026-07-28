# 微信小程序版

这是“背单词开挂神器”的原生微信小程序第一版，包含学生端、家长端、拍照导入、AI 补全和云端发音接口。

## 已包含

- 学生今日任务、学习进度、英式/美式发音切换
- 拍照或相册选择单词表
- 腾讯云英文 OCR 云函数
- 腾讯混元 AI 补充音标、词性、释义、搭配和例句
- 腾讯云 TTS 生成 MP3，并缓存到云存储
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
TTS_UK_VOICE_TYPE=
TTS_US_VOICE_TYPE=
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
AZURE_TTS_UK_VOICE=en-GB-SoniaNeural
AZURE_TTS_US_VOICE=en-US-JennyNeural
```

密钥只能放在云函数环境变量中，不能写进小程序前端代码。

如配置了 Azure Speech，发音函数会优先使用明确区分英式和美式的神经网络音色；未配置时回退到腾讯云英文音色。腾讯云当前公开音色表只标注“英文”，不保证英式/美式口音，因此正式上线要实现严格英式发音，建议配置 Azure Speech。

## 上线前必须补齐

- 小程序名称、头像、服务类目和隐私保护指引
- 相机/相册用途说明
- 腾讯云 OCR、TTS、混元服务开通
- 真机测试 iPhone 和 Android 的音频播放
- 家长绑定、解绑和删除学习数据入口
