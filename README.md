# Canter & Co Services Planner

This is a first working version of the Canter & Co Services business app.

Open it in a browser at:

```text
http://localhost:4173
```

What it does now:

- uses a stable browser-local database for clients, bookings, invoices, and recent change history
- can sync the full database to Supabase after Chloe logs in
- can receive public website booking requests into an approval inbox
- lets Chloe approve website requests before they become calendar appointments
- shows bookings in a monthly calendar
- lets clients request bookings for show prep, beginner lessons, exercise rides, and show day support
- splits horse show prep into Mane Only, Mane & Tail, and Tail Only services
- includes baby sitting, house sitting, and pet sitting services
- includes Flat work, Jumping, and Basics Ground Work lesson options
- creates weekly recurring appointments for up to 52 weeks
- creates fortnightly recurring appointments
- captures own-horse name and owner location for own-horse bookings
- accepts one or multiple booking dates using a calendar picker plus the Date/Dates list
- lets bookings be rescheduled by changing their date and time
- states that appointments can only be rescheduled at least 48 hours in advance
- lets Chloe cancel appointments and removes cancelled bookings from invoices
- lets Chloe edit the service charge for each individual booking
- keeps a client database with contact details, rider age, yard address, emergency contact, horse or rider notes, and client notes
- allocates either the client's own horse or a Canter school horse to a lesson
- tracks booking status from requested to confirmed or completed
- creates invoices from existing bookings or manually added services
- previews and prints polished invoices with the white-background Canter & Co Services logo
- saves the data in the browser on this computer

Supabase setup:

1. Open Supabase SQL Editor.
2. Run the contents of `supabase-setup.sql`.
3. Go to Authentication > Users.
4. Add Chloe as a user with an email and password.
5. Refresh the app, log in from the header, and the app will sync to Supabase.

The same SQL setup also creates the public `booking_requests` table used by the Canter & Co website. Website visitors can only create pending requests. Chloe must log in to the private planner to approve or decline them.

For a future live version, the next step would be adding real client logins, online payments, email invoice sending, and cloud storage so the data is shared across devices.
