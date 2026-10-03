const state = {
  interests: ["A. R. Rahman", "Zindagi Na Milegi Dobara", "Leopold Cafe"],
  interestTypes: ["urn:entity:artist", "urn:entity:movie", "urn:entity:place"],
  budget: 2,
  pace: "balanced",
  feedback: { likes: [], dislikes: [] },
};

const personas = {
  mumbai_london: {
    origin: "Mumbai", destination: "London", budget: 2, pace: "balanced",
    interests: ["A. R. Rahman", "Zindagi Na Milegi Dobara", "Leopold Cafe"],
    interestTypes: ["urn:entity:artist", "urn:entity:movie", "urn:entity:place"],
  },
  delhi_newyork: {
    origin: "Delhi", destination: "New York City", budget: 2, pace: "adventurous",
    interests: ["Prateek Kuhad", "The Lunchbox", "Blue Tokai Coffee Roasters | Hauz Khas"],
    interestTypes: ["urn:entity:artist", "urn:entity:movie", "urn:entity:place"],
  },
  bengaluru_berlin: {
    origin: "Bengaluru", destination: "Berlin", budget: 1, pace: "comforting",
    interests: ["The Local Train", "777 Charlie", "Koshy's"],
    interestTypes: ["urn:entity:artist", "urn:entity:movie", "urn:entity:place"],
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function renderChips() {
  $("#interestChips").innerHTML = state.interests.map((interest, index) => `
    <span class="chip">${escapeHtml(interest)}<button type="button" aria-label="Remove ${escapeHtml(interest)}" data-remove="${index}">×</button></span>
  `).join("");
  $("#interestCount").textContent = state.interests.length;
  $$('[data-remove]').forEach((button) => button.addEventListener("click", () => {
    state.interests.splice(Number(button.dataset.remove), 1);
    state.interestTypes.splice(Number(button.dataset.remove), 1);
    renderChips();
  }));
}

function addInterest() {
  const input = $("#interestInput");
  const value = input.value.trim().replace(/,$/, "");
  if (!value || state.interests.length >= 8) return;
  if (!state.interests.some((item) => item.toLowerCase() === value.toLowerCase())) {
    state.interests.push(value);
    state.interestTypes.push($("#interestType").value || null);
  }
  input.value = "";
  renderChips();
}

function selectControl(selector, dataName, value) {
  $$(selector).forEach((button) => button.classList.toggle("selected", button.dataset[dataName] === String(value)));
}

function applyPersona(key) {
  const persona = personas[key];
  $("#origin").value = persona.origin;
  $("#destination").value = persona.destination;
  state.interests = [...persona.interests];
  state.interestTypes = [...persona.interestTypes];
  state.budget = persona.budget;
  state.pace = persona.pace;
  state.feedback = { likes: [], dislikes: [] };
  renderChips();
  selectControl("[data-budget]", "budget", state.budget);
  selectControl("[data-pace]", "pace", state.pace);
  $$('[data-persona]').forEach((button) => button.classList.toggle("active", button.dataset.persona === key));
}

async function checkMode() {
  try {
    const response = await fetch("/api/health");
    const health = await response.json();
    const configured = health.qloo === "configured";
    $("#modePill").innerHTML = `<span class="pulse"></span>${configured ? "Qloo key configured" : "Illustrative demo"}`;
    $("#modePill").classList.toggle("live", configured);
  } catch {
    $("#modePill").textContent = "Offline";
  }
}

function recommendationIcon(key) {
  return { places: "⌖", artists: "♪", movies: "▶" }[key] ?? "✦";
}

function recommendationTitle(key) {
  return { places: "Places to make yours", artists: "A soundtrack for this chapter", movies: "Stories for the transition" }[key] ?? key;
}

function renderGroups(groups, mode) {
  const entries = Object.entries(groups).filter(([, items]) => items.length);
  $("#recommendationGroups").innerHTML = entries.map(([key, items]) => `
    <section class="recommendation-group">
      <div class="group-title"><span>${recommendationIcon(key)}</span><h4>${recommendationTitle(key)}</h4></div>
      <div class="recommendation-list">
        ${items.map((item, index) => `
          <article class="recommendation-card">
            <div class="recommendation-index">0${index + 1}</div>
            <div class="recommendation-body">
              <div class="recommendation-top"><h5>${escapeHtml(item.name)}</h5><span>${escapeHtml(item.confidence)}</span></div>
              ${item.location ? `<p class="location">${escapeHtml(item.location)}</p>` : ""}
              <p class="bridge-reason">${escapeHtml(item.bridge)}</p>
              <p class="evidence-line"><span>${escapeHtml(item.evidence?.source ?? "Source unavailable")}</span>${escapeHtml((item.evidence?.anchors ?? []).join(" · "))}</p>
              <div class="tag-row">${(item.tags ?? []).slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
              ${mode === "live" ? `<div class="feedback-actions" aria-label="Refine with ${escapeHtml(item.name)}">
                <button type="button" data-feedback="like" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(item.name)}" data-type="${escapeHtml(item.type)}">+ More like this</button>
                <button type="button" data-feedback="dislike" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(item.name)}" data-type="${escapeHtml(item.type)}">− Not my vibe</button>
              </div>` : ""}
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
}

function renderResult(data) {
  $("#modePill").innerHTML = `<span class="pulse"></span>${data.mode === "live" ? "Live Qloo" : "Illustrative demo"}`;
  $("#modePill").classList.toggle("live", data.mode === "live");
  $("#resultHeadline").textContent = data.headline;
  $("#resultSummary").textContent = data.summary;
  $("#fingerprint").innerHTML = data.tasteFingerprint.map((item) => `
    <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.type)}</small></span>
  `).join("");
  $("#statGrid").innerHTML = `
    <div><strong>${data.stats.anchorsResolved}</strong><span>taste anchors resolved</span></div>
    <div><strong>${data.stats.categoriesBridged}</strong><span>life domains translated</span></div>
    <div><strong>${data.stats.recommendationsConsidered}</strong><span>candidates considered</span></div>
    <div><strong>${data.mode === "live" ? "LIVE" : "DEMO"}</strong><span>Qloo data mode</span></div>
  `;
  renderGroups(data.groups, data.mode);
  $("#weekPlan").innerHTML = data.firstWeek.map((item) => `
    <article><div><span>${escapeHtml(item.day)}</span><small>${escapeHtml(item.kind)}</small></div><p>${escapeHtml(item.action)}</p><b>↗</b></article>
  `).join("");
  $("#agentTrace").innerHTML = data.trace.map((item, index) => `
    <div class="trace-row"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(item.step)}</strong><small>${escapeHtml(item.detail)}</small></div><b>✓</b></div>
  `).join("");

  const notice = $("#demoNotice");
  const unresolvedText = data.unresolved?.length
    ? `Could not identify these anchors confidently: ${data.unresolved.join(", ")}. Remove or reword them for a stronger plan.`
    : "";
  const noticeText = [data.warning, unresolvedText, data.refinement?.message].filter(Boolean).join(" ");
  notice.classList.toggle("hidden", !noticeText);
  notice.classList.toggle("refinement", Boolean(data.refinement && !data.warning));
  notice.textContent = noticeText;
  $$('[data-feedback]').forEach((button) => button.addEventListener("click", () => refinePlan(button)));
  $("#loadingPanel").classList.add("hidden");
  $("#resultShell").classList.remove("hidden");
  $("#resultShell").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function buildPlan(event) {
  event?.preventDefault();
  addInterest();
  $("#formError").textContent = "";
  if (state.interests.length < 2) {
    $("#formError").textContent = "Add at least two cultural anchors.";
    return;
  }
  const payload = {
    origin: $("#origin").value.trim(),
    destination: $("#destination").value.trim(),
    interests: state.interests,
    interestTypes: state.interestTypes,
    budget: state.budget,
    pace: state.pace,
    feedback: state.feedback,
  };
  $("#resultShell").classList.add("hidden");
  $("#loadingPanel").classList.remove("hidden");
  $("#loadingPanel").scrollIntoView({ behavior: "smooth", block: "center" });
  const steps = ["Resolving your taste anchors…", "Crossing cultural domains…", "Applying local constraints…", "Writing your belonging plan…"];
  let step = 0;
  const timer = setInterval(() => {
    step = Math.min(step + 1, steps.length - 1);
    $("#loadingTitle").textContent = steps[step];
    $$(".loading-steps span").forEach((node, index) => node.classList.toggle("active", index <= step));
  }, 650);
  try {
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "The cultural bridge could not be built.");
    renderResult(data);
  } catch (error) {
    $("#loadingPanel").classList.add("hidden");
    $("#formError").textContent = error.message;
    $("#builderTitle").scrollIntoView({ behavior: "smooth" });
  } finally {
    clearInterval(timer);
  }
}

function refinePlan(button) {
  const item = { id: button.dataset.id, name: button.dataset.name, type: button.dataset.type };
  const likes = state.feedback.likes.filter((entry) => entry.id !== item.id);
  const dislikes = state.feedback.dislikes.filter((entry) => entry.id !== item.id);
  if (button.dataset.feedback === "like") likes.push(item);
  else dislikes.push(item);
  state.feedback = { likes, dislikes };
  buildPlan();
}

$("#interestInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault();
    addInterest();
  }
});

$$('[data-persona]').forEach((button) => button.addEventListener("click", () => applyPersona(button.dataset.persona)));
$$('[data-budget]').forEach((button) => button.addEventListener("click", () => {
  state.budget = Number(button.dataset.budget);
  selectControl("[data-budget]", "budget", state.budget);
}));
$$('[data-pace]').forEach((button) => button.addEventListener("click", () => {
  state.pace = button.dataset.pace;
  selectControl("[data-pace]", "pace", state.pace);
}));
$("#bridgeForm").addEventListener("submit", buildPlan);
$("#startOver").addEventListener("click", () => {
  $("#resultShell").classList.add("hidden");
  $("#builderTitle").scrollIntoView({ behavior: "smooth" });
});

renderChips();
checkMode();
