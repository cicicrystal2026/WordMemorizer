"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { ImportedWord, parseWordFile, parseWordText } from "./file-import";

type Word = { word: string; phonetic: string; meaning: string; phrase: string; sentence: string; translation: string };
type ScreenMark = "known" | "fuzzy" | "new";
type Stage = "home" | "screen" | "meaning" | "spell" | "context" | "summary";

const WORDS: Word[] = [
  { word: "abandon", phonetic: "/əˈbændən/", meaning: "放弃；抛弃", phrase: "abandon a plan", sentence: "They had to abandon the plan because of the heavy rain.", translation: "由于大雨，他们不得不放弃计划。" },
  { word: "accurate", phonetic: "/ˈækjərət/", meaning: "准确的", phrase: "accurate information", sentence: "The report provides accurate information about the accident.", translation: "这份报告提供了关于事故的准确信息。" },
  { word: "benefit", phonetic: "/ˈbenɪfɪt/", meaning: "益处；使受益", phrase: "benefit from", sentence: "Students can benefit from reading English aloud every day.", translation: "学生可以从每天大声朗读英语中受益。" },
  { word: "challenge", phonetic: "/ˈtʃælɪndʒ/", meaning: "挑战", phrase: "face a challenge", sentence: "Learning to manage time is a challenge for many teenagers.", translation: "学会管理时间对许多青少年来说是一项挑战。" },
  { word: "concentrate", phonetic: "/ˈkɒnsntreɪt/", meaning: "集中注意力", phrase: "concentrate on", sentence: "Please concentrate on the question before choosing an answer.", translation: "选择答案前请专注于题目。" },
  { word: "consequence", phonetic: "/ˈkɒnsɪkwəns/", meaning: "结果；后果", phrase: "as a consequence", sentence: "He missed the bus and, as a consequence, was late for class.", translation: "他没赶上公交车，结果上课迟到了。" },
  { word: "contribute", phonetic: "/kənˈtrɪbjuːt/", meaning: "贡献；促成", phrase: "contribute to", sentence: "Regular exercise contributes to better sleep.", translation: "规律运动有助于改善睡眠。" },
  { word: "determine", phonetic: "/dɪˈtɜːmɪn/", meaning: "决定；确定", phrase: "determine to do", sentence: "Your daily choices determine what you will become.", translation: "你每天的选择决定你将成为什么样的人。" },
  { word: "efficient", phonetic: "/ɪˈfɪʃnt/", meaning: "高效的", phrase: "an efficient way", sentence: "Grouping words is an efficient way to build vocabulary.", translation: "将单词分组是积累词汇的一种高效方法。" },
  { word: "essential", phonetic: "/ɪˈsenʃl/", meaning: "必不可少的", phrase: "be essential to", sentence: "A large vocabulary is essential to reading comprehension.", translation: "大量词汇对于阅读理解至关重要。" },
  { word: "eventually", phonetic: "/ɪˈventʃuəli/", meaning: "最终；终于", phrase: "eventually succeed", sentence: "After several attempts, she eventually solved the problem.", translation: "尝试几次后，她终于解决了问题。" },
  { word: "familiar", phonetic: "/fəˈmɪliə(r)/", meaning: "熟悉的", phrase: "be familiar with", sentence: "You should be familiar with these common exam expressions.", translation: "你应该熟悉这些常见的考试表达。" },
  { word: "frequent", phonetic: "/ˈfriːkwənt/", meaning: "频繁的；常见的", phrase: "frequent mistakes", sentence: "Frequent review helps move words into long-term memory.", translation: "经常复习有助于把单词转入长期记忆。" },
  { word: "improve", phonetic: "/ɪmˈpruːv/", meaning: "提高；改善", phrase: "improve your English", sentence: "She listens to English podcasts to improve her pronunciation.", translation: "她通过听英语播客来改善发音。" },
  { word: "influence", phonetic: "/ˈɪnfluəns/", meaning: "影响", phrase: "have an influence on", sentence: "Parents have a strong influence on their children's habits.", translation: "父母对孩子的习惯有很大影响。" },
  { word: "maintain", phonetic: "/meɪnˈteɪn/", meaning: "保持；维持", phrase: "maintain a balance", sentence: "It is important to maintain a balance between study and rest.", translation: "在学习和休息之间保持平衡很重要。" },
  { word: "opportunity", phonetic: "/ˌɒpəˈtjuːnəti/", meaning: "机会", phrase: "have an opportunity to", sentence: "The competition gives students an opportunity to show their talent.", translation: "这项比赛给学生提供了展示才华的机会。" },
  { word: "persuade", phonetic: "/pəˈsweɪd/", meaning: "说服", phrase: "persuade sb. to do", sentence: "She persuaded her brother to join the school team.", translation: "她说服弟弟加入校队。" },
  { word: "prefer", phonetic: "/prɪˈfɜː(r)/", meaning: "更喜欢", phrase: "prefer A to B", sentence: "Many students prefer learning through short daily tasks.", translation: "许多学生更喜欢通过每天的短任务学习。" },
  { word: "prevent", phonetic: "/prɪˈvent/", meaning: "阻止；预防", phrase: "prevent sb. from doing", sentence: "Nothing should prevent you from trying again.", translation: "没有什么应该阻止你再次尝试。" },
  { word: "recommend", phonetic: "/ˌrekəˈmend/", meaning: "推荐；建议", phrase: "recommend doing", sentence: "Teachers recommend reviewing new words before sleep.", translation: "老师建议睡前复习新单词。" },
  { word: "reduce", phonetic: "/rɪˈdjuːs/", meaning: "减少；降低", phrase: "reduce stress", sentence: "A clear plan can reduce stress before an exam.", translation: "清晰的计划可以减轻考前压力。" },
  { word: "significant", phonetic: "/sɪɡˈnɪfɪkənt/", meaning: "重要的；显著的", phrase: "a significant change", sentence: "Small daily efforts can make a significant difference.", translation: "每天小小的努力可以带来显著的改变。" },
  { word: "sufficient", phonetic: "/səˈfɪʃnt/", meaning: "足够的；充分的", phrase: "sufficient time", sentence: "Make sure you have sufficient time to check your answers.", translation: "确保你有足够的时间检查答案。" },
  { word: "tendency", phonetic: "/ˈtendənsi/", meaning: "趋势；倾向", phrase: "have a tendency to", sentence: "People have a tendency to forget what they do not review.", translation: "人们往往会忘记没有复习的内容。" },
  { word: "variety", phonetic: "/vəˈraɪəti/", meaning: "多样；种类", phrase: "a variety of", sentence: "The library offers a variety of books for teenagers.", translation: "图书馆为青少年提供各种各样的书。" },
  { word: "volunteer", phonetic: "/ˌvɒlənˈtɪə(r)/", meaning: "志愿者；自愿", phrase: "volunteer to do", sentence: "Several students volunteered to help at the sports meeting.", translation: "几名学生自愿在运动会上帮忙。" },
  { word: "worthwhile", phonetic: "/ˌwɜːθˈwaɪl/", meaning: "值得的", phrase: "be worthwhile", sentence: "Keeping a vocabulary notebook is a worthwhile habit.", translation: "坚持记词汇笔记是一个值得养成的习惯。" },
];

