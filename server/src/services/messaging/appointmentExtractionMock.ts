import type { PrismaClient } from '@prisma/client'

/** Structured output shape for future LLM extraction; currently mocked. */
export interface MockAppointmentExtraction {
  intent: string
  customerName: string
  serviceType: string
  address: string
  cityStateZip: string
  size: string
  preferredDate: string
  preferredTime: string
  teamSize: number
  price: number
  notes: string
  confidence: number
}

/**
 * Replace with an LLM call that returns this shape. Loads session + messages for context only.
 */
export async function generateMockAppointmentExtraction(
  prisma: PrismaClient,
  conversationSessionId: number
): Promise<MockAppointmentExtraction> {
  const session = await prisma.conversationSession.findUnique({
    where: { id: conversationSessionId },
    include: {
      messages: { orderBy: { createdAt: 'asc' }, take: 50 },
      appointments: { take: 5 },
    },
  })

  const hasContext =
    session &&
    (session.messages.length > 0 ||
      (session.appointments?.length ?? 0) > 0 ||
      session.summary)

  if (!hasContext) {
    return {
      intent: 'unknown',
      customerName: '',
      serviceType: 'STANDARD',
      address: '',
      cityStateZip: '',
      size: '',
      preferredDate: '',
      preferredTime: '',
      teamSize: 1,
      price: 0,
      notes: '',
      confidence: 0,
    }
  }

  return {
    intent: 'book_cleaning',
    customerName: 'Jane Doe',
    serviceType: 'DEEP',
    address: '123 Main St, Las Vegas, NV',
    cityStateZip: 'Las Vegas, NV 89123',
    size: '2100 sqft',
    preferredDate: '2026-04-14',
    preferredTime: '09:00',
    teamSize: 2,
    price: 320,
    notes: 'Customer asked for baseboards and kitchen focus',
    confidence: 0.87,
  }
}
