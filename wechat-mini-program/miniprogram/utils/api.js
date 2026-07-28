function call(name, data = {}) {
  return wx.cloud.callFunction({ name, data }).then((response) => {
    const result = response.result || {};
    if (result.ok === false) {
      throw new Error(result.message || "服务暂时不可用");
    }
    return result;
  });
}

function showError(error, fallback = "操作失败，请稍后重试") {
  wx.showToast({
    title: error && error.message ? error.message : fallback,
    icon: "none",
    duration: 2500
  });
}

module.exports = { call, showError };
