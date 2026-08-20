import type { ActionCountNotification } from './actionCounts'

const NOTIFICATION_TAG = 'action-needed'
const NOTIFICATION_ICON = '/icons/pwa_icon_192.png'

/** True when the dashboard is not the focused foreground view. */
export function isDashboardInBackground(): boolean {
  if (typeof document === 'undefined') return false
  if (document.visibilityState === 'hidden') return true
  try {
    if (typeof document.hasFocus === 'function' && !document.hasFocus()) return true
  } catch {
    /* ignore */
  }
  return false
}

export function showDesktopNotification(
  note: ActionCountNotification,
  navigate: (to: string) => void,
): boolean {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission !== 'granted') return false
  try {
    const n = new Notification(note.title, {
      body: note.body,
      tag: NOTIFICATION_TAG,
      icon: NOTIFICATION_ICON,
    })
    n.onclick = () => {
      window.focus()
      navigate(note.href)
      n.close()
    }
    return true
  } catch (e) {
    console.error('[desktop-notification] failed to show', e)
    return false
  }
}

export function showDesktopNotificationTest(): boolean {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission !== 'granted') return false
  try {
    new Notification('Desktop notifications work', {
      body: 'Unread messages and unvisited leads will show here.',
      tag: NOTIFICATION_TAG,
      icon: NOTIFICATION_ICON,
    })
    return true
  } catch (e) {
    console.error('[desktop-notification] test failed', e)
    return false
  }
}
