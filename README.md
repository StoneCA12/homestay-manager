# homestay-manager
Built to replace pen-and-paper booking management at a small family guesthouse. Parses OTA emails from Agoda/Booking.com, tracks room states, and generates daily revenue snapshots — no enterprise bloat.
#  Homestay Manager

A lightweight Property Management System (PMS) built for my mom's small guesthouse in Vietnam.

Replaces pen-and-paper booking management with a real dashboard — tracking rooms, guests, OTA bookings, housekeeping, and daily revenue.

---

## Why I Built This

Small guesthouses in Vietnam typically manage everything manually: bookings written in notebooks, OTA confirmations buried in email, room status tracked by memory. This project automates the core daily workflow so the front desk can see the full property state at a glance.

---

## What It Does (MVP Scope)

###  Room Status Board
- Live overview of all rooms with color-coded status
- Green = Occupied · White = Available · Yellow = Arrival Today · Blue = Checkout Today · Red = Dirty · Purple = Overbooking

###  Booking Calendar
- 30-day calendar view per room
- Overlapping bookings highlighted automatically

###  OTA Email Parsing
- Reads booking confirmation emails from Agoda, Booking.com, and Traveloka
- Extracts guest name, check-in/out dates, room type, price, and booking source
- Saves directly to the booking database — no manual data entry

###  Revenue Module
- Daily: booked vs collected vs outstanding
- Monthly: breakdown by OTA source
- 30-day forecast for staffing and cash flow planning

###  Housekeeping Module
- Room state workflow: `DIRTY → CLEANING → READY`
- Dashboard alerts for rooms stuck in dirty state

###  User Roles
| Role | Access |
|------|--------|
| Owner | Full access including reports and revenue |
| Admin | Bookings, rooms, housekeeping, reports |
| Receptionist | Check-in/out, create bookings, update guest info |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python) |
| Database | PostgreSQL |
| Auth | JWT |
| Reverse Proxy | Nginx |
| Containerization | Docker Compose |

---

## Project Status

>  Currently in active development — Phase 1 MVP

- [ ] Repo structure & Docker Compose setup
- [ ] Database schema
- [ ] Auth (JWT)
- [ ] Room & booking API endpoints
- [ ] Dashboard frontend
- [ ] OTA email parser
- [ ] Revenue module
- [ ] Housekeeping module
- [ ] Deploy to VPS

---

## Local Development

> Setup instructions will be added as the project progresses.

---

## What's Out of Scope (for now)

- Mobile app
- Multi-property support
- Complex accounting
- Dynamic pricing
- Direct OTA API integrations
- AI forecasting

---

## License

MIT
