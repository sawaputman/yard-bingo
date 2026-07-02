"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Cell = {
  id: string;
  yards: number;
  cleared: boolean;
};

type Phase = "start" | "loading" | "game";

type BingoResult = {
  line: number[];
  prize: string;
} | null;

const STORAGE_KEY = "yard-bingo-state";
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
  const min = Math.ceil(baseYards * 0.8);
  const max = Math.floor(baseYards * 1.2);
  const span = max - min;
  const gap = Math.min(10, Math.max(1, Math.floor(span / 8)));
  const values: number[] = [];
  let attempts = 0;

  while (values.length < 9 && attempts < 5000) {
    attempts += 1;
    const candidate = Math.floor(Math.random() * (max - min + 1)) + min;
    const farEnough = values.every((value) => Math.abs(value - candidate) >= gap);

    if (farEnough) {
      values.push(candidate);
    }
  }

  if (values.length < 9) {
    for (let value = min; value <= max && values.length < 9; value += gap) {
      if (values.every((target) => Math.abs(target - value) >= gap)) {
        values.push(value);
      }
    }
  }

  return shuffle(values).slice(0, 9);
}

function getPrize(line: number[]) {
  const horizontalIndex = BINGO_LINES.findIndex(
    (candidateLine) => candidateLine.join(",") === line.join(",")
  );

  if (horizontalIndex === 0) return "ドリンク代免除！";
  if (horizontalIndex === 1) return "ゴルフ場代免除！";
  if (horizontalIndex === 2) return "飲み代免除！";
  return "特別賞！";
}

function findBingo(cells: Cell[], announcedLines: string[]) {
  const announced = new Set(announcedLines);
  const completedLine = BINGO_LINES.find((line) => {
    const key = line.join("-");
    return !announced.has(key) && line.every((index) => cells[index]?.cleared);
  });

  if (!completedLine) return null;

  return {
    line: completedLine,
    prize: getPrize(completedLine)
  };
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("start");
  const [baseYards, setBaseYards] = useState("");
  const [cells, setCells] = useState<Cell[]>([]);
  const [confirmCell, setConfirmCell] = useState<Cell | null>(null);
  const [bingo, setBingo] = useState<BingoResult>(null);
  const [announcedLines, setAnnouncedLines] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  const clearedCount = useMemo(
    () => cells.filter((cell) => cell.cleared).length,
    [cells]
  );

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          baseYards: string;
          cells: Cell[];
          announcedLines: string[];
        };
        if (parsed.cells?.length === 9) {
          setBaseYards(parsed.baseYards ?? "");
          setCells(parsed.cells);
          setAnnouncedLines(parsed.announcedLines ?? []);
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

    if (cells.length === 9) {
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
      setBingo(null);
      setPhase("game");
    }, 1000);
  };

  const clearCell = () => {
    if (!confirmCell) return;

    const nextCells = cells.map((cell) =>
      cell.id === confirmCell.id ? { ...cell, cleared: true } : cell
    );
    const nextBingo = findBingo(nextCells, announcedLines);

    setCells(nextCells);
    setConfirmCell(null);

    if (nextBingo) {
      setAnnouncedLines((current) => [...current, nextBingo.line.join("-")]);
      setBingo(nextBingo);
    }
  };

  const resetGame = () => {
    setPhase("start");
    setBaseYards("");
    setCells([]);
    setConfirmCell(null);
    setBingo(null);
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
          <h1>ヤードビンゴ</h1>
          <p className="lead">最初の1球を基準に、今日のねらい目を9マスで遊ぼう。</p>

          <form className="start-form" onSubmit={startGame}>
            <label htmlFor="base-yards">最初の球のヤード</label>
            <div className="input-row">
              <input
                id="base-yards"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="150"
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
                onClick={() => !cell.cleared && setConfirmCell(cell)}
                aria-pressed={cell.cleared}
              >
                <span className="cell-index">{index + 1}</span>
                <strong>{cell.yards}</strong>
                <span>yd</span>
                {cell.cleared && <b aria-hidden="true">✓</b>}
              </button>
            ))}
          </div>

          <button className="secondary-button" type="button" onClick={resetGame}>
            最初からやり直す
          </button>
        </section>
      )}

      {confirmCell && (
        <div className="modal-backdrop" role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <p className="dialog-kicker">Nice shot?</p>
            <h3 id="confirm-title">このマスをクリアにしますか？</h3>
            <p className="target-yards">{confirmCell.yards} yd</p>
            <div className="dialog-actions">
              <button className="ghost-button" type="button" onClick={() => setConfirmCell(null)}>
                キャンセル
              </button>
              <button className="confirm-button" type="button" onClick={clearCell}>
                クリア
              </button>
            </div>
          </div>
        </div>
      )}

      {bingo && (
        <div className="modal-backdrop celebration" role="presentation">
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, index) => (
              <i key={index} />
            ))}
          </div>
          <div className="dialog bingo-modal" role="dialog" aria-modal="true">
            <p className="dialog-kicker">Perfect line</p>
            <h3>BINGO!</h3>
            <p className="prize-text">{bingo.prize}</p>
            <button className="primary-button" type="button" onClick={resetGame}>
              もう一度遊ぶ
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
