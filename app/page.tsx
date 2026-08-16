"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "./utils/supabase/client";

type Player = {
  id: string;
  name: string;
  table_number: string | null;
};

function HomeContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [eventCode, setEventCode] = useState("");
  const [eventId, setEventId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingEvent, setLoadingEvent] = useState(false);

  // ---------------------------------------
  // GENERATE EVENT CODE
  // ---------------------------------------

  function generateCode() {
    return Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
  }

  // ---------------------------------------
  // LOAD PLAYERS
  // ---------------------------------------

  async function loadPlayers(id: string) {
    const { data, error } = await supabase
      .from("players")
      .select("id, name, table_number")
      .eq("event_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Ошибка загрузки игроков:", error);
      return;
    }

    setPlayers(data || []);
  }

  // ---------------------------------------
  // LOAD EVENT FROM URL
  // ---------------------------------------

  useEffect(() => {
    const codeFromUrl = searchParams.get("event");

    if (!codeFromUrl) {
      return;
    }

    const code = codeFromUrl.trim().toUpperCase();

    async function loadEvent() {
      setLoadingEvent(true);

      const { data: event, error } = await supabase
        .from("events")
        .select("id, code")
        .eq("code", code)
        .single();

      if (error || !event) {
        console.error("Мероприятие не найдено:", error);
        setLoadingEvent(false);
        return;
      }

      setEventId(event.id);
      setEventCode(event.code);

      await loadPlayers(event.id);

      setLoadingEvent(false);
    }

    loadEvent();
  }, [searchParams]);

  // ---------------------------------------
  // REALTIME PLAYERS
  // ---------------------------------------

  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`momento-public-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          loadPlayers(eventId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // ---------------------------------------
  // CREATE EVENT
  // ---------------------------------------

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
      console.error("Ошибка создания мероприятия:", error);
      setError(error.message);
      setLoading(false);
      return;
    }

    // После создания автоматически открываем HOST
    router.push(`/host?event=${encodeURIComponent(data.code)}`);
  }

  // ---------------------------------------
  // LOADING EVENT
  // ---------------------------------------

  if (loadingEvent) {
    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs tracking-[0.35em] text-[#C8FF3D]">
            MOMENTO LIVE
          </p>

          <p className="mt-5 text-zinc-500">
            Загрузка мероприятия...
          </p>
        </div>
      </main>
    );
  }

  // ---------------------------------------
  // PUBLIC EVENT SCREEN
  // ---------------------------------------

  if (eventCode) {
    const joinUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/join?code=${encodeURIComponent(
            eventCode
          )}`
        : "";

    return (
      <main className="min-h-screen bg-[#101014] text-white px-6 py-10">
        <div className="max-w-7xl mx-auto">

          {/* HEADER */}

          <div className="text-center mb-12">
            <p className="text-xs tracking-[0.4em] text-[#C8FF3D]">
              MOMENTO LIVE
            </p>

            <h1 className="text-6xl md:text-8xl font-black mt-5 tracking-[-0.05em]">
              {eventCode}
            </h1>

            <p className="text-zinc-500 text-lg mt-4">
              Подключайтесь к игре
            </p>
          </div>

          {/* MAIN */}

          <div className="grid lg:grid-cols-[360px_1fr] gap-8">

            {/* QR */}

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 flex flex-col items-center justify-center">

              <p className="text-xs tracking-[0.25em] text-zinc-500 mb-6">
                СКАНИРУЙТЕ QR-КОД
              </p>

              {joinUrl && (
                <div className="bg-white p-5 rounded-3xl">
                  <QRCodeSVG
                    value={joinUrl}
                    size={250}
                    level="H"
                  />
                </div>
              )}

              <p className="text-zinc-400 text-sm text-center mt-6">
                Наведите камеру телефона
                <br />
                чтобы подключиться
              </p>

              <div className="mt-8 text-center">

                <p className="text-zinc-600 text-xs tracking-widest">
                  ИЛИ ВВЕДИТЕ КОД
                </p>

                <p className="text-3xl font-black tracking-[0.25em] text-[#C8FF3D] mt-2">
                  {eventCode}
                </p>

              </div>

            </div>

            {/* PLAYERS */}

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">

              <div className="flex items-end justify-between mb-8">

                <div>
                  <p className="text-zinc-500 text-sm tracking-widest">
                    ПОДКЛЮЧИЛИСЬ
                  </p>

                  <p className="text-6xl font-black mt-2">
                    {players.length}
                  </p>
                </div>

                <div className="text-[#C8FF3D] text-sm">
                  ● LIVE
                </div>

              </div>

              {players.length === 0 ? (
                <div className="min-h-[300px] flex items-center justify-center text-zinc-600">
                  Пока никто не подключился
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

                  {players.map((player, index) => (
                    <div
                      key={player.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
                    >

                      <div className="text-[#C8FF3D] text-sm">
                        #{index + 1}
                      </div>

                      <div className="font-bold text-xl mt-2">
                        {player.name}
                      </div>

                      {player.table_number && (
                        <div className="text-zinc-500 text-sm mt-1">
                          Стол {player.table_number}
                        </div>
                      )}

                    </div>
                  ))}

                </div>
              )}

            </div>

          </div>

          {/* FOOTER */}

          <div className="text-center mt-12 text-xs tracking-[0.3em] text-zinc-700">
            YOUR EVENT. YOUR MOMENTS.
          </div>

        </div>
      </main>
    );
  }

  // ---------------------------------------
  // CREATE EVENT PAGE
  // ---------------------------------------

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
            placeholder="Например: Выпускной"
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

// ---------------------------------------
// SUSPENSE WRAPPER
// ---------------------------------------

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center">
          Загрузка MOMENTO...
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}