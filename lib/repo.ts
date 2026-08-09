import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { getDb } from "../db";
import { studyStates, users, wordbooks, words } from "../db/schema";
import { DEFAULT_USER_ID, DEFAULT_USER_NAME, REVIEW_INTERVALS } from "./constants";
import type { ParsedEntry } from "./parse/entry";
import { initialState, prioritizeReviews, today } from "./scheduler";

export type Db = ReturnType<typeof getDb>;

/** 第一步只有一个使用者，首次写入前确保这行存在。 */
export async function ensureUser(db: Db): Promise<void> {
  await db
    .insert(users)
    .values({ id: DEFAULT_USER_ID, name: DEFAULT_USER_NAME })
    .onConflictDoNothing();
}

/**
 * D1 对单条语句的绑定变量数有上限（超出报 "too many SQL variables"）。
 * 批大小必须按列数反算，不能拍一个固定行数——9 列时 50 行就是 450 个变量，
 * 直接超限。
 */
const D1_MAX_VARIABLES = 100;

function chunkSize(columns: number): number {
  return Math.max(1, Math.floor(D1_MAX_VARIABLES / columns));
}

export async function createWordbook(
  db: Db,
  input: { name: string; sourceType: string; entries: ParsedEntry[] },
): Promise<{ wordbookId: number; inserted: number }> {
  await ensureUser(db);

  // 先建空词书，词条全部写入成功后再回填真实词数——否则中途失败会留下
  // 一个声称有 N 词、实际为空的孤儿词书。
  const [book] = await db
    .insert(wordbooks)
    .values({
      userId: DEFAULT_USER_ID,
      name: input.name,
      sourceType: input.sourceType,
      totalWords: 0,
    })
    .returning();

  if (input.entries.length === 0) return { wordbookId: book.id, inserted: 0 };

  try {
    const rows = input.entries.map((e) => ({
      wordbookId: book.id,
      seq: e.seq,
      word: e.word,
      pos: JSON.stringify(e.pos),
      meaning: e.meaning,
      isKey: e.isKey,
      // 低置信度的条目排进审核队列前列。
      needsReview: e.confidence !== null && e.confidence < 0.8,
      confidence: e.confidence,
    }));

    const wordChunk = chunkSize(8);
    const inserted: { id: number; isKey: boolean }[] = [];
    for (let i = 0; i < rows.length; i += wordChunk) {
      const batch = await db
        .insert(words)
        .values(rows.slice(i, i + wordChunk))
        .returning({ id: words.id, isKey: words.isKey });
      inserted.push(...batch);
    }

    const states = inserted.map((w) => {
      const s = initialState(w.isKey);
      return {
        userId: DEFAULT_USER_ID,
        wordId: w.id,
        mastery: s.mastery,
        ease: s.ease,
        interval: s.interval,
        // 新词立刻可学。
        dueAt: today(),
        reviewCount: 0,
      };
    });
    const stateChunk = chunkSize(7);
    for (let i = 0; i < states.length; i += stateChunk) {
      await db.insert(studyStates).values(states.slice(i, i + stateChunk));
    }

    await db
      .update(wordbooks)
      .set({ totalWords: inserted.length })
      .where(eq(wordbooks.id, book.id));

    return { wordbookId: book.id, inserted: inserted.length };
  } catch (error) {
    // 清理半成品，避免残留空词书污染词书列表与计划倒算。
    await db.delete(words).where(eq(words.wordbookId, book.id)).catch(() => undefined);
    await db.delete(wordbooks).where(eq(wordbooks.id, book.id)).catch(() => undefined);
    throw error;
  }
}

export async function listWordbooks(db: Db) {
  return db
    .select()
    .from(wordbooks)
    .where(eq(wordbooks.userId, DEFAULT_USER_ID))
    .orderBy(sql`${wordbooks.createdAt} DESC`);
}

export type QueueItem = {
  wordId: number;
  word: string;
  pos: string[];
  meaning: string;
  isKey: boolean;
  needsReview: boolean;
  mastery: string;
  isNew: boolean;
};

