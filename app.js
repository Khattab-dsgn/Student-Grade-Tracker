/**
 * GradeFlow — Student Grade Tracker
 *
 * All DOM manipulation uses safe APIs (textContent, createElement, setAttribute)
 * to prevent XSS. No innerHTML or document.write is used anywhere.
 */

(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────────────────────
  const STORAGE_KEY = 'gradeflow_courses';
  const MAX_COURSE_NAME_LENGTH = 100;
  const MAX_SCORE = 100;
  const MIN_SCORE = 0;

  // ── DOM References ────────────────────────────────────────────────
  const form = document.getElementById('grade-form');
  const courseNameInput = document.getElementById('course-name');
  const courseScoreInput = document.getElementById('course-score');
  const courseList = document.getElementById('course-list');
  const emptyState = document.getElementById('empty-state');
  const clearAllBtn = document.getElementById('clear-all-btn');
  const avgScoreEl = document.getElementById('average-score');
  const totalCoursesEl = document.getElementById('total-courses');
  const highestScoreEl = document.getElementById('highest-score');
  const lowestScoreEl = document.getElementById('lowest-score');
  const ringProgress = document.getElementById('ring-progress');
  const ringText = document.getElementById('ring-text');
  const toastContainer = document.getElementById('toast-container');

  // ── State ─────────────────────────────────────────────────────────
  let courses = [];

  // ── Helpers ───────────────────────────────────────────────────────

  /**
   * Sanitize a string by trimming whitespace and capping length.
   * No HTML is ever injected — textContent handles encoding.
   */
  function sanitizeCourseName(raw) {
    return String(raw).trim().slice(0, MAX_COURSE_NAME_LENGTH);
  }

  /** Clamp a score between 0 and 100. */
  function clampScore(val) {
    const num = parseFloat(val);
    if (Number.isNaN(num)) return null;
    return Math.round(Math.min(MAX_SCORE, Math.max(MIN_SCORE, num)) * 10) / 10;
  }

  /** Return a letter grade for a numeric score. */
  function getLetterGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /** Return the CSS class for a grade letter. */
  function getGradeClass(letter) {
    return 'grade-' + letter.toLowerCase();
  }

  /** Format a timestamp as a readable date string. */
  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  /** Generate a simple unique ID. */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ── Local Storage ─────────────────────────────────────────────────

  function saveCourses() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    } catch (_) {
      // Storage might be full or disabled — fail silently
    }
  }

  function loadCourses() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      // Validate each entry
      return parsed.filter(function (c) {
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
    } catch (_) {
      return [];
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────

  function updateStats() {
    var total = courses.length;
    totalCoursesEl.textContent = total;

    if (total === 0) {
      avgScoreEl.textContent = '—';
      highestScoreEl.textContent = '—';
      lowestScoreEl.textContent = '—';
      ringText.textContent = '—';
      ringProgress.style.strokeDashoffset = '263.9';
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
    var avgDisplay = avg % 1 === 0 ? avg.toString() : avg.toFixed(1);

    avgScoreEl.textContent = avgDisplay;
    highestScoreEl.textContent = highest % 1 === 0 ? highest.toString() : highest.toFixed(1);
    lowestScoreEl.textContent = lowest % 1 === 0 ? lowest.toString() : lowest.toFixed(1);

    // Progress ring — circumference is 2 * π * 42 ≈ 263.9
    var circumference = 263.9;
    var offset = circumference - (avg / 100) * circumference;
    ringProgress.style.strokeDashoffset = offset.toString();
    ringText.textContent = avgDisplay;

    // Color the ring based on average grade
    var letter = getLetterGrade(avg);
    var colorMap = { A: '#22d68a', B: '#5cfcc4', C: '#fcc75c', D: '#fc9e5c', F: '#fc5c6a' };
    ringProgress.setAttribute('stroke', colorMap[letter] || '#22c55e');
  }

  // ── Rendering ─────────────────────────────────────────────────────

  /**
   * Build a single course item element using safe DOM APIs only.
   * SECURITY: All user-controlled values are set via textContent, never innerHTML.
   */
  function createCourseElement(course, index) {
    var letter = getLetterGrade(course.score);
    var gradeClass = getGradeClass(letter);

    var item = document.createElement('div');
    item.className = 'course-item ' + gradeClass;
    item.setAttribute('data-id', course.id);
    item.style.animationDelay = (index * 40) + 'ms';

    // Number badge
    var numEl = document.createElement('span');
    numEl.className = 'course-number';
    numEl.textContent = (index + 1).toString();
    item.appendChild(numEl);

    // Info block
    var infoEl = document.createElement('div');
    infoEl.className = 'course-info';

    var nameEl = document.createElement('div');
    nameEl.className = 'course-name';
    nameEl.textContent = course.name; // Safe: textContent auto-encodes
    nameEl.setAttribute('title', course.name);
    infoEl.appendChild(nameEl);

    var dateEl = document.createElement('div');
    dateEl.className = 'course-date';
    dateEl.textContent = formatDate(course.addedAt);
    infoEl.appendChild(dateEl);

    item.appendChild(infoEl);

    // Score badge area
    var badgeEl = document.createElement('div');
    badgeEl.className = 'course-score-badge';

    var scoreVal = document.createElement('span');
    scoreVal.className = 'score-value';
    scoreVal.textContent = course.score % 1 === 0 ? course.score.toString() : course.score.toFixed(1);
    badgeEl.appendChild(scoreVal);

    var gradeLetter = document.createElement('span');
    gradeLetter.className = 'grade-letter';
    gradeLetter.textContent = letter;
    badgeEl.appendChild(gradeLetter);

    item.appendChild(badgeEl);

    // Delete button
    var delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.setAttribute('aria-label', 'Delete ' + course.name);
    delBtn.setAttribute('title', 'Remove course');
    delBtn.textContent = '×';
    delBtn.addEventListener('click', function () {
      removeCourse(course.id, item);
    });
    item.appendChild(delBtn);

    return item;
  }

  /** Re-render the entire course list. */
  function renderCourses() {
    // Clear existing items safely
    courseList.replaceChildren();

    if (courses.length === 0) {
      courseList.appendChild(emptyState);
      emptyState.style.display = '';
      clearAllBtn.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      clearAllBtn.style.display = '';
      for (var i = 0; i < courses.length; i++) {
        courseList.appendChild(createCourseElement(courses[i], i));
      }
    }

    updateStats();
  }

  // ── CRUD Operations ───────────────────────────────────────────────

  function addCourse(name, score) {
    var safeName = sanitizeCourseName(name);
    if (!safeName) {
      showToast('Please enter a course name.', 'error');
      return;
    }

    var safeScore = clampScore(score);
    if (safeScore === null) {
      showToast('Please enter a valid score (0–100).', 'error');
      return;
    }

    courses.unshift({
      id: generateId(),
      name: safeName,
      score: safeScore,
      addedAt: Date.now(),
    });

    saveCourses();
    renderCourses();
    showToast('Added "' + safeName + '" — ' + getLetterGrade(safeScore), 'success');
  }

  function removeCourse(id, element) {
    if (element) {
      element.classList.add('removing');
      element.addEventListener('animationend', function () {
        courses = courses.filter(function (c) { return c.id !== id; });
        saveCourses();
        renderCourses();
      }, { once: true });
    } else {
      courses = courses.filter(function (c) { return c.id !== id; });
      saveCourses();
      renderCourses();
    }
    showToast('Course removed', 'success');
  }

  function clearAllCourses() {
    showConfirmDialog(
      'Clear All Courses?',
      'This will permanently delete all your courses and scores. This action cannot be undone.',
      function () {
        courses = [];
        saveCourses();
        renderCourses();
        showToast('All courses cleared', 'success');
      }
    );
  }

  // ── Toast Notifications ───────────────────────────────────────────

  function showToast(message, type) {
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'success');

    var iconSpan = document.createElement('span');
    iconSpan.textContent = type === 'error' ? '⚠' : '✓';
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

  // ── Confirm Dialog (replaces native confirm()) ────────────────────

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

    // Close on overlay click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    document.body.appendChild(overlay);
    cancelBtn.focus();
  }

  // ── Event Listeners ───────────────────────────────────────────────

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    addCourse(courseNameInput.value, courseScoreInput.value);
    form.reset();
    courseNameInput.focus();
  });

  clearAllBtn.addEventListener('click', clearAllCourses);

  // ── Init ──────────────────────────────────────────────────────────

  courses = loadCourses();
  renderCourses();
})();
