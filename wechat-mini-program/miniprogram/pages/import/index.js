const { call, showError } = require("../../utils/api");

Page({
  data: {
    step: "choose",
    imagePath: "",
    words: [],
    dailyTarget: 50,
    processing: false
  },

  async chooseImage() {
    try {
      const result = await wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        sizeType: ["compressed"]
      });
      const imagePath = result.tempFiles[0].tempFilePath;
      this.setData({ imagePath, processing: true, step: "processing" });
      const cloudPath = `word-images/${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;
      const upload = await wx.cloud.uploadFile({ cloudPath, filePath: imagePath });
      const ocr = await call("ocr", { fileID: upload.fileID });
      const enrich = await call("enrich", { lines: ocr.lines });
      this.setData({
        words: enrich.words || [],
        processing: false,
        step: "review"
      });
    } catch (error) {
      this.setData({ processing: false, step: "choose" });
      showError(error, "图片识别失败");
    }
  },

  editWord(event) {
    const index = event.currentTarget.dataset.index;
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    this.setData({ [`words[${index}].${field}`]: value });
  },

  removeWord(event) {
    const index = event.currentTarget.dataset.index;
    const words = this.data.words.filter((_, itemIndex) => itemIndex !== index);
    this.setData({ words });
  },

  setTarget(event) {
    this.setData({ dailyTarget: Number(event.detail.value) || 50 });
  },

  async confirm() {
    if (!this.data.words.length) return;
    try {
      await call("progress", {
        action: "saveWordList",
        words: this.data.words,
        dailyTarget: this.data.dailyTarget
      });
      wx.showToast({ title: "词表已导入", icon: "success" });
      setTimeout(() => wx.navigateBack(), 700);
    } catch (error) {
      showError(error);
    }
  }
});
