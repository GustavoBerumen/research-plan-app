(() => {
  'use strict';

  const SCHEMA_URL = 'research-plan-template.md';
  const RUBRIC_URL = 'research-plan-rubric.md';
  const METHODS_URL = 'research-methods.md';
  const doc = document.getElementById('doc');

  // Populated from research-methods.md before renderSchema() runs; read by
  // attachMethodsCombobox via renderField's special-case for the "Methods"
  // field. Empty until loaded — the combobox just won't offer suggestions.
  let METHODS = [];

  // tables holds one entry per rendered <table> field: its DOM id, the
  // column definitions (for building rows), and the column keys (for
  // reading/writing draft rows as plain objects).
  const tables = [];

  // ---------- small DOM helper ----------
  function el(tag, className, attrs) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  }

  // ---------- schema parsing (research-plan-template.md) ----------
  function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function toCamelKey(label) {
    const words = label.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    return words.map((w, i) => {
      const lower = w.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join('');
  }

  function parseColumns(spec) {
    return spec.split('|').map((part) => {
      part = part.trim();
      let [labelType, placeholder] = part.split('=');
      let [label, type] = labelType.split(':');
      label = label.trim();
      type = (type || 'text').trim().toLowerCase();
      if (placeholder === undefined) {
        placeholder = type === 'date' ? 'Date' : type === 'person' ? 'Person' : type === 'status' ? '' : type === 'url' ? 'https://…' : type === 'file' ? 'No file chosen' : 'Enter text…';
      } else {
        placeholder = placeholder.trim();
      }
      const col = { label, key: toCamelKey(label), type, placeholder };
      // For select columns the placeholder slot holds "Option A,Option B,…"
      // instead of literal placeholder text.
      if (type === 'select') col.options = placeholder.split(',').map((s) => s.trim()).filter(Boolean);
      return col;
    });
  }

  function parseFieldLine(line) {
    const m = line.match(/^(.+?)\s*\(([^)]+)\)\s*:\s*(.*)$/);
    if (!m) return null;
    const label = m[1].trim();
    const typeParts = m[2].split(',').map((s) => s.trim().toLowerCase());
    const type = typeParts[0];
    const field = {
      label,
      key: toCamelKey(label),
      type,
      optional: typeParts.includes('optional'),
      eval: typeParts.includes('eval'),
      editableHeaders: typeParts.includes('editable-headers'),
    };
    if (type === 'table') {
      field.columns = parseColumns(m[3].trim());
    } else if (type === 'select') {
      field.options = m[3].split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      field.placeholder = m[3].trim();
    }
    return field;
  }

  function parseHeading(line) {
    const m = line.match(/^#\s+(.+?)(?:\s*\{([^}]*)\})?\s*$/);
    if (!m) return null;
    const flags = (m[2] || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    return { title: m[1].trim(), open: flags.includes('open'), grid: flags.includes('grid') };
  }

  function parseSchema(text) {
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    const lines = text.split('\n');
    const header = { title: null, meta: [] };
    const sections = [];
    let mode = 'header-pretitle';
    let currentSection = null;
    let currentField = null;
    let currentGroup = null;

    lines.forEach((raw) => {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) return;

      // "## Name" groups the fields that follow under a labeled sub-heading
      // within the current section, without opening a new collapsible
      // section of its own.
      if (/^##\s+/.test(line)) {
        currentGroup = line.replace(/^##\s+/, '').trim();
        return;
      }

      if (/^#\s+/.test(line)) {
        if (mode === 'header-pretitle') {
          const titleField = parseFieldLine(line.replace(/^#\s+/, ''));
          header.title = titleField || { label: 'Title', key: 'title', type: 'text', placeholder: '' };
          mode = 'header-meta';
          currentField = header.title;
          return;
        }
        const heading = parseHeading(line);
        currentSection = { title: heading.title, slug: slugify(heading.title), open: heading.open, grid: heading.grid, fields: [] };
        sections.push(currentSection);
        mode = 'section';
        currentField = null;
        currentGroup = null;
        return;
      }

      const exMatch = raw.match(/^\s+(Good|Bad):\s*(.*)$/i);
      if (exMatch && currentField) {
        currentField.examples = currentField.examples || {};
        currentField.examples[exMatch[1].toLowerCase()] = exMatch[2].trim();
        return;
      }

      const field = parseFieldLine(line);
      if (!field) return;
      if (currentGroup) field.group = currentGroup;

      if (mode === 'header-meta') {
        header.meta.push(field);
      } else if (mode === 'section') {
        currentSection.fields.push(field);
      }
      currentField = field;
    });

    return { header, sections };
  }

  // ---------- rubric parsing (research-plan-rubric.md) ----------
  function parseRubric(text) {
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    const rubrics = {};
    let currentKey = null;
    text.split('\n').forEach((raw) => {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) return;

      const heading = line.match(/^#\s+(.+)$/);
      if (heading) {
        currentKey = toCamelKey(heading[1].trim());
        rubrics[currentKey] = [];
        return;
      }

      const bullet = line.match(/^-\s*(.+?)\s*:\s*(.*)$/);
      if (bullet && currentKey) {
        rubrics[currentKey].push({ name: bullet[1].trim(), desc: bullet[2].trim() });
      }
    });
    return rubrics;
  }

  function attachRubrics(schema, rubrics) {
    const allFields = [schema.header.title, ...schema.header.meta];
    schema.sections.forEach((s) => allFields.push(...s.fields));
    allFields.forEach((f) => {
      if (rubrics[f.key]) f.rubric = rubrics[f.key];
    });
  }

  // ---------- methods list (research-methods.md) ----------
  function parseMethodsList(text) {
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    return text.split('\n')
      .map((line) => line.match(/^-\s*(.+?)\s*$/))
      .filter(Boolean)
      .map((m) => m[1]);
  }

  // ---------- textarea autosize ----------
  function resizeTa(ta) {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  // Grows a text input to fit its current value, the same way resizeTa()
  // grows a textarea's height — but inputs have no content-based CSS
  // auto-size (width:auto falls back to the `size` attribute's ~20ch
  // default, not the rendered text width), so this measures via a hidden
  // mirror element using the input's own computed font.
  let sizeMirror = null;
  function sizeInputToContent(input, extraPadding) {
    if (!sizeMirror) {
      sizeMirror = document.createElement('span');
      sizeMirror.style.position = 'absolute';
      sizeMirror.style.visibility = 'hidden';
      sizeMirror.style.whiteSpace = 'pre';
      sizeMirror.style.top = '-9999px';
      sizeMirror.style.left = '-9999px';
      document.body.appendChild(sizeMirror);
    }
    const cs = getComputedStyle(input);
    sizeMirror.style.font = cs.font;
    sizeMirror.style.letterSpacing = cs.letterSpacing;
    sizeMirror.textContent = input.value;
    input.style.width = (sizeMirror.offsetWidth + (extraPadding || 0)) + 'px';
  }
  function initTextareas(root) {
    root.querySelectorAll('.field-ta').forEach((ta) => {
      resizeTa(ta);
      ta.addEventListener('input', () => resizeTa(ta));
    });
  }

  // ---------- status select coloring ----------
  const STATUS_CLASS = {
    'not-started': 'ss-ns',
    'assigned': 'ss-assigned',
    'in-progress': 'ss-ip',
    'complete': 'ss-done',
    'blocked': 'ss-block',
  };
  function updateSelectClass(sel) {
    sel.className = 'ssel ' + (STATUS_CLASS[sel.value] || 'ss-ns');
  }
  function initStatusSelects(root) {
    root.querySelectorAll('.ssel').forEach((sel) => {
      updateSelectClass(sel);
      if (!sel._bound) {
        sel.addEventListener('change', () => updateSelectClass(sel));
        sel._bound = true;
      }
    });
  }

  // ---------- accordion ----------
  function setAccOpen(head, open) {
    const acc = head.closest('.acc');
    const body = document.getElementById(head.getAttribute('aria-controls'));
    acc.dataset.open = open ? 'true' : 'false';
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
    body.hidden = !open;
  }
  function initAccordion() {
    document.querySelectorAll('[data-acc-toggle]').forEach((head) => {
      head.addEventListener('click', () => {
        const isOpen = head.getAttribute('aria-expanded') === 'true';
        setAccOpen(head, !isOpen);
      });
    });
  }

  // ---------- file upload ----------
  const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

  function readFileAsBase64(fileOrBlob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error || new Error('Could not read file'));
      reader.readAsDataURL(fileOrBlob);
    });
  }

  function uploadFile(fileOrBlob, filename) {
    return readFileAsBase64(fileOrBlob).then((dataBase64) => {
      return fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: filename || fileOrBlob.name, dataBase64 }),
      });
    }).then((res) => {
      return res.json().catch(() => ({})).then((body) => {
        if (!res.ok) throw new Error(body.error || ('HTTP ' + res.status));
        return body;
      });
    });
  }

  // ---------- Google Drive picker ----------
  let configPromise = null;
  function getConfig() {
    if (!configPromise) configPromise = fetch('/api/config').then((res) => res.json());
    return configPromise;
  }

  function waitFor(check, timeout, interval) {
    timeout = timeout || 8000;
    interval = interval || 100;
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function poll() {
        if (check()) { resolve(); return; }
        if (Date.now() - start > timeout) { reject(new Error('Google scripts failed to load')); return; }
        setTimeout(poll, interval);
      })();
    });
  }

  let pickerApiPromise = null;
  function loadPickerApi() {
    if (!pickerApiPromise) {
      pickerApiPromise = waitFor(() => window.gapi).then(() => new Promise((resolve) => gapi.load('picker', resolve)));
    }
    return pickerApiPromise;
  }

  let driveTokenCache = null;
  function getDriveAccessToken(clientId) {
    if (driveTokenCache && driveTokenCache.expiresAt > Date.now()) {
      return Promise.resolve(driveTokenCache.token);
    }
    return waitFor(() => window.google && google.accounts && google.accounts.oauth2).then(() => {
      return new Promise((resolve, reject) => {
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (resp) => {
            if (resp.error) { reject(new Error(resp.error)); return; }
            driveTokenCache = { token: resp.access_token, expiresAt: Date.now() + (Number(resp.expires_in || 3000) - 60) * 1000 };
            resolve(resp.access_token);
          },
        });
        tokenClient.requestAccessToken();
      });
    });
  }

  function openDrivePicker(token, apiKey) {
    return new Promise((resolve, reject) => {
      const picker = new google.picker.PickerBuilder()
        .addView(google.picker.ViewId.DOCS)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setCallback((data) => {
          if (data.action === google.picker.Action.PICKED) {
            resolve(data.docs[0]);
          } else if (data.action === google.picker.Action.CANCEL) {
            reject(new Error('cancelled'));
          }
        })
        .build();
      picker.setVisible(true);
    });
  }

  function downloadDriveFile(file, token) {
    const isGoogleNative = file.mimeType && file.mimeType.indexOf('application/vnd.google-apps.') === 0;
    const url = isGoogleNative
      ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent('application/pdf')}`
      : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
    return fetch(url, { headers: { Authorization: 'Bearer ' + token } }).then((res) => {
      if (!res.ok) throw new Error('Drive download failed (HTTP ' + res.status + ')');
      return res.blob();
    }).then((blob) => ({ blob, name: isGoogleNative ? file.name + '.pdf' : file.name }));
  }

  function addFromDrive() {
    return getConfig().then((cfg) => {
      if (!cfg.googleClientId || !cfg.googleApiKey) {
        throw new Error('Google Drive is not configured for this app (missing GOOGLE_CLIENT_ID / GOOGLE_API_KEY).');
      }
      return loadPickerApi()
        .then(() => getDriveAccessToken(cfg.googleClientId))
        .then((token) => openDrivePicker(token, cfg.googleApiKey).then((file) => downloadDriveFile(file, token)));
    });
  }

  // ---------- dynamic table rows ----------
  function buildFileCell(placeholder) {
    const wrap = el('div', 'file-cell');
    const valueInp = document.createElement('input');
    valueInp.type = 'hidden';
    valueInp.className = 'cinput file-value';
    const fileInp = document.createElement('input');
    fileInp.type = 'file';
    fileInp.className = 'file-native';

    const addWrap = el('div', 'file-add-wrap');
    const addBtn = el('button', 'file-add-btn', { type: 'button' });
    addBtn.textContent = '+';
    addBtn.title = 'Add a file';
    const menu = el('div', 'file-menu');
    menu.hidden = true;
    const uploadItem = el('button', 'file-menu-item', { type: 'button' });
    uploadItem.textContent = 'Upload file';
    const driveItem = el('button', 'file-menu-item', { type: 'button' });
    driveItem.textContent = 'Add from Drive';
    menu.append(uploadItem, driveItem);
    addWrap.append(addBtn, menu);

    const nameSpan = el('span', 'file-name');
    nameSpan.textContent = placeholder;

    let closeHandlers = null;
    function closeMenu() {
      menu.hidden = true;
      if (closeHandlers) {
        document.removeEventListener('click', closeHandlers.onDocClick);
        window.removeEventListener('scroll', closeHandlers.onScroll, true);
        closeHandlers = null;
      }
      if (menu.parentNode === document.body) addWrap.appendChild(menu);
    }
    function openMenu() {
      // Reparent to <body> with fixed positioning so the menu escapes any
      // ancestor with overflow:hidden (the table wrapper, the accordion body).
      const rect = addBtn.getBoundingClientRect();
      document.body.appendChild(menu);
      menu.style.position = 'fixed';
      menu.style.top = (rect.bottom + 4) + 'px';
      menu.style.left = rect.left + 'px';
      menu.hidden = false;
      const onDocClick = (e) => {
        if (!menu.contains(e.target) && !addWrap.contains(e.target)) closeMenu();
      };
      const onScroll = () => closeMenu();
      closeHandlers = { onDocClick, onScroll };
      setTimeout(() => document.addEventListener('click', onDocClick), 0);
      window.addEventListener('scroll', onScroll, true);
    }
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu.hidden) openMenu(); else closeMenu();
    });

    function setUploading() {
      addBtn.disabled = true;
      nameSpan.textContent = 'Uploading…';
    }
    function setUploaded(body) {
      valueInp.value = body.url;
      nameSpan.innerHTML = '';
      const link = document.createElement('a');
      link.href = body.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = body.filename;
      nameSpan.appendChild(link);
    }
    function setFailed(err) {
      alert('Adding file failed: ' + err.message);
      nameSpan.textContent = placeholder;
    }
    function finishUpload() {
      addBtn.disabled = false;
      fileInp.value = '';
    }

    uploadItem.addEventListener('click', () => {
      closeMenu();
      fileInp.click();
    });

    fileInp.addEventListener('change', () => {
      const file = fileInp.files[0];
      if (!file) return;
      if (file.size > MAX_UPLOAD_BYTES) {
        alert('File exceeds the 15MB limit.');
        fileInp.value = '';
        return;
      }
      setUploading();
      uploadFile(file).then(setUploaded).catch(setFailed).finally(finishUpload);
    });

    driveItem.addEventListener('click', () => {
      closeMenu();
      addFromDrive().then(({ blob, name }) => {
        if (blob.size > MAX_UPLOAD_BYTES) throw new Error('File exceeds the 15MB limit.');
        setUploading();
        return uploadFile(blob, name).then(setUploaded).catch(setFailed).finally(finishUpload);
      }).catch((err) => {
        if (err && err.message !== 'cancelled') alert('Could not add file from Drive: ' + err.message);
      });
    });

    wrap.append(fileInp, addWrap, nameSpan, valueInp);
    return wrap;
  }

  // Keeps every row's remove button in sync with the current row count: once
  // only one row is left, its button reserves its space but goes invisible
  // and inert (same visibility trick as the list-field remove buttons) so a
  // table can never be emptied to zero rows.
  function updateRowRemoveButtons(tbody) {
    const rows = tbody.querySelectorAll('tr');
    const onlyOneLeft = rows.length <= 1;
    rows.forEach((tr) => {
      const btn = tr.querySelector('.row-remove');
      if (!btn) return;
      btn.disabled = onlyOneLeft;
      btn.classList.toggle('list-remove-spacer', onlyOneLeft);
    });
  }

  // Native date controls expose a locale-specific segmented editor whose
  // keyboard behaviour is owned by the browser. Keep a native date input as
  // the canonical ISO value and calendar picker, but render controllable
  // day/month/year segments for predictable manual editing.
  const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DATE_SEGMENT_DELAY_MS = 900;
  let dateControlCount = 0;

  function parseMonthSegment(value) {
    const trimmed = (value || '').trim();
    if (/^\d{1,2}$/.test(trimmed)) {
      const month = Number(trimmed);
      return month >= 1 && month <= 12 ? month : null;
    }
    const monthIndex = MONTH_ABBREVIATIONS.findIndex((name) => name.toLowerCase() === trimmed.toLowerCase());
    return monthIndex === -1 ? null : monthIndex + 1;
  }

  function parseDateEntry(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) return null;

    let year;
    let month;
    let day;
    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const labelled = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (iso) {
      year = Number(iso[1]);
      month = Number(iso[2]);
      day = Number(iso[3]);
    } else if (dmy) {
      year = Number(dmy[3]);
      month = Number(dmy[2]);
      day = Number(dmy[1]);
    } else if (labelled) {
      year = Number(labelled[3]);
      month = parseMonthSegment(labelled[2]);
      day = Number(labelled[1]);
    } else {
      return null;
    }

    const date = localDateFrom(year, month, day);
    if (!date) return null;
    const yyyy = String(year).padStart(4, '0');
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return { iso: yyyy + '-' + mm + '-' + dd, year, month, day };
  }

  function dateSegments(nativeInput) {
    const control = nativeInput.closest('.date-control');
    if (!control) return null;
    return {
      control,
      day: control.querySelector('.date-day'),
      month: control.querySelector('.date-month'),
      year: control.querySelector('.date-year'),
    };
  }

  function readDateSegments(nativeInput) {
    const segments = dateSegments(nativeInput);
    if (!segments) return null;
    const dayText = segments.day.value.trim();
    const yearText = segments.year.value.trim();
    if (!/^\d{1,2}$/.test(dayText) || !/^\d{4}$/.test(yearText)) return null;
    const day = Number(dayText);
    const month = parseMonthSegment(segments.month.value);
    const year = Number(yearText);
    if (!month || !localDateFrom(year, month, day)) return null;
    return {
      iso: String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
      year,
      month,
      day,
    };
  }

  function clearDateError(nativeInput) {
    const segments = dateSegments(nativeInput);
    if (!segments) return;
    const error = segments.control.querySelector('.date-error');
    [segments.day, segments.month, segments.year].forEach((input) => input.setCustomValidity(''));
    segments.control.removeAttribute('aria-invalid');
    if (error) error.hidden = true;
  }

  function showDateError(nativeInput) {
    const segments = dateSegments(nativeInput);
    if (!segments) return;
    const error = segments.control.querySelector('.date-error');
    segments.day.setCustomValidity('Enter a valid date.');
    segments.control.setAttribute('aria-invalid', 'true');
    if (error) error.hidden = false;
  }

  function setDateInputValue(nativeInput, isoValue) {
    const parsed = parseDateEntry(isoValue);
    nativeInput.value = parsed ? parsed.iso : '';
    const segments = dateSegments(nativeInput);
    if (segments) {
      segments.day.value = parsed ? String(parsed.day).padStart(2, '0') : '';
      segments.month.value = parsed ? MONTH_ABBREVIATIONS[parsed.month - 1] : '';
      segments.year.value = parsed ? String(parsed.year).padStart(4, '0') : '';
    }
    clearDateError(nativeInput);
  }

  function buildDateControl(inputClass, attrs, label) {
    const control = el('div', 'date-control ' + inputClass, {
      role: 'group',
      'aria-label': label || 'Date',
    });
    const errorId = 'date-error-' + (++dateControlCount);
    control.setAttribute('aria-describedby', errorId);
    const dayInput = el('input', 'date-segment date-day', {
      type: 'text',
      inputmode: 'numeric',
      placeholder: 'DD',
      autocomplete: 'off',
      maxlength: '2',
      'aria-label': (label || 'Date') + ' day',
    });
    const monthInput = el('input', 'date-segment date-month', {
      type: 'text',
      inputmode: 'numeric',
      placeholder: 'MM',
      autocomplete: 'off',
      maxlength: '3',
      'aria-label': (label || 'Date') + ' month',
    });
    const yearInput = el('input', 'date-segment date-year', {
      type: 'text',
      inputmode: 'numeric',
      placeholder: 'YYYY',
      autocomplete: 'off',
      maxlength: '4',
      'aria-label': (label || 'Date') + ' year',
    });
    const nativeAttrs = Object.assign({}, attrs || {}, {
      type: 'date',
      'aria-label': 'Choose ' + (label || 'date') + ' from calendar',
    });
    const nativeInput = el('input', 'date-picker-native', nativeAttrs);
    const error = el('span', 'date-error', { id: errorId, role: 'alert' });
    error.textContent = 'Enter a valid date.';
    error.hidden = true;

    let dispatchingSegmentEvent = false;

    function dispatchNative(type) {
      dispatchingSegmentEvent = true;
      try {
        nativeInput.dispatchEvent(new Event(type, { bubbles: true }));
      } finally {
        dispatchingSegmentEvent = false;
      }
    }

    function hasAnyValue() {
      return dayInput.value.trim() || monthInput.value.trim() || yearInput.value.trim();
    }

    function hasEveryValue() {
      return dayInput.value.trim() && monthInput.value.trim() && yearInput.value.trim();
    }

    function syncFromSegments(type, reportInvalid, normalize) {
      const parsed = readDateSegments(nativeInput);
      nativeInput.value = parsed ? parsed.iso : '';
      if (parsed) {
        clearDateError(nativeInput);
        if (normalize) setDateInputValue(nativeInput, parsed.iso);
      } else if (reportInvalid && hasAnyValue()) {
        showDateError(nativeInput);
      } else {
        clearDateError(nativeInput);
      }
      if (type) dispatchNative(type);
      return parsed;
    }

    function focusAndSelect(input) {
      input.focus();
      input.select();
    }

    [dayInput, monthInput, yearInput].forEach((input) => {
      input.addEventListener('focus', () => {
        setTimeout(() => input.select(), 0);
      });
    });

    yearInput.addEventListener('input', () => {
      yearInput.value = yearInput.value.replace(/\D/g, '').slice(0, 4);
      const complete = yearInput.value.length === 4;
      syncFromSegments(complete ? 'change' : 'input', complete, false);
    });

    function configureBufferedSegment(input, options) {
      let buffer = '';
      let lastKeyTime = 0;
      let timer = null;

      function clearTimer() {
        if (timer) clearTimeout(timer);
        timer = null;
      }

      function commit(number, moveNext) {
        clearTimer();
        buffer = '';
        input.value = options.format(number);
        const complete = hasEveryValue();
        syncFromSegments(complete ? 'change' : 'input', complete, false);
        if (moveNext) focusAndSelect(options.next);
      }

      input.addEventListener('focus', () => {
        buffer = '';
        lastKeyTime = 0;
      });

      input.addEventListener('keydown', (event) => {
        if (!/^\d$/.test(event.key)) return;
        event.preventDefault();
        clearTimer();
        const now = Date.now();
        buffer = now - lastKeyTime <= DATE_SEGMENT_DELAY_MS ? buffer + event.key : event.key;
        lastKeyTime = now;
        if (buffer.length > 2) buffer = event.key;
        input.value = buffer;
        clearDateError(nativeInput);

        const number = Number(buffer);
        if (buffer.length === 2) {
          if (number >= 1 && number <= options.max) commit(number, true);
          else syncFromSegments('input', false, false);
        } else if (number >= options.instantFrom && number <= 9) {
          commit(number, true);
        } else if (number >= 1 && number < options.instantFrom) {
          timer = setTimeout(() => commit(number, document.activeElement === input), DATE_SEGMENT_DELAY_MS);
        } else {
          syncFromSegments('input', false, false);
        }
      });

      input.addEventListener('input', () => {
        clearTimer();
        buffer = '';
        if (options.numericOnly) input.value = input.value.replace(/\D/g, '').slice(0, 2);
        syncFromSegments('input', false, false);
      });

      input.addEventListener('blur', () => {
        if (timer) commit(Number(buffer), false);
      });
    }

    configureBufferedSegment(dayInput, {
      max: 31,
      instantFrom: 4,
      format: (day) => String(day).padStart(2, '0'),
      next: monthInput,
      numericOnly: true,
    });
    configureBufferedSegment(monthInput, {
      max: 12,
      instantFrom: 2,
      format: (month) => MONTH_ABBREVIATIONS[month - 1],
      next: yearInput,
      numericOnly: false,
    });

    control.addEventListener('paste', (event) => {
      const parsed = parseDateEntry(event.clipboardData.getData('text'));
      if (!parsed) return;
      event.preventDefault();
      setDateInputValue(nativeInput, parsed.iso);
      dispatchNative('input');
      dispatchNative('change');
      focusAndSelect(yearInput);
    });

    control.addEventListener('focusout', () => {
      setTimeout(() => {
        if (control.contains(document.activeElement)) return;
        syncFromSegments('change', true, true);
      }, 0);
    });

    function syncFromCalendar() {
      if (!dispatchingSegmentEvent) setDateInputValue(nativeInput, nativeInput.value);
    }
    nativeInput.addEventListener('input', syncFromCalendar);
    nativeInput.addEventListener('change', syncFromCalendar);

    const separator1 = el('span', 'date-separator', { 'aria-hidden': 'true' });
    const separator2 = el('span', 'date-separator', { 'aria-hidden': 'true' });
    separator1.textContent = '-';
    separator2.textContent = '-';
    control.append(dayInput, separator1, monthInput, separator2, yearInput, nativeInput, error);
    return { element: control, input: nativeInput };
  }

  // Keeps a completion-date column from ever holding a date earlier than its
  // row's start-date column: min= constrains the native picker itself, and
  // the change-listeners clamp as a hard fallback (typed/pasted values,
  // or the start date moving later than an already-picked completion date).
  function attachDateRangeConstraint(startInput, endInput) {
    function clampEnd() {
      if (startInput.value && endInput.value && endInput.value < startInput.value) {
        setDateInputValue(endInput, startInput.value);
      }
      endInput.min = startInput.value || '';
    }
    startInput.addEventListener('change', clampEnd);
    endInput.addEventListener('change', clampEnd);
    clampEnd();
  }

  function buildRow(columns) {
    const tr = document.createElement('tr');
    let startDateInput = null;
    let completionDateInput = null;
    columns.forEach((col) => {
      const td = document.createElement('td');
      if (col.type === 'status') {
        const sel = document.createElement('select');
        sel.className = 'ssel ss-ns';
        [['not-started', 'Not Started'], ['assigned', 'Assigned'], ['in-progress', 'In Progress'], ['complete', 'Complete'], ['blocked', 'Blocked']].forEach(([v, l]) => {
          const o = document.createElement('option');
          o.value = v;
          o.textContent = l;
          sel.appendChild(o);
        });
        sel.addEventListener('change', () => updateSelectClass(sel));
        td.appendChild(sel);
      } else if (col.type === 'select') {
        const wrap = el('div', 'select-cell');
        const sel = document.createElement('select');
        sel.className = 'ssel ss-ns';
        (col.options || []).forEach((opt) => {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          sel.appendChild(o);
        });
        const otherOpt = document.createElement('option');
        otherOpt.value = '__other__';
        otherOpt.textContent = 'Other…';
        sel.appendChild(otherOpt);

        // Picking "Other…" swaps the dropdown out entirely for a plain text
        // input (rather than showing both at once); getCellValue() reads
        // from that input instead of the sentinel value whenever it's
        // showing. The back button swaps the dropdown back in if needed.
        const otherRow = el('div', 'select-other-row');
        const otherInput = el('input', 'cinput select-other-input', {
          type: 'text',
          placeholder: 'Type a custom value…',
        });
        const backBtn = el('button', 'select-other-back', { type: 'button', title: 'Choose from the list instead' });
        backBtn.textContent = '▾';
        otherRow.append(otherInput, backBtn);
        otherRow.hidden = true;

        sel.addEventListener('change', () => {
          if (sel.value === '__other__') {
            sel.hidden = true;
            otherRow.hidden = false;
            otherInput.focus();
          }
        });
        backBtn.addEventListener('click', () => {
          otherInput.value = '';
          otherRow.hidden = true;
          sel.hidden = false;
          sel.value = (col.options && col.options[0]) || '';
          sel.focus();
        });

        wrap.append(sel, otherRow);
        td.appendChild(wrap);
      } else if (col.type === 'file') {
        td.appendChild(buildFileCell(col.placeholder || 'No file chosen'));
      } else if (col.type === 'date') {
        const dateControl = buildDateControl('cinput', null, col.label);
        td.appendChild(dateControl.element);
        const inp = dateControl.input;
        if (col.key === 'startDate') startDateInput = inp;
        if (col.key === 'completionDate') completionDateInput = inp;
      } else {
        const inp = document.createElement('input');
        inp.type = col.type === 'url' ? 'url' : 'text';
        inp.className = 'cinput';
        inp.placeholder = col.placeholder || '';
        td.appendChild(inp);
      }
      tr.appendChild(td);
    });

    if (startDateInput && completionDateInput) {
      attachDateRangeConstraint(startDateInput, completionDateInput);
    }

    const removeTd = document.createElement('td');
    removeTd.className = 'row-remove-cell';
    const removeBtn = el('button', 'list-remove row-remove', { type: 'button' });
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      if (removeBtn.disabled) return;
      const tbody = tr.parentElement;
      tr.remove();
      updateRowRemoveButtons(tbody);
    });
    removeTd.appendChild(removeBtn);
    tr.appendChild(removeTd);

    return tr;
  }

  function addRow(tableId, columns) {
    const tbody = document.getElementById(tableId).querySelector('tbody');
    const tr = buildRow(columns);
    tbody.appendChild(tr);
    updateRowRemoveButtons(tbody);
    const first = tr.querySelector('input, select');
    if (first) first.focus();
    return tr;
  }

  // ---------- evaluate (calls the local /api/evaluate backend, which calls Claude) ----------
  const { styleForScore } = window.RPA_SCORE_CLASSIFICATION;

  function evaluationValueToText(value) {
    if (!Array.isArray(value)) return typeof value === 'string' ? value : '';
    return value.map((entry) => typeof entry === 'string' ? entry : entry.text).filter(Boolean).join('\n');
  }

  function evaluationContext() {
    const objective = doc.querySelector('[data-field="objective"]');
    return { objective: objective ? objective.value.trim() : '' };
  }

  function evaluateField(value, field) {
    const body = {
      fieldKey: field.key,
      fieldLabel: field.label,
      rubric: field.rubric || [],
    };
    if (field.key === 'researchQuestions' || field.key === 'outcomes') {
      body.entries = value;
      body.context = evaluationContext();
      if (field.key === 'outcomes') {
        const questions = doc.querySelector('.list-rows[data-list-key="researchQuestions"]');
        body.researchQuestions = questions ? collectNumberedListValues(questions) : [];
      }
    } else {
      body.text = evaluationValueToText(value);
    }

    return fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((res) => {
      return res.json().catch(() => ({})).then((data) => {
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        return data;
      });
    }).then((data) => {
      const metrics = Array.isArray(data.metrics) ? data.metrics : [];
      const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
      if (metrics.length === 0 || metrics.some((m) => !Number.isFinite(m.score))) {
        throw new Error('The evaluator returned an unexpected result — please try again');
      }
      if (recs.length === 0) {
        throw new Error('The evaluator returned incomplete recommendations — please try again');
      }
      const avg = metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length;
      return { ...styleForScore(avg), metrics, recs };
    });
  }

  function renderEvalResult(panel, data) {
    panel.style.background = data.bg;
    panel.style.borderColor = data.border;

    const badge = panel.querySelector('.eval-badge');
    badge.textContent = data.label;
    badge.style.background = data.color;

    const metricsEl = panel.querySelector('.eval-metrics');
    metricsEl.innerHTML = '';
    data.metrics.forEach((m) => {
      const wrap = document.createElement('div');
      wrap.className = 'eval-metric';
      const name = document.createElement('div');
      name.className = 'eval-mname';
      name.textContent = m.name;
      const dots = document.createElement('div');
      dots.className = 'eval-dots';
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        dot.className = 'eval-dot';
        dot.style.background = i < m.score ? data.color : '#e5e7eb';
        dots.appendChild(dot);
      }
      const desc = document.createElement('div');
      desc.className = 'eval-mdesc';
      desc.textContent = m.desc;
      wrap.append(name, dots, desc);
      metricsEl.appendChild(wrap);
    });

    const recsEl = panel.querySelector('.eval-recs');
    recsEl.innerHTML = '';
    data.recs.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'eval-rec';
      li.textContent = r;
      recsEl.appendChild(li);
    });
  }

  // ---------- field rendering ----------
  function renderExamplePanel(field) {
    const toggle = el('button', 'ex-toggle', { type: 'button' });
    toggle.textContent = 'Show example';

    const panel = el('div', 'ex-panel');
    panel.hidden = true;
    if (field.examples.good) {
      const g = el('div', 'ex-block ex-good');
      const lbl = el('span', 'ex-block-label');
      lbl.textContent = 'Good';
      g.append(lbl, field.examples.good);
      panel.appendChild(g);
    }
    if (field.examples.bad) {
      const b = el('div', 'ex-block ex-bad');
      const lbl = el('span', 'ex-block-label');
      lbl.textContent = 'Bad';
      b.append(lbl, field.examples.bad);
      panel.appendChild(b);
    }

    toggle.addEventListener('click', () => {
      const show = panel.hidden;
      panel.hidden = !show;
      toggle.textContent = show ? 'Hide example' : 'Show example';
    });

    return [toggle, panel];
  }

  function saveForCalibration(field, text, data, feedback) {
    return fetch('/api/calibration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: field.label, text, metrics: data.metrics, recommendations: data.recs, feedback: feedback || null }),
    }).then((res) => {
      return res.json().catch(() => ({})).then((body) => {
        if (!res.ok) throw new Error(body.error || ('HTTP ' + res.status));
        return body;
      });
    });
  }

  let evaluationControlCount = 0;

  function renderEvalControls(field, getValue) {
    const controls = el('div', 'eval-controls');
    const btn = el('button', 'eval-btn', { type: 'button' });
    const spinner = el('span', 'eval-spinner');
    const txt = el('span');
    txt.textContent = 'Evaluate ' + field.label;
    btn.append(spinner, txt);

    const detailsId = 'evaluation-details-' + (++evaluationControlCount);
    const resultBtn = el('button', 'eval-result-btn', {
      type: 'button',
      'aria-controls': detailsId,
      'aria-expanded': 'false',
    });
    resultBtn.hidden = true;
    const resultChevron = el('span', 'eval-result-chevron', { 'aria-hidden': 'true' });
    resultChevron.textContent = '▾';
    const resultStatus = el('span', 'visually-hidden');
    resultBtn.append(resultChevron, resultStatus);

    const error = el('div', 'eval-error', { role: 'alert' });
    error.hidden = true;

    const panel = el('div', 'eval-panel', { id: detailsId });
    panel.hidden = true;
    const head = el('div', 'eval-head');
    const badge = el('span', 'eval-badge');
    const hl = el('span', 'eval-hl');
    hl.textContent = field.label + ' Evaluation';
    const dismiss = el('button', 'eval-x', { type: 'button' });
    dismiss.textContent = '✕';
    dismiss.title = 'Collapse evaluation details';
    dismiss.setAttribute('aria-label', 'Collapse ' + field.label + ' evaluation details');
    head.append(badge, hl, dismiss);
    const metrics = el('div', 'eval-metrics');
    const rlabel = el('div', 'eval-rlabel');
    rlabel.textContent = 'Recommendations';
    const recs = el('ul', 'eval-recs');
    const saveBtn = el('button', 'eval-fb-btn eval-save-btn', { type: 'button' });
    saveBtn.textContent = '📤';
    saveBtn.title = 'Save';
    saveBtn.disabled = true;
    const likeBtn = el('button', 'eval-fb-btn eval-like-btn', { type: 'button' });
    likeBtn.textContent = '👍';
    likeBtn.title = 'Like';
    likeBtn.disabled = true;
    const dislikeBtn = el('button', 'eval-fb-btn eval-dislike-btn', { type: 'button' });
    dislikeBtn.textContent = '👎';
    dislikeBtn.title = 'Dislike';
    dislikeBtn.disabled = true;
    const reevaluateBtn = el('button', 'eval-reevaluate-btn', { type: 'button' });
    reevaluateBtn.textContent = 'Evaluate again';
    const actions = el('div', 'eval-actions');
    actions.append(reevaluateBtn, likeBtn, dislikeBtn, saveBtn);
    panel.append(head, metrics, rlabel, recs, actions);
    controls.append(btn, resultBtn, error, panel);

    let lastResult = null;

    function setExpanded(expanded) {
      panel.hidden = !expanded;
      resultBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      if (!lastResult) return;
      const action = expanded ? 'Hide' : 'Show';
      resultBtn.title = lastResult.data.label + ' — ' + action.toLowerCase() + ' evaluation details';
      resultBtn.setAttribute(
        'aria-label',
        field.label + ' evaluation: ' + lastResult.data.label + '. ' + action + ' details.'
      );
    }

    function resetFeedbackActions() {
      saveBtn.disabled = true;
      saveBtn.classList.remove('active');
      saveBtn.title = 'Save';
      likeBtn.disabled = true;
      likeBtn.classList.remove('active');
      likeBtn.title = 'Like';
      dislikeBtn.disabled = true;
      dislikeBtn.classList.remove('active');
      dislikeBtn.title = 'Dislike';
    }

    function showResult(data) {
      resultBtn.className = 'eval-result-btn eval-result-' + data.tone;
      resultStatus.textContent = field.label + ' evaluation: ' + data.label;
      resultBtn.hidden = false;
      btn.hidden = true;
      setExpanded(false);
      resultBtn.focus();
    }

    function runEvaluation() {
      const value = getValue();
      const text = evaluationValueToText(value);
      if (!text.trim()) {
        alert('Please enter a value to evaluate.');
        return;
      }
      lastResult = null;
      setExpanded(false);
      resultBtn.hidden = true;
      error.hidden = true;
      error.textContent = '';
      resetFeedbackActions();
      btn.hidden = false;
      btn.focus();
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.classList.add('loading');
      txt.textContent = 'Evaluating…';
      reevaluateBtn.disabled = true;
      evaluateField(value, field).then((data) => {
        renderEvalResult(panel, data);
        lastResult = { text, data };
        showResult(data);
        saveBtn.disabled = false;
        likeBtn.disabled = false;
        dislikeBtn.disabled = false;
      }).catch((err) => {
        error.textContent = 'Evaluation failed: ' + err.message;
        error.hidden = false;
      }).finally(() => {
        btn.disabled = false;
        btn.setAttribute('aria-busy', 'false');
        btn.classList.remove('loading');
        txt.textContent = 'Evaluate ' + field.label;
        reevaluateBtn.disabled = false;
      });
    }

    btn.addEventListener('click', runEvaluation);
    resultBtn.addEventListener('click', () => {
      setExpanded(resultBtn.getAttribute('aria-expanded') !== 'true');
    });
    dismiss.addEventListener('click', () => {
      setExpanded(false);
      resultBtn.focus();
    });
    reevaluateBtn.addEventListener('click', runEvaluation);

    saveBtn.addEventListener('click', () => {
      if (!lastResult) return;
      saveBtn.disabled = true;
      likeBtn.disabled = true;
      dislikeBtn.disabled = true;
      saveBtn.title = 'Saving…';
      saveForCalibration(field, lastResult.text, lastResult.data).then(() => {
        saveBtn.title = 'Saved';
        saveBtn.classList.add('active');
      }).catch((err) => {
        alert('Save failed: ' + err.message);
        saveBtn.disabled = false;
        likeBtn.disabled = false;
        dislikeBtn.disabled = false;
        saveBtn.title = 'Save';
      });
    });

    likeBtn.addEventListener('click', () => {
      if (!lastResult) return;
      saveBtn.disabled = true;
      likeBtn.disabled = true;
      dislikeBtn.disabled = true;
      likeBtn.title = 'Saving…';
      saveForCalibration(field, lastResult.text, lastResult.data, 'like').then(() => {
        likeBtn.title = 'Liked';
        likeBtn.classList.add('active');
      }).catch((err) => {
        alert('Save failed: ' + err.message);
        saveBtn.disabled = false;
        likeBtn.disabled = false;
        dislikeBtn.disabled = false;
        likeBtn.title = 'Like';
      });
    });

    dislikeBtn.addEventListener('click', () => {
      if (!lastResult) return;
      saveBtn.disabled = true;
      likeBtn.disabled = true;
      dislikeBtn.disabled = true;
      dislikeBtn.title = 'Saving…';
      saveForCalibration(field, lastResult.text, lastResult.data, 'dislike').then(() => {
        dislikeBtn.title = 'Disliked';
        dislikeBtn.classList.add('active');
      }).catch((err) => {
        alert('Save failed: ' + err.message);
        saveBtn.disabled = false;
        likeBtn.disabled = false;
        dislikeBtn.disabled = false;
        dislikeBtn.title = 'Dislike';
      });
    });

    controls._resetEvaluation = () => {
      lastResult = null;
      btn.hidden = false;
      btn.disabled = false;
      btn.setAttribute('aria-busy', 'false');
      btn.classList.remove('loading');
      txt.textContent = 'Evaluate ' + field.label;
      resultBtn.hidden = true;
      resultBtn.className = 'eval-result-btn';
      resultBtn.removeAttribute('aria-label');
      resultBtn.removeAttribute('title');
      resultBtn.setAttribute('aria-expanded', 'false');
      resultStatus.textContent = '';
      error.hidden = true;
      error.textContent = '';
      panel.hidden = true;
      reevaluateBtn.disabled = false;
      resetFeedbackActions();
    };

    return [controls];
  }

  // ---------- theoretical framework suggestion (Theory field) ----------
  // Pulls the six context fields, asks the backend to either match an
  // existing entry in research-theoretical-frameworks.md or draft a new one.
  // A drafted entry is only ever a proposal shown in the panel — nothing is
  // written to the file until the user explicitly clicks "Add this to my
  // framework library" (see handleAddFramework in server.js), since the
  // draft's citations may be AI-fabricated and the file holds real sources.
  function collectFrameworkContextFields() {
    const val = (key) => {
      const input = doc.querySelector('[data-field="' + key + '"]');
      return input ? input.value : '';
    };
    const rqList = doc.querySelector('.list-rows[data-list-key="researchQuestions"]');
    return {
      background: val('background'),
      goal: val('goal'),
      problemStatement: val('problemStatement'),
      objective: val('objective'),
      hypothesis: val('hypothesis'),
      researchQuestions: rqList ? collectListValues(rqList).join('\n') : '',
    };
  }

  function suggestFramework() {
    return fetch('/api/suggest-framework', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: collectFrameworkContextFields() }),
    }).then((res) => {
      return res.json().catch(() => ({})).then((data) => {
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        return data;
      });
    });
  }

  function addFrameworkEntry(draft) {
    return fetch('/api/add-framework', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    }).then((res) => {
      return res.json().catch(() => ({})).then((data) => {
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        return data;
      });
    });
  }

  // Pulls just the first "Key References" bullet out of a matched entry's
  // raw markdown — the file lists the more foundational/original citation
  // first within each entry (e.g. Reckwitz before Kuijer, Davis before
  // Venkatesh), so "first" is a reasonable deterministic stand-in for "most
  // foundational" without needing another model call to choose one.
  function extractFirstReference(entryText) {
    const m = entryText.match(/\*\*Key References:\*\*\s*\n\s*\*\s*(.+)/);
    return m ? m[1].trim() : null;
  }

  // Condenses one of the file's full academic citations — "Surname, F. M.,
  // Surname, F. (Year). Title. *Journal*, vol(issue), pages. URL" or
  // "Surname, F. (Year). *Title*. Publisher." — down to the short
  // "Author et al. (Year). Title. URL" form used in the panel. Pure string
  // reformatting of text that already came verbatim from the file, so there
  // is nothing here for the model to get wrong or invent.
  function formatFrameworkReference(raw) {
    const m = raw.match(/^(.*?)\((\d{4})\)\.\s*(.*)$/);
    if (!m) return raw;
    const authorsPart = m[1].trim();
    const year = m[2];
    let rest = m[3].trim();

    let url = '';
    const urlMatch = rest.match(/(https?:\/\/\S+?)\.?$/);
    if (urlMatch) {
      url = urlMatch[1];
      rest = rest.slice(0, urlMatch.index).trim();
    }

    // The title's own end boundary is the first sentence period — except
    // when the citation IS just "*Book Title*. Publisher." with nothing
    // before the italics, since then the italicised text is the title
    // itself rather than a container it needs distinguishing from (e.g. a
    // journal name, or an editors/book clause in "In X (Eds.), *Book*").
    let title;
    const starIdx = rest.indexOf('*');
    if (starIdx === 0) {
      const italicTitleMatch = rest.match(/^\*(.+?)\*/);
      title = italicTitleMatch ? italicTitleMatch[1] : rest;
    } else {
      const periodIdx = rest.indexOf('. ');
      title = (periodIdx === -1 ? rest : rest.slice(0, periodIdx)).replace(/\.$/, '').trim();
    }

    const surnames = [...authorsPart.matchAll(/([A-Z][A-Za-zÀ-ÿ'’-]+),\s*[A-Z]\./g)].map((mm) => mm[1]);
    let authorLabel = authorsPart;
    if (surnames.length === 1) authorLabel = surnames[0];
    else if (surnames.length === 2) authorLabel = surnames[0] + ' & ' + surnames[1];
    else if (surnames.length > 2) authorLabel = surnames[0] + ' et al.';

    return `${authorLabel} (${year}). ${title}.` + (url ? ' ' + url : '');
  }

  function renderFrameworkSuggest() {
    const btn = el('button', 'eval-btn', { type: 'button' });
    const spinner = el('span', 'eval-spinner');
    const txt = el('span');
    txt.textContent = 'Suggest a framework';
    btn.append(spinner, txt);

    const panel = el('div', 'eval-panel fw-panel');
    panel.hidden = true;
    const head = el('div', 'eval-head');
    const badge = el('span', 'eval-badge');
    const hl = el('span', 'eval-hl');
    hl.textContent = 'Framework Suggestion';
    const dismiss = el('button', 'eval-x', { type: 'button' });
    dismiss.textContent = '✕';
    head.append(badge, hl, dismiss);

    const body = el('div', 'fw-body');
    panel.append(head, body);

    // Declining just hides the panel — nothing was ever written for a match,
    // and a draft is only written on explicit confirmation below, so there's
    // nothing to undo here.
    dismiss.addEventListener('click', () => { panel.hidden = true; });

    function renderMatched(data) {
      badge.textContent = 'MATCH FOUND';
      badge.style.background = '#2563eb';
      panel.style.background = '#eff6ff';
      panel.style.borderColor = '#bfdbfe';
      body.innerHTML = '';

      const summary = el('p', 'fw-rationale');
      const nameEl = document.createElement('strong');
      nameEl.textContent = data.name;
      summary.append('We recommend the ', nameEl, '. ', data.rationale);
      body.appendChild(summary);

      const rawRef = extractFirstReference(data.entry);
      if (rawRef) {
        const refBlock = el('p', 'fw-ref');
        refBlock.textContent = 'For a starting point, see: ' + formatFrameworkReference(rawRef);
        body.appendChild(refBlock);
      }
    }

    function renderDraft(data) {
      const d = data.draft;
      badge.textContent = 'NEW DRAFT';
      badge.style.background = '#d97706';
      panel.style.background = '#fffbeb';
      panel.style.borderColor = '#fde68a';
      body.innerHTML = '';

      const note = el('p', 'fw-rationale');
      note.textContent = 'No existing framework in the library is a strong fit. ' + d.rationale;
      body.appendChild(note);

      const category = el('div', 'fw-category');
      category.textContent = 'Proposed category: ' + d.category.replace(/^##\s*\d+\.\s*/, '');
      body.appendChild(category);

      const entryText = '### ' + d.name + '\n' +
        '* **Core Focus:** ' + d.coreFocus + '\n' +
        '* **UXR Application:** ' + d.uxrApplication + '\n' +
        '* **Key References:**\n' +
        d.references.map((r) => '  * ' + r).join('\n');
      const entry = el('div', 'fw-entry');
      entry.textContent = entryText;
      body.appendChild(entry);

      const warn = el('div', 'field-warning fw-warn');
      warn.textContent = 'AI-drafted, including the citations — verify accuracy before adding it to the library.';
      body.appendChild(warn);

      const actions = el('div', 'eval-actions');
      const addBtn = el('button', 'eval-btn fw-add-btn', { type: 'button' });
      addBtn.textContent = 'Add this to my framework library';
      actions.appendChild(addBtn);
      body.appendChild(actions);

      addBtn.addEventListener('click', () => {
        addBtn.disabled = true;
        addBtn.textContent = 'Adding…';
        addFrameworkEntry({
          category: d.category,
          name: d.name,
          coreFocus: d.coreFocus,
          uxrApplication: d.uxrApplication,
          references: d.references,
        }).then(() => {
          addBtn.textContent = 'Added to library ✓';
        }).catch((err) => {
          alert('Adding framework failed: ' + err.message);
          addBtn.disabled = false;
          addBtn.textContent = 'Add this to my framework library';
        });
      });
    }

    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.classList.add('loading');
      txt.textContent = 'Suggesting…';
      suggestFramework().then((data) => {
        if (data.matched) renderMatched(data);
        else renderDraft(data);
        panel.hidden = false;
      }).catch((err) => {
        alert('Framework suggestion failed: ' + err.message);
      }).finally(() => {
        btn.disabled = false;
        btn.classList.remove('loading');
        txt.textContent = 'Suggest a framework';
      });
    });

    return [btn, panel];
  }

  // ---------- methods (grouped by research question) ----------
  // Methods follows the same "linked list" idea as Outcomes (see
  // renderLinkedOutcomesField): Research Questions drives the structure. The
  // difference is shape — Outcomes is one row per question, Methods is a
  // whole variable-length list per question, so each question gets a labelled
  // *group* with its own numbered rows and its own "+ Add method" button.
  // Before any question has content there's a single unlabelled group, so the
  // field is never unusable.
  //
  // Groups are matched to Research Question *rows* positionally, not to the
  // filtered list of non-empty questions — a blank question row still holds
  // its place rather than shifting every group below it.
  function methodsGroupsEl() {
    return doc.querySelector('.methods-groups');
  }

  function methodsGroupEls() {
    const container = methodsGroupsEl();
    return container ? Array.from(container.querySelectorAll('.methods-group')) : [];
  }

  function methodsGroupAt(index) {
    return methodsGroupEls()[index] || null;
  }

  function methodsListIn(group) {
    return group ? group.querySelector('.list-rows') : null;
  }

  function methodsGroupValues(group) {
    const list = methodsListIn(group);
    return list ? collectListValues(list) : [];
  }

  function methodsAllValues() {
    return methodsGroupEls().reduce((all, g) => all.concat(methodsGroupValues(g)), []);
  }

  // Membership is checked per group, never globally: the same method
  // legitimately answers more than one research question, so a duplicate
  // across groups is valid and only a duplicate *within* one group is not.
  function groupHasMethod(group, name) {
    const target = name.trim().toLowerCase();
    return methodsGroupValues(group).some((v) => v.toLowerCase() === target);
  }

  function renumberMethodsGroup(group) {
    const list = methodsListIn(group);
    if (!list) return;
    list.querySelectorAll('.list-row').forEach((row, i) => {
      row.querySelector('.list-num').textContent = (i + 1) + '.';
      const removeBtn = row.querySelector('.list-remove');
      if (!removeBtn) return;
      // Same "keep at least one row" pattern as renderListField: row 0's
      // button reserves its space but goes invisible and inert.
      removeBtn.classList.toggle('list-remove-spacer', i === 0);
      removeBtn.disabled = i === 0;
    });
  }

  // Set by renderMethodsSuggest so group edits made anywhere — the ✕ on a
  // row, typing a name by hand — keep the suggestion panel's ticks honest.
  let methodsSuggestRefresh = null;
  function refreshMethodsSuggestSelection() {
    if (methodsSuggestRefresh) methodsSuggestRefresh();
  }

  function addMethodRowTo(group, value, focus) {
    const list = methodsListIn(group);
    if (!list) return null;
    const row = el('div', 'list-row');
    const num = el('span', 'list-num');
    const inp = el('input', 'finput list-input', {
      type: 'text',
      'data-field': 'methods',
      placeholder: list.dataset.placeholder || '',
    });
    attachMethodsCombobox(inp, METHODS);
    inp.value = value || '';
    inp.addEventListener('input', refreshMethodsSuggestSelection);
    const removeBtn = el('button', 'list-remove', { type: 'button' });
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      if (removeBtn.disabled) return;
      row.remove();
      renumberMethodsGroup(group);
      refreshMethodsSuggestSelection();
    });
    row.append(num, inp, removeBtn);
    list.appendChild(row);
    renumberMethodsGroup(group);
    if (focus) inp.focus();
    return row;
  }

  function buildMethodsGroup(placeholder) {
    // role=group so the aria-label syncMethodsGroups sets (the full research
    // question) is actually announced — the visible heading is only the
    // abbreviated "RQ<n> · <keyword>".
    const group = el('div', 'methods-group', { role: 'group' });
    const qLabel = el('div', 'methods-group-q');
    qLabel.hidden = true;
    group.appendChild(qLabel);
    const list = el('div', 'list-rows');
    list.dataset.listKey = 'methods';
    list.dataset.placeholder = placeholder || '';
    group.appendChild(list);
    const addBtnRow = el('div', 'add-btn-row');
    const addBtn = el('button', 'add-btn', { type: 'button' });
    addBtn.textContent = '+ Add method';
    addBtn.addEventListener('click', () => addMethodRowTo(group, '', true));
    addBtnRow.appendChild(addBtn);
    group.appendChild(addBtnRow);
    addMethodRowTo(group, '', false);
    return group;
  }

  // Fills any blank rows already in this group before adding new ones, and
  // skips names already in *this* group (case-insensitive), so adding
  // suggestions doesn't leave a stray empty row or duplicate a method the
  // user already typed under this question.
  function applyMethodsToGroup(group, names) {
    const list = methodsListIn(group);
    if (!list || names.length === 0) return;
    const rows = Array.from(list.querySelectorAll('.list-row'));
    const existing = new Set(methodsGroupValues(group).map((v) => v.toLowerCase()));
    let rowIdx = 0;
    names.forEach((name) => {
      if (existing.has(name.toLowerCase())) return;
      while (rowIdx < rows.length && rows[rowIdx].querySelector('.list-input').value.trim()) rowIdx++;
      if (rowIdx < rows.length) {
        rows[rowIdx].querySelector('.list-input').value = name;
        rowIdx++;
      } else {
        addMethodRowTo(group, name, false);
      }
      existing.add(name.toLowerCase());
    });
    renumberMethodsGroup(group);
    refreshMethodsSuggestSelection();
  }

  // Undo for a mis-clicked suggestion. Clears the row holding this method,
  // and removes the row outright unless it's the group's only one — every
  // group keeps at least one row, same as every other list in the form.
  function removeMethodFromGroup(group, name) {
    const list = methodsListIn(group);
    if (!list) return;
    const target = name.trim().toLowerCase();
    const rows = Array.from(list.querySelectorAll('.list-row'));
    const row = rows.find((r) => r.querySelector('.list-input').value.trim().toLowerCase() === target);
    if (!row) return;
    if (rows.length > 1) row.remove();
    else row.querySelector('.list-input').value = '';
    renumberMethodsGroup(group);
    refreshMethodsSuggestSelection();
  }

  // A full research question can't fit a third-width column, so group
  // headings are shortened to "RQ<n> · <topic>". The number is the part that
  // has to be reliable; the topic is a best-effort hint. Nothing is actually
  // lost — syncMethodsGroups keeps the full question on the heading's title
  // and on the group's aria-label.
  //
  // The topic is chosen by *what it is*, not by where it sits in the
  // sentence. Picking the first content words gives "Main pain" for "What
  // are the main pain points?" — a qualifier plus half a compound. So every
  // word is classified, maximal runs of adjacent nouns are collected, and
  // the best run wins.

  // Words that only ever open a question.
  const QUESTION_LEAD_WORDS = new Set([
    'what', 'which', 'how', 'why', 'when', 'where', 'who', 'whom', 'whose',
    'do', 'does', 'did', 'are', 'is', 'was', 'were', 'am', 'be',
    'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might',
    'have', 'has', 'had', 'there',
  ]);
  // Qualifier adjectives, dropped wherever they appear rather than only at
  // the front: "the main pain points" is about pain points, not about main.
  // Ordinals and small cardinals sit here too — a number is never a topic.
  const QUESTION_QUALIFIERS = new Set([
    'main', 'key', 'most', 'biggest', 'common', 'important', 'primary', 'top',
    'major', 'overall', 'general', 'specific', 'various', 'particular',
    'different', 'best', 'worst', 'more', 'much', 'many', 'some', 'any', 'all',
    'each', 'every', 'other', 'same', 'such', 'very', 'just', 'only', 'also',
    'one', 'two', 'three', 'four', 'five', 'first', 'second', 'third',
    'fourth', 'fifth', 'last', 'next', 'new', 'old',
  ]);
  // Verbs describe what is being done, never what the question is about, so
  // a noun phrase is never allowed to span one. This is also what stops
  // "users think" and "parts selecting" being read as compounds.
  const QUESTION_VERBS = new Set([
    'think', 'thinks', 'feel', 'feels', 'say', 'says', 'want', 'wants',
    'need', 'needs', 'use', 'uses', 'make', 'makes', 'get', 'gets',
    'like', 'likes', 'know', 'knows', 'navigate', 'navigates', 'abandon',
    'abandons', 'experience', 'experiences', 'perceive', 'perceives',
    'describe', 'describes', 'understand', 'understands', 'expect', 'expects',
    'prefer', 'prefers', 'choose', 'chooses', 'find', 'finds', 'happen',
    'happens', 'occur', 'occurs', 'cause', 'causes', 'affect', 'affects',
    'complete', 'completes', 'select', 'selects', 'enter', 'enters',
    'leave', 'leaves', 'go', 'goes', 'come', 'comes', 'see', 'sees',
    'look', 'looks', 'take', 'takes', 'give', 'gives', 'been', 'being',
  ]);
  // The people doing the thing. Never the topic on their own — "What do
  // users think about the checkout?" is about the checkout — but perfectly
  // good *inside* a compound, which is why "user segment" survives. They
  // stay as phrase material and are only penalised when a phrase is nothing
  // but actors.
  const QUESTION_ACTORS = new Set([
    'user', 'users', 'person', 'people', 'participant', 'participants',
    'customer', 'customers', 'shopper', 'shoppers', 'visitor', 'visitors',
    'respondent', 'respondents', 'someone', 'anyone', 'everyone',
  ]);
  // Plural actors are the ones that act as a bare *subject* ("do users
  // rate…"). A bare singular actor can't be a subject without a determiner,
  // so it's a modifier instead ("user segment", "customer journey") — which
  // is why the two are treated differently in questionNounPhrases.
  const PLURAL_ACTORS = new Set([
    'users', 'people', 'participants', 'customers', 'shoppers', 'visitors',
    'respondents',
  ]);
  // Auxiliaries that front a question and push the main verb after the
  // subject: "How do users **rate** …". Without this cue there is no way to
  // tell that "rate" is the verb and not the noun in "conversion rate".
  const QUESTION_AUXILIARIES = new Set([
    'do', 'does', 'did', 'are', 'is', 'was', 'were', 'am',
    'can', 'could', 'will', 'would', 'should', 'shall', 'may', 'might',
    'have', 'has', 'had',
  ]);
  const QUESTION_STOPWORDS = new Set([
    'a', 'an', 'the', 'of', 'to', 'in', 'on', 'for', 'with', 'about', 'from',
    'by', 'at', 'as', 'and', 'or', 'but', 'if', 'than', 'then', 'that', 'this',
    'these', 'those', 'into', 'over', 'before', 'during', 'between',
    'through', 'across', 'within', 'without', 'after',
    'our', 'their', 'its', 'his', 'her', 'my', 'your', 'we', 'they', 'it',
    'you', 'us', 'them', 'me', 'i', 'not', 'no', 'while', 'because',
    'here', 'them',
  ]);
  // Words ending -ing are verb forms often enough to exclude by default;
  // these are the ones that are genuinely nouns in this domain.
  const ING_NOUNS = new Set([
    'onboarding', 'marketing', 'branding', 'testing', 'training', 'meeting',
    'briefing', 'pricing', 'shipping', 'listing', 'rating', 'setting',
    'settings', 'wording', 'funding', 'staffing', 'banking', 'messaging',
    'reporting', 'booking', 'billing',
  ]);
  const SHORT_LABEL_MAX = 20;

  function classifyQuestionWord(word) {
    if (word.length <= 2) return 'skip';
    if (QUESTION_LEAD_WORDS.has(word)) return 'skip';
    if (QUESTION_QUALIFIERS.has(word)) return 'skip';
    if (QUESTION_STOPWORDS.has(word)) return 'skip';
    if (QUESTION_VERBS.has(word)) return 'skip';
    // Crude morphology for the verbs not worth listing ("experienced",
    // "selecting"). The -ed rule needs a length floor or it would swallow
    // "need", "feed" and "speed".
    if (/ing$/.test(word) && !ING_NOUNS.has(word)) return 'skip';
    if (/ed$/.test(word) && word.length > 5) return 'skip';
    if (QUESTION_ACTORS.has(word)) return 'actor';
    return 'noun';
  }

  // Maximal runs of adjacent noun-ish words. Adjacency is measured on the
  // *original* word positions, so dropping "main" from "the main pain
  // points" cannot glue two unrelated words into a compound that was never
  // there — which is the whole point of rule 2.
  function questionNounPhrases(question) {
    const words = (question || '').toLowerCase().match(/[a-z0-9][a-z0-9'’-]*/g) || [];
    const phrases = [];
    let current = null;
    let sawAuxiliary = false;
    let prevWasPluralActor = false;
    words.forEach((word, index) => {
      if (QUESTION_AUXILIARIES.has(word)) sawAuxiliary = true;
      let kind = classifyQuestionWord(word);
      // In an auxiliary-fronted question the word straight after a plural
      // subject is the main verb, whatever else it could be elsewhere:
      // "How do users **rate** the pricing page?" is about the pricing page,
      // not about a "users rate". Without this, any noun/verb ambiguity
      // ("rate", "drop", "order", "design") glues itself to the subject and
      // produces exactly the dangling fragment rule 5 forbids.
      if (kind === 'noun' && sawAuxiliary && prevWasPluralActor) kind = 'skip';
      prevWasPluralActor = PLURAL_ACTORS.has(word);
      if (kind === 'skip') {
        current = null;
        return;
      }
      if (current && current.end === index - 1) {
        current.words.push(word);
        current.end = index;
        if (kind === 'noun') current.hasNoun = true;
      } else {
        current = { words: [word], start: index, end: index, hasNoun: kind === 'noun' };
        phrases.push(current);
      }
    });
    return phrases;
  }

  function pickQuestionPhrase(phrases) {
    let best = null;
    let bestScore = -Infinity;
    phrases.forEach((phrase) => {
      // Containing a real noun dominates everything: a phrase of nothing but
      // actors is the people, not the topic, and only wins if the question
      // offers nothing else. Then longer wins, so a compound beats a bare
      // noun ("user segment" over "issues"). Position is the last tie-break
      // only, which is what makes "the X of Y" resolve to X.
      const score = (phrase.hasNoun ? 1000 : 0) + phrase.words.length * 10 - phrase.start;
      if (score > bestScore) {
        bestScore = score;
        best = phrase;
      }
    });
    return best;
  }

  function shortQuestionLabel(question, index) {
    const rq = 'RQ' + (index + 1);
    const cleaned = (question || '').replace(/[?!.\s]+$/, '').trim();
    if (!cleaned) return rq;

    const phrase = pickQuestionPhrase(questionNounPhrases(cleaned));
    if (!phrase) return rq;

    // English compounds are head-final, so the last two words carry the head
    // plus its nearest modifier. Every word in a phrase is a noun, so this
    // can never end on a verb or a dangling adjective.
    let keyword = phrase.words.slice(-2).join(' ');
    if (keyword.length > SHORT_LABEL_MAX) {
      // Too long to keep the compound. Fall back to the single most
      // distinctive word rather than truncating both into a stub —
      // "Accessibility" reads; "Accessibility barri…" does not.
      keyword = phrase.words.reduce((a, b) => (b.length > a.length ? b : a));
    }
    if (keyword.length > SHORT_LABEL_MAX) {
      keyword = keyword.slice(0, SHORT_LABEL_MAX - 1).replace(/\s+$/, '') + '…';
    }
    return rq + ' · ' + keyword.charAt(0).toUpperCase() + keyword.slice(1);
  }

  // Keeps one group per Research Question row, in order, and keeps each
  // group's label in step with the question text as it's edited.
  function syncMethodsGroups() {
    const container = methodsGroupsEl();
    if (!container) return;
    const rqList = doc.querySelector('.list-rows[data-list-key="researchQuestions"]');
    const questions = rqList
      ? Array.from(rqList.querySelectorAll('.list-input')).map((i) => i.value.trim())
      : [];
    const hasAnyQuestion = questions.some(Boolean);
    const targetCount = hasAnyQuestion ? questions.length : 1;
    const placeholder = container.dataset.placeholder || '';

    let groups = methodsGroupEls();
    while (groups.length < targetCount) {
      container.appendChild(buildMethodsGroup(placeholder));
      groups = methodsGroupEls();
    }
    // Trailing groups only go when they're empty — same priority as
    // removeOutcomeRowAt, where preserving typed content beats tidiness.
    while (groups.length > targetCount) {
      const last = groups[groups.length - 1];
      if (methodsGroupValues(last).length) break;
      last.remove();
      groups = methodsGroupEls();
    }

    groups.forEach((group, i) => {
      const label = group.querySelector('.methods-group-q');
      if (!label) return;
      const text = questions[i] || '';
      label.hidden = !hasAnyQuestion;
      label.textContent = hasAnyQuestion ? shortQuestionLabel(text, i) : '';
      label.classList.toggle('methods-group-q-empty', hasAnyQuestion && !text);
      // The heading is abbreviated, so the full question is carried on the
      // group instead: title for hover, aria-label so screen-reader users
      // get the whole question rather than just "RQ2 · Checkout".
      if (hasAnyQuestion && text) {
        label.title = text;
        group.setAttribute('aria-label', 'Methods for ' + shortQuestionLabel(text, i) + ': ' + text);
      } else {
        label.removeAttribute('title');
        group.setAttribute('aria-label', hasAnyQuestion ? 'Methods for RQ' + (i + 1) : 'Methods');
      }
    });
    container.classList.toggle('methods-grouped', hasAnyQuestion);
    refreshMethodsSuggestSelection();
  }

  // Mirrors removeOutcomeRowAt: only drops the paired group when nothing has
  // been typed into it, so removing a question never silently deletes
  // methods. Whatever survives is re-labelled by the syncMethodsGroups call
  // that follows the removal.
  function removeMethodsGroupAt(index) {
    const group = methodsGroupAt(index);
    if (!group) return;
    if (methodsGroupValues(group).length) return;
    if (methodsGroupEls().length <= 1) return;
    group.remove();
  }

  function suggestMethods(objective, researchQuestions) {
    return fetch('/api/suggest-methods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objective, researchQuestions }),
    }).then((res) => {
      return res.json().catch(() => ({})).then((data) => {
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        return data;
      });
    });
  }

  function renderMethodsSuggest() {
    const btn = el('button', 'eval-btn', { type: 'button' });
    btn.disabled = true;
    const spinner = el('span', 'eval-spinner');
    const txt = el('span');
    txt.textContent = 'Suggest methods';
    btn.append(spinner, txt);

    const panel = el('div', 'eval-panel fw-panel');
    panel.hidden = true;
    const head = el('div', 'eval-head');
    const badge = el('span', 'eval-badge');
    badge.textContent = 'SUGGESTED METHODS';
    badge.style.background = '#6366f1';
    const hl = el('span', 'eval-hl');
    hl.textContent = 'Methods Suggestion';
    const dismiss = el('button', 'eval-x', { type: 'button' });
    dismiss.textContent = '✕';
    head.append(badge, hl, dismiss);
    const body = el('div', 'fw-body');
    panel.append(head, body);
    panel.style.background = '#eef2ff';
    panel.style.borderColor = '#c7d2fe';

    dismiss.addEventListener('click', () => { panel.hidden = true; });

    // Enabled only once Objective and at least one Research Question have
    // content — delegated on doc so it stays correct as rows/text change,
    // regardless of add/remove order relative to when this button renders.
    function isReady() {
      const objectiveInput = doc.querySelector('[data-field="objective"]');
      const rqList = doc.querySelector('.list-rows[data-list-key="researchQuestions"]');
      const hasObjective = !!(objectiveInput && objectiveInput.value.trim());
      const hasQuestion = !!(rqList && collectListValues(rqList).some((v) => v.trim()));
      return hasObjective && hasQuestion;
    }
    function updateEnabled() {
      if (!btn.classList.contains('loading')) btn.disabled = !isReady();
    }
    doc.addEventListener('input', updateEnabled);
    doc.addEventListener('click', updateEnabled);
    updateEnabled();

    // Ticks are derived from what's actually in each Methods group rather
    // than tracked separately here, so a method typed by hand or deleted
    // with its ✕ shows exactly the same state as one added from this panel.
    function syncSelection() {
      body.querySelectorAll('.ms-method[data-method-name]').forEach((row) => {
        const target = methodsGroupAt(Number(row.dataset.groupIndex));
        const on = !!target && groupHasMethod(target, row.dataset.methodName);
        row.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    methodsSuggestRefresh = syncSelection;

    // `entries` carries each question's Research Question *row* index, not
    // its position in the filtered list — see the collection in the click
    // handler below for why the two can differ.
    function renderResults(entries, perQuestion) {
      body.innerHTML = '';

      entries.forEach((entry, i) => {
        const group = el('div', 'ms-group');
        const qEl = el('div', 'ms-question');
        qEl.textContent = entry.text;
        group.appendChild(qEl);

        const methods = (perQuestion[i] && perQuestion[i].methods) || [];
        if (methods.length === 0) {
          const none = el('div', 'ms-none');
          none.textContent = 'No confident recommendation found for this question.';
          group.appendChild(none);
        }

        const names = [];
        methods.forEach((m) => {
          const name = (m.name || '').trim();
          const row = el('button', 'ms-method', { type: 'button', 'aria-pressed': 'false' });
          const tick = el('span', 'ms-method-tick', { 'aria-hidden': 'true' });
          tick.textContent = '✓';
          const nameEl = el('span', 'ms-method-name');
          nameEl.textContent = m.name || 'Unresolved';
          if (m.viaSearch) {
            const tag = el('span', 'ms-search-tag');
            tag.textContent = 'via web search';
            nameEl.append(' ', tag);
          }
          const reasonEl = el('div', 'ms-method-reason');
          reasonEl.textContent = m.reason;
          row.append(tick, nameEl, reasonEl);
          if (m.source) {
            const src = el('div', 'ms-method-source');
            src.textContent = 'Source: ' + m.source;
            row.appendChild(src);
          }
          // An unresolved suggestion has no name to add, so it stays inert
          // rather than pretending to be a toggle.
          if (!name) {
            row.disabled = true;
          } else {
            row.dataset.methodName = name;
            row.dataset.groupIndex = String(entry.rowIndex);
            row.setAttribute('aria-label', name + ' — add to "' + entry.text + '"');
            row.addEventListener('click', () => {
              const target = methodsGroupAt(entry.rowIndex);
              if (!target) return;
              if (groupHasMethod(target, name)) removeMethodFromGroup(target, name);
              else applyMethodsToGroup(target, [name]);
            });
            names.push(name);
          }
          group.appendChild(row);
        });

        // Bulk action still exists, but scoped to this one question rather
        // than applying every suggestion to a single flat list.
        if (names.length) {
          const actions = el('div', 'eval-actions');
          const addAll = el('button', 'eval-btn fw-add-btn ms-add-all', { type: 'button' });
          addAll.textContent = 'Add all for this question';
          addAll.addEventListener('click', () => {
            const target = methodsGroupAt(entry.rowIndex);
            if (target) applyMethodsToGroup(target, [...new Set(names)]);
          });
          actions.appendChild(addAll);
          group.appendChild(actions);
        }

        body.appendChild(group);
      });

      syncSelection();
    }

    btn.addEventListener('click', () => {
      const objectiveInput = doc.querySelector('[data-field="objective"]');
      const rqList = doc.querySelector('.list-rows[data-list-key="researchQuestions"]');
      const objective = objectiveInput ? objectiveInput.value.trim() : '';
      // Keep each question's row index alongside its text. Methods groups are
      // positional on Research Question *rows*, but blank rows are dropped
      // before sending, so the filtered array's own index would drift from
      // the group index as soon as any question row is left empty.
      const entries = rqList
        ? Array.from(rqList.querySelectorAll('.list-input'))
            .map((inp, rowIndex) => ({ text: inp.value.trim(), rowIndex }))
            .filter((e) => e.text)
        : [];
      const questions = entries.map((e) => e.text);
      if (!objective || questions.length === 0) {
        alert('Please enter an Objective and at least one Research Question first.');
        return;
      }
      btn.disabled = true;
      btn.classList.add('loading');
      txt.textContent = 'Suggesting…';
      suggestMethods(objective, questions).then((data) => {
        if (!Array.isArray(data.perQuestion) || data.perQuestion.length !== questions.length) {
          throw new Error('Unexpected response shape — please try again');
        }
        renderResults(entries, data.perQuestion);
        panel.hidden = false;
      }).catch((err) => {
        alert('Methods suggestion failed: ' + err.message);
      }).finally(() => {
        btn.classList.remove('loading');
        txt.textContent = 'Suggest methods';
        updateEnabled();
      });
    });

    const btnRow = el('div', 'add-btn-row');
    btnRow.appendChild(btn);
    btnRow.appendChild(renderInfoTip('This only activates once Objective and at least one Research Question have content.'));

    return [btnRow, panel];
  }

  // ---------- stage timeline visualization ----------
  function getCellValue(td) {
    const select = td.querySelector('select');
    if (select) {
      if (select.value === '__other__') {
        const other = td.querySelector('.select-other-input');
        return other ? other.value : '';
      }
      return select.value;
    }
    const fileValue = td.querySelector('.file-value');
    if (fileValue) return fileValue.value;
    const dateInput = td.querySelector('input[type="date"]');
    if (dateInput) return dateInput.value;
    const input = td.querySelector('input');
    return input ? input.value : '';
  }

  // Builds a local-midnight Date from y/m/d and rejects values that rolled
  // over (e.g. day 30 in a 28-day month) instead of silently normalizing.
  function localDateFrom(year, month, day) {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  }

  function parseTimelineDate(value) {
    if (!value) return null;
    const trimmed = value.trim();
    // Native <input type="date"> always yields ISO YYYY-MM-DD. Parse it as a
    // local date explicitly — new Date("YYYY-MM-DD") parses as UTC midnight,
    // which shifts a day off in negative-UTC-offset timezones once read back
    // through local getters (getDate/getMonth/getFullYear).
    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return localDateFrom(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    // DD/MM/YYYY remains accepted for compatibility with manually-entered
    // values and any older draft data.
    const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return localDateFrom(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatTimelineDate(date) {
    const dd = String(date.getDate()).padStart(2, '0');
    const month = MONTH_ABBREVIATIONS[date.getMonth()];
    return dd + '-' + month + '-' + date.getFullYear();
  }

  // Same accent colors already used elsewhere (eval panel, status pills,
  // score styles), cycled if there are more stages than colors. Empty cells
  // use the same gray as an unfilled eval-dot ("0 contributions" look).
  const TIMELINE_STAGE_COLORS = ['#6366f1', '#16a34a', '#2563eb', '#dc2626', '#ea580c', '#a16207'];

  // One row per stage (table order), label + dates either side of the track,
  // same as the original bar chart — the only change is that each row's bar
  // is textured into small connected day/week squares (GitHub-contributions
  // style) instead of one solid rectangle. Position/width of that textured
  // region within the track is still proportional to the overall plan span.
  function renderTimelineChart(tableId, columns, container) {
    const stageIdx = columns.findIndex((c) => c.key === 'stage');
    const startIdx = columns.findIndex((c) => c.key === 'startDate');
    const endIdx = columns.findIndex((c) => c.key === 'completionDate');

    const rows = Array.from(document.getElementById(tableId).querySelectorAll('tbody tr')).map((tr) => {
      const cells = tr.children;
      return {
        stage: stageIdx >= 0 ? getCellValue(cells[stageIdx]) : '',
        start: startIdx >= 0 ? parseTimelineDate(getCellValue(cells[startIdx])) : null,
        end: endIdx >= 0 ? parseTimelineDate(getCellValue(cells[endIdx])) : null,
      };
    });
    const valid = rows.filter((r) => r.start && r.end && r.start <= r.end);

    container.innerHTML = '';
    if (valid.length === 0) {
      const msg = el('div', 'timeline-empty');
      msg.textContent = 'Add stages with start and completion dates to see a timeline.';
      container.appendChild(msg);
      return;
    }

    // First-seen order decides color assignment, independent of duplicates.
    const stageNames = [];
    valid.forEach((r) => {
      const name = r.stage || '(untitled stage)';
      if (!stageNames.includes(name)) stageNames.push(name);
    });
    const colorFor = (name) => TIMELINE_STAGE_COLORS[stageNames.indexOf(name) % TIMELINE_STAGE_COLORS.length];

    const dayMs = 86400000;
    const minStart = Math.min(...valid.map((r) => r.start.getTime()));
    const maxEnd = Math.max(...valid.map((r) => r.end.getTime()));
    const totalDays = Math.round((maxEnd - minStart) / dayMs) + 1;
    const useWeeks = totalDays > 90;
    const unitDays = useWeeks ? 7 : 1;

    // Week 1 begins on the plan's own earliest start date. In daily mode,
    // extend the grid to a whole number of plan-relative weeks so the final
    // week is displayed completely without using calendar-week boundaries.
    const week1 = minStart;
    const gridEnd = unitDays === 1
      ? minStart + (Math.ceil(totalDays / 7) * 7 - 1) * dayMs
      : maxEnd;

    // One shared grid, with the same column count and sizing, is reused by
    // the week ruler and every stage row. Cells begin on the plan's earliest
    // start date and continue through its final plan-relative week, so later
    // stage starts receive real empty cells before them rather than a gap.
    const cellStarts = [];
    for (let t = week1; t <= gridEnd; t += unitDays * dayMs) cellStarts.push(t);
    const cellCount = cellStarts.length;
    const cellsPerWeek = 7 / unitDays;

    const axis = el('div', 'timeline-axis');
    const axisSpacer = el('div', 'timeline-label');
    const axisTrack = el('div', 'timeline-axis-track');
    const axisStart = el('span', 'timeline-axis-date');
    axisStart.textContent = formatTimelineDate(new Date(minStart));
    const axisEnd = el('span', 'timeline-axis-date');
    axisEnd.textContent = formatTimelineDate(new Date(maxEnd));
    axisTrack.append(axisStart, axisEnd);
    axis.append(axisSpacer, axisTrack);
    container.appendChild(axis);

    const weeksRow = el('div', 'timeline-weeks');
    const weeksSpacer = el('div', 'timeline-label');
    const weeksGrid = el('div', 'timeline-weeks-grid');
    const weeksDatesSpacer = el('div', 'timeline-dates');
    weeksGrid.style.gridTemplateColumns = 'repeat(' + cellCount + ', minmax(0, 1fr))';
    let weekNum = 0;
    cellStarts.forEach((cellStart, i) => {
      if (i % cellsPerWeek !== 0) return;
      weekNum++;
      const mark = el('span', 'timeline-week-mark');
      mark.style.gridColumnStart = i + 1;
      mark.textContent = weekNum === 1 ? 'week 1' : 'w ' + weekNum;
      weeksGrid.appendChild(mark);
    });
    weeksRow.append(weeksSpacer, weeksGrid, weeksDatesSpacer);
    container.appendChild(weeksRow);

    valid.forEach((r) => {
      const name = r.stage || '(untitled stage)';
      const color = colorFor(name);
      const startLabel = formatTimelineDate(r.start);
      const endLabel = formatTimelineDate(r.end);

      const row = el('div', 'timeline-row');
      const label = el('div', 'timeline-label');
      label.textContent = name;
      const grid = el('div', 'timeline-row-grid');
      grid.style.gridTemplateColumns = 'repeat(' + cellCount + ', 1fr)';

      cellStarts.forEach((cellStart) => {
        const cellEnd = cellStart + (unitDays - 1) * dayMs;
        const covered = r.start.getTime() <= cellEnd && r.end.getTime() >= cellStart;
        const cell = el('div', 'timeline-bar-cell');
        if (covered) {
          cell.style.background = color;
          cell.title = name + ': ' + startLabel + ' – ' + endLabel;
        } else {
          cell.title = formatTimelineDate(new Date(cellStart));
        }
        grid.appendChild(cell);
      });

      const dates = el('div', 'timeline-dates');
      dates.textContent = startLabel + ' – ' + endLabel;
      row.append(label, grid, dates);
      container.appendChild(row);
    });
  }

  // Lets users bolt their own ad-hoc named fields onto a section instead of
  // being limited to what's predefined in research-plan-template.md — each
  // block is fully user-named (reusing the same .th-input editable-header
  // pattern as the Requirements table's column headers) plus a regular
  // content textarea. No outer field label is shown: the "+ Add additional
  // section" button is the only static UI, since each block supplies its
  // own heading. Printing needs no separate handling — it's the same live DOM,
  // and a block's name renders via .flabel just like every other field's
  // heading already does.
  function renderCustomFieldsField(field) {
    const wrap = el('div', 'field');
    const list = el('div', 'custom-fields-list');
    list.dataset.listKey = field.key;
    wrap.appendChild(list);

    function addBlock(focus) {
      const block = el('div', 'custom-field-block');
      const head = el('div', 'custom-field-head');
      const nameInp = el('input', 'th-input custom-field-name', { type: 'text', placeholder: 'Label' });
      const removeBtn = el('button', 'list-remove', { type: 'button' });
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => block.remove());
      head.append(nameInp, removeBtn);

      const body = el('textarea', 'finput field-ta custom-field-body', { 'data-field': field.key, placeholder: field.placeholder || '' });
      body.addEventListener('input', () => resizeTa(body));

      block.append(head, body);
      list.appendChild(block);
      resizeTa(body);
      if (focus) nameInp.focus();
      return block;
    }

    const addBtn = el('button', 'add-btn', { type: 'button' });
    addBtn.textContent = '+ Add additional section';
    addBtn.addEventListener('click', () => addBlock(true));
    wrap.appendChild(addBtn);

    return wrap;
  }

  function renderTableField(field) {
    const wrap = el('div', 'field');
    const label = el('label', 'flabel');
    label.textContent = field.label;
    appendInfoTip(label, field.key);
    wrap.appendChild(label);

    const tblWrap = el('div', 'tbl-wrap');
    const table = el('table', 'dtbl', { id: field.key + '-table' });
    const thead = el('thead');
    const headRow = el('tr');
    field.columns.forEach((c) => {
      const th = document.createElement('th');
      if (field.editableHeaders) {
        const headInp = el('input', 'th-input', { type: 'text', value: c.label });
        headInp.addEventListener('input', () => { c.label = headInp.value; });
        th.appendChild(headInp);
      } else {
        th.textContent = c.label;
      }
      headRow.appendChild(th);
    });
    const removeTh = document.createElement('th');
    removeTh.className = 'row-remove-th';
    headRow.appendChild(removeTh);
    thead.appendChild(headRow);
    const tbody = el('tbody');
    tbody.appendChild(buildRow(field.columns));
    updateRowRemoveButtons(tbody);
    table.append(thead, tbody);
    tblWrap.appendChild(table);
    wrap.appendChild(tblWrap);

    tables.push({ id: table.id, columns: field.columns, cols: field.columns.map((c) => c.key) });

    const addBtn = el('button', 'add-btn', { type: 'button' });
    const singular = field.label.replace(/s$/i, '').toLowerCase();
    addBtn.textContent = '+ Add ' + singular;
    addBtn.addEventListener('click', () => addRow(table.id, field.columns));
    wrap.appendChild(addBtn);

    if (field.key === 'stageTimeline') {
      const vizBtn = el('button', 'btn btn-ghost timeline-viz-btn', { type: 'button' });
      vizBtn.textContent = 'Visualize Timeline';
      const chart = el('div', 'timeline-chart');
      chart.hidden = true;

      const refreshTimeline = () => renderTimelineChart(table.id, field.columns, chart);

      // Always render the current timeline for printing, then restore the
      // user's previous on-screen visibility choice when printing finishes.
      let chartWasHiddenBeforePrint = null;
      window.addEventListener('beforeprint', () => {
        if (chartWasHiddenBeforePrint === null) chartWasHiddenBeforePrint = chart.hidden;
        refreshTimeline();
        chart.hidden = false;
      });
      window.addEventListener('afterprint', () => {
        if (chartWasHiddenBeforePrint === null) return;
        chart.hidden = chartWasHiddenBeforePrint;
        chartWasHiddenBeforePrint = null;
      });

      vizBtn.addEventListener('click', () => {
        chart.hidden = !chart.hidden;
        vizBtn.textContent = chart.hidden ? 'Visualize Timeline' : 'Hide Timeline';
        if (!chart.hidden) refreshTimeline();
      });
      table.addEventListener('input', () => { if (!chart.hidden) refreshTimeline(); });
      table.addEventListener('change', () => { if (!chart.hidden) refreshTimeline(); });

      wrap.append(vizBtn, chart);
    }

    return wrap;
  }

  // ---------- list fields (dynamic stack of single-line inputs) ----------
  function collectListValues(list) {
    return Array.from(list.querySelectorAll('.list-input')).map((i) => i.value.trim()).filter(Boolean);
  }

  // Keeps each visible row's original number even when an earlier row is
  // blank, so Outcomes always pair with the same-position Research Question.
  function collectNumberedListValues(list) {
    return Array.from(list.querySelectorAll('.list-row')).map((row, index) => ({
      number: index + 1,
      text: row.querySelector('.list-input').value.trim(),
    })).filter((entry) => entry.text);
  }

  // Outcomes is a "linked" list (see renderLinkedOutcomesField below): it has
  // no *add* button of its own — Research Questions drives new rows here,
  // gated by field.key so renderListField stays generic — but each row does
  // get its own remove button, same as Research Questions' rows, so a
  // stray/extra Outcome can be deleted directly without touching the
  // paired question.
  function outcomesListEl() {
    return doc.querySelector('.list-rows[data-list-key="outcomes"]');
  }

  function renumberOutcomes() {
    const list = outcomesListEl();
    if (!list) return;
    list.querySelectorAll('.list-row').forEach((row, i) => {
      row.querySelector('.list-num').textContent = (i + 1) + '.';
      const removeBtn = row.querySelector('.list-remove');
      if (!removeBtn) return;
      // Same "keep at least one row" pattern as renderListField: row 0's
      // button reserves its space but goes invisible and inert.
      removeBtn.classList.toggle('list-remove-spacer', i === 0);
      removeBtn.disabled = i === 0;
    });
  }

  function addOutcomeRow(focus) {
    const list = outcomesListEl();
    if (!list) return;
    const row = el('div', 'list-row');
    const num = el('span', 'list-num');
    const inp = el('input', 'finput list-input', {
      type: 'text',
      'data-field': list.dataset.fieldKey || 'outcomes',
      placeholder: list.dataset.placeholder || '',
    });
    const removeBtn = el('button', 'list-remove', { type: 'button' });
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      if (removeBtn.disabled) return;
      row.remove();
      renumberOutcomes();
    });
    row.append(num, inp, removeBtn);
    list.appendChild(row);
    renumberOutcomes();
    if (focus) inp.focus();
  }

  // Only removes the paired Outcome row if it's still empty — preserving
  // anything the user typed takes priority over keeping the pairing tidy.
  function removeOutcomeRowAt(index) {
    const list = outcomesListEl();
    if (!list) return;
    const row = list.querySelectorAll('.list-row')[index];
    if (!row) return;
    const input = row.querySelector('.list-input');
    if (input && input.value.trim()) return;
    row.remove();
    renumberOutcomes();
  }

  // ---------- dynamic placeholders (Characteristics / User Groups) ----------
  // Generated from Background/Goal/Objective/Research Questions, but only
  // ever written to .placeholder — never .value — so this behaves exactly
  // like a normal HTML placeholder: visible only while empty, gone the
  // instant the user types, never submitted as real content.
  function collectParticipantContextFields() {
    const val = (key) => {
      const input = doc.querySelector('[data-field="' + key + '"]');
      return input ? input.value.trim() : '';
    };
    const rqList = doc.querySelector('.list-rows[data-list-key="researchQuestions"]');
    return {
      background: val('background'),
      goal: val('goal'),
      objective: val('objective'),
      researchQuestions: rqList ? collectListValues(rqList).join('\n') : '',
    };
  }

  // Cheap pre-check so a near-empty form never even calls the endpoint —
  // the server has the same check as a backstop, but the point is to avoid
  // spending the API call in the first place when there's too little to
  // work from.
  function hasEnoughContextForPlaceholders(ctx) {
    return (ctx.background + ctx.goal + ctx.objective + ctx.researchQuestions).trim().length >= 40;
  }

  function participantContextChanged(a, b) {
    if (!b) return true;
    return a.background !== b.background || a.goal !== b.goal || a.objective !== b.objective || a.researchQuestions !== b.researchQuestions;
  }

  let participantPlaceholderCache = null; // { inputs, characteristics, userGroups }
  let participantPlaceholderPromise = null; // in-flight request, de-duped across near-simultaneous focus events

  function ensureParticipantPlaceholders() {
    const ctx = collectParticipantContextFields();
    if (!hasEnoughContextForPlaceholders(ctx)) return Promise.resolve(null);

    if (participantPlaceholderCache && !participantContextChanged(ctx, participantPlaceholderCache.inputs)) {
      return Promise.resolve(participantPlaceholderCache);
    }
    if (participantPlaceholderPromise) return participantPlaceholderPromise;

    participantPlaceholderPromise = fetch('/api/suggest-participant-placeholders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ctx),
    }).then((res) => {
      return res.json().catch(() => ({})).then((data) => {
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        return data;
      });
    }).then((data) => {
      const result = { inputs: ctx, characteristics: data.characteristics, userGroups: data.userGroups };
      participantPlaceholderCache = result;
      return result;
    }).catch((err) => {
      console.warn('Dynamic placeholder generation failed, keeping static placeholder:', err);
      return null;
    }).finally(() => {
      participantPlaceholderPromise = null;
    });

    return participantPlaceholderPromise;
  }

  // Applies to every currently-empty row of both fields, not just the one
  // that was focused — a single API call covers both fields, so whichever
  // one the user reaches next already has the fresh hint waiting.
  function applyParticipantPlaceholders(result) {
    if (!result) return;
    if (result.characteristics) {
      doc.querySelectorAll('.list-rows[data-list-key="characteristics"] .list-input').forEach((inp) => {
        if (!inp.value.trim()) inp.placeholder = result.characteristics;
      });
    }
    if (result.userGroups) {
      doc.querySelectorAll('.list-rows[data-list-key="userGroups"] .list-input').forEach((inp) => {
        if (!inp.value.trim()) inp.placeholder = result.userGroups;
      });
    }
  }

  function attachDynamicPlaceholder(inp) {
    inp.addEventListener('focus', () => {
      if (inp.value.trim()) return;
      ensureParticipantPlaceholders().then(applyParticipantPlaceholders);
    });
  }

  function renderListField(field) {
    const wrap = el('div', 'field');
    const label = el('label', 'flabel');
    label.textContent = field.label;
    appendInfoTip(label, field.key);
    if (field.optional) {
      const opt = el('span', 'fopt');
      opt.textContent = '(optional)';
      label.append(' ', opt);
    }
    wrap.appendChild(label);

    const list = el('div', 'list-rows');
    list.dataset.listKey = field.key;
    wrap.appendChild(list);

    function renumber() {
      const rows = list.querySelectorAll('.list-row');
      rows.forEach((row, i) => {
        row.querySelector('.list-num').textContent = (i + 1) + '.';
        const removeBtn = row.querySelector('.list-remove');
        // Keep the button's space reserved (visibility, not display:none) so
        // every row's input stays the same width regardless of which row is
        // first — only actually hiding it would make row 1 stretch wider.
        removeBtn.classList.toggle('list-remove-spacer', i === 0);
        removeBtn.disabled = i === 0;
      });
    }

    // Research Questions rows grow taller as their text wraps, instead of
    // scrolling horizontally like a normal single-line list input.
    const isGrowable = field.key === 'researchQuestions';

    // Soft nudge, not a hard cap: past 3 questions a study tends to get
    // unfocused, so flag it on the 4th row and keep flagging however many
    // more get added — only clearing once it's back down to 3 or fewer.
    let rqWarning = null;
    function updateResearchQuestionsWarning() {
      if (field.key !== 'researchQuestions') return;
      const rows = list.querySelectorAll('.list-row');
      if (rows.length < 4) {
        if (rqWarning) rqWarning.hidden = true;
        return;
      }
      if (!rqWarning) {
        rqWarning = el('div', 'field-warning');
        rqWarning.textContent = 'Four questions may be too many for a study.';
      }
      rows[3].insertAdjacentElement('afterend', rqWarning);
      rqWarning.hidden = false;
    }

    function addRow(focus) {
      const row = el('div', 'list-row');
      const num = el('span', 'list-num');
      const inp = isGrowable
        ? el('textarea', 'finput list-input', { rows: '1', 'data-field': field.key, placeholder: field.placeholder || '' })
        : el('input', 'finput list-input', { type: 'text', 'data-field': field.key, placeholder: field.placeholder || '' });
      if (isGrowable) inp.addEventListener('input', () => resizeTa(inp));
      if (field.key === 'characteristics' || field.key === 'userGroups') attachDynamicPlaceholder(inp);
      // Each question's Methods group is labelled with its text, so the label
      // has to track edits as they're typed.
      if (field.key === 'researchQuestions') inp.addEventListener('input', syncMethodsGroups);
      const removeBtn = el('button', 'list-remove', { type: 'button' });
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => {
        if (removeBtn.disabled) return;
        if (field.key === 'researchQuestions') {
          const index = Array.from(list.querySelectorAll('.list-row')).indexOf(row);
          removeOutcomeRowAt(index);
          removeMethodsGroupAt(index);
        }
        row.remove();
        renumber();
        updateResearchQuestionsWarning();
        if (field.key === 'researchQuestions') syncMethodsGroups();
      });
      row.append(num, inp, removeBtn);
      list.appendChild(row);
      if (isGrowable) resizeTa(inp);
      renumber();
      if (field.key === 'researchQuestions') {
        addOutcomeRow();
        syncMethodsGroups();
      }
      updateResearchQuestionsWarning();
      if (focus) inp.focus();
      return row;
    }

    addRow(false);

    const addBtnRow = el('div', 'add-btn-row');
    const addBtn = el('button', 'add-btn', { type: 'button' });
    const singular = field.label.replace(/s$/i, '').toLowerCase();
    addBtn.textContent = '+ Add ' + singular;
    addBtn.addEventListener('click', () => addRow(true));
    addBtnRow.appendChild(addBtn);
    if (field.key === 'researchQuestions') {
      addBtnRow.appendChild(renderInfoTip('We recommend three research questions for a well-balanced study.'));
    }
    wrap.appendChild(addBtnRow);

    if (field.examples) wrap.append(...renderExamplePanel(field));
    if (field.eval) wrap.append(...renderEvalControls(field, () => collectNumberedListValues(list)));

    return wrap;
  }

  // Outcomes: same list-row visuals as renderListField. Rows are also driven
  // positionally by Research Questions (see addOutcomeRow/removeOutcomeRowAt
  // above) — each row gets its own remove button, wired in addOutcomeRow.
  // Its own "+ Add outcome" button lets extra outcomes be added beyond that
  // count. Starts empty; initOutcomesSync() seeds it to match once the whole
  // form (and Research Questions) has actually rendered.
  function renderLinkedOutcomesField(field) {
    const wrap = el('div', 'field');
    const label = el('label', 'flabel');
    label.textContent = field.label;
    appendInfoTip(label, field.key);
    wrap.appendChild(label);

    const list = el('div', 'list-rows');
    list.dataset.listKey = field.key;
    list.dataset.fieldKey = field.key;
    list.dataset.placeholder = field.placeholder || '';
    wrap.appendChild(list);

    const addBtn = el('button', 'add-btn', { type: 'button' });
    addBtn.textContent = '+ Add outcome';
    addBtn.addEventListener('click', () => addOutcomeRow(true));
    wrap.appendChild(addBtn);

    if (field.examples) wrap.append(...renderExamplePanel(field));
    if (field.eval) wrap.append(...renderEvalControls(field, () => collectNumberedListValues(list)));

    return wrap;
  }

  // Methods: a container of question-labelled groups instead of one flat
  // list. Only the first group is built here — the rest are created, removed
  // and labelled by syncMethodsGroups, which runs whenever a Research
  // Question is added, removed or edited, and once from the wire-up below.
  function renderGroupedMethodsField(field) {
    const wrap = el('div', 'field');
    const label = el('label', 'flabel');
    label.textContent = field.label;
    appendInfoTip(label, field.key);
    if (field.optional) {
      const opt = el('span', 'fopt');
      opt.textContent = '(optional)';
      label.append(' ', opt);
    }
    wrap.appendChild(label);

    const container = el('div', 'methods-groups');
    container.dataset.placeholder = field.placeholder || '';
    container.appendChild(buildMethodsGroup(field.placeholder || ''));
    wrap.appendChild(container);

    if (field.examples) wrap.append(...renderExamplePanel(field));
    if (field.eval) wrap.append(...renderEvalControls(field, () => methodsAllValues().join('\n')));
    wrap.append(...renderMethodsSuggest());

    return wrap;
  }

  function initMethodsGroupsSync() {
    syncMethodsGroups();
  }

  function initOutcomesSync() {
    const rqList = doc.querySelector('.list-rows[data-list-key="researchQuestions"]');
    const outcomesList = outcomesListEl();
    if (!rqList || !outcomesList) return;
    const targetCount = rqList.querySelectorAll('.list-row').length;
    while (outcomesListEl().querySelectorAll('.list-row').length < targetCount) {
      addOutcomeRow();
    }
  }

  // ---------- info tooltip (reusable hover/focus hint icon) ----------
  // Keyed by field.key, same lookup pattern as attachSignOffStamp below.
  // Add an entry here to put a "?" icon on any other field's label later.
  const FIELD_INFO_TIPS = {
    researchQuestions: 'Defines an inquiry that translates your objective into a clear and discoverable topic.',
    background: 'Provides sufficient context for the study, defines essential terms used across sections, and stays focused without unnecessary clutter.',
    goal: 'Focus on the target state of the product or user experience: What build, feature, or business metric will change if this project succeeds?',
    problemStatement: 'Identify the user segment(s) and the context within the issue occurs. Include a measurable metric, and keep the scope tight.',
    objective: 'Focus on deep understanding rather than proving a bias, connects to an upcoming decision, and remains realistic in scope.',
    hypothesis: 'An educated idea about user behaviour or product performance that your study will directly test. Rather than guessing, connects past knowledge to an upcoming product decision.',
    outcomes: 'Ties each deliverable to a specific research question and a concrete product or business decision.',
    theory: "An academic theory or framework that can help ground this study's design or analysis.",
    methods: "The research methods you'll use to answer your research questions.",
    characteristics: 'Traits or behaviours that define who you need to recruit for this study.',
    userGroups: 'The distinct user segments you want represented among participants.',
    sampleSize: 'How many participants you plan to recruit for this study.',
    requirements: "What you'll need to run this study — physical items, digital tools, and approvals.",
    stageTimeline: 'The planned schedule for each stage of this research, from planning through reporting.',
    actionPoints: 'Tasks needed to move this research forward, and who owns each one.',
    previousKnowledge: 'Prior research or documentation relevant to this study, attached for reference.',
    comments: "Anything else worth noting that didn't fit elsewhere in this plan.",
    projectOwner: 'The person accountable for this initiative on the product or business side.',
    researcher: 'The person leading and accountable for executing this research study.',
    researchTeam: 'Everyone contributing to this study beyond the two owners above.',
    lastUpdated: 'The date this plan was last edited.',
    project: 'The product or business initiative this research plan supports.',
    jiraProject: 'Links this plan to its tracking ticket in Jira.',
    projectDecision: 'The date the product or business decision this research needs to inform will be made.',
    reportResearch: 'The date you plan to share findings — ideally at least a week before the Project Decision date.',
    signOffProjectOwner: 'Project Owner approval — type initials and the date is added automatically.',
    signOffResearcher: 'Researcher approval — type initials and the date is added automatically.',
  };

  // The bubble is reparented to <body> with position:fixed while shown —
  // same trick as .combo-menu — so it always escapes any ancestor's
  // overflow:hidden (e.g. the accordion box) regardless of which field it's
  // attached to, and position is computed fresh each time so it can flip
  // below the icon when there isn't room above (e.g. a field near the top
  // of an open accordion).
  function renderInfoTip(text) {
    const tip = el('span', 'info-tip', { tabindex: '0', role: 'note', 'aria-label': text });
    tip.textContent = '?';
    const bubble = el('span', 'info-tip-bubble');
    bubble.textContent = text;
    bubble.hidden = true;

    let hideTimer = null;

    function position() {
      const rect = tip.getBoundingClientRect();
      const gap = 7;
      const bw = bubble.offsetWidth;
      const bh = bubble.offsetHeight;

      const fitsAbove = rect.top - gap - bh >= 0;
      bubble.style.top = (fitsAbove ? rect.top - bh - gap : rect.bottom + gap) + 'px';
      bubble.classList.toggle('info-tip-bubble-below', !fitsAbove);

      const left = Math.max(6, Math.min(rect.left + rect.width / 2 - bw / 2, window.innerWidth - bw - 6));
      bubble.style.left = left + 'px';
    }

    function show() {
      clearTimeout(hideTimer);
      if (bubble.parentNode !== document.body) document.body.appendChild(bubble);
      bubble.hidden = false;
      position();
      bubble.classList.add('show');
    }

    function hide() {
      bubble.classList.remove('show');
      hideTimer = setTimeout(() => {
        bubble.hidden = true;
        if (bubble.parentNode === document.body) bubble.remove();
      }, 160);
    }

    tip.addEventListener('mouseenter', show);
    tip.addEventListener('mouseleave', hide);
    tip.addEventListener('focus', show);
    tip.addEventListener('blur', hide);

    return tip;
  }

  function appendInfoTip(label, key) {
    const text = FIELD_INFO_TIPS[key];
    if (text) label.append(' ', renderInfoTip(text));
  }

  // ---------- Methods combobox (search suggestions, still free text) ----------
  // Same reparent-to-<body>-with-fixed-position trick as the file-upload "+"
  // menu, so the dropdown escapes the Methodology accordion's overflow:hidden
  // instead of getting clipped.
  const COMBO_MIN_WIDTH = 260;

  function attachMethodsCombobox(input, methods) {
    if (!methods || methods.length === 0) return;

    const menu = el('div', 'combo-menu', { role: 'listbox' });
    menu.hidden = true;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('autocomplete', 'off');

    let matches = [];
    let activeIndex = -1;
    let closeHandlers = null;

    function closeMenu() {
      menu.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      activeIndex = -1;
      if (closeHandlers) {
        document.removeEventListener('click', closeHandlers.onDocClick);
        window.removeEventListener('scroll', closeHandlers.onScroll, true);
        closeHandlers = null;
      }
      if (menu.parentNode === document.body) menu.remove();
    }

    function renderMatches() {
      menu.innerHTML = '';
      let activeEl = null;
      matches.forEach((m, i) => {
        const item = el('div', 'combo-item' + (i === activeIndex ? ' active' : ''), { role: 'option' });
        item.textContent = m;
        item.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
        // mousedown (not click) + preventDefault so this fires before the
        // input's blur would otherwise close the menu first — that also
        // means focus never actually left the input, so there's no need to
        // refocus it here (doing so would re-fire the focus handler below
        // and reopen the dropdown showing the just-picked value as a match).
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          input.value = m;
          closeMenu();
        });
        if (i === activeIndex) activeEl = item;
        menu.appendChild(item);
      });
      // Keyboard nav needs to scroll the highlighted item into view itself —
      // browsers don't do this automatically for a plain scrollable div.
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }

    // In the grouped Methods layout an input is only a third of the field
    // wide, which isn't enough to read "Participatory Design Workshops" in.
    // The menu is position:fixed on <body>, so it can be wider than the
    // column it belongs to without being clipped by it — it just has to
    // stay inside the viewport, hence the right-edge clamp.
    function position() {
      const rect = input.getBoundingClientRect();
      const available = Math.max(window.innerWidth - 16, 0);
      const width = Math.min(Math.max(rect.width, COMBO_MIN_WIDTH), available);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      menu.style.top = (rect.bottom + 4) + 'px';
      menu.style.left = left + 'px';
      menu.style.width = width + 'px';
    }

    function openMenu() {
      document.body.appendChild(menu);
      position();
      menu.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      const onDocClick = (e) => {
        if (!menu.contains(e.target) && e.target !== input) closeMenu();
      };
      // Close if the page scrolls (the dropdown is position:fixed, so it'd
      // visually detach from the input) — but not for scrolling inside the
      // dropdown's own list, which is a capture-phase 'scroll' event too.
      const onScroll = (e) => {
        if (menu.contains(e.target)) return;
        closeMenu();
      };
      closeHandlers = { onDocClick, onScroll };
      setTimeout(() => document.addEventListener('click', onDocClick), 0);
      window.addEventListener('scroll', onScroll, true);
    }

    function updateMatches() {
      const q = input.value.trim().toLowerCase();
      if (!q) { closeMenu(); return; }
      // No arbitrary cap here — .combo-menu's max-height + overflow-y:auto
      // (in style.css) is what limits how many show at once, so every match
      // stays reachable by scrolling instead of silently disappearing.
      matches = methods.filter((m) => m.toLowerCase().includes(q));
      activeIndex = -1;
      if (matches.length === 0) { closeMenu(); return; }
      renderMatches();
      if (menu.hidden) openMenu(); else position();
    }

    input.addEventListener('input', updateMatches);
    input.addEventListener('focus', () => { if (input.value.trim()) updateMatches(); });
    input.addEventListener('blur', () => { setTimeout(closeMenu, 100); });
    input.addEventListener('keydown', (e) => {
      if (menu.hidden) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, matches.length - 1);
        renderMatches();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        renderMatches();
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0) {
          e.preventDefault();
          input.value = matches[activeIndex];
          closeMenu();
        }
      } else if (e.key === 'Escape') {
        closeMenu();
      }
    });
  }

  // Jira ticket connector: searches the server-side Jira proxy (the API
  // token lives only in server.js — see /api/jira/search — never sent to
  // the browser) and lets the user pick a ticket, writing "KEY — summary"
  // into the field. Same reparented-dropdown pattern as attachMethodsCombobox,
  // but results come from the network instead of a static list, so matches
  // are debounced and stamped with a request id to discard stale responses.
  function attachJiraCombobox(input) {
    const menu = el('div', 'combo-menu', { role: 'listbox' });
    menu.hidden = true;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('autocomplete', 'off');

    let matches = [];
    let activeIndex = -1;
    let closeHandlers = null;
    let requestId = 0;
    let debounceTimer = null;
    let jiraEnabled = null; // unknown until /api/config resolves

    // Pill state (populated value) needs an explicit content-fit width —
    // see sizeInputToContent(). 26 = the pill's 11px horizontal padding on
    // each side, plus a small buffer.
    function updateWidth() {
      if (input.value.trim()) sizeInputToContent(input, 26);
      else input.style.width = '';
    }

    function closeMenu() {
      menu.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      activeIndex = -1;
      if (closeHandlers) {
        document.removeEventListener('click', closeHandlers.onDocClick);
        window.removeEventListener('scroll', closeHandlers.onScroll, true);
        closeHandlers = null;
      }
      if (menu.parentNode === document.body) menu.remove();
    }

    function renderMatches(message) {
      menu.innerHTML = '';
      if (message) {
        const note = el('div', 'combo-item combo-note');
        note.textContent = message;
        menu.appendChild(note);
        return;
      }
      let activeEl = null;
      matches.forEach((m, i) => {
        const item = el('div', 'combo-item' + (i === activeIndex ? ' active' : ''), { role: 'option' });
        const keySpan = el('span', 'combo-jira-key');
        keySpan.textContent = m.key;
        const sumSpan = el('span', 'combo-jira-summary');
        sumSpan.textContent = m.summary;
        item.append(keySpan, ' — ', sumSpan);
        item.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          input.value = m.key + ' — ' + m.summary;
          updateWidth();
          closeMenu();
        });
        if (i === activeIndex) activeEl = item;
        menu.appendChild(item);
      });
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }

    // Width/left come from the input's containing <td> (its stable layout
    // width in the Alignment grid), not the input itself — the input's own
    // width shrinks to fit its content while searching/showing the "pill"
    // (see updateWidth/sizeInputToContent above), so sizing the menu off
    // the input directly made it collapse to a couple of characters wide
    // mid-search, wrapping every suggestion's text into a vertical column.
    function position() {
      const rect = input.getBoundingClientRect();
      const widthRect = (input.closest('td') || input).getBoundingClientRect();
      menu.style.top = (rect.bottom + 4) + 'px';
      menu.style.left = widthRect.left + 'px';
      menu.style.width = widthRect.width + 'px';
    }

    function openMenu() {
      document.body.appendChild(menu);
      position();
      menu.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      const onDocClick = (e) => {
        if (!menu.contains(e.target) && e.target !== input) closeMenu();
      };
      const onScroll = (e) => {
        if (menu.contains(e.target)) return;
        closeMenu();
      };
      closeHandlers = { onDocClick, onScroll };
      setTimeout(() => document.addEventListener('click', onDocClick), 0);
      window.addEventListener('scroll', onScroll, true);
    }

    function runSearch(q) {
      const myId = ++requestId;
      matches = [];
      activeIndex = -1;
      renderMatches('Searching…');
      if (menu.hidden) openMenu(); else position();
      fetch('/api/jira/search?q=' + encodeURIComponent(q))
        .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
        .then(({ ok, body }) => {
          if (myId !== requestId) return; // a newer keystroke already superseded this request
          if (!ok) { renderMatches(body.error || 'Jira search failed'); return; }
          matches = body.issues || [];
          activeIndex = -1;
          if (matches.length === 0) { renderMatches('No matching tickets'); return; }
          renderMatches();
        })
        .catch(() => {
          if (myId !== requestId) return;
          matches = [];
          renderMatches('Jira search failed');
        });
    }

    function updateMatches() {
      const q = input.value.trim();
      clearTimeout(debounceTimer);
      if (!q) { closeMenu(); return; }
      if (jiraEnabled === false) {
        matches = [];
        renderMatches('Jira is not configured — add JIRA_BASE_URL/EMAIL/API_TOKEN to .env');
        if (menu.hidden) openMenu(); else position();
        return;
      }
      debounceTimer = setTimeout(() => runSearch(q), 250);
    }

    getConfig().then((cfg) => { jiraEnabled = !!cfg.jiraEnabled; });

    input.addEventListener('input', updateMatches);
    input.addEventListener('input', updateWidth);
    input.addEventListener('focus', () => { if (input.value.trim()) updateMatches(); });
    input.addEventListener('blur', () => { setTimeout(closeMenu, 100); });
    input.addEventListener('keydown', (e) => {
      if (menu.hidden) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, matches.length - 1);
        renderMatches();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        renderMatches();
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && matches[activeIndex]) {
          e.preventDefault();
          input.value = matches[activeIndex].key + ' — ' + matches[activeIndex].summary;
          updateWidth();
          closeMenu();
        }
      } else if (e.key === 'Escape') {
        closeMenu();
      }
    });
  }

  // Sign-off fields: type initials, blur, and today's date gets appended
  // automatically (once) so nobody has to type the date by hand.
  function attachSignOffStamp(input, key) {
    if (key !== 'signOffProjectOwner' && key !== 'signOffResearcher') return;
    input.addEventListener('blur', () => {
      const val = input.value.trim();
      if (val && !/ — \d{2}\/\d{2}\/\d{4}$/.test(val)) {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        input.value = val + ' — ' + dd + '/' + mm + '/' + now.getFullYear();
      }
    });
  }

  function signOffHint(key) {
    if (key !== 'signOffProjectOwner' && key !== 'signOffResearcher') return null;
    const hint = el('div', 'field-hint');
    return hint;
  }

  // Warns when Report Research lands less than a week before Project
  // Decision, so there's no buffer for setbacks. The controls keep their
  // canonical values as ISO YYYY-MM-DD even though the segmented editor is
  // displayed as DD-MMM-YYYY.
  function initDeadlineConstraints() {
    const decisionInput = doc.querySelector('[data-field="projectDecision"]');
    const researchInput = doc.querySelector('[data-field="reportResearch"]');
    if (!decisionInput || !researchInput) return;

    // Report Research can't land after Project Decision — hard-blocked via
    // max= (constrains the native picker itself) plus a clamp-on-change
    // fallback, same approach as attachDateRangeConstraint for Stage
    // Timeline's start/completion pair (just the ceiling flipped).
    function clampResearch() {
      if (decisionInput.value && researchInput.value && researchInput.value > decisionInput.value) {
        setDateInputValue(researchInput, decisionInput.value);
      }
      researchInput.max = decisionInput.value || '';
    }
    decisionInput.addEventListener('change', clampResearch);
    researchInput.addEventListener('change', clampResearch);
    clampResearch();

    // Softer, complementary check: even a Report Research date that's
    // technically before the decision might not leave enough buffer.
    const warning = el('div', 'field-warning');
    warning.textContent = 'Allow a one-week buffer before the decision date.';
    warning.hidden = true;
    researchInput.closest('.date-control').insertAdjacentElement('afterend', warning);

    function checkWarning() {
      const decision = decisionInput.value ? new Date(decisionInput.value) : null;
      const research = researchInput.value ? new Date(researchInput.value) : null;
      if (!decision || !research || isNaN(decision) || isNaN(research)) {
        warning.hidden = true;
        return;
      }
      const diffDays = (decision - research) / 86400000;
      warning.hidden = diffDays >= 7;
    }

    decisionInput.addEventListener('change', checkWarning);
    researchInput.addEventListener('change', checkWarning);
    checkWarning();
  }

  function renderField(field) {
    if (field.type === 'table') return renderTableField(field);
    if (field.type === 'list') {
      if (field.key === 'outcomes') return renderLinkedOutcomesField(field);
      if (field.key === 'methods') return renderGroupedMethodsField(field);
      return renderListField(field);
    }
    if (field.type === 'custom-fields') return renderCustomFieldsField(field);

    const wrap = el('div', 'field');
    const label = el('label', 'flabel');
    label.textContent = field.label;
    appendInfoTip(label, field.key);
    if (field.optional) {
      const opt = el('span', 'fopt');
      opt.textContent = '(optional)';
      label.append(' ', opt);
    }
    wrap.appendChild(label);

    // Reuses the same .ssel dropdown + "Other…" escape hatch as a table's
    // "select" columns (see buildRow's select branch for Stage Timeline)
    // instead of introducing a second dropdown component. Only one of
    // sel/otherInput carries data-field at a time — whichever is currently
    // showing — so a generic [data-field="key"] lookup elsewhere always
    // finds the field's actual current value, not a stale hidden one.
    if (field.type === 'select') {
      const selectCell = el('div', 'select-cell');
      selectCell.dataset.fieldKey = field.key;
      const sel = document.createElement('select');
      sel.className = 'ssel ss-ns';
      sel.setAttribute('data-field', field.key);
      (field.options || []).forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        sel.appendChild(o);
      });
      const otherOpt = document.createElement('option');
      otherOpt.value = '__other__';
      otherOpt.textContent = 'Other…';
      sel.appendChild(otherOpt);

      const otherRow = el('div', 'select-other-row');
      const otherInput = el('input', 'finput select-other-input', {
        type: 'text',
        placeholder: 'Type your own value…',
      });
      const backBtn = el('button', 'select-other-back', { type: 'button', title: 'Choose from the list instead' });
      backBtn.textContent = '▾';
      otherRow.append(otherInput, backBtn);
      otherRow.hidden = true;

      sel.addEventListener('change', () => {
        if (sel.value === '__other__') {
          sel.hidden = true;
          sel.removeAttribute('data-field');
          otherRow.hidden = false;
          otherInput.setAttribute('data-field', field.key);
          otherInput.focus();
        }
      });
      backBtn.addEventListener('click', () => {
        otherInput.value = '';
        otherInput.removeAttribute('data-field');
        otherRow.hidden = true;
        sel.hidden = false;
        sel.setAttribute('data-field', field.key);
        sel.value = (field.options && field.options[0]) || '';
        sel.focus();
      });

      selectCell.append(sel, otherRow);
      wrap.appendChild(selectCell);
      return wrap;
    }

    if (field.type === 'date') {
      const dateControl = buildDateControl('finput', { 'data-field': field.key }, field.label);
      wrap.appendChild(dateControl.element);
      return wrap;
    }

    const isTextarea = field.type === 'textarea';
    const input = el(isTextarea ? 'textarea' : 'input', isTextarea ? 'finput field-ta' : 'finput', {
      'data-field': field.key,
      placeholder: field.placeholder || '',
    });
    if (!isTextarea) input.type = 'text';
    attachSignOffStamp(input, field.key);
    wrap.appendChild(input);
    const hint = signOffHint(field.key);
    if (hint) wrap.appendChild(hint);

    if (field.examples) wrap.append(...renderExamplePanel(field));
    if (field.eval) wrap.append(...renderEvalControls(field, () => input.value));
    if (field.key === 'theory') wrap.append(...renderFrameworkSuggest());

    return wrap;
  }

  function renderChevron() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'acc-chevron');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.5');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M9 6l6 6-6 6');
    svg.appendChild(path);
    return svg;
  }

  function renderSection(section) {
    const bodyId = 'body-' + section.slug;
    const acc = el('div', 'acc', { 'data-open': section.open ? 'true' : 'false' });

    const head = el('button', 'acc-head', {
      type: 'button',
      'data-acc-toggle': '',
      'aria-expanded': section.open ? 'true' : 'false',
      'aria-controls': bodyId,
    });
    const headLeft = el('div', 'acc-head-left');
    const titleSpan = el('span', 'acc-title');
    titleSpan.textContent = section.title;
    headLeft.append(renderChevron(), titleSpan);
    const count = el('span', 'acc-count');
    count.textContent = section.fields.length + (section.fields.length === 1 ? ' field' : ' fields');
    head.append(headLeft, count);
    acc.appendChild(head);

    const body = el('div', 'acc-body', { id: bodyId });
    body.hidden = !section.open;

    if (section.grid) {
      const tblWrap = el('div', 'tbl-wrap');
      const table = el('table', 'atbl');
      const tbody = el('tbody');

      function buildGridCell(f) {
        const td = document.createElement('td');
        const lbl = el('div', 'clbl');
        lbl.textContent = f.label;
        appendInfoTip(lbl, f.key);
        let inp;
        let control;
        if (f.type === 'date') {
          const dateControl = buildDateControl('cinput', { 'data-field': f.key }, f.label);
          inp = dateControl.input;
          control = dateControl.element;
        } else {
          inp = el('input', 'cinput', { type: 'text', 'data-field': f.key, placeholder: f.placeholder || '' });
          control = inp;
        }
        attachSignOffStamp(inp, f.key);
        if (f.key === 'jiraProject') attachJiraCombobox(inp);
        td.append(lbl, control);
        const hint = signOffHint(f.key);
        if (hint) td.appendChild(hint);
        return td;
      }

      // Jira Project gets its own full-width row (more room for the ticket
      // combobox and its "KEY — summary" pill) instead of the usual
      // 2-per-row pairing. Whatever field would have shared a row with it
      // also gets bumped to its own full-width row rather than left paired
      // with an empty cell.
      let i = 0;
      while (i < section.fields.length) {
        const f = section.fields[i];
        const next = section.fields[i + 1];
        const tr = el('tr');
        if (f.key === 'jiraProject' || (next && next.key === 'jiraProject')) {
          const td = buildGridCell(f);
          td.colSpan = 2;
          tr.appendChild(td);
          i += 1;
        } else {
          tr.appendChild(buildGridCell(f));
          if (next) tr.appendChild(buildGridCell(next));
          i += 2;
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      tblWrap.appendChild(table);
      body.appendChild(tblWrap);
    } else {
      const fieldsWrap = el('div', 'fields');
      let groupWrap = null;
      let groupName = null;
      section.fields.forEach((f) => {
        if (f.group) {
          if (f.group !== groupName) {
            groupName = f.group;
            groupWrap = el('div', 'field-group');
            const groupTitle = el('div', 'field-group-title');
            groupTitle.textContent = groupName;
            groupWrap.appendChild(groupTitle);
            fieldsWrap.appendChild(groupWrap);
          }
          groupWrap.appendChild(renderField(f));
        } else {
          groupName = null;
          groupWrap = null;
          fieldsWrap.appendChild(renderField(f));
        }
      });
      body.appendChild(fieldsWrap);
    }

    acc.appendChild(body);
    return acc;
  }

  function renderHeader(header) {
    const wrap = el('div', 'doc-header');

    function buildMetaField(f) {
      const mf = el('div', 'mf');
      const label = el('div', 'mlabel');
      label.textContent = f.label;
      appendInfoTip(label, f.key);
      let input;
      let control;
      if (f.type === 'date') {
        const dateControl = buildDateControl('minput', { 'data-field': f.key }, f.label);
        input = dateControl.input;
        control = dateControl.element;
      } else {
        input = el('input', 'minput', { type: 'text', 'data-field': f.key, placeholder: f.placeholder || '' });
        control = input;
      }
      if (f.key === 'lastUpdated') {
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        setDateInputValue(input, now.getFullYear() + '-' + mm + '-' + dd);
      }
      mf.append(label, control);
      return mf;
    }

    // "Last Updated" sits in the top-right corner, next to "Research Plan"
    // (bottom-aligned with it via align-items:flex-end on the row) instead
    // of down in the regular meta grid with the other header fields.
    const topRow = el('div', 'doc-header-top');
    const supLabel = el('div', 'sup-label');
    supLabel.textContent = 'Research Plan';
    topRow.appendChild(supLabel);

    const metaGrid = el('div', 'meta-grid');
    header.meta.forEach((f) => {
      const mf = buildMetaField(f);
      if (f.key === 'lastUpdated') {
        mf.classList.add('mf-compact');
        topRow.appendChild(mf);
      } else {
        metaGrid.appendChild(mf);
      }
    });
    wrap.appendChild(topRow);

    const titleInput = el('textarea', 'title-inp field-ta', {
      rows: '1',
      'data-field': header.title.key,
      placeholder: header.title.placeholder || 'Title for your research plan',
    });
    wrap.appendChild(titleInput);
    wrap.appendChild(metaGrid);

    return wrap;
  }

  // "Additional Comments" isn't a titled accordion section like the others
  // — it's a single optional field, so showing an empty box for it by
  // default is more clutter than it's worth. renderField(field) builds the
  // exact same label/textarea/info-tip markup as always (so once revealed
  // it's indistinguishable from any other optional textarea field); this
  // just starts it hidden behind an "+ Add a comment" button matching the
  // .add-btn pattern used everywhere else. The field element itself is
  // always in the DOM from first render, never lazily created — see the
  // print override below for why that matters.
  function renderCommentsReveal(field) {
    const wrap = el('div', 'comments-block');

    const fieldEl = renderField(field);
    fieldEl.hidden = true;
    const ta = fieldEl.querySelector('[data-field="' + field.key + '"]');

    // Remove button only appears once revealed — it sits next to the label
    // (same reparent-in-place trick as elsewhere: grab what renderField
    // already built, wrap it, put it back) rather than being part of
    // renderField itself, since this reversible reveal/remove pair is
    // specific to this one field, not a general field capability.
    const labelEl = fieldEl.querySelector('.flabel');
    const labelRow = el('div', 'comments-label-row');
    labelEl.replaceWith(labelRow);
    const removeBtn = el('button', 'list-remove', { type: 'button', title: 'Remove comment' });
    removeBtn.textContent = '✕';
    labelRow.append(labelEl, removeBtn);

    const btn = el('button', 'add-btn', { type: 'button' });
    btn.textContent = '+ Add a comment';
    btn.addEventListener('click', () => {
      btn.hidden = true;
      fieldEl.hidden = false;
      if (ta) ta.focus();
    });

    removeBtn.addEventListener('click', () => {
      if (ta) { ta.value = ''; resizeTa(ta); }
      fieldEl.hidden = true;
      btn.hidden = false;
    });

    wrap.append(btn, fieldEl);
    return wrap;
  }

  function renderSchema(schema) {
    doc.innerHTML = '';
    tables.length = 0;
    doc.appendChild(renderHeader(schema.header));

    const sections = schema.sections.slice();
    const commentsIdx = sections.findIndex((s) => s.title === 'Additional Comments');
    const commentsField = commentsIdx !== -1 ? sections.splice(commentsIdx, 1)[0].fields[0] : null;

    sections.forEach((s) => doc.appendChild(renderSection(s)));
    if (commentsField) doc.appendChild(renderCommentsReveal(commentsField));
  }

  // ---------- clear form ----------
  // ---------- draft persistence (localStorage) ----------
  // The whole form is snapshotted under one key, saved debounced behind
  // edits, and restored on load. Restoring has to rebuild structure before
  // writing values: every dynamic list, table and methods group here starts
  // life with exactly one empty row, so the saved counts are replayed by
  // clicking the same "+ Add" buttons a user would.
  //
  // Version 1 is the pre-grouping shape, where Methods was one flat list
  // stored under lists.methods. Those drafts still load — see migrateDraft.
  const DRAFT_KEY = 'research-plan-app:draft';
  const DRAFT_VERSION = 3;
  const DRAFT_SAVE_DELAY_MS = 400;
  let draftRestoring = false;
  let draftTimer = null;

  // Storage can be absent or throw outright (private modes, blocked
  // cookies). A draft is a convenience, so every path here degrades to
  // "no draft" rather than breaking the form.
  function draftStore() {
    try {
      return window.localStorage || null;
    } catch (err) {
      return null;
    }
  }

  function getCellSnapshot(td) {
    const fileCell = td.querySelector('.file-cell');
    if (fileCell) {
      return {
        t: 'file',
        v: fileCell.querySelector('.file-value').value,
        n: fileCell.querySelector('.file-name').textContent,
      };
    }
    const selectCell = td.querySelector('.select-cell');
    if (selectCell) {
      const sel = selectCell.querySelector('.ssel');
      const other = selectCell.querySelector('.select-other-input');
      return {
        t: 'select',
        v: sel && sel.hidden ? '__other__' : (sel ? sel.value : ''),
        o: other ? other.value : '',
      };
    }
    const plainSel = td.querySelector('select');
    if (plainSel) return { t: 'sel', v: plainSel.value };
    const dateInput = td.querySelector('input[type="date"]');
    if (dateInput) return { t: 'date', v: dateInput.value };
    const input = td.querySelector('input');
    return { t: 'text', v: input ? input.value : '' };
  }

  function setCellSnapshot(td, snap) {
    if (!snap) return;
    if (snap.t === 'file') {
      const cell = td.querySelector('.file-cell');
      if (!cell) return;
      cell.querySelector('.file-value').value = snap.v || '';
      cell.querySelector('.file-name').textContent = snap.n || 'No file chosen';
      return;
    }
    if (snap.t === 'select') {
      const cell = td.querySelector('.select-cell');
      if (!cell) return;
      const sel = cell.querySelector('.ssel');
      const otherRow = cell.querySelector('.select-other-row');
      const other = cell.querySelector('.select-other-input');
      if (snap.v === '__other__') {
        if (sel) sel.hidden = true;
        if (otherRow) otherRow.hidden = false;
        if (other) other.value = snap.o || '';
      } else if (sel) {
        sel.hidden = false;
        if (otherRow) otherRow.hidden = true;
        if (other) other.value = '';
        sel.value = snap.v || '';
        updateSelectClass(sel);
      }
      return;
    }
    if (snap.t === 'sel') {
      const sel = td.querySelector('select');
      if (sel) {
        sel.value = snap.v || '';
        updateSelectClass(sel);
      }
      return;
    }
    if (snap.t === 'date') {
      const dateInput = td.querySelector('input[type="date"]');
      if (dateInput) setDateInputValue(dateInput, snap.v || '');
      return;
    }
    const input = td.querySelector('input');
    if (input) input.value = snap.v || '';
  }

  // Scalar fields are every [data-field] that isn't part of a repeating
  // structure — those are captured by their own collectors below.
  function scalarFieldEls() {
    return Array.from(doc.querySelectorAll('[data-field]')).filter((elm) => {
      return !elm.closest('.list-rows')
        && !elm.closest('.methods-groups')
        && !elm.closest('.select-cell')
        && !elm.classList.contains('custom-field-body');
    });
  }

  function collectDraft() {
    const fields = {};
    scalarFieldEls().forEach((elm) => { fields[elm.getAttribute('data-field')] = elm.value; });

    const selects = {};
    doc.querySelectorAll('.select-cell').forEach((cell) => {
      if (cell.closest('table') || !cell.dataset.fieldKey) return;
      const sel = cell.querySelector('.ssel');
      const other = cell.querySelector('.select-other-input');
      selects[cell.dataset.fieldKey] = {
        v: sel && sel.hidden ? '__other__' : (sel ? sel.value : ''),
        o: other ? other.value : '',
      };
    });

    const lists = {};
    doc.querySelectorAll('.list-rows[data-list-key]').forEach((list) => {
      if (list.closest('.methods-groups')) return;
      lists[list.dataset.listKey] = Array.from(list.querySelectorAll('.list-input')).map((i) => i.value);
    });

    // The question is read from the Research Questions rows, not from the
    // group's heading — that heading is only the abbreviated "RQ<n> ·
    // keyword", so reading it back would store a label where a question is
    // meant. Nothing consumes this on restore (syncMethodsGroups recomputes
    // headings from the live questions), but it keeps the saved shape
    // honest for anything that reads a draft later.
    const rqDraftList = doc.querySelector('.list-rows[data-list-key="researchQuestions"]');
    const rqDraftTexts = rqDraftList
      ? Array.from(rqDraftList.querySelectorAll('.list-input')).map((i) => i.value.trim())
      : [];
    const methods = methodsGroupEls().map((group, i) => {
      const list = methodsListIn(group);
      return {
        question: rqDraftTexts[i] || '',
        methods: list ? Array.from(list.querySelectorAll('.list-input')).map((i2) => i2.value) : [],
      };
    });

    const tableData = {};
    tables.forEach(({ id }) => {
      const table = document.getElementById(id);
      if (!table) return;
      tableData[id] = Array.from(table.querySelectorAll('tbody tr'))
        .map((tr) => Array.from(tr.querySelectorAll('td')).map(getCellSnapshot));
    });

    const custom = {};
    doc.querySelectorAll('.custom-fields-list').forEach((list) => {
      if (!list.dataset.listKey) return;
      custom[list.dataset.listKey] = Array.from(list.querySelectorAll('.custom-field-block')).map((block) => ({
        label: (block.querySelector('.custom-field-name') || {}).value || '',
        body: (block.querySelector('.custom-field-body') || {}).value || '',
      }));
    });

    return { fields, selects, lists, methods, tables: tableData, custom };
  }

  function saveDraft() {
    const store = draftStore();
    if (!store || draftRestoring) return;
    try {
      const payload = Object.assign(
        { version: DRAFT_VERSION, savedAt: new Date().toISOString() },
        collectDraft()
      );
      store.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch (err) {
      // Most likely a quota error or storage blocked mid-session. Editing
      // must keep working, so this is reported and otherwise ignored.
      console.warn('Could not save draft:', err);
    }
  }

  function scheduleDraftSave() {
    if (draftRestoring) return;
    if (draftTimer) window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(saveDraft, DRAFT_SAVE_DELAY_MS);
  }

  function clearDraft() {
    const store = draftStore();
    if (!store) return;
    if (draftTimer) window.clearTimeout(draftTimer);
    try {
      store.removeItem(DRAFT_KEY);
    } catch (err) {
      console.warn('Could not clear draft:', err);
    }
  }

  function readDraft() {
    const store = draftStore();
    if (!store) return null;
    let raw;
    try {
      raw = store.getItem(DRAFT_KEY);
    } catch (err) {
      return null;
    }
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      // A corrupt or hand-edited draft shouldn't wedge the form on every
      // load, so it's dropped rather than retried.
      console.warn('Ignoring unreadable draft:', err);
      return null;
    }
  }

  // Version 1 stored Methods as one flat list under lists.methods, with no
  // question association. Those names land in the first group, which is the
  // ungrouped list when no research question has content — so an old draft
  // opens looking exactly as it did before grouping existed.
  function migrateDraft(draft) {
    if (!draft) return null;
    const version = Number(draft.version) || 1;
    if (version >= DRAFT_VERSION) return draft;
    const migrated = Object.assign({}, draft, { version: DRAFT_VERSION });
    if (version < 2) {
      const flat = (draft.lists && draft.lists.methods) || [];
      migrated.methods = flat.length ? [{ question: '', methods: flat }] : [];
      migrated.lists = Object.assign({}, draft.lists);
      delete migrated.lists.methods;
    }
    // v3: RPA-31 renamed the "Problem" field to "Problem Statement", and the
    // field key is derived from the label by toCamelKey, so the stored key
    // changed with it. applyDraft only restores keys that match a live
    // data-field, so without this the old value would be dropped in silence.
    if (version < 3) {
      migrated.fields = Object.assign({}, migrated.fields);
      if (Object.prototype.hasOwnProperty.call(migrated.fields, 'problem')) {
        if (!migrated.fields.problemStatement) {
          migrated.fields.problemStatement = migrated.fields.problem;
        }
        delete migrated.fields.problem;
      }
    }
    return migrated;
  }

  // Replays "+ Add" clicks until the structure is as long as the draft.
  // The guard stops a malformed count from spinning forever.
  function growTo(currentCount, target, addBtn) {
    let guard = 0;
    while (addBtn && currentCount() < target && guard++ < 500) addBtn.click();
  }

  function applyDraft(draft) {
    // Lists first — Research Questions drives both Outcomes rows and Methods
    // groups, so its rows must exist before either is restored.
    const orderedListKeys = Object.keys(draft.lists || {})
      .sort((a, b) => (a === 'researchQuestions' ? -1 : b === 'researchQuestions' ? 1 : 0));
    orderedListKeys.forEach((key) => {
      const list = doc.querySelector('.list-rows[data-list-key="' + key + '"]');
      if (!list || list.closest('.methods-groups')) return;
      const values = draft.lists[key] || [];
      const addBtn = list.parentElement ? list.parentElement.querySelector('.add-btn') : null;
      growTo(() => list.querySelectorAll('.list-row').length, values.length, addBtn);
      const inputs = Array.from(list.querySelectorAll('.list-input'));
      values.forEach((v, i) => {
        if (!inputs[i]) return;
        inputs[i].value = v;
        inputs[i].dispatchEvent(new Event('input', { bubbles: true }));
      });
    });

    syncMethodsGroups();
    (draft.methods || []).forEach((saved, i) => {
      const group = methodsGroupAt(i);
      if (!group) return;
      const list = methodsListIn(group);
      const addBtn = group.querySelector('.add-btn');
      const values = saved.methods || [];
      growTo(() => list.querySelectorAll('.list-row').length, values.length, addBtn);
      const inputs = Array.from(list.querySelectorAll('.list-input'));
      values.forEach((v, j) => { if (inputs[j]) inputs[j].value = v; });
      renumberMethodsGroup(group);
    });

    scalarFieldEls().forEach((elm) => {
      const key = elm.getAttribute('data-field');
      if (!Object.prototype.hasOwnProperty.call(draft.fields || {}, key)) return;
      const value = draft.fields[key];
      if (elm.tagName === 'INPUT' && elm.type === 'date') {
        setDateInputValue(elm, value || '');
        elm.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      elm.value = value;
      if (elm.tagName === 'TEXTAREA') resizeTa(elm);
      if (elm.tagName === 'SELECT') updateSelectClass(elm);
      elm.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Non-table select cells are restored directly rather than through
    // setCellSnapshot: that helper searches downward from a <td>, and here
    // the cell itself is the element we already hold.
    Object.entries(draft.selects || {}).forEach(([key, snap]) => {
      const cell = Array.from(doc.querySelectorAll('.select-cell'))
        .find((c) => !c.closest('table') && c.dataset.fieldKey === key);
      if (!cell || !snap) return;
      const sel = cell.querySelector('.ssel');
      const otherRow = cell.querySelector('.select-other-row');
      const other = cell.querySelector('.select-other-input');
      if (snap.v === '__other__') {
        if (sel) {
          sel.hidden = true;
          sel.removeAttribute('data-field');
        }
        if (otherRow) otherRow.hidden = false;
        if (other) {
          other.value = snap.o || '';
          other.setAttribute('data-field', key);
        }
      } else if (sel) {
        sel.hidden = false;
        if (otherRow) otherRow.hidden = true;
        if (other) {
          other.value = '';
          other.removeAttribute('data-field');
        }
        sel.value = snap.v || '';
        sel.setAttribute('data-field', key);
        updateSelectClass(sel);
      }
    });

    Object.entries(draft.tables || {}).forEach(([id, rows]) => {
      const table = document.getElementById(id);
      if (!table) return;
      const tbody = table.querySelector('tbody');
      const addBtn = table.closest('.field') ? table.closest('.field').querySelector('.add-btn') : null;
      growTo(() => tbody.querySelectorAll('tr').length, rows.length, addBtn);
      const trs = Array.from(tbody.querySelectorAll('tr'));
      rows.forEach((cells, i) => {
        if (!trs[i]) return;
        const tds = Array.from(trs[i].querySelectorAll('td'));
        cells.forEach((snap, j) => { if (tds[j]) setCellSnapshot(tds[j], snap); });
      });
      updateRowRemoveButtons(tbody);
    });

    Object.entries(draft.custom || {}).forEach(([key, blocks]) => {
      const list = doc.querySelector('.custom-fields-list[data-list-key="' + key + '"]');
      if (!list) return;
      const addBtn = list.parentElement ? list.parentElement.querySelector('.add-btn') : null;
      growTo(() => list.querySelectorAll('.custom-field-block').length, blocks.length, addBtn);
      const els = Array.from(list.querySelectorAll('.custom-field-block'));
      blocks.forEach((b, i) => {
        if (!els[i]) return;
        const name = els[i].querySelector('.custom-field-name');
        const body = els[i].querySelector('.custom-field-body');
        if (name) name.value = b.label || '';
        if (body) {
          body.value = b.body || '';
          resizeTa(body);
        }
      });
    });

    syncMethodsGroups();
  }

  function restoreDraft() {
    const draft = migrateDraft(readDraft());
    if (!draft) return false;
    draftRestoring = true;
    try {
      applyDraft(draft);
      return true;
    } catch (err) {
      // A draft written by a different version of the form could reference
      // structure that no longer exists. Log it and leave the user with a
      // blank-but-working form rather than a half-applied one.
      console.warn('Could not fully restore draft:', err);
      return false;
    } finally {
      draftRestoring = false;
    }
  }

  function initDraftPersistence() {
    restoreDraft();
    // 'click' is included because adding or removing a row changes the
    // structure without ever firing input/change.
    doc.addEventListener('input', scheduleDraftSave);
    doc.addEventListener('change', scheduleDraftSave);
    doc.addEventListener('click', scheduleDraftSave);
  }

  function clearForm() {
    if (!window.confirm('Reset all fields? This cannot be undone.')) return;
    clearDraft();
    doc.querySelectorAll('input[type="text"]').forEach((el) => { el.value = ''; });
    doc.querySelectorAll('input[type="date"]').forEach((el) => { setDateInputValue(el, ''); });
    doc.querySelectorAll('textarea').forEach((el) => {
      el.value = '';
      resizeTa(el);
    });

    tables.forEach(({ id }) => {
      const tbody = document.getElementById(id).querySelector('tbody');
      tbody.querySelectorAll('tr').forEach((row, i) => { if (i > 0) row.remove(); });
      updateRowRemoveButtons(tbody);
    });
    doc.querySelectorAll('.list-rows').forEach((list) => {
      list.querySelectorAll('.list-row').forEach((row, i) => { if (i > 0) row.remove(); });
      const remaining = list.querySelector('.list-remove');
      if (remaining) {
        remaining.classList.add('list-remove-spacer');
        remaining.disabled = true;
      }
    });
    doc.querySelectorAll('.custom-fields-list').forEach((list) => {
      list.querySelectorAll('.custom-field-block').forEach((block) => block.remove());
    });
    // Methods groups are rebuilt from scratch rather than trimmed row by row
    // like the lists above: the group count tracks Research Questions, so
    // trimming alone would leave a group behind for every question the reset
    // just removed.
    const methodsContainer = methodsGroupsEl();
    if (methodsContainer) {
      methodsContainer.innerHTML = '';
      methodsContainer.appendChild(buildMethodsGroup(methodsContainer.dataset.placeholder || ''));
      syncMethodsGroups();
    }
    // Reset each dropdown to its own first option rather than hardcoding
    // 'not-started' — that value only exists on the status columns; other
    // .ssel dropdowns (Stage Timeline's Stage column, Sample Size) have
    // their own option sets and would otherwise reset to nothing selected.
    doc.querySelectorAll('.ssel').forEach((el) => { el.selectedIndex = 0; updateSelectClass(el); });
    // Any dropdown currently swapped to its "Other…" free-text input (see
    // the select-cell branch in renderField / buildRow) needs that swap
    // undone too, including re-attaching data-field to the dropdown.
    doc.querySelectorAll('.select-cell').forEach((cell) => {
      const sel = cell.querySelector('.ssel');
      const otherRow = cell.querySelector('.select-other-row');
      const otherInput = cell.querySelector('.select-other-input');
      if (!sel || !otherRow) return;
      if (otherInput) { otherInput.value = ''; otherInput.removeAttribute('data-field'); }
      otherRow.hidden = true;
      sel.hidden = false;
      if (cell.dataset.fieldKey) sel.setAttribute('data-field', cell.dataset.fieldKey);
    });
    doc.querySelectorAll('.file-cell').forEach((cell) => {
      cell.querySelector('.file-value').value = '';
      cell.querySelector('.file-name').textContent = 'No file chosen';
    });

    doc.querySelectorAll('.eval-panel').forEach((p) => { p.hidden = true; });
    doc.querySelectorAll('.eval-controls').forEach((controls) => {
      if (typeof controls._resetEvaluation === 'function') controls._resetEvaluation();
    });
    doc.querySelectorAll('.ex-panel').forEach((p) => { p.hidden = true; });
    doc.querySelectorAll('.ex-toggle').forEach((t) => { t.textContent = 'Show example'; });
  }

  // ---------- evaluation test profiles ----------
  function dispatchFieldUpdate(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (input.tagName === 'TEXTAREA') resizeTa(input);
  }

  function openProfileSections(fieldKeys) {
    fieldKeys.forEach((key) => {
      const input = doc.querySelector('[data-field="' + key + '"]');
      const acc = input && input.closest('.acc');
      if (!acc) return;
      acc.dataset.open = 'true';
      const head = acc.querySelector('.acc-head');
      const body = acc.querySelector('.acc-body');
      if (head) head.setAttribute('aria-expanded', 'true');
      if (body) body.hidden = false;
    });
  }

  function applyTestProfileList(key, values) {
    if (!values.length) throw new Error('Test profile list "' + key + '" cannot be empty');

    const list = doc.querySelector('.list-rows[data-list-key="' + key + '"]');
    if (!list) throw new Error('Could not find list field "' + key + '"');
    const addBtn = list.closest('.field').querySelector('.add-btn');
    if (!addBtn) throw new Error('Could not find add control for list field "' + key + '"');

    const rows = () => Array.from(list.querySelectorAll('.list-row'));
    while (rows().length < values.length) addBtn.click();
    while (rows().length > values.length) {
      const currentRows = rows();
      const removeBtn = currentRows[currentRows.length - 1].querySelector('.list-remove');
      if (!removeBtn || removeBtn.disabled) throw new Error('Could not resize list field "' + key + '"');
      removeBtn.click();
    }

    rows().forEach((row, index) => {
      const input = row.querySelector('.list-input');
      input.value = values[index];
      dispatchFieldUpdate(input);
    });
  }

  function applyTestProfile(profileKey) {
    const profiles = window.TEST_PROFILES || {};
    const profile = profiles[profileKey];
    if (!profile) throw new Error('Unknown test profile "' + profileKey + '"');

    Object.entries(profile.fields).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        applyTestProfileList(key, value);
        return;
      }
      const input = doc.querySelector('[data-field="' + key + '"]');
      if (!input) throw new Error('Could not find field "' + key + '"');
      input.value = value;
      dispatchFieldUpdate(input);
    });

    doc.querySelectorAll('.eval-panel').forEach((panel) => { panel.hidden = true; });
    doc.querySelectorAll('.eval-controls').forEach((controls) => {
      if (typeof controls._resetEvaluation === 'function') controls._resetEvaluation();
    });
    openProfileSections(Object.keys(profile.fields));
    return profile;
  }

  function initTestProfileControls() {
    if (!new URLSearchParams(window.location.search).has('test')) return;
    const profiles = window.TEST_PROFILES || {};
    const entries = Object.entries(profiles);
    if (!entries.length) {
      console.warn('Test mode requested, but no evaluation profiles were loaded.');
      return;
    }

    const controls = el('div', 'test-profile-controls');
    const select = el('select', 'test-profile-select', { 'aria-label': 'Evaluation test profile' });
    entries.forEach(([key, profile]) => {
      const option = el('option', '', { value: key });
      option.textContent = 'Test: ' + profile.label;
      select.appendChild(option);
    });

    const applyBtn = el('button', 'btn btn-ghost', { type: 'button' });
    applyBtn.textContent = 'Load Profile';
    applyBtn.addEventListener('click', () => {
      const profile = applyTestProfile(select.value);
      applyBtn.textContent = 'Loaded ' + profile.label;
      window.setTimeout(() => { applyBtn.textContent = 'Load Profile'; }, 1200);
    });

    controls.append(select, applyBtn);
    document.querySelector('.tb-btns').prepend(controls);
    window.applyTestProfile = applyTestProfile;
  }

  // ---------- wire up ----------
  function fetchText(url) {
    return fetch(url).then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    });
  }

  function showLoadError(err) {
    doc.innerHTML = '';
    const msg = el('div', 'doc-error');
    msg.textContent = 'Could not load "' + SCHEMA_URL + '" (' + err.message + '). ' +
      'If you opened this file directly from disk (file://), browsers block that fetch — ' +
      'serve the folder over a local server instead, e.g. run `python3 -m http.server` here ' +
      'and open http://localhost:8000/.';
    doc.appendChild(msg);
    console.error('Failed to load field schema:', err);
  }

  document.addEventListener('DOMContentLoaded', () => {
    Promise.all([
      fetchText(SCHEMA_URL),
      fetchText(RUBRIC_URL).catch((err) => {
        console.warn('Failed to load rubric "' + RUBRIC_URL + '" — evaluation will run without scoring criteria:', err);
        return '';
      }),
      fetchText(METHODS_URL).catch((err) => {
        console.warn('Failed to load methods list "' + METHODS_URL + '" — Methods field will have no suggestions:', err);
        return '';
      }),
    ])
      .then(([schemaText, rubricText, methodsText]) => {
        const schema = parseSchema(schemaText);
        attachRubrics(schema, parseRubric(rubricText));
        METHODS = parseMethodsList(methodsText);
        renderSchema(schema);
        initTextareas(doc);
        initStatusSelects(doc);
        initAccordion();
        initDeadlineConstraints();
        initOutcomesSync();
        initMethodsGroupsSync();
        initTestProfileControls();
        initDraftPersistence();
        document.getElementById('clear-btn').addEventListener('click', clearForm);
        document.getElementById('print-btn').addEventListener('click', () => window.print());
      })
      .catch(showLoadError);
  });
})();
