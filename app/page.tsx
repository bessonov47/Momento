"use client";

import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { createClient } from "./utils/supabase/client";

export default function Home() {
  const supabase = createClient();

  const [name, setName] = useState("");
  const [eventCode, setEventCode] = useState("");
  const [eventId, setEventId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function generateCode() {
    return Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
  }

  async function createEvent() {
    if (!name.trim()) {
      setError("Введите название мероприятия");
      return;
    }

    setLoading(true);
    setError("");

    const code = generateCode();

    const { data, error } = await supabase
      .from("events")
      .insert({
        name: name.trim(),
        code,
        status: "lobby",
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setEventId(data.id);
    setEventCode(data.code);
    setLoading(false);
  }

  if (eventCode) {
    const joinUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/join?code=${eventCode}`
        : "";

    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center px-6">
        <div className="w-full max-w-2xl text-center">

          <div className="text-sm tracking-[0.35em] text-[#C8FF3D]">
            INTERACTIVE EVENT EXPERIENCE
          </div>

          <h1 className="mt-4 text-7xl font-black tracking-[-0.06em]">
            MOMENTO
          </h1>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-10">

            <p className="text-sm uppercase tracking-widest text-white/40">
              Игра создана
            </p>

            <h2 className="mt-3 text-3xl font-black">
              {name}
            </h2>

            <p className="mt-10 text-sm uppercase tracking-widest text-white/40">
              Код для гостей
            </p>

            <div className="mt-3 text-7xl font-black tracking-[0.25em] text-[#C8FF3D]">
              {eventCode}
            </div>

            <div className="mt-8 flex justify-center">
              <div className="rounded-3xl bg-white p-5">
                {joinUrl && (
                  <QRCodeCanvas
                    value={joinUrl}
                    size={220}
                    level="H"
                    includeMargin
                  />
                )}
              </div>
            </div>

            <p className="mt-5 text-white/50">
              Отсканируйте QR-код телефоном
            </p>

            <p className="mt-2 text-sm text-white/30">
              или введите код вручную
            </p>

          </div>

          <div className="mt-8 text-xs tracking-[0.25em] text-white/20">
            YOUR EVENT. YOUR MOMENTS.
          </div>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-2xl text-center">

        <div className="text-sm tracking-[0.35em] text-[#C8FF3D]">
          INTERACTIVE EVENT EXPERIENCE
        </div>

        <h1 className="mt-4 text-7xl font-black tracking-[-0.06em]">
          MOMENTO
        </h1>

        <p className="mt-5 text-lg text-white/50">
          Создайте игровую комнату
        </p>

        <div className="mt-10">

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Свадьба Алексея и Марии"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-lg outline-none placeholder:text-white/30 focus:border-[#C8FF3D]"
          />

          <button
            onClick={createEvent}
            disabled={loading}
            className="mt-4 w-full rounded-2xl bg-[#C8FF3D] px-6 py-5 text-lg font-black text-[#101014] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? "СОЗДАЁМ..." : "СОЗДАТЬ ИГРУ"}
          </button>

        </div>

        {error && (
          <p className="mt-5 text-red-400">
            {error}
          </p>
        )}

        <div className="mt-12 text-xs tracking-[0.25em] text-white/20">
          YOUR EVENT. YOUR MOMENTS.
        </div>

      </div>
    </main>
  );
}