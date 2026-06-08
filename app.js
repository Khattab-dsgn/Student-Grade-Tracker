(function () {
  'use strict';

  var SESSIONS_KEY = 'gradeflow_sessions';
  var ACTIVE_SESSION_KEY = 'gradeflow_active_session';
  var OLD_STORAGE_KEY = 'gradeflow_courses';
  var MAX_COURSE_NAME_LENGTH = 100;
  var MAX_SCORE = 100;
  var MIN_SCORE = 0;
  var CIRCUMFERENCE = 2 * Math.PI * 42;

  var form = document.getElementById('grade-form');
  var courseNameInput = document.getElementById('course-name');
  var courseScoreInput = document.getElementById('course-score');
  var courseList = document.getElementById('course-list');
  var emptyState = document.getElementById('empty-state');
  var clearAllBtn = document.getElementById('clear-all-btn');
  var avgScoreEl = document.getElementById('average-score');
  var totalCoursesEl = document.getElementById('total-courses');
  var highestScoreEl = document.getElementById('highest-score');
  var lowestScoreEl = document.getElementById('lowest-score');
  var ringProgress = document.getElementById('ring-progress');
  var ringText = document.getElementById('ring-text');
  var toastContainer = document.getElementById('toast-container');
  var searchWrapper = document.getElementById('search-wrapper');
  var searchInput = document.getElementById('search-input');

  var sessionSelect = document.getElementById('session-select');
  var newSessionBtn = document.getElementById('new-session-btn');
  var resultsBtn = document.getElementById('results-btn');
  var resultsModal = document.getElementById('results-modal');
  var resultsBody = document.getElementById('results-body');
  var resultsCloseBtn = document.getElementById('results-close-btn');
  var newSessionModal = document.getElementById('new-session-modal');
  var newSessionNameInput = document.getElementById('new-session-name');
  var newSessionCreateBtn = document.getElementById('new-session-create-btn');
  var newSessionCancelBtn = document.getElementById('new-session-cancel-btn');
  var newSessionCloseBtn = document.getElementById('new-session-close-btn');

  var sessions = [];
  var activeSessionId = null;
  var courses = [];

  function sanitizeCourseName(raw) {
    return String(raw).trim().slice(0, MAX_COURSE_NAME_LENGTH);
  }

  function sanitizeSessionName(raw) {
    return String(raw).trim().slice(0, 100) || 'Untitled Session';
  }

  function clampScore(val) {
    var num = parseFloat(val);
    if (Number.isNaN(num)) return null;
    return Math.round(Math.min(MAX_SCORE, Math.max(MIN_SCORE, num)) * 10) / 10;
  }

  function getLetterGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  function getGradeClass(letter) {
    return 'grade-' + letter.toLowerCase();
  }

  function formatScore(score) {
    return score % 1 === 0 ? score.toString() : score.toFixed(1);
  }

  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function getActiveSession() {
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].id === activeSessionId) return sessions[i];
    }
    return null;
  }

  function saveSessions() {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch (_) {}
  }

  function saveActiveSessionId() {
    try {
      if (activeSessionId) {
        localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
      } else {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      }
    } catch (_) {}
  }

  function migrateOldData() {
    try {
      var oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
      if (!oldRaw) return false;
      var oldParsed = JSON.parse(oldRaw);
      if (!Array.isArray(oldParsed) || oldParsed.length === 0) {
        localStorage.removeItem(OLD_STORAGE_KEY);
        return false;
      }
      var valid = oldParsed.filter(function (c) {
        return (
          c &&
          typeof c.name === 'string' &&
          typeof c.score === 'number' &&
          c.score >= MIN_SCORE &&
          c.score <= MAX_SCORE &&
          typeof c.id === 'string' &&
          typeof c.addedAt === 'number'
        );
      });
      if (valid.length === 0) {
        localStorage.removeItem(OLD_STORAGE_KEY);
        return false;
      }
      var session = {
        id: generateId(),
        name: 'Default Session',
        createdAt: Date.now(),
        courses: valid,
      };
      sessions.push(session);
      activeSessionId = session.id;
      saveSessions();
      saveActiveSessionId();
      localStorage.removeItem(OLD_STORAGE_KEY);
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadSessions() {
    try {
      var raw = localStorage.getItem(SESSIONS_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (s) {
        if (!s || typeof s.id !== 'string' || typeof s.name !== 'string' || typeof s.createdAt !== 'number') return false;
        if (!Array.isArray(s.courses)) return false;
        s.courses = s.courses.filter(function (c) {
          return (
            c &&
            typeof c.name === 'string' &&
            typeof c.score === 'number' &&
            c.score >= MIN_SCORE &&
            c.score <= MAX_SCORE &&
            typeof c.id === 'string' &&
            typeof c.addedAt === 'number'
          );
        });
        return true;
      });
    } catch (_) {
      return [];
    }
  }

  function loadActiveSessionId() {
    try {
      var id = localStorage.getItem(ACTIVE_SESSION_KEY);
      return id || null;
    } catch (_) {
      return null;
    }
  }

  function syncCoursesRef() {
    var session = getActiveSession();
    courses = session ? session.courses : [];
  }

  function setActiveSession(id) {
    activeSessionId = id;
    saveActiveSessionId();
    syncCoursesRef();
    renderSessionSelect();
    renderCourses();
  }

  function createSession(name) {
    var safeName = sanitizeSessionName(name);
    if (!safeName) {
      showToast('Please enter a session name.', 'error');
      return null;
    }
    var session = {
      id: generateId(),
      name: safeName,
      createdAt: Date.now(),
      courses: [],
    };
    sessions.push(session);
    saveSessions();
    setActiveSession(session.id);
    return session;
  }

  function deleteSession(id) {
    if (sessions.length <= 1) {
      showToast('Cannot delete the last session.', 'error');
      return;
    }
    sessions = sessions.filter(function (s) { return s.id !== id; });
    if (activeSessionId === id) {
      activeSessionId = sessions[sessions.length - 1].id;
      saveActiveSessionId();
    }
    syncCoursesRef();
    saveSessions();
    renderSessionSelect();
    renderCourses();
  }

  function updateStats() {
    var total = courses.length;
    totalCoursesEl.textContent = total;

    if (total === 0) {
      avgScoreEl.textContent = '\u2014';
      highestScoreEl.textContent = '\u2014';
      lowestScoreEl.textContent = '\u2014';
      ringText.textContent = '\u2014';
      ringProgress.style.strokeDashoffset = CIRCUMFERENCE.toString();
      ringProgress.setAttribute('stroke', '#333');
      return;
    }

    var sum = 0;
    var highest = -Infinity;
    var lowest = Infinity;

    for (var i = 0; i < courses.length; i++) {
      var s = courses[i].score;
      sum += s;
      if (s > highest) highest = s;
      if (s < lowest) lowest = s;
    }

    var avg = sum / total;
    var avgDisplay = formatScore(Math.round(avg * 10) / 10);

    avgScoreEl.textContent = avgDisplay;
    highestScoreEl.textContent = formatScore(highest);
    lowestScoreEl.textContent = formatScore(lowest);

    var offset = CIRCUMFERENCE - (avg / 100) * CIRCUMFERENCE;
    ringProgress.style.strokeDashoffset = offset.toString();
    ringText.textContent = avgDisplay;

    var letter = getLetterGrade(avg);
    var colorMap = { A: '#22d68a', B: '#5cfcc4', C: '#fcc75c', D: '#fc9e5c', F: '#fc5c6a' };
    ringProgress.setAttribute('stroke', colorMap[letter] || '#22c55e');
  }

  function formatSessionDate(ts) {
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function getSessionStats(session) {
    var c = session.courses;
    var total = c.length;
    if (total === 0) {
      return { total: 0, avg: null, highest: null, lowest: null, avgDisplay: '\u2014' };
    }
    var sum = 0;
    var high = -Infinity;
    var low = Infinity;
    for (var i = 0; i < c.length; i++) {
      var s = c[i].score;
      sum += s;
      if (s > high) high = s;
      if (s < low) low = s;
    }
    var avg = sum / total;
    return {
      total: total,
      avg: avg,
      highest: high,
      lowest: low,
      avgDisplay: formatScore(Math.round(avg * 10) / 10),
    };
  }

  function createCourseElement(course, index) {
    var letter = getLetterGrade(course.score);
    var gradeClass = getGradeClass(letter);

    var item = document.createElement('div');
    item.className = 'course-item ' + gradeClass;
    item.setAttribute('data-id', course.id);
    item.style.animationDelay = (index * 50) + 'ms';

    var numEl = document.createElement('span');
    numEl.className = 'course-number';
    numEl.textContent = (index + 1).toString();
    item.appendChild(numEl);

    var infoEl = document.createElement('div');
    infoEl.className = 'course-info';

    var nameEl = document.createElement('div');
    nameEl.className = 'course-name';
    nameEl.textContent = course.name;
    nameEl.setAttribute('title', course.name);
    infoEl.appendChild(nameEl);

    var dateEl = document.createElement('div');
    dateEl.className = 'course-date';
    dateEl.textContent = formatDate(course.addedAt);
    infoEl.appendChild(dateEl);

    item.appendChild(infoEl);

    var badgeEl = document.createElement('div');
    badgeEl.className = 'course-score-badge';

    var scoreVal = document.createElement('span');
    scoreVal.className = 'score-value';
    scoreVal.textContent = formatScore(course.score);
    badgeEl.appendChild(scoreVal);

    var gradeLetter = document.createElement('span');
    gradeLetter.className = 'grade-letter';
    gradeLetter.textContent = letter;
    badgeEl.appendChild(gradeLetter);

    item.appendChild(badgeEl);

    var delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.setAttribute('aria-label', 'Delete ' + course.name);
    delBtn.setAttribute('title', 'Remove course');
    delBtn.textContent = '\u00d7';
    delBtn.addEventListener('click', function () {
      removeCourse(course.id, item);
    });
    item.appendChild(delBtn);

    return item;
  }

  function renderCourses() {
    courseList.replaceChildren();

    if (courses.length === 0) {
      courseList.appendChild(emptyState);
      emptyState.style.display = '';
      clearAllBtn.style.display = 'none';
      searchWrapper.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      clearAllBtn.style.display = '';
      searchWrapper.style.display = '';
      for (var i = 0; i < courses.length; i++) {
        courseList.appendChild(createCourseElement(courses[i], i));
      }
    }

    updateStats();
    applySearchFilter();
  }

  function applySearchFilter() {
    var query = sanitizeCourseName(searchInput.value).toLowerCase();
    var items = courseList.querySelectorAll('.course-item');
    var visibleCount = 0;

    for (var i = 0; i < items.length; i++) {
      var nameEl = items[i].querySelector('.course-name');
      var name = nameEl ? nameEl.textContent.toLowerCase() : '';
      if (!query || name.indexOf(query) !== -1) {
        items[i].classList.remove('hidden-by-search');
        visibleCount++;
      } else {
        items[i].classList.add('hidden-by-search');
      }
    }

    var existingNoResults = courseList.querySelector('.no-results');
    if (existingNoResults) {
      existingNoResults.remove();
    }

    if (query && visibleCount === 0 && courses.length > 0) {
      var noResults = document.createElement('div');
      noResults.className = 'no-results';
      noResults.textContent = 'No courses match "' + query + '"';
      courseList.appendChild(noResults);
    }
  }

  function renderSessionSelect() {
    var currentId = activeSessionId;
    sessionSelect.replaceChildren();

    for (var i = 0; i < sessions.length; i++) {
      var opt = document.createElement('option');
      opt.value = sessions[i].id;
      opt.textContent = sessions[i].name + ' (' + sessions[i].courses.length + ')';
      if (sessions[i].id === currentId) {
        opt.selected = true;
      }
      sessionSelect.appendChild(opt);
    }
  }

  function renderResults() {
    resultsBody.replaceChildren();

    if (sessions.length === 0) {
      var emptyMsg = document.createElement('p');
      emptyMsg.className = 'empty-title';
      emptyMsg.textContent = 'No sessions yet.';
      resultsBody.appendChild(emptyMsg);
      return;
    }

    for (var i = sessions.length - 1; i >= 0; i--) {
      (function (session) {
        var stats = getSessionStats(session);
        var isActive = session.id === activeSessionId;

        var container = document.createElement('div');
        container.className = 'result-session';
        if (isActive) {
          container.style.borderColor = 'rgba(34, 197, 94, 0.3)';
        }

        var header = document.createElement('div');
        header.className = 'result-session-header';

        var nameEl = document.createElement('span');
        nameEl.className = 'result-session-name';
        nameEl.textContent = session.name + (isActive ? ' (Active)' : '');
        header.appendChild(nameEl);

        var dateEl = document.createElement('span');
        dateEl.className = 'result-session-date';
        dateEl.textContent = formatSessionDate(session.createdAt);
        header.appendChild(dateEl);

        container.appendChild(header);

        if (stats.total === 0) {
          var emptyEl = document.createElement('p');
          emptyEl.style.cssText = 'font-size:0.82rem;color:var(--text-muted);padding:var(--space-sm) 0;';
          emptyEl.textContent = 'No courses in this session.';
          container.appendChild(emptyEl);
        } else {
          var statRow = document.createElement('div');
          statRow.className = 'result-session-stats';

          var statConfigs = [
            { label: 'Courses', value: stats.total.toString() },
            { label: 'Average', value: stats.avgDisplay },
            { label: 'Highest', value: formatScore(stats.highest) },
            { label: 'Lowest', value: formatScore(stats.lowest) },
          ];
          for (var si = 0; si < statConfigs.length; si++) {
            var statEl = document.createElement('div');
            statEl.className = 'result-stat';
            var statVal = document.createElement('span');
            statVal.className = 'result-stat-value';
            statVal.textContent = statConfigs[si].value;
            var statLbl = document.createElement('span');
            statLbl.className = 'result-stat-label';
            statLbl.textContent = statConfigs[si].label;
            statEl.appendChild(statVal);
            statEl.appendChild(statLbl);
            statRow.appendChild(statEl);
          }
          container.appendChild(statRow);

          var coursesRow = document.createElement('div');
          coursesRow.className = 'result-courses';
          for (var ci = 0; ci < session.courses.length; ci++) {
            (function (course) {
              var tag = document.createElement('span');
              var letter = getLetterGrade(course.score);
              tag.className = 'result-course-tag grade-' + letter.toLowerCase() + '-tag';
              tag.textContent = course.name + ' \u2014 ' + formatScore(course.score);
              coursesRow.appendChild(tag);
            })(session.courses[ci]);
          }
          container.appendChild(coursesRow);
        }

        resultsBody.appendChild(container);
      })(sessions[i]);
    }
  }

  function openModal(modal) {
    modal.style.display = 'flex';
    modal.focus();
  }

  function closeModal(modal) {
    modal.style.display = 'none';
  }

  function closeAllModals() {
    closeModal(resultsModal);
    closeModal(newSessionModal);
  }

  function addCourse(name, score) {
    var safeName = sanitizeCourseName(name);
    if (!safeName) {
      showToast('Please enter a course name.', 'error');
      return;
    }

    var safeScore = clampScore(score);
    if (safeScore === null) {
      showToast('Please enter a valid score (0\u2013100).', 'error');
      return;
    }

    var session = getActiveSession();
    if (!session) {
      showToast('Please create or select a session first.', 'error');
      return;
    }

    session.courses.unshift({
      id: generateId(),
      name: safeName,
      score: safeScore,
      addedAt: Date.now(),
    });

    syncCoursesRef();
    saveSessions();
    renderCourses();
    renderSessionSelect();

    searchInput.value = '';

    showToast('Added "' + safeName + '" \u2014 ' + getLetterGrade(safeScore), 'success');
  }

  function removeCourse(id, element) {
    var session = getActiveSession();
    if (!session) return;

    if (element) {
      element.classList.add('removing');
      element.addEventListener('animationend', function () {
        session.courses = session.courses.filter(function (c) { return c.id !== id; });
        syncCoursesRef();
        saveSessions();
        renderCourses();
        renderSessionSelect();
      }, { once: true });
    } else {
      session.courses = session.courses.filter(function (c) { return c.id !== id; });
      syncCoursesRef();
      saveSessions();
      renderCourses();
      renderSessionSelect();
    }
    showToast('Course removed', 'success');
  }

  function clearAllCourses() {
    showConfirmDialog(
      'Clear All Courses?',
      'This will permanently delete all courses in the current session. This action cannot be undone.',
      function () {
        var session = getActiveSession();
        if (session) {
          session.courses = [];
          syncCoursesRef();
          saveSessions();
        }
        searchInput.value = '';
        renderCourses();
        renderSessionSelect();
        showToast('All courses cleared', 'success');
      }
    );
  }

  function showToast(message, type) {
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'success');

    var iconSpan = document.createElement('span');
    iconSpan.textContent = type === 'error' ? '\u26a0' : '\u2713';
    toast.appendChild(iconSpan);

    var msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    toastContainer.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, { once: true });
    }, 2500);
  }

  function showConfirmDialog(title, message, onConfirm) {
    var overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    var box = document.createElement('div');
    box.className = 'dialog-box';

    var titleEl = document.createElement('h3');
    titleEl.className = 'dialog-title';
    titleEl.textContent = title;
    box.appendChild(titleEl);

    var msgEl = document.createElement('p');
    msgEl.className = 'dialog-message';
    msgEl.textContent = message;
    box.appendChild(msgEl);

    var actionsEl = document.createElement('div');
    actionsEl.className = 'dialog-actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'dialog-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () {
      document.body.removeChild(overlay);
    });
    actionsEl.appendChild(cancelBtn);

    var confirmBtn = document.createElement('button');
    confirmBtn.className = 'dialog-confirm';
    confirmBtn.textContent = 'Delete All';
    confirmBtn.addEventListener('click', function () {
      document.body.removeChild(overlay);
      onConfirm();
    });
    actionsEl.appendChild(confirmBtn);

    box.appendChild(actionsEl);
    overlay.appendChild(box);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    function handleEscape(e) {
      if (e.key === 'Escape') {
        if (overlay.parentNode) {
          document.body.removeChild(overlay);
        }
        document.removeEventListener('keydown', handleEscape);
      }
    }
    document.addEventListener('keydown', handleEscape);

    document.body.appendChild(overlay);
    cancelBtn.focus();
  }

  // ── Event Listeners ─────────────────────────────────────────────

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    addCourse(courseNameInput.value, courseScoreInput.value);
    form.reset();
    courseNameInput.focus();
  });

  clearAllBtn.addEventListener('click', clearAllCourses);
  searchInput.addEventListener('input', applySearchFilter);

  sessionSelect.addEventListener('change', function () {
    setActiveSession(sessionSelect.value);
  });

  newSessionBtn.addEventListener('click', function () {
    newSessionNameInput.value = '';
    openModal(newSessionModal);
    setTimeout(function () { newSessionNameInput.focus(); }, 100);
  });

  function handleCreateSession() {
    var name = newSessionNameInput.value;
    var session = createSession(name);
    if (session) {
      closeModal(newSessionModal);
      showToast('Created session "' + session.name + '"', 'success');
    }
  }

  newSessionCreateBtn.addEventListener('click', handleCreateSession);
  newSessionNameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateSession();
    }
  });
  newSessionCancelBtn.addEventListener('click', function () {
    closeModal(newSessionModal);
  });
  newSessionCloseBtn.addEventListener('click', function () {
    closeModal(newSessionModal);
  });

  resultsBtn.addEventListener('click', function () {
    renderResults();
    openModal(resultsModal);
  });
  resultsCloseBtn.addEventListener('click', function () {
    closeModal(resultsModal);
  });

  [resultsModal, newSessionModal].forEach(function (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });

  // ── Init ──────────────────────────────────────────────────────

  sessions = loadSessions();
  var migrated = migrateOldData();
  if (!migrated) {
    activeSessionId = loadActiveSessionId();
    if (activeSessionId) {
      var found = false;
      for (var i = 0; i < sessions.length; i++) {
        if (sessions[i].id === activeSessionId) { found = true; break; }
      }
      if (!found) activeSessionId = null;
    }
  }

  if (sessions.length === 0) {
    var defaultSession = {
      id: generateId(),
      name: 'Spring 2026',
      createdAt: Date.now(),
      courses: [],
    };
    sessions.push(defaultSession);
    activeSessionId = defaultSession.id;
    saveSessions();
    saveActiveSessionId();
  } else if (!activeSessionId) {
    activeSessionId = sessions[0].id;
    saveActiveSessionId();
  }

  syncCoursesRef();
  renderSessionSelect();
  renderCourses();
})();
