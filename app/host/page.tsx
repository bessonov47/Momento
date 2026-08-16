"use client";

import { Suspense, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../utils/supabase/client";

type Player = {
  id: string;
  name: string;
  table_number: string | null;
};

type Game = {
  id: string;
  name: string;
  type: string;
  status: string;
};

function HostPageContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [players, setPlayers] = useState<Player[]>([]);
  const [eventCode, setEventCode] = useState("");
  const [eventId, setEventId] = useState("");
  const [eventName, setEventName] = useState("");

  const [game, setGame] = useState<Game | null>(null);

  const [loading, setLoading] = useState(true);
  const [startingGame, setStartingGame] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");

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
  // LOAD CURRENT GAME
  // ---------------------------------------

  async function loadGame(id: string) {
    const { data, error } = await supabase
      .from("games")
      .select("id, name, type, status")
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Ошибка загрузки игры:", error);
      return;
    }

    setGame(data || null);
  }

  // ---------------------------------------
  // LOAD EVENT
  // ---------------------------------------

  useEffect(() => {
    setSiteUrl(window.location.origin);

    const codeFromUrl = searchParams.get("event");

    if (!codeFromUrl) {
      setLoading(false);
      return;
    }

    const code = codeFromUrl.trim().toUpperCase();

    async function init() {
      const { data: event, error } = await supabase
        .from("events")
        .select("id, code, name")
        .eq("code", code)
        .single();

      if (error || !event) {
        console.error("Мероприятие не найдено:", error);
        setLoading(false);
        return;
      }

      setEventId(event.id);
      setEventCode(event.code);
      setEventName(event.name);

      await loadPlayers(event.id);
      await loadGame(event.id);

      setLoading(false);
    }

    init();
  }, [searchParams]);

  // ---------------------------------------
  // REALTIME PLAYERS
  // ---------------------------------------

  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`momento-host-players-${eventId}`)
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
  // REALTIME GAMES
  // ---------------------------------------

  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`momento-host-games-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          loadGame(eventId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // ---------------------------------------
  // OPEN PUBLIC SCREEN
  // ---------------------------------------

  function openPublicScreen() {
    if (!eventCode) return;

    const url = `${siteUrl}/?event=${encodeURIComponent(eventCode)}`;

    window.open(url, "_blank");
  }

  // ---------------------------------------
  // START QUIZ
  // ---------------------------------------

  async function startQuiz() {
    if (!eventId) return;

    setStartingGame(true);

    try {
      // Проверяем, нет ли уже активной игры
      const { data: activeGame, error: activeError } = await supabase
        .from("games")
        .select("id, name, type, status")
        .eq("event_id", eventId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeError) {
        console.error("Ошибка проверки активной игры:", activeError);
      }

      if (activeGame) {
        setGame(activeGame);
        return;
      }

      // Создаём новую игру
      const { data: newGame, error } = await supabase
        .from("games")
        .insert({
          event_id: eventId,
          name: "Викторина",
          type: "quiz",
          status: "active",
        })
        .select("id, name, type, status")
        .single();

      if (error) {
        console.error("Ошибка создания игры:", error);
        alert("Не удалось создать игру");
        return;
      }

      setGame(newGame);
    } finally {
      setStartingGame(false);
    }
  }

  // ---------------------------------------
  // STOP GAME
  // ---------------------------------------

  async function stopGame() {
    if (!game) return;

    const { data, error } = await supabase
      .from("games")
      .update({
        status: "finished",
      })
      .eq("id", game.id)
      .select("id, name, type, status")
      .single();

    if (error) {
      console.error("Ошибка завершения игры:", error);
      return;
    }

    setGame(data);
  }

  // ---------------------------------------
  // LOADING
  // ---------------------------------------

  if (loading) {
    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs tracking-[0.35em] text-[#C8FF3D]">
            MOMENTO HOST
          </p>

          <p className="text-zinc-500 mt-4">
            Загрузка...
          </p>
        </div>
      </main>
    );
  }

  // ---------------------------------------
  // EVENT NOT FOUND
  // ---------------------------------------

  if (!eventCode) {
    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center px-6">
        <div className="text-center">

          <p className="text-red-400 text-xl font-bold">
            Мероприятие не найдено
          </p>

          <p className="text-zinc-600 mt-3">
            Создайте мероприятие через главную страницу MOMENTO.
          </p>

        </div>
      </main>
    );
  }

  // ---------------------------------------
  // JOIN URL
  // ---------------------------------------

  const joinUrl =
    siteUrl && eventCode
      ? `${siteUrl}/join?code=${encodeURIComponent(eventCode)}`
      : "";

  // ---------------------------------------
  // HOST PAGE
  // ---------------------------------------

  return (
    <main className="min-h-screen bg-[#101014] text-white px-6 py-8">

      <div className="max-w-7xl mx-auto">

        {/* --------------------------------- */}
        {/* HEADER */}
        {/* --------------------------------- */}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">

          <div>

            <p className="text-xs tracking-[0.35em] text-[#C8FF3D]">
              MOMENTO HOST
            </p>

            <h1 className="text-5xl md:text-6xl font-black mt-3">
              {eventName}
            </h1>

            <div className="flex items-center gap-4 mt-4">

              <span className="text-zinc-500 text-sm">
                Код мероприятия
              </span>

              <span className="text-[#C8FF3D] font-black tracking-[0.2em]">
                {eventCode}
              </span>

            </div>

          </div>

          {/* PUBLIC SCREEN BUTTON */}

          <button
            onClick={openPublicScreen}
            className="px-7 py-4 rounded-2xl bg-[#C8FF3D] text-[#101014] font-black hover:scale-[1.02] active:scale-[0.98] transition"
          >
            ОТКРЫТЬ ЭКРАН
          </button>

        </div>

        {/* --------------------------------- */}
        {/* TOP STATS */}
        {/* --------------------------------- */}

        <div className="grid md:grid-cols-3 gap-5 mb-6">

          {/* PLAYERS */}

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7">

            <p className="text-zinc-500 text-xs tracking-[0.2em]">
              УЧАСТНИКИ
            </p>

            <p className="text-5xl font-black mt-3">
              {players.length}
            </p>

            <p className="text-zinc-600 text-sm mt-2">
              подключено сейчас
            </p>

          </div>

          {/* GAME */}

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7">

            <p className="text-zinc-500 text-xs tracking-[0.2em]">
              ТЕКУЩАЯ ИГРА
            </p>

            <p className="text-2xl font-black mt-4">
              {game?.name || "Нет игры"}
            </p>

            <p className="text-zinc-600 text-sm mt-2">
              {game?.status === "active"
                ? "Игра идёт"
                : game?.status === "finished"
                  ? "Завершена"
                  : "Не запущена"}
            </p>

          </div>

          {/* LIVE */}

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7">

            <p className="text-zinc-500 text-xs tracking-[0.2em]">
              СОЕДИНЕНИЕ
            </p>

            <p className="text-2xl font-black mt-4 text-[#C8FF3D]">
              ● LIVE
            </p>

            <p className="text-zinc-600 text-sm mt-2">
              Realtime подключён
            </p>

          </div>

        </div>

        {/* --------------------------------- */}
        {/* QR + PLAYERS */}
        {/* --------------------------------- */}

        <div className="grid lg:grid-cols-[320px_1fr] gap-6">

          {/* QR */}

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">

            <p className="text-zinc-500 text-xs tracking-[0.2em] text-center">
              QR-КОД ДЛЯ ГОСТЕЙ
            </p>

            <div className="flex justify-center mt-6">

              {joinUrl && (
                <div className="bg-white p-4 rounded-3xl">

                  <QRCodeSVG
                    value={joinUrl}
                    size={220}
                    level="H"
                  />

                </div>
              )}

            </div>

            <p className="text-zinc-500 text-sm text-center mt-6">
              Гости сканируют этот QR-код
            </p>

            <div className="mt-6 text-center">

              <p className="text-zinc-600 text-xs tracking-widest">
                КОД
              </p>

              <p className="text-3xl font-black tracking-[0.2em] text-[#C8FF3D] mt-2">
                {eventCode}
              </p>

            </div>

          </div>

          {/* PLAYERS */}

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">

            <div className="flex items-end justify-between mb-7">

              <div>

                <p className="text-zinc-500 text-sm tracking-[0.15em]">
                  ПОДКЛЮЧИВШИЕСЯ ГОСТИ
                </p>

                <p className="text-5xl font-black mt-2">
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

        {/* --------------------------------- */}
        {/* GAME CONTROL */}
        {/* --------------------------------- */}

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-8">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-7">

            <div>

              <p className="text-zinc-500 text-xs tracking-[0.2em]">
                УПРАВЛЕНИЕ ИГРОЙ
              </p>

              <h2 className="text-3xl font-black mt-3">
                {game?.name || "Викторина"}
              </h2>

              <p className="text-zinc-500 mt-2">

                {game?.status === "active"
                  ? "Викторина сейчас идёт"
                  : game?.status === "finished"
                    ? "Предыдущая игра завершена"
                    : "Игра готова к запуску"}

              </p>

            </div>

            <div className="flex flex-wrap items-center gap-3">

              {game?.status === "active" ? (

                <>
                  <div className="px-6 py-3 rounded-xl bg-[#C8FF3D] text-[#101014] font-black">
                    ● ИГРА ИДЁТ
                  </div>

                  <button
                    onClick={stopGame}
                    className="px-6 py-3 rounded-xl border border-white/10 text-white font-bold hover:bg-white/10 transition"
                  >
                    ЗАВЕРШИТЬ
                  </button>
                </>

              ) : (

                <button
                  onClick={startQuiz}
                  disabled={startingGame}
                  className="px-8 py-4 rounded-xl bg-[#C8FF3D] text-[#101014] font-black hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50"
                >
                  {startingGame
                    ? "ЗАПУСК..."
                    : "НАЧАТЬ ИГРУ"}
                </button>

              )}

            </div>

          </div>

        </div>

        {/* --------------------------------- */}
        {/* FOOTER */}
        {/* --------------------------------- */}

        <div className="text-center mt-10 text-xs tracking-[0.3em] text-zinc-700">
          MOMENTO HOST · YOUR EVENT. YOUR MOMENTS.
        </div>

      </div>

    </main>
  );
}

// ---------------------------------------
// SUSPENSE WRAPPER
// ---------------------------------------

export default function HostPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center">
          <div className="text-center">

            <p className="text-xs tracking-[0.35em] text-[#C8FF3D]">
              MOMENTO HOST
            </p>

            <p className="text-zinc-500 mt-4">
              Загрузка...
            </p>

          </div>
        </main>
      }
    >
      <HostPageContent />
    </Suspense>
  );
}