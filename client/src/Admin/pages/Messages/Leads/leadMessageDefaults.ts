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

  return `Hi ${name}, this is Evidence Cleaning,

We got your request for a ${service}
At: ${address}
Size: ${size}
Date: ${date}
the price for this cleaning is ${price}

To schedule your cleaning I will only need your gate code (if any).
We are a highly recommended company by Yelp and Google, our cleaners have a lot of experience in this type of cleaning. If you are interested, let me know, thanks

reminder: while the appointment has not been finalized, the time slot remains available and may be booked by other clients. 😊`
}

/** Default SMS-style message for a call lead. */
export function buildDefaultCallMessage(call: Call): string {
  const service = call.service?.trim() || 'cleaning'

  return `Hi, this is Evidence Cleaning and we got your request for a ${service}.
Before scheduling, could you please confirm the size of the house in square feet (sqft) so I can make sure the estimate is correct?

To schedule your cleaning, I will need your full address, name, and door/gate code (if any).
We are a highly recommended company on Yelp and Google, and our cleaners have a lot of experience with this type of cleaning.`
}
