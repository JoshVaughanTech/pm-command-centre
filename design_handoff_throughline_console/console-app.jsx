// Customizable Console — main shell.
// 12-col grid of panels. Each panel is reorderable (drag the grip),
// resizable (cycle through allowedW), and removable. New panels added from
// the "+ Add panel" menu. Layout persists to localStorage.

const { useState: cUseState, useEffect: cUseEffect, useRef: cUseRef } = React;

const STORAGE_LAYOUT = "throughline.console.layout.v1";
const STORAGE_PINNED = "throughline.console.pinned.v1";
const STORAGE_THEME  = "throughline.console.theme.v1";
const STORAGE_DENSITY = "throughline.console.density.v1";

const DEFAULT_LAYOUT = [
  { id: "daybook",  w: 12 },
  { id: "metrics",  w: 12 },
  { id: "moves",    w: 8 },
  { id: "pinned",   w: 4 },
  { id: "projects", w: 8 },
  { id: "risks",    w: 4 },
  { id: "inbox",    w: 8 },
  { id: "comms",    w: 4 },
];

function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_LAYOUT);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw);
    // Filter out unknown panel ids in case the catalog changes.
    return parsed.filter((p) => window.CONSOLE_PANELS[p.id]);
  } catch (e) {
    return DEFAULT_LAYOUT;
  }
}

