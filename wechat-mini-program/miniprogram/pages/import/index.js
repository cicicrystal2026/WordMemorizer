const { call, showError } = require("../../utils/api");

function allVerified(words) {
  return words.length > 0 && words.every((item) => item.verified && item.word.trim());
}

Page({
  data: {
    step: "choose",
    imagePath: "",
    words: [],
    dailyTarget: 50,
    processing: false,
    audit: null,
    allVerified: false
  },

  async chooseImage() {
    try {
      const result = await wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        sizeType: ["original", "compressed"]
      });
      const imagePath = result.tempFiles[0].tempFilePath;
      this.setData({ imagePath, processing: true, step: "processing", words: [], allVerified: false });
      const cloudPath = `word-images/${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;
      const upload = await wx.cloud.uploadFile({ cloudPath, filePath: imagePath });
      const ocr = await call("ocr", { fileID: upload.fileID });
      const enrich = await call("enrich", { items: ocr.items });
      this.setData({
        words: enrich.words || [],
        audit: ocr.audit || null,
        processing: false,
        step: "review",
        allVerified: false
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
    this.setData({
      [`words[${index}].${field}`]: value,
      [`words[${index}].verified`]: false,
      allVerified: false
    });
  },

  toggleVerified(event) {
    const index = Number(event.currentTarget.dataset.index);
    const words = this.data.words.map((item, itemIndex) => itemIndex === index ? { ...item, verified: !item.verified } : item);
    this.setData({ words, allVerified: allVerified(words) });
  },

  removeWord(event) {
    const index = Number(event.currentTarget.dataset.index);
    const words = this.data.words.filter((_, itemIndex) => itemIndex !== index);
    this.setData({ words, allVerified: allVerified(words) });
  },

  addWord() {
    const words = [...this.data.words, {
      word: "",
      meaning: "",
      phonetic: "",
      partOfSpeech: "",
      phrase: "",
      sentence: "",
      translation: "",
      segments: [],
      confidence: 100,
      needsReview: true,
      verified: false
    }];
    this.setData({ words, allVerified: false });
  },

  setTarget(event) {
    this.setData({ dailyTarget: Number(event.detail.value) || 50 });
  },

  async confirm() {
    if (!this.data.allVerified) {
      wx.showToast({ title: "请逐项对照原图并标记已核对", icon: "none" });
      return;
    }
    try {
      const words = this.data.words.map(({ confidence, needsReview, verified, ...word }) => word);
      await call("progress", {
        action: "saveWordList",
        words,
        dailyTarget: this.data.dailyTarget
      });
      wx.showToast({ title: "词表已导入", icon: "success" });
      setTimeout(() => wx.navigateBack(), 700);
    } catch (error) {
      showError(error);
    }
  }
});