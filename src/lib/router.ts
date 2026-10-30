"use client";
// Hash-based router for the single-route SPA shell.
// Works with the sandbox preview (only `/` is exposed) while giving real
// deep links, back/forward support and shareable URLs.
import { useEffect, useState, useCallback } from "react";

export type RouteInfo = { path: string; params: URLSearchParams };

function parseHash(): RouteInfo {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { path: path || "/", params: new URLSearchParams(query) };
}

export function useRoute(): RouteInfo {
  const [route, setRoute] = useState<RouteInfo>(() =>
    typeof window === "undefined" ? { path: "/", params: new URLSearchParams() } : parseHash()
  );
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(to: string, opts?: { replace?: boolean }) {
  const target = `#${to.startsWith("/") ? to : `/${to}`}`;
  if (opts?.replace) {
    window.history.replaceState(null, "", target);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else if (window.location.hash !== target) {
    window.location.hash = target;
  }
}
