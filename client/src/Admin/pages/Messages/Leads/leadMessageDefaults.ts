import type { Call, FormData } from '../../../../external_prisma_schemas/website_schema'

/** Default SMS-style message for a form submission lead (placeholders filled from form). */
export function buildDefaultFormMessage(form: FormData): string {
  const name = form.name?.trim() || 'there'
  const service = form.service?.trim() || 'cleaning'
  const address = form.address?.trim() || '—'
  const size = form.size?.trim() || '—'
  const date = form.date?.trim() || '—'
  const price =
    form.price != null && !Number.isNaN(Number(form.price))
      ? `$${form.price}`
      : '—'

  return `Hi ${name}😊! This is Evidence Cleaning, your trusted choice for top-quality cleaning services in Las Vegas! We're proud to be top-rated on Yelp and Google. Feel free to check out what our amazing clients are saying about us! ⭐️⭐️⭐️⭐️⭐️

We got your request for a ${service}
At: ${address}
Size: ${size}
Date: ${date}
the price for this cleaning is ${price}

To schedule your cleaning I will only need your gate code (if any) and the time that works best you.

reminder: while the appointment has not been finalized, the time slot remains available and may be booked by other clients. 😊`
}

/** Default SMS-style message for a call lead. */
export function buildDefaultCallMessage(call: Call): string {
  const service = call.service?.trim() || 'cleaning'

  return `Hi😊! This is Evidence Cleaning, we got your request for a ${service}. We're proud to be top-rated on Yelp and Google. Feel free to check out what our amazing clients are saying about us! ⭐️⭐️⭐️⭐️⭐️
  
Before scheduling, could you please confirm the size of the house in square feet (sqft) so I can make sure the estimate is correct?
  
To schedule your cleaning, I would also need your full address, name, and door/gate code (if any).

reminder: while the appointment has not been finalized, the time slot remains available and may be booked by other clients. 😊`
}
