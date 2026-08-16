"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "../utils/supabase/client";

type Game = {
  id: string;
  event_id: string;
  status: string;
  current_question_id: string | null;
};

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

function ScreenContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [eventCode, setEventCode] = useState("");
  const [eventId, setEventId] = useState("");
  const [game, setGame] = useState<Game | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);

  // =====================================================
  // Получаем код мероприятия
  // =====================================================

  useEffect(() => {
    const urlCode = searchParams.get("event");

    if (urlCode) {
      const code = urlCode.trim().toUpperCase();

      setEventCode(code);

      localStorage.setItem(
        "momento_event_code",
        code
      );

      return;
    }

    const savedCode =
      localStorage.getItem(
        "momento_event_code"
      );

    if (savedCode) {
      setEventCode(
        savedCode.trim().toUpperCase()
      );
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  // =====================================================
  // Загружаем вопрос
  // =====================================================

  async function loadQuestion(
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
      console.error(
        "Ошибка загрузки вопроса:",
        questionError
      );
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
      console.error(
        "Ошибка загрузки ответов:",
        answerError
      );
      return;
    }

    setAnswers(answerData || []);
  }

  // =====================================================
  // Загружаем текущую игру
  // =====================================================

  async function loadGame(id: string) {
    const {
      data,
      error,
    } = await supabase
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
      console.error(
        "Ошибка загрузки игры:",
        error
      );
      return null;
    }

    setGame(data || null);

    if (data) {
      await loadQuestion(
        data.current_question_id
      );
    }

    return data;
  }

  // =====================================================
  // Инициализация
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
        console.error(
          "Мероприятие не найдено:",
          error
        );

        setLoading(false);
        return;
      }

      setEventId(event.id);

      await loadGame(event.id);

      setLoading(false);
    }

    init();
  }, [eventCode]);

  // =====================================================
  // REALTIME
  // =====================================================

  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(
        `momento-screen-${eventId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          console.log(
            "GAME UPDATE:",
            payload
          );

          const updatedGame =
            payload.new as Game;

          setGame(updatedGame);

          await loadQuestion(
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

        <div className="text-3xl font-black tracking-[0.2em]">
          MOMENTO LIVE
        </div>

      </main>
    );
  }

  // =====================================================
  // EVENT NOT FOUND
  // =====================================================

  if (!eventId) {
    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center">

        <div className="text-center">

          <p className="text-[#C8FF3D] text-sm tracking-[0.5em]">
            MOMENTO LIVE
          </p>

          <h1 className="text-5xl font-black mt-6">
            МЕРОПРИЯТИЕ НЕ НАЙДЕНО
          </h1>

          <p className="text-zinc-600 mt-4">
            Проверьте код мероприятия
          </p>

        </div>

      </main>
    );
  }

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join?code=${encodeURIComponent(
          eventCode
        )}`
      : "";

  // =====================================================
  // ИГРА ЗАВЕРШЕНА
  // =====================================================

  if (game?.status === "completed") {
    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center">

        <div className="text-center">

          <p className="text-[#C8FF3D] text-sm tracking-[0.5em]">
            MOMENTO LIVE
          </p>

          <h1 className="text-7xl md:text-9xl font-black mt-8">
            ИГРА ЗАВЕРШЕНА
          </h1>

          <p className="text-2xl text-zinc-500 mt-6">
            Спасибо за участие
          </p>

        </div>

      </main>
    );
  }

  // =====================================================
  // НЕТ ТЕКУЩЕГО ВОПРОСА
  // QR-КОД ПОКАЗЫВАЕТСЯ ЗДЕСЬ
  // =====================================================

  if (!question) {
    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center px-8">

        <div className="w-full max-w-6xl text-center">

          <p className="text-[#C8FF3D] text-sm md:text-base tracking-[0.55em]">
            MOMENTO LIVE
          </p>

          <h1 className="text-7xl md:text-9xl font-black mt-5 tracking-[-0.05em]">
            {eventCode}
          </h1>

          <p className="text-2xl md:text-3xl text-zinc-500 mt-4">
            Подключайтесь к игре
          </p>

          {/* QR */}

          <div className="mt-10 flex flex-col items-center">

            <div className="bg-white p-6 rounded-[2rem]">

              <QRCodeSVG
                value={joinUrl}
                size={320}
                level="H"
                includeMargin
              />

            </div>

            <p className="text-xl text-zinc-400 mt-7">
              Отсканируйте QR-код телефоном
            </p>

            <p className="text-zinc-600 mt-2">
              или введите код вручную
            </p>

            <div className="text-[#C8FF3D] text-4xl font-black tracking-[0.35em] mt-4">
              {eventCode}
            </div>

          </div>

          <p className="text-zinc-800 text-xs tracking-[0.4em] mt-12">
            YOUR EVENT. YOUR MOMENTS.
          </p>

        </div>

      </main>
    );
  }

  // =====================================================
  // ВОПРОС
  // =====================================================

  return (
    <main className="min-h-screen bg-[#101014] text-white px-8 md:px-14 py-8">

      <div className="max-w-[1500px] mx-auto">

        <header className="flex items-center justify-between">

          <div className="text-[#C8FF3D] text-sm tracking-[0.5em]">
            MOMENTO LIVE
          </div>

          <div className="text-zinc-600 text-sm tracking-[0.25em]">
            {eventCode}
          </div>

        </header>

        <section className="text-center mt-16 md:mt-20">

          <p className="text-[#C8FF3D] text-base md:text-lg tracking-[0.45em]">
            ВОПРОС
          </p>

          <h1 className="text-5xl md:text-7xl xl:text-8xl font-black leading-[1.05] mt-7 max-w-6xl mx-auto">
            {question.question}
          </h1>

        </section>

        <section className="grid md:grid-cols-2 gap-5 md:gap-7 max-w-6xl mx-auto mt-16 md:mt-20">

          {answers.map(
            (answer, index) => (

              <div
                key={answer.id}
                className="rounded-3xl border border-white/10 bg-white/[0.04] px-7 py-6 md:px-8 md:py-7 flex items-center gap-6"
              >

                <div className="w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-2xl bg-white/[0.06] flex items-center justify-center text-xl md:text-2xl font-black text-[#C8FF3D]">

                  {String.fromCharCode(
                    65 + index
                  )}

                </div>

                <div className="text-xl md:text-2xl xl:text-3xl font-bold">
                  {answer.text}
                </div>

              </div>

            )
          )}

        </section>

        <footer className="text-center mt-16 text-zinc-800 text-xs tracking-[0.4em]">
          YOUR EVENT. YOUR MOMENTS.
        </footer>

      </div>

    </main>
  );
}

export default function ScreenPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center">

          <div className="text-3xl font-black tracking-[0.2em]">
            MOMENTO LIVE
          </div>

        </main>
      }
    >
      <ScreenContent />
    </Suspense>
  );
}