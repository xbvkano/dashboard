/** Shared stacking layers for modals / confirms / alerts. */

/** Primary modal shells (DayTimeline container, CreateAppointment, Recurrence, etc.) */
export const MODAL_Z = 10000

/** Nested confirm / notify overlays above a primary modal */
export const CONFIRM_Z = 10100

/** ModalProvider alert/confirm — always above nested confirms and high parents (e.g. invoice) */
export const ALERT_Z = 10200
