export type NormalizedMessagingError =
  | {
      type: 'TWILIO_CONTENT_SIZE_EXCEEDED'
      twilioCode: 30019
      status?: number
      moreInfo?: string
      message?: string
    }
  | {
      type: 'TWILIO_OTHER'
      twilioCode?: number
      status?: number
      moreInfo?: string
      message?: string
    }

/**
 * Normalize various Twilio error shapes into a stable contract.
 * Twilio's Node SDK often throws a RestException with `code`, `status`, `moreInfo`, `message`.
 */
export function normalizeTwilioMessagingError(err: unknown): NormalizedMessagingError {
  const anyErr = err as any
  const code: unknown = anyErr?.code ?? anyErr?.error?.code
  const status: unknown = anyErr?.status ?? anyErr?.error?.status
  const moreInfo: unknown = anyErr?.moreInfo ?? anyErr?.error?.moreInfo
  const message: unknown = anyErr?.message ?? anyErr?.error?.message

  const codeNum = typeof code === 'number' ? code : Number.isFinite(Number(code)) ? Number(code) : undefined
  const statusNum =
    typeof status === 'number' ? status : Number.isFinite(Number(status)) ? Number(status) : undefined

  if (codeNum === 30019) {
    return {
      type: 'TWILIO_CONTENT_SIZE_EXCEEDED',
      twilioCode: 30019,
      status: statusNum,
      moreInfo: typeof moreInfo === 'string' ? moreInfo : undefined,
      message: typeof message === 'string' ? message : undefined,
    }
  }

  return {
    type: 'TWILIO_OTHER',
    twilioCode: codeNum,
    status: statusNum,
    moreInfo: typeof moreInfo === 'string' ? moreInfo : undefined,
    message: typeof message === 'string' ? message : undefined,
  }
}

