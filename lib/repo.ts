import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { getDb } from "../db";
import { studyStates, users, wordbooks, words } from "../db/schema";
import { DEFAULT_USER_ID, DEFAULT_USER_NAME } from "./constants";
import type { ParsedEntry } from "./parse/entry";
import { initialState, today } from "./scheduler";

export type Db = ReturnType<typeof getDb>;

/** 第一步只有一个使用者，首次写入前确保这行存在。 */
export async function ensureUser(db: Db): Promise<void> {
  await db
    .insert(users)
    .values({ id: DEFAULT_USER_ID, name: DEFAULT_USER_NAME })
    .onConflictDoNothing();
}

export async function createWordbook(
  db: Db,
  input: { name: string; sourceType: string; entries: ParsedEntry[] },
): Promise<{ wordbookId: number; inserted: number }> {
  await ensureUser(db);

  const [book] = await db
    .insert(wordbooks)
    .values({
      userId: DEFAULT_USER_ID,
      name: input.name,
      sourceType: input.sourceType,
      totalWords: input.entries.length,
    })
    .returning();

  if (input.entries.length === 0) return { wordbookId: book.id, inserted: 0 };

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

  // D1 对单条语句的变量数有限制，分批写入。
  const inserted: { id: number; isKey: boolean }[] = [];
  for (let i = 0; i < rows.length; i += 50) {
    const batch = await db
      .insert(words)
      .values(rows.slice(i, i + 50))
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
  for (let i = 0; i < states.length; i += 50) {
    await db.insert(studyStates).values(states.slice(i, i + 50));
  }

  return { wordbookId: book.id, inserted: inserted.length };
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

/**
 * 今日队列 = 到期复习 + 新词。复习排在前面：落后时按优先级截断，
 * 保证「每天的量可完成」优先于「保证计划不变」。
 */
export async function todayQueue(
  db: Db,
  opts: { wordbookId?: number; dailyNew: number; limit: number },
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

  const map = (r: (typeof rows)[number]): QueueItem => ({
    wordId: r.wordId,
    word: r.word,
    pos: safeParse(r.pos),
    meaning: r.meaning,
    isKey: r.isKey,
    needsReview: r.needsReview,
    mastery: r.mastery,
    isNew: r.reviewCount === 0,
  });

  const due = rows.filter((r) => r.reviewCount > 0).map(map);
  const fresh = rows
    .filter((r) => r.reviewCount === 0)
    // 重点词优先。
    .sort((a, b) => Number(b.isKey) - Number(a.isKey))
    .slice(0, opts.dailyNew)
    .map(map);

  return [...due, ...fresh].slice(0, opts.limit);
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
