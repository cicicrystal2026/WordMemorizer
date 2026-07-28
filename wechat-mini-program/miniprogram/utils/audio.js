let player = null;

function ensurePlayer() {
  if (!player) {
    player = wx.createInnerAudioContext();
    player.obeyMuteSwitch = false;
    player.volume = 1;
  }
  return player;
}

async function playWord(word, accent = "uk", rate = 0.8) {
  const response = await wx.cloud.callFunction({
    name: "tts",
    data: { text: word, accent, rate }
  });
  const result = response.result || {};
  if (!result.ok || !result.fileID) {
    throw new Error(result.message || "发音生成失败");
  }
  const download = await wx.cloud.downloadFile({ fileID: result.fileID });
  const audio = ensurePlayer();
  audio.stop();
  audio.src = download.tempFilePath;
  audio.play();
  return new Promise((resolve, reject) => {
    audio.onEnded(resolve);
    audio.onError((error) => reject(new Error(error.errMsg || "音频播放失败")));
  });
}

function stop() {
  if (player) player.stop();
}

module.exports = { playWord, stop };
