const form = document.getElementById("signup-form");
const list = document.getElementById("signup-list");
const stats = document.getElementById("stats");
const adminLoginForm = document.getElementById("admin-login-form");
const adminPasswordInput = document.getElementById("admin-password");
const eventForm = document.getElementById("event-form");
const eventTitle = document.getElementById("event-title");
const rosterDetails = document.getElementById("roster-details");
const eventDateInput = document.getElementById("event-date");
const eventLocationInput = document.getElementById("event-location");
const adminStatus = document.getElementById("admin-status");
const adminOnlyElements = document.querySelectorAll(".admin-only");
const adminToggleButton = document.getElementById("admin-toggle");
const adminPanel = document.getElementById("admin-panel");
const adminSignOutButton = document.getElementById("admin-signout");
const adminAuthSuccess = document.getElementById("admin-auth-success");
const signupModal = document.getElementById("signup-modal");
const openSignupModalButton = document.getElementById("open-signup-modal");
const closeSignupModalButton = document.getElementById("close-signup-modal");
const signupMessage = document.getElementById("signup-message");
const itemTypeSelect = document.getElementById("item-type");
const submitButton = form.querySelector('button[type="submit"]');

let signups = [];
let eventData = { title: "School Group Signup", date: "", location: "" };
let adminToken = "";
let adminPanelOpen = false;

localStorage.removeItem("school-signup-admin-token");
window.addEventListener("beforeunload", () => {
  localStorage.removeItem("school-signup-admin-token");
});

function openSignupModal() {
  signupModal.classList.remove("hidden");
}

function closeSignupModal() {
  signupModal.classList.add("hidden");
  form.reset();
  clearSignupMessage();
}

function clearSignupMessage() {
  signupMessage.textContent = "";
  signupMessage.classList.remove("error");
  if (submitButton) {
    submitButton.disabled = false;
  }
}

function updateSignupAvailability() {
  const claimedTypes = new Set(signups.map((signup) => signup.itemType));
  const selectedValue = itemTypeSelect.value;

  Array.from(itemTypeSelect.options).forEach((option) => {
    if (!option.value) {
      return;
    }

    const isClaimed = claimedTypes.has(option.value);
    option.disabled = isClaimed && option.value !== selectedValue;
    if (isClaimed && option.value !== selectedValue) {
      option.textContent = `${option.value} (taken)`;
    } else if (option.textContent.includes("(taken)")) {
      option.textContent = option.value;
    }
  });

  const isClaimedSelection = selectedValue && claimedTypes.has(selectedValue);
  if (isClaimedSelection) {
    signupMessage.textContent = `${selectedValue} is already taken. Please choose a different option.`;
    signupMessage.classList.add("error");
    if (submitButton) {
      submitButton.disabled = true;
    }
  } else {
    clearSignupMessage();
  }
}

openSignupModalButton.addEventListener("click", openSignupModal);
closeSignupModalButton.addEventListener("click", closeSignupModal);
itemTypeSelect.addEventListener("change", updateSignupAvailability);
signupModal.addEventListener("click", (event) => {
  if (event.target === signupModal) {
    closeSignupModal();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const response = await fetch("/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: formData.get("name").toString().trim(),
      itemType: formData.get("itemType").toString().trim(),
      notes: formData.get("notes").toString().trim(),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    signupMessage.textContent = errorData.error || "There was a problem saving the signup.";
    signupMessage.classList.add("error");
    if (submitButton) {
      submitButton.disabled = true;
    }
    return;
  }

  form.reset();
  closeSignupModal();
  await loadData();
});

adminToggleButton.addEventListener("click", () => {
  adminPanelOpen = !adminPanelOpen;
  adminPanel.classList.toggle("hidden", !adminPanelOpen);
});

adminSignOutButton.addEventListener("click", () => {
  adminToken = "";
  adminPasswordInput.value = "";
  localStorage.removeItem("school-signup-admin-token");
  updateAdminUI();
  render();
  adminPanel.classList.add("hidden");
  adminPanelOpen = false;
});

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const response = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: adminPasswordInput.value }),
  });

  if (!response.ok) {
    alert("Invalid admin password.");
    return;
  }

  const data = await response.json();
  adminToken = data.token;
  localStorage.setItem("school-signup-admin-token", adminToken);
  adminPasswordInput.value = "";
  updateAdminUI();
  adminAuthSuccess.classList.remove("hidden");
  await loadData();
});

eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const response = await fetch("/api/event", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": adminToken,
    },
    body: JSON.stringify({
      title: eventData.title,
      date: eventDateInput.value,
      location: eventLocationInput.value,
    }),
  });

  if (!response.ok) {
    alert("Only an admin can change these event details.");
    return;
  }

  await loadData();
});

list.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) {
    return;
  }

  const signupId = button.getAttribute("data-id");
  const signup = signups.find((item) => item.id === signupId);

  if (!adminToken) {
    const selfRemoveName = window.prompt("Enter your name exactly as you signed up to remove yourself.");
    if (!selfRemoveName) {
      return;
    }

    const response = await fetch("/api/signup/self", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: selfRemoveName.trim() }),
    });

    if (!response.ok) {
      alert("We couldn’t find that name on the signup list.");
      return;
    }

    await loadData();
    return;
  }

  const confirmed = window.confirm(`Remove ${signup?.name || "this person"} from the signup?`);
  if (!confirmed) {
    return;
  }

  const response = await fetch(`/api/signup/${signupId}`, {
    method: "DELETE",
    headers: { "x-admin-token": adminToken },
  });

  if (!response.ok) {
    alert("Unable to remove that signup.");
    return;
  }

  await loadData();
});

async function loadData() {
  const [eventResponse, signupsResponse] = await Promise.all([
    fetch("/api/event"),
    fetch("/api/signups"),
  ]);

  if (eventResponse.ok) {
    eventData = await eventResponse.json();
  }

  if (signupsResponse.ok) {
    signups = await signupsResponse.json();
  }

  render();
}

function render() {
  eventTitle.textContent = "School Group Signup";
  const detailParts = [];
  if (eventData.date) {
    detailParts.push(`Date: ${eventData.date}`);
  }
  if (eventData.location) {
    detailParts.push(`Location: ${eventData.location}`);
  }
  rosterDetails.textContent = detailParts.length ? `Event details: ${detailParts.join(" • ")}` : "Event details will appear here after an admin adds them.";

  eventDateInput.value = eventData.date || "";
  eventLocationInput.value = eventData.location || "";

  updateAdminUI();
  updateSignupAvailability();

  if (!signups.length) {
    list.innerHTML = '<li class="signup-item">No signups yet. Be the first to help!</li>';
    stats.innerHTML = "";
    return;
  }

  const counts = signups.reduce((accumulator, signup) => {
    accumulator[signup.itemType] = (accumulator[signup.itemType] || 0) + 1;
    return accumulator;
  }, {});

  stats.innerHTML = Object.entries(counts)
    .map(([label, count]) => `<span class="badge">${label}: ${count}</span>`)
    .join("");

  list.innerHTML = signups
    .map(
      (signup) => `
        <li class="signup-item">
          <div>
            <strong>${escapeHtml(signup.name)}</strong>
            <div>${escapeHtml(signup.itemType)}</div>
            <small>${escapeHtml(signup.notes || "No extra notes")}</small>
          </div>
          ${adminToken ? `<button class="remove-btn" data-id="${signup.id}">Remove</button>` : ""}
        </li>
      `
    )
    .join("");
}

function updateAdminUI() {
  adminOnlyElements.forEach((element) => {
    element.classList.toggle("is-admin", Boolean(adminToken));
  });
  adminStatus.textContent = adminToken ? "Signed in as admin" : "Not signed in";
  adminToggleButton.textContent = adminToken ? "Admin settings • signed in" : "Admin settings";
  adminSignOutButton.classList.toggle("hidden", !adminToken);
  adminAuthSuccess.classList.toggle("hidden", !adminToken);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

loadData();
