import { health, isConfigured, query, ready } from '../src/server/db.js'
import { embed, toVectorLiteral } from '../src/server/embeddings.js'

const CUSTOMERS = [
  {
    name: 'Aarti Deshmukh',
    email: 'aarti.deshmukh@northwind.example',
    tier: 'Enterprise',
    openTickets: 3,
    lastContact: '2026-09-28',
    notes: 'Enterprise account on the annual plan. Open tickets cover SSO setup, a billing proration question, and slow dashboard exports.',
  },
  {
    name: 'Rohan Mehta',
    email: 'rohan.mehta@brightlane.example',
    tier: 'Growth',
    openTickets: 1,
    lastContact: '2026-10-01',
    notes: 'Growth plan, upgraded from Starter in August. One open ticket about webhook retries failing after a deploy.',
  },
  {
    name: 'Leena Kapoor',
    email: 'leena.kapoor@quietharbor.example',
    tier: 'Starter',
    openTickets: 0,
    lastContact: '2026-08-14',
    notes: 'Starter plan, no open tickets. Asked previously about CSV import limits and the team seat price.',
  },
  {
    name: 'Daniel Osei',
    email: 'daniel.osei@ferncreek.example',
    tier: 'Enterprise',
    openTickets: 5,
    lastContact: '2026-10-03',
    notes: 'Largest account by seats. Escalated five tickets this week about API rate limits during their migration.',
  },
  {
    name: 'Sofia Marino',
    email: 'sofia.marino@littlebrook.example',
    tier: 'Growth',
    openTickets: 2,
    lastContact: '2026-09-19',
    notes: 'Renewal is due in November. Open tickets about invoice history access and adding a second workspace admin.',
  },
]

if (!isConfigured()) {
  console.error('DATABASE_URL is not set. Add it to .env, then run this again.')
  process.exit(1)
}

console.log('Creating tables and the pgvector index...')
await ready()

console.log('Embedding and seeding customers...')
for (const customer of CUSTOMERS) {
  const vector = await embed(
    `${customer.name} ${customer.email} ${customer.tier} tier, ${customer.openTickets} open tickets. ${customer.notes}`
  )
  await query(
    `INSERT INTO customers (name, email, tier, open_tickets, last_contact_at, notes, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
     ON CONFLICT (email) DO UPDATE
        SET tier = EXCLUDED.tier,
            open_tickets = EXCLUDED.open_tickets,
            last_contact_at = EXCLUDED.last_contact_at,
            notes = EXCLUDED.notes,
            embedding = EXCLUDED.embedding`,
    [
      customer.name,
      customer.email,
      customer.tier,
      customer.openTickets,
      customer.lastContact,
      customer.notes,
      vector ? toVectorLiteral(vector) : null,
    ]
  )
  console.log(`  seeded ${customer.name}`)
}

const status = await health()
console.log('\nDatabase ready:', status)
process.exit(0)
