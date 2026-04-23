let dashboardState = null;
let currentAnalysisState = null;
let activeModeState = null;

const DEFAULT_SUBJECTS = ["국어", "영어", "수학", "사회", "과학"];
const SUBJECT_STORAGE_PREFIX = "customSubjects:";

function $(id) {
    return document.getElementById(id);
}

function escapeHtml(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function normalizeSubject(value) {
    return String(value || "").trim();
}

function getUserStorageKey() {
    const email = dashboardState?.user?.email || "guest";
    return `${SUBJECT_STORAGE_PREFIX}${email}`;
}

function getStoredCustomSubjects() {
    try {
        const raw = localStorage.getItem(getUserStorageKey());
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(normalizeSubject).filter(Boolean);
    } catch {
        return [];
    }
}

function saveCustomSubjects(subjects) {
    localStorage.setItem(
        getUserStorageKey(),
        JSON.stringify(subjects.map(normalizeSubject).filter(Boolean))
    );
}

function getAllSubjects() {
    const subjectSet = new Set(DEFAULT_SUBJECTS);

    getStoredCustomSubjects().forEach((subject) => subjectSet.add(subject));

    const wrongNotes = dashboardState?.wrongNotes || [];
    const solvedNotes = dashboardState?.solvedNotes || [];

    [...wrongNotes, ...solvedNotes].forEach((note) => {
        const subject = normalizeSubject(note.subject);
        if (subject) subjectSet.add(subject);
    });

    return Array.from(subjectSet);
}

function isDefaultSubject(subject) {
    return DEFAULT_SUBJECTS.includes(normalizeSubject(subject));
}

function showAuthMessage(text, color = "blue") {
    const el = $("authMessage");
    if (!el) return;
    el.textContent = text;
    el.style.color = color;
}

function showMessage(text, color = "blue") {
    const el = $("messageText");
    if (!el) return;
    el.textContent = text;
    el.style.color = color;
}

function setLoading(isLoading) {
    const analyzeBtn = $("analyzeBtn");
    const checkBtn = $("checkBtn");
    const spinner = $("loadingSpinner");

    if (analyzeBtn) analyzeBtn.disabled = isLoading;
    if (checkBtn) checkBtn.disabled = isLoading;
    if (spinner) spinner.style.display = isLoading ? "inline-block" : "none";
}

function getPlanLabel(plan) {
    if (plan === "premium5900") return "5900원";
    if (plan === "premium8900") return "8900원";
    return "무료";
}

function getCurrentPlanRule() {
    return dashboardState?.planRule || {
        aiDaily: 2,
        storageLimit: 50,
        similarCount: 1,
        reviewEnabled: false,
        duplicateAnalyze: false,
        advancedEnabled: false
    };
}

function updateModeUI() {
    const isSimilar = activeModeState?.type === "similar";
    const isAdvanced = activeModeState?.type === "advanced";
    const hasMode = isSimilar || isAdvanced;

    if ($("similarModeText")) $("similarModeText").hidden = !isSimilar;
    if ($("advancedModeText")) $("advancedModeText").hidden = !isAdvanced;
    if ($("exitModeBtn")) $("exitModeBtn").hidden = !hasMode;
}

function clearActiveMode() {
    activeModeState = null;
    updateModeUI();
}

function clearInputs() {
    if ($("problem")) $("problem").value = "";
    if ($("userAnswer")) $("userAnswer").value = "";
    if ($("correctAnswer")) $("correctAnswer").value = "";
    currentAnalysisState = null;
    clearActiveMode();
    renderCurrentAnalysis();
}

function applyPlanToCurrentAnalysis() {
    if (!dashboardState || !currentAnalysisState) return;

    const rule = getCurrentPlanRule();

    if (Array.isArray(currentAnalysisState.similarProblems)) {
        currentAnalysisState.similarProblems =
            currentAnalysisState.similarProblems.slice(0, rule.similarCount);
    }

    if (!rule.advancedEnabled) {
        currentAnalysisState.advancedProblem = "아직 응용문제가 없습니다.";
        if (activeModeState?.type === "advanced") {
            activeModeState = null;
        }
    }

    renderCurrentAnalysis();
    updateModeUI();
}

function renderCurrentAnalysis() {
    const state = currentAnalysisState || {};

    if ($("resultReason")) $("resultReason").textContent = state.reason || "아직 분석 결과가 없습니다.";
    if ($("resultConcept")) $("resultConcept").textContent = state.concept || "아직 분석 결과가 없습니다.";
    if ($("resultSolution")) $("resultSolution").textContent = state.solution || "아직 분석 결과가 없습니다.";
    if ($("advancedProblemBox")) $("advancedProblemBox").textContent = state.advancedProblem || "아직 응용문제가 없습니다.";

    renderSimilarProblems(state.similarProblems || []);
    updateUpsellTexts(state.similarProblems || []);
}

function updateUpsellTexts(similarProblems) {
    if (!dashboardState) return;

    const plan = dashboardState.user.plan;

    if ($("analysisUpsellText")) {
        if (plan === "free") {
            $("analysisUpsellText").textContent =
                "유료 플랜에서는 유사문제 개수와 복습 기능이 더 늘어납니다.";
        } else {
            $("analysisUpsellText").textContent = "";
        }
    }

    if ($("similarUpsellText")) {
        if (plan === "free") {
            $("similarUpsellText").textContent =
                similarProblems.length >= 1 ? "5900원부터 유사문제가 더 늘어납니다." : "";
        } else if (plan === "premium5900") {
            $("similarUpsellText").textContent =
                "8900원에서는 응용문제와 약한 과목 분석이 추가됩니다.";
        } else {
            $("similarUpsellText").textContent = "";
        }
    }
}

function renderSimilarProblems(items) {
    const box = $("similarProblemsBox");
    if (!box) return;

    box.innerHTML = "";

    if (!items || items.length === 0) {
        box.innerHTML =
            `<div class="problem-item"><div class="problem-item-text">아직 유사문제가 없습니다.</div></div>`;
        return;
    }

    items.forEach((problem, index) => {
        const div = document.createElement("div");
        div.className = "problem-item";
        div.innerHTML = `
            <div class="problem-item-title">유사문제 ${index + 1}</div>
            <div class="problem-item-text">${escapeHtml(problem)}</div>
            <div class="button-row">
                <button type="button" class="secondary-btn" data-index="${index}">이 문제 풀기</button>
            </div>
        `;
        box.appendChild(div);
    });

    box.querySelectorAll("[data-index]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const idx = Number(btn.dataset.index);
            const chosen = currentAnalysisState?.similarProblems?.[idx];
            if (!chosen) return;

            if ($("problem")) $("problem").value = chosen;
            if ($("userAnswer")) $("userAnswer").value = "";
            if ($("correctAnswer")) $("correctAnswer").value = "";
            activeModeState = { type: "similar", sourceIndex: idx };
            updateModeUI();
            showMessage("유사문제를 불러왔습니다. 정답을 직접 입력하고 채점하세요.", "blue");
            $("problem")?.focus();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });
}

