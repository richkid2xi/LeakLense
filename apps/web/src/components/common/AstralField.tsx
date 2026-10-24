import { useEffect, useRef } from "react";

export function AstralField() {
  const field = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      field.current?.style.setProperty("--mouse-x", x.toFixed(3));
      field.current?.style.setProperty("--mouse-y", y.toFixed(3));
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  const nodes = Array.from({ length: 22 }, (_, i) => ({
    x: (i * 37 + 11) % 96,
    y: (i * 53 + 7) % 82,
    depth: (i % 4) + 1,
    size: i % 7 === 0 ? 4 : i % 3 === 0 ? 3 : 2,
  }));

  return (
    <div className="astral-field" ref={field} aria-hidden="true">
      {nodes.map((node, i) => (
        <i
          key={i}
          style={
            {
              "--node-x": `${node.x}%`,
              "--node-y": `${node.y}%`,
              "--depth": node.depth,
              "--node-size": `${node.size}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
