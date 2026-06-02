const STORAGE_KEY = "canter-co-services-planner-database";
const SUPABASE_URL = "https://notlmqtzvsbokjuhtgkh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vdGxtcXR6dnNib2tqdWh0Z2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzODA2NDgsImV4cCI6MjA5NTk1NjY0OH0.fdDpm42L_SXInt6oZDOD9rTQrUO8Qw6DV3pEzN2O-sk";
const LEGACY_STORAGE_KEYS = [
  "canter-co-booking-studio-v2",
  "canter-co-booking-studio-v1",
];

const services = [
  {
    id: "show-prep-mane",
    name: "Horse Show Prep - Mane Only",
    price: 250,
    unit: "session",
    description: "Mane preparation for show day.",
  },
  {
    id: "show-prep-mane-tail",
    name: "Horse Show Prep - Mane & Tail",
    price: 300,
    unit: "session",
    description: "Mane and tail preparation for show day.",
  },
  {
    id: "show-prep-tail",
    name: "Horse Show Prep - Tail Only",
    price: 50,
    unit: "session",
    description: "Tail preparation for show day.",
  },
  {
    id: "beginner-lesson",
    name: "Flat work Lesson",
    price: 300,
    unit: "lesson",
    description: "Flat work lesson for beginner and developing riders.",
  },
  {
    id: "jumping-lesson",
    name: "Jumping Lesson",
    price: 300,
    unit: "lesson",
    description: "Jumping lesson for riders building confidence and technique.",
  },
  {
    id: "basics-ground-work",
    name: "Basics Ground Work Lesson",
    price: 200,
    unit: "lesson",
    description: "Ground work basics for safe handling, confidence, and connection.",
  },
  {
    id: "exercise-ride",
    name: "Schooling Session",
    price: 200,
    unit: "session",
    description: "A schooling session to keep horses moving and progressing.",
  },
  {
    id: "show-day-support",
    name: "Show Help",
    price: 400,
    unit: "day",
    description: "Show-day help, grooming touch-ups, and rider support.",
  },
  {
    id: "baby-sitting",
    name: "Baby sitting",
    price: 300,
    unit: "booking",
    description: "Baby sitting service.",
  },
  {
    id: "house-sitting",
    name: "House sitting",
    price: 400,
    unit: "booking",
    description: "House sitting service.",
  },
  {
    id: "pet-sitting",
    name: "Pet Sitting",
    price: 50,
    unit: "booking",
    description: "Pet sitting service.",
  },
];

const lessonHorses = [
  { id: "own-horse", name: "Client's own horse", charge: 0, notes: "No horse-use charge" },
  { id: "max", name: "Max", charge: 0, notes: "School horse" },
  { id: "star", name: "Star", charge: 0, notes: "School horse" },
  { id: "moonshine", name: "Moonshine", charge: 0, notes: "School horse" },
  { id: "caramel", name: "Caramel", charge: 0, notes: "School horse" },
  { id: "kaleb", name: "Kaleb", charge: 0, notes: "School horse" },
];

const defaultState = {
  clients: [],
  bookings: [],
  invoices: [],
  history: [],
  selectedInvoiceId: null,
  calendarMonth: monthKey(new Date()),
};

let state = loadState();
let invoiceDraftItems = [];
let editingBookingId = "";
let cloudClient = null;
let cloudSession = null;
let cloudSaveTimer = null;
let isLoadingCloudState = false;

