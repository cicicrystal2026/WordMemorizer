import { MASTERY, MAX_INTERVAL, REVIEW_INTERVALS, type Mastery } from "./constants";

/**
 * SM-2 变体。对单个孩子、几百词的规模，SM-2 足够且可解释；
 * FSRS 需要大量历史数据训练，在单用户场景发挥不出优势。
 *
 * ease/interval 是内部状态，对外只呈现 mastery 四级。
 */

export type SchedulerState = {
  mastery: Mastery;
  ease: number;
  interval: number;
  reviewCount: number;
};

const MIN_EASE = 1.3;
const MAX_EASE = 2.8;

/** 重点词（来自手写圈注）起步更难，复习更频繁。 */
export const KEY_WORD_EASE = 2.1;
export const DEFAULT_EASE = 2.5;

export function initialState(isKey: boolean): SchedulerState {
  return {
    mastery: "new",
    ease: isKey ? KEY_WORD_EASE : DEFAULT_EASE,
    interval: 0,
    reviewCount: 0,
  };
}

/**
 * 一轮作答后推进状态。`correct` 为整轮是否全对——错过任何一关都算未通过，
 * 因为「认得出但拼不对」同样不算掌握。
 */
export function review(state: SchedulerState, correct: boolean): SchedulerState {
  const reviewCount = state.reviewCount + 1;

  if (!correct) {
    // 答错回到最短间隔，但不清零 ease，避免一次失误抹掉全部历史。
    return {
      mastery: "new",
      ease: clamp(state.ease - 0.2, MIN_EASE, MAX_EASE),
      interval: REVIEW_INTERVALS[0],
      reviewCount,
    };
  }

  const ease = clamp(state.ease + 0.1, MIN_EASE, MAX_EASE);
  const interval = nextInterval(state.interval, ease);
  return { mastery: masteryFor(interval, reviewCount), ease, interval, reviewCount };
}

function nextInterval(current: number, ease: number): number {
  if (current <= 0) return REVIEW_INTERVALS[0];
  // 前几次沿用固定基线，之后按 ease 增长，上限为最长间隔的四倍。
  const idx = REVIEW_INTERVALS.indexOf(current);
  if (idx >= 0 && idx < REVIEW_INTERVALS.length - 1) return REVIEW_INTERVALS[idx + 1];
  return Math.min(Math.round(current * ease), MAX_INTERVAL * 4);
}

function masteryFor(interval: number, reviewCount: number): Mastery {
  if (interval >= MAX_INTERVAL * 2 && reviewCount >= REVIEW_INTERVALS.length) return "mastered";
  if (interval >= REVIEW_INTERVALS[2]) return "familiar";
  if (interval >= REVIEW_INTERVALS[0]) return "learning";
  return "new";
}

/** 手动改判：用户一票否决算法的结果，是间隔重复必需的逃生阀。 */
export function overrideMastery(state: SchedulerState, mastery: Mastery): SchedulerState {
  if (!MASTERY.includes(mastery)) return state;
  const interval =
    mastery === "mastered" ? MAX_INTERVAL * 4
    : mastery === "familiar" ? REVIEW_INTERVALS[2]
    : mastery === "learning" ? REVIEW_INTERVALS[0]
    : 0;
  return { ...state, mastery, interval };
}

export function addDays(from: Date, days: number): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/**
 * 计划倒算。用户输入「什么时候背完」，系统算出每天需要多少新词——
 * 而不是让用户填每日新词量，因为那个数字会误导：它只是新词，
 * 实际单日负荷还要加上累积的复习。
 *
 * 约束：最后一批新词需要走完整个复习周期，故必须在 deadline - 最长间隔 前学完。
 */
export function requiredDailyNew(totalWords: number, days: number): number {
  const learningDays = Math.max(days - MAX_INTERVAL, 1);
  return Math.ceil(totalWords / learningDays);
}

export type LoadPoint = { day: number; newWords: number; reviews: number };

/** 预测每日负荷，用于在界面上画出曲线、让孩子提前知道第几天开始变重。 */
export function forecastLoad(totalWords: number, dailyNew: number, horizon: number): LoadPoint[] {
  const newByDay = new Map<number, number>();
  let learned = 0;
  for (let day = 1; learned < totalWords; day += 1) {
    const n = Math.min(dailyNew, totalWords - learned);
    newByDay.set(day, n);
    learned += n;
  }

  const reviews = new Map<number, number>();
  for (const [day, n] of newByDay) {
    for (const gap of REVIEW_INTERVALS) {
      reviews.set(day + gap, (reviews.get(day + gap) ?? 0) + n);
    }
  }

  return Array.from({ length: horizon }, (_, i) => ({
    day: i + 1,
    newWords: newByDay.get(i + 1) ?? 0,
    reviews: reviews.get(i + 1) ?? 0,
  }));
}
