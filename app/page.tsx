"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Cell = {
  id: string;
  yards: number;
  cleared: boolean;
};

type Phase = "start" | "loading" | "game";

const STORAGE_KEY = "yard-bingo-state";
const CELL_COUNT = 9;
const RANGE_MIN_RATIO = 0.7;
const RANGE_MAX_RATIO = 1.2;
const TARGET_MIN_GAP = 10;
const HIT_RANGE = 2;
const MAX_PRIZE_BINGOS = 3;
const BINGO_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function generateTargets(baseYards: number) {
  const min = Math.ceil(baseYards * RANGE_MIN_RATIO);
  const max = Math.floor(baseYards * RANGE_MAX_RATIO);
  const span = max - min;
  const gap = Math.min(TARGET_MIN_GAP, Math.max(1, Math.floor(span / (CELL_COUNT - 1))));
  const maxStart = max - gap * (CELL_COUNT - 1);
  const start = Math.floor(Math.random() * (maxStart - min + 1)) + min;

  return shuffle(Array.from({ length: CELL_COUNT }, (_, index) => start + index * gap));
}

function getPrize(bingoCount: number) {
  if (bingoCount === 1) return "ドリンク代免除！";
  if (bingoCount === 2) return "ゴルフ場代免除！";
  if (bingoCount === 3) return "飲み代免除！";
  return "特別賞！";
}

function getBingoMessage(bingoCount: number) {
  return `${bingoCount}回目のビンゴ達成！${getPrize(bingoCount)}`;
}

function getCompletedLineKeys(cells: Cell[]) {
  return BINGO_LINES.filter((line) => line.every((index) => cells[index]?.cleared)).map((line) =>
    line.join("-")
  );
}