function updatePlanLocks() {
    if (!dashboardState) return;
    const rule = dashboardState.planRule;

    if ($("cardRecommend")) $("cardRecommend").hidden = !rule.reviewEnabled;
    if ($("cardTopWrong")) $("cardTopWrong").hidden = !rule.reviewEnabled;
    if ($("cardSummary")) $("cardSummary").hidden = !rule.reviewEnabled;
    if ($("cardSubjectStats")) $("cardSubjectStats").hidden = !rule.reviewEnabled;
    if ($("cardSolved")) $("cardSolved").hidden = !rule.reviewEnabled;
    if ($("cardAdvanced")) $("cardAdvanced").hidden = !rule.advancedEnabled;
}

function renderSubjectManager() {
    const listBox = $("customSubjectList");
    if (!listBox) return;

    const subjects = getAllSubjects();
    listBox.innerHTML = "";

    subjects.forEach((subject) => {
        const item = document.createElement("div");
        item.className = "subject-chip";
        const locked = isDefaultSubject(subject);

        item.innerHTML = `
            <span>${escapeHtml(subject)}</span>
            ${
                locked
                    ? `<span class="subject-chip-fixed">기본</span>`
                    : `<button type="button" class="subject-chip-delete" data-subject="${escapeHtml(subject)}">삭제</button>`
            }
        `;
        listBox.appendChild(item);
    });

    listBox.querySelectorAll("[data-subject]").forEach((btn) => {
        btn.addEventListener("click", () => {
            deleteCustomSubject(btn.dataset.subject);
        });
    });
}

