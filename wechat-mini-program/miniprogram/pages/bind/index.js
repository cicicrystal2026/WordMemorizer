const { call, showError } = require("../../utils/api");

Page({
  data: {
    mode: "student",
    code: "",
    inputCode: "",
    expiresAt: ""
  },

  onLoad(options) {
    const mode = options.mode === "parent" ? "parent" : "student";
    this.setData({ mode });
    if (mode === "student") this.createCode();
  },

  async createCode() {
    try {
      const result = await call("progress", { action: "createBindCode" });
      this.setData({
        code: result.data.code,
        expiresAt: result.data.expiresAt
      });
    } catch (error) {
      showError(error);
    }
  },

  onInput(event) {
    this.setData({ inputCode: event.detail.value.replace(/\D/g, "").slice(0, 6) });
  },

  async bindChild() {
    if (this.data.inputCode.length !== 6) {
      wx.showToast({ title: "请输入 6 位绑定码", icon: "none" });
      return;
    }
    try {
      await call("progress", {
        action: "bindParent",
        code: this.data.inputCode
      });
      wx.showModal({
        title: "绑定成功",
        content: "现在可以查看孩子的每日学习进度。",
        showCancel: false,
        success: () => wx.redirectTo({ url: "/pages/parent/index" })
      });
    } catch (error) {
      showError(error);
    }
  }
});
