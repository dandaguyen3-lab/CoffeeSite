# Kopi Ko Kopi Mo
## Test accounts

| Role | Where to log in | Username | Password |
|---|---|---|---|
| **Admin (staff)** | `/admin.html` | `admin` | `KopiAdmin2026` |
| **Regular user (customer)** | `/login.html` | `testcustomer` | `Test1234` |

The customer test account uses the email `testcustomer@example.com` and the mobile number `09171234567`. You can also create your own customer account on the sign-up page (the mobile number must start with `09` and have 11 digits).

These are demo credentials for evaluation only. When running locally the admin login is `admin` / `kopiadmin`, and a fresh local install has no customers yet, so create one on the sign-up page.

## Business name and description

**Kopi Ko Kopi Mo** is a coffee shop that serves 11 drinks: hot coffees (Americano, Café au lait, Cappuccino, Espresso, Flat White, Latte) and iced coffees (Cold Brew, Frappe, Iced Coffee, Nitro Cold Brew, Vietnamese Coffee), each in four sizes (Short, Tall, Grande, Venti) with optional sweeteners and add-ins.

The system is used by two groups:
- **Customers** browse the menu, create an account, build an order and receive an e-receipt.
- **Staff (baristas and the cashier)** use the admin desk to see new customers and orders as they arrive and move each order through preparation.

## What the system does 

This system lets customers order ahead from any device. Orders appear on the staff desk the moment they are placed, with the customer's name, mobile number, drinks, sizes and extras. Each customer gets an e-receipt, and the shop keeps a record of every customer and order.

## Feature list

**Landing page**
- Public home page with a hero banner, "Order now" and "Create account" buttons, and a Popular coffees section. Anyone can view it without logging in.
- Public menu, drink pages, cart and About Us pages. A customer only has to log in when they choose to order.

**Users**
- Three kinds of visitor: a **guest** (browse only), a **customer** (registered, can order) and **admin/staff** (separate login to the staff desk).
- Customer sign-up with username, email, password and a Philippine mobile number (`09` + 9 digits, checked in the browser and on the server). Passwords are hashed and cannot be read by anyone.
- Customer login and logout with a session cookie, and an admin login that is separate from customer accounts.

**CRUD**

| | What it does in this system |
|---|---|
| **Create** | Register a customer account. Add drinks to the cart. Place an order. |
| **Read** | View the menu and drink details. Customers see **My orders** (with live status) and an **e-receipt**. Staff see the live order board and the registered customers list. |
| **Update** | Customers change drink size, extras and quantity in the cart. Staff move an order through New, Preparing, Ready for pickup and Completed. |
| **Delete** | Customers remove items from their cart. Staff can cancel an order, which keeps it on record marked "Cancelled" instead of erasing it. |

**Order limits and extras pricing**
- A customer can order at most **10 drinks per order**.
- Each sweetener or add-in (sugar, honey, stevia, cream, milk, vanilla syrup) can be added up to **5 times per drink**. The first **3 of each are free**; the 4th and 5th are charged:

| Extra | Charge after the first 3 free |
|---|---|
| Sugar | $0.20 each |
| Stevia | $0.25 each |
| Honey | $0.35 each |
| Cream | $0.40 each |
| Milk | $0.40 each |
| Vanilla syrup | $0.50 each |

- Before an order is sent, the customer sees an **"Are you finished ordering?"** summary and must choose **Yes, place order** or **No, keep ordering**.
- The limits and prices are checked again on the server, so they cannot be bypassed from the browser.

**Other features**
- Live admin updates: new customers and orders appear without refreshing, with a sound alert for new orders.
- Downloadable e-receipt (PDF) after every order, plus a print option.
- Prices are set by the server, so they cannot be changed from the browser.

## Tech stack

- **Front end:** HTML, CSS and JavaScript (no framework), in `public/`
- **Back end:** Node.js with Express (`server.js`)
- **Live updates:** Server-Sent Events from the server to the admin page
- **Database:** Google Firestore online, a JSON file when run locally (`db.js`)
- **Hosting:** Render (website), Firebase (database), GitHub (code)

### Putting it online 

1. **Firebase:** create a project, then Build, then Firestore Database (Standard edition, **Production mode**). Under Project settings, then Service accounts, generate a private key (a `.json` file). Never commit this file.
2. **GitHub:** publish the project to a repository.
3. **Render:** New, then Web Service, and choose the repository. Language Node, build command `npm install`, start command `node server.js`, Free instance.
4. Add these environment variables on Render:

| Variable | Value |
|---|---|
| `ADMIN_USER` | `admin` |
| `ADMIN_PASS` | the staff password |
| `FIREBASE_SERVICE_ACCOUNT` | the full contents of the Firebase `.json` key file |

5. Deploy. The Render logs should say `Storage: Firestore (project ...)`. Pushing a change to GitHub redeploys the site automatically.

## How it works

- **Browsing needs no login.** The cart is kept in the browser. When a guest presses Add to order, `addToCart()` in `script.js` shows a login prompt, and their chosen drink is added automatically after they sign in.
- **Accounts.** `POST /api/register` and `POST /api/login` in `server.js`. Passwords are hashed with scrypt and a random salt, and the server sets an HttpOnly session cookie.
- **Orders.** `POST /api/orders` needs a logged-in customer. The server ignores prices sent by the browser and works them out itself from the drink size plus any extra charges, using `public/pricing.js`. It also rejects orders over 10 drinks or more than 5 of one extra.
- **Live admin page.** `admin.html` opens an `EventSource` to `/api/admin/orders/stream`. Whenever someone registers, orders, or a ticket changes, the server pushes the update to every open staff desk. It also refreshes every 5 seconds as a fallback.
- **E-receipt.** `GET /api/orders/:id` returns an order only to the customer who placed it. `receipt.html` shows it and builds the PDF in the browser with a small hand-written PDF generator.
- **Storage.** `db.js` keeps data in memory and saves only what changed, to the JSON file locally or to Firestore online.
- **Security.** Text typed by customers is escaped on the admin page, login and sign-up are rate limited, redirects after login stay on this site, staff sessions expire after 12 hours, and the staff password is set outside the code.

## AI tools used and what they were used for

**Claude (by Anthropic), through the Claude chat app.** It was used for:

- Making the site public to browse with login required only to order (login prompt on Add to order, automatic login after sign-up, safe redirects).
- Sending new customers and orders to the admin page live.
- Security fixes: escaping text on the admin page, serving only the `public/` folder, rate limiting, secure cookies, removing the default admin password hint.
- Storing data in Firebase Firestore (`db.js`) so it survives restarts on free hosting.
- Mobile number validation, the e-receipt page, the PDF receipt generator and the My orders page.
- Deployment advice (Render, Firebase, Vercel comparison) and writing this README.
- Writing and running automated browser tests of the sign-up, ordering, receipt and admin flows.