function syncSubjectOptions() {
    const subjectSelect = $("subject");
    const filterSelect = $("filterSubject");
    const subjects = getAllSubjects();

    if (subjectSelect) {
        const selected = subjectSelect.value || "수학";
        subjectSelect.innerHTML = "";

        subjects.forEach((subject) => {
            const option = document.createElement("option");
            option.value = subject;
            option.textContent = subject;
            subjectSelect.appendChild(option);
        });

        if (subjects.includes(selected)) {
            subjectSelect.value = selected;
        } else if (subjects.length > 0) {
            subjectSelect.value = subjects[0];
        }
    }

    if (filterSelect) {
        const selectedFilter = filterSelect.value || "전체";
        filterSelect.innerHTML = "";

        const allOption = document.createElement("option");
        allOption.value = "전체";
        allOption.textContent = "전체";
        filterSelect.appendChild(allOption);

        subjects.forEach((subject) => {
            const option = document.createElement("option");
            option.value = subject;
            option.textContent = subject;
            filterSelect.appendChild(option);
        });

        if (selectedFilter === "전체" || subjects.includes(selectedFilter)) {
            filterSelect.value = selectedFilter;
        } else {
            filterSelect.value = "전체";
        }
    }

    renderSubjectManager();
}

function addCustomSubject() {
    const input = $("newSubjectInput");
    if (!input) return;

    const value = normalizeSubject(input.value);
    if (!value) {
        showMessage("추가할 과목명을 입력해주세요.", "red");
        return;
    }

    const subjects = getAllSubjects();
    if (subjects.includes(value)) {
        showMessage("이미 있는 과목입니다.", "red");
        return;
    }

    const customSubjects = getStoredCustomSubjects();
    customSubjects.push(value);
    saveCustomSubjects(customSubjects);
    syncSubjectOptions();

    if ($("subject")) $("subject").value = value;
    input.value = "";
    showMessage(`"${value}" 과목을 추가했습니다.`, "green");
}

function deleteCustomSubject(subject) {
    const clean = normalizeSubject(subject);
    if (!clean) return;

    if (isDefaultSubject(clean)) {
        showMessage("기본 과목은 삭제할 수 없습니다.", "red");
        return;
    }

    const isUsed =
        (dashboardState?.wrongNotes || []).some((note) => normalizeSubject(note.subject) === clean) ||
        (dashboardState?.solvedNotes || []).some((note) => normalizeSubject(note.subject) === clean);

    if (isUsed) {
        showMessage("이 과목은 저장된 문제에 사용 중이라 삭제할 수 없습니다.", "red");
        return;
    }

    const updated = getStoredCustomSubjects().filter((item) => normalizeSubject(item) !== clean);
    saveCustomSubjects(updated);
    syncSubjectOptions();
    showMessage(`"${clean}" 과목을 삭제했습니다.`, "blue");
}

function getFilteredAndSortedWrongNotes() {
    if (!dashboardState) return [];

    let notes = [...(dashboardState.wrongNotes || [])];
    const filterSubject = $("filterSubject")?.value || "전체";
    const search = ($("searchInput")?.value || "").trim().toLowerCase();
    const sortType = $("sortType")?.value || "latest";

    if (filterSubject !== "전체") {
        notes = notes.filter((note) => normalizeSubject(note.subject) === filterSubject);
    }

    if (search) {
        notes = notes.filter((note) => {
            const typeLabel =
                note.sourceType === "similar"
                    ? "유사문제"
                    : note.sourceType === "advanced"
                    ? "응용문제"
                    : "기본 문제";

            return (
                String(note.problem || "").toLowerCase().includes(search) ||
                String(note.userAnswer || "").toLowerCase().includes(search) ||
                String(note.correctAnswer || "").toLowerCase().includes(search) ||
                String(note.subject || "").toLowerCase().includes(search) ||
                String(note.reason || "").toLowerCase().includes(search) ||
                String(note.concept || "").toLowerCase().includes(search) ||
                String(note.solution || "").toLowerCase().includes(search) ||
                String(typeLabel).toLowerCase().includes(search)
            );
        });
    }

    if (sortType === "latest") {
        notes.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    } else if (sortType === "oldest") {
        notes.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    } else if (sortType === "subject") {
        notes.sort((a, b) => normalizeSubject(a.subject).localeCompare(normalizeSubject(b.subject)));
    } else if (sortType === "repeat") {
        notes.sort((a, b) => (b.repeatWrongCount || 0) - (a.repeatWrongCount || 0));
    }

    return notes;
}

