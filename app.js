(() => {
  'use strict';

  const SCHEMA_URL = 'research-plan-template.md';
  const RUBRIC_URL = 'research-plan-rubric.md';
  const METHODS_URL = 'research-methods.md';
  let doc = document.getElementById('doc');
  let formEvents = new AbortController();
  let formSchema = null;
  const {
    bindTextarea,
    bindTextareas,
    resizeTextarea,
    resizeTextareas,
  } = window.RPA_TEXTAREA_AUTOSIZE;

  // Populated from research-methods.md before renderSchema() runs; read by
  // attachMethodsCombobox via renderField's special-case for the "Methods"
  // field. Empty until loaded — the combobox just won't offer suggestions.
  let METHODS = [];

  // tables holds one entry per rendered <table> field: its DOM id, the
  // column definitions (for building rows), and the column keys (for
  // reading/writing draft rows as plain objects).
  const tables = [];
  // The user's draft choice is independent of temporary print visibility.
  let timelineVisible = false;
  let updateTimelineVisibility = null;
  let syncCommentsReveal = null;
  // When this plan was started, as opposed to when it was last saved
  // (draft.savedAt) or last changed (the lastUpdated field, which is
  // re-stamped on every edit and editable by hand). Nothing recorded it
  // before RPA-76, so a plan that predates this gets the earliest date we can
  // honestly claim rather than today — see migrateDraft.
  let planCreatedAt = todayIso();
  // Whether that date is the plan's own or a stand-in. RPA-76 falls back to
  // savedAt for plans that predate it, which was fine for a suggestion in one
  // cell and is not fine as a boundary: savedAt is the *last* save, so a plan
  // started in July and saved yesterday would get a floor of yesterday and
  // report its entire real schedule as impossible. The floor is only applied
  // where the date is the plan's own.
  let planCreatedAtExact = true;

  // ---------- small DOM helper ----------
  function el(tag, className, attrs) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  }

  // "Last Updated" means the date the plan's content last changed. It is
  // seeded at render for a brand-new plan and then maintained by saveDraft,
  // which is the only place that knows whether anything actually changed.
  function todayIso() {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + mm + '-' + dd;
  }

  // Last updated re-stamps itself whenever the plan's content changes. Once
  // someone sets it by hand that stops, because an edit you can make and then
  // lose on your next unrelated keystroke is worse than no edit at all. The
  // choice is remembered in the draft, so it survives a reload; Clear Form
  // resets it, since a cleared plan is a new plan.
  let lastUpdatedManual = false;
  // Set by the dateline; the stamp writes the value directly and fires no
  // event, so the visible sentence has to be told to redraw.
  let refreshDateline = () => {};
  let stampingLastUpdated = false;

  function setLastUpdatedToday() {
    const input = doc.querySelector('[data-field="lastUpdated"]');
    if (!input) return;
    stampingLastUpdated = true;
    try {
      setDateInputValue(input, todayIso());
    } finally {
      stampingLastUpdated = false;
    }
    refreshDateline();
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
      let [label, type, declaredKey] = labelType.split(':');
      label = label.trim();
      type = (type || 'text').trim().toLowerCase();
      if (placeholder === undefined) {
        // A cell with no declared placeholder gets none. It used to fall back
        // to "Enter text…", which is a placeholder telling you to type in a
        // box you can already see, under a column header that already names
        // what goes in it. Guidance belongs in the field's hint, where it
        // stays visible once typing starts.
        //
        // "No file chosen" is the exception and is not a placeholder: it is
        // the file cell's empty-state label, rendered as text rather than
        // into an input, so removing it would leave a bare button.
        placeholder = type === 'file' ? 'No file chosen' : '';
      } else {
        placeholder = placeholder.trim();
      }
      // A third colon segment pins the column's key, the way key= pins a
      // field's: "Start Date:date:startDate". Without it the key is derived
      // from the label, and four places read these by name — buildRow pairs
      // startDate with completionDate, applyTimelineAnchors looks up both, and
      // renderTimelineChart finds all three — so a copy edit to a heading used
      // to silently unhook the timeline (RPA-74).
      //
      // The colon is where it goes because the spec already splits on one, and
      // the "=" after it belongs to the placeholder or the select options.
      // toCamelKey stays the fallback so a column can still be added without
      // thinking about keys.
      const key = declaredKey && declaredKey.trim() ? declaredKey.trim() : toCamelKey(label);
      const col = { label, key, type, placeholder };
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
    // "key=someKey" pins the field's key so it no longer follows the label.
    // Read from the un-lowercased spec, because keys are camelCase and
    // typeParts above has already flattened the case.
    // Without this a copy edit renames the key, and every lookup by that name
    // fails silently — it happened twice in one day (RPA-55): renaming Report
    // Research killed the deadline warning, and renaming Title took out 26 of
    // 45 tests. toCamelKey stays as the fallback so a field can still be added
    // without thinking about keys.
    const declaredKey = m[2].split(',')
      .map((part) => part.trim())
      .map((part) => /^key=([A-Za-z][A-Za-z0-9]*)$/.exec(part))
      .filter(Boolean)
      .map((match) => match[1])[0];
    const field = {
      label,
      key: declaredKey || toCamelKey(label),
      type,
      optional: typeParts.includes('optional'),
      eval: typeParts.includes('eval'),
      editableHeaders: typeParts.includes('editable-headers'),
      // "prefill" starts a table with one row per option of its first select
      // column, that option already chosen. The stage names are the column's
      // options and live in this file, so a renamed or reordered stage flows
      // through without touching app.js — the alternative was a copy of the
      // five names in code, which is the coupling this template exists to
      // avoid (RPA-76).
      prefill: typeParts.includes('prefill'),
      // "row=stage" names what one row of a table is, for the Add button. It
      // used to be derived from the field's label by stripping a trailing
      // "s", which works while a table is named after its rows and breaks the
      // moment it is not: renaming Stage Timeline to Planned Schedule turned
      // "+ Add stage timeline" into "+ Add planned schedule", and you do not
      // add a schedule to a schedule. The label answers "what is this table",
      // the row noun answers "what is one of these", and they are not always
      // the same word.
      rowLabel: (() => {
        const part = typeParts.find((p) => /^row=[a-z][a-z-]*$/.test(p));
        return part ? part.slice(4) : null;
      })(),
      prose: typeParts.includes('prose'),
      // "rows=N" sets how tall a textarea starts — a hint about how much
      // answer the question expects, so it belongs with the question. Not a
      // stylesheet rule keyed on the field key: keys follow labels, and a
      // rename would silently drop the styling with nothing to catch it.
      rows: (() => {
        const part = typeParts.find((p) => /^rows=\d+$/.test(p));
        return part ? Number(part.slice(5)) : null;
      })(),
    };
    if (type === 'table') {
      field.columns = parseColumns(m[3].trim());
    } else if (type === 'select' || type === 'radios') {
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
    // Normalise line endings before anything else. A template saved on
    // Windows arrives with CRLF, and the Hint/Good/Bad matchers below run
    // against the raw line rather than the trimmed one, because they need to
    // see its indentation. In a JavaScript regex "." excludes line
    // terminators and \r is one, so "(.*)$" could not reach the end of a
    // CRLF line and the match failed outright: every field rendered and not
    // one hint did, with nothing reported.
    text = text.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
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

      // An indented "Hint:" line is the field's visible guidance — the same
      // follow-on shape as the Good/Bad example lines below, so every word a
      // reader sees lives in the template rather than in code.
      const hintMatch = raw.match(/^\s+Hint:\s*(.*)$/i);
      if (hintMatch && currentField) {
        currentField.hint = hintMatch[1].trim();
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
    text = text.replace(/\r\n?/g, '\n');
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
    text = text.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
    return text.split('\n')
      .map((line) => line.match(/^-\s*(.+?)\s*$/))
      .filter(Boolean)
      .map((m) => m[1]);
  }

  // ---------- textarea autosize ----------
  function resizeTa(ta) {
    resizeTextarea(ta);
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
    bindTextareas(root);
    ['resize', 'beforeprint', 'afterprint'].forEach((event) => {
      window.addEventListener(event, () => resizeTextareas(root), { signal: formEvents.signal });
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
    if (open) resizeTextareas(body);
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
    if (!capabilities.uploads) return Promise.reject(new Error('Uploads are unavailable.'));
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
  const unavailableCapabilities = Object.freeze({ calibration: false, uploads: false, addFramework: false, jira: false, googleDrive: false });
  let capabilities = unavailableCapabilities;

  function renderBuildMarker(cfg) {
    const version = cfg && typeof cfg.version === 'string' ? cfg.version : '';
    const build = cfg && typeof cfg.build === 'string' ? cfg.build : '';
    const label = version || build ? ('v' + version + (build ? ' · ' + build : '')).trim() : 'version unavailable';
    document.querySelectorAll('#app-version, .app-version-print').forEach((el) => { el.textContent = label; });
    const date = document.querySelector('.print-date');
    if (date) date.textContent = formatDateline(todayIso());
  }

  function getConfig() {
    if (!configPromise) configPromise = Promise.resolve().then(() => fetch('/api/config', { cache: 'no-store' }))
      .then(res => {
        if (!res.ok) throw new Error('Configuration unavailable');
        return res.json();
      }).then(cfg => {
        if (!cfg || typeof cfg.pilotMode !== 'boolean' || !cfg.capabilities ||
            !Object.keys(unavailableCapabilities).every(key => typeof cfg.capabilities[key] === 'boolean') ||
            (cfg.pilotMode && Object.values(cfg.capabilities).some(value => value !== false)) ||
            (cfg.capabilities.googleDrive && (!cfg.capabilities.uploads ||
              typeof cfg.googleClientId !== 'string' || !cfg.googleClientId ||
              typeof cfg.googleApiKey !== 'string' || !cfg.googleApiKey))) {
          throw new Error('Invalid capabilities');
        }
        capabilities = Object.freeze(Object.fromEntries(Object.keys(unavailableCapabilities).map(key => [key, cfg.capabilities[key]])));
        renderBuildMarker(cfg);
        const status = document.getElementById('capability-status');
        if (status) status.textContent = cfg.pilotMode
          ? 'Pilot: calibration Save/Like/Dislike, uploads, framework library changes, Jira and Google Drive are unavailable. AI evaluation and suggestions remain available.'
          : '';
        return { ...cfg, capabilities };
      }).catch(() => {
        capabilities = unavailableCapabilities;
        renderBuildMarker(null);
        const status = document.getElementById('capability-status');
        if (status) status.textContent = 'Feature availability could not be confirmed. Calibration feedback, uploads, library changes and integrations remain unavailable. You can still edit and back up your plan.';
        return { capabilities, configurationUnavailable: true };
      });
    return configPromise;
  }

  function restrictAction(button, capability) {
    button.hidden = !capabilities[capability];
    button.disabled = !capabilities[capability];
    getConfig().then(() => {
      button.hidden = !capabilities[capability];
      button.disabled = !capabilities[capability];
    });
  }

  function capabilityNote(capability, message) {
    const note = el('span', 'capability-note');
    note.textContent = message;
    note.hidden = capabilities[capability];
    getConfig().then(() => { note.hidden = capabilities[capability]; });
    return note;
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
      ['https://accounts.google.com/gsi/client', 'https://apis.google.com/js/api.js'].forEach(src => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        document.head.appendChild(script);
      });
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
      if (!capabilities.googleDrive || !capabilities.uploads) throw new Error('Google Drive is unavailable.');
      if (!cfg.googleClientId || !cfg.googleApiKey) {
        throw new Error('Google Drive is not configured for this app (missing GOOGLE_CLIENT_ID / GOOGLE_API_KEY).');
      }
      return loadPickerApi()
        .then(() => getDriveAccessToken(cfg.googleClientId))
        .then((token) => openDrivePicker(token, cfg.googleApiKey).then((file) => downloadDriveFile(file, token)));
    });
  }

  // ---------- dynamic table rows ----------
  function renderFileReference(cell) {
    const value = cell.querySelector('.file-value').value;
    const name = cell.dataset.fileName;
    const referenceOnly = !capabilities.uploads;
    cell.classList.toggle('file-reference-only', referenceOnly);
    // Display copy is never filename metadata. In particular, preserve an
    // explicitly empty legacy name rather than saving the fallback wording.
    cell.querySelector('.file-name').textContent = referenceOnly
      ? ((!value && (!name || name === 'No file chosen')) ? 'No saved file reference' : (name || value))
      : (name || 'No file chosen');
  }

  function buildFileCell(placeholder) {
    const wrap = el('div', 'file-cell');
    wrap.dataset.fileName = placeholder;
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
    restrictAction(addBtn, 'uploads');
    fileInp.disabled = !capabilities.uploads;
    getConfig().then(() => { fileInp.disabled = !capabilities.uploads; });
    const menu = el('div', 'file-menu');
    menu.hidden = true;
    const uploadItem = el('button', 'file-menu-item', { type: 'button' });
    uploadItem.textContent = 'Upload file';
    const driveItem = el('button', 'file-menu-item', { type: 'button' });
    driveItem.textContent = 'Add from Drive';
    restrictAction(uploadItem, 'uploads');
    restrictAction(driveItem, 'googleDrive');
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
      if (!capabilities.uploads) return;
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
      wrap.dataset.fileName = body.filename;
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
      renderFileReference(wrap);
    }
    function finishUpload() {
      addBtn.disabled = !capabilities.uploads;
      fileInp.value = '';
    }

    uploadItem.addEventListener('click', () => {
      if (!capabilities.uploads) return;
      closeMenu();
      fileInp.click();
    });

    fileInp.addEventListener('change', () => {
      if (!capabilities.uploads) { fileInp.value = ''; return; }
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
      if (!capabilities.googleDrive || !capabilities.uploads) return;
      closeMenu();
      addFromDrive().then(({ blob, name }) => {
        if (blob.size > MAX_UPLOAD_BYTES) throw new Error('File exceeds the 15MB limit.');
        setUploading();
        return uploadFile(blob, name).then(setUploaded).catch(setFailed).finally(finishUpload);
      }).catch((err) => {
        if (err && err.message !== 'cancelled') alert('Could not add file from Drive: ' + err.message);
      });
    });

    wrap.append(fileInp, addWrap, nameSpan, valueInp,
      capabilityNote('uploads', 'Reference only. Attachment contents are unavailable through this app.'));
    renderFileReference(wrap);
    getConfig().then(() => { renderFileReference(wrap); });
    return wrap;
  }

  // Keeps every row's remove button in sync with the current row count: once
  // only one row is left, its button reserves its space but goes invisible
  // and inert (same visibility trick as the list-field remove buttons) so a
  // table can never be emptied to zero rows.
  // Each cell control is named by its column and row — "Action, row 2" — so a
  // screen reader outside table-navigation mode never meets a nameless input.
  // Runs from updateRowRemoveButtons, i.e. on every add and remove, and again
  // when an editable column header is renamed.
  function nameRowCells(tr, columns, rowNumber) {
    Array.from(tr.querySelectorAll('td')).forEach((td, j) => {
      const col = columns[j];
      if (!col) return;
      const control = td.querySelector('.date-control, select, textarea, input.cinput:not(.select-other-input)');
      if (control) control.setAttribute('aria-label', col.label + ', row ' + rowNumber);
    });
  }

  function updateRowRemoveButtons(tbody) {
    const rows = tbody.querySelectorAll('tr');
    const onlyOneLeft = rows.length <= 1;
    const table = tbody.closest('table');
    const meta = table && tables.find((t) => t.id === table.id);
    rows.forEach((tr, i) => {
      if (meta) nameRowCells(tr, meta.columns, i + 1);
      const btn = tr.querySelector('.row-remove');
      if (!btn) return;
      btn.setAttribute('aria-label', 'Remove row ' + (i + 1));
      btn.disabled = onlyOneLeft;
      btn.classList.toggle('list-remove-spacer', onlyOneLeft);
    });
  }

  // Native date controls expose a locale-specific segmented editor whose
  // keyboard behaviour is owned by the browser. Keep a native date input as
  // the canonical ISO value and calendar picker, but render controllable
  // day/month/year segments for predictable manual editing.
  const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // The segmented editor shows "Sep" because it has three characters of room.
  // The dateline is a sentence, and a sentence says September.
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  function formatDateline(isoValue) {
    const parsed = parseDateEntry(isoValue);
    if (!parsed) return 'not set';
    return parsed.day + ' ' + MONTH_NAMES[parsed.month - 1] + ' ' + parsed.year;
  }
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

  function showDateError(nativeInput, message) {
    const segments = dateSegments(nativeInput);
    if (!segments) return;
    const error = segments.control.querySelector('.date-error');
    const text = message || 'Enter a valid date.';
    segments.day.setCustomValidity(text);
    segments.control.setAttribute('aria-invalid', 'true');
    // The element carries role="alert", so replacing the text is what
    // announces it. A range failure has to say which boundary was crossed and
    // by what — "invalid" tells someone nothing they can act on.
    if (error) { error.textContent = text; error.hidden = false; }
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
    // A second, quieter tier. The error above is for something the person can
    // put right; this is for something true and worth seeing that they may not
    // be able to change — so it carries no aria-invalid and no alert role, and
    // is announced only when the field is read.
    const note = el('span', 'date-note');
    note.hidden = true;

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
      if (!control.isConnected) return null;
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
        if (!control.isConnected) return;
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
    control.append(dayInput, separator1, monthInput, separator2, yearInput, nativeInput, error, note);
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
          'aria-label': col.label,
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
      } else if (col.type === 'prose') {
        const inp = el('textarea', 'cinput prose-input', {
          rows: '1',
          placeholder: col.placeholder || '',
        });
        bindTextarea(inp);
        td.classList.add('prose-cell');
        td.appendChild(inp);
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

  // A prefilled control holds a value the form supplied, not one a person
  // gave. The distinction has to survive a save, because otherwise reopening a
  // plan turns every default into an answer: the review step would count a
  // timeline nobody wrote, and RPA-64's required-field validation would accept
  // it. So it is marked in the DOM, carried in the cell snapshot, and dropped
  // the moment somebody types.
  // Three states, because two were not enough:
  //   "1"     the form put this here, and may replace it
  //   "0"     a person has been in this cell, so leave it alone
  //   absent  unknown — a plan saved before any of this existed
  // Two states forced a choice between never helping a plan already in
  // progress (marked-only) and overwriting a half-typed date (empty-too).
  function markPrefilled(control) {
    if (control) control.dataset.prefill = '1';
    return control;
  }

  function isPrefilled(control) {
    return Boolean(control && control.dataset && control.dataset.prefill === '1');
  }

  function wasTouched(control) {
    return Boolean(control && control.dataset && control.dataset.prefill === '0');
  }

  // Any real edit clears it, wherever the control lives. Bound once, at the
  // document, so a row added later needs no wiring of its own.
  //
  // Clearing the whole cell rather than the event's target, because a date is
  // three visible segment inputs in front of one real input[type=date]. Typing
  // into a segment would otherwise leave the date itself still marked, and the
  // readout mirror would overwrite what had just been typed.
  function bindPrefillClearing(root) {
    const clear = (event) => {
      const el = event.target;
      if (!el || !el.closest) return;
      const scope = el.closest('td') || el.closest('.date-control') || el;
      const marked = scope.dataset && scope.dataset.prefill ? [scope] : [];
      const controls = scope.querySelectorAll
        ? Array.from(scope.querySelectorAll('input, select, textarea'))
        : [];
      marked.concat(controls).forEach((c) => { c.dataset.prefill = '0'; });
    };
    root.addEventListener('input', clear, true);
    root.addEventListener('change', clear, true);
  }

  // Fills a prefill table with one row per option of its first select column,
  // then hands the field-specific anchors to applyTimelineAnchors. Safe to run
  // again: it only ever writes into rows it just created.
  function withoutDraftSave(fn) {
    const wasRestoring = draftRestoring;
    draftRestoring = true;
    try { fn(); } finally { draftRestoring = wasRestoring; }
  }

  function applyTableDefaults() {
    tables.forEach(({ id, columns, prefill }) => {
      if (!prefill) return;
      const table = document.getElementById(id);
      const tbody = table && table.querySelector('tbody');
      const optionCol = columns.findIndex((c) => c.type === 'select' && (c.options || []).length);
      if (!tbody || optionCol === -1) return;

      const options = columns[optionCol].options;
      const addBtn = table.closest('.field').querySelector('.add-btn');
      while (tbody.querySelectorAll('tr').length < options.length && addBtn) addBtn.click();

      Array.from(tbody.querySelectorAll('tr')).forEach((tr, i) => {
        if (i >= options.length) return;
        // Every control in a generated row is a default, including the empty
        // ones: an empty cell holds no content either way, and the mark is
        // what lets a date the plan learns later still land in it.
        tr.querySelectorAll('input, select, textarea').forEach(markPrefilled);
        const sel = tr.querySelectorAll('td')[optionCol].querySelector('.ssel');
        if (!sel) return;
        sel.value = options[i];
        updateSelectClass(sel);
      });
      updateRowRemoveButtons(tbody);
    });
    applyTimelineAnchors();
  }

  // The two dates the plan already knows. Planning starts when the plan was
  // started; reporting finishes when the readout is due.
  //
  // The readout is a header field the researcher fills long after this table
  // renders, so writing it once at render would mean it was always empty and
  // the feature never fired. It tracks the header instead — but only while the
  // cell is still a default, so an edited date is never overwritten.
  function applyTimelineAnchors() {
    const table = document.querySelector('.dtbl[data-field-key="stageTimeline"]');
    if (!table) return;
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    if (!rows.length) return;

    const dateIn = (tr, colKey) => {
      const meta = tables.find((t) => t.id === table.id);
      const idx = meta ? meta.cols.indexOf(colKey) : -1;
      const td = idx === -1 ? null : tr.querySelectorAll('td')[idx];
      return td ? td.querySelector('input[type="date"]') : null;
    };

    // A suggestion may fill a cell that is still marked as a default, and also
    // one that is simply empty — an empty cell holds no decision to protect.
    // Marked-only was too strict: a plan saved before this feature carries no
    // marks, so every plan already in progress would have shown a blank
    // timeline for ever, which is the case people are actually in.
    const open = (input) => input && !wasTouched(input) && (isPrefilled(input) || !input.value);

    const first = dateIn(rows[0], 'startDate');
    if (open(first)) setDateInputValue(first, planCreatedAt);

    const readout = doc.querySelector('[data-field="researchReadout"]');
    const last = dateIn(rows[rows.length - 1], 'completionDate');
    if (readout && readout.value && open(last)) setDateInputValue(last, readout.value);
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
  const { classifyEvaluation } = window.RPA_SCORE_CLASSIFICATION;

  function evaluationValueToText(value) {
    if (!Array.isArray(value)) return typeof value === 'string' ? value : '';
    return value.map((entry) => typeof entry === 'string' ? entry : entry.text).filter(Boolean).join('\n');
  }

  function evaluationContext() {
    const objective = doc.querySelector('[data-field="objective"]');
    return { objective: objective ? objective.value.trim() : '' };
  }

  function evaluationRequest(value, field) {
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

    return body;
  }

  function evaluateField(body, signal) {
    return fetch('/api/evaluate', {
      signal,
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
      if (metrics.length === 0 || metrics.some((m) => !Number.isFinite(m.score))) {
        throw new Error('The evaluator returned an unexpected result.');
      }
      if (!Array.isArray(data.recommendations) || data.recommendations.length > 2 ||
          data.recommendations.some((recommendation) =>
            typeof recommendation !== 'string' || !recommendation.trim()
          )) {
        throw new Error('The evaluator returned unexpected recommendations.');
      }
      const recs = data.recommendations.map((recommendation) => recommendation.trim());
      return { ...classifyEvaluation(body.fieldKey, metrics), metrics, recs };
    });
  }

  function renderEvalResult(panel, data) {
    // Tone is carried as a class so the stylesheet owns every colour; the
    // bg/border/color fields on SCORE_STYLES are no longer read here.
    panel.classList.remove('eval-tone-problem', 'eval-tone-warning', 'eval-tone-success');
    panel.classList.add('eval-tone-' + data.tone);

    const badge = panel.querySelector('.eval-badge');
    badge.textContent = data.label;

    let explanation = panel.querySelector('.eval-explanation');
    if (!explanation) {
      explanation = el('p', 'eval-explanation');
      badge.closest('.eval-head').after(explanation);
    }
    explanation.textContent = data.explanation;
    explanation.hidden = !data.explanation;

    const metricsEl = panel.querySelector('.eval-metrics');
    metricsEl.innerHTML = '';
    data.metrics.forEach((m) => {
      const wrap = document.createElement('div');
      wrap.className = 'eval-metric';
      const name = document.createElement('h4');
      name.className = 'eval-mname';
      name.textContent = m.name;
      // The score has to survive without colour: empty dots are outlined
      // rather than pale-filled (a shape difference, and a 3:1 edge), the
      // number is shown as text, and the group announces itself to screen
      // readers — the dots alone were silent.
      const dots = document.createElement('div');
      dots.className = 'eval-dots';
      dots.setAttribute('role', 'img');
      dots.setAttribute('aria-label', 'Scored ' + m.score + ' out of 3');
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        const filled = i < m.score;
        dot.className = 'eval-dot ' + (filled ? 'eval-dot-on' : 'eval-dot-off');
        dots.appendChild(dot);
      }
      const score = document.createElement('span');
      score.className = 'eval-score';
      score.setAttribute('aria-hidden', 'true');   // the group label already says it
      score.textContent = m.score + ' of 3';
      dots.appendChild(score);
      const desc = document.createElement('div');
      desc.className = 'eval-mdesc';
      desc.textContent = m.desc;
      wrap.append(name, dots, desc);
      metricsEl.appendChild(wrap);
    });

    const recsEl = panel.querySelector('.eval-recs');
    recsEl.innerHTML = '';
    const hasRecommendations = data.recs.length > 0;
    panel.querySelector('.eval-rlabel').hidden = !hasRecommendations;
    recsEl.hidden = !hasRecommendations;
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
    if (!capabilities.calibration) return Promise.reject(new Error('Calibration feedback is unavailable.'));
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

  // Share the limit across both sections and individual updates/retries.
  const evaluationSections = {
    context: ['background', 'goal', 'problemStatement'],
    research: ['objective', 'hypothesis', 'researchQuestions', 'outcomes'],
  };
  const evaluationFields = new Map();
  // Set by renderReviewStep; called whenever evaluation state settles, because
  // finishing an evaluation fires no input event and the summary would
  // otherwise keep saying nothing until the next keystroke.
  let refreshReviewSummary = () => {};
  const evaluationBatches = new Map();
  let evaluationEpoch = 0;
  let activeEvaluations = 0;
  const evaluationQueue = [];
  const evaluationControllers = new Set();

  function drainEvaluations() {
    while (activeEvaluations < 2 && evaluationQueue.length) {
      const job = evaluationQueue.shift();
      if (job.epoch !== evaluationEpoch) { job.resolve('cancelled'); continue; }
      activeEvaluations++;
      Promise.resolve().then(job.run).then(job.resolve, job.reject).finally(() => {
        activeEvaluations--;
        drainEvaluations();
      });
    }
  }

  function queueEvaluation(run) {
    return new Promise((resolve, reject) => {
      evaluationQueue.push({ run, resolve, reject, epoch: evaluationEpoch });
      drainEvaluations();
    });
  }

  function resetEvaluationWork() {
    evaluationEpoch++;
    evaluationQueue.splice(0).forEach(job => job.resolve('cancelled'));
    evaluationControllers.forEach(controller => controller.abort());
    evaluationBatches.forEach(batch => batch.reset());
  }

  function renderSectionEvaluation(key) {
    const wrap = el('div', 'section-evaluation');
    const button = el('button', 'eval-btn section-eval-btn', { type: 'button', 'data-evaluate-section': key });
    button.textContent = 'Evaluate ' + key;
    const status = el('div', 'section-eval-status', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', id: 'evaluation-progress-' + key });
    button.setAttribute('aria-describedby', status.id);
    wrap.append(button, status);
    let running = false;
    let refreshSummary = () => {};
    evaluationBatches.set(key, { refresh() {
      refreshSummary();
    }, reset() {
      running = false;
      refreshSummary = () => {};
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');
      status.textContent = '';
    } });
    button.addEventListener('click', async () => {
      if (running) return;
      const fields = evaluationSections[key].map(name => evaluationFields.get(name)).filter(field => field && field.populated());
      if (!fields.length) {
        status.textContent = 'Add content to at least one field in ' + key + ' before evaluating.';
        return;
      }
      running = true;
      const epoch = evaluationEpoch;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      let completed = 0;
      const progress = () => {
        const failed = fields.filter(field => field.state() === 'failed').length;
        const skipped = fields.filter(field => field.state() === 'skipped').length;
        const pending = fields.filter(field => field.state() === 'pending').length;
        status.textContent = completed + ' of ' + fields.length + ' fields finished.' +
          (pending ? ' ' + pending + ' request' + (pending === 1 ? '' : 's') + ' pending.' : '') +
          (failed ? ' ' + failed + ' request' + (failed === 1 ? '' : 's') + ' failed; retry at the affected field.' : '') +
          (skipped ? ' ' + skipped + ' empty field' + (skipped === 1 ? '' : 's') + ' skipped.' : '');
      };
      refreshSummary = progress;
      progress();
      await Promise.all(fields.map(async field => {
        await field.run();
        if (epoch !== evaluationEpoch) return;
        completed++;
        progress();
      }));
      if (epoch !== evaluationEpoch) return;
      running = false;
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');
    });
    return wrap;
  }

  let evaluationControlCount = 0;

  function renderEvaluationIcon(kind) {
    const paths = {
      like: 'M7 10v11H3V10h4Zm0 0 5-7h2v6h5a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7',
      dislike: 'M7 14V3H3v11h4Zm0 0 5 7h2v-6h5a2 2 0 0 0 2-2l-2-8a2 2 0 0 0-2-2H7',
      save: 'M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8',
    };
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'eval-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    const path = document.createElementNS(icon.namespaceURI, 'path');
    path.setAttribute('d', paths[kind]);
    icon.appendChild(path);
    return icon;
  }

  function renderEvalControls(field, getValue) {
    const controls = el('div', 'eval-controls');
    const btn = el('button', 'eval-btn', { type: 'button' });
    const spinner = el('span', 'eval-spinner');
    const txt = el('span');
    const sectionField = Object.values(evaluationSections).some(keys => keys.includes(field.key));
    txt.textContent = sectionField ? 'Retry ' + field.label : 'Evaluate ' + field.label;
    btn.hidden = sectionField;
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

    const resultSummary = el('div', 'eval-result-summary');
    resultSummary.hidden = true;
    const staleStatus = el('span', 'eval-stale-status', { role: 'status' });
    staleStatus.textContent = 'Results out of date';
    staleStatus.hidden = true;
    const quickReevaluateBtn = el('button', 'eval-reevaluate-btn eval-quick-reevaluate-btn', { type: 'button' });
    quickReevaluateBtn.textContent = 'Evaluate again';
    resultSummary.append(resultBtn, staleStatus, quickReevaluateBtn);

    const error = el('div', 'eval-error', { role: 'alert' });
    error.hidden = true;

    const panel = el('div', 'eval-panel', { id: detailsId, role: 'region', 'aria-labelledby': detailsId + '-heading' });
    panel.hidden = true;
    const head = el('div', 'eval-head');
    const badge = el('span', 'eval-badge');
    const hl = el('h3', 'eval-hl', { id: detailsId + '-heading' });
    hl.textContent = field.label + ' Evaluation';
    const dismiss = el('button', 'eval-x', { type: 'button' });
    dismiss.textContent = '✕';
    dismiss.title = 'Collapse evaluation details';
    dismiss.setAttribute('aria-label', 'Collapse ' + field.label + ' evaluation details');
    head.append(hl, badge, dismiss);
    const metrics = el('div', 'eval-metrics');
    const rlabel = el('h4', 'eval-rlabel');
    rlabel.textContent = 'Recommendations';
    const recs = el('ul', 'eval-recs');
    function feedbackButton(kind, label) {
      const button = el('button', 'btn eval-fb-btn eval-' + kind + '-btn', { type: 'button' });
      const text = el('span', 'eval-action-label');
      text.textContent = label;
      button.append(renderEvaluationIcon(kind), text);
      button.title = label;
      button.disabled = true;
      if (kind !== 'save') {
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', 'false');
      }
      return button;
    }
    const saveBtn = feedbackButton('save', 'Save');
    const likeBtn = feedbackButton('like', 'Like');
    const dislikeBtn = feedbackButton('dislike', 'Dislike');
    const reevaluateBtn = el('button', 'eval-reevaluate-btn', { type: 'button' });
    reevaluateBtn.textContent = 'Evaluate again';
    const actions = el('div', 'eval-actions');
    actions.append(reevaluateBtn, likeBtn, dislikeBtn, saveBtn);
    const feedbackStatus = el('div', 'eval-feedback-status', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    panel.append(head, metrics, rlabel, recs, actions, feedbackStatus,
      capabilityNote('calibration', 'Calibration Save/Like/Dislike unavailable. Evaluation results are not saved in backups.'));
    [saveBtn, likeBtn, dislikeBtn].forEach(button => {
      button.hidden = !capabilities.calibration;
      getConfig().then(() => {
        button.hidden = !capabilities.calibration;
        button.disabled = !capabilities.calibration || !lastResult || resultIsStale || !!pending;
      });
    });
    const progress = el('div', 'field-eval-progress', { role: 'status', 'aria-live': 'polite' });
    controls.append(resultSummary, progress, error, btn, panel);
    let pending = null;
    let requestState = 'idle';
    let revision = 0;
    const fingerprint = () => JSON.stringify(evaluationRequest(getValue(), field));

    let lastResult = null;
    let resultIsStale = false;

    function updateResultPresentation() {
      if (!lastResult) return;
      const action = panel.hidden ? 'Show' : 'Hide';
      const staleText = resultIsStale ? ' Results out of date.' : '';
      resultBtn.classList.toggle('eval-result-stale', resultIsStale);
      resultStatus.textContent = field.label + ' evaluation: ' + lastResult.data.label + '.' + staleText;
      resultBtn.title = lastResult.data.label + (resultIsStale ? ' — results out of date' : '') +
        ' — ' + action.toLowerCase() + ' evaluation details';
      resultBtn.setAttribute(
        'aria-label',
        field.label + ' evaluation: ' + lastResult.data.label + '.' + staleText + ' ' + action + ' details.'
      );
      staleStatus.hidden = !resultIsStale;
      quickReevaluateBtn.textContent = resultIsStale ? 'Update evaluation' : 'Evaluate again';
      reevaluateBtn.textContent = quickReevaluateBtn.textContent;
    }

    function setExpanded(expanded) {
      panel.hidden = !expanded;
      resultBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      quickReevaluateBtn.hidden = expanded;
      updateResultPresentation();
    }

    function resetFeedbackActions() {
      feedbackStatus.textContent = '';
      [saveBtn, likeBtn, dislikeBtn].forEach(button => button.setAttribute('aria-busy', 'false'));
      saveBtn.querySelector('.eval-action-label').textContent = 'Save';
      likeBtn.querySelector('.eval-action-label').textContent = 'Like';
      dislikeBtn.querySelector('.eval-action-label').textContent = 'Dislike';
      likeBtn.setAttribute('aria-pressed', 'false');
      dislikeBtn.setAttribute('aria-pressed', 'false');
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

    function disableFeedbackActions() {
      saveBtn.disabled = true;
      likeBtn.disabled = true;
      dislikeBtn.disabled = true;
    }

    function markResultStale() {
      revision++;
      if (!lastResult) return;
      resultIsStale = true;
      updateResultPresentation();
      disableFeedbackActions();
    }

    function showResult(data) {
      resultBtn.className = 'eval-result-btn eval-result-' + data.tone;
      resultSummary.hidden = false;
      resultBtn.hidden = false;
      btn.hidden = true;
      setExpanded(false);
    }

    function runEvaluation() {
      if (pending) return pending;
      const sectionKey = Object.keys(evaluationSections).find(key => evaluationSections[key].includes(field.key));
      const refreshSection = () => {
        if (sectionKey) evaluationBatches.get(sectionKey).refresh();
        // The review summary reports evaluation currency, and finishing an
        // evaluation fires no input event, so it has to be told here or the
        // row keeps its old wording until the next keystroke.
        refreshReviewSummary();
      };
      if (!evaluationValueToText(getValue()).trim()) {
        requestState = 'skipped';
        refreshSection();
        error.textContent = 'Add content to ' + field.label + ' before evaluating.';
        error.hidden = false;
        return Promise.resolve('skipped');
      }
      const epoch = evaluationEpoch;
      requestState = 'pending';
      refreshSection();
      const feedbackDisabledBeforeRun = lastResult
        ? [saveBtn.disabled, likeBtn.disabled, dislikeBtn.disabled] : null;
      disableFeedbackActions();
      error.hidden = true;
      error.textContent = '';
      progress.textContent = field.label + ': queued.';
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      reevaluateBtn.disabled = true;
      reevaluateBtn.setAttribute('aria-busy', 'true');
      quickReevaluateBtn.disabled = true;
      quickReevaluateBtn.setAttribute('aria-busy', 'true');
      pending = queueEvaluation(async () => {
        if (epoch !== evaluationEpoch) return 'cancelled';
        const value = getValue();
        const text = evaluationValueToText(value);
        if (!text.trim()) {
          requestState = 'skipped';
          progress.textContent = field.label + ': empty; skipped.';
          return 'skipped';
        }
        const body = evaluationRequest(value, field);
        const signature = JSON.stringify(body);
        const requestRevision = revision;
        const controller = new AbortController();
        evaluationControllers.add(controller);
        progress.textContent = field.label + ': evaluating…';
        try {
          const data = await evaluateField(body, controller.signal);
          if (epoch !== evaluationEpoch) return 'cancelled';
          renderEvalResult(panel, data);
          lastResult = { text, data, signature };
          resultIsStale = revision !== requestRevision || fingerprint() !== signature;
          showResult(data);
          resetFeedbackActions();
          if (!resultIsStale) {
            saveBtn.disabled = !capabilities.calibration;
            likeBtn.disabled = !capabilities.calibration;
            dislikeBtn.disabled = !capabilities.calibration;
          }
          updateResultPresentation();
          requestState = 'success';
          progress.textContent = field.label + ': evaluation complete.' + (resultIsStale ? ' Results out of date.' : '');
          return 'success';
        } catch (err) {
          if (epoch !== evaluationEpoch) return 'cancelled';
          requestState = 'failed';
          const reason = err.message.trim().replace(/[.!?]+$/, '');
          error.textContent = 'Evaluation request failed: ' + reason + '. Retry ' + field.label + ' below.';
          error.hidden = false;
          btn.hidden = false;
          txt.textContent = 'Retry ' + field.label;
          progress.textContent = '';
          if (lastResult && !resultIsStale && feedbackDisabledBeforeRun) {
            [saveBtn.disabled, likeBtn.disabled, dislikeBtn.disabled] = feedbackDisabledBeforeRun;
          }
          return 'failed';
        } finally {
          evaluationControllers.delete(controller);
        }
      }).finally(() => {
        if (epoch !== evaluationEpoch) return;
        pending = null;
        btn.disabled = false;
        btn.setAttribute('aria-busy', 'false');
        reevaluateBtn.disabled = false;
        reevaluateBtn.setAttribute('aria-busy', 'false');
        quickReevaluateBtn.disabled = false;
        quickReevaluateBtn.setAttribute('aria-busy', 'false');
        refreshSection();
      });
      return pending;
    }

    evaluationFields.set(field.key, {
      run: runEvaluation,
      populated: () => !!evaluationValueToText(getValue()).trim(),
      state: () => requestState,
      // For the review step: has this been evaluated at all, and does that
      // result still describe what the field says now? ADR 001 settled that
      // stale evaluations still count as complete and that currency is
      // tracked separately — this is where the two part company.
      evaluated: () => !!lastResult,
      stale: () => resultIsStale,
    });
    // Structured feedback includes Objective and, for Outcomes, paired Questions.
    if (field.key === 'researchQuestions' || field.key === 'outcomes') {
      const checkContext = (event) => {
        const objectiveEdit = event.target.matches('[data-field="objective"]');
        const questionEdit = field.key === 'outcomes' &&
          event.target.closest('.field')?.querySelector('[data-list-key="researchQuestions"]');
        if (!objectiveEdit && !questionEdit) return;
        if (event.type === 'click' && !event.target.closest('.add-btn, .list-remove')) return;
        if (lastResult && fingerprint() !== lastResult.signature) markResultStale();
      };
      doc.addEventListener('input', checkContext);
      doc.addEventListener('change', checkContext);
      doc.addEventListener('click', checkContext);
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
    quickReevaluateBtn.addEventListener('click', runEvaluation);

    saveBtn.addEventListener('click', () => {
      if (!capabilities.calibration || !lastResult || resultIsStale) return;
      saveBtn.disabled = true;
      likeBtn.disabled = true;
      dislikeBtn.disabled = true;
      saveBtn.title = 'Saving…';
      saveBtn.setAttribute('aria-busy', 'true');
      saveBtn.querySelector('.eval-action-label').textContent = 'Saving…';
      feedbackStatus.textContent = 'Saving evaluation…';
      saveForCalibration(field, lastResult.text, lastResult.data).then(() => {
        saveBtn.title = 'Saved';
        saveBtn.setAttribute('aria-busy', 'false');
        saveBtn.querySelector('.eval-action-label').textContent = 'Saved';
        feedbackStatus.textContent = 'Evaluation saved.';
        saveBtn.classList.add('active');
      }).catch((err) => {
        alert('Save failed: ' + err.message);
        if (!resultIsStale) {
          saveBtn.disabled = !capabilities.calibration;
          likeBtn.disabled = !capabilities.calibration;
          dislikeBtn.disabled = !capabilities.calibration;
        }
        saveBtn.title = 'Save';
        saveBtn.setAttribute('aria-busy', 'false');
        saveBtn.querySelector('.eval-action-label').textContent = 'Save';
        feedbackStatus.textContent = 'Evaluation could not be saved.';
      });
    });

    likeBtn.addEventListener('click', () => {
      if (!capabilities.calibration || !lastResult || resultIsStale) return;
      saveBtn.disabled = true;
      likeBtn.disabled = true;
      dislikeBtn.disabled = true;
      likeBtn.title = 'Saving…';
      likeBtn.setAttribute('aria-busy', 'true');
      feedbackStatus.textContent = 'Saving Like feedback…';
      saveForCalibration(field, lastResult.text, lastResult.data, 'like').then(() => {
        likeBtn.title = 'Liked';
        likeBtn.setAttribute('aria-busy', 'false');
        likeBtn.setAttribute('aria-pressed', 'true');
        likeBtn.querySelector('.eval-action-label').textContent = 'Liked';
        feedbackStatus.textContent = 'Like feedback saved.';
        likeBtn.classList.add('active');
      }).catch((err) => {
        alert('Save failed: ' + err.message);
        if (!resultIsStale) {
          saveBtn.disabled = !capabilities.calibration;
          likeBtn.disabled = !capabilities.calibration;
          dislikeBtn.disabled = !capabilities.calibration;
        }
        likeBtn.title = 'Like';
        likeBtn.setAttribute('aria-busy', 'false');
        feedbackStatus.textContent = 'Like feedback could not be saved.';
      });
    });

    dislikeBtn.addEventListener('click', () => {
      if (!capabilities.calibration || !lastResult || resultIsStale) return;
      saveBtn.disabled = true;
      likeBtn.disabled = true;
      dislikeBtn.disabled = true;
      dislikeBtn.title = 'Saving…';
      dislikeBtn.setAttribute('aria-busy', 'true');
      feedbackStatus.textContent = 'Saving Dislike feedback…';
      saveForCalibration(field, lastResult.text, lastResult.data, 'dislike').then(() => {
        dislikeBtn.title = 'Disliked';
        dislikeBtn.setAttribute('aria-busy', 'false');
        dislikeBtn.setAttribute('aria-pressed', 'true');
        dislikeBtn.querySelector('.eval-action-label').textContent = 'Disliked';
        feedbackStatus.textContent = 'Dislike feedback saved.';
        dislikeBtn.classList.add('active');
      }).catch((err) => {
        alert('Save failed: ' + err.message);
        if (!resultIsStale) {
          saveBtn.disabled = !capabilities.calibration;
          likeBtn.disabled = !capabilities.calibration;
          dislikeBtn.disabled = !capabilities.calibration;
        }
        dislikeBtn.title = 'Dislike';
        dislikeBtn.setAttribute('aria-busy', 'false');
        feedbackStatus.textContent = 'Dislike feedback could not be saved.';
      });
    });

    controls._resetEvaluation = () => {
      pending = null;
      requestState = 'idle';
      revision++;
      progress.textContent = '';
      lastResult = null;
      resultIsStale = false;
      btn.hidden = sectionField;
      btn.disabled = false;
      btn.setAttribute('aria-busy', 'false');
      btn.classList.remove('loading');
      txt.textContent = sectionField ? 'Retry ' + field.label : 'Evaluate ' + field.label;
      resultSummary.hidden = true;
      resultBtn.hidden = true;
      resultBtn.className = 'eval-result-btn';
      resultBtn.removeAttribute('aria-label');
      resultBtn.removeAttribute('title');
      resultBtn.setAttribute('aria-expanded', 'false');
      resultStatus.textContent = '';
      staleStatus.hidden = true;
      error.hidden = true;
      error.textContent = '';
      panel.hidden = true;
      reevaluateBtn.disabled = false;
      reevaluateBtn.setAttribute('aria-busy', 'false');
      quickReevaluateBtn.hidden = false;
      quickReevaluateBtn.disabled = false;
      quickReevaluateBtn.setAttribute('aria-busy', 'false');
      quickReevaluateBtn.textContent = 'Evaluate again';
      resetFeedbackActions();
    };
    controls._markEvaluationStale = markResultStale;

    return [controls];
  }

  function bindEvaluationStaleness(fieldWrap, controls) {
    const markStale = () => {
      if (typeof controls._markEvaluationStale === 'function') controls._markEvaluationStale();
    };
    fieldWrap.addEventListener('input', markStale);
    fieldWrap.addEventListener('change', markStale);
    fieldWrap.addEventListener('click', (event) => {
      const contentAction = event.target.closest('.add-btn, .list-remove, .ms-method, .ms-add-all');
      if (contentAction && !contentAction.closest('.eval-controls')) markStale();
    });
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
    if (!capabilities.addFramework) return Promise.reject(new Error('Framework library changes are unavailable.'));
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
  // Pulls one "* **Label:** value" line out of a library entry. The entry is
  // sent whole on the match path and only its first reference was ever read,
  // so Core Focus and UXR Application were already arriving and being thrown
  // away (RPA-62). Nothing about the model or the API changes to show them.
  function extractEntryField(entryText, label) {
    const m = String(entryText || '').match(new RegExp('\\*\\*' + label + ':\\*\\*\\s*(.+)'));
    return m ? m[1].trim() : null;
  }

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

  function renderFrameworkSuggest(fieldInput) {
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
      panel.classList.remove('fw-draft');
      panel.classList.add('fw-match');
      body.innerHTML = '';

      const summary = el('p', 'fw-rationale');
      const nameEl = document.createElement('strong');
      nameEl.textContent = data.name;
      summary.append('We recommend the ', nameEl, '. ', data.rationale);
      body.appendChild(summary);

      // What the library already knows about this framework, which the match
      // path never showed. Until now a researcher who got a good answer saw
      // less than one who got the fallback: the draft path renders a whole
      // proposed entry, and this one rendered a sentence.
      const detail = el('dl', 'fw-detail');
      [['Core focus', 'Core Focus'], ['Where it helps', 'UXR Application']].forEach(([label, key]) => {
        const value = extractEntryField(data.entry, key);
        if (!value) return;
        const dt = el('dt');
        dt.textContent = label;
        const dd = el('dd');
        dd.textContent = value;
        detail.append(dt, dd);
      });
      if (detail.children.length) body.appendChild(detail);

      // The half that was genuinely new (RPA-62). Core Focus says what the
      // theory is and UXR Application says what it suits; neither says what
      // to do. Three fixed slots — look for, ask, attend to in analysis — so
      // it reads as instructions rather than a fourth paragraph of description.
      // The server only forwards a complete set of three, so an incomplete
      // answer renders nothing rather than a hollow list.
      const guidance = Array.isArray(data.guidance) ? data.guidance.filter(Boolean) : [];
      if (guidance.length === 3) {
        const heading = el('p', 'fw-guidance-head');
        heading.textContent = 'To apply it in this study';
        const list = el('ol', 'fw-guidance');
        const slots = ['Look for', 'Ask', 'In analysis'];
        guidance.forEach((text, i) => {
          const item = el('li');
          const slot = el('b');
          slot.textContent = slots[i];
          // The prompt asks the model not to begin an item with its slot word
          // and the first live run began one with "Ask" anyway. An instruction
          // to a model is a request; this is the guarantee. Strip a leading
          // slot word (and any colon or dash after it) so the panel never
          // reads "Ask Ask each role…", and re-capitalise what is left.
          const stripped = text.replace(new RegExp('^' + slots[i] + '\\s*[:\u2014-]?\\s*', 'i'), '');
          const body = stripped ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : text;
          item.append(slot, ' ', body);
          list.appendChild(item);
        });
        body.append(heading, list);
      }

      const rawRef = extractFirstReference(data.entry);
      const reference = rawRef ? formatFrameworkReference(rawRef) : '';
      if (reference) {
        const refBlock = el('p', 'fw-ref');
        refBlock.textContent = 'For a starting point, see: ' + reference;
        body.appendChild(refBlock);
      }

      // The whole reason this feature exists is that people cannot recall a
      // framework on demand. Ending at "here is one, now type it out" wastes
      // that, so the suggestion can be taken straight into the field.
      if (!fieldInput) return;
      const actions = el('div', 'eval-actions');
      const useBtn = el('button', 'eval-btn fw-add-btn', { type: 'button' });
      useBtn.textContent = 'Use this framework';
      actions.appendChild(useBtn);
      body.appendChild(actions);

      useBtn.addEventListener('click', () => {
        const suggestion = reference ? data.name + '\n' + reference : data.name;
        const existing = fieldInput.value.trim();
        // Never replace what somebody already wrote — they may have typed a
        // note before asking for a suggestion.
        fieldInput.value = existing ? existing + '\n\n' + suggestion : suggestion;
        dispatchFieldUpdate(fieldInput);
        useBtn.disabled = true;
        useBtn.textContent = 'Added ✓';
        fieldInput.focus();
      });
    }

    function renderDraft(data) {
      const d = data.draft;
      badge.textContent = 'NEW DRAFT';
      panel.classList.remove('fw-match');
      panel.classList.add('fw-draft');
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
      restrictAction(addBtn, 'addFramework');
      actions.appendChild(addBtn);
      actions.appendChild(capabilityNote('addFramework', 'Library changes unavailable. You can still use this suggestion in your plan.'));
      body.appendChild(actions);

      addBtn.addEventListener('click', () => {
        if (!capabilities.addFramework) return;
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
      row.querySelector('.list-input').setAttribute('aria-label', 'Method ' + (i + 1));
      const removeBtn = row.querySelector('.list-remove');
      if (!removeBtn) return;
      removeBtn.setAttribute('aria-label', 'Remove method ' + (i + 1));
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
    // Incidental sync only trims empty trailing groups. Deliberate Question
    // deletion confirms linked content and removes the exact indexed group.
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

  // Question removal confirms any populated linked content before it mutates
  // the DOM. Removing the exact group here keeps later groups attached to the
  // same positional Questions instead of silently re-labelling them.
  function removeMethodsGroupAt(index) {
    const group = methodsGroupAt(index);
    if (!group) return;
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
    const hl = el('span', 'eval-hl');
    hl.textContent = 'Methods Suggestion';
    const dismiss = el('button', 'eval-x', { type: 'button' });
    dismiss.textContent = '✕';
    head.append(badge, hl, dismiss);
    const body = el('div', 'fw-body');
    panel.append(head, body);
    panel.classList.add('ms-panel');

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
    
    return [btnRow, panel];
  }

  // ---------- stage timeline visualization ----------
  function getCellValue(td) {
    const select = td.querySelector('select');
    if (select) {
      if (select.hidden || select.value === '__other__') {
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

  // Calendar-day coordinates avoid treating a local DST day as 24 hours.
  const timelineDay = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  function timelineDate(day) {
    const utc = new Date(day * 86400000);
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
  }

  // Longer plans use one continuous bar per stage, with weekly or monthly
  // boundaries behind it. Grid intervals never round a stage's duration up.
  function renderLongTimeline(valid, minStart, maxEnd, scale, colorFor, container) {
    const first = timelineDate(minStart);
    const periods = [];
    if (scale === 'weeks') {
      for (let day = minStart; day <= maxEnd; day += 7) {
        periods.push({ start: day, end: day + 7, label: String(periods.length + 1) });
      }
    } else {
      // Whole containing months provide room for labels even when the plan
      // includes only one day of its first/last month. Padding is empty time.
      let month = new Date(first.getFullYear(), first.getMonth(), 1);
      while (timelineDay(month) <= maxEnd) {
        const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
        periods.push({ start: timelineDay(month), end: timelineDay(next),
          label: MONTH_ABBREVIATIONS[month.getMonth()], year: month.getFullYear() });
        month = next;
      }
    }
    const bandSize = scale === 'months' ? 6 : periods.length;
    let maxBandDays = 0;
    for (let offset = 0; offset < periods.length; offset += bandSize) {
      maxBandDays = Math.max(maxBandDays,
        periods[Math.min(offset + bandSize, periods.length) - 1].end - periods[offset].start);
    }
    const caption = el('div', 'timeline-scale-caption');
    caption.textContent = (scale === 'months' ? 'Monthly' : 'Weekly') + ' timeline · '
      + formatTimelineDate(first) + ' – ' + formatTimelineDate(timelineDate(maxEnd));
    container.appendChild(caption);
    if (periods.length > bandSize) {
      const note = el('p', 'timeline-band-note');
      note.textContent = 'Continued in six-month bands. Dates beside each bar show the full stage.';
      container.appendChild(note);
    }
    for (let offset = 0; offset < periods.length; offset += bandSize) {
      const bandPeriods = periods.slice(offset, offset + bandSize);
      const bandStart = bandPeriods[0].start;
      const bandEnd = bandPeriods[bandPeriods.length - 1].end;
      const bandDays = bandEnd - bandStart;
      const band = el('div', 'timeline-band');
      // Use the same pixels per calendar day in every band. In particular,
      // do not stretch a final two-month band to look six months long.
      band.style.setProperty('--timeline-band-width', (bandDays / maxBandDays * 100) + '%');
      const header = el('div', 'timeline-periods');
      const heading = el('div', 'timeline-label');
      heading.textContent = scale === 'weeks' ? 'Week' : 'Month';
      const ruler = el('div', 'timeline-period-grid');
      ruler.classList.add('timeline-period-grid-' + scale);
      if (scale === 'weeks' && periods.length > 14) ruler.classList.add('timeline-period-grid-dense');
      const gridColumns = bandPeriods.map(p => (p.end - p.start) + 'fr').join(' ');
      ruler.style.gridTemplateColumns = gridColumns;
      bandPeriods.forEach(p => {
        const mark = el('div', 'timeline-period-mark');
        mark.title = (scale === 'weeks' ? 'Week ' : '') + p.label + ': '
          + formatTimelineDate(timelineDate(p.start)) + ' – ' + formatTimelineDate(timelineDate(p.end - 1));
        const name = el('span', 'timeline-period-name');
        name.textContent = p.label;
        mark.appendChild(name);
        if (scale === 'months') {
          const year = el('span', 'timeline-period-year');
          year.textContent = p.year;
          mark.appendChild(year);
        }
        ruler.appendChild(mark);
      });
      header.append(heading, ruler, el('div', 'timeline-dates'));
      band.appendChild(header);
      valid.forEach(r => {
        const start = Math.max(r.startDay, bandStart);
        const end = Math.min(r.endDay + 1, bandEnd);
        if (start >= end) return;
        const name = r.stage || '(untitled stage)';
        const startLabel = formatTimelineDate(r.start);
        const endLabel = formatTimelineDate(r.end);
        const duration = r.endDay - r.startDay + 1;
        const description = name + ': ' + startLabel + ' to ' + endLabel
          + ' (' + duration + (duration === 1 ? ' calendar day)' : ' calendar days)');
        const row = el('div', 'timeline-row');
        const label = el('div', 'timeline-label');
        label.textContent = name;
        label.title = name;
        const track = el('div', 'timeline-continuous-track');
        track.style.gridTemplateColumns = gridColumns;
        // Decorative background: one element per period, never per day.
        bandPeriods.forEach(() => track.appendChild(el('div', 'timeline-period-cell', { 'aria-hidden': 'true' })));
        const bar = el('div', 'timeline-stage-bar', { role: 'img', 'aria-label': description });
        bar.style.left = ((start - bandStart) / bandDays * 100) + '%';
        bar.style.width = ((end - start) / bandDays * 100) + '%';
        bar.style.background = colorFor(name);
        bar.title = description;
        track.appendChild(bar);
        const dates = el('div', 'timeline-dates');
        [startLabel, endLabel].forEach(value => {
          const date = el('span', 'timeline-date-value');
          date.textContent = value;
          dates.appendChild(date);
        });
        row.append(label, track, dates);
        band.appendChild(row);
      });
      container.appendChild(band);
    }
  }

  // Preserve the day-cell presentation through eight inclusive weeks.
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
    delete container.dataset.scale;
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

    valid.forEach(r => { r.startDay = timelineDay(r.start); r.endDay = timelineDay(r.end); });
    const minStart = Math.min(...valid.map(r => r.startDay));
    const maxEnd = Math.max(...valid.map(r => r.endDay));
    const totalDays = maxEnd - minStart + 1;
    const first = timelineDate(minStart);
    const sixMonthsLater = new Date(first.getFullYear(), first.getMonth() + 6, 1);
    // Clamp only this display threshold's anniversary (e.g. Aug 31 -> Feb 28),
    // never the authored dates. The anniversary itself begins month seven.
    const lastDay = new Date(first.getFullYear(), first.getMonth() + 7, 0).getDate();
    sixMonthsLater.setDate(Math.min(first.getDate(), lastDay));
    const scale = totalDays <= 56 ? 'days' : maxEnd < timelineDay(sixMonthsLater) ? 'weeks' : 'months';
    container.dataset.scale = scale;
    if (scale !== 'days') {
      renderLongTimeline(valid, minStart, maxEnd, scale, colorFor, container);
      return;
    }
    const unitDays = 1;

    // Week 1 begins on the plan's own earliest start date. In daily mode,
    // extend the grid to a whole number of plan-relative weeks so the final
    // week is displayed completely without using calendar-week boundaries.
    const week1 = minStart;
    const gridEnd = unitDays === 1
      ? minStart + (Math.ceil(totalDays / 7) * 7 - 1)
      : maxEnd;

    // One shared grid, with the same column count and sizing, is reused by
    // the week ruler and every stage row. Cells begin on the plan's earliest
    // start date and continue through its final plan-relative week, so later
    // stage starts receive real empty cells before them rather than a gap.
    const cellStarts = [];
    for (let t = week1; t <= gridEnd; t += unitDays) cellStarts.push(t);
    const cellCount = cellStarts.length;
    const cellsPerWeek = 7 / unitDays;

    const axis = el('div', 'timeline-axis');
    const axisSpacer = el('div', 'timeline-label');
    const axisTrack = el('div', 'timeline-axis-track');
    const axisStart = el('span', 'timeline-axis-date');
    axisStart.textContent = formatTimelineDate(timelineDate(minStart));
    const axisEnd = el('span', 'timeline-axis-date');
    axisEnd.textContent = formatTimelineDate(timelineDate(maxEnd));
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
        const cellEnd = cellStart + (unitDays - 1);
        const covered = r.startDay <= cellEnd && r.endDay >= cellStart;
        const cell = el('div', 'timeline-bar-cell');
        if (covered) {
          // The stage palette is data — one colour per stage row so rows
          // stay distinguishable — so it stays inline; the class carries
          // everything that is styling.
          cell.classList.add('timeline-bar-cell-on');
          cell.style.background = color;
          cell.title = name + ': ' + startLabel + ' – ' + endLabel;
        } else {
          cell.title = formatTimelineDate(timelineDate(cellStart));
        }
        grid.appendChild(cell);
      });

      const dates = el('div', 'timeline-dates');
      dates.setAttribute('aria-label', startLabel + ' to ' + endLabel);
      const startDate = el('span', 'timeline-date-value', { 'aria-hidden': 'true' });
      const endDate = el('span', 'timeline-date-value', { 'aria-hidden': 'true' });
      startDate.textContent = startLabel;
      endDate.textContent = endLabel;
      dates.append(startDate, endDate);
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
  // Every field builder draws the "(optional)" marker the same way, and each
  // used to draw it inline — which meant the ones that forgot were impossible
  // to spot, and declaring `optional` on those fields did nothing at all. Two
  // of the six were in that state. RPA-55 marks more fields optional, so the
  // marker is a single call now, and a test asserts every builder makes it.
  function markOptional(label, field) {
    if (!field.optional) return label;
    const opt = el('span', 'fopt');
    opt.textContent = '(optional)';
    label.append(' ', opt);
    return label;
  }

  // This used to render as a bare "+ Add additional section" button and
  // nothing else: the builder ignored the field's label and its hint, so the
  // one control in the form that invites you to invent your own content was
  // also the only one that never said what it was for. It carries a label and
  // a hint now, like every other field.
  function renderCustomFieldsField(field) {
    const wrap = el('div', 'field', { role: 'group' });
    const labelId = fieldControlId(field.key) + '-label';
    const label = el('div', 'flabel', { id: labelId });
    label.textContent = field.label;
    markOptional(label, field);
    wrap.setAttribute('aria-labelledby', labelId);
    wrap.appendChild(label);
    const guidance = renderFieldHint(field, labelId + '-hint');
    if (guidance) { wrap.appendChild(guidance); describeControl(wrap, guidance); }

    const list = el('div', 'custom-fields-list');
    let blockSeq = 0;
    list.dataset.listKey = field.key;
    wrap.appendChild(list);

    function addBlock(focus) {
      const block = el('div', 'custom-field-block');
      const head = el('div', 'custom-field-head');
      // Neither input had an accessible name — only placeholders, which vanish
      // on typing and are unreliable for screen readers. The labels are
      // visually hidden: the title input is self-evidently the heading, and a
      // visible "Section name" above every block would be noise.
      const seq = ++blockSeq;
      const nameId = fieldControlId(field.key) + '-name-' + seq;
      const bodyId = fieldControlId(field.key) + '-body-' + seq;
      const nameLabel = el('label', 'visually-hidden', { for: nameId });
      nameLabel.textContent = 'Section name';
      const nameInp = el('input', 'th-input custom-field-name', { type: 'text', placeholder: 'Label', id: nameId });
      const removeBtn = el('button', 'list-remove', { type: 'button', 'aria-label': 'Remove section' });
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => block.remove());
      // Say which section the button removes once it has a name.
      nameInp.addEventListener('input', () => {
        const name = nameInp.value.trim();
        removeBtn.setAttribute('aria-label', name ? 'Remove section ' + name : 'Remove section');
      });
      head.append(nameLabel, nameInp, removeBtn);

      const bodyLabel = el('label', 'visually-hidden', { for: bodyId });
      bodyLabel.textContent = 'Details';
      // No placeholder: the block's own title says what it holds, and the
      // field's hint above says what the whole thing is for. This one escaped
      // the placeholder sweep because it exists only after someone adds a
      // block, so an empty form had nothing to find.
      const body = el('textarea', 'finput field-ta custom-field-body', { 'data-field': field.key, id: bodyId });
      bindTextarea(body);

      block.append(head, bodyLabel, body);
      list.appendChild(block);
      if (focus) nameInp.focus();
      return block;
    }

    const addBtn = el('button', 'add-btn', { type: 'button' });
    addBtn.textContent = '+ Add a section';
    addBtn.addEventListener('click', () => addBlock(true));
    wrap.appendChild(addBtn);

    return wrap;
  }

  function renderTableField(field) {
    // A table of inputs has no single control to label; the group carries
    // the name and each cell is named by its column header.
    const wrap = el('div', 'field', { role: 'group' });
    const labelId = fieldControlId(field.key) + '-label';
    const label = el('div', 'flabel', { id: labelId });
    label.textContent = field.label;
    markOptional(label, field);
    wrap.setAttribute('aria-labelledby', labelId);
    wrap.appendChild(label);
    const guidance = renderFieldHint(field, labelId + '-hint');
    if (guidance) { wrap.appendChild(guidance); describeControl(wrap, guidance); }

    const tblWrap = el('div', 'tbl-wrap');
    const table = el('table', 'dtbl', { id: field.key + '-table' });
    // The field's own key, for the same reason as data-col-key above: code
    // branches on field.key === 'stageTimeline', and a table renders no
    // [data-field] anywhere, so nothing could verify that lookup.
    table.dataset.fieldKey = field.key;
    const thead = el('thead');
    const headRow = el('tr');
    field.columns.forEach((c, ci) => {
      const th = document.createElement('th');
      // The column's key, exposed so it can be checked. Code looks columns up
      // by key (the timeline reads stage/startDate/completionDate), and those
      // keys are derived from column labels, so a renamed column can break
      // them — but nothing could see a column key to test it until now.
      th.dataset.colKey = c.key;
      // ...and its type, so stylesheets can size a column by what it holds
      // rather than by the table's id. An id is derived from the field key,
      // and no test scans CSS for key references.
      th.dataset.colType = c.type;
      if (field.editableHeaders) {
        // The value is the heading text; the name says what the input is for.
        const headInp = el('input', 'th-input', { type: 'text', value: c.label, 'aria-label': 'Column ' + (ci + 1) + ' heading' });
        // Cells are named after their column, so a renamed header renames them.
        headInp.addEventListener('input', () => { c.label = headInp.value; updateRowRemoveButtons(tbody); });
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
    // Attach and register the table before its first row is named:
    // nameRowCells finds the columns via tbody.closest('table') and the
    // tables registry, so both have to exist by the time it runs.
    table.append(thead, tbody);
    tables.push({
      id: table.id,
      columns: field.columns,
      cols: field.columns.map((c) => c.key),
      prefill: Boolean(field.prefill),
    });
    tbody.appendChild(buildRow(field.columns));
    updateRowRemoveButtons(tbody);
    tblWrap.appendChild(table);
    wrap.appendChild(tblWrap);

    const addBtn = el('button', 'add-btn', { type: 'button' });
    const singular = field.rowLabel || field.label.replace(/s$/i, '').toLowerCase();
    addBtn.textContent = '+ Add ' + singular;
    addBtn.addEventListener('click', () => addRow(table.id, field.columns));
    wrap.appendChild(addBtn);

    if (field.key === 'stageTimeline') {
      const vizBtn = el('button', 'btn btn-ghost timeline-viz-btn', { type: 'button' });
      vizBtn.textContent = 'Visualise Timeline';
      const chart = el('div', 'timeline-chart');
      chart.hidden = true;

      const refreshTimeline = () => renderTimelineChart(table.id, field.columns, chart);
      updateTimelineVisibility = () => {
        chart.hidden = !timelineVisible;
        vizBtn.textContent = timelineVisible ? 'Hide Timeline' : 'Visualise Timeline';
        if (timelineVisible) refreshTimeline();
        else chart.replaceChildren();
      };

      // Always render the current timeline for printing, then restore the
      // user's previous on-screen visibility choice when printing finishes.
      let chartWasHiddenBeforePrint = null;
      window.addEventListener('beforeprint', () => {
        if (chartWasHiddenBeforePrint === null) chartWasHiddenBeforePrint = chart.hidden;
        refreshTimeline();
        chart.hidden = false;
      }, { signal: formEvents.signal });
      window.addEventListener('afterprint', () => {
        if (chartWasHiddenBeforePrint === null) return;
        chart.hidden = chartWasHiddenBeforePrint;
        chartWasHiddenBeforePrint = null;
      }, { signal: formEvents.signal });

      vizBtn.addEventListener('click', () => {
        timelineVisible = !timelineVisible;
        updateTimelineVisibility();
        scheduleDraftSave();
      });
      table.addEventListener('input', () => { if (!chart.hidden) refreshTimeline(); });
      table.addEventListener('change', () => { if (!chart.hidden) refreshTimeline(); });
      table.addEventListener('click', event => {
        if (event.target.closest('.row-remove') && !chart.hidden) refreshTimeline();
      });

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
  // Research Questions and Outcomes both warn once a list passes three, and
  // every awkward detail a live region needs lives here rather than twice:
  //
  //   * built before it is needed, because a region inserted and filled in the
  //     same breath is announced unreliably;
  //   * emptied rather than hidden, because assistive technology ignores a
  //     hidden region — hiding it would silence every warning after the first;
  //   * carrying its own class, because both fields are eval fields and
  //     already hold three role="status" regions from the evaluation controls,
  //     so "the status element" identifies nothing;
  //   * moved only when it has to be, since shuffling a live region around the
  //     document is a good way to lose the announcement.
  //
  // It sits at the foot of the list, directly above the Add button. It used to
  // be inserted after the fourth row, which reads well at four rows and badly
  // at nine — the warning ends up marooned in the middle of the list, pointing
  // at a row that is no longer the problem. At the bottom it stays beside the
  // row just added, which is the one the reader is looking at.
  function makeListWarning(className, text, isRelevant) {
    let node = null;
    return function update(list) {
      if (!list) return;
      const rows = list.querySelectorAll('.list-row');
      const show = rows.length >= 4 && (!isRelevant || isRelevant(rows.length));
      // Re-created if the form was re-rendered underneath it: the old node is
      // still referenced but no longer in the document.
      if (!node || !list.contains(node)) {
        node = el('div', className, { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
        list.appendChild(node);
      }
      // New rows are appended to the same list, so the warning has to be put
      // back on the end after one arrives — but only then, not on every call.
      if (list.lastElementChild !== node) list.appendChild(node);
      // Class and text together: an empty .field-warning would still draw its
      // own mark from the stylesheet.
      node.classList.toggle('field-warning', show);
      node.textContent = show ? text : '';
    };
  }

  // Outcomes are created one-per-question, so a fourth question makes a fourth
  // outcome in the same breath. Warning on both would say nearly the same thing
  // twice, about one action — so this speaks only when the outcomes list has
  // run ahead on its own, which it can, because Outcomes has an Add button of
  // its own.
  //
  // The test is "more outcomes than questions" rather than "a different number
  // of them". With fewer outcomes than questions the plan is already too long
  // and the question warning already says so; a second voice adds nothing
  // there either.
  const updateOutcomesWarning = makeListWarning(
    'outcome-warning',
    'We recommend three outcomes for a balanced study. '
      + 'More outcomes make the study too long; consider whether you need more than one research study.',
    (count) => count > questionsListEl().querySelectorAll('.list-row').length
  );

  function outcomesListEl() {
    return doc.querySelector('.list-rows[data-list-key="outcomes"]');
  }

  // Its counterpart, added for the warning above, which has to compare the two
  // lists. Six other places query this selector inline; they are left alone
  // rather than swept into an unrelated change.
  function questionsListEl() {
    return doc.querySelector('.list-rows[data-list-key="researchQuestions"]') || { querySelectorAll: () => [] };
  }

  // Every add and remove already routes through here, so the warning needs no
  // wiring of its own on either path.
  function renumberOutcomes() {
    const list = outcomesListEl();
    if (!list) return;
    updateOutcomesWarning(list);
    list.querySelectorAll('.list-row').forEach((row, i) => {
      row.querySelector('.list-num').textContent = (i + 1) + '.';
      row.querySelector('.list-input').setAttribute('aria-label', 'Outcome ' + (i + 1));
      const removeBtn = row.querySelector('.list-remove');
      if (!removeBtn) return;
      removeBtn.setAttribute('aria-label', 'Remove outcome ' + (i + 1));
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
    const inp = el('textarea', 'finput list-input', {
      rows: '1',
      'data-field': list.dataset.fieldKey || 'outcomes',
      placeholder: list.dataset.placeholder || '',
    });
    bindTextarea(inp);
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

  // Question removal owns the warning for populated linked content, so once
  // it reaches this helper the exact paired Outcome can be removed without
  // shifting a later Outcome into the deleted Question's position.
  function removeOutcomeRowAt(index) {
    const list = outcomesListEl();
    if (!list) return;
    const row = list.querySelectorAll('.list-row')[index];
    if (!row) return;
    row.remove();
    renumberOutcomes();
  }

  function confirmQuestionRemoval(index) {
    const number = index + 1;
    const outcomeList = outcomesListEl();
    const outcomeRow = outcomeList && outcomeList.querySelectorAll('.list-row')[index];
    const outcomeInput = outcomeRow && outcomeRow.querySelector('.list-input');
    const hasOutcome = !!(outcomeInput && outcomeInput.value.trim());
    const methodsGroup = methodsGroupAt(index);
    const hasMethods = !!(methodsGroup && methodsGroupValues(methodsGroup).length);

    if (!hasOutcome && !hasMethods) return true;
    const linkedContent = [];
    if (hasOutcome) linkedContent.push('Outcome ' + number);
    if (hasMethods) linkedContent.push('Methods RQ' + number);
    return window.confirm(
      'Deleting Research Question ' + number + ' will also delete:\n\n' +
      linkedContent.map((item) => '- ' + item).join('\n')
    );
  }

  function renderListField(field) {
    // A list has no single control for a <label> to point at, so the group
    // is named by its heading and each row's input names itself ("Research
    // Question 2") — the visible "2." alone is decorative.
    const wrap = el('div', 'field', { role: 'group' });
    const labelId = fieldControlId(field.key) + '-label';
    const label = el('div', 'flabel', { id: labelId });
    label.textContent = field.label;
    markOptional(label, field);
    wrap.setAttribute('aria-labelledby', labelId);
    wrap.appendChild(label);
    const guidance = renderFieldHint(field, labelId + '-hint');
    if (guidance) { wrap.appendChild(guidance); describeControl(wrap, guidance); }
    const rowName = field.label.replace(/s$/i, '');

    const list = el('div', 'list-rows');
    list.dataset.listKey = field.key;
    wrap.appendChild(list);

    function renumber() {
      const rows = list.querySelectorAll('.list-row');
      rows.forEach((row, i) => {
        row.querySelector('.list-num').textContent = (i + 1) + '.';
        row.querySelector('.list-input').setAttribute('aria-label', rowName + ' ' + (i + 1));
        const removeBtn = row.querySelector('.list-remove');
        removeBtn.setAttribute('aria-label', 'Remove ' + rowName.toLowerCase() + ' ' + (i + 1));
        // Keep the button's space reserved (visibility, not display:none) so
        // every row's input stays the same width regardless of which row is
        // first — only actually hiding it would make row 1 stretch wider.
        const removalDisabled = field.key === 'researchQuestions' ? rows.length === 1 : i === 0;
        removeBtn.classList.toggle('list-remove-spacer', removalDisabled);
        removeBtn.disabled = removalDisabled;
      });
    }

    // Research Questions rows grow taller as their text wraps, instead of
    // scrolling horizontally like a normal single-line list input.
    const isGrowable = field.key === 'researchQuestions' || field.prose;

    // Soft nudge, not a hard cap: past 3 questions a study tends to get
    // unfocused, so flag it on the 4th row and keep flagging however many
    // more get added — only clearing once it's back down to 3 or fewer.
    let rqWarning = null;
    // The recommendation used to sit permanently beside the Add button, in a
    // "?" bubble you had to hover to read — invisible on touch, in print, and
    // to anyone who never thought to hover. It reaches people here instead, at
    // the moment it applies (RPA-61), and carries the reason as well as the
    // limit: "four may be too many" states a rule without saying why anyone
    // should care.
    //
    // Nothing is blocked. The fourth question is still added, as it is in
    // Outcomes, which warns the same way through the same helper.
    const showQuestionWarning = makeListWarning(
      'rq-warning',
      'We recommend three questions for a balanced study. '
        + 'More questions make the study too long; consider whether you need more than one research study.'
    );

    function updateResearchQuestionsWarning() {
      if (field.key !== 'researchQuestions') return;
      showQuestionWarning(list);
      // The outcomes warning compares the two lists, so a change to this one
      // moves its answer. Cheaper to say so than to rely on every question
      // path also happening to touch Outcomes.
      updateOutcomesWarning(outcomesListEl());
    }

    function addRow(focus) {
      const row = el('div', 'list-row');
      const num = el('span', 'list-num');
      const inp = isGrowable
        ? el('textarea', 'finput list-input', { rows: '1', 'data-field': field.key, placeholder: field.placeholder || '' })
        : el('input', 'finput list-input', { type: 'text', 'data-field': field.key, placeholder: field.placeholder || '' });
      if (field.prose) inp.classList.add('prose-input');
      if (isGrowable) bindTextarea(inp);
      // Each question's Methods group is labelled with its text, so the label
      // has to track edits as they're typed.
      if (field.key === 'researchQuestions') inp.addEventListener('input', syncMethodsGroups);
      const removeBtn = el('button', 'list-remove', { type: 'button' });
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', (event) => {
        if (removeBtn.disabled) return;
        const index = Array.from(list.querySelectorAll('.list-row')).indexOf(row);
        if (field.key === 'researchQuestions') {
          if (!confirmQuestionRemoval(index)) {
            event.stopPropagation();
            return;
          }
          removeOutcomeRowAt(index);
          removeMethodsGroupAt(index);
        }
        row.remove();
        renumber();
        updateResearchQuestionsWarning();
        if (field.key === 'researchQuestions') {
          syncMethodsGroups();
          const remaining = list.querySelectorAll('.list-input');
          const nextInput = remaining[Math.min(index, remaining.length - 1)];
          // The removed button is detached by the time its click bubbles.
          // Notify dependent evaluations from a surviving Question instead.
          nextInput.dispatchEvent(new Event('input', { bubbles: true }));
          nextInput.focus();
        }
      });
      row.append(num, inp, removeBtn);
      list.appendChild(row);
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
    wrap.appendChild(addBtnRow);

    if (field.examples) wrap.append(...renderExamplePanel(field));
    if (field.eval) {
      const controls = renderEvalControls(field, () => collectNumberedListValues(list))[0];
      wrap.appendChild(controls);
      bindEvaluationStaleness(wrap, controls);
    }

    return wrap;
  }

  // Outcomes: same list-row visuals as renderListField. Rows are also driven
  // positionally by Research Questions (see addOutcomeRow/removeOutcomeRowAt
  // above) — each row gets its own remove button, wired in addOutcomeRow.
  // Its own "+ Add outcome" button lets extra outcomes be added beyond that
  // count. Starts empty; initOutcomesSync() seeds it to match once the whole
  // form (and Research Questions) has actually rendered.
  function renderLinkedOutcomesField(field) {
    const wrap = el('div', 'field', { role: 'group' });
    const labelId = fieldControlId(field.key) + '-label';
    const label = el('div', 'flabel', { id: labelId });
    label.textContent = field.label;
    markOptional(label, field);
    wrap.setAttribute('aria-labelledby', labelId);
    wrap.appendChild(label);
    const guidance = renderFieldHint(field, labelId + '-hint');
    if (guidance) { wrap.appendChild(guidance); describeControl(wrap, guidance); }

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
    if (field.eval) {
      const controls = renderEvalControls(field, () => collectNumberedListValues(list))[0];
      wrap.appendChild(controls);
      bindEvaluationStaleness(wrap, controls);
    }

    return wrap;
  }

  // Methods: a container of question-labelled groups instead of one flat
  // list. Only the first group is built here — the rest are created, removed
  // and labelled by syncMethodsGroups, which runs whenever a Research
  // Question is added, removed or edited, and once from the wire-up below.
  function renderGroupedMethodsField(field) {
    const wrap = el('div', 'field', { role: 'group' });
    const labelId = fieldControlId(field.key) + '-label';
    const label = el('div', 'flabel', { id: labelId });
    label.textContent = field.label;
    markOptional(label, field);
    wrap.setAttribute('aria-labelledby', labelId);
    wrap.appendChild(label);
    const guidance = renderFieldHint(field, labelId + '-hint');
    if (guidance) { wrap.appendChild(guidance); describeControl(wrap, guidance); }

    const container = el('div', 'methods-groups');
    container.dataset.placeholder = field.placeholder || '';
    container.appendChild(buildMethodsGroup(field.placeholder || ''));
    wrap.appendChild(container);

    if (field.examples) wrap.append(...renderExamplePanel(field));
    if (field.eval) {
      const controls = renderEvalControls(field, () => methodsAllValues().join('\n'))[0];
      wrap.appendChild(controls);
      bindEvaluationStaleness(wrap, controls);
    }
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
  // Field guidance itself lives in research-plan-template.md as an indented
  // "Hint:" line under each field (see parseSchema). This icon is only used
  // for the two button-row tips that are not tied to a field.
  //
  function appendHintText(target, text) {
    text.split(/(\*[^*\n]+\*)/).forEach((part) => {
      if (!part) return;
      if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
        const em = document.createElement('em');
        em.textContent = part.slice(1, -1);
        target.appendChild(em);
      } else {
        target.appendChild(document.createTextNode(part));
      }
    });
  }

  function renderFieldHint(field, id) {
    const text = field && field.hint;
    if (!text) return null;
    const hint = el('div', 'field-hint-text', { id: id });
    const render = () => {
      hint.replaceChildren();
      appendHintText(hint, field.key === 'previousKnowledge' && !capabilities.uploads
        ? 'Name prior research or documentation relevant to this study. Saved file references are kept; attachment contents are unavailable through this app.'
        : text);
    };
    render();
    if (field.key === 'previousKnowledge') getConfig().then(render);
    return hint;
  }

  // Stable, unique id for a field's control so a real <label for> can point
  // at it. Ids also unblock aria-describedby for the hint above.
  function fieldControlId(key) {
    return 'field-' + key;
  }

  function describeControl(control, hint) {
    if (control && hint) control.setAttribute('aria-describedby', hint.id);
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
          input.dispatchEvent(new Event('change', { bubbles: true }));
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
          input.dispatchEvent(new Event('change', { bubbles: true }));
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
    // Marks the control for the "KEY — summary" chip styling, so the
    // stylesheet does not have to name the field key itself.
    input.classList.add('jira-input');
    const status = el('div', 'jira-status', { role: 'status', 'aria-atomic': 'true' });
    const unavailableMessage = 'Jira suggestions are unavailable. You can still enter a ticket key manually.';
    const failureMessage = 'Jira search is temporarily unavailable. You can still enter a ticket key manually.';
    const emptyMessage = 'No matching Jira tickets. You can still enter a ticket key manually.';
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
      const filled = Boolean(input.value.trim());
      // Drives the tag styling. This used to be :placeholder-shown in CSS,
      // which made the placeholder load-bearing: emptying it turned every
      // blank field into a tag, because a field with no placeholder text is
      // never "showing" one. A class says what is actually meant.
      input.classList.toggle('jira-filled', filled);
      if (filled) sizeInputToContent(input, 26);
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

    function showStatus(message) {
      closeMenu();
      matches = [];
      menu.replaceChildren();
      // One persistent live region; do not repeat an unchanged announcement.
      if (status.textContent !== message) status.textContent = message;
    }

    function dismiss() {
      ++requestId;
      clearTimeout(debounceTimer);
      showStatus('');
    }

    function renderMatches() {
      status.textContent = '';
      menu.innerHTML = '';
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

    input.removeAttribute('role');
    input.removeAttribute('aria-autocomplete');
    const configReady = getConfig().then(cfg => {
      jiraEnabled = cfg.configurationUnavailable ? null : capabilities.jira;
      if (jiraEnabled) {
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
      }
    });

    async function runSearch(q, myId) {
      await configReady;
      if (myId !== requestId) return;
      if (jiraEnabled === false) { showStatus(unavailableMessage); return; }
      if (jiraEnabled === null) { showStatus(failureMessage); return; }
      showStatus('Searching…');
      try {
        const res = await fetch('/api/jira/search?q=' + encodeURIComponent(q));
        if (!res.ok) throw new Error('Search unavailable');
        const body = await res.json();
        if (myId !== requestId) return;
        matches = body.issues || [];
        activeIndex = -1;
        if (matches.length === 0) { showStatus(emptyMessage); return; }
        renderMatches();
        openMenu();
      } catch (_) {
        if (myId !== requestId) return;
        showStatus(failureMessage);
      }
    }

    function updateMatches() {
      const q = input.value.trim();
      const myId = ++requestId;
      clearTimeout(debounceTimer);
      if (!q) { showStatus(''); return; }
      if (jiraEnabled === false) { showStatus(unavailableMessage); return; }
      showStatus('');
      debounceTimer = setTimeout(() => runSearch(q, myId), 250);
    }

    input.addEventListener('input', updateMatches);
    input.addEventListener('input', updateWidth);
    input.addEventListener('focus', () => { if (input.value.trim()) updateMatches(); });
    input.addEventListener('blur', () => { setTimeout(dismiss, 100); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { dismiss(); return; }
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
      }
    });
    return status;
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

  // Warns when Research readout lands less than a week before Project
  // decision, so there's no buffer for setbacks. The controls keep their
  // canonical values as ISO YYYY-MM-DD even though the segmented editor is
  // displayed as DD-MMM-YYYY.
  function initDeadlineConstraints() {
    const decisionInput = doc.querySelector('[data-field="projectDecision"]');
    const researchInput = doc.querySelector('[data-field="researchReadout"]');
    if (!decisionInput || !researchInput) return;

    // Research readout can't land after Project decision — hard-blocked via
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

    // Softer, complementary check: even a Research readout date that's
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
    const controlId = fieldControlId(field.key);
    const label = el('label', 'flabel', { for: controlId, id: controlId + '-label' });
    label.textContent = field.label;
    markOptional(label, field);
    wrap.appendChild(label);
    const guidance = renderFieldHint(field, controlId + '-hint');
    if (guidance) wrap.appendChild(guidance);

    // Reuses the same .ssel dropdown + "Other…" escape hatch as a table's
    // "select" columns (see buildRow's select branch for Stage Timeline)
    // instead of introducing a second dropdown component. Only one of
    // sel/otherInput carries data-field at a time — whichever is currently
    // showing — so a generic [data-field="key"] lookup elsewhere always
    // finds the field's actual current value, not a stale hidden one.
    // GOV.UK treats a select as a last resort — people find them harder than
    // other controls — and says to use radios below about 20 options. Five
    // short, mutually exclusive options that form a scale is the case that
    // guidance is written for: you can compare them without opening anything.
    //
    // The group keeps the .select-cell wrapper and its data-field-key on
    // purpose. That is what collectDraft and applyDraft look for, and what
    // scalarFieldEls skips, so a radio field saves and restores in exactly the
    // { v, o } shape a select did — old drafts restore with no migration.
    if (field.type === 'radios') {
      const group = el('div', 'select-cell radio-group', {
        role: 'radiogroup',
        'aria-labelledby': label.id,
      });
      group.dataset.fieldKey = field.key;
      describeControl(group, guidance);
      // No single control to point at, so the heading names the group.
      label.removeAttribute('for');

      const otherRow = el('div', 'select-other-row radio-other-row');
      const otherInput = el('input', 'finput select-other-input', {
        type: 'text',
        placeholder: 'Type your own value…',
        'aria-label': field.label + ' — other',
      });
      otherRow.appendChild(otherInput);
      otherRow.hidden = true;

      const options = (field.options || []).concat(['__other__']);
      options.forEach((value, i) => {
        const item = el('div', 'radio-item');
        const id = controlId + '-opt-' + i;
        const radio = el('input', 'radio-input', {
          type: 'radio',
          id: id,
          name: controlId,
          value: value,
        });
        const optLabel = el('label', 'radio-label', { for: id });
        optLabel.textContent = value === '__other__' ? 'Other' : value;
        radio.addEventListener('change', () => {
          if (!radio.checked) return;
          const isOther = radio.value === '__other__';
          otherRow.hidden = !isOther;
          if (isOther) {
            otherInput.focus();
          } else {
            otherInput.value = '';
          }
        });
        item.append(radio, optLabel);
        group.appendChild(item);
        // The conditional reveal belongs directly under the option it belongs
        // to, which is the last one.
        if (value === '__other__') group.appendChild(otherRow);
      });

      wrap.appendChild(group);
      return wrap;
    }

    if (field.type === 'select') {
      const selectCell = el('div', 'select-cell');
      selectCell.dataset.fieldKey = field.key;
      const sel = document.createElement('select');
      sel.className = 'ssel ss-ns';
      sel.setAttribute('data-field', field.key);
      sel.id = controlId;
      describeControl(sel, guidance);
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
          // The <label for> points at the now-hidden select, so the free-text
          // replacement names itself.
          otherInput.setAttribute('aria-label', field.label);
          describeControl(otherInput, guidance);
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
      // A date control is a labelled group of its own, not a single input, so
      // it takes the heading via aria-labelledby rather than <label for>.
      label.removeAttribute('for');
      dateControl.element.setAttribute('aria-labelledby', label.id);
      describeControl(dateControl.element, guidance);
      wrap.appendChild(dateControl.element);
      return wrap;
    }

    const isTextarea = field.type === 'textarea';
    const input = el(isTextarea ? 'textarea' : 'input', isTextarea ? 'finput field-ta' : 'finput', {
      'data-field': field.key,
      placeholder: field.placeholder || '',
    });
    if (!isTextarea) input.type = 'text';
    if (isTextarea && field.rows) {
      input.rows = field.rows;
      input.classList.add('finput-rows');
    }
    input.id = controlId;
    describeControl(input, guidance);
    attachSignOffStamp(input, field.key);
    wrap.appendChild(input);
    const hint = signOffHint(field.key);
    if (hint) wrap.appendChild(hint);

    if (field.examples) wrap.append(...renderExamplePanel(field));
    if (field.eval) {
      const controls = renderEvalControls(field, () => input.value)[0];
      wrap.appendChild(controls);
      bindEvaluationStaleness(wrap, controls);
    }
    if (field.key === 'theory') wrap.append(...renderFrameworkSuggest(input));

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
        const controlId = fieldControlId(f.key);
        // A date control is a labelled group of its own, so its heading
        // attaches via aria-labelledby; a text field gets a real <label for>.
        const lbl = el(f.type === 'date' ? 'div' : 'label', 'clbl', { id: controlId + '-label' });
        lbl.textContent = f.label;
        const guidance = renderFieldHint(f, controlId + '-hint');
        let inp;
        let control;
        if (f.type === 'date') {
          const dateControl = buildDateControl('cinput', { 'data-field': f.key }, f.label);
          inp = dateControl.input;
          control = dateControl.element;
        } else if (f.type === 'textarea') {
          inp = el('textarea', 'cinput prose-input', {
            rows: '1',
            'data-field': f.key,
            placeholder: f.placeholder || '',
          });
          control = inp;
          td.classList.add('prose-cell');
        } else {
          inp = el('input', 'cinput', { type: 'text', 'data-field': f.key, placeholder: f.placeholder || '' });
          control = inp;
        }
        attachSignOffStamp(inp, f.key);
        const jiraStatus = f.key === 'jiraProject' ? attachJiraCombobox(inp) : null;
        if (f.type === 'date') {
          control.setAttribute('aria-labelledby', lbl.id);
        } else {
          inp.id = controlId;
          lbl.setAttribute('for', controlId);
        }
        describeControl(control, guidance);
        td.append(lbl, control);
        if (jiraStatus) td.appendChild(jiraStatus);
        if (guidance) lbl.insertAdjacentElement('afterend', guidance);
        const hint = signOffHint(f.key);
        if (hint) td.appendChild(hint);
        return td;
      }

      // Two cells per row. Jira Project used to take a full-width row of its
      // own here; it lives in the header now, so that exception is gone.
      let i = 0;
      while (i < section.fields.length) {
        const f = section.fields[i];
        const next = section.fields[i + 1];
        const tr = el('tr');
        {
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
      if (evaluationSections[section.slug]) fieldsWrap.appendChild(renderSectionEvaluation(section.slug));
      body.appendChild(fieldsWrap);
    }

    acc.appendChild(body);
    return acc;
  }

  function renderHeader(header) {
    const wrap = el('div', 'doc-header');

    function buildMetaField(f) {
      const mf = el('div', 'mf');
      const controlId = fieldControlId(f.key);
      const label = el(f.type === 'date' ? 'div' : 'label', 'mlabel', { id: controlId + '-label' });
      label.textContent = f.label;
      // Header fields can be optional too. Project decision is the live case:
      // it is a delivery date the researcher does not set and often nobody has
      // set yet, and its audit verdict is "keep — sourced or optional".
      markOptional(label, f);
      // The compact corner slot has no room for guidance, and this is a
      // computed value nobody is asked to fill in.
      const guidance = f.key === 'lastUpdated' ? null : renderFieldHint(f, controlId + '-hint');
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
      const jiraStatus = f.key === 'jiraProject' ? attachJiraCombobox(input) : null;
      if (f.key === 'lastUpdated') {
        setDateInputValue(input, todayIso());
        // A draft restore replays saved values through this same event, and
        // the stamp writes the value itself; neither is a person choosing a
        // date, and only a person should switch the stamping off.
        input.addEventListener('change', () => {
          if (!stampingLastUpdated && !draftRestoring) lastUpdatedManual = true;
        });
      }
      if (f.type === 'date') {
        control.setAttribute('aria-labelledby', label.id);
      } else {
        input.id = controlId;
        label.setAttribute('for', controlId);
      }
      describeControl(control, guidance);
      mf.append(label, control);
      if (jiraStatus) mf.appendChild(jiraStatus);
      if (guidance) label.insertAdjacentElement('afterend', guidance);
      return mf;
    }

    // "Last updated" is computed: the app stamps it whenever the plan's content
    // changes. RPA-55's verdict was that a computed value should read as a
    // dateline rather than an editable control, because a box invites an answer
    // to a question nobody is being asked.
    //
    // It stays editable, because Gus asked for that explicitly. So the sentence
    // itself is the control: activating it swaps in the date editor in place.
    // No separate "Change" link — that was tried and rejected as clutter in a
    // corner slot this small.
    function buildDateline(f) {
      const wrap = el('div', 'mf mf-compact dateline');
      const controlId = fieldControlId(f.key);
      const label = el('div', 'mlabel', { id: controlId + '-label' });
      label.textContent = f.label;

      const dateControl = buildDateControl('minput', { 'data-field': f.key }, f.label);
      const input = dateControl.input;
      const control = dateControl.element;
      control.setAttribute('aria-labelledby', label.id);
      control.hidden = true;

      const text = el('button', 'dateline-value', {
        type: 'button',
        'aria-describedby': label.id,
      });

      refreshDateline = () => {
        text.textContent = formatDateline(input.value);
        text.setAttribute('aria-label', f.label + ' ' + formatDateline(input.value) + ', edit');
      };

      setDateInputValue(input, todayIso());
      refreshDateline();

      function edit() {
        control.hidden = false;
        text.hidden = true;
        const day = control.querySelector('.date-day');
        if (day) day.focus();
      }
      function done() {
        control.hidden = true;
        text.hidden = false;
        refreshDateline();
      }
      text.addEventListener('click', edit);
      // Leaving the editor puts the sentence back, so the control is only
      // present while it is being used.
      control.addEventListener('focusout', () => {
        window.setTimeout(() => {
          if (!control.contains(doc.activeElement || document.activeElement)) done();
        }, 0);
      });

      input.addEventListener('change', () => {
        if (!stampingLastUpdated && !draftRestoring) lastUpdatedManual = true;
        refreshDateline();
      });

      wrap.append(label, text, control);
      return wrap;
    }

    // "Last updated" keeps its compact top-right corner slot rather than
    // sitting in the grid of questions people are asked to answer.
    const topRow = el('div', 'doc-header-top');
    const metaGrid = el('div', 'meta-grid');
    let identifier = null;
    header.meta.forEach((f) => {
      if (f.key === 'lastUpdated') {
        topRow.appendChild(buildDateline(f));
        return;
      }
      const mf = buildMetaField(f);
      if (f.key === 'jiraProject') {
        // Directly under the title and the same width as it. It identifies
        // the plan rather than asking one of the paired questions in the grid
        // below, and the combobox wants room for its "KEY — summary" result.
        mf.classList.add('mf-identifier');
        identifier = mf;
      } else {
        metaGrid.appendChild(mf);
      }
    });
    wrap.appendChild(topRow);

    // Label and hint outside the control, like every other field: GOV.UK
    // guidance is that placeholder text is not guidance. It vanishes as soon
    // as anyone types, is too low-contrast to read comfortably, and gets
    // mistaken for a value already filled in.
    const titleId = fieldControlId(header.title.key);
    const titleLabel = el('label', 'flabel', { for: titleId, id: titleId + '-label' });
    titleLabel.textContent = header.title.label || 'Title';
    const titleHint = renderFieldHint(header.title, titleId + '-hint');
    const titleInput = el('textarea', 'title-inp field-ta', {
      rows: '1',
      id: titleId,
      'data-field': header.title.key,
    });
    describeControl(titleInput, titleHint);
    wrap.appendChild(titleLabel);
    if (titleHint) wrap.appendChild(titleHint);
    wrap.appendChild(titleInput);
    if (identifier) wrap.appendChild(identifier);
    wrap.appendChild(metaGrid);

    return wrap;
  }

  // The feedback field isn't a titled accordion section like the others
  // — it's a single optional field, so showing an empty box for it by
  // default is more clutter than it's worth. renderField(field) builds the
  // exact same label/textarea markup as always (so once revealed
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
    const removeBtn = el('button', 'list-remove', { type: 'button', title: 'Remove comment', 'aria-label': 'Remove comment' });
    removeBtn.textContent = '✕';
    labelRow.append(labelEl, removeBtn);

    const btn = el('button', 'add-btn', { type: 'button' });
    btn.textContent = 'Give feedback';
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

    // A restored draft writes the value straight into the textarea and fires
    // no click, so without this a plan saved with feedback in it reopened with
    // the field hidden behind "+ Add feedback" — the comment was there and
    // invisible. That was survivable while this sat in a section of its own;
    // it is not, now that the field's whole purpose is to be read at the
    // moment somebody reviews the plan.
    syncCommentsReveal = () => {
      const written = Boolean(ta && ta.value.trim());
      fieldEl.hidden = !written;
      btn.hidden = written;
      if (written) resizeTa(ta);
    };

    wrap.append(btn, fieldEl);
    return wrap;
  }

  // ---------- review step (RPA-55) ----------
  // The last thing in the document, and deliberately not an accordion. The
  // audit's verdict was that people approve a plan before it exists, which is
  // about the moment rather than the place: a collapsible section would move
  // that problem down the page instead of fixing it.
  //
  // Shaped after GOV.UK's "check your answers": a summary of what is there,
  // a Change action on every row, then the approval. ADR 001 names that
  // pattern and the task list as the two GOV.UK patterns that survive this
  // being an application rather than a one-time form. It is a hybrid of the
  // two — rows are sections, not answers, because restating thirty rows would
  // be unreadable — and nothing here blocks signing, per the same record.

  // A field counts as answered if any control inside it holds something.
  // Deliberately shallow: it treats a table with one filled cell as answered,
  // which matches "information added" rather than trying to judge quality.
  function fieldHasContent(fieldEl) {
    const controls = fieldEl.querySelectorAll('input, textarea, select');
    return Array.from(controls).some((c) => {
      // A value the form supplied is not an answer. Without this an untouched
      // Execution reports the pre-filled Stage Timeline as answered — the same
      // bug the select rule below fixes, arriving by a different route.
      if (isPrefilled(c)) return false;
      if (c.type === 'radio' || c.type === 'checkbox') return c.checked;
      if (c.type === 'file') return !!(c.files && c.files.length);
      // A select always has a value, so its first option is not an answer —
      // otherwise an untouched Execution reports "2 of 4 fields" because the
      // Stage and Status columns default to Planning and Not Started.
      if (c.tagName === 'SELECT') {
        const first = c.options[0];
        return !!first && c.value !== first.value;
      }
      return !!(c.value || '').trim();
    });
  }

  function sectionSummary(sectionEl) {
    const title = sectionEl.querySelector('.acc-title').textContent.trim();
    const fields = Array.from(sectionEl.querySelectorAll('.acc-body .field'));
    const answered = fields.filter(fieldHasContent).length;

    // Currency, only where evaluation exists at all.
    const slug = (sectionEl.querySelector('.acc-body') || {}).id || '';
    const key = slug.replace(/^body-/, '');
    const evalKeys = evaluationSections[key] || [];
    const registered = evalKeys.map((k) => evaluationFields.get(k)).filter(Boolean);
    const evaluated = registered.filter((f) => f.evaluated());
    const stale = evaluated.filter((f) => f.stale()).length;

    return {
      title,
      sectionEl,
      total: fields.length,
      answered,
      complete: fields.length > 0 && answered === fields.length,
      hasEvaluation: registered.length > 0,
      evaluatedCount: evaluated.length,
      staleCount: stale,
    };
  }

  function renderReviewStep(section) {
    const step = el('section', 'review-step');
    const headingId = 'review-step-heading';
    step.setAttribute('aria-labelledby', headingId);

    const heading = el('h2', 'review-h', { id: headingId });
    heading.textContent = section.title;
    const sub = el('p', 'review-sub');
    sub.textContent = 'Check the plan is complete and current, then approve it.';
    step.append(heading, sub);

    const list = el('div', 'review-list');
    step.appendChild(list);

    function draw() {
      list.innerHTML = '';
      Array.from(doc.querySelectorAll('.acc')).forEach((sectionEl) => {
        const s = sectionSummary(sectionEl);
        const row = el('div', 'review-row');

        const tick = el('span', 'review-tick' + (s.complete ? ' review-tick-done' : ''));
        tick.textContent = s.complete ? '✓' : '•';
        tick.setAttribute('aria-hidden', 'true');

        const name = el('span', 'review-name');
        name.textContent = s.title;

        const state = el('span', 'review-state' + (s.complete ? '' : ' review-state-open'));
        state.textContent = s.complete ? 'complete' : s.answered + ' of ' + s.total + ' fields';

        const note = el('span', 'review-note');
        if (s.hasEvaluation && s.staleCount) {
          note.textContent = 'evaluation out of date';
          note.classList.add('review-note-stale');
        } else if (s.hasEvaluation && s.evaluatedCount) {
          note.textContent = 'evaluated';
        }

        // Every row gets a Change action — the part of check-your-answers that
        // makes the summary useful rather than just a verdict on your work.
        const change = el('button', 'review-change', {
          type: 'button',
          'aria-label': 'Change ' + s.title,
        });
        change.textContent = 'Change';
        change.addEventListener('click', () => {
          const body = sectionEl.querySelector('.acc-body');
          if (body && body.hidden) sectionEl.querySelector('.acc-head').click();
          sectionEl.scrollIntoView({ block: 'start' });
          const first = sectionEl.querySelector('.acc-body input, .acc-body textarea, .acc-body select');
          if (first) first.focus();
        });

        row.append(tick, name, state, note, change);
        list.appendChild(row);
      });
    }

    // Feedback closes the document, below the approvals. It was briefly above
    // them, on the argument that feedback after sign-off has missed its
    // moment; Gus put it last, where a reader arrives at it having read the
    // whole plan. Found by key rather than by position in the section, for the
    // same reason the section itself is.
    const commentsField = section.fields.find((f) => f.key === 'comments');

    const signOffs = el('div', 'review-signoffs');
    section.fields
      .filter((f) => f !== commentsField)
      .forEach((f) => signOffs.appendChild(renderField(f)));
    step.appendChild(signOffs);

    if (commentsField) step.appendChild(renderCommentsReveal(commentsField));

    // The summary is only true at the moment it is drawn, so redraw it
    // whenever the plan changes rather than once at render.
    let pending = null;
    const refresh = () => {
      if (pending) window.clearTimeout(pending);
      pending = window.setTimeout(draw, 120);
    };
    doc.addEventListener('input', refresh);
    doc.addEventListener('change', refresh);
    doc.addEventListener('click', refresh);
    refreshReviewSummary = refresh;
    draw();

    return step;
  }

  function renderSchema(schema) {
    doc.innerHTML = '';
    tables.length = 0;
    doc.appendChild(renderHeader(schema.header));

    // The review step is found by the sign-off keys, not by its section's
    // title. The title used to be matched literally, so renaming the section
    // would have quietly demoted this to an ordinary accordion — the same
    // label-to-code coupling that cost a day in RPA-55, one level up.
    //
    // Feedback used to be hoisted out of a section of its own here. It lives
    // inside the review section now, so there is nothing to hoist: whatever
    // that section holds, renderReviewStep composes.
    const sections = schema.sections.map((section) => ({ ...section, fields: section.fields.slice() }));
    const reviewIdx = sections.findIndex(
      (s) => s.fields.some((f) => f.key === 'signOffResearcher')
    );
    const reviewSection = reviewIdx !== -1 ? sections.splice(reviewIdx, 1)[0] : null;

    // A custom-fields field belongs to the document, not to the section that
    // happens to declare it. It is the escape hatch for what the template did
    // not anticipate, and "what the template did not anticipate about
    // Execution specifically" is not a question anyone is asking — it only
    // sat in Execution because the Resources section was folded there.
    //
    // So it is lifted out and rendered after the sections, where it is always
    // visible rather than hidden inside a collapsed accordion. Routed by type
    // rather than by key or section title, for the same reason the review step
    // is routed by its sign-off keys.
    const loose = [];
    sections.forEach((s) => {
      const own = s.fields.filter((f) => f.type !== 'custom-fields');
      loose.push(...s.fields.filter((f) => f.type === 'custom-fields'));
      s.fields = own;
    });

    sections.forEach((s) => doc.appendChild(renderSection(s)));
    loose.forEach((f) => doc.appendChild(renderCustomFieldsField(f)));
    // Last, and after the summary rows can see every section above it.
    if (reviewSection) doc.appendChild(renderReviewStep(reviewSection));
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
  const DRAFT_VERSION = 7;
  const DRAFT_SAVE_DELAY_MS = 400;
  let draftRestoring = false;
  let lastSavedSignature = null;
  let draftTimer = null;
  let recoveredDraft = null;

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
        n: fileCell.dataset.fileName,
      };
    }
    const selectCell = td.querySelector('.select-cell');
    if (selectCell) {
      const sel = selectCell.querySelector('.ssel');
      const other = selectCell.querySelector('.select-other-input');
      return withPrefill({
        t: 'select',
        v: sel && sel.hidden ? '__other__' : (sel ? sel.value : ''),
        o: other ? other.value : '',
      }, sel);
    }
    const plainSel = td.querySelector('select');
    if (plainSel) return withPrefill({ t: 'sel', v: plainSel.value }, plainSel);
    const dateInput = td.querySelector('input[type="date"]');
    if (dateInput) return withPrefill({ t: 'date', v: dateInput.value }, dateInput);
    const input = td.querySelector('input, textarea');
    return withPrefill({ t: 'text', v: input ? input.value : '' }, input);
  }

  // Drafts written before RPA-76 carry no `d`, which is the right answer for
  // them: nothing was ever pre-filled, so every value in one was typed.
  function withPrefill(snap, control) {
    if (isPrefilled(control)) snap.d = 1;
    return snap;
  }

  // Every control in the cell, not just the first: a date cell is three
  // segment inputs plus the real input[type=date], and they were marked as a
  // set. Clearing one of them left the rest marked, which came back as a
  // spurious `d` on the next save.
  function restorePrefill(td, snap) {
    td.querySelectorAll('input, select, textarea').forEach((control) => {
      // No `d` means unknown rather than touched: a legacy draft has no marks
      // at all, and its empty cells should still accept a suggestion.
      if (snap.d) markPrefilled(control);
      else delete control.dataset.prefill;
    });
  }

  function setCellSnapshot(td, snap) {
    if (!snap) return;
    restorePrefill(td, snap);
    if (snap.t === 'file') {
      const cell = td.querySelector('.file-cell');
      if (!cell) return;
      cell.querySelector('.file-value').value = snap.v || '';
      cell.dataset.fileName = snap.n ?? 'No file chosen';
      renderFileReference(cell);
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
        if (other) other.value = snap.o || '';
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
    const input = td.querySelector('input, textarea');
    if (input) {
      input.value = snap.v || '';
      if (input.tagName === 'TEXTAREA') {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
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
      if (!sel) {
        // Radio group: reports the same { v, o } a dropdown does, so the draft
        // format does not fork and an old draft still restores.
        const checked = cell.querySelector('.radio-input:checked');
        selects[cell.dataset.fieldKey] = {
          v: checked ? checked.value : '',
          o: other ? other.value : '',
        };
        return;
      }
      selects[cell.dataset.fieldKey] = {
        v: sel.hidden ? '__other__' : sel.value,
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

    return { fields, selects, lists, methods, tables: tableData, custom, lastUpdatedManual,
      ui: { timelineVisible } };
  }

  // Everything about the plan except the stamp itself, so that re-dating the
  // plan can never look like a change and re-trigger itself.
  function draftContentSignature(draft) {
    const fields = Object.assign({}, draft.fields);
    delete fields.lastUpdated;
    const content = Object.assign({}, draft, { fields });
    delete content.ui; // Viewing the timeline does not edit the authored plan.
    return JSON.stringify(content);
  }

  // collectDraft can only report what the form currently renders, so making a
  // field dormant used to delete anything already saved under it on the very
  // next autosave — open an older plan, edit its title, and the Requirements
  // table you filled in months ago is gone (found by Max reviewing PR #22).
  //
  // Anything the stored draft holds that this form cannot produce is carried
  // forward untouched. A rendered-but-empty field still wins: collectDraft
  // reports it as empty, and an empty answer is an answer. Clear Form removes
  // the stored draft before resetting, so nothing is resurrected there.
  function carryUnrendered(draft, stored = readDraft()) {
    if (!stored) return draft;
    ['fields', 'selects', 'lists', 'tables', 'custom'].forEach((section) => {
      const kept = stored[section];
      if (!kept || typeof kept !== 'object' || Array.isArray(kept)) return;
      draft[section] = Object.assign({}, kept, draft[section] || {});
    });
    return draft;
  }

  function saveDraft() {
    const store = draftStore();
    if (!store || draftRestoring) return;
    try {
      let draft = carryUnrendered(collectDraft());
      // Date the plan only when its content actually moved. save is also
      // scheduled by clicks that change nothing (opening a section, focusing
      // a field), and merely looking at a plan is not editing it.
      const signature = draftContentSignature(draft);
      if (lastSavedSignature !== null && signature !== lastSavedSignature && !lastUpdatedManual) {
        setLastUpdatedToday();
        // Re-collected, so it has to be carried again — the merge above is on
        // the discarded copy otherwise, which is exactly how the first
        // attempt at this fix silently did nothing.
        draft = carryUnrendered(collectDraft());
      }
      lastSavedSignature = signature;
      const payload = Object.assign(
        {
          version: DRAFT_VERSION,
          savedAt: new Date().toISOString(),
          // Written on every save but only ever from the value already in
          // memory, so the first save fixes it and later ones carry it.
          createdAt: planCreatedAt,
        },
        draft
      );
      store.setItem(DRAFT_KEY, JSON.stringify(payload));
      recoveredDraft = payload;
    } catch (err) {
      // Most likely a quota error or storage blocked mid-session. Editing
      // must keep working, so this is reported and otherwise ignored.
      console.warn('Could not save draft:', err);
    }
  }

  function scheduleDraftSave(event) {
    if (event && !event.target.isConnected) return;
    if (draftRestoring) return;
    if (draftTimer) window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(saveDraft, DRAFT_SAVE_DELAY_MS);
  }

  function clearDraft() {
    recoveredDraft = null;
    if (draftTimer) window.clearTimeout(draftTimer);
    draftTimer = null;
    const store = draftStore();
    if (!store) return;
    try {
      store.removeItem(DRAFT_KEY);
    } catch (err) {
      console.warn('Could not clear draft:', err);
    }
  }

  function readDraft() {
    const store = draftStore();
    if (!store) return recoveredDraft;
    let raw;
    try {
      raw = store.getItem(DRAFT_KEY);
    } catch (err) {
      return recoveredDraft;
    }
    if (!raw) { recoveredDraft = null; return null; }
    try {
      const parsed = JSON.parse(raw);
      recoveredDraft = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
      return recoveredDraft;
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
    // v7 adds a draft UI preference; pre-existing drafts start hidden.
    if (version < 7) {
      migrated.ui = Object.assign({}, migrated.ui, { timelineVisible: false });
    }
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
    // v4: RPA-55 renamed three header fields — Researcher, Project Owner and
    // Report Research became Lead researcher, Project requester and Research
    // readout. Same situation as v3: the key follows the label through
    // toCamelKey, so a draft saved before the rename holds keys no live field
    // answers to, and applyDraft would drop those values without a word.
    // v6 folded User Groups into Characteristics, and is deliberately gone.
    // RPA-55 reversed that merge, so userGroups renders again and a draft
    // that still holds it needs no migration at all — leaving the key alone
    // is now the correct behaviour, and running the old fold would move
    // somebody's segments into the wrong field and delete the key they came
    // from. There is no un-merge for drafts saved while the fields were one:
    // which entries had been segments was never recorded.
    // v5: RPA-55 renamed Title to Research title, and Last Updated to Last
    // updated (label only — that key was already lastUpdated).
    if (version < 5) {
      migrated.fields = Object.assign({}, migrated.fields);
      const renamedInV5 = { title: 'researchTitle' };
      Object.keys(renamedInV5).forEach((oldKey) => {
        const newKey = renamedInV5[oldKey];
        if (!Object.prototype.hasOwnProperty.call(migrated.fields, oldKey)) return;
        if (!migrated.fields[newKey]) migrated.fields[newKey] = migrated.fields[oldKey];
        delete migrated.fields[oldKey];
      });
    }
    if (version < 4) {
      migrated.fields = Object.assign({}, migrated.fields);
      const renamedInV4 = {
        researcher: 'leadResearcher',
        projectOwner: 'projectRequester',
        reportResearch: 'researchReadout',
      };
      Object.keys(renamedInV4).forEach((oldKey) => {
        const newKey = renamedInV4[oldKey];
        if (!Object.prototype.hasOwnProperty.call(migrated.fields, oldKey)) return;
        if (!migrated.fields[newKey]) migrated.fields[newKey] = migrated.fields[oldKey];
        delete migrated.fields[oldKey];
      });
    }
    return migrated;
  }

  // Replays "+ Add" clicks until the structure is as long as the draft.
  // The guard stops a malformed count from spinning forever.
  function growTo(currentCount, target, addBtn) {
    let guard = 0;
    while (addBtn && currentCount() < target && guard++ < 500) addBtn.click();
  }

  // Tables need the other direction too, now that they start with five rows
  // rather than one (RPA-76). Restoring a plan whose owner deleted a stage used
  // to hand the stage back: growTo has no way down, and no table had ever had
  // more rows on screen than in the draft. Rows come off the end, which is
  // where the surplus is — the saved rows are then restored into what is left,
  // positionally, exactly as before.
  function setRowCount(tbody, target, addBtn) {
    growTo(() => tbody.querySelectorAll('tr').length, target, addBtn);
    let guard = 0;
    while (tbody.children.length > Math.max(target, 1) && guard++ < 500) {
      tbody.lastElementChild.remove();
    }
    updateRowRemoveButtons(tbody);
  }

  function applyDraft(draft) {
    lastUpdatedManual = Boolean(draft.lastUpdatedManual);
    // Not handled in migrateDraft: that returns early for any draft already at
    // the current version, and every plan saved before RPA-76 is one. A draft
    // with no creation date falls back to savedAt — the last save rather than
    // the first, so not the answer, but a date the plan demonstrably existed
    // on. That beats stamping it with today and telling someone their
    // six-week-old plan started this morning.
    planCreatedAtExact = Boolean(draft.createdAt);
    planCreatedAt = draft.createdAt
      || (/^\d{4}-\d{2}-\d{2}/.test(String(draft.savedAt || '')) ? String(draft.savedAt).slice(0, 10) : planCreatedAt);
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
      if (!sel) {
        // Radio group. A draft saved while this was a dropdown has the same
        // shape, so it restores here with no migration.
        const radios = Array.from(cell.querySelectorAll('.radio-input'));
        radios.forEach((r) => { r.checked = false; });
        const match = radios.find((r) => r.value === snap.v);
        if (match) match.checked = true;
        const wantsOther = snap.v === '__other__';
        if (otherRow) otherRow.hidden = !wantsOther;
        if (other) other.value = snap.o || '';
        return;
      }
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
          other.value = snap.o || '';
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
      setRowCount(tbody, rows.length, addBtn);
      const trs = Array.from(tbody.querySelectorAll('tr'));
      rows.forEach((cells, i) => {
        if (!trs[i]) return;
        const tds = Array.from(trs[i].querySelectorAll('td'));
        cells.forEach((snap, j) => {
          if (!tds[j]) return;
          setCellSnapshot(tds[j], snap);
          restorePrefill(tds[j], snap);
        });
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
    // After the tables, not before: this used to run at the top of applyDraft,
    // so the restore wrote the saved (empty) cells straight over the anchors
    // and a returning plan showed no dates at all.
    applyTimelineAnchors();
    // A restored plan can hold dates that a later readout change put out of
    // range, so the rule is re-checked rather than assumed to have held.
    applyTimelineCeiling();
    applyTimelineFloor();
    // Render only after every saved timeline cell/date has been restored.
    timelineVisible = draft.ui?.timelineVisible === true;
    if (updateTimelineVisibility) updateTimelineVisibility();
    if (syncCommentsReveal) syncCommentsReveal();
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
      // The restored plan is the baseline: reopening it is not an edit, so
      // its own stored date stands until the user actually changes something.
      // Include dormant answers just as saveDraft does, so the first toggle
      // after restoring an older plan cannot look like a content change.
      lastSavedSignature = draftContentSignature(carryUnrendered(collectDraft()));
    }
  }

  // Runs after the form is built and before any draft is restored, so a saved
  // plan lands on top of the defaults rather than the other way round.
  function initPlanDefaults() {
    bindPrefillClearing(doc);
    applyTableDefaults();
    // The readout is filled long after this table renders, so the last row's
    // completion date follows it until somebody edits that cell.
    const readout = doc.querySelector('[data-field="researchReadout"]');
    if (readout) {
      readout.addEventListener('input', applyTimelineAnchors);
      readout.addEventListener('change', applyTimelineAnchors);
    }
    // After the anchors, so a mirrored date is written before it is checked.
    initTimelineCeiling();
    const readoutForCeiling = doc.querySelector('[data-field="researchReadout"]');
    if (readoutForCeiling) readoutForCeiling.addEventListener('change', applyTimelineFloor);
    // The review step drew its summary during render, before any of this
    // existed. Redraw it so the first thing a reader sees is computed from the
    // form they are actually looking at, rather than being right by accident.
    refreshReviewSummary();
  }

  // ---------- Stage Timeline ceiling (RPA-59, part one) ----------
  // No stage may finish after the readout: that date is when findings are
  // shared, so work scheduled past it cannot belong to the plan it sits in.
  //
  // The floor — nothing before the plan started — is part two and needs the
  // createdAt RPA-76 persisted. This half needs no new state at all.
  //
  // Nothing out of range is ever rewritten. The first instinct was to move a
  // cell the form still owns and flag only the ones a person had edited — but
  // the only form-owned cell that tracks anything is the last row's completion
  // date, and RPA-76's mirror already moves that before this runs. What was
  // left in that branch was the first row's start date, which holds when the
  // plan began; clamping it to a readout set earlier than that would have
  // silently claimed the plan started on a day it did not.
  //
  // So an out-of-range date is always kept and always flagged. A readout
  // before the plan started is a real problem, and saying so is more use than
  // quietly making the dates agree.
  function timelineCeiling() {
    const readout = doc.querySelector('[data-field="researchReadout"]');
    return readout && readout.value ? readout.value : '';
  }

  function ceilingMessage(ceiling) {
    return 'This is after the research readout on ' + formatDateline(ceiling)
      + '. Move it to ' + formatDateline(ceiling) + ' or earlier, or change the readout date.';
  }

  // Both columns: a stage that starts after the readout is as wrong as one
  // that ends after it.
  function applyTimelineCeiling() {
    const table = doc.querySelector('.dtbl[data-field-key="stageTimeline"]');
    if (!table) return;
    const ceiling = timelineCeiling();

    table.querySelectorAll('tbody input[type="date"]').forEach((input) => {
      // max= constrains the native picker, and is not enough on its own:
      // typed, pasted and restored values never pass through it. Everything
      // below is the fallback that actually holds the rule.
      if (ceiling) input.max = ceiling;
      else input.removeAttribute('max');

      if (!ceiling || !input.value || input.value <= ceiling) {
        if (input.dataset.ceilingFlagged) {
          delete input.dataset.ceilingFlagged;
          clearDateError(input);
        }
        return;
      }

      input.dataset.ceilingFlagged = '1';
      showDateError(input, ceilingMessage(ceiling));
    });
  }

  // ---------- Stage Timeline floor (RPA-59, part two) ----------
  // Nothing should be scheduled before the plan existed. Unlike the ceiling,
  // this one warns rather than errors, and the reason is whether the person
  // reading it can do anything.
  //
  // A date past the readout has two ways out: move the date, or move the
  // readout. A date before the plan started has neither — the start date is
  // computed and not editable — so an error would be a red box demanding an
  // action nobody can take. It is also sometimes simply correct: a plan
  // written up weeks after the work began has real stages that predate the
  // document. So it is stated, not enforced.
  function timelineFloor() {
    return planCreatedAtExact && planCreatedAt ? planCreatedAt : '';
  }

  function floorMessage(floor) {
    return 'This is before the plan was started on ' + formatDateline(floor) + '.';
  }

  // min= has to compose rather than overwrite: attachDateRangeConstraint
  // already sets it on each completion date to keep it at or after its own
  // start date. Whichever is later wins, and both still hold.
  function rowMinimumFor(input) {
    const tr = input.closest('tr');
    const dates = tr ? tr.querySelectorAll('input[type="date"]') : [];
    return dates.length === 2 && dates[1] === input ? dates[0].value || '' : '';
  }

  function applyTimelineFloor() {
    const table = doc.querySelector('.dtbl[data-field-key="stageTimeline"]');
    if (!table) return;
    const floor = timelineFloor();

    table.querySelectorAll('tbody input[type="date"]').forEach((input) => {
      const rowMin = rowMinimumFor(input);
      const effective = [floor, rowMin].filter(Boolean).sort().pop() || '';
      if (effective) input.min = effective;
      else input.removeAttribute('min');

      const note = input.closest('.date-control').querySelector('.date-note');
      if (!note) return;
      const outside = Boolean(floor && input.value && input.value < floor);
      note.textContent = outside ? floorMessage(floor) : '';
      note.hidden = !outside;
    });
  }

  function initTimelineCeiling() {
    const readout = doc.querySelector('[data-field="researchReadout"]');
    if (readout) {
      readout.addEventListener('input', applyTimelineCeiling);
      readout.addEventListener('change', applyTimelineCeiling);
    }
    // Rows are added and removed after render, and a date typed into any of
    // them has to be checked, so this listens at the field rather than wiring
    // each input as it is built.
    const table = doc.querySelector('.dtbl[data-field-key="stageTimeline"]');
    const wrap = table && table.closest('.field');
    const both = () => { applyTimelineCeiling(); applyTimelineFloor(); };
    if (wrap) {
      // After the row's own listener, which bubbles first and may have just
      // changed the minimum this reads.
      wrap.addEventListener('change', both);
      wrap.addEventListener('click', both);
    }
    both();
  }

  function initDraftPersistence() {
    restoreDraft();
    bindDraftPersistence();
  }

  function bindDraftPersistence() {
    // 'click' is included because adding or removing a row changes the
    // structure without ever firing input/change.
    doc.addEventListener('input', scheduleDraftSave);
    doc.addEventListener('change', scheduleDraftSave);
    doc.addEventListener('click', scheduleDraftSave);
  }

  // ---------- local plan backups ----------
  function backupStatus(message, error = false) {
    const status = document.getElementById('backup-status');
    status.dataset.error = String(error);
    status.textContent = message;
  }

  function backupPayload(draft) {
    return { version: DRAFT_VERSION, savedAt: new Date().toISOString(), createdAt: planCreatedAt, ...draft };
  }

  function collectBackup() {
    const draft = collectDraft();
    // Date segments have their own typing buffer. Read complete dates directly
    // without committing an edit or waiting for either debounce.
    doc.querySelectorAll('input[type="date"]').forEach((input) => {
      const segments = dateSegments(input);
      if (!segments) return;
      const parsed = readDateSegments(input);
      if (!parsed && [segments.day, segments.month, segments.year].some((part) => part.value.trim())) {
        throw new Error('Complete or clear the unfinished date before downloading a backup.');
      }
      const value = parsed ? parsed.iso : '';
      const td = input.closest('td');
      if (td) {
        const table = td.closest('table');
        const row = Array.from(table.querySelectorAll('tbody tr')).indexOf(td.parentElement);
        const column = Array.from(td.parentElement.children).indexOf(td);
        draft.tables[table.id][row][column].v = value;
      } else if (input.dataset.field) draft.fields[input.dataset.field] = value;
    });
    return backupPayload(carryUnrendered(draft));
  }

  function downloadBackup() {
    let url;
    try {
      const backup = collectBackup();
      validateBackup(backup);
      const name = (backup.fields.researchTitle || 'Untitled plan')
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
        .replace(/[. ]+$/, '') || 'Untitled plan';
      const blob = new Blob([JSON.stringify(backup, null, 2) + '\n'], { type: 'application/json' });
      if (blob.size > 15 * 1024 * 1024) throw new Error('Backups must be smaller than 15 MB.');
      url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name + ' - backup ' + todayIso() + '.json';
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); }
      backupStatus('Backup download started. Keep the JSON file to restore this plan later.');
    } catch (err) {
      backupStatus('Could not download a backup. ' + err.message, true);
    } finally {
      if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  // Validate every nested value, including dormant keys. Unknown structure is
  // rejected instead of being silently lost by the existing draft collectors.
  function validateBackup(draft) {
    const fail = (path) => { throw new Error('Invalid backup data at ' + path + '.'); };
    const record = (value, path, keys) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path);
      Object.keys(value).forEach((key) => {
        if (!/^[a-zA-Z0-9_-]+$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key)
          || (keys && !keys.includes(key))) fail(path + '.' + key);
      });
    };
    const string = (value, path) => { if (typeof value !== 'string') fail(path); };
    const array = (value, path, check) => {
      // Matches the existing row-growth guard, so no accepted import is truncated.
      if (!Array.isArray(value) || value.length > 500) fail(path + ' (maximum 500 entries)');
      value.forEach((item, i) => check(item, path + '[' + i + ']'));
    };
    const date = (value, path) => {
      string(value, path);
      if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !parseDateEntry(value))) fail(path);
    };
    const choice = (value, path) => {
      record(value, path, ['v', 'o']);
      string(value.v, path + '.v');
      if ('o' in value) string(value.o, path + '.o');
    };
    record(draft, 'plan', ['version', 'savedAt', 'createdAt', 'fields', 'selects', 'lists', 'methods', 'tables', 'custom', 'lastUpdatedManual', 'ui']);
    const version = draft.version === undefined ? 1 : draft.version;
    if (!Number.isInteger(version) || version < 1 || version > DRAFT_VERSION) {
      throw new Error('Unsupported backup version. This app supports versions 1 to ' + DRAFT_VERSION + '.');
    }
    record(draft.fields, 'fields');
    if ('createdAt' in draft) { date(draft.createdAt, 'createdAt'); if (!draft.createdAt) fail('createdAt'); }
    if ('savedAt' in draft) {
      string(draft.savedAt, 'savedAt');
      if (!/^\d{4}-\d{2}-\d{2}T/.test(draft.savedAt) || !Number.isFinite(Date.parse(draft.savedAt))) fail('savedAt');
      date(draft.savedAt.slice(0, 10), 'savedAt');
    }
    if ('lastUpdatedManual' in draft && typeof draft.lastUpdatedManual !== 'boolean') fail('lastUpdatedManual');
    if ('ui' in draft) {
      record(draft.ui, 'ui', ['timelineVisible']);
      if ('timelineVisible' in draft.ui && typeof draft.ui.timelineVisible !== 'boolean') fail('ui.timelineVisible');
    }
    ['fields', 'selects', 'lists', 'tables', 'custom'].forEach((section) => {
      if (!(section in draft)) return;
      record(draft[section], section);
      Object.entries(draft[section]).forEach(([key, value]) => {
        const path = section + '.' + key;
        if (section === 'fields') string(value, path);
        if (section === 'selects') choice(value, path);
        if (section === 'lists') array(value, path, string);
        if (section === 'custom') array(value, path, (block, blockPath) => {
          record(block, blockPath, ['label', 'body']);
          string(block.label, blockPath + '.label');
          string(block.body, blockPath + '.body');
        });
        if (section === 'tables') array(value, path, (row, rowPath) => array(row, rowPath, (cell, cellPath) => {
          record(cell, cellPath, ['t', 'v', 'o', 'n', 'd']);
          if (!['text', 'date', 'sel', 'select', 'file'].includes(cell.t)) fail(cellPath + '.t');
          string(cell.v, cellPath + '.v');
          if ('d' in cell && cell.d !== 1) fail(cellPath + '.d');
          if ('o' in cell) { if (cell.t !== 'select') fail(cellPath + '.o'); string(cell.o, cellPath + '.o'); }
          if ('n' in cell) { if (cell.t !== 'file') fail(cellPath + '.n'); string(cell.n, cellPath + '.n'); }
          if (cell.t === 'date') date(cell.v, cellPath + '.v');
          if (cell.t === 'file' && !('n' in cell)) fail(cellPath + '.n');
        }));
      });
    });
    if ('methods' in draft) array(draft.methods, 'methods', (group, path) => {
      record(group, path, ['question', 'methods']);
      string(group.question, path + '.question');
      array(group.methods, path + '.methods', string);
    });
    const renames = version < 5 ? { title: 'researchTitle' } : {};
    if (version < 4) Object.assign(renames, { researcher: 'leadResearcher', projectOwner: 'projectRequester', reportResearch: 'researchReadout' });
    if (version < 3) renames.problem = 'problemStatement';
    Object.entries(renames).forEach(([oldKey, newKey]) => {
      if (draft.fields[oldKey] && draft.fields[newKey] && draft.fields[oldKey] !== draft.fields[newKey]) fail('fields.' + oldKey + ' (conflicting legacy value)');
    });
    if (version < 2 && draft.methods?.length) fail('methods (version 1 uses lists.methods)');
    if (version >= 2 && draft.lists?.methods) fail('lists.methods (use grouped methods)');
    return migrateDraft(draft);
  }

  function planHasBackupContent() {
    // Check actual controls as well as snapshots: unfinished date segments and
    // unsaved writing need protection too. Ignore the generated dateline.
    if (lastUpdatedManual) return true;
    const header = doc.querySelector('.doc-header').cloneNode(true);
    header.querySelector('.dateline')?.remove();
    if (fieldHasContent(header) || Array.from(doc.querySelectorAll('.field')).some(fieldHasContent)) return true;
    const live = collectDraft();
    const complete = carryUnrendered(collectDraft());
    const hasValue = (value) => {
      if (typeof value === 'string') return !!value.trim();
      if (Array.isArray(value)) return value.some(hasValue);
      if (!value || typeof value !== 'object' || value.d === 1) return false;
      if ('t' in value) return hasValue(value.v) || hasValue(value.o);
      return Object.values(value).some(hasValue);
    };
    return ['fields', 'selects', 'lists', 'tables', 'custom'].some((section) =>
      Object.keys(complete[section]).some((key) => !(key in live[section]) && hasValue(complete[section][key])));
  }

  // Compare what the supplied draft actually restored. This catches valid JSON
  // with values the present controls cannot represent (unknown options, wrong
  // cell types, extra columns, orphaned Methods, and single-line text loss).
  function verifyBackupRestoration(expected, actual) {
    const fail = (path) => { throw new Error('This backup cannot be restored faithfully at ' + path + '.'); };
    const equal = (a, b, path) => { if (a !== b) fail(path); };
    ['fields', 'selects', 'lists', 'custom', 'tables'].forEach((section) => {
      Object.entries(expected[section] || {}).forEach(([key, value]) => {
        if (!(key in actual[section])) return; // A legitimate dormant key is carried unchanged.
        const restored = actual[section][key];
        const path = section + '.' + key;
        if (section === 'fields') equal(value, restored, path);
        if (section === 'selects') {
          equal(value.v, restored.v, path);
          equal(value.o || '', restored.o || '', path + '.o');
        }
        if (section === 'lists') {
          if (value.length > restored.length || (value.length && value.length !== restored.length)) fail(path);
          value.forEach((entry, i) => equal(entry, restored[i], path + '[' + i + ']'));
        }
        if (section === 'custom') {
          equal(value.length, restored.length, path);
          value.forEach((block, i) => {
            equal(block.label, restored[i].label, path + '[' + i + '].label');
            equal(block.body, restored[i].body, path + '[' + i + '].body');
          });
        }
        if (section === 'tables') {
          equal(value.length, restored.length, path);
          value.forEach((row, i) => {
            equal(row.length, restored[i].length, path + '[' + i + ']');
            row.forEach((cell, j) => {
              const saved = restored[i][j];
              equal(cell.t, saved.t, path);
              // Existing migration/default behaviour may supply a missing date anchor.
              if (cell.v || cell.t !== 'date') equal(cell.v, saved.v, path);
              ['o', 'n'].forEach((part) => equal(cell[part] || '', saved[part] || '', path + '.' + part));
              equal(cell.d, saved.d, path + '.d');
            });
          });
        }
      });
    });
    (expected.methods || []).forEach((group, i) => {
      if (!actual.methods[i]) fail('methods[' + i + ']');
      const values = actual.methods[i].methods;
      if (group.methods.length && group.methods.length !== values.length) fail('methods[' + i + ']');
      group.methods.forEach((value, j) => equal(value, values[j], 'methods[' + i + '].methods[' + j + ']'));
    });
  }

  function replacePlanFromBackup(draft) {
    const store = draftStore();
    if (!store) throw new Error('Browser storage is unavailable. The current plan has been kept; allow storage and try again.');
    // Keep the original nodes and closures, including feedback, focus and any
    // unsaved text. A failed rebuild never has to reconstruct the original.
    const original = { doc, formEvents, tables: tables.slice(), timelineVisible, updateTimelineVisibility,
      syncCommentsReveal, planCreatedAt, lastUpdatedManual, refreshDateline, refreshReviewSummary,
      methodsSuggestRefresh, fields: new Map(evaluationFields), batches: new Map(evaluationBatches),
      focus: document.activeElement, signature: lastSavedSignature, recoveredDraft };
    const replacement = doc.cloneNode(false);
    const replacementEvents = new AbortController();
    draftRestoring = true;
    try {
      original.doc.replaceWith(replacement);
      doc = replacement;
      formEvents = replacementEvents;
      evaluationFields.clear();
      evaluationBatches.clear();
      timelineVisible = false;
      lastUpdatedManual = false;
      planCreatedAtExact = Boolean(draft.createdAt);
      planCreatedAt = draft.createdAt || draft.savedAt?.slice(0, 10) || todayIso();
      renderSchema(formSchema);
      initTextareas(doc);
      initStatusSelects(doc);
      initAccordion();
      initPlanDefaults();
      initDeadlineConstraints();
      initOutcomesSync();
      initMethodsGroupsSync();
      applyDraft(draft);
      const rendered = collectDraft();
      verifyBackupRestoration(draft, rendered);
      const complete = carryUnrendered(rendered, draft);
      const payload = backupPayload(complete);
      const signature = draftContentSignature(complete);
      const serialised = JSON.stringify(payload);
      bindDraftPersistence();
      // The only storage write is the commit point. setItem is atomic on error;
      // all fallible rendering/validation happened before touching the old draft.
      try { store.setItem(DRAFT_KEY, serialised); } catch (err) {
        throw new Error('The restored plan could not be saved in browser storage. ' + err.message);
      }
      recoveredDraft = payload;
      lastSavedSignature = signature;
    } catch (err) {
      replacementEvents.abort();
      if (replacement.isConnected) replacement.replaceWith(original.doc);
      ({ doc, formEvents, timelineVisible, updateTimelineVisibility, syncCommentsReveal, planCreatedAt,
        lastUpdatedManual, refreshDateline, refreshReviewSummary, methodsSuggestRefresh, recoveredDraft } = original);
      tables.splice(0, tables.length, ...original.tables);
      evaluationFields.clear(); original.fields.forEach((value, key) => evaluationFields.set(key, value));
      evaluationBatches.clear(); original.batches.forEach((value, key) => evaluationBatches.set(key, value));
      lastSavedSignature = original.signature;
      if (original.focus?.isConnected) original.focus.focus();
      throw err;
    } finally {
      draftRestoring = false;
    }
    // There is no async gap during replacement. Pending saves cannot run until
    // this commit finishes; cancellation and invalid files leave them intact.
    if (draftTimer) window.clearTimeout(draftTimer);
    draftTimer = null;
    original.formEvents.abort();
    resetEvaluationWork();
  }

  function readBackupFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('The selected file could not be read.'));
      reader.onabort = () => reject(new Error('Reading the selected file was cancelled.'));
      reader.readAsText(file);
    });
  }

  function initBackupControls() {
    const download = document.getElementById('download-backup-btn');
    const restore = document.getElementById('restore-backup-btn');
    const picker = document.getElementById('backup-file');
    download.disabled = false;
    restore.disabled = false;
    download.addEventListener('click', downloadBackup);
    restore.addEventListener('click', () => { picker.value = ''; picker.click(); });
    picker.addEventListener('change', async () => {
      const file = picker.files[0];
      if (!file) return;
      const initialDoc = doc;
      restore.disabled = true;
      restore.setAttribute('aria-busy', 'true');
      backupStatus('Reading backup…');
      try {
        // Bound memory use for accidental non-backup files; no content is uploaded.
        if (file.size > 15 * 1024 * 1024) throw new Error('Choose a JSON backup smaller than 15 MB.');
        const text = await readBackupFile(file);
        let parsed;
        try { parsed = JSON.parse(text); } catch (err) { throw new Error('The file is not valid JSON. Choose a downloaded plan backup.'); }
        const draft = validateBackup(parsed);
        if (planHasBackupContent() && !window.confirm('Replace the current plan with this backup? Unsaved writing and hidden saved fields will be replaced. Download a backup of the current plan first if you want to keep it.')) {
          backupStatus('Restore cancelled. The current plan has been kept.');
          return;
        }
        replacePlanFromBackup(draft);
        backupStatus('Backup restored and saved in this browser. Evaluation results are not included in backups.');
      } catch (err) {
        backupStatus('Could not restore the backup. The current plan has been kept. ' + err.message, true);
      } finally {
        picker.value = ''; // Selecting the same file again must still fire change.
        restore.disabled = false;
        restore.setAttribute('aria-busy', 'false');
        if (doc !== initialDoc) restore.focus();
      }
    });
  }

  function clearForm() {
    if (!window.confirm('Reset all fields? This cannot be undone.')) return;
    resetEvaluationWork();
    clearDraft();
    lastSavedSignature = null;
    lastUpdatedManual = false;
    timelineVisible = false;
    if (updateTimelineVisibility) updateTimelineVisibility();
    doc.querySelectorAll('input[type="text"]').forEach((el) => { el.value = ''; });
    doc.querySelectorAll('input[type="date"]').forEach((el) => { setDateInputValue(el, ''); });
    doc.querySelectorAll('textarea').forEach((el) => {
      el.value = '';
      resizeTa(el);
    });
    // Radios are neither text inputs nor textareas, so the loops above miss
    // them: a Sample Size chosen before the reset stayed selected and was
    // saved into the next plan (found by Max reviewing PR #22). Their "Other"
    // reveal is closed with them.
    doc.querySelectorAll('.radio-input').forEach((el) => { el.checked = false; });
    doc.querySelectorAll('.radio-group .select-other-row').forEach((row) => { row.hidden = true; });

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
      cell.dataset.fileName = 'No file chosen';
      renderFileReference(cell);
    });

    doc.querySelectorAll('.eval-panel').forEach((p) => { p.hidden = true; });
    doc.querySelectorAll('.eval-controls').forEach((controls) => {
      if (typeof controls._resetEvaluation === 'function') controls._resetEvaluation();
    });
    doc.querySelectorAll('.ex-panel').forEach((p) => { p.hidden = true; });
    doc.querySelectorAll('.ex-toggle').forEach((t) => { t.textContent = 'Show example'; });
    // Runs after the date inputs above have been blanked: a reset plan is a
    // new plan, and a new plan is dated today just like a freshly rendered one.
    setLastUpdatedToday();
    // Same argument for the timeline: a reset plan was started today, and gets
    // the stages back. The loops above stripped the marks along with the
    // values, so this re-applies both.
    planCreatedAt = todayIso();
    planCreatedAtExact = true;
    // Adding the rows back clicks the add button, and a click schedules a
    // save. Reset deliberately leaves no draft behind until the next real
    // edit, so this must not be the edit that resurrects one.
    withoutDraftSave(applyTableDefaults);
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
      const head = acc.querySelector('.acc-head');
      if (head) setAccOpen(head, true);
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

    resetEvaluationWork();
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
      'start the app with its Node server and open the address it reports.';
    doc.appendChild(msg);
    console.error('Failed to load field schema:', err);
  }

  document.addEventListener('DOMContentLoaded', () => {
    getConfig();
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
        formSchema = schema;
        renderSchema(schema);
        initTextareas(doc);
        initStatusSelects(doc);
        initAccordion();
        initPlanDefaults();
        initDeadlineConstraints();
        initOutcomesSync();
        initMethodsGroupsSync();
        initTestProfileControls();
        initDraftPersistence();
        initBackupControls();
        document.getElementById('clear-btn').addEventListener('click', clearForm);
        document.getElementById('print-btn').addEventListener('click', () => window.print());
      })
      .catch(showLoadError);
  });
})();
