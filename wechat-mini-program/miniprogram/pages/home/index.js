const { call, showError } = require("../../utils/api");

Page({
  data: {
    target: 50,
    finished: 0,
    accuracy: 0,
    wrongCount: 0,
    streak: 0,
    words: [],
    previewWords: [],
    percent: 0,
    loading: true
  },

  onShow() {
    this.loadHome();
  },

  async loadHome() {
    try {
      const profile = await call("progress", { action: "profile" });
      if (profile.data && profile.data.role === "parent") {
        wx.redirectTo({ url: "/pages/parent/index" });
        return;
      }
      const result = await call("progress", { action: "studentHome" });
      const data = result.data || {};
      this.setData({
        ...data,
        previewWords: (data.words || []).slice(0, 8),
        percent: data.target ? Math.round((data.finished || 0) / data.target * 100) : 0,
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },

  startStudy() {
    if (!this.data.words.length) {
      wx.navigateTo({ url: "/pages/import/index" });
      return;
    }
    wx.navigateTo({ url: "/pages/study/index" });
  },

  goImport() {
    wx.navigateTo({ url: "/pages/import/index" });
  },

  goBind() {
    wx.navigateTo({ url: "/pages/bind/index?mode=student" });
  },

  goParent() {
    wx.navigateTo({ url: "/pages/parent/index" });
  }
});