function renderWrongList() {
    const list = $("wrongList");
    if (!list) return;

    const notes = getFilteredAndSortedWrongNotes();
    list.innerHTML = "";

    if (notes.length === 0) {
        list.innerHTML = "<li>조건에 맞는 오답이 없습니다.</li>";
        return;
    }

    notes.forEach((note) => {
        const typeLabel =
            note.sourceType === "similar"
                ? "유사문제"
                : note.sourceType === "advanced"
                ? "응용문제"
                : "기본 문제";

        const li = document.createElement("li");
        li.innerHTML = `
            <div><strong>구분:</strong> ${escapeHtml(typeLabel)}</div>
            <div><strong>과목:</strong> ${escapeHtml(normalizeSubject(note.subject))}</div>
            <div><strong>문제:</strong> ${escapeHtml(note.problem)}</div>
            <div><strong>내 답:</strong> ${escapeHtml(note.userAnswer)}</div>
            <div><strong>정답:</strong> ${escapeHtml(note.correctAnswer)}</div>
            <div><strong>틀린 이유:</strong> ${escapeHtml(note.reason || "-")}</div>
            <div><strong>부족한 개념:</strong> ${escapeHtml(note.concept || "-")}</div>
            <div><strong>해결 방법:</strong> ${escapeHtml(note.solution || "-")}</div>
            <div><strong>반복 횟수:</strong> ${note.repeatWrongCount || 1}</div>
            <div class="item-buttons">
                <button type="button" data-retry="${note.id}">다시풀기</button>
                <button type="button" class="delete-item-btn" data-delete="${note.id}">삭제</button>
            </div>
        `;
        list.appendChild(li);
    });

    list.querySelectorAll("[data-retry]").forEach((btn) => {
        btn.addEventListener("click", () => retryWrongNote(btn.dataset.retry));
    });

    list.querySelectorAll("[data-delete]").forEach((btn) => {
        btn.addEventListener("click", () => deleteWrongNote(btn.dataset.delete));
    });
}

function renderSolvedList() {
    const list = $("solvedList");
    if (!list) return;

    const notes = [...(dashboardState?.solvedNotes || [])].sort(
        (a, b) => (b.solvedAt || 0) - (a.solvedAt || 0)
    );

    list.innerHTML = "";

    if (notes.length === 0) {
        list.innerHTML = "<li>복습 완료된 문제가 없습니다.</li>";
        return;
    }

    notes.forEach((note) => {
        const typeLabel =
            note.sourceType === "similar"
                ? "유사문제"
                : note.sourceType === "advanced"
                ? "응용문제"
                : "기본 문제";

        const li = document.createElement("li");
        li.innerHTML = `
            <div><strong>구분:</strong> ${escapeHtml(typeLabel)}</div>
            <div><strong>과목:</strong> ${escapeHtml(normalizeSubject(note.subject))}</div>
            <div><strong>문제:</strong> ${escapeHtml(note.problem)}</div>
            <div><strong>내 답:</strong> ${escapeHtml(note.userAnswer)}</div>
            <div><strong>정답:</strong> ${escapeHtml(note.correctAnswer)}</div>
            <div class="item-buttons">
                <button type="button" data-restore="${note.id}">오답으로 복원</button>
                <button type="button" class="delete-item-btn" data-delete-solved="${note.id}">삭제</button>
            </div>
        `;
        list.appendChild(li);
    });

    list.querySelectorAll("[data-restore]").forEach((btn) => {
        btn.addEventListener("click", () => restoreSolvedNote(btn.dataset.restore));
    });

    list.querySelectorAll("[data-delete-solved]").forEach((btn) => {
        btn.addEventListener("click", () => deleteSolvedNote(btn.dataset.deleteSolved));
    });
}

function renderRecommendedReviews() {
    const box = $("recommendedReviewBox");
    if (!box) return;

    const list = dashboardState?.recommendedReviews || [];
    box.innerHTML = "";

    if (list.length === 0) {
        box.innerHTML =
            `<div class="problem-item"><div class="problem-item-text">추천 복습 문제가 아직 없습니다.</div></div>`;
        return;
    }

    list.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "problem-item";
        div.innerHTML = `
            <div class="problem-item-title">🔥 오늘 복습 ${index + 1}</div>
            <div class="problem-item-text">${escapeHtml(item.problem)}</div>
            <div class="problem-item-sub">${escapeHtml(normalizeSubject(item.subject))} / ${item.repeatWrongCount}회 틀림</div>
        `;
        box.appendChild(div);
    });
}

function renderTopWrongNotes() {
    const box = $("topWrongBox");
    if (!box) return;

    const notes = [...(dashboardState?.wrongNotes || [])];
    box.innerHTML = "";

    if (notes.length === 0) {
        box.innerHTML =
            `<div class="problem-item"><div class="problem-item-text">데이터가 아직 부족합니다.</div></div>`;
        return;
    }

    const sorted = notes
        .sort((a, b) => (b.repeatWrongCount || 0) - (a.repeatWrongCount || 0))
        .slice(0, 3);

    sorted.forEach((note, index) => {
        const div = document.createElement("div");
        div.className = "problem-item";
        div.innerHTML = `
            <div class="problem-item-title">🔥 TOP ${index + 1} (${note.repeatWrongCount || 1}회 틀림)</div>
            <div class="problem-item-text">${escapeHtml(note.problem)}</div>
            <div class="problem-item-sub">${escapeHtml(normalizeSubject(note.subject))}</div>
        `;
        box.appendChild(div);
    });
}

