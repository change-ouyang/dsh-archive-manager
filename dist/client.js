(function() {
  "use strict";
  window.__ModuleLoader__.load({
    id: "dsh-archive-manager",
    factory: (require) => {
      const module = { exports: {} };
      const exports = module.exports;
      const React = require("react");
      const { createElement: h, useState, useEffect, useCallback, useMemo, useRef } = React;
      const inject = ["slots"];
      const API = "/api/dsh-archive";
      const CSS = `
      .dar-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
      .dar-title { font-size: 15px; font-weight: 600; margin: 0; line-height: 1.35; }
      .dar-sub { font-size: 12px; opacity: .62; margin: 3px 0 0; line-height: 1.5; }
      .dar-stats { display: flex; gap: 8px; margin-left: auto; flex-wrap: wrap; }
      .dar-stat { padding: 6px 11px; border-radius: 8px; background: var(--dsw-alias-settings-card-fill, rgba(127,127,127,.1));
                  border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.22)); text-align: right; min-width: 74px; }
      .dar-stat b { display: block; font-size: 15px; font-weight: 650; font-variant-numeric: tabular-nums; line-height: 1.25; }
      .dar-stat span { font-size: 10.5px; opacity: .58; }

      .dar-bar { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; flex-wrap: wrap; }
      .dar-search { flex: 1; min-width: 170px; padding: 7px 11px; border-radius: 8px;
        border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28));
        background: var(--dsw-alias-settings-input-fill, rgba(127,127,127,.08));
        color: inherit; font-size: 12.5px; font-family: inherit; }
      .dar-search:focus { outline: none; border-color: var(--dsw-alias-primary, #3b82f6); }
      .dar-search::placeholder { opacity: .45; }
      .dar-btn { padding: 7px 13px; border-radius: 8px; cursor: pointer; font-size: 12.5px; font-family: inherit;
        border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28));
        background: var(--dsw-alias-settings-card-fill, rgba(127,127,127,.08)); color: inherit;
        white-space: nowrap; transition: background .14s ease, border-color .14s ease, opacity .14s ease; }
      .dar-btn:hover:not(:disabled) { background: var(--dsw-alias-settings-card-hover, rgba(127,127,127,.15)); }
      .dar-btn:disabled { opacity: .45; cursor: not-allowed; }
      .dar-btn.primary { border-color: var(--dsw-alias-primary, #3b82f6);
        background: var(--dsw-alias-primary, #3b82f6); color: #fff; }
      .dar-btn.primary:hover:not(:disabled) { filter: brightness(1.08); }
      .dar-btn.danger { color: var(--dsw-alias-danger, #e5484d);
        border-color: var(--dsw-alias-danger-border, rgba(229,72,77,.42)); }
      .dar-btn.danger:hover:not(:disabled) { background: var(--dsw-alias-danger-fill, rgba(229,72,77,.12)); }

      .dar-list { display: flex; flex-direction: column; gap: 6px; }
      .dar-item { display: flex; align-items: center; gap: 12px; padding: 11px 13px; border-radius: 9px;
        border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.18));
        background: var(--dsw-alias-settings-card-fill, rgba(127,127,127,.06)); transition: border-color .14s ease; }
      .dar-item:hover { border-color: var(--dsw-alias-border-l2, rgba(127,127,127,.36)); }
      .dar-meta { flex: 1; min-width: 0; }
      .dar-t { font-size: 13px; font-weight: 520; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.45; }
      .dar-s { font-size: 11.5px; opacity: .56; margin-top: 3px; display: flex; gap: 7px; align-items: center;
        white-space: nowrap; overflow: hidden; }
      .dar-s code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px;
        background: var(--dsw-alias-settings-card-fill, rgba(127,127,127,.1)); padding: 1px 5px; border-radius: 4px; }
      .dar-s .dar-gone { color: var(--dsw-alias-danger, #e5484d); opacity: .85; }
      .dar-act { display: flex; gap: 6px; flex-shrink: 0; }
      .dar-act .dar-btn { padding: 5px 11px; font-size: 12px; }

      .dar-empty { padding: 44px 20px; text-align: center; }
      .dar-empty-ico { font-size: 30px; opacity: .28; margin-bottom: 10px; }
      .dar-empty-t { font-size: 13px; opacity: .6; margin-bottom: 5px; }
      .dar-empty-s { font-size: 11.5px; opacity: .4; line-height: 1.6; }

      /* 仅用于首次加载失败的错误态；单次操作不弹任何提示。 */
      .dar-msg { margin-bottom: 12px; padding: 9px 13px; border-radius: 8px; font-size: 12px; line-height: 1.55; }
      .dar-msg.err { color: var(--dsw-alias-danger, #e5484d);
        background: var(--dsw-alias-danger-fill, rgba(229,72,77,.1));
        border: 1px solid var(--dsw-alias-danger-border, rgba(229,72,77,.3)); }

      .dar-foot { margin-top: 12px; font-size: 11.5px; opacity: .5; line-height: 1.6; }

      /* 确认弹窗：不用 window.confirm —— 它属于浏览器原生 chrome，
         在桌面壳里既突兀又打断主题，而且会冻结渲染进程。 */
      .dar-veil { position: fixed; inset: 0; background: rgba(0,0,0,.42); z-index: 9999;
        display: flex; align-items: center; justify-content: center; padding: 24px;
        animation: dar-fade .14s ease; }
      @keyframes dar-fade { from { opacity: 0 } to { opacity: 1 } }
      .dar-modal { width: min(400px, 100%); border-radius: 12px; padding: 20px 22px 17px;
        background: var(--dsw-alias-settings-card-fill-solid, var(--dsw-alias-settings-card-fill, #252528));
        border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.26));
        box-shadow: 0 18px 52px rgba(0,0,0,.5); animation: dar-pop .17s cubic-bezier(.2,.9,.3,1.2); }
      @keyframes dar-pop { from { opacity: 0; transform: scale(.96) translateY(6px) } to { opacity: 1; transform: none } }
      .dar-modal h4 { margin: 0 0 9px; font-size: 14.5px; font-weight: 600; line-height: 1.4; }
      .dar-modal p { margin: 0 0 5px; font-size: 12.5px; line-height: 1.62; opacity: .74; }
      .dar-modal .dar-warn { color: var(--dsw-alias-danger, #e5484d); opacity: .95; }
      .dar-modal-foot { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; }
      .dar-modal-foot .dar-btn { min-width: 72px; justify-content: center; text-align: center; }
      .dar-modal-foot .dar-btn.primary.danger-solid { background: var(--dsw-alias-danger, #e5484d);
        border-color: var(--dsw-alias-danger, #e5484d); color: #fff; }
      .dar-modal-foot .dar-btn.primary.danger-solid:hover:not(:disabled) { filter: brightness(1.08) }
    `;
      function formatBytes(n) {
        if (!n || n < 0) return "—";
        if (n < 1024) return n + " B";
        if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
        return (n / 1048576).toFixed(1) + " MB";
      }
      function shortId(id) {
        return String(id || "").replace(/^session-/, "").slice(0, 8);
      }
      async function callApi(path, options) {
        const res = await fetch(API + path, options);
        let data = null;
        try {
          data = await res.json();
        } catch {
        }
        if (!res.ok) {
          throw new Error(data && (data.message || data.error) || "请求失败（HTTP " + res.status + "）");
        }
        return data;
      }
      function Page() {
        const [state, setState] = useState({ loading: true, error: null, sessions: [], total: 0, onDisk: 0, bytes: 0 });
        const [query, setQuery] = useState("");
        const [busyId, setBusyId] = useState(null);
        const [pending, setPending] = useState(null);
        const load = useCallback(async (silent) => {
          if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
          try {
            const data = await callApi("/sessions");
            setState((s) => ({
              loading: false,
              error: null,
              sessions: silent ? s.sessions : Array.isArray(data.sessions) ? data.sessions : [],
              total: data.total || 0,
              onDisk: data.onDisk || 0,
              bytes: data.bytes || 0
            }));
          } catch (err) {
            if (!silent) {
              setState({ loading: false, error: String(err.message || err), sessions: [], total: 0, onDisk: 0, bytes: 0 });
            }
          }
        }, []);
        useEffect(() => {
          load();
        }, [load]);
        const runAction = useCallback(async (action, session) => {
          const verb = action === "remove" ? "彻底删除" : "恢复";
          setPending(null);
          setBusyId(session.id);
          try {
            await callApi("/" + action, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: session.id })
            });
            setState((s) => {
              const rest = s.sessions.filter((x) => x.id !== session.id);
              const goneBytes = action === "remove" ? session.bytes : 0;
              return {
                ...s,
                sessions: rest,
                total: Math.max(0, s.total - 1),
                onDisk: action === "remove" && session.onDisk ? Math.max(0, s.onDisk - 1) : s.onDisk,
                bytes: Math.max(0, s.bytes - goneBytes)
              };
            });
            void load(true);
          } catch (err) {
            console.warn("[dsh-archive-manager] " + verb + "失败：" + String((err == null ? void 0 : err.message) ?? err));
          } finally {
            setBusyId(null);
          }
        }, [load]);
        const filtered = useMemo(() => {
          const q = query.trim().toLowerCase();
          if (!q) return state.sessions;
          return state.sessions.filter((s) => String(s.title || "").toLowerCase().includes(q) || String(s.workspace || "").toLowerCase().includes(q) || String(s.id || "").toLowerCase().includes(q));
        }, [state.sessions, query]);
        if (state.loading) {
          return h(
            React.Fragment,
            null,
            h("style", null, CSS),
            h(
              "div",
              { className: "dar-empty" },
              h("div", { className: "dar-empty-ico" }, "⏳"),
              h("div", { className: "dar-empty-t" }, "正在读取归档会话…")
            )
          );
        }
        if (state.error) {
          return h(
            React.Fragment,
            null,
            h("style", null, CSS),
            h("div", { className: "dar-msg err" }, "读取失败：" + state.error),
            h("div", null, h("button", { className: "dar-btn", onClick: () => load() }, "重试"))
          );
        }
        return h(
          React.Fragment,
          null,
          h("style", null, CSS),
          h(
            "div",
            { className: "dar-head" },
            h(
              "div",
              null,
              h("h3", { className: "dar-title" }, "归档会话"),
              h("p", { className: "dar-sub" }, "归档不会删除任何会话文件，只是把它们从列表里隐藏；最新归档的排在最前。")
            ),
            h(
              "div",
              { className: "dar-stats" },
              h("div", { className: "dar-stat" }, h("b", null, String(state.total)), h("span", null, "已归档")),
              h("div", { className: "dar-stat" }, h("b", null, String(state.onDisk)), h("span", null, "文件在盘")),
              h("div", { className: "dar-stat" }, h("b", null, formatBytes(state.bytes)), h("span", null, "占用"))
            )
          ),
          h(
            "div",
            { className: "dar-bar" },
            h("input", {
              className: "dar-search",
              value: query,
              placeholder: "搜索标题、工作区或 ID",
              onChange: (e) => setQuery(e.target.value)
            }),
            h("button", { className: "dar-btn", onClick: () => load() }, "刷新")
          ),
          filtered.length === 0 ? h(
            "div",
            { className: "dar-empty" },
            h("div", { className: "dar-empty-ico" }, "🗂"),
            h(
              "div",
              { className: "dar-empty-t" },
              state.total === 0 ? "还没有归档的会话" : "没有匹配的归档会话"
            ),
            state.total === 0 ? h("div", { className: "dar-empty-s" }, "在会话列表里归档的会话会出现在这里。") : null
          ) : h(
            "div",
            { className: "dar-list" },
            filtered.map((s) => h(
              "div",
              { className: "dar-item", key: s.id },
              h(
                "div",
                { className: "dar-meta" },
                h("div", { className: "dar-t", title: s.title }, s.title || "未命名会话"),
                h(
                  "div",
                  { className: "dar-s" },
                  h("code", null, shortId(s.id)),
                  h("span", null, "·"),
                  h("span", null, s.workspace || "未知工作区"),
                  h("span", null, "·"),
                  s.onDisk ? h("span", null, formatBytes(s.bytes)) : h("span", { className: "dar-gone" }, "文件已缺失")
                )
              ),
              h(
                "div",
                { className: "dar-act" },
                h("button", {
                  className: "dar-btn",
                  disabled: busyId === s.id,
                  onClick: () => setPending({ action: "unarchive", session: s })
                }, busyId === s.id ? "处理中…" : "恢复"),
                h("button", {
                  className: "dar-btn danger",
                  disabled: busyId === s.id,
                  onClick: () => setPending({ action: "remove", session: s })
                }, "删除")
              )
            ))
          ),
          h(
            "div",
            { className: "dar-foot" },
            state.total > 0 ? "显示 " + filtered.length + " / " + state.total + " 条归档会话" : ""
          ),
          pending ? h(ConfirmDialog, {
            action: pending.action,
            session: pending.session,
            busy: busyId === pending.session.id,
            onCancel: () => setPending(null),
            onConfirm: () => runAction(pending.action, pending.session)
          }) : null
        );
      }
      function ConfirmDialog(props) {
        const isRemove = props.action === "remove";
        const title = props.session.title || "未命名会话";
        const cancelRef = useRef(null);
        const confirmRef = useRef(null);
        useEffect(() => {
          const target = isRemove ? cancelRef.current : confirmRef.current;
          if (target && typeof target.focus === "function") target.focus();
          const onKey = (e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              props.onCancel();
            }
          };
          window.addEventListener("keydown", onKey, true);
          return () => window.removeEventListener("keydown", onKey, true);
        }, [isRemove]);
        return h(
          "div",
          {
            className: "dar-veil",
            onClick: (e) => {
              if (e.target === e.currentTarget && !props.busy) props.onCancel();
            }
          },
          h(
            "div",
            { className: "dar-modal", role: "dialog", "aria-modal": "true" },
            h("h4", null, (isRemove ? "彻底删除" : "恢复") + "「" + title + "」？"),
            h("p", null, isRemove ? "这条会话会从归档集合、所属工作区引用以及磁盘上一并移除。" : "它会回到会话列表里原来的位置。"),
            h("p", { className: isRemove ? "dar-warn" : null }, isRemove ? "删除后无法撤销，会话文件不会被备份。" : "会话文件不会被改动。"),
            h(
              "div",
              { className: "dar-modal-foot" },
              h("button", {
                className: "dar-btn",
                ref: cancelRef,
                disabled: props.busy,
                onClick: props.onCancel
              }, "取消"),
              h("button", {
                className: "dar-btn " + (isRemove ? "primary danger-solid" : "primary"),
                ref: confirmRef,
                disabled: props.busy,
                onClick: props.onConfirm
              }, props.busy ? "处理中…" : isRemove ? "删除" : "恢复")
            )
          )
        );
      }
      function apply(ctx) {
        ctx.slots.inject("settings.section", () => ctx.slots.register({
          name: "settings.section",
          id: "dsh-archive",
          order: 40,
          label: () => "归档会话"
        }, () => h(Page)));
      }
      exports.name = "dsh-archive-manager";
      exports.inject = inject;
      exports.apply = apply;
      exports.__test = { Page, CSS, formatBytes, shortId };
      return module.exports;
    }
  });
})();
//# sourceMappingURL=client.js.map