const money = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (!saved) return structuredClone(defaultState);

  try {
    const loaded = { ...structuredClone(defaultState), ...JSON.parse(saved) };
    loaded.history = loaded.history || [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
    return loaded;
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  state.lastSavedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleCloudSave();
}

function recordHistory(type, message, details = {}) {
  state.history = state.history || [];
  state.history.unshift({
    id: id("history"),
    type,
    message,
    details,
    createdAt: new Date().toISOString(),
  });
  state.history = state.history.slice(0, 250);
}

function initCloudDatabase() {
  if (!window.supabase) {
    setCloudStatus("Cloud unavailable");
    return;
  }

  cloudClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  cloudClient.auth.getSession().then(({ data }) => {
    cloudSession = data.session;
    updateCloudAuthUi();
    if (cloudSession) loadCloudState();
  });

  cloudClient.auth.onAuthStateChange((_event, session) => {
    cloudSession = session;
    updateCloudAuthUi();
    if (cloudSession) loadCloudState();
  });
}

function setCloudStatus(message) {
  ["gate-cloud-status"].forEach((id) => {
    const status = document.getElementById(id);
    if (status) status.textContent = message;
  });
}

function updateCloudAuthUi() {
  const loggedIn = Boolean(cloudSession);
  document.getElementById("auth-gate").classList.toggle("hidden", loggedIn);
  document.body.classList.toggle("locked", !loggedIn);
  setCloudStatus(loggedIn ? "Cloud synced" : "Local only");
}

async function loginToCloud() {
  if (!cloudClient) return;
  const email = (
    document.getElementById("gate-login-email").value
  ).trim();
  const password = document.getElementById("gate-login-password").value;
  if (!email || !password) {
    alert("Enter Chloe's Supabase email and password.");
    return;
  }

  setCloudStatus("Logging in...");
  const { error } = await cloudClient.auth.signInWithPassword({ email, password });
  if (error) {
    setCloudStatus("Login failed");
    alert(error.message);
  }
}

async function logoutFromCloud() {
  if (!cloudClient) return;
  await cloudClient.auth.signOut();
  cloudSession = null;
  updateCloudAuthUi();
}

async function loadCloudState() {
  if (!cloudClient || !cloudSession) return;
  isLoadingCloudState = true;
  setCloudStatus("Loading cloud...");

  const { data, error } = await cloudClient
    .from("app_state")
    .select("data")
    .eq("id", "main")
    .maybeSingle();

  if (error) {
    setCloudStatus("Cloud setup needed");
    isLoadingCloudState = false;
    return;
  }

  if (data?.data) {
    state = { ...structuredClone(defaultState), ...data.data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
  } else {
    await saveCloudStateNow();
  }

  isLoadingCloudState = false;
  setCloudStatus("Cloud synced");
}

function scheduleCloudSave() {
  if (!cloudClient || !cloudSession || isLoadingCloudState) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(saveCloudStateNow, 500);
}

async function saveCloudStateNow() {
  if (!cloudClient || !cloudSession) return;
  setCloudStatus("Saving...");
  const { error } = await cloudClient.from("app_state").upsert({
    id: "main",
    data: state,
    updated_at: new Date().toISOString(),
  });
  setCloudStatus(error ? "Cloud save failed" : "Cloud synced");
}

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function serviceById(serviceId) {
  if (serviceId === "show-prep") return services.find((service) => service.id === "show-prep-mane-tail");
  return services.find((service) => service.id === serviceId) || services[0];
}

function horseById(horseId) {
  const oldHorseMap = {
    bella: "max",
    storm: "star",
    maple: "moonshine",
  };
  const resolvedHorseId = oldHorseMap[horseId] || horseId;
  return lessonHorses.find((horse) => horse.id === resolvedHorseId) || lessonHorses[0];
}

function horseCharge(booking) {
  return Number(booking.horseRate ?? horseById(booking.lessonHorseId).charge) * Number(booking.quantity || 1);
}

function bookingTotal(booking) {
  return Number(booking.serviceRate ?? serviceById(booking.serviceId).price) * Number(booking.quantity || 1) + horseCharge(booking);
}

function invoiceTotal(invoice) {
  const bookingTotalAmount = (invoice.bookingIds || []).reduce((sum, bookingId) => {
    const booking = state.bookings.find((item) => item.id === bookingId);
    return sum + (booking ? bookingTotal(booking) : 0);
  }, 0);
  const manualTotalAmount = (invoice.items || []).reduce((sum, item) => sum + invoiceItemTotal(item), 0);
  return bookingTotalAmount + manualTotalAmount;
}

function invoiceItemTotal(item) {
  return Number(item.price || 0) * Number(item.quantity || 1);
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateValue}T00:00:00`));
}

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function monthKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
  ].join("-");
}

function todayPlus(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function emptyNode(message = "New bookings and invoices will appear here as they are added.") {
  const node = document.getElementById("empty-template").content.cloneNode(true);
  node.querySelector("span").textContent = message;
  return node;
}

function upsertClient(details) {
  const cleanEmail = (details.email || "").trim().toLowerCase();
  const existing = state.clients.find(
    (client) => client.id === details.clientId || client.email.toLowerCase() === cleanEmail
  );

  if (existing) {
    const cleanDetails = Object.fromEntries(
      Object.entries(details).filter(([, value]) => value !== undefined)
    );
    Object.assign(existing, cleanDetails, {
      email: cleanEmail,
      updatedAt: new Date().toISOString(),
    });
    recordHistory("client", `Updated client: ${existing.clientName}`, { clientId: existing.id });
    return existing.id;
  }

  const client = {
    id: id("client"),
    clientName: details.clientName,
    email: cleanEmail,
    phone: details.phone,
    horseName: details.horseName || "",
    riderAge: details.riderAge || "",
    stableAddress: details.stableAddress || "",
    emergencyContact: details.emergencyContact || "",
    notes: details.notes || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.clients.push(client);
  recordHistory("client", `Created client: ${client.clientName}`, { clientId: client.id });
  return client.id;
}

function render() {
  removeLegacyCloudPanels();
  renderServiceOptions();
  renderHorseOptions();
  renderMetrics();
  renderCalendar();
  renderBookings();
  renderClients();
  renderServices();
  renderInvoiceTools();
  renderDatabaseHistory();
}

function removeLegacyCloudPanels() {
  document.querySelectorAll(".cloud-panel").forEach((panel) => panel.remove());
}

function renderHorseOptions() {
  const horseSelect = document.getElementById("booking-horse-name");
  const hiddenHorseId = document.getElementById("booking-horse");
  const currentValue = hiddenHorseId.value || lessonHorses[0].id;
  horseSelect.innerHTML = lessonHorses
    .map((horse) => `<option value="${horse.id}">${horse.name}${horse.charge ? ` - ${money.format(horse.charge)}` : ""}</option>`)
    .join("");
  horseSelect.value = currentValue;
  hiddenHorseId.value = horseSelect.value;
  updateHorseChargeDisplay();
}

function renderServiceOptions() {
  const bookingService = document.getElementById("booking-service");
  const invoiceService = document.getElementById("invoice-service");
  const currentValue = bookingService.value || services[0].id;
  bookingService.innerHTML = services
    .map((service) => `<option value="${service.id}">${service.name} - ${money.format(service.price)}</option>`)
    .join("");
  bookingService.value = currentValue;

  if (invoiceService) {
    const invoiceValue = invoiceService.value || services[0].id;
    invoiceService.innerHTML = services
      .map((service) => `<option value="${service.id}">${service.name} - ${money.format(service.price)}</option>`)
      .join("");
    invoiceService.value = invoiceValue;
  }
  if (!document.getElementById("booking-service-rate").value) {
    document.getElementById("booking-service-rate").value = serviceById(bookingService.value).price;
  }
  updateBookingTotal();
}

function updateBookingTotal() {
  const quantity = Number(document.querySelector("[name='quantity']").value || 1);
  const serviceRate = Number(document.getElementById("booking-service-rate").value || 0);
  const horseRate = Number(document.getElementById("booking-horse-rate").value || 0);
  document.getElementById("booking-total").textContent = money.format((serviceRate + horseRate) * quantity);
}

function updateHorseChargeDisplay() {
  const horse = horseById(document.getElementById("booking-horse").value);
  document.getElementById("booking-horse-rate").value = horse.charge;
  const isOwnHorse = horse.id === "own-horse";
  document.getElementById("own-horse-name").disabled = !isOwnHorse;
  document.getElementById("own-horse-location").disabled = !isOwnHorse;
  if (!isOwnHorse) {
    document.getElementById("own-horse-name").value = "";
    document.getElementById("own-horse-location").value = "";
  }
}

function updateServiceChargeDefault() {
  const service = serviceById(document.getElementById("booking-service").value);
  document.getElementById("booking-service-rate").value = service.price;
  updateBookingTotal();
}

function syncBookingHorseChoice() {
  const horseSelect = document.getElementById("booking-horse-name");
  document.getElementById("booking-horse").value = horseSelect.value;
  updateHorseChargeDisplay();
  updateBookingTotal();
}

function horseNameForBooking(horseId, ownHorseName = "") {
  const horse = horseById(horseId);
  return horse.id === "own-horse" ? (ownHorseName || "Client's own horse") : horse.name;
}

function renderMetrics() {
  const now = new Date();
  const today = dateKey(now);
  const month = monthKey(now);
  const upcoming = state.bookings.filter(
    (booking) => booking.date >= today && booking.status !== "Cancelled"
  ).length;
  const unpaid = state.invoices
    .filter((invoice) => invoice.status !== "Paid")
    .reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
  const monthBooked = state.bookings
    .filter((booking) => booking.date.startsWith(month) && booking.status !== "Cancelled")
    .reduce((sum, booking) => sum + bookingTotal(booking), 0);

  document.getElementById("metric-upcoming").textContent = upcoming;
  document.getElementById("metric-unpaid").textContent = money.format(unpaid);
  document.getElementById("metric-clients").textContent = state.clients.length;
  document.getElementById("metric-month").textContent = money.format(monthBooked);
}

function renderCalendar() {
  const grid = document.getElementById("calendar-grid");
  const title = document.getElementById("calendar-title");
  const [year, month] = state.calendarMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const leadingBlanks = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((leadingBlanks + lastDay.getDate()) / 7) * 7;

  title.textContent = new Intl.DateTimeFormat("en-ZA", {
    month: "long",
    year: "numeric",
  }).format(firstDay);
  grid.innerHTML = "";

  for (let index = 0; index < totalCells; index += 1) {
    const dayNumber = index - leadingBlanks + 1;
    const cell = document.createElement("article");
    cell.className = "calendar-day";

    if (dayNumber < 1 || dayNumber > lastDay.getDate()) {
      cell.classList.add("muted-day");
      grid.append(cell);
      continue;
    }

    const dateValue = `${state.calendarMonth}-${String(dayNumber).padStart(2, "0")}`;
    const bookings = state.bookings
      .filter((booking) => booking.date === dateValue && booking.status !== "Cancelled")
      .sort((a, b) => a.time.localeCompare(b.time));

    cell.innerHTML = `<strong>${dayNumber}</strong>`;
    bookings.forEach((booking) => {
      const service = serviceById(booking.serviceId);
      const horse = horseById(booking.lessonHorseId);
      const item = document.createElement("button");
      item.className = `calendar-booking ${booking.status}`;
      item.type = "button";
      item.dataset.bookingId = booking.id;
      item.innerHTML = `<span>${booking.time}</span>${booking.clientName}<small>${service.name} - ${horse.name}</small>`;
      cell.append(item);
    });
    grid.append(cell);
  }
}

function renderBookings() {
  const list = document.getElementById("booking-list");
  const filter = document.getElementById("booking-filter").value;
  const bookings = state.bookings
    .filter((booking) => filter === "all" || booking.status === filter)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  list.innerHTML = "";
  if (!bookings.length) {
    list.append(emptyNode("Bookings from the request form will land here and on the calendar."));
    return;
  }

  bookings.forEach((booking) => {
    const service = serviceById(booking.serviceId);
    const horse = horseById(booking.lessonHorseId);
    const article = document.createElement("article");
    article.className = "booking-card";
    article.dataset.bookingId = booking.id;
    article.innerHTML = `
      <div>
        <h3>${booking.clientName}</h3>
        <div class="meta">
          <span>${service.name}</span>
          <span>Service charge: ${money.format(Number(booking.serviceRate ?? service.price))}</span>
          <span>${formatDate(booking.date)} at ${booking.time}</span>
          <span>${booking.horseName || "No horse listed"}</span>
          ${booking.ownHorseLocation ? `<span>Location: ${booking.ownHorseLocation}</span>` : ""}
          <span>Rider age: ${booking.riderAge || "Not listed"}</span>
          <span>Lesson horse: ${horse.name}${Number(booking.horseRate ?? horse.charge) ? ` + ${money.format(Number(booking.horseRate ?? horse.charge))}` : ""}</span>
          <strong>${money.format(bookingTotal(booking))}</strong>
        </div>
        ${booking.notes ? `<p class="muted">${booking.notes}</p>` : ""}
        ${editingBookingId === booking.id ? renderBookingEditor(booking) : ""}
      </div>
      <div class="card-actions">
        <span class="status ${booking.status}">${booking.status}</span>
        <button data-action="edit-booking" data-id="${booking.id}">Edit</button>
        <button data-action="status" data-id="${booking.id}" data-status="Confirmed">Confirm</button>
        <button data-action="status" data-id="${booking.id}" data-status="Completed">Complete</button>
        <button data-action="cancel-booking" data-id="${booking.id}">Cancel</button>
        <button data-action="invoice-one" data-id="${booking.id}">Invoice</button>
      </div>
    `;
    list.append(article);
  });
}

function renderBookingEditor(booking) {
  return `
    <div class="booking-editor">
      <strong>Change appointment</strong>
      <p class="policy-note">Appointments can only be rescheduled at least 48 hours in advance.</p>
      <div class="two-col">
        <label>
          New date
          <input type="date" data-edit-field="date" value="${booking.date}" />
        </label>
        <label>
          New time
          <input type="time" data-edit-field="time" value="${booking.time}" />
        </label>
      </div>
      <div class="two-col">
        <label>
          Service charge
          <input type="number" min="0" step="10" data-edit-field="serviceRate" value="${Number(booking.serviceRate ?? serviceById(booking.serviceId).price)}" />
        </label>
        <span class="policy-note">School horses and own horses have no horse-use charge.</span>
      </div>
      <label>
        Horse / pony
        <select data-edit-field="lessonHorseId">
          ${lessonHorses
            .map((horse) => `<option value="${horse.id}" ${horse.id === (booking.lessonHorseId || "own-horse") ? "selected" : ""}>${horse.name}${horse.charge ? ` - ${money.format(horse.charge)}` : ""}</option>`)
            .join("")}
        </select>
      </label>
      <div class="card-actions inline-actions">
        <button type="button" data-action="save-booking" data-id="${booking.id}">Save changes</button>
        <button type="button" data-action="cancel-edit" data-id="${booking.id}">Cancel</button>
      </div>
    </div>
  `;
}

function renderClients() {
  const list = document.getElementById("client-list");
  list.innerHTML = "";
  if (!state.clients.length) {
    list.append(emptyNode("Add clients here, or create them automatically from a booking request."));
    return;
  }

  state.clients
    .slice()
    .sort((a, b) => a.clientName.localeCompare(b.clientName))
    .forEach((client) => {
      const clientBookings = state.bookings.filter((booking) => booking.clientId === client.id);
      const spent = clientBookings.reduce((sum, booking) => sum + bookingTotal(booking), 0);
      const article = document.createElement("article");
      article.className = "client-card";
      article.innerHTML = `
        <h3>${client.clientName}</h3>
        <p class="muted">${client.email}<br />${client.phone}</p>
        <div class="client-detail">
          <span><strong>Horse/rider:</strong> ${client.horseName || "Not listed"}</span>
          <span><strong>Rider age:</strong> ${client.riderAge || "Not listed"}</span>
          <span><strong>Yard:</strong> ${client.stableAddress || "Not listed"}</span>
          <span><strong>Emergency:</strong> ${client.emergencyContact || "Not listed"}</span>
          ${client.notes ? `<span><strong>Notes:</strong> ${client.notes}</span>` : ""}
        </div>
        <div class="meta">
          <strong>${clientBookings.length} bookings</strong>
          <strong>${money.format(spent)} booked</strong>
        </div>
        <div class="card-actions">
          <button data-action="edit-client" data-id="${client.id}">Edit</button>
          <button data-action="book-client" data-id="${client.id}">Book</button>
          <button data-action="invoice-client" data-id="${client.id}">Invoice</button>
        </div>
      `;
      list.append(article);
    });
}

function renderServices() {
  const list = document.getElementById("service-list");
  const serviceCards = services
    .map(
      (service) => `
        <article class="service-card">
          <h3>${service.name}</h3>
          <p class="muted">${service.description}</p>
          <div class="meta">
            <strong>${money.format(service.price)}</strong>
            <span>per ${service.unit}</span>
          </div>
        </article>
      `
    )
    .join("");
  const horseCards = `
    <article class="service-card">
      <h3>Available lesson horses</h3>
      <p class="muted">Allocate one of these horses to a lesson, or choose the client's own horse with no extra charge.</p>
      <div class="client-detail">
        ${lessonHorses
          .map((horse) => `<span><strong>${horse.name}</strong> - ${horse.charge ? money.format(horse.charge) : "No charge"}<br />${horse.notes}</span>`)
          .join("")}
      </div>
    </article>
  `;
  list.innerHTML = serviceCards + horseCards;
}

function renderInvoiceTools() {
  const clientSelect = document.getElementById("invoice-client");
  const bookingSelect = document.getElementById("invoice-bookings");
  const selectedClientId = clientSelect.value || state.clients[0]?.id || "";
  const eligibleBookings = state.bookings.filter(
    (booking) =>
      (!selectedClientId || booking.clientId === selectedClientId) &&
      booking.status !== "Cancelled" &&
      !state.invoices.some((invoice) => (invoice.bookingIds || []).includes(booking.id))
  );

  clientSelect.innerHTML = state.clients
    .map((client) => `<option value="${client.id}">${client.clientName}</option>`)
    .join("");
  clientSelect.value = selectedClientId;

  bookingSelect.innerHTML = eligibleBookings
    .map((booking) => {
      const service = serviceById(booking.serviceId);
      const horse = horseById(booking.lessonHorseId);
      return `<option value="${booking.id}">${formatDate(booking.date)} - ${service.name} - ${horse.name} - ${money.format(bookingTotal(booking))}</option>`;
    })
    .join("");
  renderInvoiceDraft();

  renderInvoiceList();
  renderInvoicePreview();
}

function renderInvoiceDraft() {
  const draft = document.getElementById("invoice-draft");
  if (!draft) return;

  if (!invoiceDraftItems.length) {
    draft.innerHTML = '<p class="muted">Added services will appear here before you create the invoice.</p>';
    return;
  }

  draft.innerHTML = invoiceDraftItems
    .map(
      (item, index) => `
        <div class="invoice-draft-row">
          <span><strong>${item.name}</strong><br />${item.quantity} x ${money.format(item.price)} = ${money.format(invoiceItemTotal(item))}</span>
          <button type="button" data-action="remove-draft-line" data-index="${index}">Remove</button>
        </div>
      `
    )
    .join("");
}

function renderInvoiceList() {
  const list = document.getElementById("invoice-list");
  list.innerHTML = "";
  if (!state.invoices.length) {
    list.append(emptyNode("Create invoices from completed or confirmed bookings."));
    return;
  }

  state.invoices
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .forEach((invoice) => {
      const client = state.clients.find((item) => item.id === invoice.clientId);
      const article = document.createElement("article");
      article.className = "invoice-row";
      article.innerHTML = `
        <div>
          <h3>${invoice.number}</h3>
          <div class="meta">
            <span>${client?.clientName || "Client removed"}</span>
            <span>Due ${formatDate(invoice.dueDate)}</span>
            <strong>${money.format(invoiceTotal(invoice))}</strong>
          </div>
        </div>
        <div class="card-actions">
          <span class="status ${invoice.status}">${invoice.status}</span>
          <button data-action="preview-invoice" data-id="${invoice.id}">Preview</button>
          <button data-action="paid-invoice" data-id="${invoice.id}">Paid</button>
          <button data-action="print-invoice" data-id="${invoice.id}">Print</button>
        </div>
      `;
      list.append(article);
    });
}

function renderInvoicePreview() {
  const preview = document.getElementById("invoice-preview");
  const invoice = state.invoices.find((item) => item.id === state.selectedInvoiceId) || state.invoices[0];
  if (!invoice) {
    preview.innerHTML = "<p>Select or create an invoice to preview it here.</p>";
    return;
  }

  state.selectedInvoiceId = invoice.id;
  const client = state.clients.find((item) => item.id === invoice.clientId);
  const bookingRows = (invoice.bookingIds || [])
    .map((bookingId) => state.bookings.find((booking) => booking.id === bookingId))
    .filter(Boolean)
    .map((booking) => {
      const service = serviceById(booking.serviceId);
      const horse = horseById(booking.lessonHorseId);
      const serviceRate = Number(booking.serviceRate ?? service.price);
      const horseRate = Number(booking.horseRate ?? horse.charge);
      const horseLine = horseRate ? `<br /><span class="muted">Horse use: ${horse.name} - ${money.format(horseRate * Number(booking.quantity || 1))}</span>` : "";
      return `
        <tr>
          <td>${service.name}<br /><span class="muted">${formatDate(booking.date)} - ${booking.horseName || "General booking"} - ${horse.name}</span>${horseLine}</td>
          <td>${booking.quantity}</td>
          <td>${money.format(serviceRate + horseRate)}</td>
          <td>${money.format(bookingTotal(booking))}</td>
        </tr>
      `;
    })
    .join("");
  const itemRows = (invoice.items || [])
    .map(
      (item) => `
        <tr>
          <td>${item.name}<br /><span class="muted">Equestrian service</span></td>
          <td>${item.quantity}</td>
          <td>${money.format(item.price)}</td>
          <td>${money.format(invoiceItemTotal(item))}</td>
        </tr>
      `
    )
    .join("");
  const rows = bookingRows + itemRows;

  preview.innerHTML = `
    <header>
      <img src="assets/canter-co-services-invoice-logo.png" alt="Canter and Co Services logo" />
      <div class="invoice-id-block">
        <p class="eyebrow">Invoice</p>
        <h2>${invoice.number}</h2>
        <p>Issued ${formatDate(invoice.createdAt.slice(0, 10))}<br />Due ${formatDate(invoice.dueDate)}</p>
      </div>
    </header>
    <section class="invoice-parties">
      <div>
        <span>Bill to</span>
        <strong>${client?.clientName || ""}</strong>
        <p>${client?.email || ""}<br />${client?.phone || ""}</p>
      </div>
      <div>
        <span>From</span>
        <strong>Canter & Co Services</strong>
        <p>Care - Coaching - Confidence<br />Show prep - Riding - Lessons</p>
      </div>
    </section>
    <table>
      <thead>
        <tr>
          <th>Service</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="total">Total ${money.format(invoiceTotal(invoice))}</p>
    <p class="muted">${invoice.message}</p>
  `;
}

function renderDatabaseHistory() {
  renderHistoryList("client-history", "client");
  renderHistoryList("invoice-history", "invoice");
}

function renderHistoryList(elementId, type) {
  const list = document.getElementById(elementId);
  if (!list) return;

  const items = (state.history || []).filter((item) => item.type === type).slice(0, 8);
  if (!items.length) {
    list.innerHTML = '<p class="muted">No saved changes yet.</p>';
    return;
  }

  list.innerHTML = items
    .map(
      (item) => `
        <div class="history-item">
          <span>${item.message}</span>
          <time>${formatDate(item.createdAt.slice(0, 10))}</time>
        </div>
      `
    )
    .join("");
}

function createInvoice(clientId, bookingIds, dueDate, message, items = []) {
  if (!clientId) {
    alert("Add or choose a client first.");
    return;
  }
  if (!bookingIds.length && !items.length) {
    alert("Choose an existing booking or add at least one service to the invoice.");
    return;
  }

  const invoice = {
    id: id("invoice"),
    number: `CC-${String(state.invoices.length + 1).padStart(4, "0")}`,
    clientId,
    bookingIds,
    items,
    dueDate,
    message,
    status: "Unpaid",
    createdAt: new Date().toISOString(),
  };
  state.invoices.push(invoice);
  state.selectedInvoiceId = invoice.id;
  invoiceDraftItems = [];
  recordHistory("invoice", `Created invoice: ${invoice.number}`, { invoiceId: invoice.id, clientId });
  saveState();
  render();
}

function removeBookingFromInvoices(bookingId) {
  state.invoices.forEach((invoice) => {
    const hadBooking = (invoice.bookingIds || []).includes(bookingId);
    invoice.bookingIds = (invoice.bookingIds || []).filter((id) => id !== bookingId);
    if (hadBooking) {
      recordHistory("invoice", `Removed cancelled booking from invoice: ${invoice.number}`, {
        invoiceId: invoice.id,
        bookingId,
      });
    }
  });
  state.invoices = state.invoices.filter((invoice) => {
    const hasBookings = (invoice.bookingIds || []).length > 0;
    const hasItems = (invoice.items || []).length > 0;
    return hasBookings || hasItems;
  });
  if (!state.invoices.some((invoice) => invoice.id === state.selectedInvoiceId)) {
    state.selectedInvoiceId = state.invoices[0]?.id || null;
  }
}

function cancelBooking(booking) {
  if (!confirm("Cancel this appointment? If it is on an invoice, it will be removed from that invoice.")) return;
  booking.status = "Cancelled";
  removeBookingFromInvoices(booking.id);
  recordHistory("booking", `Cancelled appointment for ${booking.clientName}`, { bookingId: booking.id });
  editingBookingId = "";
  saveState();
  render();
}

function showView(viewId) {
  document.querySelectorAll(".tab, .view").forEach((item) => item.classList.remove("active"));
  document.querySelector(`[data-view="${viewId}"]`)?.classList.add("active");
  document.getElementById(viewId)?.classList.add("active");
  document.getElementById(viewId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function changeCalendarMonth(delta) {
  const [year, month] = state.calendarMonth.split("-").map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  state.calendarMonth = monthKey(next);
  saveState();
  renderCalendar();
}

function fillClientForm(client) {
  const form = document.getElementById("client-form");
  form.elements.clientId.value = client?.id || "";
  form.elements.clientName.value = client?.clientName || "";
  form.elements.email.value = client?.email || "";
  form.elements.phone.value = client?.phone || "";
  form.elements.horseName.value = client?.horseName || "";
  form.elements.riderAge.value = client?.riderAge || "";
  form.elements.stableAddress.value = client?.stableAddress || "";
  form.elements.emergencyContact.value = client?.emergencyContact || "";
  form.elements.notes.value = client?.notes || "";
}

function fillBookingFormFromClient(client) {
  const form = document.getElementById("booking-form");
  form.elements.clientName.value = client.clientName;
  form.elements.email.value = client.email;
  form.elements.phone.value = client.phone;
  form.elements.horseName.value = "own-horse";
  form.elements.lessonHorseId.value = "own-horse";
  form.elements.ownHorseName.value = client.horseName || "";
  form.elements.riderAge.value = client.riderAge || "";
  syncBookingHorseChoice();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function seedDemoData() {
  if (state.bookings.length && !confirm("Replace current sample data?")) return;
  state.clients = [];
  const annaId = upsertClient({
    clientName: "Anna Meyer",
    email: "anna@example.com",
    phone: "+27 82 123 4567",
    horseName: "Willow",
    riderAge: "14",
    stableAddress: "Oak Lane Stables",
    emergencyContact: "+27 82 765 4321",
    notes: "Willow can be fresh after a rest day. Anna likes a short WhatsApp update.",
  });
  const thaboId = upsertClient({
    clientName: "Thabo Naidoo",
    email: "thabo@example.com",
    phone: "+27 83 234 5678",
    horseName: "Beginner rider",
    riderAge: "9",
    stableAddress: "Canter & Co arena",
    emergencyContact: "+27 83 222 1111",
    notes: "First month of lessons. Keep sessions confidence-focused.",
  });
  state.bookings = [
    {
      id: id("booking"),
      clientId: annaId,
      clientName: "Anna Meyer",
      email: "anna@example.com",
      phone: "+27 82 123 4567",
      horseName: "Willow",
      riderAge: "14",
      serviceId: "show-prep-mane-tail",
      lessonHorseId: "own-horse",
      date: todayPlus(3),
      time: "08:30",
      quantity: 1,
      notes: "Prep for Saturday showing class. Include mane plan and tack polish.",
      status: "Confirmed",
      createdAt: new Date().toISOString(),
    },
    {
      id: id("booking"),
      clientId: thaboId,
      clientName: "Thabo Naidoo",
      email: "thabo@example.com",
      phone: "+27 83 234 5678",
      horseName: "Beginner rider",
      riderAge: "9",
      serviceId: "beginner-lesson",
      lessonHorseId: "max",
      date: todayPlus(5),
      time: "15:00",
      quantity: 1,
      notes: "First lesson. Focus on confidence, balance, and safe handling.",
      status: "Requested",
      createdAt: new Date().toISOString(),
    },
    {
      id: id("booking"),
      clientId: annaId,
      clientName: "Anna Meyer",
      email: "anna@example.com",
      phone: "+27 82 123 4567",
      horseName: "Willow",
      riderAge: "14",
      serviceId: "exercise-ride",
      lessonHorseId: "own-horse",
      date: todayPlus(8),
      time: "10:00",
      quantity: 3,
      notes: "Owner away for the week. Send notes after each ride.",
      status: "Confirmed",
      createdAt: new Date().toISOString(),
    },
  ];
  state.invoices = [];
  state.calendarMonth = monthKey(new Date());
  saveState();
  render();
  showView("calendar");
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => showView(tab.dataset.view));
});

document.getElementById("logout-button").addEventListener("click", logoutFromCloud);
document.getElementById("gate-login-button").addEventListener("click", loginToCloud);
["gate-login-email", "gate-login-password"].forEach((id) => {
  document.getElementById(id).addEventListener("keydown", (event) => {
    if (event.key === "Enter") loginToCloud();
  });
});
document.getElementById("booking-service").addEventListener("change", updateServiceChargeDefault);
document.getElementById("booking-horse-name").addEventListener("change", syncBookingHorseChoice);
document.getElementById("booking-service-rate").addEventListener("input", updateBookingTotal);
document.getElementById("booking-horse-rate").addEventListener("input", updateBookingTotal);
document.querySelector("[name='quantity']").addEventListener("input", updateBookingTotal);
document.querySelector("[name='repeatWeekly']").addEventListener("change", (event) => {
  if (event.target.checked) document.querySelector("[name='repeatFortnightly']").checked = false;
});
document.querySelector("[name='repeatFortnightly']").addEventListener("change", (event) => {
  if (event.target.checked) document.querySelector("[name='repeatWeekly']").checked = false;
});

document.getElementById("booking-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const repeatCount = (data.repeatWeekly || data.repeatFortnightly)
    ? Math.max(1, Math.min(52, Number(data.repeatWeeks || 1)))
    : 1;
  const repeatIntervalDays = data.repeatFortnightly ? 14 : 7;
  const repeatLabel = data.repeatFortnightly ? "Fortnightly" : "Weekly";
  const seriesId = repeatCount > 1 ? id("series") : "";
  const bookingHorseName = horseNameForBooking(data.lessonHorseId, data.ownHorseName);
  const clientId = upsertClient({
    clientName: data.clientName,
    email: data.email,
    phone: data.phone,
    horseName: data.lessonHorseId === "own-horse" ? bookingHorseName : undefined,
    riderAge: data.riderAge,
  });
  for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
    const booking = {
      id: id("booking"),
      clientId,
      clientName: data.clientName,
      email: data.email,
      phone: data.phone,
      horseName: bookingHorseName,
      riderAge: data.riderAge,
      serviceId: data.serviceId,
      lessonHorseId: data.lessonHorseId,
      ownHorseName: data.ownHorseName || "",
      ownHorseLocation: data.lessonHorseId === "own-horse" ? data.ownHorseLocation : "",
      serviceRate: Number(data.serviceRate || 0),
      horseRate: Number(data.horseRate || 0),
      date: addDays(data.date, repeatIndex * repeatIntervalDays),
      time: data.time,
      quantity: Number(data.quantity || 1),
      notes: repeatCount > 1
        ? `${data.notes || ""}${data.notes ? " " : ""}${repeatLabel} appointment ${repeatIndex + 1} of ${repeatCount}.`
        : data.notes,
      status: "Requested",
      seriesId,
      createdAt: new Date().toISOString(),
    };
    state.bookings.push(booking);
    recordHistory("booking", `Created appointment for ${data.clientName}`, {
      bookingId: booking.id,
      clientId,
      date: booking.date,
      repeat: repeatCount > 1 ? repeatLabel : "Once",
    });
  }
  state.calendarMonth = data.date.slice(0, 7);
  saveState();
  event.currentTarget.reset();
  document.querySelector("[name='date']").value = todayPlus(1);
  document.querySelector("[name='time']").value = "09:00";
  document.querySelector("[name='repeatWeeks']").value = "4";
  document.querySelector("[name='repeatWeekly']").checked = false;
  document.querySelector("[name='repeatFortnightly']").checked = false;
  document.getElementById("booking-horse-name").value = "own-horse";
  document.getElementById("own-horse-name").value = "";
  document.getElementById("own-horse-location").value = "";
  syncBookingHorseChoice();
  updateServiceChargeDefault();
  render();
  showView("calendar");
});

document.getElementById("client-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  upsertClient(data);
  saveState();
  fillClientForm(null);
  render();
});

document.getElementById("new-client").addEventListener("click", () => fillClientForm(null));

document.getElementById("client-list").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const client = state.clients.find((item) => item.id === button.dataset.id);
  if (!client) return;

  if (button.dataset.action === "edit-client") {
    fillClientForm(client);
    document.getElementById("client-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (button.dataset.action === "book-client") {
    fillBookingFormFromClient(client);
  }

  if (button.dataset.action === "invoice-client") {
    showView("invoices");
    document.getElementById("invoice-client").value = client.id;
    renderInvoiceTools();
  }
});

document.getElementById("booking-list").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const booking = state.bookings.find((item) => item.id === button.dataset.id);
  if (!booking) return;

  if (button.dataset.action === "status") {
    booking.status = button.dataset.status;
    recordHistory("booking", `${booking.status} appointment for ${booking.clientName}`, { bookingId: booking.id });
    saveState();
    render();
  }

  if (button.dataset.action === "cancel-booking") {
    cancelBooking(booking);
    return;
  }

  if (button.dataset.action === "edit-booking") {
    editingBookingId = booking.id;
    renderBookings();
    return;
  }

  if (button.dataset.action === "cancel-edit") {
    editingBookingId = "";
    renderBookings();
    return;
  }

  if (button.dataset.action === "save-booking") {
    const card = button.closest(".booking-card");
    const lessonHorseId = card.querySelector('[data-edit-field="lessonHorseId"]').value;
    booking.date = card.querySelector('[data-edit-field="date"]').value;
    booking.time = card.querySelector('[data-edit-field="time"]').value;
    booking.lessonHorseId = lessonHorseId;
    booking.horseName = horseNameForBooking(lessonHorseId, booking.horseName);
    booking.serviceRate = Number(card.querySelector('[data-edit-field="serviceRate"]').value || 0);
    booking.horseRate = 0;
    state.calendarMonth = booking.date.slice(0, 7);
    editingBookingId = "";
    recordHistory("booking", `Updated appointment for ${booking.clientName}`, {
      bookingId: booking.id,
      date: booking.date,
      time: booking.time,
    });
    saveState();
    render();
    showView("calendar");
    return;
  }

  if (button.dataset.action === "invoice-one") {
    if (booking.status === "Cancelled") {
      alert("Cancelled appointments cannot be invoiced.");
      return;
    }
    createInvoice(booking.clientId, [booking.id], todayPlus(7), "Thank you for booking with Canter & Co.");
    showView("invoices");
  }
});

document.getElementById("calendar-grid").addEventListener("click", (event) => {
  const button = event.target.closest(".calendar-booking");
  if (!button) return;
  editingBookingId = button.dataset.bookingId;
  showView("bookings");
  renderBookings();
  const target = document.querySelector(`[data-booking-id="${button.dataset.bookingId}"]`);
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
});

document.getElementById("booking-filter").addEventListener("change", renderBookings);
document.getElementById("seed-demo").addEventListener("click", seedDemoData);
document.getElementById("invoice-client").addEventListener("change", renderInvoiceTools);
document.getElementById("add-invoice-line").addEventListener("click", () => {
  const service = serviceById(document.getElementById("invoice-service").value);
  const quantity = Number(document.getElementById("invoice-quantity").value || 1);
  invoiceDraftItems.push({
    serviceId: service.id,
    name: service.name,
    price: service.price,
    quantity,
  });
  document.getElementById("invoice-quantity").value = "1";
  renderInvoiceDraft();
});
document.getElementById("invoice-draft").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || button.dataset.action !== "remove-draft-line") return;
  invoiceDraftItems.splice(Number(button.dataset.index), 1);
  renderInvoiceDraft();
});
document.getElementById("calendar-prev").addEventListener("click", () => changeCalendarMonth(-1));
document.getElementById("calendar-next").addEventListener("click", () => changeCalendarMonth(1));
document.getElementById("calendar-today").addEventListener("click", () => {
  state.calendarMonth = monthKey(new Date());
  saveState();
  renderCalendar();
});

document.getElementById("create-invoice").addEventListener("click", () => {
  const form = document.getElementById("invoice-form");
  const data = new FormData(form);
  createInvoice(
    data.get("clientId"),
    data.getAll("bookingIds"),
    data.get("dueDate"),
    data.get("message"),
    invoiceDraftItems.map((item) => ({ ...item }))
  );
});

document.getElementById("invoice-list").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const invoice = state.invoices.find((item) => item.id === button.dataset.id);
  if (!invoice) return;

  if (button.dataset.action === "preview-invoice") {
    state.selectedInvoiceId = invoice.id;
    renderInvoicePreview();
  }

  if (button.dataset.action === "paid-invoice") {
    invoice.status = "Paid";
    recordHistory("invoice", `Marked invoice paid: ${invoice.number}`, { invoiceId: invoice.id });
    saveState();
    render();
  }

  if (button.dataset.action === "print-invoice") {
    state.selectedInvoiceId = invoice.id;
    renderInvoicePreview();
    window.print();
  }
});

document.querySelector("[name='date']").value = todayPlus(1);
document.querySelector("[name='dueDate']").value = todayPlus(7);
render();
initCloudDatabase();
