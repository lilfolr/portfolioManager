import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

/**
 * The most recently opened holding.
 *
 * The Flutter shell kept this as `_selected` and used it for three things: the
 * detail screen's props, the breadcrumb's symbol, and the sidebar's
 * "holding detail · VAS" item. Routes cover the first, but the other two still
 * need it -- the breadcrumb and the sidebar live above the detail route, and
 * the symbol is deliberately not in the URL (a bookmarked link with a stale
 * symbol would render the wrong label against freshly fetched data).
 *
 * With nothing selected the sidebar item points at the holdings list, which is
 * better than the Flutter behaviour of opening the detail screen with null ids.
 */
export interface SelectedHolding {
  instrumentId: string;
  accountId: string;
  symbol: string;
}

interface LastHoldingValue {
  selected: SelectedHolding | null;
  setSelected: (holding: SelectedHolding) => void;
}

const LastHoldingContext = createContext<LastHoldingValue>({
  selected: null,
  setSelected: () => {},
});

export function LastHoldingProvider({ children }: PropsWithChildren) {
  const [selected, setSelected] = useState<SelectedHolding | null>(null);
  const value = useMemo(() => ({ selected, setSelected }), [selected]);
  return (
    <LastHoldingContext.Provider value={value}>
      {children}
    </LastHoldingContext.Provider>
  );
}

export const useLastHolding = () => useContext(LastHoldingContext);