function findNewBingos(cells: Cell[], announcedLines: string[]) {
  const announced = new Set(announcedLines);
  return getCompletedLineKeys(cells).filter((lineKey) => !announced.has(lineKey));
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("start");
  const [baseYards, setBaseYards] = useState("");
  const [cells, setCells] = useState<Cell[]>([]);
  const [confirmCell, setConfirmCell] = useState<Cell | null>(null);
  const [announcedLines, setAnnouncedLines] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  const clearedCount = useMemo(
    () => cells.filter((cell) => cell.cleared).length,
    [cells]
  );
  const bingoMessages = announcedLines.map((_, index) => getBingoMessage(index + 1));

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          baseYards: string;
          cells: Cell[];
          announcedLines: string[];
        };
        if (parsed.cells?.length === CELL_COUNT) {
          setBaseYards(parsed.baseYards ?? "");
          setCells(parsed.cells);
          setAnnouncedLines((parsed.announcedLines ?? []).slice(0, MAX_PRIZE_BINGOS));
          setPhase("game");
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;

    if (cells.length === CELL_COUNT) {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ baseYards, cells, announcedLines })
      );
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [announcedLines, baseYards, cells, hasLoaded]);

  const startGame = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const base = Number(baseYards);

    if (!Number.isFinite(base) || base < 30 || base > 400) {
      setError("30〜400yd の間で入力してください");
      return;
    }

    setError("");
    setPhase("loading");
    setTimeout(() => {
      const targets = generateTargets(base);
      setCells(
        targets.map((yards, index) => ({
          id: `${Date.now()}-${index}-${yards}`,
          yards,
          cleared: false
        }))
      );
      setAnnouncedLines([]);
      setPhase("game");
    }, 1000);
  };

  const clearCell = () => {
    if (!confirmCell) return;

    const nextCells = cells.map((cell) =>
      cell.id === confirmCell.id ? { ...cell, cleared: true } : cell
    );
    const nextBingos = findNewBingos(nextCells, announcedLines);

    setCells(nextCells);
    setConfirmCell(null);

    if (nextBingos.length) {
      setAnnouncedLines((current) => {
        if (current.length >= MAX_PRIZE_BINGOS) return current;

        return [...current, ...nextBingos].slice(0, MAX_PRIZE_BINGOS);
      });
    }
  };

  const undoClearCell = () => {
    if (!confirmCell) return;

    const nextCells = cells.map((cell) =>
      cell.id === confirmCell.id ? { ...cell, cleared: false } : cell
    );
    const stillCompleted = new Set(getCompletedLineKeys(nextCells));

    setCells(nextCells);
    setConfirmCell(null);
    setAnnouncedLines((current) => current.filter((lineKey) => stillCompleted.has(lineKey)));
  };

  const resetGame = () => {
    setPhase("start");
    setBaseYards("");
    setCells([]);
    setConfirmCell(null);
    setAnnouncedLines([]);
    setError("");
    window.localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <main className="app-shell">
      <div className="course-glow" aria-hidden="true" />

      {phase === "start" && (
        <section className="screen start-screen">
          <div className="brand-badge">Driving Range Game</div>
          <h1>ギャンブルゴルフ</h1>
          <p className="lead">最初の1球を元にビンゴを作成するよ！</p>

          <form className="start-form" onSubmit={startGame}>
            <label htmlFor="base-yards">最初の球のヤード</label>
            <div className="input-row">
              <input
                id="base-yards"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                value={baseYards}
                onChange={(event) => setBaseYards(event.target.value.replace(/\D/g, ""))}
              />
              <span>yd</span>
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="primary-button" type="submit">
              ビンゴを作る
            </button>
          </form>
        </section>
      )}

      {phase === "loading" && (
        <section className="screen loading-screen" aria-live="polite">
          <div className="loading-track">
            <div className="golf-ball" />
          </div>
          <h2>ビンゴ生成中...</h2>
          <p>風向きとノリを読みながら、ねらい目をセットしています。</p>
        </section>
      )}

      {phase === "game" && (
        <section className="screen game-screen">
          <header className="game-header">
            <div>
              <p className="eyebrow">Base {baseYards} yd</p>
              <h2>狙って、当てて、BINGO!</h2>
            </div>
            <div className="score-pill">{clearedCount}/9</div>
          </header>

          <div className="bingo-card" aria-label="ヤードビンゴカード">
            {cells.map((cell, index) => (
              <button
                className={`bingo-cell ${cell.cleared ? "is-cleared" : ""}`}
                key={cell.id}
                type="button"
                onClick={() => {
                  setConfirmCell(cell);
                }}
                aria-pressed={cell.cleared}
              >
                <span className="cell-index">{index + 1}</span>
                <strong>{cell.yards}</strong>
                <span>yd</span>
                <small>{cell.yards - HIT_RANGE}〜{cell.yards + HIT_RANGE}yd</small>
                {cell.cleared && <b aria-hidden="true">✓</b>}
              </button>
            ))}
          </div>

          <div className="game-actions">
            {bingoMessages.length > 0 && (
              <div className="bingo-banners" role="status" aria-live="polite">
                {bingoMessages.map((message) => (
                  <div className="bingo-banner" key={message}>
                    {message}
                  </div>
                ))}
              </div>
            )}

            <button className="secondary-button" type="button" onClick={resetGame}>
              最初からやり直す
            </button>
          </div>
        </section>
      )}

      {confirmCell && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <p className="dialog-kicker">Nice shot?</p>
            <h3 id="confirm-title">
              {confirmCell.cleared ? "このマスのクリアを戻しますか？" : "このマスをクリアにしますか？"}
            </h3>
            <p className="target-yards">{confirmCell.yards} yd</p>
            <p className="hit-range">
              クリア範囲: {confirmCell.yards - HIT_RANGE}〜{confirmCell.yards + HIT_RANGE}yd
            </p>
            <div className="dialog-actions">
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setConfirmCell(null);
                }}
              >
                キャンセル
              </button>
              <button
                className="confirm-button"
                type="button"
                onClick={confirmCell.cleared ? undoClearCell : clearCell}
              >
                {confirmCell.cleared ? "戻す" : "クリア"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
