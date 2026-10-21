import { useState, useEffect } from "react";
import { getActiveTag, setActiveTag, subscribe } from "@/lib/photoTag";

export function useActiveTag(contextDefault) {
  const [tag, setTag] = useState(() => getActiveTag(contextDefault));
  useEffect(() => {
    setTag(getActiveTag(contextDefault));
    const unsub = subscribe(() => setTag(getActiveTag(contextDefault)));
    return unsub;
  }, [contextDefault]);
  return [tag, setActiveTag];
}