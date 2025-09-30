(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const toast = (msg) => {
    const el = $('#toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1800);
  };
  const CFG = window.APP_CONFIG || {};

  // ===== Render behaviour chips =====
  function renderBehaviours() {
    const host = $('#behaviourPills');
    if (!host || !CFG.behaviours) return;
    host.innerHTML = '';
    CFG.behaviours.forEach(opt => {
      const lbl = document.createElement('label');
      lbl.className = 'pill';
      lbl.innerHTML = `<input type="checkbox" value="${opt.id}"> <span>${opt.label}</span>`;
      host.appendChild(lbl);
    });
  }

  // ===== Helpers =====
  function selectedBehaviours() {
    const ids = $$('#behaviourPills input:checked').map(i => i.value);
    const otherChk = $('#behOtherChk');
    if (otherChk && otherChk.checked) {
      const extraEl = $('#behOtherText');
      const extra = (extraEl?.value || '').trim();
      if (extra) ids.push(...extra.split(',').map(s => s.trim()).filter(Boolean));
    }
    return ids;
  }

  // --- Tool normalisation & de-dupe ---
  function toolsArrayRaw() {
    const input = $('#toolsText');
    const raw = (input?.value || '').trim();
    return raw ? raw.split(/[,;]+/).map(s => s.trim()).filter(Boolean) : [];
  }
  function titleCase(s) { return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }
  function canonicalToolName(s) {
    const t = s.trim().toLowerCase();
    if (/^chat\s*gpt|^chatgpt\b/.test(t)) return 'ChatGPT';
    if (/^(ms|microsoft)\s*copilot$|^copilot$/.test(t)) return 'Microsoft Copilot';
    if (/^bing(\s*copilot)?$/.test(t)) return 'Bing Copilot';
    if (/^grammarly\b/.test(t)) return 'Grammarly';
    if (/^quill\s*bot$|^quillbot$/.test(t)) return 'QuillBot';
    if (/^claude\b/.test(t)) return 'Claude';
    if (/^deepseek\b/.test(t)) return 'DeepSeek';
    return titleCase(s); // sensible default
  }
  function toolsArray() {
    const canon = toolsArrayRaw().map(canonicalToolName);
    return [...new Set(canon)];
  }

  // Context (site + timezone)
  function getContext() {
    try {
      return {
        site: location.hostname || '',
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        tz_offset_min: (new Date().getTimezoneOffset() * -1) // minutes from UTC
      };
    } catch {
      return { site: '', tz: '', tz_offset_min: 0 };
    }
  }

  const humanise = (arr) => {
    if (!arr || !arr.length) return '';
    if (arr.length === 1) return arr[0];
    const last = arr[arr.length - 1];
    return arr.slice(0, -1).join(', ') + ' and ' + last;
  };

  function behaviourLabels(ids) {
    const map = Object.fromEntries((CFG.behaviours || []).map(o => [o.id, o.label.split('(')[0].trim()]));
    return ids.map(x => map[x] || x);
  }

  // ===== Plain-text for Microsoft Form (one-click copies) =====
  function behavioursText() { return behaviourLabels(selectedBehaviours()).join(', '); }
  function toolsText() { return toolsArray().join(', '); }

  // Simple, readable mapping: each tool -> all selected behaviours
  // Example: "ChatGPT — brainstorming; structuring | Grammarly — editing"
  function mappingText() {
    const behs = behaviourLabels(selectedBehaviours());
    const tools = toolsArray();
    if (!behs.length || !tools.length) return '';
    const behJoined = behs.join('; ');
    return tools.map(t => `${t} — ${behJoined}`).join(' | ');
  }

  function otherNotesText() {
    return ($('#otherDetails')?.value || '').trim();
  }

  function copyToClipboard(str, ok = 'Copied') {
    if (!str) { toast('Nothing to copy'); return; }
    navigator.clipboard?.writeText(str)
      .then(() => toast(ok))
      .catch(() => toast('Copy failed'));
  }

  // ===== Build statement (single, standard style) =====
  function buildStatement(tools, behs, note) {
    const toolsTxt = humanise(tools);
    const behTxt = humanise(behaviourLabels(behs));
    const base = `I used ${toolsTxt || '[tool]'} to support ${behTxt || '[behaviour]'} while preparing this assessment. I critically reviewed and edited all outputs, and the final submission represents my own understanding, analysis and writing.`;
    const privacy = ` No personal data or full assignment text was provided to AI systems beyond what is disclosed here.`;
    const extra = note ? ` ${note.trim()}` : '';
    return base + privacy + extra;
  }

  // ===== Validation =====
  function validate() {
    const errs = [];
    if (selectedBehaviours().length === 0) errs.push('Select at least one behaviour.');
    if (toolsArray().length === 0) errs.push('Enter at least one AI tool (comma-separated).');
    return errs;
  }

  // ===== Analytics payload (BASE64-JSON) – kept for future use =====
  function buildPayload() {
    const ctx = getContext();
    const payload = {
      v: (CFG.payloadVersion ?? 1),
      ts: new Date().toISOString(),
      behaviours: selectedBehaviours(),
      tools: toolsArray(), // normalised + deduped
      note: ($('#otherDetails')?.value || '').trim(),
      action: (CFG.analyticsAction || 'declaration_generated'),
      site: ctx.site,
      tz: ctx.tz,
      tz_offset_min: ctx.tz_offset_min
    };
    const json = JSON.stringify(payload);
    const b64 = btoa(unescape(encodeURIComponent(json))); // base64-utf8
    return { json, b64 };
  }

  // ===== UI events =====
  function onGenerate() {
    const errs = validate();
    const errBox = $('#errors');
    const out = $('#statementText');
    if (errs.length) {
      if (errBox) errBox.textContent = errs.join(' ');
      if (out) out.textContent = '––';
      return;
    }
    if (errBox) errBox.textContent = '';
    const stmt = buildStatement(toolsArray(), selectedBehaviours(), $('#otherDetails')?.value);
    if (out) out.textContent = stmt;
    toast('Statement generated');
  }

  function onCopyStatement() {
    const out = $('#statementText');
    const text = (out?.textContent || '');
    if (!text || text === '––') { toast('Nothing to copy'); return; }
    navigator.clipboard?.writeText(text).then(() => toast('Statement copied')).catch(() => {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Statement copied'); } catch { toast('Copy failed'); }
      finally { ta.remove(); }
    });
  }

  let lastPayload = null;
  function onBuildPayload() {
    const errs = validate();
    const errBox = $('#errors');
    if (errs.length) {
      if (errBox) errBox.textContent = errs.join(' ');
      toast('Fix issues before building code');
      return;
    }
    if (errBox) errBox.textContent = '';
    lastPayload = buildPayload();
    const payloadEl = $('#payloadText');
    if (payloadEl) payloadEl.textContent = lastPayload.b64; // minimal (no debug JSON)
    const wrap = $('#payloadWrap'); if (wrap) wrap.style.display = 'block';
    const copyBtn = $('#copyPayloadBtn'); if (copyBtn) copyBtn.disabled = false;
    toast('Anonymous code ready');
  }

  function onCopyPayload() {
    if (!lastPayload) { toast('Build the code first'); return; }
    navigator.clipboard?.writeText(lastPayload.b64).then(() => toast('Anonymous code copied')).catch(() => toast('Copy failed'));
  }

  function onGoToForm() {
    const section = $('#formsSection');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toggleOther() {
    const el = $('#behOtherText');
    const chk = $('#behOtherChk');
    if (el && chk) el.style.display = chk.checked ? 'block' : 'none';
  }

  // ===== Init =====
  function init() {
    renderBehaviours();

    // Load the iframe from config (embed)
    if (CFG.formsEmbedUrl && CFG.formsEmbedUrl.startsWith('http')) {
      const frame = $('#formsFrame');
      if (frame) frame.src = CFG.formsEmbedUrl;
    }

    // Same-tab fallback link
    const link = $('#openFormSameTab');
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const url = CFG.formsShareUrl || (CFG.formsEmbedUrl ? CFG.formsEmbedUrl.replace('&embed=true', '') : '');
        if (url) window.location.assign(url); // SAME tab
      });
    }

    // Buttons / interactions (guard for missing elements)
    $('#generateBtn')?.addEventListener('click', onGenerate);
    $('#copyStmtBtn')?.addEventListener('click', onCopyStatement);
    $('#printBtn')?.addEventListener('click', () => window.print());

    // Micro buttons matching the Microsoft Form fields
    $('#copyMapMicro')?.addEventListener('click', () => {
      const txt = mappingText();
      if (!txt) { toast('Add behaviours and tools first'); return; }
      copyToClipboard(txt, 'Usage mapping copied');
    });
    $('#copyBehMicro')?.addEventListener('click', () => {
      const txt = behavioursText();
      if (!txt) { toast('Select at least one behaviour'); return; }
      copyToClipboard(txt, 'Behaviours copied');
    });
    $('#copyToolsMicro')?.addEventListener('click', () => {
      const txt = toolsText();
      if (!txt) { toast('Enter at least one tool'); return; }
      copyToClipboard(txt, 'Tools copied');
    });
    $('#copyNoteMicro')?.addEventListener('click', () => {
      const txt = otherNotesText();
      if (!txt) { toast('No notes to copy'); return; }
      copyToClipboard(txt, 'Other notes copied');
    });

    // Optional big button for notes (keep if present in HTML)
    $('#copyNoteBtn')?.addEventListener('click', () => {
      const txt = otherNotesText();
      if (!txt) { toast('No notes to copy'); return; }
      copyToClipboard(txt, 'Other notes copied');
    });

    // Legacy anonymous-code buttons (can be hidden in UI if unused)
    $('#buildPayloadBtn')?.addEventListener('click', onBuildPayload);
    $('#copyPayloadBtn')?.addEventListener('click', onCopyPayload);

    $('#toFormBtn')?.addEventListener('click', onGoToForm);
    $('#behOtherChk')?.addEventListener('change', toggleOther);

    // Footer year
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  }

  init();
})();
