"use client";

import { useEffect, useState } from "react";
import { createClient } from "../utils/supabase/client";

type Player = {
  id: string;
  name: string;
  table_number: string | null;
};

export default function HostPage() {
  const supabase = createClient();

  const [players, setPlayers] = useState<Player[]>([]);
  const [eventCode, setEventCode] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadPlayers(code: string) {
    const { data: event } = await supabase
      .from("events")
      .select("id")
      .eq("code", code)
      .single();

    if (!event) return;

    const { data } = await supabase
      .from("players")
      .select("id, name, table_number")
      .eq("event_id", event.id)
      .order("created_at", { ascending: true });

    setPlayers(data || []);
  }

  useEffect(() => {
    const code = prompt("Введите код игры:");

    if (!code) {
      setLoading(false);
      return;
    }

    const normalizedCode = code.trim().toUpperCase();
    setEventCode(normalizedCode);

    loadPlayers(normalizedCode).finally(() => {
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!eventCode) return;

    let channel: ReturnType<typeof supabase.channel>;

    async function setupRealtime() {
      const { data: event } = await supabase
        .from("events")
        .select("id")
        .eq("code", eventCode)
        .single();

      if (!event) return;

      channel = supabase
        .channel(`players-${event.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "players",
            filter: `event_id=eq.${event.id}`,
          },
          () => {
            loadPlayers(eventCode);
          }
        )
        .subscribe();
    }

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [eventCode]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center">
        Загрузка...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#101014] text-white px-6 py-10">
      <div className="max-w-5xl mx-auto">

        <div className="text-center mb-10">
          <p className="text-xs tracking-[0.35em] text-[#C8FF3D]">
            MOMENTO LIVE
          </p>

          <h1 className="text-6xl font-black mt-4">
            {eventCode || "LOBBY"}
          </h1>

          <p className="text-zinc-500 mt-3">
            Ожидаем гостей...
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">

          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-zinc-500 text-sm">
                ПОДКЛЮЧИЛИСЬ
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
            <div className="py-20 text-center text-zinc-600">
              Пока никто не подключился
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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

        <div className="text-center mt-10 text-xs tracking-[0.3em] text-zinc-700">
          YOUR EVENT. YOUR MOMENTS.
        </div>

      </div>
    </main>
  );
}