function renderSummaryStats() {
    const wrongNotes = dashboardState?.wrongNotes || [];
    const solvedNotes = dashboardState?.solvedNotes || [];

    const totalWrong = wrongNotes.length;
    const totalSolved = solvedNotes.length;
    const totalHandled = totalWrong + totalSolved;

    const extraSolved = solvedNotes.filter(
        (note) => note.sourceType === "similar" || note.sourceType === "advanced"
    ).length;

    const extraWrong = wrongNotes.filter(
        (note) => note.sourceType === "similar" || note.sourceType === "advanced"
    ).length;

    const totalExtra = extraSolved + extraWrong;

    const accuracy = totalHandled === 0 ? 0 : Math.round((totalSolved / totalHandled) * 100);
    const extraAccuracy = totalExtra === 0 ? 0 : Math.round((extraSolved / totalExtra) * 100);

    if ($("summaryWrongCount")) $("summaryWrongCount").textContent = String(totalWrong);
    if ($("summarySolvedCount")) $("summarySolvedCount").textContent = String(totalSolved);
    if ($("summaryAccuracy")) $("summaryAccuracy").textContent = `${accuracy}%`;
    if ($("summaryExtraAccuracy")) $("summaryExtraAccuracy").textContent = `${extraAccuracy}%`;
}

function renderSubjectStats() {
    const box = $("subjectStats");
    const weaknessBox = $("weaknessBadgeBox");
    if (!box || !weaknessBox) return;

    const wrongNotes = dashboardState?.wrongNotes || [];
    const solvedNotes = dashboardState?.solvedNotes || [];
    const plan = dashboardState?.user?.plan;
    const subjects = getAllSubjects();

    box.innerHTML = "";

    subjects.forEach((subject) => {
        const wrongCount = wrongNotes.filter(
            (note) => normalizeSubject(note.subject) === subject
        ).length;

        const solvedCount = solvedNotes.filter(
            (note) => normalizeSubject(note.subject) === subject
        ).length;

        const extraCount = wrongNotes.filter(
            (note) =>
                normalizeSubject(note.subject) === subject &&
                (note.sourceType === "similar" || note.sourceType === "advanced")
        ).length;

        const card = document.createElement("div");
        card.className = "stats-card";
        card.innerHTML = `
            <div class="stats-title">${escapeHtml(subject)}</div>
            <div class="stats-line">오답: ${wrongCount}개</div>
            <div class="stats-line">복습완료: ${solvedCount}개</div>
            <div class="stats-line">유사/응용 풀이: ${extraCount}개</div>
        `;
        box.appendChild(card);
    });

    if (plan === "premium8900") {
        weaknessBox.hidden = false;

        if (dashboardState.weakestSubject) {
            weaknessBox.innerHTML = `
                ⚠️ <strong>${escapeHtml(normalizeSubject(dashboardState.weakestSubject))}</strong>가 가장 약한 과목입니다.<br>
                👉 이 과목을 먼저 복습하세요
            `;
        } else {
            weaknessBox.textContent = "아직 데이터가 부족합니다.";
        }
    } else {
        weaknessBox.hidden = true;
    }
}

function updateCounts() {
    const wrongNotes = dashboardState?.wrongNotes || [];
    const solvedNotes = dashboardState?.solvedNotes || [];
    const filteredNotes = getFilteredAndSortedWrongNotes();

    if ($("wrongCount")) $("wrongCount").textContent = `오답 개수: ${wrongNotes.length}`;
    if ($("solvedCount")) $("solvedCount").textContent = `복습완료 개수: ${solvedNotes.length}`;
    if ($("filterCount")) {
        $("filterCount").textContent =
            `현재 보기: ${$("filterSubject")?.value || "전체"} / ${filteredNotes.length}개`;
    }
}

