# Homestay Manager — Feature Requirements

**Scope**: Single property · 1 location · ≤ 20 rooms · 1–3 concurrent staff  
**Currency**: VND · **Timezone**: single (server local)  
**OTA integration**: manual entry only (no API sync)  

---

## Roles & Permissions

**Receptionist is the primary operational role.** They run day-to-day: create bookings, cancel bookings, check guests in/out, record payments, and update housekeeping. They are NOT allowed to see aggregate financial data.

| Action | Receptionist | Admin | Owner |
|--------|-------------|-------|-------|
| Login / logout | ✓ | ✓ | ✓ |
| View dashboard | ✓ | ✓ | ✓ |
| Create booking (enter room price manually) | ✓ | ✓ | ✓ |
| View booking list (with per-booking price & outstanding) | ✓ | ✓ | ✓ |
| Cancel booking | ✓ | ✓ | ✓ |
| Check in / check out | ✓ | ✓ | ✓ |
| Mark no-show | ✓ | ✓ | ✓ |
| Record payment (manual entry, all methods) | ✓ | ✓ | ✓ |
| Update housekeeping status | ✓ | ✓ | ✓ |
| View daily report (operational sections only) | ✓ | ✓ | ✓ |
| View daily report revenue summary cards | ✗ | ✓ | ✓ |
| View revenue / monthly financial reports | ✗ | ✓ | ✓ |
| Add expense: Cleaning / Supplies / Other | ✓ | ✓ | ✓ |
| Add expense: Salaries / Utilities / Maintenance | ✗ | ✓ | ✓ |
| View expenses: Cleaning / Supplies / Other | ✓ | ✓ | ✓ |
| View expenses: Salaries / Utilities / Maintenance | ✗ | ✓ | ✓ |
| Manage users | ✗ | ✗ | ✓ |
| Configure OTA commission rates | ✗ | ✗ | ✓ |

**Key distinction**: Receptionist CAN see the price and outstanding balance of each individual booking (they need this to collect payment). They CANNOT see aggregate totals across bookings (daily/monthly revenue summaries).

---

## F-01 · Authentication

**Purpose**: Secure access. All pages require an active session.

**Rules**:
- Login requires email + password (min 8 chars)
- Session is an httpOnly cookie, valid for 8 hours
- Failed login returns a generic "Incorrect email or password" — do not distinguish unknown email from wrong password
- Logout clears the cookie and redirects to `/login`
- Inactive accounts cannot log in (HTTP 403)
- On any 401 response, redirect to `/login`
- Receptionist attempting to access Revenue page is redirected to Dashboard

**Out of scope**: password reset, 2FA, OAuth

---

## F-02 · Dashboard

**Purpose**: Single-screen property overview at a glance.

**What it shows**:
- 6 stat cards: Total Rooms · Occupied · Available · Arrivals Today · Checkouts Today · Dirty
- Room grid: one card per room with room number, type, floor, display status

**Display status rules** (computed at query time, not stored):
| Housekeeping status | Booking condition | Display |
|---|---|---|
| DIRTY | any | DIRTY |
| CLEANING | any | CLEANING |
| OUT_OF_ORDER | any | OUT_OF_ORDER |
| AVAILABLE | no active booking | AVAILABLE |
| AVAILABLE | booking check-in = today | ARRIVAL TODAY |
| AVAILABLE | booking check-out = today | CHECKOUT TODAY |
| AVAILABLE | booking active, not today | OCCUPIED |
| AVAILABLE | 2+ active bookings | OVERBOOKING (red alert) |

**OTA email reminder banner**:
- Visible to Admin and Owner only
- Appears when the logged-in user has not opened the Bookings page for more than 12 hours
- Text: "Bookings unchecked for [N] hours — review OTA emails for cancellations or changes."
- Clicking the banner navigates to Bookings and resets the 12-hour timer
- Timer is tracked via `localStorage` per browser session (no backend required)
- Resets when any Admin/Owner opens the Bookings page

---

## F-03 · Booking: Create

