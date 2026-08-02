import { screen, waitFor } from "expo-router/testing-library";

import { renderApp, useFixtureBackend } from "../helpers/router";
import { setMobileViewport } from "../helpers/viewport";

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

// Port of "mobile-width layout (chip row, no sidebar) renders without layout
// errors", which set a 900x1200 surface via `tester.view.physicalSize`.
it("swaps the sidebar for the chip row below 1000px", async () => {
  setMobileViewport();
  useFixtureBackend();
  renderApp("/holdings");

  await waitFor(() =>
    expect(screen.getByTestId("mobileNavChips")).toBeOnTheScreen(),
  );

  // The five chips. 'Holdings' also names the screen body, hence getAllByText.
  expect(screen.getAllByText("Holdings").length).toBeGreaterThan(0);
  expect(screen.getByText("VAS detail")).toBeOnTheScreen();
  expect(screen.getByText("New transaction")).toBeOnTheScreen();
  expect(screen.getByText("Income")).toBeOnTheScreen();
  expect(screen.getByText("Review · 7")).toBeOnTheScreen();

  // The sidebar and everything in it is gone.
  expect(screen.queryByText("PORTFOLIO")).toBeNull();
  expect(screen.queryByText("Sign out")).toBeNull();
  expect(screen.queryByText("alice@example.com")).toBeNull();

  // The search box only shows at >= 1000px; the breadcrumb and FY stay.
  expect(screen.queryByText("Search symbol, parcel, txn id")).toBeNull();
  expect(screen.getByTestId("breadcrumb")).toHaveTextContent(
    "Portfolio / Holdings",
  );
  expect(screen.getByTestId("fySelect")).toBeOnTheScreen();
});