function ConsoleApp() {
  const [layout, setLayout] = cUseState(loadLayout);
  const [pinnedId, setPinnedId] = cUseState(() => {
    try { return localStorage.getItem(STORAGE_PINNED) || window.TL_PROJECTS[1].id; }
    catch (e) { return window.TL_PROJECTS[1].id; }
  });
  const [draggingId, setDraggingId] = cUseState(null);
  const [overId, setOverId] = cUseState(null);
  const [addOpen, setAddOpen] = cUseState(false);
  const [theme, setTheme] = cUseState(() => {
    try { return localStorage.getItem(STORAGE_THEME) || "light"; }
    catch (e) { return "light"; }
  });
  const [density, setDensity] = cUseState(() => {
    try { return localStorage.getItem(STORAGE_DENSITY) || "compact"; }
    catch (e) { return "compact"; }
  });

  // persist layout + pinned + theme + density
  cUseEffect(() => {
    try { localStorage.setItem(STORAGE_LAYOUT, JSON.stringify(layout)); } catch (e) {}
  }, [layout]);
  cUseEffect(() => {
    try { localStorage.setItem(STORAGE_PINNED, pinnedId); } catch (e) {}
  }, [pinnedId]);
  cUseEffect(() => {
    try { localStorage.setItem(STORAGE_THEME, theme); } catch (e) {}
  }, [theme]);
  cUseEffect(() => {
    try { localStorage.setItem(STORAGE_DENSITY, density); } catch (e) {}
  }, [density]);

  // ── drag handlers (panel reorder) ──────────────────────────────────────
  const dragStart = (id) => (e) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    // Make Firefox happy
    e.dataTransfer.setData("text/plain", id);
  };
  const dragOver = (id) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== overId) setOverId(id);
  };
  const dragLeave = () => setOverId(null);
  const drop = (id) => (e) => {
    e.preventDefault();
    if (!draggingId || draggingId === id) {
      setDraggingId(null);
      setOverId(null);
      return;
    }
    setLayout((prev) => {
      const fromIdx = prev.findIndex((p) => p.id === draggingId);
      const toIdx = prev.findIndex((p) => p.id === id);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDraggingId(null);
    setOverId(null);
  };
  const dragEnd = () => { setDraggingId(null); setOverId(null); };

  // ── panel ops ──────────────────────────────────────────────────────────
  function cycleWidth(id) {
    setLayout((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const allowed = window.CONSOLE_PANELS[id].allowedW;
        if (!allowed || allowed.length <= 1) return p;
        const i = allowed.indexOf(p.w);
        const next = allowed[(i + 1) % allowed.length];
        return { ...p, w: next };
      })
    );
  }
  function removePanel(id) {
    setLayout((prev) => prev.filter((p) => p.id !== id));
  }
  function addPanel(id) {
    setLayout((prev) => [...prev, { id, w: window.CONSOLE_PANELS[id].defaultW }]);
    setAddOpen(false);
  }
  function resetLayout() {
    setLayout(DEFAULT_LAYOUT);
  }

  const usedIds = new Set(layout.map((p) => p.id));
  const available = Object.keys(window.CONSOLE_PANELS).filter((id) => !usedIds.has(id));

  return (
    <div className={"console-root console-root--" + theme + " console-root--d-" + density}>
      <ConsoleTopBar
        onAdd={() => setAddOpen((v) => !v)}
        addOpen={addOpen}
        availablePanels={available}
        onAddPanel={addPanel}
        onCloseAdd={() => setAddOpen(false)}
        onReset={resetLayout}
        theme={theme}
        setTheme={setTheme}
      />
      <div className="console-grid">
        {layout.map((p) => {
          const def = window.CONSOLE_PANELS[p.id];
          if (!def) return null;
          const Comp = def.Component;
          const isDragging = draggingId === p.id;
          const isOver = overId === p.id && draggingId && draggingId !== p.id;
          return (
            <div
              key={p.id}
              className={"console-cell w-" + p.w + (isDragging ? " is-dragging" : "") + (isOver ? " is-over" : "")}
              onDragOver={dragOver(p.id)}
              onDragLeave={dragLeave}
              onDrop={drop(p.id)}
            >
              <PanelShell
                title={def.title}
                allowedW={def.allowedW}
                currentW={p.w}
                onDragStart={dragStart(p.id)}
                onDragEnd={dragEnd}
                onResize={() => cycleWidth(p.id)}
                onRemove={() => removePanel(p.id)}
                bodyKind={p.id}
              >
                <Comp
                  pinnedProjectId={pinnedId}
                  onPin={(id) => setPinnedId(id)}
                  density={density}
                />
              </PanelShell>
            </div>
          );
        })}

        {/* dropzone at end for moving panels to the bottom */}
        {draggingId && (
          <div
            className="console-cell w-12 console-endzone"
            onDragOver={(e) => { e.preventDefault(); setOverId("__end__"); }}
            onDrop={(e) => {
              e.preventDefault();
              setLayout((prev) => {
                const fromIdx = prev.findIndex((p) => p.id === draggingId);
                if (fromIdx < 0) return prev;
                const next = [...prev];
                const [moved] = next.splice(fromIdx, 1);
                next.push(moved);
                return next;
              });
              setDraggingId(null);
              setOverId(null);
            }}
          >
            <div className="console-endzone-inner">drop here to move to end</div>
          </div>
        )}

        {layout.length === 0 && (
          <div className="console-cell w-12 console-empty">
            <div>No panels. Add one with the <b>+ Add panel</b> button above.</div>
          </div>
        )}
      </div>

      <ConsoleTweaks
        theme={theme} setTheme={setTheme}
        density={density} setDensity={setDensity}
        layout={layout}
        onTogglePanel={(id, on) => {
          if (on) addPanel(id);
          else removePanel(id);
        }}
        onReset={resetLayout}
      />
    </div>
  );
}

