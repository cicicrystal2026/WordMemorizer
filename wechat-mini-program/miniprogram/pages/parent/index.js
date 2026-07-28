const { call, showError } = require("../../utils/api");

Page({
  data: {
    children: [],
    currentChild: null,
    summary: null,
    days: [],
    loading: true
  },

  onShow() {
    this.loadDashboard();
  },

  async loadDashboard(childOpenId) {
    try {
      const result = await call("progress", {
        action: "parentDashboard",
        childOpenId
      });
      this.setData({
        ...result.data,
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false });
      showError(error);
    }
  },

  changeChild(event) {
    const child = this.data.children[event.detail.value];
    if (child) this.loadDashboard(child.openid);
  },

  goBind() {
    wx.navigateTo({ url: "/pages/bind/index?mode=parent" });
  }
});
