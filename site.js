import { isSupabaseConfigured, supabase } from "./supabase-client.js";

const inquiryForm = document.querySelector("#inquiry-form");
const formNote = document.querySelector("#form-note");
const catalogSection = document.querySelector("#live-catalog");
const catalogGrid = document.querySelector("#live-catalog-items");
const catalogStatus = document.querySelector("#live-catalog-status");

formNote.textContent = supabase
  ? "Your enquiry is sent securely to the Lafrista studio."
  : "Online submissions are not connected yet. Your enquiry will open as an email draft instead.";

function showInquiryMessage(message, isError) {
  formNote.textContent = message;
  formNote.classList.toggle("form-note-error", isError);
}

function renderCatalog(items) {
  catalogGrid.replaceChildren();

  for (const item of items) {
    const article = document.createElement("article");
    article.className = "product-card";

    const imageLink = document.createElement("a");
    imageLink.className = "product-image image-sand";
    imageLink.href = "#inquiry";
    imageLink.setAttribute("aria-label", `Ask about ${item.name}`);

    if (item.image_url) {
      const image = document.createElement("img");
      image.src = item.image_url;
      image.alt = item.name;
      image.loading = "lazy";
      imageLink.append(image);
    }

    const tag = document.createElement("span");
    tag.className = "product-tag";
    tag.textContent = item.category;
    imageLink.append(tag);

    const details = document.createElement("div");
    details.className = "product-info";
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = item.name;
    const description = document.createElement("p");
    description.textContent = item.description;
    copy.append(title, description);
    details.append(copy);

    const enquire = document.createElement("a");
    enquire.className = "product-price";
    enquire.href = "#inquiry";
    enquire.textContent = "Enquire ↗";
    enquire.setAttribute("aria-label", `Enquire about ${item.name}`);
    details.append(enquire);

    article.append(imageLink, details);
    catalogGrid.append(article);
  }

  catalogSection.hidden = items.length === 0;
}

async function loadCatalog() {
  const { data, error } = await supabase
    .from("catalog_items")
    .select("id, name, category, description, image_url")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load Lafrista's live catalog.", error);
    catalogSection.hidden = false;
    catalogStatus.hidden = false;
    catalogStatus.textContent = "The live catalog is temporarily unavailable. Please contact us about current products.";
    return;
  }

  catalogStatus.hidden = true;
  renderCatalog(data);
}

if (supabase) {
  loadCatalog().catch((error) => {
    console.error("Could not load Lafrista's live catalog.", error);
    catalogSection.hidden = false;
    catalogStatus.hidden = false;
    catalogStatus.textContent = "The live catalog is temporarily unavailable. Please contact us about current products.";
  });
  supabase
    .channel("public-catalog")
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "catalog_items"
    }, loadCatalog)
    .subscribe();
} else if (isSupabaseConfigured) {
  catalogSection.hidden = false;
  catalogStatus.hidden = false;
  catalogStatus.textContent = "The live catalog is temporarily unavailable. Please contact us about current products.";
}

inquiryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!inquiryForm.reportValidity()) return;

  const details = new FormData(inquiryForm);
  const enquiry = {
    name: String(details.get("name")).trim(),
    email: String(details.get("email")).trim(),
    phone: String(details.get("phone") || "").trim(),
    interest: String(details.get("interest")),
    details: String(details.get("details")).trim()
  };

  if (!supabase) {
    const subject = `Lafrista design enquiry: ${enquiry.interest}`;
    const body = [
      `Name: ${enquiry.name}`,
      `Email: ${enquiry.email}`,
      `Phone: ${enquiry.phone || "Not provided"}`,
      `Interested in: ${enquiry.interest}`,
      "",
      "About my idea:",
      enquiry.details
    ].join("\n");
    showInquiryMessage("The online enquiry form is not connected yet. Your email draft is ready; review it and press Send.", false);
    window.location.href = `mailto:fridahwanjawa600@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return;
  }

  const submitButton = inquiryForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  showInquiryMessage("Sending your enquiry…", false);

  try {
    const { error } = await supabase.from("enquiries").insert(enquiry);
    if (error) throw error;

    inquiryForm.reset();
    showInquiryMessage("Thank you — your enquiry has been sent to the Lafrista studio.", false);
  } catch (error) {
    console.error("Could not save the Lafrista enquiry.", error);
    showInquiryMessage("We could not send your enquiry just now. Please try again or contact us by email or WhatsApp.", true);
  } finally {
    submitButton.disabled = false;
  }
});
