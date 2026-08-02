import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  DataSourceProvider,
  type PortfolioDataSource,
} from '@/src/data/data-source';
import { WidthOverride } from '@/src/layout/breakpoint';
import { FinancialYearProvider } from '@/src/layout/financial-year';
import { LastHoldingProvider } from '@/src/layout/last-holding';
import { ThemeModeProvider } from '@/src/theme/theme-mode';

import { fixtureDataSource } from '../fixtures/portfolio';

export interface LedgerRenderOptions extends RenderOptions {
  /** Partial override of the fixture data source. */
  data?: Partial<PortfolioDataSource>;
  /** Stands in for `tester.view.physicalSize` -- see WidthOverride. */
  width?: number;
}

/**
 * A fresh QueryClient per test. `retry: false` is not optional: the default
 * three retries with exponential backoff hang any assertion on an error state.
 * `gcTime: 0` is the equivalent of `_finish(tester)` flushing fquery's GC timer
 * in the Flutter tests -- nothing is left scheduled between tests.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Renders a component tree inside the providers a screen expects, with fixtures
 * in place of a live Supabase project.
 *
 * For route-level tests use `renderRoute` instead -- it mounts the real
 * expo-router tree so navigation is exercised rather than simulated.
 */
export function renderWithLedger(
  ui: ReactElement,
  { data, width, ...options }: LedgerRenderOptions = {},
) {
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider value={{ ...fixtureDataSource, ...data }}>
        <ThemeModeProvider>
          <LastHoldingProvider>
            <FinancialYearProvider>
              <WidthOverride width={width}>{ui}</WidthOverride>
            </FinancialYearProvider>
          </LastHoldingProvider>
        </ThemeModeProvider>
      </DataSourceProvider>
    </QueryClientProvider>,
    options,
  );
}