function renderDashboard(dashboard) {
    dashboardState = dashboard;

    syncSubjectOptions();

    const remainAi = Math.max(0, dashboard.planRule.aiDaily - dashboard.usageAi.count);
    const storageText =
        dashboard.planRule.storageLimit === Infinity
            ? "무제한"
            : `${dashboard.wrongNotes.length}/${dashboard.planRule.storageLimit}`;

    if ($("welcomeText")) {
        $("welcomeText").textContent =
            `${dashboard.user.name}님 / ${getPlanLabel(dashboard.user.plan)} 요금제`;
    }
    if ($("usageText")) {
        $("usageText").textContent =
            `남은 AI 분석: ${remainAi} / 하루 제한: ${dashboard.planRule.aiDaily}`;
    }
    if ($("slotText")) {
        $("slotText").textContent = `저장 현황: ${storageText}`;
    }

    updatePlanLocks();
    renderRecommendedReviews();
    renderTopWrongNotes();
    renderSummaryStats();
    renderSubjectStats();
    renderWrongList();
    renderSolvedList();
    updateCounts();
    updateModeUI();
}

async function api(url, method = "GET", body = null) {
    const options = {
        method,
        headers: {}
    };

    if (body) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.error || "요청 중 오류가 발생했습니다.");
    }

    return data;
}

function showLoginTab() {
    $("showLoginTab")?.classList.add("active");
    $("showRegisterTab")?.classList.remove("active");
    if ($("loginBox")) $("loginBox").hidden = false;
    if ($("registerBox")) $("registerBox").hidden = true;
    showAuthMessage("");
}

function showRegisterTab() {
    $("showLoginTab")?.classList.remove("active");
    $("showRegisterTab")?.classList.add("active");
    if ($("loginBox")) $("loginBox").hidden = true;
    if ($("registerBox")) $("registerBox").hidden = false;
    showAuthMessage("");
}

async function register() {
    try {
        const data = await api("/api/auth/register", "POST", {
            name: $("registerName")?.value || "",
            email: $("registerEmail")?.value || "",
            password: $("registerPassword")?.value || ""
        });

        if ($("authCard")) $("authCard").hidden = true;
        if ($("appShell")) $("appShell").hidden = false;

        clearInputs();
        currentAnalysisState = null;
        activeModeState = null;

        renderDashboard(data.dashboard);
        showMessage(data.message, "green");
    } catch (error) {
        showAuthMessage(error.message, "red");
    }
}

async function login() {
    try {
        const data = await api("/api/auth/login", "POST", {
            email: $("loginEmail")?.value || "",
            password: $("loginPassword")?.value || ""
        });

        if ($("authCard")) $("authCard").hidden = true;
        if ($("appShell")) $("appShell").hidden = false;

        clearInputs();
        currentAnalysisState = null;
        activeModeState = null;

        renderDashboard(data.dashboard);
        showMessage(data.message, "green");
    } catch (error) {
        showAuthMessage(error.message, "red");
    }
}

async function logout() {
    try {
        await api("/api/auth/logout", "POST");
    } catch {}

    dashboardState = null;
    currentAnalysisState = null;
    activeModeState = null;
    clearInputs();

    if ($("authCard")) $("authCard").hidden = false;
    if ($("appShell")) $("appShell").hidden = true;
    showAuthMessage("로그아웃되었습니다.", "blue");
}

async function loadMe() {
    try {
        const data = await api("/api/auth/me");

        if ($("authCard")) $("authCard").hidden = true;
        if ($("appShell")) $("appShell").hidden = false;

        clearInputs();
        currentAnalysisState = null;
        activeModeState = null;

        renderDashboard(data.dashboard);
    } catch {
        if ($("authCard")) $("authCard").hidden = false;
        if ($("appShell")) $("appShell").hidden = true;
        syncSubjectOptions();
    }
}

async function changePlan(plan) {
    try {
        const data = await api("/api/plan/test-change", "POST", { plan });
        renderDashboard(data.dashboard);
        applyPlanToCurrentAnalysis();
        showMessage("요금제가 변경되어 현재 분석 화면도 새 기준으로 조정되었습니다.", "blue");
    } catch (error) {
        showMessage(error.message, "red");
    }
}

async function resetUsage() {
    try {
        const data = await api("/api/test/reset-usage", "POST");
        renderDashboard(data.dashboard);
        showMessage(data.message, "blue");
    } catch (error) {
        showMessage(error.message, "red");
    }
}