**Required fields**: Room · Guest name · Check-in date · Check-out date · Total price · Payment method (for upfront payments)
**Optional fields**: Guest phone · OTA source (default: Direct) · Num guests (default: 1) · Booking ref · Notes

**Rules**:
- Check-out must be strictly after check-in
- Overlap check: if the room has a CONFIRMED or CHECKED_IN booking overlapping the new dates → HTTP 409: "Room [number] already booked [date] – [date] (booking #[id])"
- No force-override of conflicts
- Guest lookup by full name (case-insensitive). Not found → create new guest record
- New booking starts with status CONFIRMED, `collected_amount` = 0 (payments recorded separately)
- Room price (`total_price`) is entered manually by staff — it is flexible and overrides the room's `base_price`. The `base_price` is shown as a hint/placeholder only.

**Out of scope**: pricing suggestions, availability search by date

---

## F-04 · Booking: View & Filter

**Views**:
- **Today**: active bookings covering today (CONFIRMED or CHECKED_IN). Sorted by room number.
- **All Bookings**: all bookings, most recent check-in first, limit 200 rows.
- **Calendar**: see F-10.

**Columns**: Room · Guest · Check-in · Check-out · OTA · Status · Total Price · Outstanding · Actions

**Outstanding**: `total_price − sum(payments)`. Red if > 0, "✓ Paid" green if = 0.

**Actions per status**:
| Status | Available actions |
|--------|-----------------|
| CONFIRMED | Check In · Pay · No-show · Cancel |
| CHECKED_IN | Check Out · Pay · Cancel |
| CHECKED_OUT | Pay (to correct a missed payment) |
| CANCELLED / NO_SHOW | — none |

---

## F-05 · Booking: Check-in

**Who**: All roles
**Precondition**: status must be CONFIRMED

**Rules**:
- No date restriction — allow early or late check-in
- CONFIRMED → CHECKED_IN
- Room housekeeping status is NOT changed (room was cleaned before arrival)
- No confirmation dialog required

---

## F-06 · Booking: Check-out

**Who**: All roles
**Precondition**: status must be CHECKED_IN

**Rules**:
- No date restriction — allow early or late check-out
- CHECKED_IN → CHECKED_OUT
- Room housekeeping status automatically → DIRTY
- If outstanding balance > 0: show warning dialog "Guest has [amount] outstanding. Proceed with checkout?" Staff can proceed anyway.
- Checkout is NOT reversible via UI

---

## F-07 · Booking: Cancel

**Who**: All roles
**Precondition**: status must be CONFIRMED or CHECKED_IN

**Rules**:
- Requires confirmation dialog: "Cancel booking for [guest] in room [number]? This cannot be undone."
- CONFIRMED → CANCELLED, CHECKED_IN → CANCELLED
- `collected_amount` is NOT reset (cancellation fee may apply)
- Room housekeeping status is NOT changed
- Cancelled bookings appear in a separate collapsed section on the Calendar (not the main grid)
- CHECKED_OUT and NO_SHOW cannot be cancelled

**Manual OTA cancellation flow**: when staff receives a cancellation email from an OTA, they find the booking in the system and cancel manually. No automation.

---

## F-08 · Booking: No-show

**Who**: All roles
**Precondition**: status must be CONFIRMED

**Rules**:
- Requires confirmation: "Mark [guest] as no-show for room [number]?"
- CONFIRMED → NO_SHOW
- `collected_amount` is NOT reset
- Room housekeeping status is NOT changed
- **Irreversible** — if a guest arrives late after being marked no-show, staff must create a new booking
- NO_SHOW bookings appear in the same collapsed Calendar section as CANCELLED

---

## F-09 · Payments (Transaction Records)

**Purpose**: Record every payment event against a booking. Full transaction history, not just a running total.

**Payment table fields**:
- booking_id
- amount (VND, integer)
- method: `CASH` | `BANK_TRANSFER` | `OTA_COLLECTED`
- paid_at (datetime, defaults to now)
- recorded_by (user)
- notes (optional, e.g. "Deposit", "Balance at check-in")

