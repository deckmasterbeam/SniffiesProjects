export interface ReportFormContract {
  /**
   * Called when the user confirms the report with an optional message. May be async — the modal
   * shows a submitting state until this resolves, then closes. Rejecting shows a generic failure
   * status and re-enables the submit button so the user can retry.
   */
  onSubmit: (message: string) => void | Promise<void>;
  /** Called when the user cancels or dismisses the modal without submitting. */
  onCancel?: () => void;
}
