import { Link } from 'react-router-dom'
import PricingCalculator from './PricingCalculator'

export default function Calculator() {
  return (
    <div className="p-4 pb-16">
      <Link to=".." className="text-blue-600 text-sm hover:underline">
        ← Back to Financing
      </Link>
      <h2 className="mt-2 text-xl font-semibold text-slate-800">Pricing Calculator</h2>
      <p className="mt-1 text-sm text-slate-600">
        Look up team size, base price, and add-ons by property size or bedrooms/bathrooms.
      </p>
      <div className="mt-6 max-w-xl">
        <PricingCalculator />
      </div>
    </div>
  )
}
