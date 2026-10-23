console.log("script.js loaded ✅");

document.addEventListener("DOMContentLoaded", () => {
  const hero  = document.querySelector(".hero");
  const hands = document.querySelector(".hands");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!hero || !hands || reduce) return;

  hero.addEventListener("mousemove", (e) => {
    const r = hero.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;   // -1 to 1
    const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;   // -1 to 1
    hands.style.setProperty("--px", (nx * 35).toFixed(1) + "px");
    hands.style.setProperty("--py", (ny * 20).toFixed(1) + "px");
  });

  hero.addEventListener("mouseleave", () => {
    hands.style.setProperty("--px", "0px");
    hands.style.setProperty("--py", "0px");
  });
});