async function analyze() {
    const subject = $("subject")?.value || "";
    const problem = $("problem")?.value.trim() || "";
    const userAnswer = $("userAnswer")?.value.trim() || "";
    const correctAnswer = $("correctAnswer")?.value.trim() || "";

    if (!subject || !problem || !userAnswer || !correctAnswer) {
        showMessage("과목, 문제, 내 답, 정답을 모두 입력해주세요.", "red");
        return;
    }

    const rule = getCurrentPlanRule();

    if (!rule.duplicateAnalyze) {
        const exists = (dashboardState?.wrongNotes || []).some(
            (note) =>
                normalizeSubject(note.subject) === subject &&
                note.problem === problem &&
                note.correctAnswer === correctAnswer
        );

        if (exists) {
            showMessage("무료 요금제에서는 같은 문제를 다시 분석할 수 없습니다.", "red");
            return;
        }
    }

    setLoading(true);
    showMessage("AI 분석 중입니다...", "blue");

    try {
        const data = await api("/api/analyze", "POST", {
            subject,
            problem,
            userAnswer,
            correctAnswer
        });

        currentAnalysisState = data.analysis;
        renderDashboard(data.dashboard);
        applyPlanToCurrentAnalysis();
        showMessage(data.message, "green");
    } catch (error) {
        showMessage(error.message, "red");
    } finally {
        setLoading(false);
    }
}

async function generateAdvancedProblem() {
    const subject = $("subject")?.value || "";
    const problem = $("problem")?.value.trim() || "";

    if (!problem) {
        showMessage("먼저 문제를 입력해주세요.", "red");
        return;
    }

    try {
        showMessage("응용문제를 생성 중입니다...", "blue");

        const data = await api("/api/advanced-problem", "POST", {
            subject,
            problem
        });

        if (!currentAnalysisState) {
            currentAnalysisState = {
                reason: "아직 분석 결과가 없습니다.",
                concept: "아직 분석 결과가 없습니다.",
                solution: "아직 분석 결과가 없습니다.",
                similarProblems: [],
                advancedProblem: data.advancedProblem
            };
        } else {
            currentAnalysisState.advancedProblem = data.advancedProblem;
        }

        renderDashboard(data.dashboard);
        applyPlanToCurrentAnalysis();
        showMessage(data.message, "green");
    } catch (error) {
        showMessage(error.message, "red");
    }
}

async function checkAnswer() {
    const subject = $("subject")?.value || "";
    const problem = $("problem")?.value.trim() || "";
    const userAnswer = $("userAnswer")?.value.trim() || "";
    const correctAnswer = $("correctAnswer")?.value.trim() || "";

    if (!subject || !problem || !userAnswer || !correctAnswer) {
        showMessage("과목, 문제, 내 답, 정답을 모두 입력해주세요.", "red");
        return;
    }

    try {
        const data = await api("/api/notes/check", "POST", {
            subject,
            problem,
            userAnswer,
            correctAnswer,
            currentAnalysis: currentAnalysisState,
            sourceType: activeModeState?.type || "normal"
        });

        if (data.dashboard) {
            renderDashboard(data.dashboard);
        }

        showMessage(data.message, userAnswer === correctAnswer ? "green" : "red");

        if (data.clearInputs) {
            clearInputs();
        }
    } catch (error) {
        showMessage(error.message, "red");
    }
}

async function deleteWrongNote(id) {
    try {
        const data = await api("/api/notes/delete", "POST", { id });
        renderDashboard(data.dashboard);
        showMessage(data.message, "blue");
    } catch (error) {
        showMessage(error.message, "red");
    }
}

async function clearAllWrongNotes() {
    try {
        const data = await api("/api/notes/clear", "POST");
        renderDashboard(data.dashboard);
        showMessage(data.message, "blue");
    } catch (error) {
        showMessage(error.message, "red");
    }
}

async function deleteSolvedNote(id) {
    try {
        const data = await api("/api/solved/delete", "POST", { id });
        renderDashboard(data.dashboard);
        showMessage(data.message, "blue");
    } catch (error) {
        showMessage(error.message, "red");
    }
}

async function restoreSolvedNote(id) {
    try {
        const data = await api("/api/solved/restore", "POST", { id });
        renderDashboard(data.dashboard);
        showMessage(data.message, "blue");
    } catch (error) {
        showMessage(error.message, "red");
    }
}

