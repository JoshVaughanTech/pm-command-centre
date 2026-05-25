// Tiny SVG icon set for Throughline — drawn as inline strokes so we're not
// pulling in Lucide. Each is a 16x16 viewBox, currentColor stroke.
// Pass `size` to override.

const tlSvg = (size = 16, children) =>
  React.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.4,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    children
  );

const TLIcon = {
  search: (s) => tlSvg(s, React.createElement(React.Fragment, null,
    React.createElement("circle", { cx: 7, cy: 7, r: 4.5 }),
    React.createElement("path", { d: "M11 11l3 3" })
  )),
  plus: (s) => tlSvg(s, React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M8 3v10M3 8h10" })
  )),
  arrow: (s) => tlSvg(s, React.createElement("path", { d: "M3 8h10M9 4l4 4-4 4" })),
  arrowUR: (s) => tlSvg(s, React.createElement("path", { d: "M5 11L11 5M6 5h5v5" })),
  check: (s) => tlSvg(s, React.createElement("path", { d: "M3 8.5l3 3 7-7" })),
  dot: (s) => tlSvg(s, React.createElement("circle", { cx: 8, cy: 8, r: 2.5, fill: "currentColor", stroke: "none" })),
  triangle: (s) => tlSvg(s, React.createElement("path", { d: "M8 2.5l5.5 10h-11z" })),
  inbox: (s) => tlSvg(s, React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M2 9h3l1 2h4l1-2h3M2 9l1.5-5h9L14 9v4H2z" })
  )),
  bolt: (s) => tlSvg(s, React.createElement("path", { d: "M9 2L3 9h4l-1 5 6-7H8z" })),
  calendar: (s) => tlSvg(s, React.createElement(React.Fragment, null,
    React.createElement("rect", { x: 2.5, y: 3.5, width: 11, height: 10, rx: 1 }),
    React.createElement("path", { d: "M2.5 6.5h11M5.5 2v3M10.5 2v3" })
  )),
  users: (s) => tlSvg(s, React.createElement(React.Fragment, null,
    React.createElement("circle", { cx: 6, cy: 6, r: 2.5 }),
    React.createElement("path", { d: "M2 13c0-2.2 1.8-4 4-4s4 1.8 4 4" }),
    React.createElement("path", { d: "M10.5 4.5a2 2 0 010 4M14 13c0-1.6-1-3-2.5-3.5" })
  )),
  warn: (s) => tlSvg(s, React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M8 2.5l6 11H2z" }),
    React.createElement("path", { d: "M8 7v3M8 12v.01" })
  )),
  layers: (s) => tlSvg(s, React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M8 2l6 3-6 3-6-3z" }),
    React.createElement("path", { d: "M2 8l6 3 6-3M2 11l6 3 6-3" })
  )),
  fileText: (s) => tlSvg(s, React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M3 2h6l4 4v8H3z" }),
    React.createElement("path", { d: "M9 2v4h4M5.5 8.5h5M5.5 11h3.5" })
  )),
  mail: (s) => tlSvg(s, React.createElement(React.Fragment, null,
    React.createElement("rect", { x: 2, y: 3.5, width: 12, height: 9, rx: 1 }),
    React.createElement("path", { d: "M2 5l6 4 6-4" })
  )),
  send: (s) => tlSvg(s, React.createElement("path", { d: "M14 2L2 7l5 2 2 5z" })),
  chev: (s) => tlSvg(s, React.createElement("path", { d: "M6 4l4 4-4 4" })),
  chevD: (s) => tlSvg(s, React.createElement("path", { d: "M4 6l4 4 4-4" })),
  spark: (s) => tlSvg(s, React.createElement("path", { d: "M8 2l1.2 3.8L13 7l-3.8 1.2L8 12l-1.2-3.8L3 7l3.8-1.2zM12.5 11l.5 1.5L14.5 13l-1.5.5L12.5 15l-.5-1.5L10.5 13l1.5-.5z" })),
  more: (s) => tlSvg(s, React.createElement("path", { d: "M3 8h.01M8 8h.01M13 8h.01" })),
  bell: (s) => tlSvg(s, React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M3.5 11.5h9L11 9V6.5a3 3 0 00-6 0V9z" }),
    React.createElement("path", { d: "M6.5 13.5a1.5 1.5 0 003 0" })
  )),
  filter: (s) => tlSvg(s, React.createElement("path", { d: "M2 4h12l-4.5 5v4l-3 1.5V9z" })),
  copy: (s) => tlSvg(s, React.createElement(React.Fragment, null,
    React.createElement("rect", { x: 5, y: 5, width: 9, height: 9, rx: 1 }),
    React.createElement("path", { d: "M3 11V3h8" })
  )),
  refresh: (s) => tlSvg(s, React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M3 8a5 5 0 018.5-3.5L13 6M13 3v3h-3" }),
    React.createElement("path", { d: "M13 8a5 5 0 01-8.5 3.5L3 10M3 13v-3h3" })
  )),
  flag: (s) => tlSvg(s, React.createElement("path", { d: "M3.5 14V2.5h7L9 5.5l1.5 3h-7" })),
};

window.TLIcon = TLIcon;