// ── Top bar ───────────────────────────────────────────────────────────────
function ConsoleTopBar({ onAdd, addOpen, availablePanels, onAddPanel, onCloseAdd, onReset, theme, setTheme }) {
  const portfolio = window.TL_PORTFOLIO;
  return (
    <header className="console-top">
      <div className="console-top-l">
        <div className="console-brand">
          <span className="console-brand-mark">T/L</span>
          <span className="console-brand-name">throughline</span>
        </div>
        <span className="console-top-sep" />
        <div className="console-breadcrumb">
          <span className="console-bc-key">workspace</span>
          <span className="console-bc-val">delivery</span>
          <span className="console-bc-key">view</span>
          <span className="console-bc-val">console</span>
        </div>
      </div>
      <div className="console-top-c">
        <span className="console-time">Mon 25 May · 09:14</span>
        <span className="console-pulse" />
        <span className="console-live">live</span>
      </div>
      <div className="console-top-r">
        <span className="console-kbd-hint">drag panel grips to rearrange</span>
        <div className="console-add-wrap">
          <button
            className={"console-tbtn " + (addOpen ? "is-on" : "")}
            onClick={onAdd}
            disabled={availablePanels.length === 0}
          >
            {TLIcon.plus(11)}<span>add panel</span>
          </button>
          {addOpen && (
            <div className="console-add-menu" onMouseLeave={onCloseAdd}>
              <div className="console-add-menu-head">add panel</div>
              {availablePanels.length === 0 && (
                <div className="console-add-menu-empty">all panels are visible</div>
              )}
              {availablePanels.map((id) => (
                <button key={id} className="console-add-menu-item" onClick={() => onAddPanel(id)}>
                  <span className="console-add-menu-key">{id}</span>
                  <span className="console-add-menu-title">{window.CONSOLE_PANELS[id].title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="console-tbtn" onClick={onReset} title="reset layout">{TLIcon.refresh(11)}</button>
        <button
          className="console-tbtn console-theme-toggle"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          title={"switch to " + (theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M9.5 7.5A4 4 0 014.5 2.5 4 4 0 1010 7.5z" fill="currentColor" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="2.2" fill="currentColor" />
              <path d="M6 1v1.4M6 9.6V11M1 6h1.4M9.6 6H11M2.5 2.5l1 1M8.5 8.5l1 1M2.5 9.5l1-1M8.5 3.5l1-1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}

// ── Panel shell ───────────────────────────────────────────────────────────
function PanelShell({ title, currentW, allowedW, onDragStart, onDragEnd, onResize, onRemove, bodyKind, children }) {
  const canResize = allowedW && allowedW.length > 1;
  const widthLabel =
    currentW === 12 ? "full" :
    currentW === 8 ? "2/3" :
    currentW === 6 ? "1/2" :
    currentW === 4 ? "1/3" : currentW;
  return (
    <section className={"console-panel console-panel--" + bodyKind} draggable={false}>
      <header
        className="console-panel-head"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <span className="console-panel-grip" title="drag to reorder">
          <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
            <circle cx="2.5" cy="2.5" r="1.1" fill="currentColor" />
            <circle cx="7.5" cy="2.5" r="1.1" fill="currentColor" />
            <circle cx="2.5" cy="7" r="1.1" fill="currentColor" />
            <circle cx="7.5" cy="7" r="1.1" fill="currentColor" />
            <circle cx="2.5" cy="11.5" r="1.1" fill="currentColor" />
            <circle cx="7.5" cy="11.5" r="1.1" fill="currentColor" />
          </svg>
        </span>
        <span className="console-panel-title">{title}</span>
        <span className="console-panel-spacer" />
        {canResize && (
          <button className="console-panel-btn" onClick={onResize} title="cycle width">
            <span className="console-panel-width">{widthLabel}</span>
          </button>
        )}
        <button className="console-panel-btn" onClick={onRemove} title="remove panel">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="console-panel-body">{children}</div>
    </section>
  );
}

// ── Tweaks (theme + density + panel toggles) ──────────────────────────────
function ConsoleTweaks({ theme, setTheme, density, setDensity, layout, onTogglePanel, onReset }) {
  const visibleIds = new Set(layout.map((p) => p.id));
  const allIds = Object.keys(window.CONSOLE_PANELS);
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Theme">
        <TweakRadio
          label="Mode"
          value={theme}
          options={[
            { value: "light", label: "Light" },
            { value: "dark",  label: "Dark"  },
          ]}
          onChange={setTheme}
        />
        <TweakRadio
          label="Density"
          value={density}
          options={[
            { value: "compact",   label: "Compact"   },
            { value: "comfortable", label: "Roomy" },
          ]}
          onChange={setDensity}
        />
      </TweakSection>

      <TweakSection label="Panels">
        {allIds.map((id) => (
          <TweakToggle
            key={id}
            label={window.CONSOLE_PANELS[id].title}
            value={visibleIds.has(id)}
            onChange={(v) => onTogglePanel(id, v)}
          />
        ))}
      </TweakSection>

      <TweakSection label="Layout">
        <TweakButton label="Reset to default layout" onClick={onReset} secondary />
      </TweakSection>
    </TweaksPanel>
  );
}

window.ConsoleApp = ConsoleApp;
