export type MockMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  sentAt: string
}

export type MockConversation = {
  id: string
  phoneE164: string
  contactName: string | null
  lastPreview: string
  lastAt: string
  messages: MockMessage[]
}

const now = Date.now()
const mins = (n: number) => new Date(now - n * 60 * 1000).toISOString()
const hours = (n: number) => new Date(now - n * 60 * 60 * 1000).toISOString()
const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString()

export const MOCK_CONVERSATIONS: MockConversation[] = [
  {
    id: 'c1',
    phoneE164: '+17025550199',
    contactName: null,
    lastPreview: 'Sounds good, thanks!',
    lastAt: mins(12),
    messages: [
      { id: 'm1', direction: 'inbound', body: 'Hi, do you have availability next Tuesday?', sentAt: hours(26) },
      { id: 'm2', direction: 'outbound', body: 'Hi! Yes, we have openings Tue AM. What size is the home?', sentAt: hours(25) },
      { id: 'm3', direction: 'inbound', body: 'About 2,100 sq ft near Summerlin.', sentAt: hours(24) },
      { id: 'm4', direction: 'outbound', body: 'Perfect — I can slot you for 9am. I’ll send a quote shortly.', sentAt: hours(23) },
      { id: 'm5', direction: 'inbound', body: 'Sounds good, thanks!', sentAt: mins(12) },
    ],
  },
  {
    id: 'c2',
    phoneE164: '+17025551122',
    contactName: 'Jane Smith',
    lastPreview: 'You: See you Thursday at 8',
    lastAt: mins(45),
    messages: [
      { id: 'm6', direction: 'outbound', body: 'Reminder: your deep clean is scheduled Thu 8am.', sentAt: hours(30) },
      { id: 'm7', direction: 'inbound', body: 'Can we move it to 9?', sentAt: hours(29) },
      { id: 'm8', direction: 'outbound', body: '9am works — updated. See you then!', sentAt: hours(28) },
      { id: 'm9', direction: 'outbound', body: 'See you Thursday at 8', sentAt: mins(45) },
    ],
  },
  {
    id: 'c3',
    phoneE164: '+17255774523',
    contactName: 'Marcos Kano',
    lastPreview: 'On my way — traffic on 215',
    lastAt: hours(2),
    messages: [
      { id: 'm10', direction: 'inbound', body: 'Running 10 min late for the 2pm job', sentAt: hours(3) },
      { id: 'm11', direction: 'outbound', body: 'No problem, client knows.', sentAt: hours(3) },
      { id: 'm12', direction: 'inbound', body: 'On my way — traffic on 215', sentAt: hours(2) },
    ],
  },
  {
    id: 'c4',
    phoneE164: '+13105559876',
    contactName: 'Alex Rivera',
    lastPreview: 'Is carpet add-on still $45?',
    lastAt: days(1),
    messages: [
      { id: 'm13', direction: 'inbound', body: 'Quick question — is carpet add-on still $45?', sentAt: days(1) },
    ],
  },
]