function retryWrongNote(id) {
    const note = (dashboardState?.wrongNotes || []).find((item) => item.id === id);
    if (!note) return;

    if ($("subject")) $("subject").value = normalizeSubject(note.subject);
    if ($("problem")) $("problem").value = note.problem;
    if ($("userAnswer")) $("userAnswer").value = note.userAnswer;
    if ($("correctAnswer")) $("correctAnswer").value = note.correctAnswer;

    currentAnalysisState = {
        reason: note.reason,
        concept: note.concept,
        solution: note.solution,
        similarProblems: note.similarProblems || [],
        advancedProblem: note.advancedProblem || "아직 응용문제가 없습니다."
    };

    if (note.sourceType === "similar" || note.sourceType === "advanced") {
        activeModeState = { type: note.sourceType };
    } else {
        activeModeState = null;
    }

    applyPlanToCurrentAnalysis();
    renderCurrentAnalysis();
    updateModeUI();

    const rule = getCurrentPlanRule();
    if (!rule.duplicateAnalyze) {
        showMessage("다시풀기를 불러왔습니다. 무료 요금제에서는 같은 문제 재분석이 제한됩니다.", "blue");
    } else {
        showMessage("오답을 다시 불러왔습니다.", "blue");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function getSectionState(key, defaultValue = false) {
    const saved = localStorage.getItem(key);
    if (saved === null) return defaultValue;
    return saved === "true";
}

function setSectionState(key, value) {
    localStorage.setItem(key, String(value));
}

function updateSectionToggle(sectionId, buttonId, collapsed) {
    const section = $(sectionId);
    const button = $(buttonId);

    if (!section || !button) return;

    section.hidden = collapsed;
    button.textContent = collapsed ? "펼치기" : "접기";
}

function toggleWrongSection() {
    const next = !getSectionState("wrongSectionCollapsed", false);
    setSectionState("wrongSectionCollapsed", next);
    updateSectionToggle("wrongSectionBody", "toggleWrongBtn", next);
}

function toggleSolvedSection() {
    const next = !getSectionState("solvedSectionCollapsed", false);
    setSectionState("solvedSectionCollapsed", next);
    updateSectionToggle("solvedSectionBody", "toggleSolvedBtn", next);
}

function applySectionStates() {
    updateSectionToggle(
        "wrongSectionBody",
        "toggleWrongBtn",
        getSectionState("wrongSectionCollapsed", false)
    );

    updateSectionToggle(
        "solvedSectionBody",
        "toggleSolvedBtn",
        getSectionState("solvedSectionCollapsed", false)
    );
}

document.addEventListener("DOMContentLoaded", () => {
    $("showLoginTab")?.addEventListener("click", showLoginTab);
    $("showRegisterTab")?.addEventListener("click", showRegisterTab);
    $("registerBtn")?.addEventListener("click", register);
    $("loginBtn")?.addEventListener("click", login);
    $("logoutBtn")?.addEventListener("click", logout);

    $("checkBtn")?.addEventListener("click", checkAnswer);
    $("analyzeBtn")?.addEventListener("click", analyze);
    $("generateAdvancedBtn")?.addEventListener("click", generateAdvancedProblem);

    $("useAdvancedProblemBtn")?.addEventListener("click", () => {
        const advanced = currentAnalysisState?.advancedProblem;
        if (!advanced || advanced === "아직 응용문제가 없습니다.") {
            showMessage("먼저 응용문제를 생성하세요.", "red");
            return;
        }

        if ($("problem")) $("problem").value = advanced;
        if ($("userAnswer")) $("userAnswer").value = "";
        if ($("correctAnswer")) $("correctAnswer").value = "";
        activeModeState = { type: "advanced" };
        updateModeUI();
        showMessage("응용문제를 불러왔습니다. 정답을 직접 입력하고 채점하세요.", "blue");
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    $("clearInputsBtn")?.addEventListener("click", () => {
        clearInputs();
        showMessage("입력을 초기화했습니다.", "blue");
    });

    $("exitModeBtn")?.addEventListener("click", () => {
        clearActiveMode();
        showMessage("풀이 모드를 종료했습니다.", "blue");
    });

    $("planFree")?.addEventListener("click", () => changePlan("free"));
    $("plan5900")?.addEventListener("click", () => changePlan("premium5900"));
    $("plan8900")?.addEventListener("click", () => changePlan("premium8900"));
    $("resetUsageBtn")?.addEventListener("click", resetUsage);
    $("clearAllBtn")?.addEventListener("click", clearAllWrongNotes);

    $("addSubjectBtn")?.addEventListener("click", addCustomSubject);
    $("newSubjectInput")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addCustomSubject();
        }
    });

    $("filterSubject")?.addEventListener("change", () => {
        renderWrongList();
        updateCounts();
    });

    $("searchInput")?.addEventListener("input", () => {
        renderWrongList();
        updateCounts();
    });

    $("sortType")?.addEventListener("change", () => {
        renderWrongList();
        updateCounts();
    });

    $("toggleWrongBtn")?.addEventListener("click", toggleWrongSection);
    $("toggleSolvedBtn")?.addEventListener("click", toggleSolvedSection);

    syncSubjectOptions();
    applySectionStates();
    loadMe();
});