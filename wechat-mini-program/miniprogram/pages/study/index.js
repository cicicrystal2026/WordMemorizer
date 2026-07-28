const { call, showError } = require("../../utils/api");
const { playWord, stop } = require("../../utils/audio");

Page({
  data: {
    words: [],
    index: 0,
    current: null,
    revealed: false,
    speaking: false,
    rate: 0.8,
    results: { known: 0, fuzzy: 0, new: 0 },
    startedAt: 0
  },

  async onLoad() {
    try {
      const result = await call("progress", { action: "todayWords" });
      const words = result.data.words || [];
      this.setData({
        words,
        current: words[0] || null,
        startedAt: Date.now()
      });
      if (words[0]) this.speak();
    } catch (error) {
      showError(error);
    }
  },

  onUnload() {
    stop();
  },

  async speak() {
    if (!this.data.current || this.data.speaking) return;
    this.setData({ speaking: true });
    try {
      await playWord(this.data.current.word, this.data.rate);
    } catch (error) {
      showError(error, "发音失败");
    } finally {
      this.setData({ speaking: false });
    }
  },


  mark(event) {
    const mark = event.currentTarget.dataset.mark;
    this.setData({
      revealed: true,
      results: {
        ...this.data.results,
        [mark]: this.data.results[mark] + 1
      }
    });
  },

  async next() {
    const nextIndex = this.data.index + 1;
    if (nextIndex < this.data.words.length) {
      this.setData({
        index: nextIndex,
        current: this.data.words[nextIndex],
        revealed: false
      });
      this.speak();
      return;
    }
    try {
      await call("progress", {
        action: "saveSession",
        count: this.data.words.length,
        results: this.data.results,
        durationSeconds: Math.round((Date.now() - this.data.startedAt) / 1000)
      });
      wx.showModal({
        title: "本组完成",
        content: `完成 ${this.data.words.length} 个词，错词会自动进入复习。`,
        showCancel: false,
        success: () => wx.navigateBack()
      });
    } catch (error) {
      showError(error);
    }
  }
});
