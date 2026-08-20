"use client";

import { useEffect } from "react";

export function useReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = document.querySelectorAll("[data-reveal]");
    if (reduced) { els.forEach((e) => e.classList.add("visible")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("visible"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

export function useMouseParallax(ref: React.RefObject<HTMLElement | null>, depth = 20) {
  useEffect(() => {
    if (!ref.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let raf = 0;
    const el = ref.current;
    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.querySelectorAll<HTMLElement>("[data-parallax]").forEach((node) => {
          const d = parseFloat(node.dataset.parallax || "1");
          /* Se escriben dos variables, no `transform`: la propiedad entera
             borraba la inclinación 3D del panel en el primer movimiento del
             ratón, y en las fichas con animación de deriva ni siquiera se
             aplicaba (una animación gana a un estilo en línea). Cada hoja
             compone `--px`/`--py` con lo suyo. */
          node.style.setProperty("--px", `${dx * depth * d}px`);
          node.style.setProperty("--py", `${dy * depth * d}px`);
        });
      });
    };
    window.addEventListener("mousemove", handler);
    return () => { window.removeEventListener("mousemove", handler); cancelAnimationFrame(raf); };
  }, [ref, depth]);
}
