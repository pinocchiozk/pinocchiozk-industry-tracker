/* ============================================================
 * app.js -- 产业跟踪工作台 · 全部视图 / 路由 / 表单 / 画布
 * ============================================================ */
(function () {
  "use strict";

  // ============================================================
  // 状态 & 持久化
  // ============================================================
  const App = {
    state: {
      viewStack: [{ name: "home" }],
      data: ST.loadData(),
      expanded: new Set(),
    },
    save() {
      ST.saveData(this.state.data);
      if (this.sync && typeof this.sync.scheduleAutoPush === 'function') {
        this.sync.scheduleAutoPush();
      }
    },
    currentView() { return this.state.viewStack[this.state.viewStack.length - 1]; },
    activeProject() {
      return ST.findProject(this.state.data, this.state.data.activeProjectId) || this.state.data.projects[0];
    },
    activeDate() { return this.state.data.activeDate; },
    setActiveDate(d) {
      this.state.data.activeDate = d;
      this.save();
      this.renderTimeline();
      this.renderView();
    },
  };

  // ============================================================
  // 导航
  // ============================================================
  App.navigate = function (view) {
    this.state.viewStack.push(view);
    this.renderHeader();
    this.renderView();
  };
  App.back = function () {
    if (this.state.viewStack.length > 1) {
      this.state.viewStack.pop();
      this.renderHeader();
      this.renderView();
    }
  };
  // ---------- 主页层级展开状态 ----------
  App.expKey = function (date, sectorId, subdivisionId) {
    return `${date}|${sectorId}|${subdivisionId}`;
  };
  App.toggleSubdiv = function (key) {
    if (this.state.expanded.has(key)) this.state.expanded.delete(key);
    else this.state.expanded.add(key);
    this.renderView();
  };
  App.quickAddSectorTracking = function (ev, sectorId, date) {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    const input = ev.target;
    const content = input.value.trim();
    if (!content) return;
    const p = this.activeProject();
    const sec = ST.findSector(p, sectorId);
    if (!sec) return;
    sec.trackingEntries = sec.trackingEntries || [];
    sec.trackingEntries.push({ id: ST.uid("te-"), date, content });
    this.save();
    this.renderTimeline();
    this.renderView();
  };  App.quickAddTracking = function (ev, subdivisionId, date) {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    const input = ev.target;
    const content = input.value.trim();
    if (!content) return;
    const p = this.activeProject();
    let sd = null;
    for (const sec of p.sectors) {
      const x = ST.findSubdivision(sec, subdivisionId); if (x) { sd = x; break; }
    }
    if (!sd) return;
    sd.trackingEntries = sd.trackingEntries || [];
    sd.trackingEntries.push({ id: ST.uid("te-"), date, content });
    this.save();
    this.renderTimeline();
    this.renderView();
  };
  App.goHome = function () {
    this.state.viewStack = [{ name: "home" }];
    this.renderHeader();
    this.renderView();
  };
  App.switchProject = function (projectId) {
    this.state.data.activeProjectId = projectId;
    this.save();
    this.goHome();
  };

  // ============================================================
  // 顶部导航 + 面包屑
  // ============================================================
  App.renderHeader = function () {
    const sel = document.getElementById("projectSelector");
    const opts = this.state.data.projects.map(p =>
      `<option value="${p.id}" ${p.id === this.state.data.activeProjectId ? "selected" : ""}>${ST.escapeHtml(p.name)}</option>`
    ).join("");
    sel.innerHTML = opts || `<option value="">(暂无项目)</option>`;

    const stack = this.state.viewStack;
    const parts = [];
    for (let i = 0; i < stack.length; i++) {
      const it = stack[i];
      const isLast = i === stack.length - 1;
      const label = this.crumbLabel(it);
      if (isLast) {
        parts.push(`<span class="crumb current">${label}</span>`);
      } else {
        parts.push(`<span class="crumb" data-crumb-idx="${i}">${label}</span><span class="crumb-sep">›</span>`);
      }
    }
    document.getElementById("breadcrumb").innerHTML = parts.join("");
  };

  App.crumbLabel = function (item) {
    const p = this.activeProject();
    switch (item.name) {
      case "home":         return "主页";
      case "project":      return ST.escapeHtml(p ? p.name : "项目");
      case "sector": {
        const sec = p && ST.findSector(p, item.sectorId);
        return sec ? ST.escapeHtml(sec.name) : "板块";
      }
      case "subdivision": {
        for (const sec of (p ? p.sectors : [])) {
          const sd = ST.findSubdivision(sec, item.subdivisionId);
          if (sd) return ST.escapeHtml(sd.name);
        }
        return "细分领域";
      }
      case "stock": {
        for (const sec of (p ? p.sectors : [])) {
          for (const sd of sec.subdivisions) {
            const st = ST.findStock(sd, item.stockId);
            if (st) return ST.escapeHtml(st.name) + " · " + ST.escapeHtml(st.ticker);
          }
        }
        return "个股";
      }
      case "operation": {
        for (const sec of (p ? p.sectors : [])) {
          for (const sd of sec.subdivisions) {
            const st = ST.findStock(sd, item.stockId);
            if (st) {
              const op = ST.findOperation(st, item.operationId);
              const meta = ST.opTypeMeta(op && op.type);
              return `${ST.escapeHtml(st.name)} · ${meta.label}建议`;
            }
          }
        }
        return "操作";
      }
    }
    return item.name;
  };

  // ============================================================
  // 时间轴
  // ============================================================
  App.renderTimeline = function () {
    const track = document.getElementById("timelineTrack");
    const dates = [...this.state.data.timelineDates].sort();
    const active = this.activeDate();
    document.getElementById("activeDateLabel").textContent = active || "—";

    const p = this.activeProject();
    // 收集每个日期上有活动的个股，附带操作 / 快照信息
    const stocksOnDate = (d) => {
      const list = [];
      if (!p) return list;
      for (const sec of p.sectors) {
        for (const sd of sec.subdivisions) {
          for (const st of (sd.stocks || [])) {
            const snap = (st.snapshots || []).find(s => s.date === d);
            const op   = (st.operations || []).find(o => o.date === d);
            if (snap || op) {
              list.push({
                st, sec, sd,
                snap, op,
                opMeta: op ? ST.opTypeMeta(op.type) : null,
              });
            }
          }
        }
      }
      return list;
    };

    const pips = (d) => {
      if (!p) return [];
      let buy = 0, sell = 0, watch = 0, note = 0, ev = 0;
      for (const sec of p.sectors) {
        for (const sd of sec.subdivisions) {
          if ((sd.trackingEntries || []).some(e => e.date === d)) note++;
          for (const st of (sd.stocks || [])) {
            if ((st.snapshots || []).some(s => s.date === d)) ev++;
            for (const op of (st.operations || [])) {
              if (op.date === d) {
                if (op.type === "buy" || op.type === "add") buy++;
                else if (op.type === "sell" || op.type === "trim") sell++;
                else if (op.type === "watch" || op.type === "speculative") watch++;
              }
            }
          }
        }
      }
      const out = [];
      if (buy)   out.push(`<span class="pip green">+${buy}</span>`);
      if (sell)  out.push(`<span class="pip red">-${sell}</span>`);
      if (watch) out.push(`<span class="pip yellow">${watch}·</span>`);
      if (note)  out.push(`<span class="pip blue">${note}·</span>`);
      if (ev)    out.push(`<span class="pip purple">${ev}·</span>`);
      return out;
    };

    // 节点上的个股胶囊（最多 3 个 + 提示更多）
    const stockChips = (d) => {
      const list = stocksOnDate(d);
      if (!list.length) return "";
      const show = list.slice(0, 3);
      const more = list.length - show.length;
      const chips = show.map(item => {
        const t = ST.escapeHtml(item.st.ticker || item.st.name);
        const icon = item.opMeta ? item.opMeta.icon : (item.snap ? "📊" : "·");
        const color = item.opMeta ? item.opMeta.color : "var(--accent)";
        const titleParts = [
          `${item.st.name} (${item.st.ticker || "—"})`,
          item.opMeta ? `操作：${item.opMeta.label}` : null,
          item.snap && item.snap.price != null ? `快照：${item.snap.price}` : null,
          `板块：${item.sec.name} · 细分：${item.sd.name}`,
        ].filter(Boolean).join("\n");
        return `<span class="tl-stock" style="color:${color};" title="${ST.escapeHtml(titleParts)}">${icon} ${t}</span>`;
      }).join("");
      const moreHtml = more > 0 ? `<span class="tl-stock tl-stock-more" title="还有 ${more} 只个股">+${more}</span>` : "";
      return `<div class="tl-stocks">${chips}${moreHtml}</div>`;
    };

    track.innerHTML = dates.map(d => {
      const meta = ST.getTimelineMeta(this.state.data, d);
      const hasLabel = !!meta.label;
      return `
      <div class="tl-node ${d === active ? "is-active" : ""}" data-date="${d}">
        ${pips(d).join("")}
        <div class="dot" data-act="select-date" data-date="${d}" title="点击切换到此节点"></div>
        <div class="lbl" data-act="select-date" data-date="${d}">${ST.fmtDate(d)}</div>
        ${hasLabel ? `<div class="tl-label" title="${ST.escapeHtml(meta.label)}${meta.note ? '\n' + ST.escapeHtml(meta.note) : ''}">${ST.escapeHtml(meta.label)}</div>` : `<div class="tl-label tl-label-empty">（无标签）</div>`}
        ${stockChips(d)}
        <div class="tl-actions">
          <span class="tl-edit" data-act="edit-timeline-node" data-date="${d}" title="编辑节点标签/备注">✎</span>
        </div>
      </div>`;
    }).join("");
  };

  // ============================================================
  // 视图分发
  // ============================================================
  App.renderView = function () {
    const v = this.currentView();
    const root = document.getElementById("viewRoot");
    let html = "";
    switch (v.name) {
      case "home":         html = this.viewHome(); break;
      case "project":      html = this.viewProject(v.projectId); break;
      case "sector":       html = this.viewSector(v.projectId, v.sectorId); break;
      case "subdivision":  html = this.viewSubdivision(v.projectId, v.sectorId, v.subdivisionId); break;
      case "stock":        html = this.viewStock(v.projectId, v.sectorId, v.subdivisionId, v.stockId); break;
      case "operation":    html = this.viewOperation(v.projectId, v.sectorId, v.subdivisionId, v.stockId, v.operationId); break;
      default:             html = `<div class="empty-state"><div class="emoji">?</div>未知视图 ${v.name}</div>`;
    }
    root.innerHTML = html;

    if (v.name === "sector") {
      this.mountChainCanvas(v.sectorId);
    }
    if (v.name === "subdivision") {
      this.mountPuzzleZoom(v.sectorId, v.subdivisionId);
    }
  };

  // ============================================================
  // 视图 · 主页
  // ============================================================
  App.viewHome = function () {
    const p = this.activeProject();
    if (!p) {
      return `<div class="empty-state">
        <div class="emoji">-</div>
        <div>暂无项目</div>
        <div class="hint">点击右上角 "+ 新项目" 创建第一个项目</div>
      </div>`;
    }
    const dates = [...this.state.data.timelineDates].sort();
    const active = this.activeDate();
    const stats = this.projectOverallStats(p);
    const colsHtml = dates.map(d => this.homeDateColumnHtml(p, d, d === active)).join("");

    return `
      <div class="home-grid">
        <div class="home-header">
          <h2>
            <span style="font-size:24px;">${p.emoji || "?"}</span>
            ${ST.escapeHtml(p.name)}
            <span class="active-tag">当前节点 ${ST.fmtDate(active)}</span>
          </h2>
          <div class="row">
            ${stats.chips.map(c => `<span class="stat-chip ${c.cls || ""}">${c.label}: <strong>${c.value}</strong></span>`).join("")}
            <button class="btn-tiny" data-act="open-project">打开项目 ›</button>
          </div>
        </div>
        <div class="timeline-columns">${colsHtml}</div>
      </div>
    `;
  };

  App.homeDateColumnHtml = function (p, date, isActive) {
    // 自动展开有活动的细分
    for (const sec of p.sectors) for (const sd of sec.subdivisions) {
      const hasActivity = (sd.trackingEntries||[]).some(e => e.date === date)
        || (sd.stocks||[]).some(st =>
            (st.snapshots||[]).some(s => s.date === date)
            || (st.operations||[]).some(o => o.date === date));
      if (hasActivity) this.state.expanded.add(this.expKey(date, sec.id, sd.id));
    }
    const meta = ST.getTimelineMeta(this.state.data, date);
    let totalTracking = 0, totalSnap = 0, totalOp = 0;
    for (const sec of p.sectors) {
      for (const e of (sec.trackingEntries || [])) if (e.date === date) totalTracking++;
      for (const sd of sec.subdivisions) {
        for (const e of (sd.trackingEntries || [])) if (e.date === date) totalTracking++;
        for (const st of (sd.stocks || [])) {
          for (const s of (st.snapshots || [])) if (s.date === date) totalSnap++;
          for (const o of (st.operations || [])) if (o.date === date) totalOp++;
        }
      }
    }
    const sectorsHtml = p.sectors.map(sec => this.homeSectorBlockHtml(sec, date)).join("");
    return `
      <div class="timeline-col ${isActive ? "is-active" : ""}">
        <div class="timeline-col-head">
          <div class="col-date-row">
            <span class="date">${ST.fmtDate(date)}</span>
            <div class="col-row-actions">
              <button class="btn-tiny btn-add-sector" data-act="add-sector-from-col" data-date="${date}" title="在此项目下新增板块">＋板块</button>
              <span class="col-edit" data-act="edit-timeline-node" data-date="${date}" title="编辑节点标签/备注">✎</span>
            </div>
          </div>
          ${meta.label ? `<div class="col-label" title="${ST.escapeHtml(meta.label)}${meta.note ? '\n' + ST.escapeHtml(meta.note) : ''}">${ST.escapeHtml(meta.label)}</div>` : `<div class="col-label col-label-empty">未命名事件</div>`}
          <div class="col-stats">
            ${totalTracking ? `<span class="stat-chip blue">📝 ${totalTracking}</span>` : ''}
            ${totalSnap     ? `<span class="stat-chip purple">📊 ${totalSnap}</span>` : ''}
            ${totalOp       ? `<span class="stat-chip green">⚡ ${totalOp}</span>` : ''}
          </div>
        </div>
        <div class="timeline-col-body">
          ${sectorsHtml || (!p.sectors.length ? `<div class="empty-state" style="padding:30px 10px;"><div class="emoji" style="font-size:32px;">-</div><div class="hint">该项目还没有板块</div></div>` : '')}
        </div>
      </div>
    `;
  };

  App.homeSectorBlockHtml = function (sec, date) {
    const subdivsHtml = sec.subdivisions.map(sd => this.homeSubdivBlockHtml(sec, sd, date)).join("");
    const sectorColor = sec.color || ((sec.chainNodes && sec.chainNodes[0]) ? sec.chainNodes[0].color : "#58a6ff");
    const sectorIcon = sec.icon || "·";
    const trackingSec = (sec.trackingEntries || []).filter(e => e.date === date);
    return `
      <div class="h-sector">
        <div class="h-sector-head">
          <span class="color-dot" style="background:${sectorColor};box-shadow:0 0 6px ${sectorColor};"></span>
          <span class="sector-icon" style="color:${sectorColor};" title="${ST.escapeHtml(sec.name)}">${sectorIcon}</span>
          <span class="name" data-act="open-sector" data-sector-id="${sec.id}" title="打开产业链全景图">${ST.escapeHtml(sec.name)}</span>
          <span class="muted" style="font-size:11px;">${sec.subdivisions.length}细·${sec.subdivisions.reduce((s,x)=>s+(x.stocks||[]).length,0)}股</span>
          <button class="btn-tiny" data-act="add-subdivision" data-sector-id="${sec.id}" title="新增细分">＋</button>
          <button class="btn-tiny" data-act="edit-sector" data-sector-id="${sec.id}" title="编辑板块（图标/颜色/整体跟踪）">✎</button>
        </div>
        <div class="h-sector-tracking">
          <div class="h-track-form">
            <input class="input h-track-input" data-sector-id="${sec.id}" data-date="${date}" placeholder="📝 在 ${ST.fmtDate(date)} 录入板块级跟踪，回车保存" onkeydown="App.quickAddSectorTracking(event, '${sec.id}', '${date}')" />
          </div>
          ${trackingSec.length ? `<div class="h-track-list">${trackingSec.map(e => `<div class="h-track-item h-track-sector"><span class="content">${ST.escapeHtml(e.content)}</span><button class="btn-tiny" data-act="edit-sector-tracking" data-sector-id="${sec.id}" data-entry-id="${e.id}" title="编辑">✎</button><button class="btn-del" data-act="del-sector-tracking" data-sector-id="${sec.id}" data-entry-id="${e.id}" title="删除">✕</button></div>`).join("")}</div>` : ""}
        </div>
        <div class="h-sector-body">
          ${subdivsHtml || `<div class="muted" style="padding:8px;font-size:12px;text-align:center;">该板块还没有细分领域，点击＋ 新增</div>`}
        </div>
      </div>
    `;
  }
  App.homeSubdivBlockHtml = function (sec, sd, date) {
    const key = this.expKey(date, sec.id, sd.id);
    const isOpen = this.state.expanded.has(key);
    const trackingToday = (sd.trackingEntries||[]).filter(e => e.date === date);
    const stocks = sd.stocks || [];
    const stocksHtml = stocks.map(st => this.homeStockRowHtml(sec, sd, st, date)).join("");
    // 个股 chip 紧凑展示（按 prototype-v18 风格）
    const stocksCompactHtml = stocks.length ? stocks.map(st => {
      const snap = (st.snapshots||[]).find(s => s.date === date);
      const op   = (st.operations||[]).find(o => o.date === date);
      const opMeta = op ? ST.opTypeMeta(op.type) : null;
      const priceStr = snap && snap.price != null ? '$' + ST.fmtNum(snap.price) : '—';
      const peStr = snap && snap.valuation && snap.valuation.pe != null ? 'PE ' + ST.fmtNum(snap.valuation.pe) : '';
      return `<div class="h-stock-compact" data-act="open-stock" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}" title="点击进入 ${ST.escapeHtml(st.name)} 个股详情">
        <span class="hsc-name">${ST.escapeHtml(st.name)}</span>
        <span class="hsc-ticker">${ST.escapeHtml(st.ticker)}</span>
        <span class="hsc-price">${priceStr}</span>
        ${peStr ? `<span class="hsc-pe">${peStr}</span>` : ''}
        ${opMeta ? `<span class="hsc-op" style="color:${opMeta.color};border-color:${opMeta.color}60;background:${opMeta.color}18;">${opMeta.icon}${opMeta.label}</span>` : ''}
      </div>`;
    }).join("") : '';
    return `
      <div class="h-subdiv ${isOpen ? 'is-open' : ''}">
        <div class="h-subdiv-head" data-act="toggle-subdiv" data-key="${key}">
          <span class="arrow">${isOpen ? '▼' : '▶'}</span>
          <span class="icon">${sd.icon || '·'}</span>
          <span class="name" data-act="open-subdivision" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}">${ST.escapeHtml(sd.name)}</span>
          ${trackingToday.length ? `<span class="stat-chip blue">📝${trackingToday.length}</span>` : ''}
          ${stocks.length ? `<span class="stat-chip purple">📊${stocks.length}</span>` : ''}
          <button class="btn-tiny" data-act="add-stock" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" title="新增个股">+</button>
          <button class="btn-tiny" data-act="edit-subdivision" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" title="编辑细分">✎</button>
        </div>
        ${stocksCompactHtml ? `<div class="h-stock-compact-list">${stocksCompactHtml}</div>` : `<div class="muted h-subdiv-empty">该细分暂无个股</div>`}
        ${isOpen ? `
          <div class="h-subdiv-body">
            <div class="h-track-form">
              <input class="input h-track-input" data-subdivision-id="${sd.id}" data-date="${date}" placeholder="📝 在 ${ST.fmtDate(date)} 录入细分领域跟踪，回车保存" onkeydown="App.quickAddTracking(event, '${sd.id}', '${date}')" />
            </div>
            ${trackingToday.length ? `<div class="h-track-list">${trackingToday.map(e => `<div class="h-track-item"><span class="content">${ST.escapeHtml(e.content)}</span><button class="btn-tiny" data-act="edit-tracking" data-subdivision-id="${sd.id}" data-entry-id="${e.id}" title="编辑">✎</button><button class="btn-del" data-act="del-tracking" data-subdivision-id="${sd.id}" data-entry-id="${e.id}" title="删除">✕</button></div>`).join('')}</div>` : ''}
            ${stocksHtml ? `<div class="h-stock-list">${stocksHtml}</div>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }
  App.homeStockRowHtml = function (sec, sd, st, date) {
    const snap = (st.snapshots||[]).find(s => s.date === date);
    const op   = (st.operations||[]).find(o => o.date === date);
    const opMeta = op ? ST.opTypeMeta(op.type) : null;
    const priceStr = snap && snap.price != null ? '$' + ST.fmtNum(snap.price) : '—';
    const peStr = snap && snap.valuation && snap.valuation.pe != null ? ST.fmtNum(snap.valuation.pe) : '—';
    return `
      <div class="h-stock-row">
        <div class="h-stock-line1">
          <span class="h-stock-name" data-act="open-stock" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}">${ST.escapeHtml(st.name)} <span class="ticker">${ST.escapeHtml(st.ticker)}</span></span>
          <span class="h-stock-actions">
            <button class="btn-tiny" data-act="add-snapshot" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}" title="新增快照">＋📊</button>
            <button class="btn-tiny" data-act="add-operation" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}" title="新增操作">＋⚡</button>
            <button class="btn-tiny" data-act="edit-stock" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}" title="编辑个股">✎</button>
          </span>
        </div>
        ${snap ? `
          <div class="h-snap-line">
            <span class="h-chip-label">📊 快照</span>
            <span class="h-chip-val">${priceStr} · PE ${peStr}</span>
            <button class="btn-del" data-act="del-snapshot" data-stock-id="${st.id}" data-snap-id="${snap.id}" title="删除此快照">✕</button>
          </div>
        ` : ''}
        ${op ? `
          <div class="h-op-line" style="border-left-color:${opMeta.color};">
            <span class="op-badge" data-act="open-operation" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}" data-operation-id="${op.id}" style="color:${opMeta.color};border-color:${opMeta.color}50;background:${opMeta.color}18;">${opMeta.icon} ${opMeta.label}</span>
            <span class="h-chip-val">${op.price != null ? '$' + ST.fmtNum(op.price) : '—'}${op.target != null ? ' → $' + ST.fmtNum(op.target) : ''}</span>
            <button class="btn-del" data-act="del-operation" data-stock-id="${st.id}" data-operation-id="${op.id}" title="删除此操作">✕</button>
          </div>
        ` : ''}
        ${!snap && !op ? `<div class="h-empty">本日无快照或操作 · 点击右上 ＋ 添加</div>` : ''}
        <div class="h-op-form">
          <select class="input h-op-type" id="qa_op_type_${st.id}_${date}">
            <option value="watch">👀 观察</option>
            <option value="buy">🟢 建仓</option>
            <option value="add">➕ 加仓</option>
            <option value="hold">🟦 持有</option>
            <option value="trim">✂️ 减仓</option>
            <option value="sell">🔴 清仓</option>
            <option value="speculative">🎲 博弈</option>
          </select>
          <input class="input h-op-input" id="qa_op_text_${st.id}_${date}" placeholder="⚡ 在 ${ST.fmtDate(date)} 录入操作简述，回车保存" />
          <button class="btn-tiny h-op-save" data-act="quick-add-operation" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}" data-date="${date}" title="录入操作">＋</button>
        </div>
      </div>
    `;
  };
App.projectOverallStats = function (p) {
    let stocks = 0, ops = 0, tracks = 0;
    for (const sec of p.sectors) {
      for (const sd of sec.subdivisions) {
        stocks += (sd.stocks || []).length;
        tracks += (sd.trackingEntries || []).length;
        for (const st of (sd.stocks || [])) ops += (st.operations || []).length;
      }
    }
    return {
      chips: [
        { label: "板块", value: p.sectors.length },
        { label: "细分", value: p.sectors.reduce((s, x) => s + x.subdivisions.length, 0) },
        { label: "个股", value: stocks, cls: "purple" },
        { label: "操作", value: ops, cls: "green" },
        { label: "跟踪", value: tracks, cls: "accent" },
      ],
    };
  };

  // ============================================================
  // 视图 · 项目二级页
  // ============================================================
  App.viewProject = function (projectId) {
    const p = ST.findProject(this.state.data, projectId) || this.activeProject();
    if (!p) return `<div class="empty-state"><div class="emoji">-</div>项目不存在</div>`;
    const active = this.activeDate();

    const sectorsHtml = p.sectors.map(sec => {
      const subdivs = sec.subdivisions.map(sd => {
        const stocksHtml = (sd.stocks || []).map(st => {
          const op = ST.latestOperationBefore(st, active);
          const snap = ST.latestSnapshotBefore(st, active);
          const opMeta = op ? ST.opTypeMeta(op.type) : null;
          return `
            <div class="stock-row">
              <div class="stock-name" data-act="open-stock" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}">
                ${ST.escapeHtml(st.name)}
                <span class="ticker">${ST.escapeHtml(st.ticker)} · ${ST.escapeHtml(st.market)}</span>
              </div>
              <div class="concept-cell" data-act="open-stock" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}">
                ${ST.escapeHtml(st.concept || "—")}
              </div>
              <div class="snapshot-cell">
                <span class="lbl">价格 @ ${ST.fmtDate(active)}</span>
                <span class="val">${snap && snap.price != null ? "$" + ST.fmtNum(snap.price) : "—"}</span>
              </div>
              <div class="snapshot-cell">
                <span class="lbl">PE · 市值</span>
                <span class="val">${snap && snap.valuation && snap.valuation.pe != null ? ST.fmtNum(snap.valuation.pe) + " · " + ST.escapeHtml(snap.marketCap || "—") : "—"}</span>
              </div>
              <div class="row" style="justify-content:flex-end;">
                ${opMeta ? `<span class="op-badge" data-act="open-operation" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}" data-operation-id="${op.id}" style="color:${opMeta.color};border-color:${opMeta.color}50;background:${opMeta.color}18;">${opMeta.icon} ${opMeta.label}</span>` :
                           `<span class="op-badge" data-act="open-operation" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}" data-operation-id="" style="color:#7d8590;border-color:#7d859050;background:transparent;">+ 操作</span>`}
              </div>
            </div>
          `;
        }).join("");

        return `
          <div class="subdiv-block">
            <div class="subdiv-head">
              <div class="name" data-act="open-subdivision" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}">
                <span>${sd.icon || "·"}</span> ${ST.escapeHtml(sd.name)}
              </div>
              <div class="row">
                <span class="chain-link" data-act="open-sector-from-sub" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}">· 产业链定位</span>
                <button class="btn-tiny" data-act="add-stock" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}">+ 个股</button>
              </div>
            </div>
            ${stocksHtml || `<div class="muted" style="font-size:12px;padding:12px;text-align:center;">暂无个股，点击右上角"+ 个股"添加</div>`}
          </div>
        `;
      }).join("");

      return `
        <div class="sector-block">
          <div class="sector-head" data-act="open-sector" data-sector-id="${sec.id}">
            <div class="left">
              <div class="name">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sec.color || (sec.chainNodes[0] ? sec.chainNodes[0].color : "#58a6ff")};box-shadow:0 0 8px currentColor;"></span>
                <span style="margin:0 4px;font-size:16px;">${sec.icon || "·"}</span>
                ${ST.escapeHtml(sec.name)}
              </div>
              <div class="desc">${ST.escapeHtml(sec.description || "")}</div>
            </div>
            <div class="right">
              <span class="pill">· <b>${sec.chainNodes.length}</b> 产业链节点</span>
              <span class="pill">· <b>${sec.subdivisions.length}</b> 细分领域</span>
              <span class="pill">· <b>${sec.subdivisions.reduce((s, x) => s + (x.stocks || []).length, 0)}</b> 个股</span>
              <button class="btn-tiny" data-act="add-subdivision" data-sector-id="${sec.id}">+ 细分</button>
            </div>
          </div>
          <div class="sector-body">
            ${subdivs || `<div class="muted" style="font-size:12px;padding:20px;text-align:center;">该板块暂无细分领域，点击右上"+ 细分"</div>`}
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="detail-page">
        <div class="detail-head">
          <h2>
            <span style="font-size:26px;">${p.emoji || "·"}</span>
            ${ST.escapeHtml(p.name)}
            <button class="btn-tiny" data-act="edit-project">编辑</button>
          </h2>
          <div class="meta">
            <span class="tag">创建 ${ST.fmtDate(p.createdAt)}</span>
            <span class="tag">时间节点 ${ST.fmtDate(active)}</span>
          </div>
        </div>
        <div class="muted" style="font-size:13px;margin-bottom:8px;">${ST.escapeHtml(p.description || "")}</div>
        ${sectorsHtml || `<div class="empty-state"><div class="emoji">-</div>暂无板块，点击下方"+ 板块"创建</div>`}
        <div style="text-align:center;padding:10px;">
          <button class="btn btn-ghost" data-act="add-sector">+ 添加板块</button>
        </div>
      </div>
    `;
  };

  // ============================================================
  // 视图 · 板块 -> 产业链全景 + 4 列细分抽屉 + 时间轴
  // ============================================================
  App.viewSector = function (projectId, sectorId) {
    const p = ST.findProject(this.state.data, projectId);
    const sec = p && ST.findSector(p, sectorId);
    if (!sec) return `<div class="empty-state"><div class="emoji">-</div>板块不存在</div>`;

    const nodeMap = {};
    sec.subdivisions.forEach(sd => { if (sd.chainNodeId) nodeMap[sd.chainNodeId] = sd; });

    // 4 列抽屉：每个细分 = 1 抽屉
    const subs = sec.subdivisions || [];
    const drawerCount = subs.length;
    const sectorKey = sec.id;
    // 取 4 个最新细分（按 createdAt / id）
    const sortedSubs = subs.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || (b.id || "").localeCompare(a.id || ""));
    const displaySubs = sortedSubs.slice(0, 4);
    const subDrawerHtml = displaySubs.map((sd, idx) => {
      const node = sec.chainNodes.find(n => n.id === sd.chainNodeId);
      const stockCount = (sd.stocks || []).length;
      const trackCount = (sd.trackingEntries || []).length;
      return `
        <div class="op-drawer ${idx === 0 ? " is-active" : ""}" data-sector-op-id="${sec.id}" data-subdivision-op-id="${sd.id}" data-stock-op-id="">
          <div class="op-drawer-head">
            <div class="op-drawer-label-row">
              <span class="op-drawer-date" style="color:${sd.color || sec.color || "#58a6ff"};">${ST.escapeHtml(sd.name)}</span>
            </div>
            <div class="op-drawer-actions">
              <button data-act="open-subdivision" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" title="进入细分">›</button>
            </div>
          </div>
          <div class="op-drawer-body">
            <div class="op-block">
              <div class="block-title">📍 产业链定位</div>
              <div class="op-block-content">${node ? ST.escapeHtml(node.label) : "未关联"}</div>
            </div>
            <div class="op-block">
              <div class="block-title">📊 规模</div>
              <div class="op-fields-row">
                <div class="op-field">
                  <label>个股</label>
                  <div class="op-block-content" style="font-size:14px;">${stockCount}</div>
                </div>
                <div class="op-field">
                  <label>跟踪</label>
                  <div class="op-block-content" style="font-size:14px;">${trackCount}</div>
                </div>
              </div>
            </div>
            ${sd.description ? `
            <div class="op-block">
              <div class="block-title">📝 简介</div>
              <div class="op-block-content" style="white-space:pre-wrap;line-height:1.5;">${ST.escapeHtml(sd.description)}</div>
            </div>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="detail-page v10-page">
        <div class="detail-head">
          <h2>
            <span style="font-size:28px;color:${sec.color || '#58a6ff'}">${sec.icon || '·'}</span>
            ${ST.escapeHtml(sec.name)}
            <button class="btn-tiny" data-act="edit-sector" data-sector-id="${sec.id}">编辑</button>
          </h2>
          <div class="meta">
            <span class="tag">${sec.chainNodes.length} 个节点</span>
            <span class="tag">${sec.subdivisions.length} 个细分领域</span>
            <span class="tag">${sec.subdivisions.reduce((s, x) => s + (x.stocks || []).length, 0)} 个股</span>
            <button class="btn-tiny" data-act="add-chain-node" data-sector-id="${sec.id}">+ 产业链节点</button>
          </div>
        </div>
        <div class="muted" style="font-size:13px;margin-bottom:8px;line-height:1.6;">${ST.escapeHtml(sec.description || "")}</div>

        <!-- 画布 -->
        <div class="chain-stage">
          <div class="chain-header">
            <h3>· 产业链全景图 · 点击节点进入细分领域</h3>
            <div class="muted" style="font-size:12px;">实线 = 已有细分领域；虚线 = 待补充</div>
          </div>
          <div class="chain-canvas-wrap" id="chainCanvasWrap" data-sector-id="${sec.id}"></div>
          <div class="chain-legend">
            ${sec.chainNodes.map(n => {
              const has = nodeMap[n.id];
              return `<span class="item"><span class="swatch" style="background:${n.color};"></span>${ST.escapeHtml(n.label)}${has ? " ·已配" : " (待补充)"}</span>`;
            }).join("")}
          </div>
        </div>

        <!-- V10 · 4 列细分抽屉 + 时间轴 -->
        <div class="chain-stage" style="margin-top:18px;">
          <div class="chain-header">
            <h3>· 细分领域 · ${drawerCount > 0 ? drawerCount + " 个，按最新优先排序" : "暂无"}</h3>
            <div class="muted" style="font-size:12px;">点击抽屉右侧 › 进入细分领域查看详情</div>
          </div>
          ${drawerCount > 0 ? `
          <div class="track-drawers-wrap" style="margin-top:8px;">
            <button class="track-nav prev" data-act="sub-rail-prev" data-sector-op-rail="${sectorKey}" ${drawerCount <= 4 ? "disabled" : ""}>‹</button>
            <div class="op-drawers-grid" data-sector-op-drawers="${sectorKey}">${subDrawerHtml}</div>
            <button class="track-nav next" data-act="sub-rail-next" data-sector-op-rail="${sectorKey}" ${drawerCount <= 4 ? "disabled" : ""}>›</button>
          </div>
          <div class="track-rail-wrap">
            <button class="track-rail-nav prev" data-act="sub-rail-prev" data-sector-op-rail="${sectorKey}" disabled>‹</button>
            <div class="track-rail-track" data-sector-op-rail="${sectorKey}">
              <div class="track-rail-axis"></div>
              <div class="track-rail-axis-progress"></div>
            </div>
            <button class="track-rail-nav next" data-act="sub-rail-next" data-sector-op-rail="${sectorKey}" disabled>›</button>
            <button class="track-rail-add" data-act="add-subdivision" data-sector-id="${sec.id}" title="新增细分">+</button>
          </div>
          ` : `<div class="empty-state" style="padding:30px 10px;">
              <div class="emoji" style="font-size:32px;">·</div>
              <div>该板块还没有细分领域，点击产业链节点上的虚线圆圈补充</div>
              <button class="btn-tiny" data-act="add-subdivision" data-sector-id="${sec.id}" style="margin-top:8px;">+ 新增细分</button>
            </div>`}
        </div>
      </div>
    `;
  };

  App.mountChainCanvas = function (sectorId) {
    const wrap = document.getElementById("chainCanvasWrap");
    if (!wrap) return;
    const p = this.activeProject();
    const sec = ST.findSector(p, sectorId);
    if (!sec) return;

    const nodeMap = {};
    sec.subdivisions.forEach(sd => { if (sd.chainNodeId) nodeMap[sd.chainNodeId] = sd; });

    const W = wrap.clientWidth || 800;
    const H = wrap.clientHeight || 280;
    const nodes = sec.chainNodes.map(n => ({
      ...n,
      x: (n.x / 100) * W,
      y: (n.y / 100) * H,
      hasSubdiv: !!nodeMap[n.id],
    }));

    let svg = `<svg class="chain-canvas" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 Z" fill="#3d4a5c" />
        </marker>
      </defs>`;
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1];
      svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#3d4a5c" stroke-width="1.5" stroke-dasharray="${a.hasSubdiv && b.hasSubdiv ? "0" : "4 4"}" marker-end="url(#arr)" />`;
    }
    svg += `</svg>`;

    const html = nodes.map(n => `
      <div class="chain-node-html ${n.hasSubdiv ? "has-subdiv" : ""}"
           style="left:${n.x}px;top:${n.y}px;color:${n.color};"
           data-act="${n.hasSubdiv ? "open-subdivision-from-node" : "create-subdivision-at-node"}"
           data-sector-id="${sec.id}"
           data-chain-node-id="${n.id}"
           title="${n.hasSubdiv ? "点击进入 " + nodeMap[n.id].name : "点击在此节点创建细分领域"}">
        <div class="dot" style="border-color:${n.color};color:${n.color};">${n.icon || "·"}</div>
        <div class="lbl" style="${n.hasSubdiv ? "color:" + n.color : ""}">${ST.escapeHtml(n.label)}${n.hasSubdiv ? " · " + ST.escapeHtml(nodeMap[n.id].name) : ""}</div>
      </div>
    `).join("");

    wrap.innerHTML = svg + html;
  };

  // ============================================================
  // 视图 · 细分领域 -> 局部拼图 + 4 列个股抽屉 + 时间轴 + 跟踪
  // ============================================================
  App.viewSubdivision = function (projectId, sectorId, subdivisionId) {
    const p = ST.findProject(this.state.data, projectId);
    const sec = p && ST.findSector(p, sectorId);
    const sd  = sec && ST.findSubdivision(sec, subdivisionId);
    if (!sd) return `<div class="empty-state"><div class="emoji">-</div>细分领域不存在</div>`;
    const active = this.activeDate();

    const entries = [...(sd.trackingEntries || [])].sort((a, b) => b.date.localeCompare(a.date));

    // 4 列个股抽屉
    const stocks = sd.stocks || [];
    const drawerCount = stocks.length;
    const subKey = sd.id;
    const sortedStocks = stocks.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || (b.id || "").localeCompare(a.id || ""));
    const displayStocks = sortedStocks.slice(0, 4);
    const stockDrawerHtml = displayStocks.map((st, idx) => {
      const op = ST.latestOperationBefore(st, active);
      const snap = ST.latestSnapshotBefore(st, active);
      const opMeta = op ? ST.opTypeMeta(op.type) : null;
      const priceStr = snap && snap.price != null ? ST.fmtNum(snap.price) : "—";
      const peStr = snap && snap.valuation && snap.valuation.pe != null ? ST.fmtNum(snap.valuation.pe) : "—";
      const opBadge = opMeta
        ? `<span class="op-badge" style="color:${opMeta.color};border-color:${opMeta.color}50;background:${opMeta.color}18;">${opMeta.icon} ${opMeta.label}</span>`
        : `<span class="op-badge" style="color:#7d8590;border-color:#7d859050;background:transparent;">—</span>`;
      return `
        <div class="op-drawer ${idx === 0 ? " is-active" : ""}" data-sector-op-id="${sec.id}" data-subdivision-op-id="${sd.id}" data-stock-op-id="${st.id}">
          <div class="op-drawer-head">
            <div class="op-drawer-label-row">
              <span class="op-drawer-date" data-act="open-stock" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}" style="cursor:pointer;">${ST.escapeHtml(st.name)}</span>
            </div>
            <div class="op-drawer-actions">
              <button data-act="open-stock" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}" title="进入个股">›</button>
            </div>
          </div>
          <div class="op-drawer-body">
            <div class="op-block">
              <div class="block-title">🏷 标识</div>
              <div class="op-block-content">${ST.escapeHtml(st.ticker)} · ${ST.escapeHtml(st.market || "")}</div>
            </div>
            <div class="op-block">
              <div class="block-title">📊 估值</div>
              <div class="op-fields-row">
                <div class="op-field">
                  <label>价格</label>
                  <div class="op-block-content" style="font-size:14px;">$${priceStr}</div>
                </div>
                <div class="op-field">
                  <label>PE</label>
                  <div class="op-block-content" style="font-size:14px;">${peStr}</div>
                </div>
                <div class="op-field">
                  <label>评级</label>
                  <div class="op-block-content">${opBadge}</div>
                </div>
              </div>
            </div>
            ${st.concept ? `
            <div class="op-block">
              <div class="block-title">💡 概念</div>
              <div class="op-block-content" style="line-height:1.5;">${ST.escapeHtml(st.concept)}</div>
            </div>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="detail-page v10-page">
        <div class="detail-head">
          <h2>
            <span style="font-size:28px;color:${sd.color || "#58a6ff"}">${sd.icon || "·"}</span>
            ${ST.escapeHtml(sd.name)}
            <button class="btn-tiny" data-act="edit-subdivision" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}">编辑</button>
          </h2>
          <div class="meta">
            <span class="tag">所属板块：${ST.escapeHtml(sec.name)}</span>
            <span class="tag">产业链节点：${sec.chainNodes.find(n => n.id === sd.chainNodeId) ? ST.escapeHtml(sec.chainNodes.find(n => n.id === sd.chainNodeId).label) : "未关联"}</span>
            <span class="tag">当前节点 ${ST.fmtDate(active)}</span>
          </div>
        </div>

        <!-- puzzle 局部拼图 -->
        <div class="puzzle-panel">
          <div class="row" style="justify-content:space-between;">
            <h3 style="margin:0;font-size:15px;">· 局部拼图 · 产业链定位</h3>
            <span class="muted" style="font-size:11px;">聚焦此节点在产业链中的位置</span>
          </div>
          <div class="puzzle-stage" id="puzzleStage" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}"></div>
          <div class="muted" style="font-size:12px;line-height:1.6;">
            拼图视角下，您正聚焦 <b style="color:${sd.color || "#58a6ff"}">${ST.escapeHtml(sd.name)}</b> 在产业链中的位置。
            上下游节点和供给关系一目了然，并随时间轴变化更新跟踪内容。
          </div>
        </div>

        <!-- V10 · 4 列个股抽屉 + 时间轴 -->
        <div class="chain-stage" style="margin-top:18px;">
          <div class="chain-header">
            <h3>· 个股 · ${drawerCount > 0 ? drawerCount + " 个，按最新优先排序" : "暂无"}</h3>
            <div class="muted" style="font-size:12px;">点击抽屉右侧 › 进入个股查看详情</div>
          </div>
          ${drawerCount > 0 ? `
          <div class="track-drawers-wrap" style="margin-top:8px;">
            <button class="track-nav prev" data-act="sd-rail-prev" data-subdivision-op-rail="${subKey}" ${drawerCount <= 4 ? "disabled" : ""}>‹</button>
            <div class="op-drawers-grid" data-subdivision-op-drawers="${subKey}">${stockDrawerHtml}</div>
            <button class="track-nav next" data-act="sd-rail-next" data-subdivision-op-rail="${subKey}" ${drawerCount <= 4 ? "disabled" : ""}>›</button>
          </div>
          <div class="track-rail-wrap">
            <button class="track-rail-nav prev" data-act="sd-rail-prev" data-subdivision-op-rail="${subKey}" disabled>‹</button>
            <div class="track-rail-track" data-subdivision-op-rail="${subKey}">
              <div class="track-rail-axis"></div>
              <div class="track-rail-axis-progress"></div>
            </div>
            <button class="track-rail-nav next" data-act="sd-rail-next" data-subdivision-op-rail="${subKey}" disabled>›</button>
            <button class="track-rail-add" data-act="add-stock" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" title="新增个股">+</button>
          </div>
          ` : `<div class="empty-state" style="padding:30px 10px;">
              <div class="emoji" style="font-size:32px;">·</div>
              <div>该细分领域还没有个股</div>
              <button class="btn-tiny" data-act="add-stock" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" style="margin-top:8px;">+ 新增个股</button>
            </div>`}
        </div>

        <!-- 跟踪面板 -->
        <div class="chain-stage" style="margin-top:18px;">
          <div class="chain-header">
            <h3>· 产业跟踪内容 · ${entries.length} 条</h3>
          </div>
          <div class="tracking-list" id="trackingList">
            ${entries.length ? entries.slice(0, 6).map(e => `
              <div class="tracking-item" style="border-left-color:${sd.color || "#58a6ff"}">
                <div class="date">
                  <span>${ST.fmtDate(e.date)}</span>
                  <span class="del" data-act="del-tracking" data-subdivision-id="${sd.id}" data-entry-id="${e.id}" title="删除">x</span>
                </div>
                <div class="content">${ST.escapeHtml(e.content).replace(/\n/g, "<br>")}</div>
              </div>
            `).join("") : `<div class="muted" style="font-size:12px;padding:16px;text-align:center;">暂无跟踪内容，使用下方表单手动录入</div>`}
          </div>
          <div class="divider"></div>
          <div class="form-row">
            <label>日期</label>
            <input class="input" id="trackDate" type="date" value="${active}" />
          </div>
          <div class="form-row">
            <label>跟踪内容</label>
            <textarea class="textarea" id="trackContent" placeholder="例如：英伟达发布 B300，性能 +50%，功耗 +30%"></textarea>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" data-act="add-tracking" data-subdivision-id="${sd.id}">+ 录入跟踪</button>
          </div>
        </div>
      </div>
    `;
  };

  App.mountPuzzleZoom = function (sectorId, subdivisionId) {
    const wrap = document.getElementById("puzzleStage");
    if (!wrap) return;
    const p = this.activeProject();
    const sec = ST.findSector(p, sectorId);
    const sd  = ST.findSubdivision(sec, subdivisionId);
    if (!sd) return;

    const idx = sec.chainNodes.findIndex(n => n.id === sd.chainNodeId);
    const prev = idx > 0 ? sec.chainNodes[idx - 1] : null;
    const next = idx < sec.chainNodes.length - 1 ? sec.chainNodes[idx + 1] : null;
    const cur  = sec.chainNodes[idx];

    wrap.innerHTML = `
      ${prev ? `<div class="puzzle-neighbors left">‹ ${ST.escapeHtml(prev.label)}</div>` : ""}
      ${next ? `<div class="puzzle-neighbors right">${ST.escapeHtml(next.label)} ›</div>` : ""}
      <div class="puzzle-zoom" style="color:${cur ? cur.color : "#58a6ff"};">
        <div class="icon">${cur ? cur.icon : "·"}</div>
        <div class="label">${ST.escapeHtml(sd.name)}</div>
        <div class="sub">${cur ? ST.escapeHtml(cur.label) : ""}</div>
      </div>
    `;
  };

  // ============================================================
  // 视图 · 个股
  // ============================================================
  App.viewStock = function (projectId, sectorId, subdivisionId, stockId) {
    const p = ST.findProject(this.state.data, projectId);
    const sec = p && ST.findSector(p, sectorId);
    const sd  = sec && ST.findSubdivision(sec, subdivisionId);
    const st  = sd && ST.findStock(sd, stockId);
    if (!st) return `<div class="empty-state"><div class="emoji">-</div>个股不存在</div>`;

    const active = this.activeDate();
    const snap = ST.latestSnapshotBefore(st, active);
    const ops  = [...(st.operations || [])].sort((a, b) => b.date.localeCompare(a.date));
    const snaps = ST.sortedSnapshots(st);
    const val = (snap && snap.valuation) || {};
    const stockKey = sec.id + "|" + sd.id + "|" + st.id;

    // 估值精简（v10 5 字段：现价 + 市值下限 / 上限 / 总股本 + 动态PE + ROE + PEG）
    const ratingMap = { buy: "💚 买入", add: "➕ 加仓", hold: "🔵 持有", trim: "➖ 减仓", sell: "🔻 卖出", watch: "💛 关注", speculative: "🔶 投机" };
    const activeOp = ops[0];

    return `
      <div class="detail-page v10-stock">
        <div class="detail-head">
          <h2>
            <span class="stock-avatar">${ST.escapeHtml((st.name || "?").slice(0, 1))}</span>
            ${ST.escapeHtml(st.name)} <span class="ticker-tag">${ST.escapeHtml(st.ticker)}</span>
            <button class="btn-tiny" data-act="edit-stock" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}">编辑</button>
          </h2>
          <div class="meta">
            <span class="tag">${ST.escapeHtml(sd.name)} · ${ST.escapeHtml(sec.name)}</span>
            <span class="tag">${ST.escapeHtml(st.market)}</span>
            ${activeOp ? `<span class="tag rating-${activeOp.type || 'none'}">${ratingMap[activeOp.type] || "未评级"}</span>` : `<span class="tag rating-none">未评级</span>`}
            <button class="btn-tiny" data-act="add-snapshot" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}">+ 快照</button>
          </div>
        </div>

        <div class="stock-head-card v10">
          <div class="top">
            <div class="name-block">
              <div class="current-price">
                <span class="price-val">${snap && snap.price != null ? ST.fmtNum(snap.price) : "—"}</span>
                <span class="price-label">当前价格 · ${ST.fmtDate(active)}</span>
              </div>
            </div>
            <div class="meta-stats">
              <span class="stat">市值 ${snap ? ST.escapeHtml(snap.marketCap || "—") : "—"}</span>
              <span class="stat">快照 ${snaps.length} 个</span>
              <span class="stat">操作 ${ops.length} 条</span>
            </div>
          </div>
          <div class="concept"><b>核心概念：</b>${ST.escapeHtml(st.concept || "—")}</div>
        </div>

        <div class="v10-valuation">
          <h4>· 估值（精简 4 字段）</h4>
          <div class="v10-val-grid">
            <div class="v10-cell"><div class="lbl">现价</div><div class="val">${snap && snap.price != null ? ST.fmtNum(snap.price) : "—"}</div></div>
            <div class="v10-cell"><div class="lbl">动态 PE</div><div class="val">${val.pe != null ? ST.fmtNum(val.pe) : "—"}</div></div>
            <div class="v10-cell"><div class="lbl">ROE</div><div class="val">${val.roe != null ? ST.fmtNum(val.roe) + "%" : "—"}</div></div>
            <div class="v10-cell"><div class="lbl">PEG</div><div class="val">${val.peg != null ? ST.fmtNum(val.peg) : "—"}</div></div>
          </div>
        </div>

        <div class="stock-detail-grid">
          <div class="stock-detail-left">
            <div class="snap-section">
              <h4>· 主营业务</h4>
              <div class="snap-cell full"><div class="lbl">产品 / 服务</div><div class="val text">${snap ? ST.escapeHtml(snap.mainBusiness || "—") : "—"}</div></div>
              <div class="snap-cell full"><div class="lbl">营收 / 催化剂</div><div class="val text">${snap ? ST.escapeHtml(snap.catalysts || "—") : "—"}</div></div>
            </div>

            <div class="snap-section">
              <h4>· 历史快照</h4>
              <div class="hist-snaps">
                ${snaps.length ? snaps.map(s => `<button class="btn-tiny" data-act="jump-date" data-date="${s.date}">${ST.fmtDate(s.date)} · ${ST.fmtNum(s.price)} · PE ${s.valuation && s.valuation.pe != null ? ST.fmtNum(s.valuation.pe) : "—"}</button>`).join("") : `<span class="muted" style="font-size:12px;">暂无历史快照</span>`}
              </div>
            </div>
          </div>

          <div class="operations-side v10-op-side">
            <h3 class="v10-op-title">
              <span>· 操作建议 · 时间轴</span>
              <span class="hint">4 列抽屉 + 底部节点对齐</span>
            </h3>
            <div class="op-drawers-grid" data-stock-op-drawers="${stockKey}">
              ${ops.length ? ops.slice(0, 4).map((o, idx) => {
                const m = ST.opTypeMeta(o.type);
                return `
                  <div class="op-drawer${idx === 0 ? " is-active" : ""}" data-op-id="${o.id}" data-stock-op-id="${st.id}" data-sector-op-id="${sec.id}" data-subdivision-op-id="${sd.id}">
                    <div class="op-drawer-head">
                      <div class="op-drawer-date">${ST.fmtDate(o.date)}</div>
                      <input class="op-drawer-label" data-field="op-label" data-op-id="${o.id}" value="${ST.escapeHtml(o.label || m.label)}" placeholder="评估标签…" />
                    </div>
                    <div class="op-drawer-body">
                      <div class="op-block">
                        <div class="op-block-title"><span class="op-block-icon">📋</span> 操作建议</div>
                        <div class="op-fields-row">
                          <div class="op-field"><label>评级</label>
                            <select data-field="op-type" data-op-id="${o.id}">
                              ${["buy","add","hold","trim","sell","watch","speculative"].map(function(t) {
                                const mm = ST.opTypeMeta(t);
                                return `<option value="${t}"${o.type === t ? " selected" : ""}>${mm.label}</option>`;
                              }).join("")}
                            </select>
                          </div>
                          <div class="op-field"><label>目标价</label>
                            <input type="number" step="0.01" data-field="op-target" data-op-id="${o.id}" value="${o.target != null ? o.target : ""}" placeholder="元" />
                          </div>
                          <div class="op-field"><label>止损价</label>
                            <input type="number" step="0.01" data-field="op-stopLoss" data-op-id="${o.id}" value="${o.stopLoss != null ? o.stopLoss : ""}" placeholder="元" />
                          </div>
                        </div>
                      </div>
                      <div class="op-block">
                        <div class="op-block-title"><span class="op-block-icon">🧠</span> 投资逻辑</div>
                        <textarea class="op-textarea" data-field="op-suggestion" data-op-id="${o.id}" placeholder="为什么买/不买？核心驱动 + 估值逻辑…">${ST.escapeHtml(o.suggestion || "")}</textarea>
                      </div>
                      <div class="op-block">
                        <div class="op-block-title"><span class="op-block-icon">⚠️</span> 风险点</div>
                        <textarea class="op-textarea" data-field="op-risks" data-op-id="${o.id}" placeholder="可能的下行风险…">${ST.escapeHtml(o.risks || "")}</textarea>
                      </div>
                      <div class="op-block">
                        <div class="op-block-title"><span class="op-block-icon">🎯</span> 风向标</div>
                        <textarea class="op-textarea" data-field="op-signals" data-op-id="${o.id}" placeholder="什么信号需要重新评估…">${ST.escapeHtml(o.signals || "")}</textarea>
                      </div>
                    </div>
                    <div class="op-drawer-nav">
                      <button data-act="op-move-up" data-op-id="${o.id}" ${idx === 0 ? "disabled" : ""}>▲</button>
                      <button data-act="op-move-down" data-op-id="${o.id}" ${idx === ops.length - 1 ? "disabled" : ""}>▼</button>
                    </div>
                    <button class="op-drawer-del" data-act="del-op-drawer" data-op-id="${o.id}" title="删除节点">✕</button>
                  </div>
                `;
              }).join("") : `<div style="grid-column:1/-1;padding:24px;text-align:center;color:var(--text-dim);font-size:13px;">暂无操作建议，点击下方 ＋ 添加</div>`}
            </div>
            <div class="op-rail-wrap" data-stock-op-rail="${stockKey}">
              <button class="op-rail-nav prev" data-act="op-rail-prev" title="上一页节点">‹</button>
              <div class="op-rail-track" data-op-rail-track>
                <div class="op-rail-axis"></div>
                <div class="op-rail-progress" data-op-rail-progress></div>
              </div>
              <button class="op-rail-nav next" data-act="op-rail-next" title="下一页节点">›</button>
              <button class="op-rail-add" data-act="add-op-drawer" title="添加评估节点（手动选日期）">＋</button>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // ============================================================
  // 视图 · 操作建议详情
  // ============================================================
  App.viewOperation = function (projectId, sectorId, subdivisionId, stockId, operationId) {
    const p = ST.findProject(this.state.data, projectId);
    const sec = p && ST.findSector(p, sectorId);
    const sd  = sec && ST.findSubdivision(sec, subdivisionId);
    const st  = sd && ST.findStock(sd, stockId);
    if (!st) return `<div class="empty-state"><div class="emoji">-</div>个股不存在</div>`;

    const ops = [...(st.operations || [])].sort((a, b) => b.date.localeCompare(a.date));
    const op  = operationId ? ST.findOperation(st, operationId) : (ops[0] || null);
    const m   = op ? ST.opTypeMeta(op.type) : { color: "#7d8590", label: "操作", icon: "·" };
    const active = this.activeDate();

    const opCardHtml = op ? `
      <div class="op-detail-card">
        <div class="op-detail-head">
          <div class="big-badge" style="background:${m.color};">${m.icon}</div>
          <div class="text">
            <div class="stock">${ST.escapeHtml(st.name)} · ${m.label}</div>
            <div class="ticker">${ST.escapeHtml(st.ticker)} · ${ST.escapeHtml(st.market)} · ${ST.fmtDate(op.date)}</div>
          </div>
          <div class="spacer"></div>
          <button class="btn-tiny" data-act="add-operation" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}">+ 新建操作</button>
          <button class="btn-tiny btn-danger-ghost" data-act="del-operation" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}" data-operation-id="${op.id}">删除当前</button>
        </div>
        <div class="op-detail-stats">
          <div class="op-stat"><div class="lbl">操作类型</div><div class="val" style="color:${m.color};">${m.label}</div></div>
          <div class="op-stat"><div class="lbl">价格</div><div class="val">${op.price != null ? ST.fmtNum(op.price) : "—"}</div></div>
          <div class="op-stat"><div class="lbl">目标价</div><div class="val">${op.target != null ? ST.fmtNum(op.target) : "—"}</div></div>
          <div class="op-stat"><div class="lbl">止损</div><div class="val">${op.stopLoss != null ? ST.fmtNum(op.stopLoss) : "—"}</div></div>
          <div class="op-stat"><div class="lbl">建议仓位</div><div class="val">${ST.escapeHtml(op.position || "—")}</div></div>
        </div>
        <div class="op-suggestion">${ST.escapeHtml(op.suggestion || "—")}</div>
      </div>
    ` : `
      <div class="empty-state">
        <div class="emoji">-</div>
        <div>${ST.escapeHtml(st.name)} 暂无操作建议</div>
        <button class="btn btn-primary" data-act="add-operation" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}">+ 新建第一个操作建议</button>
      </div>
    `;

    return `
      <div class="detail-page">
        <div class="detail-head">
          <h2>
            <span style="font-size:26px;">·</span>
            ${ST.escapeHtml(st.name)} · ${m.label}建议
          </h2>
          <div class="meta">
            <span class="tag">${ST.escapeHtml(sd.name)} · ${ST.escapeHtml(sec.name)}</span>
            <span class="tag">当前节点 ${ST.fmtDate(active)}</span>
          </div>
        </div>

        ${opCardHtml}

        <div class="chain-stage">
          <div class="chain-header">
            <h3>· 该个股的全部操作建议时间线</h3>
            <button class="btn-tiny" data-act="add-operation" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}">+ 新增</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;max-height:520px;overflow-y:auto;">
            ${ops.length ? ops.map(o => {
              const mm = ST.opTypeMeta(o.type);
              return `
                <div class="op-card" data-act="open-operation" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}" data-stock-id="${st.id}" data-operation-id="${o.id}" style="border-left-color:${mm.color};">
                  <div class="head">
                    <span class="op-badge" style="color:${mm.color};border-color:${mm.color}50;background:${mm.color}18;">${mm.icon} ${mm.label}</span>
                    <span class="date">${ST.fmtDate(o.date)}</span>
                  </div>
                  <div class="body">
                    <div class="suggestion">${ST.escapeHtml(o.suggestion || "—")}</div>
                    <div class="kv">
                      <div>价格<b>${o.price != null ? ST.fmtNum(o.price) : "—"}</b></div>
                      <div>目标<b>${o.target != null ? ST.fmtNum(o.target) : "—"}</b></div>
                      <div>止损<b>${o.stopLoss != null ? ST.fmtNum(o.stopLoss) : "—"}</b></div>
                      <div>仓位<b>${ST.escapeHtml(o.position || "—")}</b></div>
                    </div>
                  </div>
                </div>
              `;
            }).join("") : `<div class="muted" style="padding:16px;text-align:center;">暂无操作建议</div>`}
          </div>
        </div>
      </div>
    `;
  };

  // ============================================================
  // 抽屉 / 表单
  // ============================================================
  App.openDrawer = function (title, bodyHtml, actionsHtml) {
    document.getElementById("drawerRoot").innerHTML = `
      <div class="drawer-mask" data-act="close-drawer-mask">
        <div class="drawer" data-stop>
          <div class="drawer-head">
            <h3>${title}</h3>
            <span class="close" data-act="close-drawer">x</span>
          </div>
          <div class="drawer-body">${bodyHtml}</div>
          <div class="drawer-body" style="border-top:1px solid var(--border);padding-top:12px;">${actionsHtml || ""}</div>
        </div>
      </div>
    `;
  };
  App.closeDrawer = function () {
    document.getElementById("drawerRoot").innerHTML = "";
  };

  // ============================================================
  // GitHub 同步模块
  // ============================================================
  App.sync = {
    _autoTimer: null,
    _inFlight: false,
    _status: 'idle',
    _statusMsg: '',

    _apiBase: function () {
      const cfg = ST.getSyncConfig();
      return 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo);
    },

    _fileUrl: function () {
      const cfg = ST.getSyncConfig();
      return this._apiBase() + '/contents/' + cfg.path.split('/').map(encodeURIComponent).join('/');
    },

    _fileUrlWithRef: function () {
      const cfg = ST.getSyncConfig();
      return this._fileUrl() + '?ref=' + encodeURIComponent(cfg.branch);
    },

    _setStatus: function (status, msg) {
      this._status = status;
      this._statusMsg = msg || '';
      this._renderStatus();
    },

    _renderStatus: function () {
      const el = document.getElementById('syncStatus');
      if (!el) return;
      const cfg = ST.getSyncConfig();
      if (!ST.isSyncConfigured()) {
        el.innerHTML = '<span class="sync-status sync-offline" title="未配置同步">☁ 未配置</span>';
        return;
      }
      const ts = cfg.lastSyncAt ? new Date(cfg.lastSyncAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—';
      let html = '<span class="sync-status sync-' + this._status + '" title="' + (this._statusMsg || ('上次同步：' + ts)) + '">';
      if (this._status === 'pushing') html += '☁ 推送中…';
      else if (this._status === 'pulling') html += '☁ 拉取中…';
      else if (this._status === 'error') html += '☁ 同步失败';
      else html += '☁ ' + ts;
      if (cfg.autoSync) html += ' <span class="sync-auto" title="自动同步已开启">⟳</span>';
      html += '</span>';
      el.innerHTML = html;
    },

    _b64encode: function (s) {
      const bytes = new TextEncoder().encode(s);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    },

    push: async function (opts) {
      opts = opts || {};
      if (!ST.isSyncConfigured()) {
        if (opts.silent !== true) alert('请先配置 GitHub 同步（顶部 ☁ 按钮）');
        return { ok: false, error: 'not_configured' };
      }
      if (this._inFlight) return { ok: false, error: 'busy' };
      this._inFlight = true;
      this._setStatus('pushing', '正在推送到 GitHub…');
      try {
        const cfg = ST.getSyncConfig();
        const dataJson = JSON.stringify(App.state.data, null, 2);
        const body = {
          message: opts.message || ('sync: ' + new Date().toISOString()),
          content: this._b64encode(dataJson),
          branch: cfg.branch,
        };
        if (cfg.lastSyncSha) body.sha = cfg.lastSyncSha;
        const resp = await fetch(this._fileUrl(), {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + cfg.token,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify(body),
        });
        const respJson = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error((respJson && respJson.message) || ('HTTP ' + resp.status));
        ST.setSyncConfig({
          lastSyncAt: Date.now(),
          lastSyncSha: respJson.content && respJson.content.sha,
        });
        this._setStatus('idle', '推送成功');
        if (opts.silent !== true) this._toast('☁ 已推送到 GitHub', 'ok');
        return { ok: true, sha: respJson.content && respJson.content.sha };
      } catch (e) {
        this._setStatus('error', e.message || String(e));
        if (opts.silent !== true) alert('推送失败：' + (e.message || e));
        return { ok: false, error: e.message || String(e) };
      } finally {
        this._inFlight = false;
      }
    },

    pull: async function (opts) {
      opts = opts || {};
      if (!ST.isSyncConfigured()) {
        if (opts.silent !== true) alert('请先配置 GitHub 同步（顶部 ☁ 按钮）');
        return { ok: false, error: 'not_configured' };
      }
      if (this._inFlight) return { ok: false, error: 'busy' };
      this._inFlight = true;
      this._setStatus('pulling', '正在从 GitHub 拉取…');
      try {
        const cfg = ST.getSyncConfig();
        const resp = await fetch(this._fileUrlWithRef(), {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer ' + cfg.token,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });
        if (resp.status === 404) throw new Error('云端暂无数据文件（请先推送一次）');
        if (!resp.ok) {
          const respJson = await resp.json().catch(() => ({}));
          throw new Error((respJson && respJson.message) || ('HTTP ' + resp.status));
        }
        const respJson = await resp.json();
        const b64 = (respJson.content || '').replace(/\n/g, '');
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const text = new TextDecoder().decode(bytes);
        const remoteData = JSON.parse(text);
        if (!remoteData || typeof remoteData !== 'object' || !Array.isArray(remoteData.projects)) {
          throw new Error('云端数据格式异常，拒绝覆盖');
        }
        if (!opts.silent && !confirm('拉取会覆盖本地当前所有数据，确定继续？')) {
          this._setStatus('idle', '已取消');
          this._inFlight = false;
          return { ok: false, error: 'cancelled' };
        }
        App.state.data = remoteData;
        App.save();
        ST.setSyncConfig({
          lastSyncAt: Date.now(),
          lastSyncSha: respJson.sha,
        });
        this._setStatus('idle', '拉取成功');
        if (opts.silent !== true) this._toast('☁ 已从 GitHub 拉取', 'ok');
        App.renderHeader();
        App.renderTimeline();
        App.renderView();
        return { ok: true };
      } catch (e) {
        this._setStatus('error', e.message || String(e));
        if (opts.silent !== true) alert('拉取失败：' + (e.message || e));
        return { ok: false, error: e.message || String(e) };
      } finally {
        this._inFlight = false;
      }
    },

    scheduleAutoPush: function () {
      const cfg = ST.getSyncConfig();
      if (!cfg.autoSync || !ST.isSyncConfigured()) return;
      clearTimeout(this._autoTimer);
      this._autoTimer = setTimeout(() => {
        this.push({ silent: true, message: 'auto-sync' });
      }, 1500);
    },

    _toast: function (msg, type) {
      const el = document.createElement('div');
      el.className = 'toast toast-' + (type || 'ok');
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => el.classList.add('show'), 10);
      setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
      }, 2200);
    },
  };

  // ============================================================
  // 表单 · 板块级 / 细分级跟踪条目
  // ============================================================
  App.formTrackingEntry = function (scope, entry) {
    const isEdit = !!entry;
    const scopeLabel = scope.type === 'sector' ? '板块整体跟踪' : '细分领域跟踪';
    const title = isEdit
      ? `编辑${scopeLabel}条目`
      : `新增${scopeLabel}条目`;
    return {
      title,
      body: `
        <div class="form-row"><label>日期</label><input class="input" id="f_teDate" type="date" value="${entry ? entry.date : (this.activeDate() || ST.todayISO())}" /></div>
        <div class="form-row"><label>跟踪内容</label><textarea class="textarea" id="f_teContent" style="min-height:120px;" placeholder="例如：国产替代政策落地，算力链国产化进入加速期。">${ST.escapeHtml(entry && entry.content || "")}</textarea></div>
        <div class="muted" style="font-size:12px;margin-top:8px;">时间轴会按此日期联动所有视图。</div>
      `,
      actions: `
        ${isEdit ? `<button class="btn btn-ghost btn-danger-ghost" data-act="delete-tracking-entry" data-scope-type="${scope.type}" data-scope-sector-id="${scope.sectorId}" data-scope-subdivision-id="${scope.subdivisionId || ''}" data-entry-id="${entry.id}">删除条目</button>` : ""}
        <div class="spacer"></div>
        <button class="btn btn-ghost" data-act="close-drawer">取消</button>
        <button class="btn btn-primary" data-act="save-tracking-entry" data-scope-type="${scope.type}" data-scope-sector-id="${scope.sectorId}" data-scope-subdivision-id="${scope.subdivisionId || ''}" data-edit-id="${entry ? entry.id : ''}">${isEdit ? "保存" : "创建"}</button>
      `,
    };
  };

  App.saveTrackingEntryFromForm = function (scopeType, sectorId, subdivisionId, editId) {
    const date = document.getElementById("f_teDate").value;
    const content = document.getElementById("f_teContent").value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return alert("日期格式错误");
    if (!content) return alert("请输入跟踪内容");
    const p = this.activeProject();
    const sec = ST.findSector(p, sectorId);
    if (!sec) return;
    if (scopeType === 'sector') {
      sec.trackingEntries = sec.trackingEntries || [];
      if (editId) {
        const ex = sec.trackingEntries.find(e => e.id === editId);
        if (ex) { ex.date = date; ex.content = content; }
      } else {
        sec.trackingEntries.push({ id: ST.uid("te-"), date, content });
      }
    } else if (scopeType === 'subdivision') {
      const sd = ST.findSubdivision(sec, subdivisionId);
      if (!sd) return;
      sd.trackingEntries = sd.trackingEntries || [];
      if (editId) {
        const ex = sd.trackingEntries.find(e => e.id === editId);
        if (ex) { ex.date = date; ex.content = content; }
      } else {
        sd.trackingEntries.push({ id: ST.uid("te-"), date, content });
      }
    }
    this.save();
    const drawerTitle = (document.querySelector(".drawer-head h3") || {}).textContent || "";
    if (drawerTitle.indexOf("编辑板块") === 0) {
      const stillSec = ST.findSector(this.activeProject(), sectorId);
      const f = this.formSector(stillSec);
      this.openDrawer(f.title, f.body, f.actions);
    } else {
      this.closeDrawer();
    }
    this.renderTimeline();
    this.renderView();
  };

  App.deleteTrackingEntry = function (scopeType, sectorId, subdivisionId, entryId) {
    if (!confirm("确定删除该跟踪条目？")) return;
    const p = this.activeProject();
    const sec = ST.findSector(p, sectorId);
    if (!sec) return;
    if (scopeType === 'sector') {
      sec.trackingEntries = (sec.trackingEntries || []).filter(e => e.id !== entryId);
    } else if (scopeType === 'subdivision') {
      const sd = ST.findSubdivision(sec, subdivisionId);
      if (sd) sd.trackingEntries = (sd.trackingEntries || []).filter(e => e.id !== entryId);
    }
    this.save();
    const drawerTitle = (document.querySelector(".drawer-head h3") || {}).textContent || "";
    if (drawerTitle.indexOf("编辑板块") === 0) {
      const stillSec = ST.findSector(this.activeProject(), sectorId);
      const f = this.formSector(stillSec);
      this.openDrawer(f.title, f.body, f.actions);
    } else {
      this.closeDrawer();
    }
    this.renderTimeline();
    this.renderView();
  };

  App.formProject = function (proj) {
    const isEdit = !!proj;
    return {
      title: isEdit ? "编辑项目" : "新建项目",
      body: `
        <div class="form-row"><label>项目名称</label><input class="input" id="f_projName" value="${ST.escapeHtml(proj && proj.name || "")}" placeholder="例如：AI 算力革命" /></div>
        <div class="form-row"><label>Emoji 图标</label><input class="input" id="f_projEmoji" value="${ST.escapeHtml(proj && proj.emoji || "·")}" maxlength="4" /></div>
        <div class="form-row"><label>主题色</label><input class="input" id="f_projColor" type="color" value="${proj && proj.color || "#58a6ff"}" /></div>
        <div class="form-row"><label>描述</label><textarea class="textarea" id="f_projDesc" placeholder="一句话说明这个项目跟踪的目标">${ST.escapeHtml(proj && proj.description || "")}</textarea></div>
      `,
      actions: `
        ${isEdit ? `<button class="btn btn-ghost btn-danger-ghost" data-act="delete-project">删除项目</button>` : ""}
        <div class="spacer"></div>
        <button class="btn btn-ghost" data-act="close-drawer">取消</button>
        <button class="btn btn-primary" data-act="save-project" data-edit-id="${proj ? proj.id : ""}">${isEdit ? "保存" : "创建"}</button>
      `,
    };
  };

  // ============================================================
  // 表单 · GitHub 同步设置
  // ============================================================
  App.formSyncSettings = function () {
    const cfg = ST.getSyncConfig();
    const isConfigured = ST.isSyncConfigured();
    return {
      title: "☁ GitHub 同步设置",
      body: `
        <div class="muted" style="font-size:12px;margin-bottom:10px;line-height:1.6;">
          把数据存到你的 GitHub 仓库的 <code>${cfg.path}</code> 文件里，跨设备/浏览器自动共享。<br>
          需要一个 <b>Fine-grained Personal Access Token</b>，权限 <b>Contents: Read and write</b>，范围限本仓库。
        </div>
        <div class="form-row"><label>GitHub 用户名</label><input class="input" id="f_syncOwner" value="${ST.escapeHtml(cfg.owner)}" placeholder="例如：pinocchiozk" /></div>
        <div class="form-row"><label>仓库名</label><input class="input" id="f_syncRepo" value="${ST.escapeHtml(cfg.repo)}" placeholder="例如：pinocchiozk-industry-tracker" /></div>
        <div class="form-row"><label>分支</label><input class="input" id="f_syncBranch" value="${ST.escapeHtml(cfg.branch)}" placeholder="main" /></div>
        <div class="form-row"><label>数据文件路径</label><input class="input" id="f_syncPath" value="${ST.escapeHtml(cfg.path)}" placeholder="tracker-data.json" /></div>
        <div class="form-row"><label>Personal Access Token</label><div class="form-cell"><input class="input" id="f_syncToken" type="password" value="${ST.escapeHtml(cfg.token)}" placeholder="github_pat_xxx..." autocomplete="off" /><div class="muted" style="font-size:11px;margin-top:4px;">仅保存在你的浏览器 localStorage，绝不外传。<br>获取：GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → 生成时只勾选本仓库的 Contents 读写权限。</div></div></div>
        <div class="form-row"><label>自动同步</label><div class="form-cell"><label class="checkbox-row"><input type="checkbox" id="f_syncAuto" ${cfg.autoSync ? 'checked' : ''} /> 修改后自动推送到 GitHub（1.5 秒节流）</label></div></div>
        ${isConfigured ? `<div class="muted" style="font-size:11px;color:var(--green);">✓ 已配置 · 上次同步：${cfg.lastSyncAt ? new Date(cfg.lastSyncAt).toLocaleString('zh-CN') : '尚未同步'}</div>` : ''}
      `,
      actions: `
        ${isConfigured ? '<button class="btn btn-ghost btn-danger-ghost" data-act="clear-sync-config">清除配置</button>' : ''}
        <div class="spacer"></div>
        <button class="btn btn-ghost" data-act="close-drawer">取消</button>
        <button class="btn btn-primary" data-act="save-sync-config">保存配置</button>
      `,
    };
  };

  App.saveSyncConfigFromForm = function () {
    const owner = document.getElementById('f_syncOwner').value.trim();
    const repo = document.getElementById('f_syncRepo').value.trim();
    const branch = document.getElementById('f_syncBranch').value.trim() || 'main';
    const path = document.getElementById('f_syncPath').value.trim() || 'tracker-data.json';
    const token = document.getElementById('f_syncToken').value.trim();
    const autoSync = document.getElementById('f_syncAuto').checked;
    if (!owner || !repo) return alert('请填写 GitHub 用户名和仓库名');
    if (!token) return alert('请填写 Personal Access Token');
    ST.setSyncConfig({ owner, repo, branch, path, token, autoSync });
    this.closeDrawer();
    this.sync._renderStatus();
    alert('同步配置已保存。点击顶部「☁ 推送到 GitHub」开始首次同步。');
  };

  App.clearSyncConfig = function () {
    if (!confirm('确定清除同步配置？清除后需要重新设置。')) return;
    localStorage.removeItem(ST.SYNC_CONFIG_KEY);
    this.closeDrawer();
    this.sync._renderStatus();
    alert('同步配置已清除。');
  };

  App.formSector = function (sec) {
    const isEdit = !!sec;
    const trackingList = isEdit ? (sec.trackingEntries || []) : [];
    const trackingListHtml = isEdit ? `
      <div class="form-row form-row-top">
        <label>板块级跟踪</label>
        <div class="form-cell">
          <div class="muted" style="font-size:12px;margin-bottom:6px;">支持编辑板块整体（不指定个股）的跟踪事件。保存板块时会一并保存。</div>
          <div class="tracking-entries-list" data-sector-id="${sec.id}">
            ${trackingList.length ? trackingList.map(e => `
              <div class="tracking-entry-row" data-entry-id="${e.id}">
                <span class="te-date">${ST.fmtDate(e.date)}</span>
                <span class="te-content">${ST.escapeHtml(e.content)}</span>
                <button class="btn-tiny" data-act="edit-sector-tracking" data-sector-id="${sec.id}" data-entry-id="${e.id}" title="编辑此条目">✎</button>
                <button class="btn-del" data-act="del-sector-tracking" data-sector-id="${sec.id}" data-entry-id="${e.id}" title="删除此条目">✕</button>
              </div>
            `).join("") : `<div class="muted" style="font-size:12px;padding:8px 0;">该板块暂无整体跟踪条目。可在主页用板块下方的快速输入添加，或点击下方"+ 新增整体跟踪"。</div>`}
          </div>
          <button class="btn-tiny" style="margin-top:6px;" data-act="add-sector-tracking" data-sector-id="${sec.id}">+ 新增整体跟踪</button>
        </div>
      </div>
    ` : "";
    return {
      title: isEdit ? `编辑板块 · ${ST.escapeHtml(sec.name)}` : "新建板块",
      body: `
        <div class="form-row"><label>板块名称</label><input class="input" id="f_secName" value="${ST.escapeHtml(sec && sec.name || "")}" placeholder="例如：AI 芯片" /></div>
        <div class="form-row"><label>图标 (emoji)</label><div class="form-cell"><input class="input" id="f_secIcon" value="${ST.escapeHtml(sec && sec.icon || "·")}" maxlength="8" />${this.emojiPickerHtml("f_secIcon")}</div></div>
        <div class="form-row"><label>主题色</label><input class="input" id="f_secColor" type="color" value="${(sec && sec.color) || (sec && sec.chainNodes && sec.chainNodes[0] && sec.chainNodes[0].color) || "#58a6ff"}" /></div>
        <div class="form-row"><label>描述</label><textarea class="textarea" id="f_secDesc">${ST.escapeHtml(sec && sec.description || "")}</textarea></div>
        ${trackingListHtml}
        ${!isEdit ? `<div class="muted" style="font-size:12px;margin-top:8px;">创建后您可以在产业链全景图上手动添加节点，也可在主页里为板块添加整体跟踪条目。</div>` : ""}
      `,
      actions: `
        ${isEdit ? `<button class="btn btn-ghost btn-danger-ghost" data-act="delete-sector" data-sector-id="${sec.id}">删除板块</button>` : ""}
        <div class="spacer"></div>
        <button class="btn btn-ghost" data-act="close-drawer">取消</button>
        <button class="btn btn-primary" data-act="save-sector" data-edit-id="${sec ? sec.id : ""}">${isEdit ? "保存" : "创建"}</button>
      `,
    };
  };

  // ---------- 时间节点表单 ----------
  App.formTimelineNode = function (date) {
    const meta = ST.getTimelineMeta(this.state.data, date);
    const isCreate = !date;
    return {
      title: isCreate ? "新增时间节点" : `编辑时间节点 ${ST.fmtDate(date)}`,
      body: `
        <div class="form-row"><label>日期</label><input class="input" id="f_tnDate" type="date" value="${date || ST.todayISO()}" ${isCreate ? '' : 'readonly style="opacity:0.6;cursor:not-allowed;"'} /></div>
        <div class="form-row"><label>节点标签</label><input class="input" id="f_tnLabel" value="${ST.escapeHtml(meta.label)}" placeholder="例如：英伟达 GTC 大会、台积电 Q1 财报、CFS 聚变突破" /></div>
        <div class="form-row"><label>节点备注</label><textarea class="textarea" id="f_tnNote" placeholder="这一天发生的关键事件摘要">${ST.escapeHtml(meta.note)}</textarea></div>
        <div class="muted" style="font-size:12px;margin-top:8px;">标签会显示在时间轴节点下方，备注悬停时显示。该节点的所有跟踪、快照、操作仍按日期归属。</div>
      `,
      actions: `
        ${date && (meta.label || meta.note) ? `<button class="btn btn-ghost btn-danger-ghost" data-act="clear-timeline-meta" data-date="${date}">清除标签/备注</button>` : ''}
        <div class="spacer"></div>
        <button class="btn btn-ghost" data-act="close-drawer">取消</button>
        <button class="btn btn-primary" data-act="save-timeline-meta" data-date="${date || ''}">${isCreate ? '创建节点' : '保存'}</button>
      `,
    };
  };
  // 通用 emoji 选择器
    App.emojiPickerHtml = function (inputId) {
    const presets = (window.ST && window.ST.EMOJI_PRESETS) || ["??","??","??","??","??","??","?","??","???","??","??","??","??","??","??","??","??","?","??","??"];
    return `<div class="emoji-picker" data-emoji-for="${inputId}">${presets.map(e => `<button type="button" class="emoji-chip" data-emoji="${e}" data-emoji-target="${inputId}">${e}</button>`).join("")}</div>`;
  };
  App.formChainNode = function (sec, node) {
    const isEdit = !!node;
    return {
      title: isEdit ? "编辑产业链节点" : "新增产业链节点",
      body: `
        <div class="form-row"><label>节点名称</label><input class="input" id="f_cnLabel" value="${ST.escapeHtml(node && node.label || "")}" placeholder="例如：GPU 芯片设计" /></div>
        <div class="form-row"><label>图标 (emoji)</label><div class="form-cell"><input class="input" id="f_cnIcon" value="${ST.escapeHtml(node && node.icon || "·")}" maxlength="8" />${this.emojiPickerHtml("f_cnIcon")}</div></div>
        <div class="form-row"><label>颜色</label><input class="input" id="f_cnColor" type="color" value="${node && node.color || "#58a6ff"}" /></div>
        <div class="form-row"><label>X 坐标 (0-100)</label><input class="input" id="f_cnX" type="number" min="2" max="98" step="1" value="${node ? node.x : 50}" /></div>
        <div class="form-row"><label>Y 坐标 (0-100)</label><input class="input" id="f_cnY" type="number" min="10" max="90" step="1" value="${node ? node.y : 50}" /></div>
      `,
      actions: `
        ${isEdit ? `<button class="btn btn-ghost btn-danger-ghost" data-act="delete-chain-node" data-sector-id="${sec.id}" data-node-id="${node.id}">删除节点</button>` : ""}
        <div class="spacer"></div>
        <button class="btn btn-ghost" data-act="close-drawer">取消</button>
        <button class="btn btn-primary" data-act="save-chain-node" data-sector-id="${sec.id}" data-edit-id="${node ? node.id : ""}">${isEdit ? "保存" : "添加"}</button>
      `,
    };
  };

  App.formSubdivision = function (sec, sd, prefillChainNodeId) {
    const isEdit = !!sd;
    return {
      title: isEdit ? "编辑细分领域" : "新建细分领域",
      body: `
        <div class="form-row"><label>细分领域名称</label><input class="input" id="f_sdName" value="${ST.escapeHtml(sd && sd.name || "")}" placeholder="例如：GPU 芯片设计" /></div>
        <div class="form-row"><label>图标 (emoji)</label><div class="form-cell"><input class="input" id="f_sdIcon" value="${ST.escapeHtml(sd && sd.icon || "·")}" maxlength="8" />${this.emojiPickerHtml("f_sdIcon")}</div></div>
        <div class="form-row"><label>主题色</label><input class="input" id="f_sdColor" type="color" value="${sd && sd.color || "#58a6ff"}" /></div>
        <div class="form-row">
          <label>关联产业链节点</label>
          <select class="input" id="f_sdChain">
            <option value="">（不关联）</option>
            ${sec.chainNodes.map(n => `<option value="${n.id}" ${(sd && sd.chainNodeId === n.id) || prefillChainNodeId === n.id ? "selected" : ""}>${ST.escapeHtml(n.label)}</option>`).join("")}
          </select>
        </div>
      `,
      actions: `
        ${isEdit ? `<button class="btn btn-ghost btn-danger-ghost" data-act="delete-subdivision" data-sector-id="${sec.id}" data-subdivision-id="${sd.id}">删除</button>` : ""}
        <div class="spacer"></div>
        <button class="btn btn-ghost" data-act="close-drawer">取消</button>
        <button class="btn btn-primary" data-act="save-subdivision" data-sector-id="${sec.id}" data-edit-id="${sd ? sd.id : ""}">${isEdit ? "保存" : "创建"}</button>
      `,
    };
  };

  App.formStock = function (sd, st) {
    const isEdit = !!st;
    return {
      title: isEdit ? "编辑个股" : "新增个股",
      body: `
        <div class="form-row"><label>个股名称</label><input class="input" id="f_stName" value="${ST.escapeHtml(st && st.name || "")}" placeholder="例如：英伟达" /></div>
        <div class="form-row"><label>代码 (Ticker)</label><input class="input" id="f_stTicker" value="${ST.escapeHtml(st && st.ticker || "")}" placeholder="例如：NVDA" /></div>
        <div class="form-row">
          <label>市场</label>
          <select class="input" id="f_stMarket">
            ${["美股", "港股", "A股", "科创板", "创业板", "韩股", "日股", "台股", "美股 ADR", "英股", "欧股", "加密货币", "私募", "其他"]
              .map(m => `<option ${(st && st.market === m) ? "selected" : ""}>${m}</option>`).join("")}
          </select>
        </div>
        <div class="form-row"><label>核心概念</label><textarea class="textarea" id="f_stConcept">${ST.escapeHtml(st && st.concept || "")}</textarea></div>
      `,
      actions: `
        ${isEdit ? `<button class="btn btn-ghost btn-danger-ghost" data-act="delete-stock" data-subdivision-id="${sd.id}" data-stock-id="${st.id}">删除个股</button>` : ""}
        <div class="spacer"></div>
        <button class="btn btn-ghost" data-act="close-drawer">取消</button>
        <button class="btn btn-primary" data-act="save-stock" data-subdivision-id="${sd.id}" data-edit-id="${st ? st.id : ""}">${isEdit ? "保存" : "创建"}</button>
      `,
    };
  };

  App.formSnapshot = function (st, snap, presetDate) {
    const isEdit = !!snap;
    const v = (snap && snap.valuation) || {};
    return {
      title: isEdit ? "编辑快照" : "新增个股快照",
      body: `
        <div class="form-row"><label>快照日期</label><input class="input" id="f_snDate" type="date" value="${snap ? snap.date : (presetDate || this.activeDate())}" /></div>
        <div class="form-row"><label>价格</label><input class="input" id="f_snPrice" type="number" step="any" value="${snap && snap.price != null ? snap.price : ""}" /></div>
        <div class="form-row"><label>市值</label><input class="input" id="f_snMCap" value="${ST.escapeHtml(snap && snap.marketCap || "")}" placeholder="例如：3.2T USD" /></div>
        <div class="form-row"><label>PE</label><input class="input" id="f_snPE" type="number" step="any" value="${v.pe != null ? v.pe : ""}" /></div>
        <div class="form-row"><label>PEG</label><input class="input" id="f_snPEG" type="number" step="any" value="${v.peg != null ? v.peg : ""}" /></div>
        <div class="form-row"><label>PB</label><input class="input" id="f_snPB" type="number" step="any" value="${v.pb != null ? v.pb : ""}" /></div>
        <div class="form-row"><label>PS</label><input class="input" id="f_snPS" type="number" step="any" value="${v.ps != null ? v.ps : ""}" /></div>
        <div class="form-row"><label>主营业务产品</label><textarea class="textarea" id="f_snBiz">${ST.escapeHtml(snap && snap.mainBusiness || "")}</textarea></div>
        <div class="form-row"><label>营收 / 业绩</label><textarea class="textarea" id="f_snRev">${ST.escapeHtml(snap && snap.revenue || "")}</textarea></div>
        <div class="form-row"><label>毛利率</label><input class="input" id="f_snGM" value="${ST.escapeHtml(snap && snap.grossMargin || "")}" placeholder="例如：78%" /></div>
        <div class="form-row"><label>驱动 / 催化剂</label><textarea class="textarea" id="f_snCat">${ST.escapeHtml(snap && snap.catalysts || "")}</textarea></div>
      `,
      actions: `
        ${isEdit ? `<button class="btn btn-ghost btn-danger-ghost" data-act="delete-snapshot" data-stock-id="${st.id}" data-snap-id="${snap.id}">删除快照</button>` : ""}
        <div class="spacer"></div>
        <button class="btn btn-ghost" data-act="close-drawer">取消</button>
        <button class="btn btn-primary" data-act="save-snapshot" data-stock-id="${st.id}" data-edit-id="${snap ? snap.id : ""}">${isEdit ? "保存" : "创建"}</button>
      `,
    };
  };

  App.formOperation = function (st, op, presetDate) {
    const isEdit = !!op;
    return {
      title: isEdit ? "编辑操作建议" : "新增操作建议",
      body: `
        <div class="form-row"><label>日期</label><input class="input" id="f_opDate" type="date" value="${op ? op.date : (presetDate || this.activeDate())}" /></div>
        <div class="form-row">
          <label>操作类型</label>
          <select class="input" id="f_opType">
            ${[["buy","· 建仓"],["add","+ 加仓"],["hold","· 持有"],["trim","- 减仓"],["sell","x 清仓"],["watch","· 观察"],["speculative","~ 博弈"]]
              .map(([v,l]) => `<option value="${v}" ${op && op.type===v?"selected":""}>${l}</option>`).join("")}
          </select>
        </div>
        <div class="form-row"><label>价格</label><input class="input" id="f_opPrice" type="number" step="any" value="${op && op.price != null ? op.price : ""}" /></div>
        <div class="form-row"><label>目标价</label><input class="input" id="f_opTarget" type="number" step="any" value="${op && op.target != null ? op.target : ""}" /></div>
        <div class="form-row"><label>止损</label><input class="input" id="f_opStop" type="number" step="any" value="${op && op.stopLoss != null ? op.stopLoss : ""}" /></div>
        <div class="form-row"><label>仓位</label><input class="input" id="f_opPos" value="${ST.escapeHtml(op && op.position || "")}" placeholder="例如：建仓 20% / 加仓至 35%" /></div>
        <div class="form-row"><label>详细建议</label><textarea class="textarea" id="f_opSug" style="min-height:120px;">${ST.escapeHtml(op && op.suggestion || "")}</textarea></div>
      `,
      actions: `
        ${isEdit ? `<button class="btn btn-ghost btn-danger-ghost" data-act="delete-operation" data-stock-id="${st.id}" data-operation-id="${op.id}">删除</button>` : ""}
        <div class="spacer"></div>
        <button class="btn btn-ghost" data-act="close-drawer">取消</button>
        <button class="btn btn-primary" data-act="save-operation" data-stock-id="${st.id}" data-edit-id="${op ? op.id : ""}">${isEdit ? "保存" : "创建"}</button>
      `,
    };
  };

  // ============================================================
  // 保存逻辑
  // ============================================================
  App.saveProjectFromForm = function (editId) {
    const name = document.getElementById("f_projName").value.trim();
    if (!name) return alert("请输入项目名称");
    const data = {
      name,
      emoji: document.getElementById("f_projEmoji").value || "·",
      color: document.getElementById("f_projColor").value || "#58a6ff",
      description: document.getElementById("f_projDesc").value.trim(),
    };
    if (editId) {
      const p = ST.findProject(this.state.data, editId);
      Object.assign(p, data);
    } else {
      const p = { id: ST.uid("p-"), createdAt: ST.todayISO(), sectors: [], ...data };
      this.state.data.projects.push(p);
      this.state.data.activeProjectId = p.id;
    }
    this.save(); this.closeDrawer(); this.renderHeader(); this.renderTimeline(); this.renderView();
  };

  App.saveSectorFromForm = function (editId) {
    const p = this.activeProject();
    const iconEl = document.getElementById("f_secIcon");
    const colorEl = document.getElementById("f_secColor");
    const data = {
      name: document.getElementById("f_secName").value.trim(),
      icon: (iconEl && iconEl.value) || "·",
      color: (colorEl && colorEl.value) || "#58a6ff",
      description: document.getElementById("f_secDesc").value.trim(),
    };
    if (!data.name) return alert("请输入板块名称");
    if (editId) {
      const s = ST.findSector(p, editId);
      Object.assign(s, data);
    } else {
      const s = { id: ST.uid("s-"), chainNodes: [], subdivisions: [], trackingEntries: [], ...data };
      p.sectors.push(s);
    }
    this.save(); this.closeDrawer(); this.renderHeader(); this.renderTimeline(); this.renderView();
  };

  App.saveChainNodeFromForm = function (sectorId, editId) {
    const p = this.activeProject();
    const sec = ST.findSector(p, sectorId);
    const data = {
      label: document.getElementById("f_cnLabel").value.trim(),
      icon:  document.getElementById("f_cnIcon").value || "·",
      color: document.getElementById("f_cnColor").value,
      x: Math.max(2, Math.min(98, parseFloat(document.getElementById("f_cnX").value) || 50)),
      y: Math.max(10, Math.min(90, parseFloat(document.getElementById("f_cnY").value) || 50)),
    };
    if (!data.label) return alert("请输入节点名称");
    if (editId) {
      const n = ST.findChainNode(sec, editId); Object.assign(n, data);
    } else {
      sec.chainNodes.push({ id: ST.uid("cn-"), ...data });
    }
    this.save(); this.closeDrawer(); this.renderView();
  };

  App.saveSubdivisionFromForm = function (sectorId, editId) {
    const p = this.activeProject();
    const sec = ST.findSector(p, sectorId);
    const data = {
      name: document.getElementById("f_sdName").value.trim(),
      icon: document.getElementById("f_sdIcon").value || "·",
      color: document.getElementById("f_sdColor").value,
      chainNodeId: document.getElementById("f_sdChain").value || null,
    };
    if (!data.name) return alert("请输入细分领域名称");
    if (editId) {
      const sd = ST.findSubdivision(sec, editId); Object.assign(sd, data);
    } else {
      sec.subdivisions.push({ id: ST.uid("sd-"), trackingEntries: [], stocks: [], ...data });
    }
    this.save(); this.closeDrawer(); this.renderTimeline(); this.renderView();
  };

  App.saveStockFromForm = function (subdivisionId, editId) {
    const p = this.activeProject();
    const data = {
      name: document.getElementById("f_stName").value.trim(),
      ticker: document.getElementById("f_stTicker").value.trim(),
      market: document.getElementById("f_stMarket").value,
      concept: document.getElementById("f_stConcept").value.trim(),
    };
    if (!data.name) return alert("请输入个股名称");
    if (!data.ticker) return alert("请输入代码");
    let targetSd = null;
    for (const sec of p.sectors) {
      const sd = ST.findSubdivision(sec, subdivisionId); if (sd) { targetSd = sd; break; }
    }
    if (!targetSd) return;
    targetSd.stocks = targetSd.stocks || [];
    if (editId) {
      const st = ST.findStock(targetSd, editId); Object.assign(st, data);
    } else {
      targetSd.stocks.push({ id: ST.uid("st-"), snapshots: [], operations: [], ...data });
    }
    this.save(); this.closeDrawer(); this.renderTimeline(); this.renderView();
  };

  App.saveSnapshotFromForm = function (stockId, editId) {
    const p = this.activeProject();
    let stock = null;
    for (const sec of p.sectors) for (const sd of sec.subdivisions) {
      const st = ST.findStock(sd, stockId); if (st) { stock = st; break; }
    }
    if (!stock) return;
    const num = (id) => { const v = document.getElementById(id).value.trim(); return v === "" ? null : parseFloat(v); };
    const data = {
      date: document.getElementById("f_snDate").value || ST.todayISO(),
      price: num("f_snPrice"),
      marketCap: document.getElementById("f_snMCap").value.trim(),
      valuation: { pe: num("f_snPE"), peg: num("f_snPEG"), pb: num("f_snPB"), ps: num("f_snPS") },
      mainBusiness: document.getElementById("f_snBiz").value.trim(),
      revenue: document.getElementById("f_snRev").value.trim(),
      grossMargin: document.getElementById("f_snGM").value.trim(),
      catalysts: document.getElementById("f_snCat").value.trim(),
    };
    stock.snapshots = stock.snapshots || [];
    if (editId) {
      const idx = stock.snapshots.findIndex(s => s.id === editId);
      if (idx >= 0) stock.snapshots[idx] = { ...stock.snapshots[idx], ...data };
    } else {
      stock.snapshots.push({ id: ST.uid("sn-"), ...data });
    }
    this.save(); this.closeDrawer(); this.renderTimeline(); this.renderView();
  };

  App.saveOperationFromForm = function (stockId, editId) {
    const p = this.activeProject();
    let stock = null;
    for (const sec of p.sectors) for (const sd of sec.subdivisions) {
      const st = ST.findStock(sd, stockId); if (st) { stock = st; break; }
    }
    if (!stock) return;
    const num = (id) => { const v = document.getElementById(id).value.trim(); return v === "" ? null : parseFloat(v); };
    const data = {
      date: document.getElementById("f_opDate").value || ST.todayISO(),
      type: document.getElementById("f_opType").value,
      price: num("f_opPrice"),
      target: num("f_opTarget"),
      stopLoss: num("f_opStop"),
      position: document.getElementById("f_opPos").value.trim(),
      suggestion: document.getElementById("f_opSug").value.trim(),
    };
    stock.operations = stock.operations || [];
    if (editId) {
      const idx = stock.operations.findIndex(o => o.id === editId);
      if (idx >= 0) stock.operations[idx] = { ...stock.operations[idx], ...data };
    } else {
      stock.operations.push({ id: ST.uid("op-"), ...data });
    }
    this.save(); this.closeDrawer(); this.renderTimeline(); this.renderView();
  };

  App.saveTrackingFromForm = function (subdivisionId) {
    const date = document.getElementById("trackDate").value;
    const content = document.getElementById("trackContent").value.trim();
    if (!date) return alert("请选择日期");
    if (!content) return alert("请输入跟踪内容");
    const p = this.activeProject();
    let sd = null;
    for (const sec of p.sectors) {
      const x = ST.findSubdivision(sec, subdivisionId); if (x) { sd = x; break; }
    }
    if (!sd) return;
    sd.trackingEntries = sd.trackingEntries || [];
    sd.trackingEntries.push({ id: ST.uid("te-"), date, content });
    this.save();
    document.getElementById("trackContent").value = "";
    this.renderTimeline(); this.renderView();
    if (date !== this.activeDate()) this.setActiveDate(date);
  };

  // ============================================================
  // 删除
  // ============================================================
  App.deleteProject = function () {
    if (!confirm("确定删除当前项目？此操作不可撤销。")) return;
    this.state.data.projects = this.state.data.projects.filter(p => p.id !== this.state.data.activeProjectId);
    this.state.data.activeProjectId = this.state.data.projects[0] ? this.state.data.projects[0].id : null;
    this.save(); this.closeDrawer(); this.goHome();
  };
  App.deleteSector = function (sid) {
    if (!confirm("删除板块将清空其下所有细分与个股，是否继续？")) return;
    const p = this.activeProject();
    p.sectors = p.sectors.filter(s => s.id !== sid);
    this.save(); this.closeDrawer(); this.renderView();
  };
  App.deleteChainNode = function (sid, nid) {
    if (!confirm("删除产业链节点？关联的细分领域不会被删除。")) return;
    const p = this.activeProject();
    const sec = ST.findSector(p, sid);
    sec.chainNodes = sec.chainNodes.filter(n => n.id !== nid);
    this.save(); this.closeDrawer(); this.renderView();
  };
  App.deleteSubdivision = function (sid, sdid) {
    if (!confirm("删除细分领域将清空其下所有个股与跟踪？")) return;
    const p = this.activeProject();
    const sec = ST.findSector(p, sid);
    sec.subdivisions = sec.subdivisions.filter(sd => sd.id !== sdid);
    this.save(); this.closeDrawer(); this.renderView();
  };
  App.deleteStock = function (sdid, stid) {
    if (!confirm("删除个股？其下快照与操作也将清空。")) return;
    const p = this.activeProject();
    for (const sec of p.sectors) {
      const sd = ST.findSubdivision(sec, sdid);
      if (sd) { sd.stocks = (sd.stocks || []).filter(s => s.id !== stid); break; }
    }
    this.save(); this.closeDrawer(); this.renderView();
  };
  App.deleteSnapshot = function (stid, snid) {
    if (!confirm("删除该快照？")) return;
    const p = this.activeProject();
    for (const sec of p.sectors) for (const sd of sec.subdivisions) {
      const st = ST.findStock(sd, stid); if (st) {
        st.snapshots = (st.snapshots || []).filter(s => s.id !== snid); break;
      }
    }
    this.save(); this.closeDrawer(); this.renderView();
  };
  App.deleteOperation = function (stid, opid) {
    if (!confirm("删除该操作建议？")) return;
    const p = this.activeProject();
    for (const sec of p.sectors) for (const sd of sec.subdivisions) {
      const st = ST.findStock(sd, stid); if (st) {
        st.operations = (st.operations || []).filter(o => o.id !== opid); break;
      }
    }
    this.save(); this.closeDrawer(); this.renderView();
  };
  App.deleteTracking = function (sdid, eid) {
    const p = this.activeProject();
    for (const sec of p.sectors) {
      const sd = ST.findSubdivision(sec, sdid); if (sd) {
        sd.trackingEntries = (sd.trackingEntries || []).filter(e => e.id !== eid); break;
      }
    }
    this.save(); this.renderTimeline(); this.renderView();
  };

  // ============================================================
  // 时间轴管理
  // ============================================================
  App.addTimelineDate = function () {
    const f = this.formTimelineNode(null);
    this.openDrawer(f.title, f.body, f.actions);
  };
  App.editTimelineDate = function (date) {
    if (!date) return alert("请先选择时间节点");
    const f = this.formTimelineNode(date);
    this.openDrawer(f.title, f.body, f.actions);
  };
  App.saveTimelineMetaFromForm = function (oldDate) {
    const newDate = document.getElementById("f_tnDate").value;
    const label = document.getElementById("f_tnLabel").value.trim();
    const note  = document.getElementById("f_tnNote").value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return alert("日期格式错误");
    if (!oldDate) {
      // 新增节点
      if (this.state.data.timelineDates.includes(newDate)) return alert("该日期已存在");
      this.state.data.timelineDates.push(newDate);
    } else if (oldDate !== newDate) {
      // 改名：迁移 meta
      if (this.state.data.timelineDates.includes(newDate)) return alert("目标日期已存在");
      this.state.data.timelineDates = this.state.data.timelineDates.map(d => d === oldDate ? newDate : d);
      const oldMeta = ST.getTimelineMeta(this.state.data, oldDate);
      ST.setTimelineMeta(this.state.data, oldDate, null);
      if (label || note) ST.setTimelineMeta(this.state.data, newDate, { label, note });
      if (this.state.data.activeDate === oldDate) this.state.data.activeDate = newDate;
      this.save(); this.closeDrawer(); this.renderHeader(); this.renderTimeline(); this.renderView(); return;
    }
    ST.setTimelineMeta(this.state.data, newDate, { label, note });
    this.save(); this.closeDrawer(); this.renderTimeline(); this.renderView();
  };
  App.deleteTimelineDate = function () {
    const d = this.activeDate();
    if (!d) return;
    if (!confirm(`删除时间节点 ${ST.fmtDate(d)}？`)) return;
    this.state.data.timelineDates = this.state.data.timelineDates.filter(x => x !== d);
    this.state.data.activeDate = this.state.data.timelineDates[0] || null;
    this.save(); this.renderTimeline(); this.renderView();
  };

  // ============================================================
  // 导入 / 导出 / 重置
  // ============================================================
  App.exportData = function () {
    const blob = new Blob([JSON.stringify(this.state.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `industry-tracker-${ST.todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  App.importData = function (file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const data = JSON.parse(fr.result);
        if (!data.projects || !data.timelineDates) throw new Error("JSON 格式不正确");
        if (!confirm("导入将覆盖当前所有数据，是否继续？")) return;
        this.state.data = data; this.save();
        this.renderHeader(); this.renderTimeline(); this.renderView();
      } catch (e) { alert("导入失败：" + e.message); }
    };
    fr.readAsText(file);
  };
  App.resetData = function () {
    if (!confirm("重置为示例数据？当前所有修改将丢失。")) return;
    this.state.data = ST.resetData();
    this.renderHeader(); this.renderTimeline(); this.renderView();
  };

  // ============================================================
  // 全局点击事件分发
  // ============================================================
  App.openChainNodeAsSubdivision = function (sec, chainNode) {
    if (!sec || !chainNode) return;
    const f = this.formSubdivision(sec, null, chainNode.id);
    f.title = `在「${chainNode.label}」节点创建细分领域`;
    this.openDrawer(f.title, f.body, f.actions);
  };

  App.handleGlobalClick = function (e) {
    // 在 drawer 内点击时，绝不能让 e.target.closest 越过 drawer 边界去匹配外层（如 drawer-mask 的 close）
    let el = null;
    const drawerEl = e.target && e.target.closest && e.target.closest(".drawer");
    if (drawerEl) {
      let node = e.target;
      while (node && node !== drawerEl) {
        if (node.dataset && node.dataset.act) { el = node; break; }
        node = node.parentElement;
      }
    } else {
      el = e.target && e.target.closest && e.target.closest("[data-act]");
    }
    if (!el) {
      // ?? emoji ????data-emoji ????
      const chip = e.target && e.target.closest && e.target.closest('.emoji-chip[data-emoji]');
      if (chip) {
        const emoji = chip.dataset.emoji;
        const targetId = chip.dataset.emojiTarget;
        if (targetId) {
          const inp = document.getElementById(targetId);
          if (inp) {
            inp.value = emoji;
            inp.focus();
            // ???????? chip ? .is-selected
            const picker = chip.closest('.emoji-picker');
            if (picker) picker.querySelectorAll('.emoji-chip').forEach(c => c.classList.remove('is-selected'));
            chip.classList.add('is-selected');
            // ?????????????
            e.stopPropagation();
            e.preventDefault();
          }
        }
        return;
      }
      return;
    }
    const act = el.dataset.act;
    const p = this.activeProject();

    switch (act) {
      case "edit-timeline-node":
        this.editTimelineDate(el.dataset.date); return;
      case "save-timeline-meta":
        this.saveTimelineMetaFromForm(el.dataset.date || null); return;
      case "clear-timeline-meta":
        if (confirm("确定要清除该时间节点的标签和备注吗？")) {
          ST.setTimelineMeta(this.state.data, el.dataset.date, null);
          this.save(); this.closeDrawer(); this.renderTimeline(); this.renderView();
        }
        return;
      case "toggle-subdiv":
        this.toggleSubdiv(el.dataset.key); return;
      case "select-date":
        this.setActiveDate(el.dataset.date); return;
      case "open-project":
        if (p) this.navigate({ name: "project", projectId: p.id }); return;
      case "open-sector":
        if (p) this.navigate({ name: "sector", projectId: p.id, sectorId: el.dataset.sectorId }); return;
      case "open-sector-from-sub":
        if (p) this.navigate({ name: "sector", projectId: p.id, sectorId: el.dataset.sectorId }); return;
      case "open-subdivision":
        if (p) this.navigate({ name: "subdivision", projectId: p.id, sectorId: el.dataset.sectorId, subdivisionId: el.dataset.subdivisionId }); return;
      case "open-subdivision-from-node": {
        const sec = p && ST.findSector(p, el.dataset.sectorId);
        const sd = sec && sec.subdivisions.find(s => s.chainNodeId === el.dataset.chainNodeId);
        if (sd) this.navigate({ name: "subdivision", projectId: p.id, sectorId: sec.id, subdivisionId: sd.id });
        else if (sec) {
          const cn = sec.chainNodes.find(n => n.id === el.dataset.chainNodeId);
          this.openChainNodeAsSubdivision(sec, cn);
        }
        return;
      }
      case "create-subdivision-at-node": {
        const sec = p && ST.findSector(p, el.dataset.sectorId);
        if (sec) this.openChainNodeAsSubdivision(sec, sec.chainNodes.find(n => n.id === el.dataset.chainNodeId));
        return;
      }
      case "open-stock":
        if (p) this.navigate({
          name: "stock", projectId: p.id,
          sectorId: el.dataset.sectorId, subdivisionId: el.dataset.subdivisionId, stockId: el.dataset.stockId,
        }); return;
      case "open-operation": {
        if (!p) return;
        const stid = el.dataset.stockId;
        let stock = null, secId = null, sdId = null;
        for (const sec of p.sectors) for (const sd of sec.subdivisions) {
          const st = ST.findStock(sd, stid); if (st) { stock = st; secId = sec.id; sdId = sd.id; break; }
        }
        if (!stock) return;
        let opId = el.dataset.operationId;
        if (!opId && stock.operations && stock.operations.length) {
          const sorted = [...stock.operations].sort((a, b) => b.date.localeCompare(a.date));
          opId = sorted[0].id;
        }
        this.navigate({
          name: "operation", projectId: p.id,
          sectorId: secId, subdivisionId: sdId, stockId: stid, operationId: opId,
        }); return;
      }
      case "jump-date":
        if (el.dataset.date) this.setActiveDate(el.dataset.date); return;

      // 项目
      case "edit-project": {
        const f = this.formProject(p); this.openDrawer(f.title, f.body, f.actions); return;
      }
      case "save-project":
        this.saveProjectFromForm(el.dataset.editId || ""); return;
      case "delete-project":
        this.deleteProject(); return;

      // 板块
      case "add-sector": {
        const f = this.formSector(); this.openDrawer(f.title, f.body, f.actions); return;
      }
      case "edit-sector": {
        const sec = ST.findSector(p, el.dataset.sectorId);
        const f = this.formSector(sec); this.openDrawer(f.title, f.body, f.actions); return;
      }
      case "save-sector":
        this.saveSectorFromForm(el.dataset.editId || ""); return;
      case "delete-sector":
        this.deleteSector(el.dataset.sectorId); return;

      // 产业链节点
      case "add-chain-node": {
        const sec = ST.findSector(p, el.dataset.sectorId);
        const f = this.formChainNode(sec, null); this.openDrawer(f.title, f.body, f.actions); return;
      }
      case "save-chain-node":
        this.saveChainNodeFromForm(el.dataset.sectorId, el.dataset.editId || ""); return;
      case "delete-chain-node":
        this.deleteChainNode(el.dataset.sectorId, el.dataset.nodeId); return;

      // 细分领域
      case "add-subdivision": {
        const sec = ST.findSector(p, el.dataset.sectorId);
        const f = this.formSubdivision(sec, null); this.openDrawer(f.title, f.body, f.actions); return;
      }
      case "edit-subdivision": {
        const sec = ST.findSector(p, el.dataset.sectorId);
        const sd = ST.findSubdivision(sec, el.dataset.subdivisionId);
        const f = this.formSubdivision(sec, sd); this.openDrawer(f.title, f.body, f.actions); return;
      }
      case "save-subdivision":
        this.saveSubdivisionFromForm(el.dataset.sectorId, el.dataset.editId || ""); return;
      case "delete-subdivision":
        this.deleteSubdivision(el.dataset.sectorId, el.dataset.subdivisionId); return;

      // 个股
      case "add-stock": {
        let sd = null;
        for (const sec of p.sectors) {
          const x = ST.findSubdivision(sec, el.dataset.subdivisionId); if (x) { sd = x; break; }
        }
        if (!sd) return;
        const f = this.formStock(sd, null); this.openDrawer(f.title, f.body, f.actions); return;
      }
      case "edit-stock": {
        let sd = null, st = null;
        for (const sec of p.sectors) {
          const x = ST.findSubdivision(sec, el.dataset.subdivisionId);
          if (x) { sd = x; st = ST.findStock(sd, el.dataset.stockId); break; }
        }
        if (!sd || !st) return;
        const f = this.formStock(sd, st); this.openDrawer(f.title, f.body, f.actions); return;
      }
      case "save-stock":
        this.saveStockFromForm(el.dataset.subdivisionId, el.dataset.editId || ""); return;
      case "delete-stock":
        this.deleteStock(el.dataset.subdivisionId, el.dataset.stockId); return;

      // 快照
      case "add-snapshot": {
        let st = null;
        for (const sec of p.sectors) for (const sd of sec.subdivisions) {
          const x = ST.findStock(sd, el.dataset.stockId); if (x) { st = x; break; }
        }
        if (!st) return;
        const f = this.formSnapshot(st, null, this.activeDate()); this.openDrawer(f.title, f.body, f.actions); return;
      }
      case "save-snapshot":
        this.saveSnapshotFromForm(el.dataset.stockId, el.dataset.editId || ""); return;
      case "delete-snapshot":
        this.deleteSnapshot(el.dataset.stockId, el.dataset.snapId); return;

      // 操作建议
      case "add-operation": {
        let st = null;
        for (const sec of p.sectors) for (const sd of sec.subdivisions) {
          const x = ST.findStock(sd, el.dataset.stockId); if (x) { st = x; break; }
        }
        if (!st) return;
        const f = this.formOperation(st, null, this.activeDate()); this.openDrawer(f.title, f.body, f.actions); return;
      }
      case "save-operation":
        this.saveOperationFromForm(el.dataset.stockId, el.dataset.editId || ""); return;
      case "delete-operation":
        this.deleteOperation(el.dataset.stockId, el.dataset.operationId); return;
      case "del-operation":
        this.deleteOperation(el.dataset.stockId, el.dataset.operationId); return;

      // V10 · 操作建议抽屉 + 时间轴
      case "op-move-up":
      case "op-move-down":
        this.handleOpDrawerMove(act, el); return;
      case "del-op-drawer":
        this.handleOpDrawerDel(act, el); return;
      case "add-op-drawer": {
        const today = new Date().toISOString().slice(0, 10);
        const inputDate = prompt("请输入评估日期（YYYY-MM-DD）：", today);
        if (inputDate === null) return;
        const date = inputDate.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          alert("日期格式错误，请用 YYYY-MM-DD（例如 2026-01-15）");
          return;
        }
        const sid = el.dataset.stockId;
        let stFound = null;
        for (const sec of p.sectors) for (const sd of sec.subdivisions) {
          const x = ST.findStock(sd, sid); if (x) { stFound = x; break; }
        }
        if (!stFound) return;
        const f = this.formOperation(stFound, null, date);
        this.openDrawer(f.title, f.body, f.actions);
        return;
      }
      case "op-rail-prev":
      case "op-rail-next":
      case "sub-rail-prev":
      case "sub-rail-next":
      case "sd-rail-prev":
      case "sd-rail-next": {
        let type = "stock";
        if (act === "sub-rail-prev" || act === "sub-rail-next") type = "sector";
        else if (act === "sd-rail-prev" || act === "sd-rail-next") type = "subdivision";
        const railSel = '[data-' + type + '-op-rail]';
        const rail = el.closest(railSel);
        if (!rail) return;
        const id = rail.getAttribute('data-' + type + '-op-rail');
        const key = type + "_" + id;
        let state = App.opDrawerState[key];
        if (!state) { state = { pageStart: 0, activeIdx: 0 }; App.opDrawerState[key] = state; }
        const drawer = document.querySelector('[data-' + type + '-op-drawers]');
        if (!drawer) return;
        const total = drawer.querySelectorAll(".op-drawer").length;
        const isPrev = act === "op-rail-prev" || act === "sub-rail-prev" || act === "sd-rail-prev";
        if (isPrev) {
          state.pageStart = Math.max(0, state.pageStart - 4);
          state.activeIdx = Math.min(state.pageStart, Math.max(0, total - 1));
        } else {
          if (state.pageStart + 4 >= total) return;
          state.pageStart += 4;
          state.activeIdx = state.pageStart;
        }
        this.renderView();
        return;
      }

      // 跟踪
      case "add-tracking":
        this.saveTrackingFromForm(el.dataset.subdivisionId); return;
      case "edit-tracking": {
        // 编辑细分领域跟踪条目
        const p = this.activeProject();
        for (const sec of p.sectors) {
          const sd = ST.findSubdivision(sec, el.dataset.subdivisionId);
          if (sd) {
            const entry = (sd.trackingEntries || []).find(e => e.id === el.dataset.entryId);
            if (entry) {
              const f = this.formTrackingEntry({ type: 'subdivision', sectorId: sec.id, subdivisionId: sd.id }, entry);
              this.openDrawer(f.title, f.body, f.actions);
            }
            return;
          }
        }
        return;
      }
      case "edit-sector-tracking": {
        const sec = ST.findSector(this.activeProject(), el.dataset.sectorId);
        if (!sec) return;
        const entry = (sec.trackingEntries || []).find(e => e.id === el.dataset.entryId);
        if (entry) {
          const f = this.formTrackingEntry({ type: 'sector', sectorId: sec.id }, entry);
          this.openDrawer(f.title, f.body, f.actions);
        }
        return;
      }
      case "add-sector-tracking": {
        const sec = ST.findSector(this.activeProject(), el.dataset.sectorId);
        if (!sec) return;
        const f = this.formTrackingEntry({ type: 'sector', sectorId: sec.id }, null);
        this.openDrawer(f.title, f.body, f.actions);
        return;
      }
      case "save-tracking-entry":
        this.saveTrackingEntryFromForm(
          el.dataset.scopeType,
          el.dataset.scopeSectorId,
          el.dataset.scopeSubdivisionId || null,
          el.dataset.editId || null
        ); return;
      case "delete-tracking-entry":
        this.deleteTrackingEntry(
          el.dataset.scopeType,
          el.dataset.scopeSectorId,
          el.dataset.scopeSubdivisionId || null,
          el.dataset.entryId
        ); return;
      case "add-sector-from-col": {
        // 从时间节点列里新增板块（在当前活动项目下）
        const f = this.formSector();
        this.openDrawer(f.title, f.body, f.actions);
        return;
      }
      case "quick-add-operation": {
        // 快速录入操作简述
        const stid = el.dataset.stockId;
        const date = el.dataset.date;
        let stock = null;
        const p = this.activeProject();
        for (const sec of p.sectors) for (const sd of sec.subdivisions) {
          const st = ST.findStock(sd, stid); if (st) { stock = st; break; }
        }
        if (!stock) return;
        const input = document.getElementById(`qa_op_text_${stid}_${date}`);
        const sel   = document.getElementById(`qa_op_type_${stid}_${date}`);
        const text  = (input && input.value || "").trim();
        if (!text) { if (input) input.focus(); return; }
        stock.operations = stock.operations || [];
        stock.operations.push({
          id: ST.uid("op-"),
          date,
          type: sel ? sel.value : "watch",
          price: null, target: null, stopLoss: null, position: "",
          suggestion: text,
        });
        this.save();
        if (input) input.value = "";
        this.renderTimeline();
        this.renderView();
        return;
      }
            case "del-sector-tracking": {
        const secId = el.dataset.sectorId;
        const sec = ST.findSector(this.activeProject(), secId);
        if (sec) {
          sec.trackingEntries = (sec.trackingEntries || []).filter(e => e.id !== el.dataset.entryId);
          this.save(); this.renderTimeline(); this.renderView();
        }
        return;
      }
      case "del-tracking":
        this.deleteTracking(el.dataset.subdivisionId, el.dataset.entryId); return;

      // GitHub 同步
      case "open-sync-settings": {
        const f = this.formSyncSettings();
        this.openDrawer(f.title, f.body, f.actions);
        return;
      }
      case "save-sync-config":
        this.saveSyncConfigFromForm(); return;
      case "clear-sync-config":
        this.clearSyncConfig(); return;
      case "sync-push":
        this.sync.push(); return;
      case "sync-pull":
        this.sync.pull(); return;

      // 抽屉
      case "close-drawer":
      case "close-drawer-mask":
        this.closeDrawer(); return;
    }
  };

  // ============================================================
  // 初始化
  // ============================================================
  App.init = function () {
    document.getElementById("projectSelector").addEventListener("change", e => this.switchProject(e.target.value));
    document.getElementById("newProjectBtn").addEventListener("click", () => {
      const f = this.formProject(null); this.openDrawer(f.title, f.body, f.actions);
    });
    document.getElementById("exportBtn").addEventListener("click", () => this.exportData());
    document.getElementById("importInput").addEventListener("change", e => { if (e.target.files[0]) this.importData(e.target.files[0]); });
    document.getElementById("resetBtn").addEventListener("click", () => this.resetData());

    document.getElementById("addTimelineBtn").addEventListener("click", () => this.addTimelineDate());
    document.getElementById("deleteTimelineBtn").addEventListener("click", () => this.deleteTimelineDate());
    document.getElementById("editTimelineBtn").addEventListener("click", () => this.editTimelineDate(this.activeDate()));

    document.getElementById("breadcrumb").addEventListener("click", e => {
      const c = e.target.closest(".crumb[data-crumb-idx]"); if (!c) return;
      const idx = parseInt(c.dataset.crumbIdx, 10);
      this.state.viewStack = this.state.viewStack.slice(0, idx + 1);
      this.renderHeader(); this.renderView();
    });

    document.querySelector("[data-route=home]").addEventListener("click", () => this.goHome());

    document.body.addEventListener("click", e => this.handleGlobalClick(e));

    // V10 · 抽屉内字段实时保存
    document.body.addEventListener("input", e => {
      const el = e.target;
      if (!el.dataset || !el.dataset.field) return;
      if (el.dataset.field.indexOf("op-") !== 0) return;
      if (typeof this.handleOpDrawerFieldChange === "function") this.handleOpDrawerFieldChange(e);
    });
    document.body.addEventListener("change", e => {
      const el = e.target;
      if (!el.dataset || !el.dataset.field) return;
      if (el.dataset.field.indexOf("op-") !== 0) return;
      if (typeof this.handleOpDrawerFieldChange === "function") this.handleOpDrawerFieldChange(e);
    });

    // V10 · renderView 后自动渲染时间轴（支持 stock / sector / subdivision）
    const origRenderView = this.renderView.bind(this);
    this.renderView = function () {
      origRenderView();
      const stockDrawer = document.querySelector('[data-stock-op-drawers]');
      if (stockDrawer && typeof App.renderOpRail === 'function') {
        App.renderOpRail(stockDrawer.getAttribute('data-stock-op-drawers'), 'stock');
      }
      const sectorDrawer = document.querySelector('[data-sector-op-drawers]');
      if (sectorDrawer && typeof App.renderOpRail === 'function') {
        App.renderOpRail(sectorDrawer.getAttribute('data-sector-op-drawers'), 'sector');
      }
      const subDrawer = document.querySelector('[data-subdivision-op-drawers]');
      if (subDrawer && typeof App.renderOpRail === 'function') {
        App.renderOpRail(subDrawer.getAttribute('data-subdivision-op-drawers'), 'subdivision');
      }
    };

    this.renderHeader();
    this.renderTimeline();
    this.renderView();
    if (this.sync && typeof this.sync._renderStatus === 'function') {
      this.sync._renderStatus();
    }
  };

  document.addEventListener("DOMContentLoaded", () => App.init());
  window.App = App;

  // ============================================================
  // V10 · 操作建议抽屉 + 时间轴 helpers
  // ============================================================
  App.opDrawerState = {};

  App.renderOpRail = function (id, type) {
    type = type || "stock";
    const key = type + "_" + id;
    let state = App.opDrawerState[key];
    if (!state) {
      state = { pageStart: 0, activeIdx: 0 };
      App.opDrawerState[key] = state;
    }
    const railSel = '[data-' + type + '-op-rail="' + id + '"]';
    const drawerSel = '[data-' + type + '-op-drawers]';
    const rail = document.querySelector(railSel);
    if (!rail) return;
    const track = rail.classList.contains("track-rail-track") ? rail : rail.querySelector(".track-rail-track");
    if (!track) return;
    // 清空已有节点（保留 axis + progress）
    Array.from(track.children).forEach(function (c) {
      const cls = c.className || "";
      if (cls.indexOf("track-rail-axis") === -1 && cls.indexOf("op-rail-node") === -1) track.removeChild(c);
    });
    Array.from(track.querySelectorAll(".op-rail-node")).forEach(function (n) { n.parentNode.removeChild(n); });
    const drawer = document.querySelector(drawerSel);
    if (!drawer) return;
    const cards = drawer.querySelectorAll(".op-drawer");
    const total = cards.length;
    const start = state.pageStart;
    const end = Math.min(start + 4, total);
    for (let i = start; i < end; i++) {
      const c = cards[i];
      const localIdx = i - start;
      const dateEl = c.querySelector(".op-drawer-date");
      const dateLabel = dateEl ? dateEl.textContent : "";
      const node = document.createElement("div");
      node.className = "op-rail-node" + (i === state.activeIdx ? " is-active" : "");
      node.dataset.idx = i;
      // 板块/细分的 label 不需要 .slice(5)，stock 的日期格式 "YYYY-MM-DD" 才要切掉年份
      const label = type === "stock" ? dateLabel.slice(5) : dateLabel.slice(0, 12);
      node.innerHTML = '<div class="op-rail-dot"></div><div class="op-rail-label">' + ST.escapeHtml(label) + "</div>";
      (function (idx, currentType, currentId) {
        node.addEventListener("click", function () {
          state.activeIdx = idx;
          const page = Math.floor(idx / 4) * 4;
          state.pageStart = page;
          drawer.querySelectorAll(".op-drawer").forEach(function (dc, di) {
            dc.classList.toggle("is-active", di === idx);
          });
          App.renderOpRail(currentId, currentType);
        });
      })(i, type, id);
      track.appendChild(node);
    }
    const progress = rail.querySelector(".track-rail-axis-progress") || rail.querySelector("[data-op-rail-progress]");
    const pageCount = end - start;
    if (progress) {
      if (pageCount > 1) {
        const localIdx = state.activeIdx - start;
        const pct = (localIdx / (pageCount - 1)) * 100;
        progress.style.width = pct + "%";
      } else {
        progress.style.width = "0";
      }
    }
    // 更新 wrap 内所有 prev/next 按钮的 disabled
    const wrap = rail.closest(".track-rail-wrap, .op-rail-wrap");
    if (wrap) {
      wrap.querySelectorAll('[data-act$="-rail-prev"]').forEach(function (b) { b.disabled = state.pageStart === 0; });
      wrap.querySelectorAll('[data-act$="-rail-next"]').forEach(function (b) { b.disabled = state.pageStart + 4 >= total; });
      wrap.querySelectorAll('[data-act$="sub-rail-prev"], [data-act$="sd-rail-prev"]').forEach(function (b) { b.disabled = state.pageStart === 0; });
      wrap.querySelectorAll('[data-act$="sub-rail-next"], [data-act$="sd-rail-next"]').forEach(function (b) { b.disabled = state.pageStart + 4 >= total; });
    }
  };

  App.handleOpDrawerFieldChange = function (e) {
    const el = e.target;
    const field = el.dataset.field;
    if (!field) return;
    const opId = el.dataset.opId;
    if (!opId) return;
    const card = el.closest(".op-drawer");
    if (!card) return;
    const sectorId = card.dataset.sectorOpId;
    const subdivisionId = card.dataset.subdivisionOpId;
    const stockId = card.dataset.stockOpId;
    const p = ST.findProject(this.state.data, this.state.data.activeProjectId);
    const sec = p && ST.findSector(p, sectorId);
    const sd = sec && ST.findSubdivision(sec, subdivisionId);
    const st = sd && ST.findStock(sd, stockId);
    if (!st) return;
    const op = (st.operations || []).find(function (x) { return x.id === opId; });
    if (!op) return;
    let v = el.value;
    if (field === "op-target" || field === "op-stopLoss") v = v ? parseFloat(v) : null;
    // 字段映射到现有 schema
    if (field === "op-type") op.type = v;
    else if (field === "op-target") op.target = v;
    else if (field === "op-stopLoss") op.stopLoss = v;
    else if (field === "op-suggestion") op.suggestion = v;
    else if (field === "op-risks") op.risks = v;
    else if (field === "op-signals") op.signals = v;
    else if (field === "op-label") op.label = v;
    if (typeof App.save === "function") App.save();
  };

  App.handleOpDrawerMove = function (act, btn) {
    const card = btn.closest(".op-drawer");
    if (!card) return;
    const opId = card.dataset.opId;
    const stockId = card.dataset.stockOpId;
    const sectorId = card.dataset.sectorOpId;
    const subdivisionId = card.dataset.subdivisionOpId;
    const p = ST.findProject(this.state.data, this.state.data.activeProjectId);
    const sec = p && ST.findSector(p, sectorId);
    const sd = sec && ST.findSubdivision(sec, subdivisionId);
    const st = sd && ST.findStock(sd, stockId);
    if (!st || !st.operations) return;
    const idx = st.operations.findIndex(function (o) { return o.id === opId; });
    const dir = (act === "op-move-up") ? -1 : 1;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= st.operations.length) return;
    const tmp = st.operations[idx];
    st.operations[idx] = st.operations[newIdx];
    st.operations[newIdx] = tmp;
    if (typeof App.save === "function") App.save();
    const view = App.state && App.state.view;
    if (view) App.renderView();
  };

  App.handleOpDrawerDel = function (act, btn) {
    const card = btn.closest(".op-drawer");
    if (!card) return;
    const opId = card.dataset.opId;
    const stockId = card.dataset.stockOpId;
    const sectorId = card.dataset.sectorOpId;
    const subdivisionId = card.dataset.subdivisionOpId;
    const p = ST.findProject(this.state.data, this.state.data.activeProjectId);
    const sec = p && ST.findSector(p, sectorId);
    const sd = sec && ST.findSubdivision(sec, subdivisionId);
    const st = sd && ST.findStock(sd, stockId);
    if (!st || !st.operations) return;
    const op = st.operations.find(function (x) { return x.id === opId; });
    if (!op) return;
    if (!confirm("确定删除 " + op.date + " 评估节点？")) return;
    st.operations = st.operations.filter(function (x) { return x.id !== opId; });
    if (typeof App.save === "function") App.save();
    const view = App.state && App.state.view;
    if (view) App.renderView();
  };
})();

