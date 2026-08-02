import { screen, waitFor } from "expo-router/testing-library";

import { renderApp, useFixtureBackend } from "../helpers/router";
import { setWideViewport } from "../helpers/viewport";

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock("@/src/data/repository", () => ({
  fetchHoldingsScreenData: jest.fn(),
  fetchHoldingDetail: jest.fn(),
  fetchOpenParcels: jest.fn(),
  submitManualTransaction: jest.fn(),
}));
jest.mock("@/src/data/supabase", () => require("../helpers/supabase-mock"));
jest.mock(
  "react-native/Libraries/Utilities/useWindowDimensions",
  () => require("../helpers/viewport").mockedHook,
);
/* eslint-enable @typescript-eslint/no-require-imports */

it("deep-links straight to transaction entry with the right breadcrumb", async () => {
  setWideViewport();
  useFixtureBackend();
  const app = renderApp("/transactions/new");

  await waitFor(() =>
    expect(screen.getByTestId("transactionEntryPlaceholder")).toBeOnTheScreen(),
  );
  expect(app.getPathname()).toBe("/transactions/new");
  expect(screen.getByTestId("breadcrumb")).toHaveTextContent(
    "Ledger input / Transaction entry",
  );
});
