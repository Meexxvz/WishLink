"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBFXh3p56dSefvwLwPbYBcr4RpJ8t_pJu0",
  authDomain: "wishlink-99c6e.firebaseapp.com",
  projectId: "wishlink-99c6e",
  storageBucket: "wishlink-99c6e.firebasestorage.app",
  messagingSenderId: "471623422230",
  appId: "1:471623422230:web:e70fc00bd78af7b57f4037",
  measurementId: "G-4W10YV26Y4"
};


function initFirebase() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
}

function useAnonAuth() {
  const [uid, setUid] = useState(null);
  useEffect(() => {
    initFirebase();
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setUid(user.uid);
      else signInAnonymously(auth);
    });
    return () => unsub();
  }, []);
  return uid;
}

export default function SharedTodoApp() {
  const [creating, setCreating] = useState(false);
  const [list, setList] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [titleInput, setTitleInput] = useState("やりたいことリスト");
  const [listId, setListId] = useState(null);

  const db = useMemo(() => {
    initFirebase();
    return getFirestore();
  }, []);

  // URLの list クエリを監視
  useEffect(() => {
    const setFromUrl = () => {
      const sp = new URLSearchParams(window.location.search);
      setListId(sp.get("list"));
    };
    setFromUrl();
    window.addEventListener("popstate", setFromUrl);
    return () => window.removeEventListener("popstate", setFromUrl);
  }, []);

  // list / tasks を購読
  useEffect(() => {
    if (!listId) return;
    const listRef = doc(db, "lists", listId);
    const unsubList = onSnapshot(listRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setList({ id: snap.id, title: data.title ?? "共有リスト" });
      } else {
        setList(null);
      }
    });

    const q = query(
      collection(db, "tasks"),
      where("listId", "==", listId),
      orderBy("createdAt", "asc")
    );
    const unsubTasks = onSnapshot(q, (snap) => {
      const arr = [];
      snap.forEach((d) => {
        const data = d.data();
        arr.push({ id: d.id, text: data.text, completed: !!data.completed, createdAt: data.createdAt });
      });
      setTasks(arr);
    });

    return () => {
      unsubList();
      unsubTasks();
    };
  }, [db, listId]);

  async function createList() {
    try {
      setCreating(true);
      const ref = await addDoc(collection(db, "lists"), {
        title: titleInput || "やりたいことリスト",
        createdAt: serverTimestamp(),
      });
      const url = new URL(window.location.href);
      url.searchParams.set("list", ref.id);
      window.history.replaceState({}, "", url.toString());
      setListId(ref.id);
      setList({ id: ref.id, title: titleInput || "やりたいことリスト" });
    } finally {
      setCreating(false);
    }
  }

  async function addTask(e) {
    e?.preventDefault();
    if (!list || !newTask.trim()) return;
    await addDoc(collection(db, "tasks"), {
      listId: list.id,
      text: newTask.trim(),
      completed: false,
      createdAt: serverTimestamp(),
    });
    setNewTask("");
  }

  async function toggleTask(t) {
    await updateDoc(doc(db, "tasks", t.id), { completed: !t.completed });
  }

  async function removeTask(t) {
    await deleteDoc(doc(db, "tasks", t.id));
  }

  async function renameList(newTitle) {
    if (!list) return;
    await updateDoc(doc(db, "lists", list.id), { title: newTitle || "やりたいことリスト" });
  }

  function shareLink() {
    const url = new URL(window.location.href);
    if (!list?.id) return;
    url.searchParams.set("list", list.id);
    navigator.clipboard.writeText(url.toString());
    alert("共有リンクをコピーしました！");
  }

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-slate-100 p-6 flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl shadow-xl bg-white p-6 border border-slate-200"
        >
          <header className="flex items-center justify-between gap-4">
            <div className="flex-1">
              {list ? (
                <input
                  className="text-black font-bold outline-none bg-transparent w-full"
                  value={list.title}
                  onChange={(e) => setList({ ...list, title: e.target.value })}
                  onBlur={(e) => renameList(e.target.value)}
                />
              ) : (
                <input
                  className="text-2xl font-bold outline-none bg-transparent w-full"
                  placeholder="やりたいことリスト"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                />
              )}
              <p className="text-slate-500 mt-1 text-sm">
                友達や恋人・家族と共有して、チェックを付けたら進捗がリアルタイムで同期されます。
              </p>
            </div>
            <div className="flex items-center gap-2">
              {list ? (
                <button
                  onClick={shareLink}
                  className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm shadow hover:opacity-90"
                >
                  共有リンクをコピー
                </button>
              ) : (
                <button
                  onClick={createList}
                  disabled={creating}
                  className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm shadow hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? "作成中..." : "リストを作成"}
                </button>
              )}
            </div>
          </header>

          {list && (
            <>
              <section className="mt-6">
                <form onSubmit={addTask} className="flex gap-2">
                  <input
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    placeholder="やりたいことを入力 (例: 箱根温泉に行く)"
                    className="text-black flex-1 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50"
                  >
                    追加
                  </button>
                </form>

                <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                  <span>
                    合計 {tasks.length} 件 ・ 完了 {completedCount} 件
                  </span>
                  <Progress value={tasks.length ? (completedCount / tasks.length) * 100 : 0} />
                </div>

                <ul className="mt-4 space-y-2">
                  {tasks.map((t) => (
                    <li key={t.id} className="text-black group flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:shadow-sm">
                      <button
                        onClick={() => toggleTask(t)}
                        className={`h-5 w-5 rounded border flex items-center justify-center ${
                          t.completed ? "bg-slate-900 text-white" : "bg-white"
                        }`}
                        aria-label={t.completed ? "未完了にする" : "完了にする"}
                        title={t.completed ? "未完了にする" : "完了にする"}
                      >
                        {t.completed ? "✓" : ""}
                      </button>
                      <span className={`flex-1 ${t.completed ? "line-through text-slate-400" : ""}`}>{t.text}</span>
                      <button
                        onClick={() => removeTask(t)}
                        className="opacity-0 group-hover:opacity-100 transition text-slate-400 hover:text-slate-700"
                        title="削除"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <Hints />
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function Progress({ value }) {
  return (
    <div className="h-2 w-40 bg-slate-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-slate-900"
        style={{ width: `${Math.min(100, Math.max(0, value)).toFixed(0)}%` }}
      />
    </div>
  );
}

function Hints() {
  return (
    <div className="mt-8 rounded-xl border border-slate-200 p-4 bg-slate-50 text-sm text-slate-600 space-y-2">
      <p className="font-medium text-slate-700">使い方</p>
      <ul className="list-disc ml-5 space-y-1">
        <li>「リストを作成」→ 右上「共有リンクをコピー」でURLを伝えるだけで共同編集OK。</li>
        <li>タイトルを直接書き換えると自動保存されます。</li>
        <li>チェックを付けると、相手側にもリアルタイムで反映されます。</li>
      </ul>
    </div>
  );
}
