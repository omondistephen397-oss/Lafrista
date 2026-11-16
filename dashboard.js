import { isSupabaseConfigured, supabase } from "./supabase-client.js";

const signInSection = document.querySelector("#sign-in-section");
const signInForm = document.querySelector("#sign-in-form");
const signOutButton = document.querySelector("#sign-out");
const dashboardApp = document.querySelector("#dashboard-app");
const statusMessage = document.querySelector("#dashboard-status");
const inventoryRows = document.querySelector("#inventory-rows");
const inventoryEmpty = document.querySelector("#inventory-empty");
const movementItem = document.querySelector("#movement-item");
const reportDate = document.querySelector("#report-date");
const addItemForm = document.querySelector("#add-item-form");
const movementForm = document.querySelector("#movement-form");
const catalogForm = document.querySelector("#catalog-form");
const catalogRows = document.querySelector("#catalog-rows");
const catalogEmpty = document.querySelector("#catalog-empty");
const enquiriesRows = document.querySelector("#enquiry-rows");
const enquiriesEmpty = document.querySelector("#enquiries-empty");
let inventory = [];
let movements = [];
let catalog = [];
let realtimeChannel;
let activeUserId;

function showStatus(message) {
  statusMessage.textContent = message;
}

function errorText(error, fallback) {
  return error && typeof error.message === "string" ? error.message : fallback;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function appendCell(row, value, className) {
  const cell = document.createElement("td");
  cell.textContent = value;
  if (className) cell.className = className;
  row.append(cell);
  return cell;
}

function renderInventory() {
  inventoryRows.replaceChildren();

  for (const item of inventory) {
    const row = document.createElement("tr");
    appendCell(row, item.name);
    appendCell(row, item.category);
    appendCell(row, item.variant);
    appendCell(row, String(item.quantity), item.quantity <= item.reorder_at ? "stock-low" : "");
    appendCell(row, item.quantity <= item.reorder_at ? `Low stock (≤ ${item.reorder_at})` : `Alert at ${item.reorder_at}`);

    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "table-action";
    deleteButton.dataset.deleteId = item.id;
    deleteButton.setAttribute("aria-label", `Remove ${item.name}, ${item.variant}, from inventory`);
    deleteButton.textContent = "Remove";
    actionCell.append(deleteButton);
    row.append(actionCell);
    inventoryRows.append(row);
  }

  inventoryEmpty.hidden = inventory.length > 0;
  movementItem.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = inventory.length ? "Choose a garment" : "Add an inventory item first";
  movementItem.append(placeholder);

  for (const item of inventory) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.name} — ${item.variant} (${item.quantity} in stock)`;
    movementItem.append(option);
  }

  const totalUnits = inventory.reduce((total, item) => total + item.quantity, 0);
  const lowStockCount = inventory.filter((item) => item.quantity <= item.reorder_at).length;
  const today = localDateKey(new Date());
  const soldToday = movements
    .filter((movement) => movement.movement_type === "out" && localDateKey(new Date(movement.created_at)) === today)
    .reduce((total, movement) => total + movement.quantity, 0);

  document.querySelector("#stat-styles").textContent = String(inventory.length);
  document.querySelector("#stat-units").textContent = String(totalUnits);
  document.querySelector("#stat-low").textContent = String(lowStockCount);
  document.querySelector("#stat-out").textContent = String(soldToday);
  renderReport();
}

function renderReport() {
  const selectedDate = reportDate.value;
  const selectedMovements = movements
    .filter((movement) => localDateKey(new Date(movement.created_at)) === selectedDate)
    .sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at));

  const reportRows = document.querySelector("#report-rows");
  reportRows.replaceChildren();
  let received = 0;
  let removed = 0;

  for (const movement of selectedMovements) {
    const row = document.createElement("tr");
    appendCell(row, new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(movement.created_at)));
    appendCell(row, `${movement.item_name} — ${movement.variant}`);
    appendCell(row, movement.movement_type === "in" ? "Stock received" : "Sold / removed");
    appendCell(row, String(movement.quantity));
    appendCell(row, movement.note || "—");
    reportRows.append(row);

    if (movement.movement_type === "in") received += movement.quantity;
    else removed += movement.quantity;
  }

  document.querySelector("#report-in").textContent = String(received);
  document.querySelector("#report-out").textContent = String(removed);
  document.querySelector("#report-empty").hidden = selectedMovements.length > 0;
}

function renderCatalog() {
  catalogRows.replaceChildren();

  for (const item of catalog) {
    const row = document.createElement("tr");
    appendCell(row, item.name);
    appendCell(row, item.category);
    const actions = document.createElement("td");
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "table-action";
    editButton.dataset.editId = item.id;
    editButton.textContent = "Edit";
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "table-action";
    removeButton.dataset.removeId = item.id;
    removeButton.textContent = "Remove";
    actions.append(editButton, document.createTextNode(" "), removeButton);
    row.append(actions);
    catalogRows.append(row);
  }

  catalogEmpty.hidden = catalog.length > 0;
}

function renderEnquiries(enquiries) {
  enquiriesRows.replaceChildren();

  for (const enquiry of enquiries) {
    const row = document.createElement("tr");
    appendCell(row, new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(enquiry.created_at)));
    appendCell(row, enquiry.name);
    appendCell(row, [enquiry.email, enquiry.phone].filter(Boolean).join("\n"), "enquiry-contact");
    appendCell(row, enquiry.interest);
    appendCell(row, enquiry.details, "enquiry-details-cell");

    const statusCell = document.createElement("td");
    const statusSelect = document.createElement("select");
    statusSelect.className = "enquiry-status";
    statusSelect.dataset.enquiryId = enquiry.id;
    for (const status of ["new", "contacted", "closed"]) {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status[0].toUpperCase() + status.slice(1);
      statusSelect.append(option);
    }
    statusSelect.value = enquiry.status;
    statusCell.append(statusSelect);
    row.append(statusCell);
    enquiriesRows.append(row);
  }

  enquiriesEmpty.hidden = enquiries.length > 0;
}

async function loadDashboard() {
  const [inventoryResponse, movementsResponse, catalogResponse, enquiriesResponse] = await Promise.all([
    supabase.from("inventory_items").select("id, name, category, variant, quantity, reorder_at").order("name"),
    supabase.from("stock_movements").select("id, item_id, item_name, variant, movement_type, quantity, note, created_at").order("created_at", { ascending: false }),
    supabase.from("catalog_items").select("id, name, category, description, image_url, sort_order, created_at").order("sort_order").order("created_at", { ascending: false }),
    supabase.from("enquiries").select("id, name, email, phone, interest, details, status, created_at").order("created_at", { ascending: false })
  ]);
  const responses = [inventoryResponse, movementsResponse, catalogResponse, enquiriesResponse];
  const failed = responses.find((response) => response.error);
  if (failed) throw failed.error;

  inventory = inventoryResponse.data;
  movements = movementsResponse.data;
  catalog = catalogResponse.data;
  renderInventory();
  renderCatalog();
  renderEnquiries(enquiriesResponse.data);
}

function subscribeToChanges() {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);

  realtimeChannel = supabase
    .channel("studio-live-updates")
    .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, () => {
      loadDashboard().catch((error) => showStatus(errorText(error, "Could not refresh the studio dashboard.")));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements" }, () => {
      loadDashboard().catch((error) => showStatus(errorText(error, "Could not refresh the studio dashboard.")));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "catalog_items" }, () => {
      loadDashboard().catch((error) => showStatus(errorText(error, "Could not refresh the studio dashboard.")));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "enquiries" }, () => {
      loadDashboard().catch((error) => showStatus(errorText(error, "Could not refresh the studio dashboard.")));
    })
    .subscribe((state) => {
      if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
        showStatus("Live updates are disconnected. Refresh the page to reconnect.");
      }
    });
}

async function handleAuthChange(session) {
  if (!session) {
    activeUserId = undefined;
    if (realtimeChannel) {
      await supabase.removeChannel(realtimeChannel);
      realtimeChannel = undefined;
    }
    dashboardApp.hidden = true;
    signInSection.hidden = false;
    signOutButton.hidden = true;
    return;
  }

  if (activeUserId === session.user.id && !dashboardApp.hidden) return;

  const { data: isAdmin, error } = await supabase.rpc("is_studio_admin");
  if (error || !isAdmin) {
    activeUserId = undefined;
    dashboardApp.hidden = true;
    signInSection.hidden = false;
    signOutButton.hidden = false;
    showStatus(error
      ? errorText(error, "Could not verify studio access.")
      : "This account does not have studio administrator access.");
    return;
  }

  activeUserId = session.user.id;
  signInSection.hidden = true;
  dashboardApp.hidden = false;
  signOutButton.hidden = false;

  try {
    await loadDashboard();
    subscribeToChanges();
    showStatus("Signed in. Stock, enquiries, and product changes sync live.");
  } catch (loadError) {
    showStatus(errorText(loadError, "Could not load studio data."));
  }
}

function formInteger(formData, name, minimum, maximum) {
  const value = Number(formData.get(name));
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error("Please enter a valid whole number for each stock quantity.");
  }
  return value;
}

function setCatalogEdit(item) {
  catalogForm.elements.id.value = item.id;
  catalogForm.elements.name.value = item.name;
  catalogForm.elements.category.value = item.category;
  catalogForm.elements.description.value = item.description;
  catalogForm.elements.imageUrl.value = item.image_url;
  document.querySelector("#save-catalog-item").textContent = "Save product";
  document.querySelector("#cancel-catalog-edit").hidden = false;
  catalogForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetCatalogForm() {
  catalogForm.reset();
  catalogForm.elements.id.value = "";
  document.querySelector("#save-catalog-item").textContent = "Publish product";
  document.querySelector("#cancel-catalog-edit").hidden = true;
}

function csvCell(value) {
  const text = String(value);
  const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function downloadReport() {
  const selectedDate = reportDate.value;
  const selectedMovements = movements
    .filter((movement) => localDateKey(new Date(movement.created_at)) === selectedDate)
    .sort((first, second) => Date.parse(first.created_at) - Date.parse(second.created_at));
  const rows = [
    ["Date", "Time", "Garment", "Size / variant", "Movement", "Pieces", "Note"],
    ...selectedMovements.map((movement) => [
      selectedDate,
      new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(movement.created_at)),
      movement.item_name,
      movement.variant,
      movement.movement_type === "in" ? "Stock received" : "Sold / removed",
      movement.quantity,
      movement.note
    ])
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const file = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lafrista-stock-report-${selectedDate}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showStatus(`Daily report for ${selectedDate} downloaded.`);
}

reportDate.value = localDateKey(new Date());
reportDate.addEventListener("change", renderReport);
document.querySelector("#download-report").addEventListener("click", downloadReport);

if (!supabase) {
  signInSection.hidden = true;
  showStatus(isSupabaseConfigured
    ? "The studio connection could not be loaded. Check your internet connection and try again."
    : "The studio backend is not configured yet. Follow the Supabase setup in README.md to enable this dashboard.");
} else {
  signInForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!signInForm.reportValidity()) return;

    const details = new FormData(signInForm);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(details.get("email")).trim(),
      password: String(details.get("password"))
    });

    if (error) showStatus(errorText(error, "Sign in failed."));
    else {
      signInForm.reset();
      showStatus("Checking studio access…");
    }
  });

  signOutButton.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) showStatus(errorText(error, "Sign out failed."));
    else showStatus("You are signed out.");
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    void handleAuthChange(session);
  });

  supabase.auth.getSession()
    .then(({ data, error }) => {
      if (error) showStatus(errorText(error, "Could not restore your sign-in."));
      else return handleAuthChange(data.session);
    })
    .catch((error) => showStatus(errorText(error, "Could not restore your sign-in.")));

  addItemForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!addItemForm.reportValidity()) return;

    const details = new FormData(addItemForm);
    const name = String(details.get("name")).trim();
    const category = String(details.get("category"));
    const variant = String(details.get("variant")).trim();
    let quantity;
    let reorderAt;
    try {
      quantity = formInteger(details, "quantity", 0, 999999);
      reorderAt = formInteger(details, "reorderAt", 0, 999999);
    } catch (error) {
      showStatus(errorText(error, "Enter valid stock quantities."));
      return;
    }

    if (!name || !variant) {
      showStatus("Enter both a garment name and size or variant.");
      return;
    }
    const duplicate = inventory.some((item) =>
      item.category.toLowerCase() === category.toLowerCase()
      && item.name.toLowerCase() === name.toLowerCase()
      && item.variant.toLowerCase() === variant.toLowerCase());
    if (duplicate) {
      showStatus("That garment and size are already in your inventory.");
      return;
    }

    const { error } = await supabase.rpc("add_inventory_item", {
      p_name: name,
      p_category: category,
      p_variant: variant,
      p_quantity: quantity,
      p_reorder_at: reorderAt
    });

    if (error) {
      showStatus(errorText(error, "Could not add that garment."));
      return;
    }

    addItemForm.reset();
    showStatus(`${name} (${variant}) added to inventory.`);
  });

  movementForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!movementForm.reportValidity()) return;

    const details = new FormData(movementForm);
    const itemId = String(details.get("itemId"));
    const item = inventory.find((entry) => entry.id === itemId);
    if (!item) {
      showStatus("Choose a garment that is still in inventory.");
      return;
    }

    let quantity;
    try {
      quantity = formInteger(details, "quantity", 1, 999999);
    } catch (error) {
      showStatus(errorText(error, "Enter a valid stock quantity."));
      return;
    }
    const { error } = await supabase.rpc("record_stock_movement", {
      p_item_id: item.id,
      p_type: String(details.get("type")),
      p_quantity: quantity,
      p_note: String(details.get("note") || "").trim()
    });

    if (error) {
      showStatus(errorText(error, "Could not save the stock movement."));
      return;
    }

    movementForm.reset();
    showStatus("Stock movement saved.");
  });

  inventoryRows.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-delete-id]");
    if (!button) return;

    const item = inventory.find((entry) => entry.id === button.dataset.deleteId);
    if (!item || !window.confirm(`Remove ${item.name} (${item.variant})? Its movement history will remain.`)) return;

    const { error } = await supabase.from("inventory_items").delete().eq("id", item.id);
    showStatus(error
      ? errorText(error, "Could not remove that garment.")
      : `${item.name} (${item.variant}) removed. Its movement history was kept.`);
  });

  catalogForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!catalogForm.reportValidity()) return;

    const details = new FormData(catalogForm);
    const imageUrl = String(details.get("imageUrl") || "").trim();
    if (imageUrl) {
      try {
        if (new URL(imageUrl).protocol !== "https:") throw new Error();
      } catch {
        showStatus("Product images must use a valid HTTPS URL.");
        return;
      }
    }

    const id = String(details.get("id") || "");
    const product = {
      name: String(details.get("name")).trim(),
      category: String(details.get("category")).trim(),
      description: String(details.get("description")).trim(),
      image_url: imageUrl
    };
    const request = id
      ? supabase.from("catalog_items").update(product).eq("id", id)
      : supabase.from("catalog_items").insert({
        ...product,
        sort_order: catalog.length
      });
    const { error } = await request;

    if (error) {
      showStatus(errorText(error, "Could not save that product."));
      return;
    }

    resetCatalogForm();
    showStatus(id ? "Product updated on the public website." : "Product published on the public website.");
  });

  catalogRows.addEventListener("click", async (event) => {
    const editButton = event.target.closest("button[data-edit-id]");
    if (editButton) {
      const item = catalog.find((entry) => entry.id === editButton.dataset.editId);
      if (item) setCatalogEdit(item);
      return;
    }

    const removeButton = event.target.closest("button[data-remove-id]");
    if (!removeButton) return;
    const item = catalog.find((entry) => entry.id === removeButton.dataset.removeId);
    if (!item || !window.confirm(`Remove ${item.name} from the public website?`)) return;

    const { error } = await supabase.from("catalog_items").delete().eq("id", item.id);
    showStatus(error
      ? errorText(error, "Could not remove that product.")
      : `${item.name} removed from the public website.`);
    if (!error && catalogForm.elements.id.value === item.id) resetCatalogForm();
  });

  document.querySelector("#cancel-catalog-edit").addEventListener("click", resetCatalogForm);

  enquiriesRows.addEventListener("change", async (event) => {
    const select = event.target.closest("select[data-enquiry-id]");
    if (!select) return;

    const { error } = await supabase
      .from("enquiries")
      .update({ status: select.value })
      .eq("id", select.dataset.enquiryId);

    if (error) {
      showStatus(errorText(error, "Could not update the enquiry status."));
      await loadDashboard().catch((loadError) => showStatus(errorText(loadError, "Could not refresh the enquiries.")));
    } else {
      showStatus("Enquiry status updated.");
    }
  });
}
