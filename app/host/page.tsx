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

type Question = {
  id: string;
  game_id: string;
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
  name: string;
  type: string;
  status: string;
  current_question_id: string | null;
};

function HostContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [eventCode, setEventCode] = useState("");
  const [eventId, setEventId] = useState("");
  const [eventName, setEventName] = useState("");

  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [game, setGame] = useState<Game | null>(null);

  const [loading, setLoading] = useState(true);
  const [creatingQuestion, setCreatingQuestion] = useState(false);
  const [startingGame, setStartingGame] = useState(false);

  const [questionText, setQuestionText] = useState("");

  const [answerTexts, setAnswerTexts] = useState([
    "",
    "",
    "",
    "",
  ]);

  const [correctAnswer, setCorrectAnswer] = useState(0);

  const [error, setError] = useState("");

  // ==================================================
  // EVENT CODE FROM URL
  // ==================================================

  useEffect(() => {
    const code = searchParams.get("event");

    if (!code) {
      setError("Код мероприятия не найден");
      setLoading(false);
      return;
    }

    setEventCode(code.trim().toUpperCase());
  }, [searchParams]);

  // ==================================================
  // LOAD EVENT
  // ==================================================

  async function loadEvent(code: string) {
    const { data, error } = await supabase
      .from("events")
      .select("id, name, code")
      .eq("code", code)
      .single();

    if (error || !data) {
      console.error("Ошибка загрузки мероприятия:", error);

      setError("Мероприятие не найдено");
      setLoading(false);

      return null;
    }

    setEventId(data.id);
    setEventName(data.name);

    return data;
  }

  // ==================================================
  // LOAD PLAYERS
  // ==================================================

  async function loadPlayers(id: string) {
    const { data, error } = await supabase
      .from("players")
      .select("id, name, table_number")
      .eq("event_id", id)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error("Ошибка загрузки игроков:", error);
      return;
    }

    setPlayers(data || []);
  }

  // ==================================================
  // LOAD GAME
  // ==================================================

  async function loadGame(id: string) {
    const { data, error } = await supabase
      .from("games")
      .select(
        "id, event_id, name, type, status, current_question_id"
      )
      .eq("event_id", id)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Ошибка загрузки игры:", error);
      return;
    }

    setGame(data || null);
  }

  // ==================================================
  // LOAD QUESTIONS
  // ==================================================

  async function loadQuestions(id: string) {
    const { data, error } = await supabase
      .from("questions")
      .select(
        "id, game_id, question, media_url, media_type"
      )
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error("Ошибка загрузки вопросов:", error);
      return;
    }

    setQuestions(data || []);

    if (!data || data.length === 0) {
      setAnswers([]);
      return;
    }

    const questionIds = data.map(
      (question) => question.id
    );

    const { data: answerData, error: answerError } =
      await supabase
        .from("answers")
        .select(
          "id, question_id, text, is_correct"
        )
        .in("question_id", questionIds)
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

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    if (!eventCode) return;

    async function init() {
      setLoading(true);
      setError("");

      const event = await loadEvent(eventCode);

      if (!event) return;

      await Promise.all([
        loadPlayers(event.id),
        loadGame(event.id),
        loadQuestions(event.id),
      ]);

      setLoading(false);
    }

    init();
  }, [eventCode]);

  // ==================================================
  // REALTIME
  // ==================================================

  useEffect(() => {
    if (!eventId) return;

    const playersChannel = supabase
      .channel(`host-players-${eventId}`)
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

    const gamesChannel = supabase
      .channel(`host-games-${eventId}`)
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

    const questionsChannel = supabase
      .channel(`host-questions-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "questions",
        },
        () => {
          loadQuestions(eventId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(gamesChannel);
      supabase.removeChannel(questionsChannel);
    };
  }, [eventId]);

  // ==================================================
  // CREATE QUESTION
  // ==================================================

  async function createQuestion() {
    if (!eventId) return;

    if (!questionText.trim()) {
      setError("Введите текст вопроса");
      return;
    }

    if (
      answerTexts.some(
        (answer) => !answer.trim()
      )
    ) {
      setError(
        "Заполните все 4 варианта ответа"
      );
      return;
    }

    setCreatingQuestion(true);
    setError("");

    try {
      let gameId = game?.id;

      // ----------------------------------------------
      // CREATE GAME IF IT DOES NOT EXIST
      // ----------------------------------------------

      if (!gameId) {
        const { data: newGame, error: gameError } =
          await supabase
            .from("games")
            .insert({
              event_id: eventId,
              name: "Викторина",
              type: "quiz",
              status: "waiting",
              current_question_id: null,
            })
            .select()
            .single();

        if (gameError || !newGame) {
          throw new Error(
            gameError?.message ||
              "Не удалось создать игру"
          );
        }

        gameId = newGame.id;
        setGame(newGame);
      }

      // ----------------------------------------------
      // CREATE QUESTION
      // ----------------------------------------------

      const {
        data: newQuestion,
        error: questionError,
      } = await supabase
        .from("questions")
        .insert({
          game_id: gameId,
          question: questionText.trim(),
          media_url: null,
          media_type: null,
        })
        .select()
        .single();

      if (questionError || !newQuestion) {
        throw new Error(
          questionError?.message ||
            "Не удалось создать вопрос"
        );
      }

      // ----------------------------------------------
      // CREATE ANSWERS
      // ----------------------------------------------

      const answerRows = answerTexts.map(
        (text, index) => ({
          question_id: newQuestion.id,
          text: text.trim(),
          is_correct: index === correctAnswer,
        })
      );

      const { error: answersError } =
        await supabase
          .from("answers")
          .insert(answerRows);

      if (answersError) {
        throw new Error(
          answersError.message
        );
      }

      // ----------------------------------------------
      // RESET FORM
      // ----------------------------------------------

      setQuestionText("");

      setAnswerTexts([
        "",
        "",
        "",
        "",
      ]);

      setCorrectAnswer(0);

      await loadGame(eventId);
      await loadQuestions(eventId);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Ошибка создания вопроса"
      );
    } finally {
      setCreatingQuestion(false);
    }
  }

  // ==================================================
  // START GAME
  // ==================================================

  async function startGame() {
    if (!eventId) return;

    if (questions.length === 0) {
      setError(
        "Сначала создайте хотя бы один вопрос"
      );
      return;
    }

    setStartingGame(true);
    setError("");

    try {
      const firstQuestion = questions[0];

      // ----------------------------------------------
      // CREATE GAME
      // ----------------------------------------------

      if (!game) {
        const {
          data: newGame,
          error: gameError,
        } = await supabase
          .from("games")
          .insert({
            event_id: eventId,
            name: "Викторина",
            type: "quiz",
            status: "active",
            current_question_id:
              firstQuestion.id,
          })
          .select()
          .single();

        if (gameError || !newGame) {
          throw new Error(
            gameError?.message ||
              "Не удалось запустить игру"
          );
        }

        setGame(newGame);
      }

      // ----------------------------------------------
      // UPDATE EXISTING GAME
      // ----------------------------------------------

      else {
        const {
          data: updatedGame,
          error: updateError,
        } = await supabase
          .from("games")
          .update({
            status: "active",
            current_question_id:
              firstQuestion.id,
          })
          .eq("id", game.id)
          .select()
          .single();

        if (updateError || !updatedGame) {
          throw new Error(
            updateError?.message ||
              "Не удалось запустить игру"
          );
        }

        setGame(updatedGame);
      }

      await loadGame(eventId);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Ошибка запуска игры"
      );
    } finally {
      setStartingGame(false);
    }
  }

  // ==================================================
  // OPEN PUBLIC SCREEN
  // ==================================================

  function openScreen() {
    if (!eventCode) return;

    const screenUrl =
      `${window.location.origin}/?event=${encodeURIComponent(
        eventCode
      )}`;

    window.open(screenUrl, "_blank");
  }

  // ==================================================
  // QUESTION ANSWERS
  // ==================================================

  function getQuestionAnswers(
    questionId: string
  ) {
    return answers.filter(
      (answer) =>
        answer.question_id === questionId
    );
  }

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center">

        <div className="text-center">

          <p className="text-xs tracking-[0.35em] text-[#C8FF3D]">
            MOMENTO HOST
          </p>

          <p className="mt-5 text-zinc-500">
            Загрузка...
          </p>

        </div>

      </main>
    );
  }

  // ==================================================
  // ERROR / EVENT NOT FOUND
  // ==================================================

  if (!eventId) {
    return (
      <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center px-6">

        <div className="text-center">

          <p className="text-red-400">
            {error ||
              "Мероприятие не найдено"}
          </p>

        </div>

      </main>
    );
  }

  // ==================================================
  // JOIN URL
  // ==================================================

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join?code=${encodeURIComponent(
          eventCode
        )}`
      : "";

  // ==================================================
  // MAIN HOST PAGE
  // ==================================================

  return (
    <main className="min-h-screen bg-[#101014] text-white px-6 py-8">

      <div className="max-w-7xl mx-auto">

        {/* ============================================
            HEADER
        ============================================ */}

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">

          <div>

            <p className="text-xs tracking-[0.35em] text-[#C8FF3D]">
              MOMENTO HOST
            </p>

            <h1 className="text-5xl md:text-6xl font-black mt-4 tracking-[-0.04em]">
              {eventName}
            </h1>

            <div className="mt-3 text-sm text-zinc-500">

              Код мероприятия{" "}

              <span className="text-[#C8FF3D] font-bold tracking-widest">
                {eventCode}
              </span>

            </div>

          </div>

          <button
            onClick={openScreen}
            className="rounded-2xl bg-[#C8FF3D] px-7 py-4 font-black text-[#101014] hover:scale-[1.02] transition"
          >
            ОТКРЫТЬ ЭКРАН
          </button>

        </div>

        {/* ============================================
            STATS
        ============================================ */}

        <div className="grid md:grid-cols-3 gap-4 mt-8">

          {/* PLAYERS */}

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">

            <p className="text-xs tracking-[0.2em] text-zinc-500">
              УЧАСТНИКИ
            </p>

            <p className="text-5xl font-black mt-3">
              {players.length}
            </p>

            <p className="text-sm text-zinc-600 mt-2">
              подключено сейчас
            </p>

          </div>

          {/* GAME */}

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">

            <p className="text-xs tracking-[0.2em] text-zinc-500">
              ТЕКУЩАЯ ИГРА
            </p>

            <p className="text-2xl font-black mt-4">
              {game?.name ||
                "Нет игры"}
            </p>

            <p className="text-sm text-zinc-500 mt-2">

              {game?.status ===
              "active"
                ? "Игра идёт"
                : game?.status ===
                  "completed"
                ? "Завершена"
                : "Ожидание"}

            </p>

          </div>

          {/* CONNECTION */}

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">

            <p className="text-xs tracking-[0.2em] text-zinc-500">
              СОЕДИНЕНИЕ
            </p>

            <p className="text-2xl font-black text-[#C8FF3D] mt-4">
              ● LIVE
            </p>

            <p className="text-sm text-zinc-500 mt-2">
              Realtime подключен
            </p>

          </div>

        </div>

        {/* ============================================
            QR + PLAYERS
        ============================================ */}

        <div className="grid lg:grid-cols-[260px_1fr] gap-6 mt-6">

          {/* QR */}

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 flex flex-col items-center">

            <p className="text-xs tracking-[0.2em] text-zinc-500 mb-5">
              QR-КОД ДЛЯ ГОСТЕЙ
            </p>

            {joinUrl && (
              <div className="bg-white p-4 rounded-2xl">

                <QRCodeSVG
                  value={joinUrl}
                  size={180}
                  level="H"
                />

              </div>
            )}

            <p className="text-xs text-zinc-600 text-center mt-5">
              Гости сканируют этот QR-код
            </p>

            <p className="text-xs text-zinc-600 mt-5">
              КОД
            </p>

            <p className="text-2xl font-black tracking-widest text-[#C8FF3D] mt-2">
              {eventCode}
            </p>

          </div>

          {/* PLAYERS */}

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7">

            <div className="flex items-end justify-between mb-6">

              <div>

                <p className="text-xs tracking-[0.2em] text-zinc-500">
                  ПОДКЛЮЧИВШИЕСЯ ГОСТИ
                </p>

                <p className="text-5xl font-black mt-2">
                  {players.length}
                </p>

              </div>

              <div className="text-[#C8FF3D] text-xs">
                ● LIVE
              </div>

            </div>

            {players.length ===
            0 ? (

              <div className="py-16 text-center text-zinc-600">
                Пока никто не подключился
              </div>

            ) : (

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

                {players.map(
                  (player, index) => (

                    <div
                      key={player.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                    >

                      <div className="text-[#C8FF3D] text-xs">
                        #{index + 1}
                      </div>

                      <div className="font-bold text-lg mt-2">
                        {player.name}
                      </div>

                      {player.table_number && (
                        <div className="text-zinc-500 text-sm mt-1">
                          Стол{" "}
                          {player.table_number}
                        </div>
                      )}

                    </div>

                  )
                )}

              </div>

            )}

          </div>

        </div>

        {/* ============================================
            GAME MANAGEMENT
        ============================================ */}

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 mt-6">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

            <div>

              <p className="text-xs tracking-[0.2em] text-zinc-500">
                УПРАВЛЕНИЕ ИГРОЙ
              </p>

              <h2 className="text-3xl font-black mt-2">
                Викторина
              </h2>

              <p className="text-zinc-500 mt-2">
                Вопросов создано:{" "}
                {questions.length}
              </p>

            </div>

            <button
              onClick={startGame}
              disabled={
                startingGame ||
                questions.length ===
                  0 ||
                game?.status ===
                  "active"
              }
              className="rounded-2xl bg-[#C8FF3D] px-7 py-4 font-black text-[#101014] disabled:opacity-30"
            >

              {game?.status ===
              "active"
                ? "ИГРА ИДЁТ"
                : startingGame
                ? "ЗАПУСКАЕМ..."
                : "НАЧАТЬ ИГРУ"}

            </button>

          </div>

        </div>

        {/* ============================================
            CREATE QUESTION
        ============================================ */}

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 mt-6">

          <p className="text-xs tracking-[0.2em] text-zinc-500">
            СОЗДАНИЕ ВОПРОСА
          </p>

          <h2 className="text-2xl font-black mt-2">
            Новый вопрос
          </h2>

          <textarea
            value={questionText}
            onChange={(e) =>
              setQuestionText(
                e.target.value
              )
            }
            placeholder="Например: В каком году появился MOMENTO?"
            className="w-full min-h-[120px] mt-6 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 outline-none resize-none placeholder:text-zinc-700 focus:border-[#C8FF3D]"
          />

          {/* ANSWERS */}

          <div className="grid md:grid-cols-2 gap-4 mt-4">

            {answerTexts.map(
              (answer, index) => (

                <div
                  key={index}
                  className="flex gap-3 items-center"
                >

                  <button
                    type="button"
                    onClick={() =>
                      setCorrectAnswer(
                        index
                      )
                    }
                    className={`w-12 h-12 rounded-xl border font-black shrink-0 transition ${
                      correctAnswer ===
                      index
                        ? "bg-[#C8FF3D] text-[#101014] border-[#C8FF3D]"
                        : "border-white/10 bg-white/[0.04] text-zinc-500"
                    }`}
                  >
                    {String.fromCharCode(
                      65 + index
                    )}
                  </button>

                  <input
                    value={answer}
                    onChange={(e) => {

                      const updated =
                        [
                          ...answerTexts,
                        ];

                      updated[index] =
                        e.target.value;

                      setAnswerTexts(
                        updated
                      );

                    }}
                    placeholder={`Вариант ${String.fromCharCode(
                      65 + index
                    )}`}
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 outline-none placeholder:text-zinc-700 focus:border-[#C8FF3D]"
                  />

                </div>

              )
            )}

          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mt-6">

            <p className="text-sm text-zinc-600">
              Нажмите A / B / C / D,
              чтобы выбрать правильный
              ответ.
            </p>

            <button
              type="button"
              onClick={createQuestion}
              disabled={
                creatingQuestion
              }
              className="rounded-2xl border border-[#C8FF3D] px-7 py-4 font-black text-[#C8FF3D] hover:bg-[#C8FF3D] hover:text-[#101014] transition disabled:opacity-30"
            >

              {creatingQuestion
                ? "СОЗДАЁМ..."
                : "ДОБАВИТЬ ВОПРОС"}

            </button>

          </div>

        </div>

        {/* ============================================
            QUESTIONS LIST
        ============================================ */}

        {questions.length > 0 && (

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 mt-6">

            <p className="text-xs tracking-[0.2em] text-zinc-500">
              ВОПРОСЫ ИГРЫ
            </p>

            <div className="mt-5 space-y-3">

              {questions.map(
                (question, index) => {

                  const questionAnswers =
                    getQuestionAnswers(
                      question.id
                    );

                  const isCurrent =
                    game?.current_question_id ===
                    question.id;

                  return (
                    <div
                      key={
                        question.id
                      }
                      className={`rounded-2xl border p-5 ${
                        isCurrent
                          ? "border-[#C8FF3D]/40 bg-[#C8FF3D]/5"
                          : "border-white/10 bg-white/[0.02]"
                      }`}
                    >

                      <div className="flex items-start gap-4">

                        <div className="text-[#C8FF3D] font-black">
                          #{index + 1}
                        </div>

                        <div className="flex-1">

                          <div className="font-bold text-lg">
                            {
                              question.question
                            }
                          </div>

                          <div className="grid md:grid-cols-2 gap-2 mt-4">

                            {questionAnswers.map(
                              (answer) => (

                                <div
                                  key={
                                    answer.id
                                  }
                                  className={`rounded-xl px-4 py-3 text-sm ${
                                    answer.is_correct
                                      ? "bg-[#C8FF3D]/10 text-[#C8FF3D]"
                                      : "bg-white/[0.03] text-zinc-500"
                                  }`}
                                >

                                  {
                                    answer.text
                                  }

                                  {answer.is_correct && (
                                    <span className="ml-2">
                                      ✓
                                    </span>
                                  )}

                                </div>

                              )
                            )}

                          </div>

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          </div>

        )}

        {/* ============================================
            ERROR
        ============================================ */}

        {error && (

          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-red-400">
            {error}
          </div>

        )}

        {/* FOOTER */}

        <div className="text-center mt-10 text-xs tracking-[0.3em] text-zinc-700">
          YOUR EVENT. YOUR MOMENTS.
        </div>

      </div>

    </main>
  );
}

// ======================================================
// PAGE WRAPPER WITH SUSPENSE
// ======================================================

export default function HostPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#101014] text-white flex items-center justify-center">

          <div className="text-center">

            <p className="text-xs tracking-[0.35em] text-[#C8FF3D]">
              MOMENTO HOST
            </p>

            <p className="mt-5 text-zinc-500">
              Загрузка...
            </p>

          </div>

        </main>
      }
    >
      <HostContent />
    </Suspense>
  );
}