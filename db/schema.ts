import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`CURRENT_TIMESTAMP`;

/**
 * 单用户产品，但所有业务表都带 user_id：第二步上小程序时微信登录天然带
 * openid，届时不必改表结构。第一步固定使用 DEFAULT_USER_ID。
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(now),
});

/** 一次导入 = 一本词书。 */
export const wordbooks = sqliteTable(
  "wordbooks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    /** image | pdf_text | pdf_scan | xlsx | csv */
    sourceType: text("source_type").notNull(),
    totalWords: integer("total_words").notNull().default(0),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("wordbooks_user_idx").on(t.userId)],
);

/**
 * 词条。`seq` 保留材料上的原始序号，是完整性校验的凭据——断号即漏识别、
 * 重号即重复、越界即邻页混入。Excel 等无序号的材料留空。
 */
export const words = sqliteTable(
  "words",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    wordbookId: integer("wordbook_id").notNull(),
    seq: integer("seq"),
    word: text("word").notNull(),
    /** 归一化词性数组的 JSON，如 ["v","n"] */
    pos: text("pos").notNull().default("[]"),
    meaning: text("meaning").notNull().default(""),
    /** 重点词：来自手写圈注识别或手动标记 */
    isKey: integer("is_key", { mode: "boolean" }).notNull().default(false),
    /** 低置信度或与底库分歧，进审核队列 */
    needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(false),
    confidence: real("confidence"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    index("words_book_idx").on(t.wordbookId),
    uniqueIndex("words_book_seq_uniq").on(t.wordbookId, t.seq),
  ],
);

/**
 * 与 words 分表：识别结果与 AI 生成内容的可信度和修订频率不同，
 * 分开便于重新生成补全内容而不动识别结果。
 */
export const wordDetails = sqliteTable(
  "word_details",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    wordId: integer("word_id").notNull(),
    /** 英式音标，与 TTS 的 en-GB 口音保持一致 */
    phonetic: text("phonetic"),
    phrase: text("phrase"),
    sentence: text("sentence"),
    translation: text("translation"),
    rootHint: text("root_hint"),
    /** 用户编辑过的内容，重新生成时不覆盖 */
    editedByUser: integer("edited_by_user", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [uniqueIndex("word_details_word_uniq").on(t.wordId)],
);

/**
 * 每个词的学习状态。mastery 是给用户看的四级抽象，
 * ease/interval/dueAt 是 SM-2 内部状态，不对用户暴露。
 */
export const studyStates = sqliteTable(
  "study_states",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    wordId: integer("word_id").notNull(),
    /** new | learning | familiar | mastered，对应生词/半熟/熟悉/永久掌握 */
    mastery: text("mastery").notNull().default("new"),
    ease: real("ease").notNull().default(2.5),
    interval: integer("interval").notNull().default(0),
    dueAt: text("due_at"),
    reviewCount: integer("review_count").notNull().default(0),
    lastStudiedAt: text("last_studied_at"),
  },
  (t) => [
    uniqueIndex("study_states_user_word_uniq").on(t.userId, t.wordId),
    index("study_states_due_idx").on(t.userId, t.dueAt),
  ],
);

/** 逐题作答记录，用于战报与算法调参。 */
export const studyLogs = sqliteTable(
  "study_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    wordId: integer("word_id").notNull(),
    /** recognize | shadow | meaning | spell | cloze */
    stage: text("stage").notNull(),
    correct: integer("correct", { mode: "boolean" }).notNull(),
    answeredAt: text("answered_at").notNull().default(now),
  },
  (t) => [index("study_logs_user_time_idx").on(t.userId, t.answeredAt)],
);

/**
 * 学习计划。用户输入的是 targetDate，dailyNew 由系统倒算：
 * dailyNew >= totalWords / (周期 - 最长复习间隔)。
 */
export const plans = sqliteTable(
  "plans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    wordbookId: integer("wordbook_id").notNull(),
    targetDate: text("target_date").notNull(),
    dailyNew: integer("daily_new").notNull(),
    /** active | completed | archived */
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("plans_user_status_idx").on(t.userId, t.status)],
);

/** 导入任务。识别在服务端异步进行，用户可以关闭页面。 */
export const importJobs = sqliteTable(
  "import_jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    wordbookId: integer("wordbook_id"),
    /** pending | processing | needs_review | done | failed */
    status: text("status").notNull().default("pending"),
    sourceType: text("source_type").notNull(),
    /** 原始文件的 R2 键，识别有误时可重跑而不必让用户重拍 */
    fileKeys: text("file_keys").notNull().default("[]"),
    totalUnits: integer("total_units").notNull().default(0),
    processedUnits: integer("processed_units").notNull().default(0),
    /** 完整性校验报告的 JSON */
    report: text("report"),
    error: text("error"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("import_jobs_user_idx").on(t.userId, t.status)],
);

/** 发音评测结果。只存结构化数据，不留原始音频。 */
export const pronScores = sqliteTable(
  "pron_scores",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    wordId: integer("word_id").notNull(),
    overall: real("overall").notNull(),
    accuracy: real("accuracy"),
    fluency: real("fluency"),
    /** 逐音素得分的 JSON，用于标出读错的音 */
    phonemes: text("phonemes"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("pron_scores_user_word_idx").on(t.userId, t.wordId)],
);
