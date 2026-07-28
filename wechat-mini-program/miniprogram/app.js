App({
  globalData: {
    role: "student",
    user: null
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error("当前微信版本不支持云开发");
      return;
    }
    wx.cloud.init({
      env: "YOUR_CLOUD_ENV_ID",
      traceUser: true
    });
  }
});
