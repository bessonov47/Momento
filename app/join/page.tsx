"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../utils/supabase/client";

export default function JoinPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [eventName, setEventName] = useState("");
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const qrCode = searchParams.get("code");

    if (qrCode) {
      setCode(qrCode.toUpperCase());
    }
  }, [searchParams]);

  async function joinGame() {
    if (!code.trim()) {
      setError("Введите код игры");
      return;
    }

    if (!name.trim()) {
      setError("Введите своё имя");
      return;
    }

    setLoading(true);
    setError("");

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name")
      .eq("code", code.trim().toUpperCase())
      .single();

    if (eventError || !event) {
      setError("Игра с таким кодом не найдена");
      setLoading(false);
      return;
    }

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

    setEventName(event.name);
    setJoined(true);
    setLoading(false);
  }

  if (joined) {
    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center px-6">

        <div className="w-full max-w-md text-center">

          <div className="text-sm tracking-[0.35em] text-[#C8FF3D]">
            MOMENTO
          </div>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-10">

            <div className="text-6xl">
              🎉
            </div>

            <h1 className="mt-6 text-4xl font-black">
              ТЫ В ИГРЕ!
            </h1>

            <p className="mt-4 text-white/40">
              {eventName}
            </p>

            <div className="mt-8 rounded-2xl bg-[#C8FF3D] px-6 py-5 text-xl font-black text-[#101014]">
              {name}
            </div>

            <p className="mt-6 text-sm text-white/40">
              Следи за экраном — скоро начнём!
            </p>

          </div>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center px-6">

      <div className="w-full max-w-md text-center">

        <div className="text-sm tracking-[0.35em] text-[#C8FF3D]">
          INTERACTIVE EVENT EXPERIENCE
        </div>

        <h1 className="mt-4 text-6xl font-black tracking-[-0.06em]">
          MOMENTO
        </h1>

        <p className="mt-5 text-white/50">
          Подключись к игре
        </p>

        <div className="mt-10 space-y-4">

          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="КОД ИГРЫ"
            maxLength={6}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center text-2xl font-black uppercase tracking-[0.3em] outline-none placeholder:text-white/20 focus:border-[#C8FF3D]"
          />

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ТВОЁ ИМЯ"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center outline-none placeholder:text-white/30 focus:border-[#C8FF3D]"
          />

          <button
            onClick={joinGame}
            disabled={loading}
            className="w-full rounded-2xl bg-[#C8FF3D] px-6 py-5 font-black text-[#101014] transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "ПОДКЛЮЧЕНИЕ..." : "ВОЙТИ В ИГРУ"}
          </button>

        </div>

        {error && (
          <p className="mt-5 text-sm text-red-400">
            {error}
          </p>
        )}

      </div>

    </main>
  );
}