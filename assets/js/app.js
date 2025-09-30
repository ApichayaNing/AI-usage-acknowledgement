(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const toast = (msg) => {
    const el = $('#toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1800);
  };
  const CFG = window.APP_CONFIG || {};

  // ========= BEHAVIOUR-FIRST MAPPING =========
  // Map of behaviourId -> Set(tools)
  const BehTools = new Map();

  function normaliseToolFree(s){
    return (s||'').trim()
      .replace(/\s+/g,' ')
      .replace(/^chat ?gpt$/i,'ChatGPT')
      .replace(/^copilot$/i,'Microsoft Copilot');
  }

  // Render the behaviours list where each ticked behaviour reveals its own tools panel
  function renderBehaviours(){
    const host = $('#behaviourPills');
    if (!host || !CFG.behaviours) return;
    host.innerHTML = '';

    CFG.behaviours.forEach(opt=>{
      const wrap = document.createElement('div');
      wrap.className = 'beh-item';

      // checkbox pill
      const lbl = document.createElement('label');
      lbl.className = 'pill';
      lbl.innerHTML = `<input type="checkbox" value="${opt.id}"> <span>${opt.label}</span>`;
      wrap.appendChild(lbl);

      // sub-panel (tools for this behaviour)
      const panel = document.createElement('div');
      panel.className = 'beh-tools';
      panel.innerHTML = `
        <div class="tool-row">
          <input type="text" class="input tool-input" placeholder="Type or pick a tool, then click Add" list="tool-suggestions" aria-label="Tool name">
          <button type="button" class="btn btn-xxs add-tool">Add</button>
        </div>
        <div class="tool-chips"></div>
      `;
      wrap.appendChild(panel);

      // checkbox toggle → show/hide; init/clear map entry
      const cb = lbl.querySelector('input');
      cb.addEventListener('change', ()=>{
        if (cb.checked){
          panel.classList.add('show');
          if (!BehTools.has(opt.id)) BehTools.set(opt.id, new Set());
        } else {
          panel.classList.remove('show');
          BehTools.delete(opt.id);  // unselect clears its tools (simple rule)
          renderToolChips(panel, opt.id);
        }
      });

      // add tool
      const addBtn = panel.querySelector('.add-tool');
      const inp = panel.querySelector('.tool-input');
      addBtn.addEventListener('click', ()=>{
        const v = normaliseToolFree(inp.value);
        if (!v) { toast('Enter a tool'); return; }
        if (!BehTools.has(opt.id)) BehTools.set(opt.id, new Set());
        BehTools.get(opt.id).add(v);
        inp.value = '';
        renderToolChips(panel, opt.id);
      });
      inp.addEventListener('keydown', (e)=>{
        if (e.key === 'Enter'){ e.preventDefault(); addBtn.click(); }
      });

      host.appendChild(wrap);
    });

    ensureToolDatalist();
  }

  function renderToolChips(panel, behId){
    const chips = panel.querySelector('.tool-chips');
    chips.innerHTML = '';
    const set = BehTools.get(behId) || new Set();
    [...set].forEach(tool=>{
      const span = document.createElement('span');
      span.className = 'chip';
      span.innerHTML = `${tool} <button aria-label="Remove ${tool}">×</button>`;
      span.querySelector('button').addEventListener('click', ()=>{
        set.delete(tool);
        renderToolChips(panel, behId);
      });
      chips.appendChild(span);
    });
  }

  function ensureToolDatalist(){
    if (document.getElementById('tool-suggestions')) return;
    const dl = document.createElement('datalist');
    dl.id = 'tool-suggestions';
    dl.innerHTML = [
      'ChatGPT','Microsoft Copilot','Perplexity','Grammarly','QuillBot','Claude','Bing Copilot','DeepSeek'
    ].map(t=>`<option value="${t}">`).join('');
    document.body.appendChild(dl);
  }

  // ========= LEGACY INPUTS (kept but de-emphasised) =========
  // If you still keep the free-text tools input (#toolsText), we’ll normalise & de-dupe it and union with mapping tools for copy convenience.
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
    return titleCase(s);
  }
  function toolsArray() {
    const canon = toolsArrayRaw().map(canonicalToolName);
    return [...new Set(canon)];
  }

  // ========= CONTEXT / UTILS =========
  function getContext() {
    try {
      return {
        site: location.hostname || '',
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        tz_offset_min: (new Date().getTimezoneOffset() * -1)
      };
    } catch { return { site: '', tz: '', tz_offset_min: 0 }; }
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

  // ========= COMPUTED TEXTS FROM MAPPING =========
  function selectedBehavioursFromMap(){
    return [...BehTools.keys()];
  }

  function toolsFromMap(){
    const all = new Set();
    BehTools.forEach(set => set.forEach(t => all.add(t)));
    return [...all];
  }

  function behavioursText(){
    return behaviourLabels(selectedBehavioursFromMap()).join(', ');
  }

  function toolsText(){
    // union of tools manually typed (if any) and tools from mapping
    const fromPairs = toolsFromMap();
    const typed = toolsArray();
    return [...new Set([...typed, ...fromPairs])].join(', ');
  }

  // tool — behaviours; … (group by tool)
  function mappingText(){
    const toolToBehs = new Map();
    BehTools.forEach((set, behId)=>{
      const behLabel = behaviourLabels([behId])[0];
      set.forEach(tool=>{
        const arr = toolToBehs.get(tool) || [];
        arr.push(behLabel);
        toolToBehs.set(tool, arr);
      });
    });
    const parts = [];
    toolToBehs.forEach((behs, tool)=>{
      parts.push(`${tool} — ${[...new Set(behs)].join('; ')}`);
    });
    return parts.join(' | ');
  }

  function otherNotesText(){
    return ($('#otherDetails')?.value || '').trim();
  }

  function copyToClipboard(str, ok = 'Copied'){
    if (!str) { toast('Nothing to copy'); return; }
    navigator.clipboard.writeText(str).then(()=>toast(ok)).catch(()=>toast('Copy failed'));
  }

  // ========= STATEMENT =========
  function buildStatement(){
    const tools = toolsFromMap();
    const behs = behaviourLabels(selectedBehavioursFromMap());
    const note = otherNotesText();
    const toolsTxt = humanise(tools);
    const behTxt = humanise(behs);
    const base = `I used ${toolsTxt || '[tool]'} to support ${behTxt || '[behaviour]'} while preparing this assessment. I critically reviewed and edited all outputs, and the final submission represents my own understanding, analysis and writing.`;
    const spec = mappingText() ? ` Specifically, I used ${mappingText().replace(/\|/g,'; ')}.` : '';
    const privacy = ` No personal data or full assignment text was provided to AI systems beyond what is disclosed here.`;
    const extra = note ? ` ${note}` : '';
    return base + spec + privacy + extra;
  }

  // ========= VALIDATION =========
  function validate(){
    const errs = [];
    const hasPair = [...BehTools.values()].some(set => set.size > 0);
    if (!hasPair) errs.push('Add at least one tool under a behaviour.');
    return errs;
  }

  // ========= (Optional) ANALYTICS PAYLOAD (kept for future) =========
  function buildPayload(){
    const ctx = getContext();
    const payload = {
      v: (CFG.payloadVersion ?? 1),
      ts: new Date().toISOString(),
      behaviours: selectedBehavioursFromMap(),
      tools: toolsFromMap(),
      note: otherNotesText(),
      action: (CFG.analyticsAction || 'declaration_generated'),
      site: ctx.site,
      tz: ctx.tz,
      tz_offset_min: ctx.tz_offset_min
    };
    const json = JSON.stringify(payload);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return { json, b64 };
  }

  // ========= UI HANDLERS =========
  function onGenerate(){
    const errs = validate();
    const errBox = $('#errors');
    const out = $('#statementText');
    if (errs.length){
      if (errBox) errBox.textContent = errs.join(' ');
      if (out) out.textContent = '––';
      return;
    }
    if (errBox) errBox.textContent = '';
    if (out) out.textContent = buildStatement();
    toast('Statement generated');
  }

  function onCopyStatement(){
    const out = $('#statementText');
    const text = (out?.textContent || '');
    if (!text || text === '––'){ toast('Nothing to copy'); return; }
    navigator.clipboard.writeText(text).then(()=>toast('Statement copied')).catch(()=>{
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Statement copied'); } catch { toast('Copy failed'); }
      finally { ta.remove(); }
    });
  }

  let lastPayload = null;
  function onBuildPayload(){
    const errs = validate();
    const errBox = $('#errors');
    if (errs.length){
      if (errBox) errBox.textContent = errs.join(' ');
      toast('Fix issues before building code');
      return;
    }
    if (errBox) errBox.textContent = '';
    lastPayload = buildPayload();
    const payloadEl = $('#payloadText');
    if (payloadEl) payloadEl.textContent = lastPayload.b64;
    const wrap = $('#payloadWrap'); if (wrap) wrap.style.display = 'block';
    const copyBtn = $('#copyPayloadBtn'); if (copyBtn) copyBtn.disabled = false;
    toast('Anonymous code ready');
  }

  function onCopyPayload(){
    if (!lastPayload){ toast('Build the code first'); return; }
    navigator.clipboard.writeText(lastPayload.b64)
      .then(()=>toast('Anonymous code copied'))
      .catch(()=>toast('Copy failed'));
  }

  function onGoToForm(){
    $('#formsSection')?.scrollIntoView({behavior:'smooth', block:'start'});
  }

  function toggleOther(){
    const el = $('#behOtherText');
    const chk = $('#behOtherChk');
    if (el && chk) el.style.display = chk.checked ? 'block' : 'none';
  }

  // ========= INIT =========
  function init(){
    renderBehaviours();

    // Load Forms iframe from config
    if (CFG.formsEmbedUrl && CFG.formsEmbedUrl.startsWith('http')){
      const frame = $('#formsFrame');
      if (frame) frame.src = CFG.formsEmbedUrl;
    }

    // Same-tab fallback link
    const link = $('#openFormSameTab');
    if (link){
      link.addEventListener('click', (e)=>{
        e.preventDefault();
        const url = CFG.formsShareUrl || (CFG.formsEmbedUrl ? CFG.formsEmbedUrl.replace('&embed=true','') : '');
        if (url) window.location.assign(url);
      });
    }

    // Buttons
    $('#generateBtn')?.addEventListener('click', onGenerate);
    $('#copyStmtBtn')?.addEventListener('click', onCopyStatement);
    $('#printBtn')?.addEventListener('click', () => window.print());

    // Copy buttons matching the Form fields
    $('#copyMapMicro')?.addEventListener('click', ()=>{
      const txt = mappingText();
      if (!txt){ toast('Add at least one tool under a behaviour'); return; }
      copyToClipboard(txt, 'Usage mapping copied');
    });
    $('#copyBehMicro')?.addEventListener('click', ()=>{
      const txt = behavioursText();
      if (!txt){ toast('Select behaviours and add tools'); return; }
      copyToClipboard(txt, 'Behaviours copied');
    });
    $('#copyToolsMicro')?.addEventListener('click', ()=>{
      const txt = toolsText();
      if (!txt){ toast('Add a tool'); return; }
      copyToClipboard(txt, 'Tools copied');
    });
    $('#copyNoteMicro')?.addEventListener('click', ()=>{
      const txt = otherNotesText();
      if (!txt){ toast('No notes to copy'); return; }
      copyToClipboard(txt, 'Other notes copied');
    });

    // Legacy anonymous-code buttons (optional)
    $('#buildPayloadBtn')?.addEventListener('click', onBuildPayload);
    $('#copyPayloadBtn')?.addEventListener('click', onCopyPayload);

    $('#toFormBtn')?.addEventListener('click', onGoToForm);
    $('#behOtherChk')?.addEventListener('change', toggleOther);

    // Optional spinner ‘loaded’ class
    const fs = document.getElementById('formsSection');
    const iframe = document.getElementById('formsFrame');
    if (iframe && fs) iframe.addEventListener('load', () => fs.classList.add('loaded'));

    // Footer year
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  }

  init();
})();
