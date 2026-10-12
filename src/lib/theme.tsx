import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"

export type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "theme"

/** Runs before first paint to apply the stored theme and avoid a flash. */
export const themeScript = `(() => {
  try {
    const stored = localStorage.getItem("${STORAGE_KEY}") || "system";
    const dark = stored === "dark" || (stored === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch {}
})()`

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
}>({
  theme: "system",
  setTheme: () => {},
})

function apply(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")

  useEffect(() => {
    try {
      setThemeState(
        (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system"
      )
    } catch {
      // Storage can be unavailable (private mode); the system theme applies.
    }
  }, [])

  useEffect(() => {
    apply(theme)
    if (theme !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => apply("system")
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ignored: the choice still applies for this session.
    }
  }, [])

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>
}

export const useTheme = () => useContext(ThemeContext)
