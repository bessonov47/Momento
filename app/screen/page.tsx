"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../utils/supabase/client";

type Question = {
  id: string;
  question: string;
  media_url: string | null;
  media_type: string | null;
};

type Answer = {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
};

type Game = {
  id: string;
  event_id: string;
  status: string;
  current_question_id: string | null;
};

function ScreenContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [eventCode, setEventCode] = useState("");
  const [eventId, setEventId] = useState("");

  const [game, setGame] = useState<Game | null>(null);
  const [question, setQuestion] =
    useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);

  const [loading, setLoading] = useState(true);

  // =====================================================
  // EVENT CODE
  // =====================================================

  useEffect(() => {
    const code = searchParams.get("event");

    if (!code) {
      setLoading(false);
      return;
    }

    setEventCode(code.trim().toUpperCase());
  }, [searchParams]);

  // =====================================================
  // LOAD GAME
  // =====================================================

  async function loadGame(id: string) {
    const { data, error } = await supabase
      .from("games")
      .select(
        "id, event_id, status, current_question_id"
      )
      .eq("event_id", id)
      .eq("type", "quiz")
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      return null;
    }

    setGame(data || null);

    return data;
  }

  // =====================================================
  // LOAD CURRENT QUESTION
  // =====================================================

  async function loadCurrentQuestion(
    questionId: string | null
  ) {
    if (!questionId) {
      setQuestion(null);
      setAnswers([]);
      return;
    }

    const {
      data: questionData,
      error: questionError,
    } = await supabase
      .from("questions")
      .select(
        "id, question, media_url, media_type"
      )
      .eq("id", questionId)
      .single();

    if (questionError) {
      console.error(questionError);
      return;
    }

    setQuestion(questionData);

    const {
      data: answerData,
      error: answerError,
    } = await supabase
      .from("answers")
      .select(
        "id, question_id, text, is_correct"
      )
      .eq("question_id", questionId)
      .order("created_at", {
        ascending: true,
      });

    if (answerError) {
      console.error(answerError);
      return;
    }

    setAnswers(answerData || []);
  }

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    if (!eventCode) return;

    async function init() {
      setLoading(true);

      const {
        data: event,
        error,
      } = await supabase
        .from("events")
        .select("id")
        .eq("code", eventCode)
        .single();

      if (error || !event) {
        console.error(error);
        setLoading(false);
        return;
      }

      setEventId(event.id);

      const currentGame =
        await loadGame(event.id);

      if (currentGame) {
        await loadCurrentQuestion(
          currentGame.current_question_id
        );
      }

      setLoading(false);
    }

    init();
  }, [eventCode]);

  // =====================================================
  // REALTIME GAME
  // =====================================================

  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`screen-game-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          const updatedGame =
            payload.new as Game;

          setGame(updatedGame);

          await loadCurrentQuestion(
            updatedGame.current_question_id
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center">
        <div className="text-3xl font-black">
          MOMENTO LIVE
        </div>
      </main>
    );
  }

  // =====================================================
  // NO EVENT
  // =====================================================

  if (!eventId) {
    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center">

        <div className="text-center">

          <p className="text-[#C8FF3D] text-sm tracking-[0.5em]">
            MOMENTO LIVE
          </p>

          <h1 className="text-6xl font-black mt-6">
            МЕРОПРИЯТИЕ НЕ НАЙДЕНО
          </h1>

        </div>

      </main>
    );
  }

  // =====================================================
  // WAITING
  // =====================================================

  if (
    !game ||
    game.status === "waiting"
  ) {
    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center px-10">

        <div className="text-center">

          <p className="text-[#C8FF3D] text-sm tracking-[0.5em]">
            MOMENTO LIVE
          </p>

          <h1 className="text-8xl font-black mt-8">
            {eventCode}
          </h1>

          <p className="text-2xl text-zinc-500 mt-8">
            Подключайтесь к игре
          </p>

        </div>

      </main>
    );
  }

  // =====================================================
  // COMPLETED
  // =====================================================

  if (game.status === "completed") {
    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center px-10">

        <div className="text-center">

          <p className="text-[#C8FF3D] text-sm tracking-[0.5em]">
            MOMENTO LIVE
          </p>

          <h1 className="text-8xl font-black mt-8">
            ИГРА ЗАВЕРШЕНА
          </h1>

          <p className="text-2xl text-zinc-500 mt-8">
            Спасибо за участие
          </p>

        </div>

      </main>
    );
  }

  // =====================================================
  // GAME STARTED / WAITING QUESTION
  // =====================================================

  if (!question) {
    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center">

        <div className="text-center">

          <p className="text-[#C8FF3D] text-sm tracking-[0.5em]">
            MOMENTO LIVE
          </p>

          <h1 className="text-7xl font-black mt-8">
            ГОТОВЫ?
          </h1>

          <p className="text-2xl text-zinc-500 mt-6">
            Игра начинается...
          </p>

        </div>

      </main>
    );
  }

  // =====================================================
  // QUESTION SCREEN
  // =====================================================

  return (
    <main className="min-h-screen bg-[#101014] text-white px-10 py-12">

      <div className="max-w-7xl mx-auto">

        {/* HEADER */}

        <div className="flex justify-between items-center">

          <div className="text-[#C8FF3D] text-sm tracking-[0.5em]">
            MOMENTO LIVE
          </div>

          <div className="text-zinc-600 text-sm tracking-widest">
            {eventCode}
          </div>

        </div>

        {/* QUESTION */}

        <div className="text-center mt-20">

          <p className="text-[#C8FF3D] text-lg tracking-[0.4em]">
            ВОПРОС
          </p>

          <h1 className="text-5xl md:text-7xl font-black leading-tight mt-8 max-w-6xl mx-auto">
            {question.question}
          </h1>

        </div>

        {/* ANSWERS */}

        <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto mt-20">

          {answers.map(
            (answer, index) => (

              <div
                key={answer.id}
                className="rounded-3xl border border-white/10 bg-white/[0.04] px-8 py-7 flex items-center gap-6"
              >

                <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center text-2xl font-black text-[#C8FF3D]">

                  {String.fromCharCode(
                    65 + index
                  )}

                </div>

                <div className="text-2xl md:text-3xl font-bold">
                  {answer.text}
                </div>

              </div>

            )
          )}

        </div>

        {/* FOOTER */}

        <div className="text-center mt-20 text-zinc-700 text-xs tracking-[0.4em]">
          YOUR EVENT. YOUR MOMENTS.
        </div>

      </div>

    </main>
  );
}

// =====================================================
// PAGE
// =====================================================

export default function ScreenPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center">
          <div className="text-3xl font-black">
            MOMENTO LIVE
          </div>
        </main>
      }
    >
      <ScreenContent />
    </Suspense>
  );
}