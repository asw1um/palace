/**
 * Motion layer.
 *
 * GSAP  → orchestrated, scroll-driven and layout (FLIP) work.
 * anime.js → snappy element-level effects: staggered grids, counters, pops.
 *
 * Every helper here bails out when the user asked for reduced motion, so no
 * call site has to remember to check.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
import { animate, stagger, utils } from 'animejs';

gsap.registerPlugin(ScrollTrigger, Flip);

export { gsap, ScrollTrigger, Flip, animate, stagger, utils };

export function reducedMotion(): boolean {
  return document.documentElement.dataset.motion === 'reduced';
}

type El = Element | null | undefined;

function list(target: El | El[] | NodeListOf<Element>): Element[] {
  if (!target) return [];
  if (target instanceof Element) return [target];
  return Array.from(target as ArrayLike<Element>).filter(Boolean) as Element[];
}

/* -------------------------------------------------------------------------- */
/* anime.js                                                                    */
/* -------------------------------------------------------------------------- */

/** Staggered entrance for a grid/list of cards. */
export function staggerIn(
  target: El | El[] | NodeListOf<Element>,
  opts: { y?: number; delay?: number; each?: number; scale?: number } = {},
) {
  const els = list(target);
  if (!els.length) return;
  // No frames means the "animate back to visible" half never happens, so skip
  // straight to the end state rather than hiding things indefinitely.
  if (reducedMotion() || document.hidden) {
    utils.set(els, { opacity: 1, translateY: 0, scale: 1 });
    return;
  }
  const { y = 14, delay = 0, each = 32, scale } = opts;
  utils.set(els, { opacity: 0, translateY: y, ...(scale ? { scale } : {}) });
  animate(els, {
    opacity: 1,
    translateY: 0,
    ...(scale ? { scale: 1 } : {}),
    duration: 520,
    ease: 'out(3)',
    delay: stagger(each, { start: delay }),
  });
}

/**
 * Animates a number from 0 → value inside an element.
 *
 * Frames only run when the document is visible, so a counter started in a
 * background tab would otherwise sit at 0 forever. In that case (and under
 * reduced motion) we write the real number straight away and skip the tween.
 */
export function countUp(el: El, value: number, opts: { duration?: number; suffix?: string } = {}) {
  if (!el) return;
  const node = el as HTMLElement;
  const suffix = opts.suffix ?? '';
  const settle = () => {
    node.textContent = `${Math.round(value).toLocaleString()}${suffix}`;
  };

  if (reducedMotion() || document.hidden) {
    settle();
    return;
  }

  const proxy = { n: 0 };
  animate(proxy, {
    n: value,
    duration: opts.duration ?? 900,
    ease: 'out(4)',
    onUpdate: () => {
      node.textContent = `${Math.round(proxy.n).toLocaleString()}${suffix}`;
    },
    // Pin the exact value at the end — rounding during the tween can land short.
    onComplete: settle,
  });
}

/** Small tactile pop — used on toggles, likes, adds. */
export function pop(el: El, scale = 1.18) {
  if (!el || reducedMotion()) return;
  animate(el as Element, {
    scale: [1, scale, 1],
    duration: 380,
    ease: 'outElastic(1, .6)',
  });
}

/** Horizontal shake for invalid input. */
export function shake(el: El) {
  if (!el || reducedMotion()) return;
  animate(el as Element, {
    translateX: [0, -8, 7, -5, 3, 0],
    duration: 420,
    ease: 'outQuad',
  });
}

/* -------------------------------------------------------------------------- */
/* GSAP                                                                        */
/* -------------------------------------------------------------------------- */

/** Fade/slide page content in on route change. */
export function pageIn(scope: El) {
  if (!scope) return;
  if (reducedMotion() || document.hidden) {
    gsap.set((scope as HTMLElement).children, { opacity: 1, y: 0, clearProps: 'all' });
    return;
  }
  gsap.fromTo(
    (scope as HTMLElement).children,
    { opacity: 0, y: 16 },
    {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: 'power3.out',
      stagger: 0.05,
      clearProps: 'transform',
      overwrite: 'auto',
    },
  );
}