/** `composeQueue` 需要的行形状，与下面 SQL 的 select 一一对应。 */
export type QueueRow = {
  wordId: number;
  word: string;
  pos: string;
  meaning: string;
  isKey: boolean;
  needsReview: boolean;
  mastery: string;
  reviewCount: number;
  interval: number;
  dueAt: string | null;
};

export type QueueOptions = {
  dailyNew: number;
  limit: number;
  /** 单日复习上限。默认 dailyNew × 复习档位数，即稳态下的自然复习量。 */
  capacity?: number;
};

/**
 * 队列组装（纯函数，与数据库无关，便于直接测试）。
 *
 * 复习排在新词前面，但**不能无上限**：落后几天后到期词会堆到几百个，
 * 若让复习吃满 limit，孩子就再也学不到新词、计划永远追不回来。
 * 因此复习先按紧急度截断到 capacity，剩下的名额才给新词。
 */
export function composeQueue(rows: QueueRow[], opts: QueueOptions, day: string): QueueItem[] {
  const map = (r: QueueRow): QueueItem => ({
    wordId: r.wordId,
    word: r.word,
    pos: safeParse(r.pos),
    meaning: r.meaning,
    isKey: r.isKey,
    needsReview: r.needsReview,
    mastery: r.mastery,
    isNew: r.reviewCount === 0,
  });

  // 上限只为「给新词留位置」而存在。dailyNew 为 0 时（计划背完、或当天不学新词）
  // 没有要保护的对象，复习可以用满 limit——否则会算出容量 0，一个复习都不给。
  const defaultCapacity = opts.dailyNew > 0 ? opts.dailyNew * REVIEW_INTERVALS.length : opts.limit;
  const reviewCapacity = Math.min(opts.capacity ?? defaultCapacity, opts.limit);

  const dueRows = new Map(rows.filter((r) => r.reviewCount > 0).map((r) => [r.wordId, r]));
  const order = prioritizeReviews(
    Array.from(dueRows.values(), (r) => ({
      wordId: r.wordId,
      // 学过但没有 dueAt 属于异常数据；SQL 已判定它到期，这里不能让它凭空消失。
      dueAt: r.dueAt ?? day,
      interval: r.interval,
      isKey: r.isKey,
    })),
    day,
    reviewCapacity,
  );
  const due = order.map((id) => map(dueRows.get(id)!));

  const freshSlots = Math.max(0, Math.min(opts.dailyNew, opts.limit - due.length));
  const fresh = rows
    .filter((r) => r.reviewCount === 0)
    // 重点词优先。
    .sort((a, b) => Number(b.isKey) - Number(a.isKey))
    .slice(0, freshSlots)
    .map(map);

  return [...due, ...fresh];
}

/**
 * 今日队列 = 到期复习 + 新词。复习排在前面：落后时按优先级截断，
 * 保证「每天的量可完成」优先于「保证计划不变」。
 */
export async function todayQueue(
  db: Db,
  opts: { wordbookId?: number } & QueueOptions,
): Promise<QueueItem[]> {
  const day = today();

  const base = db
    .select({
      wordId: words.id,
      word: words.word,
      pos: words.pos,
      meaning: words.meaning,
      isKey: words.isKey,
      needsReview: words.needsReview,
      mastery: studyStates.mastery,
      reviewCount: studyStates.reviewCount,
      interval: studyStates.interval,
      dueAt: studyStates.dueAt,
    })
    .from(words)
    .innerJoin(studyStates, eq(studyStates.wordId, words.id));

  const filters = [
    eq(studyStates.userId, DEFAULT_USER_ID),
    or(isNull(studyStates.dueAt), lte(studyStates.dueAt, day)),
  ];
  if (opts.wordbookId) filters.push(eq(words.wordbookId, opts.wordbookId));

  const rows = await base.where(and(...filters));

  return composeQueue(rows, opts, day);
}

export async function getStates(db: Db, wordIds: number[]) {
  if (wordIds.length === 0) return [];
  return db
    .select()
    .from(studyStates)
    .where(and(eq(studyStates.userId, DEFAULT_USER_ID), inArray(studyStates.wordId, wordIds)));
}

function safeParse(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
