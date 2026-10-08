/*!
 * Groundline widget loader.
 * Usage: <script src="https://YOUR-GROUNDLINE-HOST/widget.js" data-key="wk_..." async></script>
 *
 * Deliberately tiny and dependency-free: customers paste it once and never update it.
 * All real UI lives in an iframe served from our origin (/embed/<key>), so this file only
 * draws the launcher button and opens/closes the frame. Messages from the frame are
 * accepted only from our origin and only for a short allowlist of types.
 */
(function () {
  if (window.__groundline) return;
  var script = document.currentScript;
  if (!script) return;
  var key = script.getAttribute("data-key");
  if (!key) {
    console.warn("[Groundline] data-key attribute is missing on the widget script tag");
    return;
  }
  var origin;
  try {
    origin = new URL(script.src, location.href).origin;
  } catch {
    return;
  }
  var color = script.getAttribute("data-color") || "#0f766e";
  var position = script.getAttribute("data-position") === "left" ? "left" : "right";

  var css =
    ".gl-launcher{position:fixed;bottom:20px;" + position + ":20px;z-index:2147483000;width:56px;height:56px;border-radius:9999px;border:0;cursor:pointer;background:" + color + ";color:#fff;box-shadow:0 10px 30px -10px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;transition:transform .15s ease}" +
    ".gl-launcher:hover{transform:scale(1.05)}" +
    ".gl-launcher svg{width:26px;height:26px}" +
    ".gl-frame{position:fixed;bottom:88px;" + position + ":20px;z-index:2147483000;width:380px;height:min(600px,calc(100vh - 110px));border:0;border-radius:16px;box-shadow:0 20px 60px -20px rgba(0,0,0,.45);background:#fff;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .18s ease,transform .18s ease}" +
    ".gl-frame.gl-open{opacity:1;transform:none;pointer-events:auto}" +
    "@media (max-width:480px){.gl-frame{bottom:0;" + position + ":0;width:100vw;height:100dvh;border-radius:0}}";
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var chatIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z"/></svg>';
  var closeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var button = document.createElement("button");
  button.className = "gl-launcher";
  button.type = "button";
  button.setAttribute("aria-label", "Open support chat");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = chatIcon;

  var frame = null;
  var open = false;

  function ensureFrame() {
    if (frame) return;
    frame = document.createElement("iframe");
    frame.className = "gl-frame";
    frame.title = "Support chat";
    frame.src = origin + "/embed/" + encodeURIComponent(key) + "?host=" + encodeURIComponent(location.origin);
    frame.setAttribute("allow", "clipboard-write");
    document.body.appendChild(frame);
  }

  function setOpen(next) {
    open = next;
    if (open) ensureFrame();
    if (frame) frame.classList.toggle("gl-open", open);
    button.innerHTML = open ? closeIcon : chatIcon;
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.setAttribute("aria-label", open ? "Close support chat" : "Open support chat");
  }

  button.addEventListener("click", function () {
    setOpen(!open);
  });

  window.addEventListener("message", function (event) {
    if (event.origin !== origin) return;
    var data = event.data;
    if (!data || typeof data.type !== "string") return;
    if (data.type === "groundline:close") setOpen(false);
  });

  function mount() {
    document.body.appendChild(button);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  window.__groundline = {
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    toggle: function () { setOpen(!open); },
  };
})();
