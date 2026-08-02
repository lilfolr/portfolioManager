import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

/**
 * The top bar's financial-year selection. Shell-level state in the Flutter app
 * (`_fy` on `_LedgerAppShellState`) because the TopBar sets it and the screens
 * read it, so it becomes context on the `(app)` layout rather than a per-screen
 * `useState`.
 *
 * Deliberately not a URL search param: it would have to be threaded onto every
 * route to survive navigation. Making FY linkable later is a small, contained
 * change.
 */
export const FY_OPTIONS = ['FY 2025–26', 'FY 2024–25', 'FY 2023–24'] as const;

interface FinancialYearValue {
  fy: string;
  setFy: (fy: string) => void;
}

const FinancialYearContext = createContext<FinancialYearValue>({
  fy: FY_OPTIONS[0],
  setFy: () => {},
});

export function FinancialYearProvider({
  initial = FY_OPTIONS[0],
  children,
}: PropsWithChildren<{ initial?: string }>) {
  const [fy, setFy] = useState(initial);
  const value = useMemo(() => ({ fy, setFy }), [fy]);
  return (
    <FinancialYearContext.Provider value={value}>
      {children}
    </FinancialYearContext.Provider>
  );
}

export const useFinancialYear = () => useContext(FinancialYearContext);