const GROUP_SIZE = 20;
const IMPORT_EXAMPLE = `abandon,放弃；抛弃
accurate,准确的
benefit,益处；使受益`;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("home");
  const [target, setTarget] = useState(80);
  const [wordBank, setWordBank] = useState<Word[]>(WORDS);
  const [index, setIndex] = useState(0);
  const [queue, setQueue] = useState<Word[]>(WORDS.slice(0, GROUP_SIZE));
  const [marks, setMarks] = useState<Record<string, ScreenMark>>({});
  const [wrong, setWrong] = useState<string[]>([]);
  const [meaningScore, setMeaningScore] = useState(0);
  const [spellScore, setSpellScore] = useState(0);
  const [contextScore, setContextScore] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"right" | "wrong" | null>(null);
  const [finishedToday, setFinishedToday] = useState(0);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [showTarget, setShowTarget] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState(IMPORT_EXAMPLE);
  const [dailyInput, setDailyInput] = useState("80");
  const [importedWords, setImportedWords] = useState<ImportedWord[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [importPercent, setImportPercent] = useState(0);
  const [importError, setImportError] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("gaokao-word-progress");
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      const timer = window.setTimeout(() => {
        const savedTarget = data.target ?? 80;
        setTarget(savedTarget);
        setDailyInput(String(savedTarget));
        setFinishedToday(data.date === todayKey() ? (data.finishedToday ?? 0) : 0);
        setCompletedTotal(data.completedTotal ?? 0);
        if (Array.isArray(data.wordBank) && data.wordBank.length) setWordBank(data.wordBank);
      }, 0);
      return () => window.clearTimeout(timer);
    } catch {}
  }, []);

  useEffect(() => {
    window.localStorage.setItem("gaokao-word-progress", JSON.stringify({ target, finishedToday, completedTotal, wordBank, date: todayKey() }));
  }, [target, finishedToday, completedTotal, wordBank]);

  const current = queue[index] ?? queue[0];
  const isCustomWordBank = wordBank.length !== WORDS.length || wordBank.some((item, itemIndex) => item.word !== WORDS[itemIndex]?.word);
  const options = useMemo(() => {
    if (!current) return [];
    const others = shuffle(wordBank.filter((item) => item.word !== current.word)).slice(0, 3);
    return shuffle([current, ...others]);
  }, [current, wordBank]);

  function begin() {
    if (!wordBank.length || finishedToday >= target) return;
    const groupCount = Math.min(GROUP_SIZE, target - finishedToday, wordBank.length);
    const start = completedTotal % wordBank.length;
    const ordered = [...wordBank.slice(start), ...wordBank.slice(0, start)];
    setQueue(ordered.slice(0, groupCount));
    setMarks({});
    setWrong([]);
    setMeaningScore(0);
    setSpellScore(0);
    setContextScore(0);
    setIndex(0);
    setAnswer("");
    setFeedback(null);
    setStage("screen");
  }

  function saveDailyTarget(value: string) {
    const next = Math.max(1, Math.min(300, Number.parseInt(value, 10) || 1));
    setTarget(next);
    setDailyInput(String(next));
    setFinishedToday((finished) => Math.min(finished, next));
    setShowTarget(false);
  }

  function parsePastedWords() {
    const parsed = parseWordText(importText);
    setImportFileName("粘贴的单词表");
    setImportedWords(parsed);
    setImportError(parsed.length ? "" : "没有识别到有效单词，请按“英文,中文意思”每行一个填写。");
    setImportStatus(parsed.length ? `已识别 ${parsed.length} 个单词，请检查后确认` : "");
    setImportPercent(parsed.length ? 100 : 0);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsParsing(true);
    setImportError("");
    setImportedWords([]);
    setImportFileName(file.name);
    try {
      const parsed = await parseWordFile(file, ({ label, percent }) => {
        setImportStatus(label);
        setImportPercent(percent);
      });
      setImportedWords(parsed);
      setImportPercent(100);
      setImportStatus(`已识别 ${parsed.length} 个单词，请检查后确认`);
      if (!parsed.length) setImportError("没有识别到有效单词。请换一张更清晰的图片，或检查文档第一列是否为英文单词。");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "文件解析失败，请换一种格式重试。");
      setImportStatus("");
      setImportPercent(0);
    } finally {
      setIsParsing(false);
    }
  }

  function updateImportedWord(indexToUpdate: number, field: "word" | "meaning", value: string) {
    setImportedWords((items) => items.map((item, itemIndex) => itemIndex === indexToUpdate ? { ...item, [field]: value } : item));
  }

  function confirmImport() {
    const cleaned = importedWords
      .map((item) => ({ ...item, word: item.word.trim().toLowerCase(), meaning: item.meaning.trim() || "待补充释义" }))
      .filter((item, itemIndex, items) => /^[a-z][a-z'-]{1,30}$/i.test(item.word) && items.findIndex((candidate) => candidate.word === item.word) === itemIndex);
    if (!cleaned.length) {
      setImportError("确认前请至少保留一个有效英文单词。");
      return;
    }
    setWordBank(cleaned);
    setCompletedTotal(0);
    setFinishedToday(0);
    if (target > cleaned.length) {
      setTarget(cleaned.length);
      setDailyInput(String(cleaned.length));
    }
    setShowImport(false);
  }

  function restoreBuiltInWords() {
    setWordBank(WORDS);
    setCompletedTotal(0);
    setFinishedToday(0);
    setImportedWords([]);
    setImportFileName("");
    setImportStatus("已恢复内置高考示例词表");
  }

  function markWord(mark: ScreenMark) {
    setMarks((prev) => ({ ...prev, [current.word]: mark }));
    if (index < queue.length - 1) setIndex(index + 1);
    else {
      const nextMarks = { ...marks, [current.word]: mark };
      const next = queue.filter((item) => nextMarks[item.word] !== "known");
      setQueue(next.length ? next : queue.slice(0, 6));
      setIndex(0);
      setStage("meaning");
    }
  }

  function nextStage(next: Stage, nextQueue = queue) {
    setQueue(nextQueue);
    setIndex(0);
    setAnswer("");
    setFeedback(null);
    setStage(next);
  }

  function chooseMeaning(choice: Word) {
    if (feedback) return;
    const isRight = choice.word === current.word;
    setFeedback(isRight ? "right" : "wrong");
    if (isRight) setMeaningScore((score) => score + 1);
    else setWrong((items) => Array.from(new Set([...items, current.word])));
  }

  function continueMeaning() {
    if (index < queue.length - 1) {
      setIndex(index + 1);
      setFeedback(null);
    } else {
      const spellWords = queue.filter((item) => wrong.includes(item.word)).concat(queue.filter((item) => !wrong.includes(item.word)).slice(0, 8));
      nextStage("spell", Array.from(new Map(spellWords.map((item) => [item.word, item])).values()));
    }
  }

  function submitSpelling(event: FormEvent) {
    event.preventDefault();
    if (feedback || !answer.trim()) return;
    const isRight = answer.trim().toLowerCase() === current.word.toLowerCase();
    setFeedback(isRight ? "right" : "wrong");
    if (isRight) setSpellScore((score) => score + 1);
    else setWrong((items) => Array.from(new Set([...items, current.word])));
  }

  function continueSpelling() {
    if (index < queue.length - 1) {
      setIndex(index + 1);
      setAnswer("");
      setFeedback(null);
    } else nextStage("context", queue.slice(0, Math.min(6, queue.length)));
  }

  function chooseContext(choice: Word) {
    if (feedback) return;
    const isRight = choice.word === current.word;
    setFeedback(isRight ? "right" : "wrong");
    if (isRight) setContextScore((score) => score + 1);
    else setWrong((items) => Array.from(new Set([...items, current.word])));
  }

  function continueContext() {
    if (index < queue.length - 1) {
      setIndex(index + 1);
      setFeedback(null);
    } else {
      setFinishedToday((value) => Math.min(target, value + queue.length));
      setCompletedTotal((value) => Math.min(wordBank.length, value + queue.length));
      setStage("summary");
    }
  }

  const goHome = () => { setStage("home"); setIndex(0); setFeedback(null); };

  if (stage !== "home") {
    const total = queue.length;
    const progress = stage === "summary" ? 100 : ((index + 1) / Math.max(total, 1)) * 100;
    return (
      <main className="study-shell">
        <header className="study-header">
          <button className="icon-button" onClick={goHome} aria-label="返回首页">‹</button>
          <div className="study-heading">
            <span>{stage === "screen" ? "快速筛词" : stage === "meaning" ? "认义检测" : stage === "spell" ? "重点拼写" : stage === "context" ? "真题语境" : "本组完成"}</span>
            {stage !== "summary" && <small>{index + 1} / {total}</small>}
          </div>
          <button className="icon-button sound-top" onClick={() => current && speak(current.word)} aria-label="播放发音">♪</button>
        </header>
        <div className="thin-progress"><span style={{ width: `${progress}%` }} /></div>

        {stage === "screen" && current && (
          <section className="study-panel screening">
            <div className="stage-kicker">第一关 · 3秒判断</div>
            <p className="stage-tip">看到单词，能立刻想到中文意思吗？</p>
            <button className="speaker-orb" onClick={() => speak(current.word)} aria-label={`朗读 ${current.word}`}>♪</button>
            <h1 className="hero-word">{current.word}</h1>
            <p className="phonetic">{current.phonetic}</p>
            <div className="screen-actions">
              <button className="mark-button known" onClick={() => markWord("known")}><b>认识</b><span>立刻知道意思</span></button>
              <button className="mark-button fuzzy" onClick={() => markWord("fuzzy")}><b>模糊</b><span>好像见过</span></button>
              <button className="mark-button new" onClick={() => markWord("new")}><b>不认识</b><span>重点学习</span></button>
            </div>
            <p className="honest-tip">别凭眼熟点“认识”，稍后会随机抽查</p>
          </section>
        )}

        {stage === "meaning" && current && (
          <section className="study-panel">
            <div className="stage-kicker">第二关 · 认出意思</div>
            <button className="speaker-orb small" onClick={() => speak(current.word)} aria-label={`朗读 ${current.word}`}>♪</button>
            <h1 className="quiz-word">{current.word}</h1>
            <p className="phonetic">{current.phonetic}</p>
            <div className="option-list">
              {options.map((option) => <button key={option.word} className={`answer-option ${feedback && option.word === current.word ? "correct" : ""}`} onClick={() => chooseMeaning(option)}>{option.meaning}</button>)}
            </div>
            {feedback && <div className={`feedback ${feedback}`}><b>{feedback === "right" ? "答对了，反应很快！" : `正确答案：${current.meaning}`}</b><span>{current.phrase}</span><button onClick={continueMeaning}>继续</button></div>}
          </section>
        )}

        {stage === "spell" && current && (
          <section className="study-panel">
            <div className="stage-kicker">第三关 · 写得出来</div>
            <p className="meaning-prompt">{current.meaning}</p>
            <button className="listen-pill" onClick={() => speak(current.word)}>♪ 听发音</button>
            <form className="spell-form" onSubmit={submitSpelling}>
              <input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="输入英文单词" autoCapitalize="none" autoCorrect="off" aria-label="输入英文单词" />
              {!feedback && <button type="submit">检查拼写</button>}
            </form>
            {feedback && <div className={`feedback ${feedback}`}><b>{feedback === "right" ? "拼写正确！" : `正确拼写：${current.word}`}</b><span>{current.phonetic} · {current.phrase}</span><button onClick={continueSpelling}>下一个</button></div>}
          </section>
        )}

        {stage === "context" && current && (
          <section className="study-panel context-panel">
            <div className="stage-kicker">第四关 · 放进题里会用</div>
            <div className="exam-tag">高考真题风格 · 语境理解</div>
            <p className="sentence">{current.sentence.replace(new RegExp(current.word, "i"), "______")}</p>
            <div className="word-options">
              {options.map((option) => <button key={option.word} className={`word-chip ${feedback && option.word === current.word ? "correct" : ""}`} onClick={() => chooseContext(option)}>{option.word}</button>)}
            </div>
            {feedback && <div className={`feedback ${feedback}`}><b>{feedback === "right" ? "语境判断正确！" : `正确答案：${current.word}`}</b><span>{current.translation}</span><button onClick={continueContext}>继续</button></div>}
          </section>
        )}

        {stage === "summary" && (
          <section className="study-panel summary-panel">
            <div className="success-mark">✓</div>
            <p className="stage-kicker">今日第 {Math.max(1, Math.ceil(finishedToday / GROUP_SIZE))} 组</p>
            <h1>{queue.length} 个词，拿下一组！</h1>
            <p className="summary-copy">不是“看过”，而是用结果证明学会。</p>
            <div className="score-grid">
              <div><b>{meaningScore}</b><span>认义答对</span></div><div><b>{spellScore}</b><span>拼写答对</span></div>
              <div><b>{contextScore}</b><span>语境答对</span></div><div><b>{wrong.length}</b><span>待巩固词</span></div>
            </div>
            <button className="primary-action" onClick={begin} disabled={finishedToday >= target}>{finishedToday >= target ? "今日计划已完成" : `继续下一组 ${Math.min(GROUP_SIZE, target - finishedToday)} 词`}</button>
            <button className="text-action" onClick={goHome}>先休息，返回首页</button>
          </section>
        )}
      </main>
    );
  }

  const completion = Math.round((finishedToday / Math.max(target, 1)) * 100);
  const remainingWords = Math.max(0, wordBank.length - completedTotal);
  const planDays = Math.ceil(remainingWords / Math.max(target, 1));
  const weeklyTarget = target * 7;
  return (
    <main className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">高考核心词 · 第 2 周</p><h1>早上好，继续过关</h1></div>
        <button className="streak" aria-label="连续学习天数"><span>🔥</span><b>6</b> 天</button>
      </header>

      <section className="mission-card">
        <div className="mission-top">
          <div><span className="mission-label">今日任务</span><h2>{finishedToday}<small> / {target} 词</small></h2></div>
          <button className="target-button" onClick={() => setShowTarget(!showTarget)}>{target} 词/天⌄</button>
        </div>
        {showTarget && <div className="target-menu">
            <label htmlFor="daily-target">每天背多少个</label>
            <div className="target-input-row">
              <input id="daily-target" type="number" min="1" max="300" inputMode="numeric" value={dailyInput} onChange={(event) => setDailyInput(event.target.value)} />
              <button onClick={() => saveDailyTarget(dailyInput)}>保存</button>
            </div>
            <div className="quick-targets">{[50, 80, 100, 150].map((value) => <button key={value} onClick={() => saveDailyTarget(String(value))}>{value}</button>)}</div>
          </div>}
        <div className="mission-progress"><span style={{ width: `${Math.min(completion, 100)}%` }} /></div>
        <div className="mission-stats"><span><i className="dot purple" />已完成 {finishedToday}</span><span><i className="dot orange" />待复习 18</span><b>{completion}%</b></div>
        <button className="primary-action mission-start" onClick={begin} disabled={!wordBank.length || finishedToday >= target}><span className="play-icon">▶</span><span><b>{finishedToday >= target ? "今日任务已完成" : "继续今日学习"}</b><small>{finishedToday >= target ? "明天自动生成新计划" : `下一组 ${Math.min(GROUP_SIZE, target - finishedToday)} 词 · 约 12 分钟`}</small></span></button>
      </section>

      <section className="word-list-card">
        <div className="word-list-icon">Aa</div>
        <div><span className="section-label">我的待背词表</span><h3>{isCustomWordBank ? "自定义词表" : "高考核心示例词"} · {wordBank.length} 词</h3><p>每天 {target} 个 · 预计 {planDays || 0} 天完成 · 本周计划 {Math.min(weeklyTarget, remainingWords)} 个</p></div>
        <button onClick={() => { setShowImport(true); setImportError(""); }}>导入词表</button>
      </section>

      <section className="review-card">
        <div className="review-icon">↻</div><div><span className="section-label">到期复习</span><h3>18 个词等你巩固</h3><p>昨天错词 7 · 间隔复习 11</p></div><button onClick={begin}>去复习</button>
      </section>

      <section className="week-section">
        <div className="section-heading"><div><span className="section-label">本周规划</span><h3>目标 {weeklyTarget} 词</h3></div><b>{finishedToday} <small>/ {weeklyTarget}</small></b></div>
        <div className="week-bars" aria-label="本周每日学习量">{[64, 82, 58, 92, 40, 0, 0].map((height, day) => <div key={day}><span className={day === 4 ? "today" : ""} style={{ height: `${Math.max(height, 8)}%` }} /><small>{["一", "二", "三", "四", "五", "六", "日"][day]}</small></div>)}</div>
        <div className="week-note"><span>本周已覆盖 <b>286</b> 词</span><span>真正掌握 <b>173</b> 词</span></div>
      </section>

      <section className="level-section">
        <div className="section-heading compact"><div><span className="section-label">掌握状态</span><h3>结果比“眼熟”更可靠</h3></div><button>查看词库 ›</button></div>
        <div className="level-row"><div><i className="level-dot red" /><b>42</b><span>没记住</span></div><div><i className="level-dot amber" /><b>71</b><span>刚学会</span></div><div><i className="level-dot green" /><b>128</b><span>待巩固</span></div><div><i className="level-dot black" /><b>396</b><span>已掌握</span></div></div>
      </section>

      {showImport && <div className="modal-backdrop" role="presentation">
        <section className="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
          <div className="import-head"><div><span className="section-label">建立自己的词库</span><h2 id="import-title">导入待背单词表</h2></div><button onClick={() => setShowImport(false)} aria-label="关闭">×</button></div>
          <p className="import-help">支持清晰图片、Excel（.xlsx）、Word（.docx）、TXT 和 CSV。文件只在当前浏览器中解析，不会上传保存。</p>
          <label className={`file-picker ${isParsing ? "disabled" : ""}`}>
            <input type="file" accept=".png,.jpg,.jpeg,.webp,.xlsx,.docx,.txt,.csv,.tsv" onChange={handleFile} disabled={isParsing} />
            <span>{isParsing ? "正在解析，请稍候…" : "选择图片或文档"}</span>
            <small>图片尽量正面、清晰、每行一个单词</small>
          </label>
          <div className="import-divider"><span>或者直接粘贴</span></div>
          <textarea value={importText} onChange={(event) => setImportText(event.target.value)} rows={5} aria-label="待背单词表" placeholder={IMPORT_EXAMPLE} />
          <button className="parse-text-button" onClick={parsePastedWords}>解析粘贴内容</button>
          {(importStatus || importFileName) && <div className="parse-status"><div><b>{importFileName || "单词表"}</b><span>{importStatus}</span></div><div className="parse-progress"><span style={{ width: `${importPercent}%` }} /></div></div>}
          {importError && <p className="import-error" role="alert">{importError}</p>}
          {!!importedWords.length && <div className="import-preview">
            <div className="preview-head"><b>识别结果</b><span>{importedWords.length} 词 · 可修改后确认</span></div>
            {importedWords.slice(0, 40).map((item, itemIndex) => <div className="preview-row" key={`${item.word}-${itemIndex}`}>
              <input value={item.word} onChange={(event) => updateImportedWord(itemIndex, "word", event.target.value)} aria-label={`第 ${itemIndex + 1} 个英文单词`} />
              <input value={item.meaning} onChange={(event) => updateImportedWord(itemIndex, "meaning", event.target.value)} aria-label={`${item.word} 的中文意思`} />
            </div>)}
            {importedWords.length > 40 && <p className="preview-more">这里只预览前 40 个，确认后会导入全部 {importedWords.length} 个。</p>}
          </div>}
          <button className="import-primary" onClick={confirmImport} disabled={!importedWords.length || isParsing}>确认导入并生成学习计划</button>
          <button className="import-secondary" onClick={restoreBuiltInWords}>恢复内置示例词表</button>
        </section>
      </div>}

      <nav className="bottom-nav" aria-label="主导航"><button className="active"><span>⌂</span>今日</button><button><span>▤</span>词库</button><button><span>◎</span>战报</button><button><span>♙</span>我的</button></nav>
    </main>
  );
}
