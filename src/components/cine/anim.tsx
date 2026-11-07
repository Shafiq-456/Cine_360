"use client";
// Velvet Aurora motion primitives — shared entrance/ambient animations.
import { motion, type Variants } from "framer-motion";
import { ReactNode } from "react";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

/** Staggered fade-up entrance for a group of children. */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delayChildren: delay }}
    >
      {children}
    </motion.div>
  );
}

/** Single animated child — must sit inside a <Reveal>. */
export function RevealItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}

/** Infinite marquee ticker; pauses on hover. Content is duplicated for a seamless loop. */
export function Ticker({ items, className = "" }: { items: string[]; className?: string }) {
  if (items.length === 0) return null;
  const row = (keyPrefix: string) =>
    items.map((t, i) => (
      <span key={`${keyPrefix}-${i}`} className="inline-flex items-center gap-2.5 text-xs tracking-wide">
        <span className="text-[#F2B04C]">★</span>
        <span className="text-[#B4A6D4]">{t}</span>
      </span>
    ));
  return (
    <div className={`cine-ticker ${className}`} aria-hidden="true">
      <div className="cine-ticker-track">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}
