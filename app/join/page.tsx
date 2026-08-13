"use client";

import { useEffect, useState } from "react";
import { createClient } from "../utils/supabase/client";

export default function JoinPage() {
  const supabase = createClient();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const urlCode = params.get("code");

  if (urlCode) {
    setCode(urlCode.trim().toUpperCase());
  }
}, []);
  async function joinGame() {
    if (!name.trim()) {
      setError("Введите ваше имя");
      return;
    }

    if (!code.trim()) {
      setError("Введите код игры");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Ищем игру по коду
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("id, name, code, status")
        .eq("code", code.trim().toUpperCase())
        .single();

      if (eventError || !event) {
        setError("Игра с таким кодом не найдена");
        setLoading(false);
        return;
      }

      // Добавляем игрока
      const { error: playerError } = await supabase
        .from("players")
        .insert({
          event_id: event.id,
          name: name.trim(),
        });

      if (playerError) {
        setError(playerError.message);
        setLoading(false);
        return;
      }

      setJoined(true);
    } catch {
      setError("Не удалось подключиться. Попробуйте ещё раз.");
    }

    setLoading(false);
  }

  if (joined) {
    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="text-xs tracking-[0.35em] text-[#C8FF3D] mb-6">
            MOMENTO
          </div>

          <h1 className="text-4xl font-black mb-4">
            ВЫ ПОДКЛЮЧЕНЫ
          </h1>

          <p className="text-zinc-400 text-lg">
            {name}, ждите начала игры.
          </p>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-zinc-500">
              Игра
            </p>

            <p className="text-2xl font-bold mt-2">
              MOMENTO
            </p>

            <p className="text-zinc-500 mt-4">
              Следите за экраном 📺
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">

        <div className="text-xs tracking-[0.35em] text-[#C8FF3D] mb-6">
          INTERACTIVE EVENT EXPERIENCE
        </div>

        <h1 className="text-6xl font-black tracking-tight mb-4">
          MOMENTO
        </h1>

        <p className="text-zinc-400 mb-10">
          Присоединитесь к игре
        </p>

        <div className="space-y-4">

          <input
            type="text"
            placeholder="Ваше имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4 outline-none text-white placeholder:text-zinc-600 focus:border-[#C8FF3D]"
          />

          <input
            type="text"
            placeholder="Код игры"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4 text-center text-2xl font-bold tracking-[0.3em] outline-none text-white placeholder:text-zinc-600 focus:border-[#C8FF3D]"
          />

          <button
            onClick={joinGame}
            disabled={loading}
            className="w-full rounded-2xl bg-[#C8FF3D] px-6 py-4 font-black text-[#101014] transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "ПОДКЛЮЧЕНИЕ..." : "ВОЙТИ В ИГРУ"}
          </button>

        </div>

        {error && (
          <p className="mt-5 text-sm text-red-400">
            {error}
          </p>
        )}

        <p className="mt-16 text-xs tracking-[0.3em] text-zinc-700">
          YOUR EVENT. YOUR MOMENTS.
        </p>

      </div>
    </main>
  );
}