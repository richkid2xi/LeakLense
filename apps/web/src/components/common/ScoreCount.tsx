import { useEffect, useState } from "react";

export function ScoreCount({ target }: { target: number }) {
  const [score, setScore] = useState(0);

  useEffect(() => {
    const started = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - started) / duration, 1);
      setScore(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return <>{score}</>;
}
