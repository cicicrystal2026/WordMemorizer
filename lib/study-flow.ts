import type { Mastery, Stage } from "./constants";

export type StageResult = Record<Stage, { correct: number; total: number }>;

/** 未接入的关卡保留为零值，结算页可据此明确说明尚不可用。 */
export function emptyStageResults(): StageResult {
  return {
    recognize: { correct: 0, total: 0 },
    shadow: { correct: 0, total: 0 },
    meaning: { correct: 0, total: 0 },
    spell: { correct: 0, total: 0 },
    cloze: { correct: 0, total: 0 },
  };
}

/**
 * 题型随掌握度收缩，避免熟悉词仍机械地重复新词的全部流程。
 * 语境填空依赖 M4 例句，接入前熟悉词稳定地走拼写关。
 */
export function stagesForMastery(mastery: Mastery): Stage[] {
  // 首学先听英式发音并开口跟读，之后才进入认义和拼写。
  if (mastery === "new") return ["recognize", "shadow", "meaning", "spell"];
  if (mastery === "learning") return ["meaning", "spell"];
  if (mastery === "familiar") return ["spell"];
  return [];
}

export function recordStageResult(
  results: StageResult,
  stage: Stage,
  correct: boolean,
): StageResult {
  const current = results[stage];
  return {
    ...results,
    [stage]: {
      correct: current.correct + Number(correct),
      total: current.total + 1,
    },
  };
}

/** 错词每组只追加一次，防止连续答错把一组学习拖成无限循环。 */
export function shouldAppendRetry(hadMistake: boolean, alreadyRetried: boolean): boolean {
  return hadMistake && !alreadyRetried;
}
