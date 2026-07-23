export type ServiceStatusActionOutcome = 'ok' | 'already_handled' | 'ignored'

export type ServiceStatusActionPlan = {
  outcome: ServiceStatusActionOutcome
  recordClick: boolean
  sendSms: boolean
  sendPushover: boolean
}

export function resolveOnTheWayActions(input: {
  alreadyClickedByThisEmployee: boolean
  teamAlreadySentSms: boolean
}): ServiceStatusActionPlan {
  if (input.alreadyClickedByThisEmployee) {
    return { outcome: 'already_handled', recordClick: false, sendSms: false, sendPushover: false }
  }
  return {
    outcome: 'ok',
    recordClick: true,
    sendSms: !input.teamAlreadySentSms,
    sendPushover: true,
  }
}

export function resolveArrivedActions(input: {
  alreadyClickedByThisEmployee: boolean
}): ServiceStatusActionPlan {
  if (input.alreadyClickedByThisEmployee) {
    return { outcome: 'already_handled', recordClick: false, sendSms: false, sendPushover: false }
  }
  return { outcome: 'ok', recordClick: true, sendSms: false, sendPushover: true }
}

export function resolveThirtyMinutesActions(input: {
  anyTeamMemberAlreadyClicked: boolean
}): ServiceStatusActionPlan {
  if (input.anyTeamMemberAlreadyClicked) {
    return { outcome: 'ignored', recordClick: false, sendSms: false, sendPushover: false }
  }
  return { outcome: 'ok', recordClick: true, sendSms: true, sendPushover: true }
}