**Method definitions**:
| Method | Meaning |
|--------|---------|
| CASH | Physical cash received at property |
| BANK_TRANSFER | Direct transfer to property bank account |
| OTA_COLLECTED | OTA (Agoda/BDC/TVK) already charged guest and will remit to property on payout date |

**Who can record**: All roles

**UI flow**:
1. Staff clicks "Pay" on a booking
2. Modal shows: room, guest, booking total, payment history (list of past transactions), outstanding balance
3. Staff enters: amount, method, optional notes
4. Each submission adds a new payment row — does NOT replace previous payments
5. Outstanding balance = `total_price − sum of all payments for this booking`

**Rules**:
- A single payment cannot exceed the outstanding balance (HTTP 400 if attempted)
- Total payments across a booking cannot exceed `total_price`
- CANCELLED and NO_SHOW bookings cannot receive new payments
- Existing payment records can be viewed but NOT edited or deleted (immutable audit trail)
- If an error occurs, staff must add a negative correcting entry (e.g., amount: -50000, notes: "correction")

**Out of scope**: receipts, payment method reporting per booking (only in revenue reports)

---

## F-10 · Room Calendar

**Purpose**: Visual month-by-month room occupancy grid.

**Layout**: Gantt grid. Rows = rooms sorted by room number. Columns = days of selected month. Sticky room-number column.

**Main grid shows**: CONFIRMED (blue) · CHECKED_IN (green) · CHECKED_OUT (gray)

**Cell text**: Guest's last name on check-in day only. Remaining days of booking: color only.

**Hover tooltip**: Full guest name · check-in → check-out · status

**Below the grid — collapsed section "Cancelled & No-shows"**:
- A simple list (not grid) of CANCELLED and NO_SHOW bookings for the selected month
- Columns: Room · Guest · Dates · Status · Reason for cancel (notes field if present)
- Collapsed by default, expandable with a toggle

**Navigation**: Prev month / Next month. Today's date column highlighted.

**Rules**:
- Calendar loads on first tab click, not on page load
- All roles can view
- No clicking on cells (read-only view)

---

## F-11 · Housekeeping

**Purpose**: Track and coordinate room cleaning status.

**Statuses**: AVAILABLE · DIRTY · CLEANING · OUT_OF_ORDER

**Transitions** (all roles):
| From | To (allowed) |
|------|-------------|
| AVAILABLE | DIRTY · OUT_OF_ORDER |
| DIRTY | CLEANING |
| CLEANING | AVAILABLE |
| OUT_OF_ORDER | AVAILABLE · DIRTY |

**Rules**:
- Checkout (F-06) automatically sets room → DIRTY
- Each status change is logged: room · who · from → to · timestamp · optional notes
- Page groups rooms by status: Dirty → Cleaning → Out of Order → Available
- Summary count bar at top
- All roles can update housekeeping

---

## F-12 · Daily Operations Report

**Purpose**: Owner/Admin/Receptionist morning briefing. Accessible to all roles.

**Default date**: today. Date picker allows any past or future date.

**Sections** (always visible, show "None" if empty):

1. **Revenue summary** (4 cards): Total Booked · Collected · Outstanding · Housekeeping counts  
   — Revenue cards visible to Owner/Admin only. Receptionist sees Housekeeping counts only.

2. **Arrivals** — `check_in_date = selected date`, status CONFIRMED or CHECKED_IN  
   Columns: Room · Guest · Check-out · OTA · Total · Collected · Due · Status

3. **Checkouts** — `check_out_date = selected date`, status CONFIRMED/CHECKED_IN/CHECKED_OUT

4. **In-House** — `check_in_date < selected date < check_out_date`, status CHECKED_IN  
   Columns: Room · Guest · Check-in · Check-out · OTA · Total · Collected · Due

5. **Tomorrow's Arrivals** — `check_in_date = selected + 1`, status CONFIRMED

**Rules**:
- "Due" = red if > 0; green "✓" if 0
- Print button: `window.print()` — sidebar hidden on print via CSS
- Revenue figures (Total Booked, Collected, Outstanding) hidden for Receptionist role
- Data is a snapshot at load time

