const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

function dateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function lastDateKeys(count) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (count - index - 1));
    return dateKey(date);
  });
}

async function ensureUser(openid) {
  const existing = await db.collection("users").where({ openid }).limit(1).get();
  if (existing.data[0]) return existing.data[0];
  const user = {
    openid,
    name: "学生",
    role: "student",
    dailyTarget: 50,
    createdAt: db.serverDate()
  };
  const created = await db.collection("users").add({ data: user });
  return { ...user, _id: created._id };
}

async function studentHome(openid) {
  const user = await ensureUser(openid);
  const list = await db.collection("word_lists").where({ ownerOpenId: openid, active: true }).limit(1).get();
  const words = list.data[0]?.words || [];
  const today = await db.collection("study_progress").where({ studentOpenId: openid, date: dateKey() }).limit(1).get();
  const record = today.data[0] || {};
  return {
    target: user.dailyTarget || 50,
    finished: record.finished || 0,
    accuracy: record.accuracy || 0,
    wrongCount: record.wrongCount || 0,
    streak: user.streak || 0,
    words
  };
}

async function todayWords(openid) {
  const user = await ensureUser(openid);
  const list = await db.collection("word_lists").where({ ownerOpenId: openid, active: true }).limit(1).get();
  const words = list.data[0]?.words || [];
  const count = Math.min(user.dailyTarget || 50, words.length);
  const start = (user.completedTotal || 0) % Math.max(words.length, 1);
  const ordered = [...words.slice(start), ...words.slice(0, start)];
  return ordered.slice(0, count);
}

async function saveSession(openid, event) {
  const user = await ensureUser(openid);
  const results = event.results || {};
  const count = Math.max(0, Number(event.count) || 0);
  const wrongCount = (results.fuzzy || 0) + (results.new || 0);
  const accuracy = count ? Math.round(((results.known || 0) / count) * 100) : 0;
  const key = dateKey();
  const existing = await db.collection("study_progress").where({ studentOpenId: openid, date: key }).limit(1).get();
  const previous = existing.data[0];
  const finished = (previous?.finished || 0) + count;
  const previousCorrect = Math.round((previous?.finished || 0) * (previous?.accuracy || 0) / 100);
  const combinedAccuracy = finished
    ? Math.round((previousCorrect + (results.known || 0)) / finished * 100)
    : 0;
  const data = {
    studentOpenId: openid,
    date: key,
    finished,
    wrongCount: (previous?.wrongCount || 0) + wrongCount,
    accuracy: combinedAccuracy,
    durationSeconds: (previous?.durationSeconds || 0) + (Number(event.durationSeconds) || 0),
    updatedAt: db.serverDate()
  };
  if (previous) await db.collection("study_progress").doc(previous._id).update({ data });
  else await db.collection("study_progress").add({ data });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const nextStreak = user.lastStudyDate === key
    ? (user.streak || 1)
    : user.lastStudyDate === dateKey(yesterday)
      ? (user.streak || 0) + 1
      : 1;
  await db.collection("users").doc(user._id).update({
    data: {
      completedTotal: _.inc(count),
      streak: nextStreak,
      lastStudyDate: key,
      updatedAt: db.serverDate()
    }
  });
}

async function saveWordList(openid, event) {
  const user = await ensureUser(openid);
  const words = Array.isArray(event.words) ? event.words.slice(0, 3500) : [];
  await db.collection("word_lists").where({ ownerOpenId: openid, active: true }).update({ data: { active: false } });
  await db.collection("word_lists").add({
    data: {
      ownerOpenId: openid,
      name: "拍照导入词表",
      words,
      active: true,
      createdAt: db.serverDate()
    }
  });
  await db.collection("users").doc(user._id).update({
    data: {
      dailyTarget: Math.max(1, Math.min(300, Number(event.dailyTarget) || 50)),
      completedTotal: 0,
      updatedAt: db.serverDate()
    }
  });
}

async function createBindCode(openid) {
  await ensureUser(openid);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 30 * 60 * 1000);
  await db.collection("bind_codes").add({
    data: {
      code,
      studentOpenId: openid,
      expiresAt: expires,
      used: false,
      createdAt: db.serverDate()
    }
  });
  return { code, expiresAt: expires.toISOString() };
}

async function bindParent(parentOpenId, code) {
  const codes = await db.collection("bind_codes").where({ code, used: false }).limit(1).get();
  const record = codes.data[0];
  if (!record || new Date(record.expiresAt).getTime() < Date.now()) {
    throw new Error("绑定码无效或已过期");
  }
  await db.collection("bindings").add({
    data: {
      parentOpenId,
      studentOpenId: record.studentOpenId,
      createdAt: db.serverDate()
    }
  });
  await db.collection("bind_codes").doc(record._id).update({ data: { used: true } });
  const parent = await ensureUser(parentOpenId);
  await db.collection("users").doc(parent._id).update({ data: { role: "parent" } });
}

async function parentDashboard(parentOpenId, selectedChild) {
  const bindings = await db.collection("bindings").where({ parentOpenId }).get();
  const studentIds = bindings.data.map((item) => item.studentOpenId);
  if (!studentIds.length) return { children: [], currentChild: null, summary: null, days: [] };
  const users = await db.collection("users").where({ openid: _.in(studentIds) }).get();
  const children = users.data.map((user) => ({ openid: user.openid, name: user.name || "孩子" }));
  const childOpenId = studentIds.includes(selectedChild) ? selectedChild : studentIds[0];
  const child = users.data.find((user) => user.openid === childOpenId);
  const keys = lastDateKeys(7);
  const records = await db.collection("study_progress")
    .where({ studentOpenId: childOpenId, date: _.in(keys) })
    .get();
  const byDate = Object.fromEntries(records.data.map((item) => [item.date, item]));
  const target = child?.dailyTarget || 50;
  const days = keys.map((key) => {
    const record = byDate[key] || {};
    const date = new Date(`${key}T00:00:00`);
    return {
      date: key,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      count: record.finished || 0,
      percent: Math.min(100, Math.round(((record.finished || 0) / target) * 100))
    };
  });
  const today = byDate[dateKey()] || {};
  return {
    children,
    currentChild: children.find((item) => item.openid === childOpenId),
    days,
    summary: {
      finished: today.finished || 0,
      accuracy: today.accuracy || 0,
      wrongCount: today.wrongCount || 0,
      minutes: Math.round((today.durationSeconds || 0) / 60),
      missedDays: days.filter((item) => item.count < target).length,
      hardWords: records.data.reduce((sum, item) => sum + (item.wrongCount || 0), 0),
      streak: child?.streak || 0
    }
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  try {
    switch (event.action) {
      case "profile": {
        const user = await ensureUser(OPENID);
        return { ok: true, data: { role: user.role || "student", name: user.name || "学生" } };
      }
      case "studentHome":
        return { ok: true, data: await studentHome(OPENID) };
      case "todayWords":
        return { ok: true, data: { words: await todayWords(OPENID) } };
      case "saveSession":
        await saveSession(OPENID, event);
        return { ok: true };
      case "saveWordList":
        await saveWordList(OPENID, event);
        return { ok: true };
      case "createBindCode":
        return { ok: true, data: await createBindCode(OPENID) };
      case "bindParent":
        await bindParent(OPENID, String(event.code || ""));
        return { ok: true };
      case "parentDashboard":
        return { ok: true, data: await parentDashboard(OPENID, event.childOpenId) };
      default:
        return { ok: false, message: "未知操作" };
    }
  } catch (error) {
    console.error("PROGRESS_FAILED", event.action, error);
    return { ok: false, message: error.message || "数据服务暂时不可用" };
  }
};
