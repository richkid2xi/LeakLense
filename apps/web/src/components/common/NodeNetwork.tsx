import { useEffect, useRef, useState } from "react";

export interface NodeNetworkProps {
  /**
   * Density multiplier for node count (default: 1.0)
   */
  density?: number;
  /**
   * Color theme:
   * - "light": Ink #0E0E0E nodes & lines on light paper
   * - "dark": Off-white #F3F3F0 nodes & lines on deep blue
   * - "auto": Smooth automatic detection based on underlying page sections (default)
   */
  theme?: "light" | "dark" | "auto";
  /**
   * Enable mouse attraction and click ripple pulses (default: true)
   */
  interactive?: boolean;
  /**
   * Optional custom CSS class name
   */
  className?: string;
}

interface NodeItem {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isBlueAccent: boolean;
  baseOpacity: number;
  dispX: number;
  dispY: number;
}

interface ClickRipple {
  x: number;
  y: number;
  startTime: number;
  duration: number;
  maxRadius: number;
}

interface DebugStats {
  fps: number;
  nodeCount: number;
  connectionCount: number;
  frameTimeMs: number;
  themeRatio: number;
}

export function NodeNetwork({
  density = 1,
  theme = "auto",
  interactive = true,
  className = "",
}: NodeNetworkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Dev-only debug HUD state (toggled by ?netdebug=1 in development)
  const [debugStats, setDebugStats] = useState<DebugStats | null>(null);

  useEffect(() => {
    // Guard against server-side rendering
    if (typeof window === "undefined") return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Check debug mode flag (?netdebug=1)
    const isDev = Boolean(import.meta.env.DEV);
    const showDebug = isDev && new URLSearchParams(window.location.search).get("netdebug") === "1";

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let animId: number | null = null;
    let width = window.innerWidth;
    let height = window.innerHeight;

    // Sizing and DPR setup
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const updateCanvasDimensions = (w: number, h: number) => {
      width = w;
      height = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateCanvasDimensions(window.innerWidth, window.innerHeight);

    // Node Count calculation: ~1 node per 14,000 px, clamped between 28 and 90
    const calculateTargetNodeCount = (w: number, h: number, dens: number) => {
      const calculated = Math.round(((w * h) / 14000) * dens);
      return Math.max(28, Math.min(90, calculated));
    };

    let targetNodeCount = calculateTargetNodeCount(width, height, density);
    let connectionDistance = width < 768 ? 100 : 140;

    // Adaptive performance degradation tracking
    let performanceDegradationLevel = 0; // 0 = normal, 1 = reduced, 2 = static fallback
    const frameTimes: number[] = [];
    let lastPerformanceCheck = performance.now();

    // Spawn nodes
    const createNode = (initX?: number, initY?: number): NodeItem => {
      const angle = Math.random() * Math.PI * 2;
      // Drift speed: max ~12px/s (0.2px per frame at 60fps)
      const speed = 0.07 + Math.random() * 0.12;
      const isBlue = Math.random() < 0.08; // ~8% blue accent nodes
      // Radius: 1.5 - 2.5px
      const radius = 1.5 + Math.random() * 1.0;
      // Node opacity: 25-40% for ink, 45% for blue accent
      const baseOpacity = isBlue ? 0.45 : 0.25 + Math.random() * 0.15;

      return {
        x: initX ?? Math.random() * width,
        y: initY ?? Math.random() * height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius,
        isBlueAccent: isBlue,
        baseOpacity,
        dispX: 0,
        dispY: 0,
      };
    };

    const nodes: NodeItem[] = Array.from({ length: targetNodeCount }, () => createNode());

    // Mouse / Cursor interaction state
    let mouseX = -9999;
    let mouseY = -9999;
    let mouseActive = false;
    let mouseFade = 0; // 0 to 1 smooth fade for cursor line and attraction

    // Click / Tap pulse state
    let activeRipple: ClickRipple | null = null;

    // Theme transition state: 0 = Light (#0E0E0E), 1 = Dark / Deep Blue (#F3F3F0)
    let currentThemeRatio = theme === "dark" ? 1 : 0;
    let targetThemeRatio = theme === "dark" ? 1 : 0;

    // Section-aware auto theme detection
    const updateAutoTheme = () => {
      if (theme !== "auto") {
        targetThemeRatio = theme === "dark" ? 1 : 0;
        return;
      }

      // Check dark background sections in the DOM
      const darkSections = document.querySelectorAll(
        '.blue-band, [data-theme="dark"], .process, footer'
      );

      if (darkSections.length === 0) {
        targetThemeRatio = 0;
        return;
      }

      const viewportTop = 0;
      const viewportBottom = window.innerHeight;
      const viewportHeight = window.innerHeight || 1;
      let darkCoveragePixels = 0;

      for (let i = 0; i < darkSections.length; i++) {
        const el = darkSections[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();

        // Calculate overlap with current viewport
        const overlapTop = Math.max(viewportTop, rect.top);
        const overlapBottom = Math.min(viewportBottom, rect.bottom);

        if (overlapBottom > overlapTop) {
          darkCoveragePixels += overlapBottom - overlapTop;
        }
      }

      targetThemeRatio = Math.min(1, Math.max(0, darkCoveragePixels / (viewportHeight * 0.7)));
    };

    // Initial theme check
    updateAutoTheme();

    // Mouse listeners on window
    const handlePointerMove = (e: PointerEvent) => {
      // Ignore touch moves if interactive is disabled
      if (!interactive) return;

      // On touch devices, do not track hover attraction while dragging/scrolling
      if (e.pointerType === "touch") {
        return;
      }

      mouseX = e.clientX;
      mouseY = e.clientY;
      mouseActive = true;
    };

    const handlePointerLeave = () => {
      mouseActive = false;
    };

    const handleClick = (e: MouseEvent) => {
      if (!interactive) return;
      activeRipple = {
        x: e.clientX,
        y: e.clientY,
        startTime: performance.now(),
        duration: 600,
        maxRadius: 180,
      };
    };

    // Touch device support: tap pulse without interfering with native scrolling
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let touchMoved = false;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = performance.now();
      touchMoved = false;
      mouseActive = false;
    };

    const handleTouchMove = () => {
      touchMoved = true;
      mouseActive = false;
    };

    const handleTouchEnd = () => {
      if (!touchMoved && interactive) {
        const duration = performance.now() - touchStartTime;
        if (duration < 350) {
          // Subtle tap pulse
          activeRipple = {
            x: touchStartX,
            y: touchStartY,
            startTime: performance.now(),
            duration: 600,
            maxRadius: 160,
          };
        }
      }
      mouseActive = false;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("click", handleClick, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("scroll", updateAutoTheme, { passive: true });

    // Debounced resize handler that rescales node positions smoothly
    let resizeTimer: number | null = null;
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        if (newWidth === 0 || newHeight === 0) return;

        const scaleX = newWidth / width;
        const scaleY = newHeight / height;

        updateCanvasDimensions(newWidth, newHeight);

        // Smoothly rescale existing node coordinates without reseeding
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          if (!n) continue;
          n.x *= scaleX;
          n.y *= scaleY;
        }

        connectionDistance = newWidth < 768 ? 100 : 140;

        // If target node count changes significantly, adjust node array
        const newTargetCount = calculateTargetNodeCount(newWidth, newHeight, density);
        if (newTargetCount > nodes.length) {
          const toAdd = newTargetCount - nodes.length;
          for (let i = 0; i < toAdd; i++) {
            nodes.push(createNode());
          }
        } else if (newTargetCount < nodes.length) {
          nodes.splice(newTargetCount);
        }

        updateAutoTheme();

        // If reduced motion is active, redraw single static frame
        if (prefersReducedMotion) {
          drawStaticFrame();
        }
      }, 100);
    };

    window.addEventListener("resize", handleResize, { passive: true });

    // Spatial Grid for neighbour lookups: O(N) rather than O(N^2)
    const renderFrame = (timestamp: number) => {
      const frameStart = performance.now();

      // Smooth theme fade transition
      currentThemeRatio += (targetThemeRatio - currentThemeRatio) * 0.08;

      // Mouse fade in / fade out
      if (mouseActive) {
        mouseFade = Math.min(1, mouseFade + 0.1);
      } else {
        mouseFade = Math.max(0, mouseFade - 0.06);
      }

      ctx.clearRect(0, 0, width, height);

      // Ripple progress
      let rippleWavefront = 0;
      let rippleIntensity = 0;
      if (activeRipple) {
        const elapsed = timestamp - activeRipple.startTime;
        if (elapsed < activeRipple.duration) {
          const progress = elapsed / activeRipple.duration;
          rippleWavefront = progress * activeRipple.maxRadius;
          rippleIntensity = 1 - progress;
        } else {
          activeRipple = null;
        }
      }

      // 1. Update node physics & mouse attraction
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node) continue;

        // Drift motion
        node.x += node.vx;
        node.y += node.vy;

        // Gentle edge wrapping with 20px padding
        const pad = 20;
        if (node.x < -pad) node.x = width + pad;
        if (node.x > width + pad) node.x = -pad;
        if (node.y < -pad) node.y = height + pad;
        if (node.y > height + pad) node.y = -pad;

        // Subtle click ripple outward nudge
        if (activeRipple && rippleIntensity > 0) {
          const rdx = node.x - activeRipple.x;
          const rdy = node.y - activeRipple.y;
          const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
          const waveDist = Math.abs(rdist - rippleWavefront);
          if (waveDist < 35 && rdist > 0.01) {
            const nudgeForce = (1 - waveDist / 35) * rippleIntensity * 1.8;
            node.x += (rdx / rdist) * nudgeForce;
            node.y += (rdy / rdist) * nudgeForce;
          }
        }

        // Mouse soft spring attraction
        if (interactive && mouseFade > 0.01) {
          const mdx = mouseX - node.x;
          const mdy = mouseY - node.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          const mouseThreshold = 160;

          if (mdist < mouseThreshold && mdist > 1) {
            const pullFactor = (1 - mdist / mouseThreshold) * mouseFade;
            // Target displacement: subtle soft spring, never snapping (max 18px)
            const targetDispX = (mdx / mdist) * pullFactor * 18;
            const targetDispY = (mdy / mdist) * pullFactor * 18;
            node.dispX += (targetDispX - node.dispX) * 0.12;
            node.dispY += (targetDispY - node.dispY) * 0.12;
          } else {
            // Smoothly ease back to zero displacement
            node.dispX *= 0.92;
            node.dispY *= 0.92;
          }
        } else {
          node.dispX *= 0.9;
          node.dispY *= 0.9;
        }
      }

      // 2. Spatial Grid Partitioning for Neighbour Connections
      const cellSize = connectionDistance;
      const cols = Math.max(1, Math.ceil(width / cellSize));
      const rows = Math.max(1, Math.ceil(height / cellSize));
      const grid: number[][] = Array.from({ length: cols * rows }, () => []);

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node) continue;
        const posX = node.x + node.dispX;
        const posY = node.y + node.dispY;
        const col = Math.max(0, Math.min(cols - 1, Math.floor(posX / cellSize)));
        const row = Math.max(0, Math.min(rows - 1, Math.floor(posY / cellSize)));
        grid[row * cols + col]?.push(i);
      }

      // Interpolate line & node colors based on currentThemeRatio (0 = Light, 1 = Dark)
      // Light: #0E0E0E (14, 14, 14), Dark: #F3F3F0 (243, 243, 240)
      const baseR = Math.round(14 + (243 - 14) * currentThemeRatio);
      const baseG = Math.round(14 + (243 - 14) * currentThemeRatio);
      const baseB = Math.round(14 + (240 - 14) * currentThemeRatio);

      // Blue accent color transition: #1F4FD8 (31, 79, 216) -> off-white on dark
      const blueR = Math.round(31 + (243 - 31) * currentThemeRatio);
      const blueG = Math.round(79 + (243 - 79) * currentThemeRatio);
      const blueB = Math.round(216 + (240 - 216) * currentThemeRatio);

      // 3. Batched Line Drawing by Opacity Buckets
      // 5 quantized opacity buckets: 0.03, 0.06, 0.10, 0.14, 0.18
      const bucketThresholds = [0.03, 0.06, 0.1, 0.14, 0.18];
      const buckets: [number, number, number, number][][] = Array.from(
        { length: bucketThresholds.length },
        () => []
      );

      let totalConnections = 0;

      // Offsets to inspect neighbour cells without duplicates
      const neighborOffsets = [
        [0, 0], // same cell
        [1, 0], // right
        [-1, 1], // bottom-left
        [0, 1], // bottom
        [1, 1], // bottom-right
      ];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cellIndex = r * cols + c;
          const cellNodes = grid[cellIndex];
          if (!cellNodes || cellNodes.length === 0) continue;

          for (let oi = 0; oi < neighborOffsets.length; oi++) {
            const offset = neighborOffsets[oi];
            if (!offset) continue;
            const nc = c + offset[0]!;
            const nr = r + offset[1]!;

            if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;

            const nCellIndex = nr * cols + nc;
            const nCellNodes = grid[nCellIndex];
            if (!nCellNodes || nCellNodes.length === 0) continue;

            const isSameCell = nCellIndex === cellIndex;

            for (let i = 0; i < cellNodes.length; i++) {
              const nodeIdx1 = cellNodes[i];
              if (nodeIdx1 === undefined) continue;
              const n1 = nodes[nodeIdx1];
              if (!n1) continue;

              const x1 = n1.x + n1.dispX;
              const y1 = n1.y + n1.dispY;

              const startIndex = isSameCell ? i + 1 : 0;

              for (let j = startIndex; j < nCellNodes.length; j++) {
                const nodeIdx2 = nCellNodes[j];
                if (nodeIdx2 === undefined) continue;
                const n2 = nodes[nodeIdx2];
                if (!n2) continue;

                const x2 = n2.x + n2.dispX;
                const y2 = n2.y + n2.dispY;

                const dx = x2 - x1;
                const dy = y2 - y1;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < connectionDistance) {
                  // Opacity fading from 0.18 down to 0 at the threshold
                  let alpha = 0.18 * (1 - dist / connectionDistance);

                  // Subtle ripple brightening near click pulse
                  if (activeRipple && rippleIntensity > 0) {
                    const midX = (x1 + x2) * 0.5;
                    const midY = (y1 + y2) * 0.5;
                    const rdx = midX - activeRipple.x;
                    const rdy = midY - activeRipple.y;
                    const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
                    if (rdist < activeRipple.maxRadius) {
                      alpha = Math.min(0.28, alpha + (1 - rdist / activeRipple.maxRadius) * 0.08);
                    }
                  }

                  // Find closest opacity bucket
                  let bucketIndex = 0;
                  for (let b = bucketThresholds.length - 1; b >= 0; b--) {
                    const threshold = bucketThresholds[b]!;
                    if (alpha >= threshold * 0.75) {
                      bucketIndex = b;
                      break;
                    }
                  }

                  buckets[bucketIndex]?.push([x1, y1, x2, y2]);
                  totalConnections++;
                }
              }
            }
          }
        }
      }

      // Draw lines in batches per bucket
      ctx.lineWidth = 1;
      for (let b = 0; b < buckets.length; b++) {
        const segs = buckets[b];
        if (!segs || segs.length === 0) continue;

        const alpha = bucketThresholds[b] ?? 0.05;
        ctx.beginPath();
        for (let s = 0; s < segs.length; s++) {
          const seg = segs[s];
          if (!seg) continue;
          ctx.moveTo(seg[0], seg[1]);
          ctx.lineTo(seg[2], seg[3]);
        }
        ctx.strokeStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${alpha})`;
        ctx.stroke();
      }

      // 4. Mouse connecting lines (up to 0.35 opacity)
      if (interactive && mouseFade > 0.01) {
        ctx.beginPath();
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (!node) continue;
          const px = node.x + node.dispX;
          const py = node.y + node.dispY;
          const mdx = mouseX - px;
          const mdy = mouseY - py;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

          if (mdist < 160) {
            const lineAlpha = 0.35 * (1 - mdist / 160) * mouseFade;
            ctx.moveTo(px, py);
            ctx.lineTo(mouseX, mouseY);
            ctx.strokeStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${lineAlpha})`;
            ctx.stroke();
            ctx.beginPath();
          }
        }
      }

      // 5. Draw Nodes (small circles, 1.5-2.5px radius, no glow, crisp rendering)
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node) continue;

        const px = node.x + node.dispX;
        const py = node.y + node.dispY;

        ctx.beginPath();
        ctx.arc(px, py, node.radius, 0, Math.PI * 2);

        if (node.isBlueAccent && currentThemeRatio < 0.6) {
          ctx.fillStyle = `rgba(${blueR}, ${blueG}, ${blueB}, ${node.baseOpacity})`;
        } else {
          ctx.fillStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${node.baseOpacity})`;
        }
        ctx.fill();
      }

      const frameEnd = performance.now();
      const frameDuration = frameEnd - frameStart;

      // 6. Adaptive Performance Monitoring
      frameTimes.push(frameDuration);
      if (frameTimes.length > 60) frameTimes.shift();

      if (timestamp - lastPerformanceCheck > 1200) {
        lastPerformanceCheck = timestamp;
        const avgFrame = frameTimes.reduce((a, b) => a + b, 0) / (frameTimes.length || 1);

        // If average frame exceeds 20ms (> 50fps drop), adaptively throttle
        if (avgFrame > 20 && performanceDegradationLevel === 0) {
          performanceDegradationLevel = 1;
          // Reduce node count by 25% and connection distance
          const reducedCount = Math.floor(nodes.length * 0.75);
          nodes.splice(reducedCount);
          connectionDistance = Math.round(connectionDistance * 0.85);
        } else if (avgFrame > 22 && performanceDegradationLevel === 1) {
          // If still struggling, fallback to single static render
          performanceDegradationLevel = 2;
          drawStaticFrame();
          return;
        }

        // Update dev-only debug HUD
        if (showDebug) {
          setDebugStats({
            fps: Math.round(1000 / Math.max(16.6, avgFrame)),
            nodeCount: nodes.length,
            connectionCount: totalConnections,
            frameTimeMs: Math.round(avgFrame * 10) / 10,
            themeRatio: Math.round(currentThemeRatio * 100) / 100,
          });
        }
      }

      animId = requestAnimationFrame(renderFrame);
    };

    // Static fallback frame for prefers-reduced-motion or extreme performance constraints
    const drawStaticFrame = () => {
      ctx.clearRect(0, 0, width, height);

      const baseR = theme === "dark" ? 243 : 14;
      const baseG = theme === "dark" ? 243 : 14;
      const baseB = theme === "dark" ? 240 : 14;

      // Draw connection lines
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        if (!n1) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          if (!n2) continue;
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDistance) {
            const alpha = 0.14 * (1 - dist / connectionDistance);
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node) continue;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.isBlueAccent && theme !== "dark"
          ? `rgba(31, 79, 216, ${node.baseOpacity})`
          : `rgba(${baseR}, ${baseG}, ${baseB}, ${node.baseOpacity})`;
        ctx.fill();
      }
    };

    // Pause loop when tab is hidden or canvas is offscreen
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animId !== null) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      } else {
        if (!prefersReducedMotion && performanceDegradationLevel < 2 && animId === null) {
          animId = requestAnimationFrame(renderFrame);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // IntersectionObserver to pause loop when container is not visible
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (entry.isIntersecting) {
        if (!prefersReducedMotion && performanceDegradationLevel < 2 && animId === null) {
          animId = requestAnimationFrame(renderFrame);
        }
      } else {
        if (animId !== null) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      }
    });

    observer.observe(container);

    // Initial start: animate or static render based on motion preference
    if (prefersReducedMotion) {
      drawStaticFrame();
    } else {
      animId = requestAnimationFrame(renderFrame);
    }

    return () => {
      if (animId !== null) cancelAnimationFrame(animId);
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("scroll", updateAutoTheme);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      observer.disconnect();
    };
  }, [density, theme, interactive]);

  return (
    <div
      ref={containerRef}
      className={`node-network-layer ${className}`}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
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
          pointerEvents: "none",
        }}
      />

      {/* Dev-only debug readout (enabled by ?netdebug=1) */}
      {import.meta.env.DEV && debugStats && (
        <div
          style={{
            position: "fixed",
            left: "12px",
            bottom: "12px",
            zIndex: 9999,
            padding: "5px 9px",
            background: "rgba(14, 14, 14, 0.88)",
            color: "#8FB4FF",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "10px",
            borderRadius: "3px",
            border: "1px solid #333",
            lineHeight: 1.4,
            pointerEvents: "none",
          }}
        >
          <div>NODE NETWORK · DEBUG HUD</div>
          <div style={{ color: "#eee" }}>
            FPS: {debugStats.fps} · Nodes: {debugStats.nodeCount} · Conn: {debugStats.connectionCount}
          </div>
          <div style={{ color: "#aaa" }}>
            Frame: {debugStats.frameTimeMs}ms · Dark: {Math.round(debugStats.themeRatio * 100)}%
          </div>
        </div>
      )}
    </div>
  );
}