**Out of scope**: PDF export, automated delivery

---

## F-13 · Revenue & Financial Reports

**Who**: Owner and Admin only. Receptionist is redirected to Dashboard.

**Tabs**: Daily Report (see F-12) · Revenue · Expenses

### Revenue tab

**Date range picker**: from-date and to-date. Default: first day of current month to today. On the 1st of each month, default automatically shifts to the full previous month.

**Summary cards**: Gross Revenue · Commission paid · Net Revenue · Total Collected · Outstanding

**By-source breakdown table**:
| Column | Description |
|--------|-------------|
| OTA Source | Agoda / Booking.com / Traveloka / Direct |
| Bookings | Count |
| Gross Revenue | Sum of `total_price` |
| Commission | Gross × commission_rate |
| Net Revenue | Gross × (1 − commission_rate) |
| Collected | Sum of all payments for these bookings |
| Outstanding | Gross − Collected |

**Payment method breakdown** (separate summary below table):
| Method | Amount |
|--------|--------|
| Cash | Sum of CASH payments in range |
| Bank Transfer | Sum of BANK_TRANSFER payments in range |
| OTA Collected | Sum of OTA_COLLECTED payments in range |
| **Total** | All methods combined |

**Rules**:
- Scope: bookings where `check_in_date` falls within the date range, status CONFIRMED/CHECKED_IN/CHECKED_OUT
- Commission rates come from current Settings (F-15) — not retroactive

### Expenses tab

See F-14.

---

## F-14 · Expenses

**Purpose**: Track outgoing costs to enable basic P&L view alongside revenue.

**Expense categories**:
| Category | Receptionist can add | Receptionist can view |
|----------|---------------------|-----------------------|
| Cleaning | ✓ | ✓ |
| Supplies | ✓ | ✓ |
| Other | ✓ | ✓ |
| Utilities | ✗ | ✗ |
| Salaries | ✗ | ✗ |
| Maintenance | ✗ | ✗ |

**Expense fields**: category · amount (VND) · expense_date (defaults to today) · description (optional) · recorded_by (auto)

**UI**:
- Expense list filtered by the same date range as the Revenue tab
- "Add Expense" button — shows categories allowed for the current user's role
- List columns: Date · Category · Description · Amount · Recorded by
- No editing or deletion (add a correcting negative entry if needed)

**P&L summary** (Owner/Admin only, shown at bottom of Expenses tab):
- Gross Revenue (from Revenue tab) − Total Expenses = Net Operating Income

---

## F-15 · User Management

**Who**: Owner only.

**Actions**:
- **Add user**: full name, email, password (min 8 chars), role. Email must be unique.
- **Deactivate / Reactivate**: toggles `is_active`. Owner cannot deactivate their own account.
- **No delete** (records linked to booking history). Deactivate instead.
- **No password change via UI** (out of scope)

**Rules**:
- Owner cannot change their own role

---

## F-16 · Settings: OTA Commission Rates

**Who**: Owner only.

**Fields**: commission rate per OTA as a percentage (0–50%)

**Default rates**: Agoda 18% · Booking.com 15% · Traveloka 18% · Direct 0%

**Rules**:
- Changes apply to all future report loads
- Historical data not retroactively recalculated

---

## Non-Functional Requirements

- All pages load within 2 seconds on localhost
- No automatic deletion of any records
- Designed for 1–3 concurrent users
- Housekeeping page must be usable on a phone (tap targets ≥ 44px)
- Other pages are desktop-first but must not break on tablet
- Latest Chrome/Edge only

---

## Out of Scope (this version)

- OTA API / channel manager sync
- iCal export
- Email parsing for automated cancellations
- Multi-property support
- Payment receipts
- SMS / email / WhatsApp notifications
- Automated report delivery (email/PDF on the 1st)
- Audit log for booking edits
- Yield management / dynamic pricing
- Maintenance ticket system
- Guest CRM (repeat guest history, preferences)
- Mobile app
