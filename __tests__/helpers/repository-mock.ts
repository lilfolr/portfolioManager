/**
 * The repository module, mocked.
 *
 * Every route-level test replaces `@/src/data/repository` wholesale, because
 * mounting the real `app/` tree would otherwise reach the network. That mock
 * used to be an inline factory duplicated in each test file, which meant a new
 * repository function silently went missing from eight mocks at once -- the
 * app shell then called `undefined()` and the failure surfaced as an unrelated
 * assertion about nav text.
 *
 * Kept as a factory rather than an object because `jest.mock` hoists its
 * factory above the imports and may only reach out-of-scope values through
 * `require`.
 */
export function repositoryMock() {
  return {
    fetchHoldingsScreenData: jest.fn(),
    fetchHoldingDetail: jest.fn(),
    fetchOpenParcels: jest.fn(),
    submitManualTransaction: jest.fn(),

    fetchImportJobs: jest.fn(),
    fetchImportReview: jest.fn(),
    startImport: jest.fn(),
    finishImport: jest.fn(),
    abandonImport: jest.fn(),
    confirmReviewRows: jest.fn(),
    confirmWholeImport: jest.fn(),
    rejectStagedRows: jest.fn(),
    rejectImportSource: jest.fn(),
    voidImportSource: jest.fn(),
  };
}
