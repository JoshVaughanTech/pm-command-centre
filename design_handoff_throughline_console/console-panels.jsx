// Console panels — each is a self-contained component that lives inside a
// PanelShell. Panels read from window.TL_* and from a `pinnedProjectId` prop
// where relevant.

const { useState: pUseState } = React;

// 1) DAYBOOK — date + lede + portfolio ledger (the bit V2 nailed)
function PanelDaybook({ tone }) {
  const portfolio = window.TL_PORTFOLIO;
  return (
    <div className="cp-daybook">
      <div className="cp-daybook-l">
        <div className="cp-daybook-eyebrow">Monday</div>
        <h1 className="cp-daybook-title">25 May<span className="cp-daybook-year">, 2026</span></h1>
        <p className="cp-daybook-lede">
          Three projects need a move today. One client has been quiet for a week.
          Yesterday you closed two risks and shipped the access-control evidence pack.
        </p>
      </div>
      <div className="cp-daybook-r">
        <div className="cp-ledger">
          <div className="cp-ledger-row">
            <span className="cp-ledger-num">{portfolio.active}</span>
            <span className="cp-ledger-lbl">active projects</span>
          </div>
          <div className="cp-ledger-row">
            <span className="cp-ledger-num">{portfolio.health}<span className="cp-ledger-unit">%</span></span>
            <span className="cp-ledger-lbl">portfolio health</span>
          </div>
          <div className="cp-ledger-row cp-ledger-row--warn">
            <span className="cp-ledger-num">{portfolio.risksHigh}<span className="cp-ledger-unit">/{portfolio.risksOpen}</span></span>
            <span className="cp-ledger-lbl">high / open risks</span>
          </div>
          <div className="cp-ledger-row">
            <span className="cp-ledger-num">{portfolio.hoursSaved}<span className="cp-ledger-unit">h</span></span>
            <span className="cp-ledger-lbl">saved this week</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 2) PRIORITY MOVES — top 3 actions
function PanelMoves() {
  const projects = window.TL_PROJECTS.slice().sort((a, b) => a.health - b.health).slice(0, 3);
  return (
    <ol className="cp-moves">
      {projects.map((p, i) => (
        <li key={p.id} className="cp-move">
          <div className="cp-move-num">{String(i + 1).padStart(2, "0")}</div>
          <div className="cp-move-body">
            <div className="cp-move-meta">
              <span className={"cp-pill cp-pill--" + p.risk.toLowerCase()}>{p.risk}</span>
              <span className="cp-move-code">{p.code}</span>
              <span className="cp-mid-dot" />
              <span>{p.client}</span>
              <span className="cp-mid-dot" />
              <span className="cp-move-when">{p.nextWhen}</span>
            </div>
            <div className="cp-move-h">{p.move}</div>
            <div className="cp-move-p">{p.moveBody}</div>
          </div>
          <div className="cp-move-actions">
            <button className="cp-btn">{TLIcon.send(11)}<span>draft</span></button>
            <button className="cp-btn cp-btn--ghost">snooze</button>
          </div>
        </li>
      ))}
    </ol>
  );
}

// 3) METRICS STRIP — 6 portfolio metrics with sparklines
function PanelMetrics() {
  const portfolio = window.TL_PORTFOLIO;
  const cells = [
    { lbl: "portfolio.health", val: portfolio.health, suf: "%", spark: [62, 68, 71, 65, 69, 70, 70] },
    { lbl: "projects.active", val: portfolio.active, spark: [3, 3, 3, 4, 4, 4, 4] },
    { lbl: "risks.open", val: portfolio.risksOpen, spark: [2, 3, 3, 4, 5, 4, 4], state: "warn" },
    { lbl: "risks.high", val: portfolio.risksHigh, spark: [0, 1, 1, 2, 2, 2, 2], state: "bad" },
    { lbl: "comms.due", val: portfolio.updatesDue, spark: [1, 1, 2, 2, 2, 2, 2] },
    { lbl: "ai.hours_saved", val: portfolio.hoursSaved, suf: "h", spark: [4, 5, 6, 7, 8, 9, 9.5], state: "good" },
  ];
  return (
    <div className="cp-strip">
      {cells.map((m) => (
        <div key={m.lbl} className={"cp-stripcell " + (m.state ? "cp-stripcell--" + m.state : "")}>
          <div className="cp-stripcell-lbl">{m.lbl}</div>
          <div className="cp-stripcell-row">
            <div className="cp-stripcell-val">{m.val}{m.suf && <span className="cp-stripcell-suf">{m.suf}</span>}</div>
            <CPSpark data={m.spark} />
          </div>
        </div>
      ))}
    </div>
  );
}

// 4) PROJECTS TABLE
function PanelProjects({ pinnedProjectId, onPin }) {
  const projects = window.TL_PROJECTS;
  const risks = window.TL_RISKS;
  const [sortKey, setSortKey] = pUseState("health");
  const sorted = projects.slice().sort((a, b) => {
    if (sortKey === "health") return a.health - b.health;
    if (sortKey === "risk") return ({High:0,Medium:1,Low:2}[a.risk]) - ({High:0,Medium:1,Low:2}[b.risk]);
    if (sortKey === "comms") return a.comms - b.comms;
    return 0;
  });
  return (
    <table className="cp-table">
      <thead>
        <tr>
          <th className="cp-th-tight">·</th>
          <th>code</th>
          <th>project</th>
          <th>client</th>
          <th>stage</th>
          <th
            className={"cp-th-num " + (sortKey === "health" ? "is-sorted" : "")}
            onClick={() => setSortKey("health")}
          >health ↓</th>
          <th className="cp-th-num">budget</th>
          <th className="cp-th-num">schedule</th>
          <th
            className={"cp-th-num " + (sortKey === "comms" ? "is-sorted" : "")}
            onClick={() => setSortKey("comms")}
          >comms</th>
          <th className="cp-th-num">risks</th>
          <th>next</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((p) => {
          const rcount = risks.filter((r) => r.project === p.code).length;
          const rhigh = risks.filter((r) => r.project === p.code && r.severity === "high").length;
          return (
            <tr
              key={p.id}
              onClick={() => onPin && onPin(p.id)}
              className={pinnedProjectId === p.id ? "is-sel" : ""}
            >
              <td><span className={"cp-rdot cp-rdot--" + p.risk.toLowerCase()} /></td>
              <td className="cp-mono">{p.code}</td>
              <td className="cp-td-name">{p.name}</td>
              <td>{p.client}</td>
              <td><span className="cp-stage">{p.stage.toLowerCase()}</span></td>
              <td className="cp-td-num">
                <span className="cp-tnum">{p.health}</span>
                <CPBar v={p.health} />
              </td>
              <td className={"cp-td-num cp-state--" + p.budgetState}>{p.budget}</td>
              <td className={"cp-td-num cp-state--" + p.scheduleState}>{p.schedule}</td>
              <td className="cp-td-num">
                <span className="cp-tnum">{p.comms}</span>
                <CPBar v={p.comms} />
              </td>
              <td className="cp-td-num">
                {rhigh > 0 && <span className="cp-rchip cp-rchip--high">{rhigh}H</span>}
                <span className="cp-rchip">{rcount}</span>
              </td>
              <td className="cp-td-next">
                <span className={"cp-next-when cp-next-when--" + (p.nextWhen === "Overdue" ? "bad" : "")}>{p.nextWhen}</span>
                <span className="cp-next-what">{p.next}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// 5) RISKS TABLE
function PanelRisks() {
  const risks = window.TL_RISKS;
  return (
    <table className="cp-table cp-table--tight">
      <thead>
        <tr>
          <th className="cp-th-tight">sev</th>
          <th>id</th>
          <th>title</th>
          <th>project</th>
          <th>owner</th>
          <th className="cp-th-num">age</th>
        </tr>
      </thead>
      <tbody>
        {risks.map((r) => (
          <tr key={r.id}>
            <td><span className={"cp-sev cp-sev--" + r.severity}>{r.severity === "high" ? "H" : "M"}</span></td>
            <td className="cp-mono">{r.id}</td>
            <td className="cp-td-name">{r.title}</td>
            <td className="cp-mono">{r.project}</td>
            <td>{r.owner}</td>
            <td className="cp-td-num">{r.age}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// 6) INBOX
function PanelInbox() {
  const inbox = window.TL_INBOX;
  return (
    <ul className="cp-inbox">
      {inbox.map((m, i) => (
        <li key={i} className={"cp-inbox-row cp-inbox-row--" + m.state}>
          <div className="cp-inbox-state" />
          <div className="cp-inbox-body">
            <div className="cp-inbox-line">
              <span className="cp-inbox-from">{m.from}</span>
              <span className="cp-inbox-org">{m.org}</span>
              <span className="cp-inbox-at">{m.at}</span>
            </div>
            <div className="cp-inbox-subj">{m.subj}</div>
            <div className="cp-inbox-snip">{m.snip}</div>
          </div>
          <div className="cp-inbox-tag">{m.project}</div>
        </li>
      ))}
    </ul>
  );
}

// 7) PINNED PROJECT — deep brief
function PanelPinned({ pinnedProjectId }) {
  const projects = window.TL_PROJECTS;
  const inbox = window.TL_INBOX;
  const sel = projects.find((p) => p.id === pinnedProjectId) || projects[0];
  const selInbox = inbox.filter((m) => m.project === sel.code);
  return (
    <div className="cp-pinned">
      <div className="cp-pinned-head">
        <div className="cp-pinned-eyebrow">
          <span className={"cp-rdot cp-rdot--" + sel.risk.toLowerCase()} />
          <span className="cp-mono">{sel.code}</span>
          <span className="cp-mid-dot" />
          <span>{sel.stage}</span>
          <span className="cp-pinned-pinned">pinned</span>
        </div>
        <h3 className="cp-pinned-title">{sel.name}</h3>
        <div className="cp-pinned-sub">{sel.client}</div>
      </div>

      <div className="cp-pinned-kv">
        <div><span>owner</span><b>{sel.owner}</b></div>
        <div><span>contact</span><b>{sel.contact}</b></div>
        <div><span>channel</span><b>{sel.channel}</b></div>
        <div><span>next</span><b>{sel.nextWhen}</b></div>
        <div><span>last touch</span><b>{sel.lastTouch}</b></div>
        <div><span>phase</span><b>{sel.phase}/8</b></div>
      </div>

      <div className="cp-pinned-block">
        <div className="cp-pinned-block-head">
          <span className="cp-spark">{TLIcon.spark(11)}</span>
          <span>recommended move</span>
        </div>
        <div className="cp-pinned-move">
          <div className="cp-pinned-move-h">{sel.move}</div>
          <div className="cp-pinned-move-p">{sel.moveBody}</div>
          <div className="cp-pinned-move-actions">
            <button className="cp-btn cp-btn--primary">{TLIcon.send(11)}<span>draft & send</span></button>
            <button className="cp-btn cp-btn--ghost">snooze</button>
          </div>
        </div>
      </div>

    </div>
  );
}

// 8) WEEKLY TIMELINE — all projects across the week
function PanelTimeline() {
  const projects = window.TL_PROJECTS;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <div className="cp-tl">
      <div className="cp-tl-head">
        {days.map((d) => <div key={d} className="cp-tl-head-cell">{d}<span className="cp-tl-head-date">{["25","26","27","28","29"][days.indexOf(d)]}</span></div>)}
      </div>
      <div className="cp-tl-rows">
        {projects.map((p) => (
          <div key={p.id} className="cp-tl-row">
            <div className="cp-tl-row-label">
              <span className={"cp-rdot cp-rdot--" + p.risk.toLowerCase()} />
              <span className="cp-mono">{p.code}</span>
              <span className="cp-tl-row-name">{p.name}</span>
            </div>
            <div className="cp-tl-row-track">
              {days.map((d, di) => {
                const item = p.timeline.find((t) => t.d === d);
                return (
                  <div key={di} className="cp-tl-row-cell">
                    {item && (
                      <div className={"cp-tl-bar cp-tl-bar--" + item.s}>
                        <span className="cp-tl-bar-k">{item.k}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 9) COMMS HEALTH
function PanelComms() {
  const projects = window.TL_PROJECTS;
  return (
    <ul className="cp-comms">
      {projects.map((p) => (
        <li key={p.id} className="cp-comms-row">
          <div className="cp-comms-l">
            <div className="cp-comms-name">{p.client}</div>
            <div className="cp-comms-sub">{p.contact} · {p.lastTouch}</div>
          </div>
          <div className="cp-comms-mid">
            <div className="cp-comms-bar">
              <div className={"cp-comms-bar-fill cp-comms-bar-fill--" + (p.comms < 50 ? "bad" : p.comms < 75 ? "warn" : "good")} style={{ width: p.comms + "%" }} />
            </div>
          </div>
          <div className={"cp-comms-num cp-comms-num--" + (p.comms < 50 ? "bad" : p.comms < 75 ? "warn" : "good")}>{p.comms}</div>
        </li>
      ))}
    </ul>
  );
}

// Helpers
function CPBar({ v }) {
  const cls = v < 50 ? "bad" : v < 75 ? "warn" : "good";
  return (
    <span className="cp-inlinebar">
      <span className={"cp-inlinebar-fill cp-inlinebar-fill--" + cls} style={{ width: v + "%" }} />
    </span>
  );
}

function CPSpark({ data }) {
  const w = 56, h = 14, pad = 1;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(0.0001, max - min);
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((d - min) / range) * (h - 2 * pad);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} className="cp-spark">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx={last[0]} cy={last[1]} r="1.5" fill="currentColor" />
    </svg>
  );
}

// Catalog: each entry describes a panel. defaultW is in 12-col grid units.
// minW/allowedW lets the resize cycle skip invalid sizes for narrow panels.
const PANELS = {
  daybook:    { title: "Today",             defaultW: 12, allowedW: [12],          Component: PanelDaybook },
  moves:      { title: "Priority moves",    defaultW: 8,  allowedW: [6, 8, 12],    Component: PanelMoves },
  metrics:    { title: "Portfolio metrics", defaultW: 12, allowedW: [12, 8, 6],    Component: PanelMetrics },
  projects:   { title: "Projects",          defaultW: 12, allowedW: [12, 8],       Component: PanelProjects },
  risks:      { title: "Open risks",        defaultW: 6,  allowedW: [4, 6, 8, 12], Component: PanelRisks },
  inbox:      { title: "Inbox signals",     defaultW: 6,  allowedW: [4, 6, 8, 12], Component: PanelInbox },
  pinned:     { title: "Pinned project",    defaultW: 4,  allowedW: [4, 6],        Component: PanelPinned },
  timeline:   { title: "Weekly timeline",   defaultW: 12, allowedW: [12],          Component: PanelTimeline },
  comms:      { title: "Comms health",      defaultW: 4,  allowedW: [4, 6],        Component: PanelComms },
};

window.CONSOLE_PANELS = PANELS;
