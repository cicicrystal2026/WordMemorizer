/** 第一步只有一个使用者；建表已带 user_id，第二步接微信登录时替换此常量。 */
export const DEFAULT_USER_ID = "kid";
export const DEFAULT_USER_NAME = "孩子";

export const SESSION_COOKIE = "wm_session";
/** 90 天，减少孩子重复输入口令的次数。 */
export const SESSION_MAX_AGE = 90 * 24 * 60 * 60;

/** 掌握度四级，对应生词 / 半熟 / 熟悉 / 永久掌握。 */
export const MASTERY = ["new", "learning", "familiar", "mastered"] as const;
export type Mastery = (typeof MASTERY)[number];

export const MASTERY_LABEL: Record<Mastery, string> = {
  new: "生词",
  learning: "半熟",
  familiar: "熟悉",
  mastered: "永久掌握",
};

/** 学习环节。shadow（跟读）在 M5 接入发音评测后启用。 */
export type Stage = "recognize" | "shadow" | "meaning" | "spell" | "cloze";

/**
 * 复习间隔基线（天）。最长间隔决定了计划的倒算下限：
 * 每日新词量 >= 总词数 / (周期 - 最长间隔)。
 */
export const REVIEW_INTERVALS = [1, 2, 4, 7, 15];
export const MAX_INTERVAL = REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1];

/** 一组的词数，与结算页的节奏对应。 */
export const GROUP_SIZE = 20;
