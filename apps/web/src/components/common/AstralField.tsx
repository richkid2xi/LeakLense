import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  color: string;
  glow: string;
  pulsePhase: number;
}

export function AstralField({
  className = "",
  fixed = false,
}: {
  className?: string;
  fixed?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = fixed ? window.innerWidth : container.clientWidth || window.innerWidth);
    let height = (canvas.height = fixed ? window.innerHeight : container.clientHeight || window.innerHeight);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Palette: Vibrant electric blue, deep navy, and subtle accent halos that stand out crisply
    const colors = [
      { core: "#1F4FD8", glow: "rgba(31, 79, 216, 0.5)" },
      { core: "#0B2A6F", glow: "rgba(11, 42, 111, 0.4)" },
      { core: "#2563EB", glow: "rgba(37, 99, 235, 0.55)" },
      { core: "#8FB4FF", glow: "rgba(143, 180, 255, 0.6)" },
      { core: "#4F46E5", glow: "rgba(79, 70, 229, 0.45)" },
    ];

    const nodeCount = Math.min(Math.floor((width * height) / 16000), 54);
    const nodes: Node[] = Array.from({ length: Math.max(nodeCount, 28) }, (_, i) => {
      const col = colors[i % colors.length]!;
      const r = i % 5 === 0 ? 5 : i % 2 === 0 ? 3.8 : 2.8;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: prefersReducedMotion ? 0 : (Math.random() - 0.5) * 0.45,
        vy: prefersReducedMotion ? 0 : (Math.random() - 0.5) * 0.45,
        radius: r,
        baseRadius: r,
        color: col.core,
        glow: col.glow,
        pulsePhase: Math.random() * Math.PI * 2,
      };
    });

    let mouseX = -9999;
    let mouseY = -9999;
    let mouseRadius = 180;

    const handlePointerMove = (e: PointerEvent) => {
      if (fixed) {
        mouseX = e.clientX;
        mouseY = e.clientY;
      } else {
        const rect = container.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
      }
    };

    const handlePointerLeave = () => {
      mouseX = -9999;
      mouseY = -9999;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    const handleResize = () => {
      if (!container || !canvas) return;
      width = canvas.width = fixed ? window.innerWidth : container.clientWidth || window.innerWidth;
      height = canvas.height = fixed ? window.innerHeight : container.clientHeight || window.innerHeight;
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    window.addEventListener("resize", handleResize, { passive: true });

    let frame = 0;
    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      // Update positions and handle interactions
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node) continue;

        if (!prefersReducedMotion) {
          node.x += node.vx;
          node.y += node.vy;

          if (node.x < -20) node.x = width + 20;
          if (node.x > width + 20) node.x = -20;
          if (node.y < -20) node.y = height + 20;
          if (node.y > height + 20) node.y = -20;

          // Subtle pulse
          node.pulsePhase += 0.025;
          node.radius = node.baseRadius + Math.sin(node.pulsePhase) * 0.6;
        }

        // Mouse attraction/glow reaction
        const dx = mouseX - node.x;
        const dy = mouseY - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouseRadius) {
          const force = (1 - dist / mouseRadius) * 0.08;
          node.x += dx * force;
          node.y += dy * force;
          node.radius = node.baseRadius + (1 - dist / mouseRadius) * 2.5;

          // Connecting line to cursor
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(mouseX, mouseY);
          ctx.strokeStyle = `rgba(31, 79, 216, ${0.45 * (1 - dist / mouseRadius)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Draw connecting lines between close nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const other = nodes[j];
          if (!other) continue;
          const ndx = other.x - node.x;
          const ndy = other.y - node.y;
          const ndist = Math.sqrt(ndx * ndx + ndy * ndy);
          const maxDist = 125;

          if (ndist < maxDist) {
            const alpha = (1 - ndist / maxDist) * 0.22;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(31, 79, 216, ${alpha})`;
            ctx.lineWidth = 0.85;
            ctx.stroke();
          }
        }

        // Outer glow halo
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 2.8, 0, Math.PI * 2);
        ctx.fillStyle = node.glow;
        ctx.fill();

        // Inner solid core
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // White reflective glint on node center
        ctx.beginPath();
        ctx.arc(node.x - node.radius * 0.25, node.y - node.radius * 0.25, node.radius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [fixed]);

  return (
    <div
      className={`astral-field ${className}`}
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: fixed ? "fixed" : "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