/**
 * Reveals `.reveal` elements as they scroll into view inside a scroll container.
 * Returns a cleanup function.
 */
export function revealOnScroll(scroller: HTMLElement | null, scope: HTMLElement | null) {
  if (!scroller || !scope) return () => {};
  const els = Array.from(scope.querySelectorAll<HTMLElement>('.reveal'));
  if (!els.length) return () => {};

  if (reducedMotion()) {
    gsap.set(els, { opacity: 1, y: 0 });
    return () => {};
  }

  const ctx = gsap.context(() => {
    els.forEach((el) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            scroller,
            start: 'top 92%',
            once: true,
          },
        },
      );
    });
  }, scope);

  // Triggers measure the scroller on creation; make sure that happens after the
  // page has actually laid out.
  ScrollTrigger.refresh();

  /*
   * Safety net. A scroll trigger that never fires — because the tab was hidden
   * while the page mounted, because the scroller was still collapsing, because
   * ScrollTrigger failed outright — would leave content invisible with no way
   * back. Content being visible always beats content animating, so anything
   * still transparent shortly after mount is simply shown.
   */
  const failsafe = window.setTimeout(() => {
    els.forEach((el) => {
      if (Number(getComputedStyle(el).opacity) < 0.99) {
        gsap.set(el, { opacity: 1, y: 0, clearProps: 'transform' });
      }
    });
  }, 1200);

  return () => {
    clearTimeout(failsafe);
    ctx.revert();
  };
}

/** FLIP helper: capture → mutate → play. Used when grids re-sort or re-order. */
export function flip(targets: string | Element[], mutate: () => void, duration = 0.45) {
  if (reducedMotion()) {
    mutate();
    return;
  }
  const state = Flip.getState(targets);
  mutate();
  Flip.from(state, { duration, ease: 'power2.inOut', absolute: true, stagger: 0.02 });
}

/** Slides the sidebar rail to the active nav item. */
export function moveRail(rail: HTMLElement | null, target: HTMLElement | null, first = false) {
  if (!rail || !target) return;
  const parent = rail.offsetParent as HTMLElement | null;
  if (!parent) return;
  const top = target.offsetTop + target.offsetHeight / 2 - 10;
  if (first || reducedMotion()) {
    gsap.set(rail, { y: top, opacity: 1 });
    return;
  }
  gsap.to(rail, { y: top, opacity: 1, duration: 0.42, ease: 'power3.out' });
}

/** Slides the tab underline. */
export function moveInk(ink: HTMLElement | null, target: HTMLElement | null, first = false) {
  if (!ink || !target) return;
  const vars = { x: target.offsetLeft, width: target.offsetWidth, opacity: 1 };
  if (first || reducedMotion()) gsap.set(ink, vars);
  else gsap.to(ink, { ...vars, duration: 0.38, ease: 'power3.out' });
}

/** Slides the segmented-control thumb. */
export function moveThumb(thumb: HTMLElement | null, target: HTMLElement | null, first = false) {
  if (!thumb || !target) return;
  const vars = { x: target.offsetLeft - 3, width: target.offsetWidth, opacity: 1 };
  if (first || reducedMotion()) gsap.set(thumb, vars);
  else gsap.to(thumb, { ...vars, duration: 0.34, ease: 'back.out(1.6)' });
}

/** Ambient drift for the aurora backdrop blobs. */
export function driftBlobs(nodes: HTMLElement[]) {
  if (!nodes.length) return () => {};
  if (reducedMotion()) return () => {};
  const tweens = nodes.map((node, i) =>
    gsap.to(node, {
      xPercent: i % 2 ? -14 : 16,
      yPercent: i % 2 ? 12 : -10,
      scale: 1.12,
      duration: 16 + i * 5,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    }),
  );
  return () => tweens.forEach((t) => t.kill());
}
