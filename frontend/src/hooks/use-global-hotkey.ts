import { useEffect } from "react";

interface Options {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  handler: (e: KeyboardEvent) => void;
}

export function useGlobalHotkey({
  key,
  meta = false,
  ctrl = false,
  shift = false,
  handler,
}: Options) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const metaMatch = meta ? e.metaKey || e.ctrlKey : true;
      const ctrlMatch = ctrl ? e.ctrlKey || e.metaKey : true;
      const shiftMatch = shift ? e.shiftKey : true;

      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        metaMatch &&
        ctrlMatch &&
        shiftMatch
      ) {
        e.preventDefault();
        handler(e);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, meta, ctrl, shift, handler]);
}