import { useEffect, useState } from "react";

export const useBrowserPath = () => {
  const [path, setPath] = useState(() => window.location.pathname || "/");

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname || "/");
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (to: string, replace = false) => {
    if (window.location.pathname === to) {
      setPath(to);
      return;
    }

    if (replace) {
      window.history.replaceState(null, "", to);
    } else {
      window.history.pushState(null, "", to);
    }
    setPath(to);
  };

  return { path, navigate };
};
