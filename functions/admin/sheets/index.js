
import { shellHtml, PRIMARY_TABS } from '../_layout.js';

export function workbookResponse(activeTab, activeHref) {
  const navTabs = PRIMARY_TABS.filter((t) => !['/admin/directory', '/admin/ledger', '/admin/sheets'].includes(t.href));
  const body = `
<style>
main{max-width:none !important;padding:0 !important;margin:0 !important}
header nav.tab-row,header nav.sub-row{display:none}
#ms-sheets-workbook{--gs-border:#dadce0;--gs-grid:#e1e1e1;--gs-head-bg:#f8f9fa;--gs-head-ink:#5f6368;
  --gs-blue:#1a73e8;--gs-blue-soft:rgba(26,115,232,.09);--gs-head-sel:#d3e3fd;--gs-green:#188038;
  --gs-ink:#202124;--gs-toolbar:#f9fbfd;--gs-pill:#edf2fa;
  font-family:Roboto,'Helvetica Neue',Arial,sans-serif;color:var(--gs-ink);position:relative;
  display:flex;flex-direction:column;height:calc(100vh - 118px);min-height:520px;background:#fff}
#ms-sheets-workbook *{box-sizing:border-box}

/* ── title row ── */
.gs-titlebar{display:flex;align-items:center;gap:10px;padding:8px 16px 0}
.gs-logo{width:26px;height:34px;border-radius:3px;background:#0f9d58;position:relative;flex:0 0 auto}
.gs-logo:before{content:'';position:absolute;inset:8px 6px;background:
  linear-gradient(#fff,#fff) 0 0/100% 2px no-repeat,
  linear-gradient(#fff,#fff) 0 6px/100% 2px no-repeat,
  linear-gradient(#fff,#fff) 0 12px/100% 2px no-repeat,
  linear-gradient(#fff,#fff) 8px 0/2px 100% no-repeat}
#gs-title{font-size:18px;border:1px solid transparent;border-radius:4px;padding:2px 8px;min-width:60px;
  max-width:420px;overflow:hidden;white-space:nowrap;outline:none;font-family:'Google Sans',Roboto,Arial,sans-serif}
#gs-title[contenteditable=true]:hover{border-color:var(--gs-border)}
#gs-title[contenteditable=true]:focus{border-color:var(--gs-blue)}
#gs-saved{font-size:12px;color:var(--gs-head-ink);padding:2px 6px;white-space:nowrap}
#gs-saved.err{color:#c5221f;font-weight:600}
.gs-titlebar .sp{flex:1}
.gs-chip{font-size:11px;color:var(--gs-head-ink);border:1px solid var(--gs-border);border-radius:12px;padding:3px 10px;text-decoration:none}
.gs-chip:hover{background:var(--gs-pill)}
/* Sheet ⇄ Classic: the two views of the same objects, top right */
#gs-viewtoggle{display:none;align-items:center}
#gs-viewtoggle .gs-chip{border-radius:0;border-right-width:0;padding:3px 12px}
#gs-viewtoggle .gs-chip:first-child{border-radius:12px 0 0 12px}
#gs-viewtoggle .gs-chip:last-child{border-radius:0 12px 12px 0;border-right-width:1px}
#gs-viewtoggle .gs-chip.on{background:#202124;color:#fff;border-color:#202124}
/* the active cell's object id — every cell is a particle of an addressable object */
#gs-objid{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;font-family:Menlo,monospace;color:var(--gs-blue);padding:0 12px;border-left:1px solid #eee;height:100%;display:none;align-items:center;text-decoration:none;flex:0 0 auto}
#gs-objid:hover{background:var(--gs-pill)}

/* ── menubar ── */
.gs-menubar{display:flex;gap:2px;padding:2px 16px 4px;position:relative;flex-wrap:wrap}
.gs-menu{font-size:13.5px;padding:3px 9px;border-radius:4px;cursor:default;user-select:none}
.gs-menu:hover,.gs-menu.open{background:var(--gs-pill)}
.gs-dropdown{position:absolute;top:100%;left:0;min-width:250px;background:#fff;border:1px solid var(--gs-border);
  border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.18);padding:6px 0;z-index:60;display:none}
.gs-dropdown.open{display:block}
.gs-item{display:flex;align-items:center;gap:10px;padding:6px 18px;font-size:13px;cursor:default;white-space:nowrap}
.gs-item:hover{background:var(--gs-pill)}
.gs-item.disabled{color:#b0b3b8;pointer-events:none}
.gs-item .kbd{margin-left:auto;color:#9aa0a6;font-size:11.5px;padding-left:22px}
.gs-sep{border-top:1px solid #eee;margin:5px 0}

/* ── toolbar ── */
.gs-toolbar{display:flex;align-items:center;gap:3px;background:var(--gs-toolbar);border-radius:22px;
  margin:0 16px 6px;padding:5px 12px;flex-wrap:wrap;min-height:38px}
.gs-tb{border:none;background:transparent;border-radius:4px;padding:5px 8px;font-size:13px;cursor:pointer;
  color:#444746;display:inline-flex;align-items:center;gap:5px;font-family:inherit}
.gs-tb:hover{background:rgba(68,71,70,.08)}
.gs-tb.on{background:var(--gs-head-sel);color:var(--gs-blue)}
.gs-tb:disabled{opacity:.4;cursor:default;background:transparent}
.gs-tbsep{width:1px;height:20px;background:var(--gs-border);margin:0 5px}
.gs-toolbar input,.gs-toolbar select{font-size:12px;padding:3px 7px;border:1px solid var(--gs-border);border-radius:4px;background:#fff;min-height:0}
.gs-toolbar .tenant{font-size:11px;color:var(--gs-head-ink)}

/* ── formula bar ── */
.gs-fxbar{display:flex;align-items:center;border-top:1px solid var(--gs-border);border-bottom:1px solid var(--gs-border);height:30px}
#gs-namebox{width:110px;border:none;border-right:1px solid var(--gs-border);height:100%;padding:0 10px;font-size:12.5px;
  color:var(--gs-ink);outline:none;text-align:center;font-family:Roboto,Arial,sans-serif}
.gs-fx{color:#9aa0a6;font-style:italic;font-family:Georgia,serif;padding:0 10px;font-size:14px;border-right:1px solid #eee;height:100%;display:flex;align-items:center}
#gs-fxinput{flex:1;border:none;outline:none;height:100%;padding:0 10px;font-size:13px;font-family:Roboto,Arial,sans-serif}

/* ── grid ── */
.gs-gridwrap{flex:1;position:relative;overflow:hidden;display:flex;flex-direction:column}
.gs-colhead-strip{display:flex;overflow:hidden;background:var(--gs-head-bg);border-bottom:1px solid #c7c7c7;flex:0 0 42px;height:42px;user-select:none}
#gs-corner{width:46px;flex:0 0 46px;height:42px;border-right:1px solid #c7c7c7;background:var(--gs-head-bg);cursor:pointer}
#gs-colheads{position:relative;height:100%;flex:1;overflow:hidden}
#gs-colheads-inner{position:absolute;top:0;left:0;height:100%;display:flex}
.gs-colhead{position:relative;border-right:1px solid #c7c7c7;display:flex;flex-direction:column;align-items:center;justify-content:center;
  font-size:11px;color:var(--gs-head-ink);cursor:pointer;overflow:hidden;flex:0 0 auto;background:var(--gs-head-bg)}
.gs-colhead.sel{background:var(--gs-head-sel);color:var(--gs-blue);font-weight:700}
.gs-colhead .cl{font-size:11px;line-height:1.1}
.gs-colhead .cf{font-size:10.5px;line-height:1.2;font-weight:600;color:#3c4043;max-width:95%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gs-colhead .funnel{position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:10px;color:#80868b;display:none;
  width:16px;height:16px;line-height:16px;text-align:center;border-radius:3px}
.gs-colhead:hover .funnel{display:block}
.gs-colhead .funnel:hover{background:rgba(0,0,0,.1)}
.gs-colhead .funnel.on{display:block;color:#fff;background:var(--gs-green);border-radius:50%}
.gs-grip{position:absolute;right:-3px;top:0;width:7px;height:100%;cursor:col-resize;z-index:5}
.gs-body{flex:1;display:flex;overflow:hidden;position:relative}
#gs-rowheads{width:46px;flex:0 0 46px;overflow:hidden;position:relative;background:var(--gs-head-bg);border-right:1px solid #c7c7c7;user-select:none}
#gs-rowheads-inner{position:absolute;top:0;left:0;width:100%}
.gs-rowhead{position:absolute;left:0;width:100%;border-bottom:1px solid #c7c7c7;font-size:11px;color:var(--gs-head-ink);
  display:flex;align-items:center;justify-content:center;cursor:pointer;background:var(--gs-head-bg)}
.gs-rowhead.sel{background:var(--gs-head-sel);color:var(--gs-blue);font-weight:700}
.gs-rowhead.draft{color:#b06000;font-weight:700}
#gs-scroll{flex:1;overflow:auto;position:relative;background:#fff}
#gs-canvas{position:relative}
.gs-cell{position:absolute;border-right:1px solid var(--gs-grid);border-bottom:1px solid var(--gs-grid);
  font-size:13px;font-family:Arial,sans-serif;padding:0 4px;line-height:20px;white-space:nowrap;overflow:hidden;
  text-overflow:clip;background:#fff;color:var(--gs-ink);cursor:cell}
.gs-cell.ro{color:#3c4043;background:#fcfcfc}
/* FROZEN PANES. Cells are absolutely positioned inside the scroller and repainted on every
   scroll event, so a pinned cell is the same cell drawn at scrollTop+y instead of y. It needs an
   opaque background and a z-index, or the rows sliding underneath show through it. */
.gs-cell.fz{z-index:20;background:#fff;box-shadow:none}
.gs-cell.fz.ro{background:#fcfcfc}
.gs-cell.fzboth{z-index:30}
.gs-rowhead.fz{z-index:20;background:var(--gs-head-bg)}
.gs-colhead.fz{z-index:20}
.gs-fzline-h{position:absolute;left:0;right:0;height:2px;background:#4d90fe;z-index:40;pointer-events:none;display:none}
.gs-fzline-v{position:absolute;top:0;bottom:0;width:2px;background:#4d90fe;z-index:40;pointer-events:none;display:none}
/* The grips. Google Sheets puts a thick grey bar on each header edge; grab it and drag. */
#gs-fzgrip-h{position:absolute;left:0;height:9px;z-index:38;cursor:row-resize;background:transparent}
#gs-fzgrip-h:before{content:'';position:absolute;left:0;top:3px;width:34px;height:3px;border-radius:2px;background:#bdc1c6}
#gs-fzgrip-h:hover:before,#gs-fzgrip-h.drag:before{background:#4d90fe;width:100%}
#gs-fzgrip-v{position:absolute;top:0;width:9px;z-index:38;cursor:col-resize;background:transparent}
#gs-fzgrip-v:before{content:'';position:absolute;top:0;left:3px;height:34px;width:3px;border-radius:2px;background:#bdc1c6}
#gs-fzgrip-v:hover:before,#gs-fzgrip-v.drag:before{background:#4d90fe;height:100%}
.gs-fzshadow-h{position:absolute;left:0;right:0;height:6px;z-index:19;pointer-events:none;display:none;
  background:linear-gradient(to bottom,rgba(0,0,0,.16),rgba(0,0,0,0))}
.gs-fzshadow-v{position:absolute;top:0;bottom:0;width:6px;z-index:19;pointer-events:none;display:none;
  background:linear-gradient(to right,rgba(0,0,0,.16),rgba(0,0,0,0))}
.gs-cell.num{text-align:right}
.gs-cell.hl{background:#fff3c4 !important}
.gs-cell.errflash{background:#fce8e6 !important;transition:background .2s}
/* An image cell draws its picture and keeps its URL. Rows are 21px, so the thumbnail is a
   thumbnail — click it to open the full size. Google Sheets fits IMAGE() to the cell the same
   way; a sheet of addresses tells you nothing about the pictures. */
.gs-cell.img{padding:0;overflow:hidden;background:#fff}
.gs-cell.img img{height:100%;width:auto;max-width:100%;object-fit:contain;display:block;image-rendering:auto}
.gs-cell.img.tall img{height:auto;width:100%}
.gs-cell.ovf{z-index:1;border-right:none} /* Sheets overflow: long text spills over empty neighbors */
#gs-editor.ro{background:#f6f8fa}
#gs-selbox,#gs-activebox{position:absolute;pointer-events:none;z-index:3}
#gs-selbox{background:var(--gs-blue-soft);border:1px solid var(--gs-blue)}
#gs-activebox{border:2px solid var(--gs-blue);background:transparent}
#gs-fill{position:absolute;width:7px;height:7px;background:var(--gs-blue);border:1px solid #fff;z-index:4;cursor:crosshair;pointer-events:auto}
/* An open cell reads exactly like Sheets: the heavy blue box on all four sides, and the caret
   blinking inside it, so the cell you are typing in is never ambiguous. caret-color drives the
   native caret; the browser blinks it, which is steadier than animating anything ourselves. */
#gs-editor{position:absolute;z-index:6;display:none;border:2px solid var(--gs-blue);background:#fff;
  font-size:13px;font-family:Arial,sans-serif;padding:0 3px;line-height:20px;outline:none;resize:none;overflow:auto;
  min-height:21px;max-height:40vh;max-width:60vw;white-space:pre-wrap;
  caret-color:var(--gs-blue);box-shadow:0 0 0 1px #fff, 0 2px 8px rgba(0,0,0,.2)}
#gs-editor.ro{caret-color:transparent}
/* The active-cell ring thickens the moment the editor opens, matching the Sheets weight. */
#gs-activebox.editing{border-width:2px;box-shadow:0 0 0 1px #fff}
#gs-dropind{position:absolute;top:0;width:3px;background:var(--gs-blue);z-index:8;display:none;pointer-events:none}
#gs-loading{position:absolute;top:70px;left:50%;transform:translateX(-50%);z-index:9;display:none;
  font-size:13px;color:#3c4043;background:#f1f3f4;border:1px solid var(--gs-border);border-radius:16px;padding:8px 20px;box-shadow:0 2px 8px rgba(0,0,0,.12)}
#gs-dragghost{position:fixed;z-index:99;background:#fff;border:1px solid var(--gs-border);border-radius:4px;
  box-shadow:0 3px 10px rgba(0,0,0,.25);padding:3px 10px;font-size:12px;display:none;pointer-events:none}

/* ── context menu / filter panel ── */
.gs-ctx{position:fixed;z-index:100;background:#fff;border:1px solid var(--gs-border);border-radius:6px;
  box-shadow:0 3px 14px rgba(0,0,0,.22);padding:6px 0;min-width:210px;display:none;max-height:70vh;overflow:auto}
.gs-filterpanel{position:fixed;z-index:100;background:#fff;border:1px solid var(--gs-border);border-radius:8px;
  box-shadow:0 4px 16px rgba(0,0,0,.25);padding:12px;width:270px;display:none;font-size:12.5px}
.gs-filterpanel h4{font-size:11px;color:var(--gs-head-ink);text-transform:uppercase;letter-spacing:.06em;margin:8px 0 4px}
.gs-filterpanel .frow{display:flex;gap:6px;align-items:center;margin:4px 0}
.gs-filterpanel input[type=text],.gs-filterpanel select{width:100%;font-size:12px;padding:4px 7px;border:1px solid var(--gs-border);border-radius:4px}
.gs-vals{max-height:180px;overflow:auto;border:1px solid #eee;border-radius:4px;margin-top:4px}
.gs-vals label{display:flex;gap:6px;align-items:center;padding:3px 8px;font-size:12px;cursor:pointer}
.gs-vals label:hover{background:var(--gs-pill)}
.gs-fbtns{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}
.gs-btn{border:1px solid var(--gs-border);background:#fff;border-radius:5px;padding:5px 14px;font-size:12.5px;cursor:pointer;font-family:inherit}
.gs-btn.pri{background:var(--gs-blue);border-color:var(--gs-blue);color:#fff;font-weight:600}
.gs-btn.pri:disabled{background:#9fc0f0;border-color:#9fc0f0}

/* ── bottom tab strip ── */
.gs-tabbar{display:flex;align-items:center;border-top:1px solid var(--gs-border);background:#f8f9fa;height:36px;padding:0 8px;gap:2px;flex:0 0 auto}
.gs-addtab,.gs-alltabs{border:none;background:transparent;font-size:17px;color:#444746;width:30px;height:28px;border-radius:50%;cursor:pointer}
.gs-addtab:hover,.gs-alltabs:hover{background:rgba(68,71,70,.1)}
.gs-tabs{display:flex;align-items:flex-end;overflow-x:auto;scrollbar-width:none;flex:1;gap:1px}
.gs-tab{position:relative;padding:6px 16px 7px;font-size:12.5px;color:#444746;background:transparent;cursor:pointer;
  border-radius:0;white-space:nowrap;border:1px solid transparent;border-bottom:none;user-select:none}
.gs-tab:hover{background:rgba(68,71,70,.08)}
.gs-tab.on{background:#fff;color:#0b57d0;font-weight:700;border-color:var(--gs-border);border-top-left-radius:6px;border-top-right-radius:6px;
  box-shadow:inset 0 -3px 0 var(--gs-blue)}
.gs-tab .lock{font-size:10px;margin-left:5px;opacity:.6}
a.gs-tab{color:#5f6368;text-decoration:none;font-weight:500;display:inline-block}
a.gs-tab:hover{color:#202124;text-decoration:none}
.gs-tabdiv{width:1px;height:18px;background:var(--gs-border);margin:0 6px;flex:0 0 auto;align-self:center}
#gs-stats{margin-left:auto;font-size:12px;color:var(--gs-head-ink);padding-right:10px;white-space:nowrap}
.gs-kindtabs{display:flex;gap:2px;margin-left:18px;flex-wrap:wrap;align-items:center}
.gs-kind{font-size:12px;padding:3px 10px;border-radius:12px;border:1px solid var(--gs-border);cursor:pointer;color:#444746;user-select:none;background:#fff}
.gs-kind:hover{background:var(--gs-pill)}
.gs-kind.on{background:#202124;color:#fff;border-color:#202124}
.gs-kind .kc{font-size:10px;color:#9aa0a6;margin-left:4px}
.gs-kind.on .kc{color:#bdc1c6}

/* ── run panel ── */
#gs-runpanel{position:absolute;top:0;right:0;bottom:0;width:340px;background:#fff;border-left:1px solid var(--gs-border);
  box-shadow:-3px 0 12px rgba(0,0,0,.08);z-index:40;display:none;flex-direction:column;font-size:12.5px}
#gs-runpanel.open{display:flex}
#gs-runpanel .rp-head{display:flex;align-items:center;padding:12px 14px;border-bottom:1px solid var(--gs-border);font-weight:700;font-size:14px;font-family:'Google Sans',Roboto,Arial,sans-serif}
#gs-runpanel .rp-body{flex:1;overflow:auto;padding:12px 14px}
#gs-runpanel .rp-row{margin:7px 0}
#gs-runpanel label{display:block;font-size:11px;color:var(--gs-head-ink);margin-bottom:2px;font-weight:600}
#gs-runpanel input[type=text],#gs-runpanel input[type=number],#gs-runpanel select,#gs-runpanel textarea{
  width:100%;font-size:12.5px;padding:5px 8px;border:1px solid var(--gs-border);border-radius:5px;font-family:Roboto,Arial,sans-serif;min-height:0}
#gs-runpanel textarea{min-height:64px;font-family:'JetBrains Mono',Menlo,monospace;font-size:11.5px}
#gs-runpanel .rp-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#gs-runpanel .rp-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
#gs-runpanel .rp-foot{border-top:1px solid var(--gs-border);padding:10px 14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#gs-runprog{font-size:12px;color:var(--gs-head-ink)}
.rp-x{margin-left:auto;border:none;background:none;font-size:16px;cursor:pointer;color:#5f6368}

/* ── toast + help ── */
#gs-toast{position:fixed;bottom:52px;left:50%;transform:translateX(-50%);background:#202124;color:#fff;
  padding:10px 20px;border-radius:6px;font-size:13px;z-index:200;display:none;max-width:70vw;box-shadow:0 3px 12px rgba(0,0,0,.4)}
#gs-help{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:150;display:none;align-items:center;justify-content:center}
#gs-help .hp{background:#fff;border-radius:10px;max-width:860px;width:92vw;max-height:84vh;overflow:auto;padding:22px 26px}
#gs-help h2{font-family:'Google Sans',Roboto,Arial,sans-serif;font-size:18px;margin:0 0 10px}
#gs-help h3{font-size:13px;margin:16px 0 6px;color:var(--gs-ink)}
#gs-help table{width:100%;border-collapse:collapse;font-size:12.5px}
#gs-help td{padding:4px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top}
#gs-help td:first-child{white-space:nowrap;color:var(--gs-head-ink);font-family:Menlo,monospace;font-size:11.5px}
#gs-help pre{background:#f8f9fa;border:1px solid var(--gs-border);border-radius:6px;padding:10px;font-size:11.5px;overflow:auto}
#gs-find{position:fixed;top:130px;right:30px;z-index:120;background:#fff;border:1px solid var(--gs-border);border-radius:8px;
  box-shadow:0 3px 14px rgba(0,0,0,.25);padding:8px 10px;display:none;align-items:center;gap:8px}
#gs-find input{font-size:13px;padding:5px 9px;border:1px solid var(--gs-border);border-radius:5px;width:220px}
#gs-find .fc{font-size:11.5px;color:var(--gs-head-ink);min-width:52px;text-align:center}
</style>

<div id="ms-sheets-workbook" data-active-tab="${activeTab}">
  <div class="gs-titlebar">
    <div class="gs-logo" title="Sheets workbook"></div>
    <div id="gs-title" spellcheck="false">Sheets</div>
    <span id="gs-saved">All changes saved</span>
    <span class="sp"></span>
    <span id="gs-viewtoggle"><a class="gs-chip on" id="gs-vt-sheet" href="#" title="This view">Sheet</a><a class="gs-chip" id="gs-classic" href="#" title="Same objects, classic page">Classic view</a></span>
    <a class="gs-chip" href="/api/sheets" target="_blank" rel="noopener">REST</a>
  </div>
  <nav class="gs-menubar" id="gs-menubar"></nav>
  <script type="application/json" id="gs-navtabs-data">${JSON.stringify(navTabs)}</script>
  <div class="gs-toolbar" id="gs-toolbar"></div>
  <div class="gs-fxbar">
    <input id="gs-namebox" value="A1" spellcheck="false" autocomplete="off">
    <span class="gs-fx">fx</span>
    <input id="gs-fxinput" spellcheck="false" autocomplete="off">
    <a id="gs-objid" href="#" target="_blank" rel="noopener" title="The active cell's object — click opens it at its own address"></a>
  </div>
  <div class="gs-gridwrap">
    <div class="gs-colhead-strip">
      <div id="gs-corner" title="Select all"></div>
      <div id="gs-colheads"><div id="gs-colheads-inner"></div></div>
    </div>
    <div class="gs-body">
      <div id="gs-rowheads"><div id="gs-rowheads-inner"></div></div>
      <div id="gs-scroll"><div id="gs-canvas">
        <div id="gs-selbox" style="display:none"></div>
        <div id="gs-activebox" style="display:none"></div>
        <div id="gs-fill" style="display:none"></div>
      </div></div>
      <div class="gs-fzshadow-h" id="gs-fzshadow-h"></div>
      <div class="gs-fzshadow-v" id="gs-fzshadow-v"></div>
      <div id="gs-fzgrip-h" title="Drag down to freeze rows"></div>
      <div id="gs-fzgrip-v" title="Drag right to freeze columns"></div>
      <div class="gs-fzline-h" id="gs-fzline-h"></div>
      <div class="gs-fzline-v" id="gs-fzline-v"></div>
      <div id="gs-loading">Loading…</div>
      <div id="gs-runpanel"></div>
    </div>
    <div id="gs-dropind"></div>
  </div>
  <div class="gs-tabbar">
    <button class="gs-addtab" id="gs-addtab" title="Add sheet">+</button>
    <button class="gs-alltabs" id="gs-alltabs" title="All sheets">≡</button>
    <div class="gs-tabs" id="gs-tabs"></div>
    <span id="gs-stats"></span>
  </div>
  <textarea id="gs-editor" spellcheck="false"></textarea>
  <div id="gs-dragghost"></div>
  <div class="gs-ctx" id="gs-ctx"></div>
  <div class="gs-filterpanel" id="gs-filterpanel"></div>
  <div id="gs-toast"></div>
  <div id="gs-find"><input id="gs-find-q" placeholder="Find in sheet"><span class="fc" id="gs-find-c">0 of 0</span><button class="gs-btn" id="gs-find-prev">↑</button><button class="gs-btn" id="gs-find-next">↓</button><button class="gs-btn" id="gs-find-x">✕</button></div>
  <div id="gs-help"><div class="hp" id="gs-help-body"></div></div>
</div>

<script>
(function(){
'use strict';
/* ═══════════════════ helpers ═══════════════════ */
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function colLetter(n){ var s=''; while(n>0){ var m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); } return s||'A'; }
function letterCol(s){ s=String(s||'').toUpperCase(); if(!/^[A-Z]+$/.test(s)) return null; var n=0; for(var i=0;i<s.length;i++) n=n*26+(s.charCodeAt(i)-64); return n; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function isNum(v){ return v!=='' && v!=null && isFinite(Number(String(v).replace(/,/g,''))); }
function toast(msg,ms){ var t=$('gs-toast'); t.textContent=msg; t.style.display='block';
  clearTimeout(toast._t); toast._t=setTimeout(function(){ t.style.display='none'; }, ms||2600); }
// Token propagation: a workbook reached via ?share= / ?terminal_key= / ?tk= must carry that
// token on its own API calls too — the cookie is absent on those visits.
var TOKQ=(function(){ try{ var p=new URLSearchParams(location.search), ks=['share','terminal_key','tk'];
  for(var i=0;i<ks.length;i++){ var v=p.get(ks[i]); if(v) return ks[i]+'='+encodeURIComponent(v); } }catch(e){} return ''; })();
function jfetch(url,opts){ opts=opts||{}; opts.credentials='same-origin';
  if(TOKQ && url.charAt(0)==='/') url+=(url.indexOf('?')>=0?'&':'?')+TOKQ;
  if(opts.body && typeof opts.body!=='string') { opts.body=JSON.stringify(opts.body); opts.headers=Object.assign({'content-type':'application/json'},opts.headers||{}); }
  // Never leave a caller hanging: a non-JSON body or a dead network resolves as a failed
  // result the caller can show, instead of an unhandled rejection stuck at "Saving…".
  return fetch(url,opts).then(function(r){
    return r.json().then(function(j){ return {status:r.status, ok:r.ok, j:j}; })
      .catch(function(){ return {status:r.status, ok:false, j:{error:'HTTP '+r.status+' (non-JSON response)'}}; });
  }).catch(function(){ return {status:0, ok:false, j:{error:'network error — check the connection and retry'}}; }); }

// A 401 used to arrive as an empty result, so the grid drew no column letters, no rows and no
// tabs — identical to a broken sheet, and the owner reasonably read it as one. An expired
// session now says so on the page, once, with the way back.
var SESSION_DEAD=false;
function noteAuthFailure(res){
  if(!res || res.status!==401 || SESSION_DEAD) return res && res.status===401;
  SESSION_DEAD=true;
  var el=$('gs-loading');
  if(el){
    el.style.display='block';
    el.innerHTML='<div style="text-align:center;font:13px/1.6 Arial,sans-serif;color:#3c4043">'
      +'<div style="font-size:15px;font-weight:600;margin-bottom:6px">Your admin session has expired</div>'
      +'<div style="color:#5f6368">The page loaded but the grid could not be read, which is why it is empty.</div>'
      +'<div style="margin-top:12px"><a href="/admin/login?next='+encodeURIComponent(location.pathname+location.search)
      +'" style="display:inline-block;background:#1a73e8;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none">Sign in again</a></div>'
      +'</div>';
  }
  return true;
}

var ROW_H=21, HEAD_H=42, DEFAULT_W=100, ROWHEAD_W=46;

/* ═══════════════════ tab model ═══════════════════ */
// A tab = one sheet. kind: 'directory' | 'ledger' | 'user'.
var TABS=[
  { kind:'directory', id:'directory', title:'Directory' },
  { kind:'ledger', id:'ledger', title:'Ledger' },
  { kind:'turns', id:'turns', title:'Turns' },
  { kind:'forum', id:'forum', title:'Forum' }
];
var NAVTABS=[]; try{ NAVTABS=JSON.parse(document.getElementById('gs-navtabs-data').textContent||'[]'); }catch(e){}
var T=null;        // active tab state object
var TSTATES={};    // id -> state

// Directory = the FULL corpus, classic grouped order (agents -> tools -> flows -> pages ->
// meta -> content -> files). Capability rows are editable through PATCH /api/directory/<key>;
// corpus rows (content/pages/files/meta) are read-only projections whose cells are handles
// to the object at meta.href.
var DIR_FIELDS=['key','type','used','size','category','target','content','includes','auth','allowed_categories','seq','enabled','planner_visible','planner_rank','input_schema','examples','sensitive','runner','created_at','updated_at','href'];
var DIR_EDITABLE={type:1,target:1,category:1,content:1,includes:1,auth:1,allowed_categories:1,seq:1,enabled:1,planner_visible:1,planner_rank:1,input_schema:1,examples:1,sensitive:1,runner:1};
var DIR_W={key:190,type:60,used:56,size:66,category:104,target:240,content:280,includes:110,auth:100,allowed_categories:110,seq:48,enabled:56,planner_visible:76,planner_rank:72,input_schema:150,examples:150,sensitive:62,runner:74,created_at:140,updated_at:140,href:170};
var LED_FIELDS=['ts','source','key','action','direction','status','route','trace_id','step','parent','request_preview','response_preview','request_size','response_size','id'];
var LED_W={ts:150,source:110,key:170,action:110,direction:70,status:56,route:170,trace_id:130,step:50,parent:90,request_preview:320,response_preview:320,request_size:80,response_size:82,id:200};

// One read-only rule for every grid: whole-sheet (ledger/turns/forum), per-row (corpus
// projections), or per-field (non-PATCHable directory columns). Draft rows stay writable.
function cellRo(st,dr,dc){
  if(st.ro===true) return true;
  var m=st.meta[dr];
  if(st.kind==='directory'){
    if(st.drafts[dr]){ var f0=st.fields[dc]; return !(DIR_EDITABLE[f0]||f0==='key'); }
    if(m&&m.ro) return true;
    return !DIR_EDITABLE[st.fields[dc]];
  }
  if(m&&m.ro) return true;
  return false;
}

function newState(tab){
  return {
    kind:tab.kind, id:tab.id, title:tab.title,
    fields:null,           // field names per data column (null => pure letters, user sheets)
    ro:null,               // read-only field map, or true for whole sheet
    meta:[],               // per-row metadata (directory: {key}; ledger: {id})
    vals:[],               // vals[dataRow][dataCol] strings, data order = load order
    nRows:0, nCols:0,      // grid extent (user sheets include blank tail)
    colOrder:[],           // view order -> data col index
    colW:{},               // data col index -> px
    freeze:{rows:0,cols:0},// pinned header bands; persisted in col_meta.freeze
    filters:{},            // data col index -> {cond, needle, values:{} }
    sortBy:null,           // {c:dataCol, dir:1|-1}
    view:[],               // filtered+sorted list of data row indices
    sel:null,              // {r1,c1,r2,c2} in VIEW coordinates
    anchor:null, activeR:0, activeC:0,
    undo:[], redo:[],
    drafts:{},             // directory: dataRow -> true (uncommitted new row)
    sheet:null,            // user sheets: server meta
    runs:[],               // user sheets: saved run configs
    ledParams:{limit:'500'},
    loaded:false, loading:false
  };
}

function saveStatus(s, err){ var el=$('gs-saved'); el.textContent=s; el.className=err?'err':''; }

/* ═══════════════════ data adapters ═══════════════════ */
function loadTab(st, force){
  if(st.loading) return Promise.resolve();
  if(st.loaded && !force) return Promise.resolve();
  st.loading=true; saveStatus('Loading…');
  if(st===T && !st.loaded){ var ld=$('gs-loading'); if(ld){ ld.textContent='Loading '+st.title+'…'; ld.style.display='block'; } }
  if(st.kind==='directory'){
    return cacheFirstAll(st, ['/admin/directory?data=directory','/api/directory'], function(rr){
      var feed=((rr[0])||{}).rows||[];
      var api={}; (((rr[1])||{}).rows||[]).forEach(function(r){ api[r.key]=r; });
      var CAP={agent:1,fn:1,http:1,flow:1};
      st.fields=DIR_FIELDS.slice(); st.ro=null;
      st.meta=[]; st.vals=[];
      feed.forEach(function(r){
        var a=api[r.key];
        var cap=!!(a&&CAP[r.type]);
        var kind = r.type==='agent'?'agent' : (r.type==='fn'||r.type==='http')?'tool' : r.type==='flow'?'flow'
          : r.type==='content'?'content' : r.type==='page'?'page' : r.type==='file'?'file' : 'other';
        st.meta.push({ key:r.key, cap:cap, ro:!cap, kind:kind,
          href: r.href || (cap ? '/admin/directory/'+encodeURIComponent(r.key)+'?view=classic' : (r.target&&String(r.target).charAt(0)==='/'?r.target:'')) });
        var size = r.size!=null && r.size!=='' ? r.size : (a&&a.content ? String(a.content).length : '');
        var row={ key:r.key, type:r.type, used:(r.used!=null?r.used:''), size:size, category:r.category||'',
          target:r.target||'', created_at:r.created_at||'', updated_at:r.updated_at||(a?a.updated_at||'':''), href:r.href||'' };
        if(a){ ['content','includes','auth','allowed_categories','seq','enabled','planner_visible','planner_rank','input_schema','examples','sensitive','runner'].forEach(function(f){ row[f]=a[f]==null?'':String(a[f]); }); }
        st.vals.push(DIR_FIELDS.map(function(f){ return row[f]==null?'':String(row[f]); }));
      });
      st.nRows=st.vals.length; st.nCols=DIR_FIELDS.length;
      if(st.colOrder.length!==st.nCols){ st.colOrder=DIR_FIELDS.map(function(_,i){ return i; }); st.colW={}; }
      if(!Object.keys(st.colW).length) DIR_FIELDS.forEach(function(f,i){ st.colW[i]=DIR_W[f]||DEFAULT_W; });
      restoreViewPrefs(st,'dir2');
      finishLoad(st);
    });
  }
  if(st.kind==='turns'){
    // The unified cards lane is the real turn stream (CLI sessions, router turns, state
    // cards) — the GAS-facing ?turns=1 lane is often empty on recent data.
    return cacheFirstAll(st, ['/admin/ledger?cards=1&limit=200'], function(rr){
      var cards=((rr[0])||{}).cards||[];
      var F=['ts','source','category','actor','input','output','routed','tools_used','n_events','trace_id','hash','kind'];
      st.fields=F.slice(); st.ro=true;
      st.meta=cards.map(function(t){ return {id:t.card_id||t.trace_id||'', ro:true, href:t.trace_id?'/admin/ledger?data=1&trace_id='+encodeURIComponent(t.trace_id):''}; });
      st.vals=cards.map(function(t){ return F.map(function(f){ var v=t[f]; if(v==null) return ''; return typeof v==='object'?JSON.stringify(v):String(v); }); });
      st.nRows=st.vals.length; st.nCols=F.length;
      if(st.colOrder.length!==st.nCols) st.colOrder=F.map(function(_,i){ return i; });
      if(!Object.keys(st.colW).length){ var W={ts:150,source:110,category:104,actor:96,input:320,output:320,routed:100,tools_used:180,n_events:64,trace_id:132,hash:96,kind:110}; F.forEach(function(f,i){ st.colW[i]=W[f]||DEFAULT_W; }); }
      finishLoad(st);
    });
  }
  if(st.kind==='forum'){
    return cacheFirstAll(st, ['/admin/ledger?forum=1&data=1'], function(rr){
      var posts=((rr[0])||{}).posts||[];
      var pref=['ts','agent','source','title','text','summary','evidence','tags','audit_verdict','audit_note','turn_key'];
      var keys={}; posts.slice(0,80).forEach(function(p){ Object.keys(p).forEach(function(k){ keys[k]=1; }); });
      var F=pref.filter(function(k){ return keys[k]; }).concat(Object.keys(keys).filter(function(k){ return pref.indexOf(k)<0; }).sort());
      if(!F.length) F=['ts'];
      st.fields=F.slice(); st.ro=true;
      st.meta=posts.map(function(p){ return {id:p.turn_key||'', ro:true, href:''}; });
      st.vals=posts.map(function(p){ return F.map(function(f){ var v=p[f]; if(v==null) return ''; return typeof v==='object'?JSON.stringify(v):String(v); }); });
      st.nRows=st.vals.length; st.nCols=F.length;
      if(st.colOrder.length!==st.nCols) st.colOrder=F.map(function(_,i){ return i; });
      if(!Object.keys(st.colW).length) F.forEach(function(f,i){ st.colW[i]=/text|summary|message/.test(f)?320:120; });
      finishLoad(st);
    });
  }
  if(st.kind==='ledger'){
    var p=st.ledParams, qs=['data=1'];
    ['limit','key','trace_id','q','status','source'].forEach(function(k){ if(p[k]) qs.push(k+'='+encodeURIComponent(p[k])); });
    return cacheFirstAll(st, ['/admin/ledger?'+qs.join('&')], function(rr){
      var rows=(rr[0]&&rr[0].rows)||[];
      st.fields=LED_FIELDS.slice(); st.ro=true;
      st._noMore=false; st._loadingMore=false;
      st.meta=rows.map(function(r){ return {id:r.id, ro:true, href:'/admin/ledger/'+encodeURIComponent(r.id)+'?data=1'}; });
      st.vals=rows.map(function(r){ return LED_FIELDS.map(function(f){ var v=r[f]; return v==null?'':String(v); }); });
      st.nRows=st.vals.length; st.nCols=LED_FIELDS.length;
      if(!st.colOrder.length) st.colOrder=LED_FIELDS.map(function(_,i){ return i; });
      if(!Object.keys(st.colW).length) LED_FIELDS.forEach(function(f,i){ st.colW[i]=LED_W[f]||DEFAULT_W; });
      restoreViewPrefs(st,'led');
      finishLoad(st);
    });
  }
  // user sheet
  return jfetch('/api/sheets/'+encodeURIComponent(st.id)).then(function(res){
    // 'Sheet not found' was wrong for the commonest case by far: the sheet is there and the
    // session is not. Name that, and stop before drawing an empty grid over it.
    if(noteAuthFailure(res)){ st.loading=false; return; }
    if(!res.ok){ toast('Sheet not found'); st.loading=false; return; }
    st.sheet=res.j.sheet; st.runs=res.j.runs||[];
    st.title=st.sheet.title;
    var rows=Math.max(st.sheet.used_rows||0, 1);
    var cols=Math.max(st.sheet.used_cols||0, 1);
    // Load a window, not the sheet. Asking for the whole used range was one request for
    // rows x cols cells: at 50,000 rows that is ~900,000 cells in a single fetch, which is
    // unusable long before it is reached. The first screen arrives immediately and the rest
    // pages in as the grid scrolls (ensureRows below). Reads are local to the sheet's durable
    // object now, so a window costs a local query rather than a round trip.
    st.winEnd=Math.min(rows, WINDOW);
    st.usedRows=rows;
    var lastCol=colLetter(Math.max(cols, st.sheet.cols||26));
    return jfetch('/api/sheets/'+encodeURIComponent(st.id)+'/values/A1:'+lastCol+st.winEnd).then(function(vres){
      var values=(vres.j&&vres.j.values)||[];
      st.fields=null; st.ro=null;
      st.nRows=Math.max(st.sheet.rows||1000, rows);
      st.nCols=Math.max(st.sheet.cols||26, cols);
      st.vals=values;
      st.meta=[];
      st.colOrder=[]; for(var i=0;i<st.nCols;i++) st.colOrder.push(i);
      var meta=st.sheet.col_meta||{};
      st.colW={}; for(var j=0;j<st.nCols;j++) st.colW[j]=(meta.widths&&meta.widths[j])||DEFAULT_W;
      if(meta.freeze) st.freeze={rows:meta.freeze.rows|0, cols:meta.freeze.cols|0};
      finishLoad(st);
    });
  });
}
// How many rows the grid holds before it pages. Two screens' worth: the first paint is
// instant and scrolling stays ahead of the reader.
var WINDOW=400;

// Pull the next block when the viewport approaches the end of what is loaded. Idempotent and
// self-limiting: one request in flight, and it stops at the sheet's used extent.
function ensureRows(st, throughRow){
  if(!st || st.kind!=='user' || st._paging) return;
  if(st.winEnd==null || st.usedRows==null) return;
  if(throughRow < st.winEnd - 50) return;
  if(st.winEnd >= st.usedRows) return;
  st._paging=true;
  var from=st.winEnd+1, to=Math.min(st.usedRows, st.winEnd+WINDOW);
  var lastCol=colLetter(st.nCols);
  jfetch('/api/sheets/'+encodeURIComponent(st.id)+'/values/A'+from+':'+lastCol+to).then(function(r){
    var got=(r.j&&r.j.values)||[];
    for(var i=0;i<got.length;i++) st.vals[from-1+i]=got[i];
    st.winEnd=to; st._paging=false;
    if(T===st){ rebuildView(st); renderAll(); }
  }).catch(function(){ st._paging=false; });
}

function finishLoad(st){
  st.loading=false; st.loaded=true;
  rebuildView(st);
  if(st===T){ var ld=$('gs-loading'); if(ld) ld.style.display='none'; clampSel(); renderAll(); saveStatus('All changes saved'); }
  if(st.kind==='user') liveConnect(st);
}

// ── live ──────────────────────────────────────────────────────────────────────────────────
// Each user sheet is one durable object, and that object pushes every cell it writes. So a
// row an agent is filling appears here as it happens, and a cell someone changes in another
// tab lands without a refresh. The socket is a convenience, never a dependency: if it will not
// open, the grid behaves exactly as it did before.
var LIVE = { ws:null, tab:null, retry:0 };

function liveDisconnect(){
  if(LIVE.ws){ try{ LIVE.ws.close(); }catch(e){} }
  LIVE.ws=null; LIVE.tab=null;
}

function liveConnect(st){
  if(!st || st.kind!=='user' || !st.id) return;
  if(LIVE.tab===st.id && LIVE.ws && LIVE.ws.readyState<=1) return;
  liveDisconnect();
  var url=(location.protocol==='https:'?'wss://':'ws://')+location.host+'/api/sheets/'+st.id+'/live';
  var ws;
  try{ ws=new WebSocket(url); }catch(e){ return; }
  LIVE.ws=ws; LIVE.tab=st.id;

  ws.onopen=function(){ LIVE.retry=0; };
  ws.onmessage=function(ev){
    var msg; try{ msg=JSON.parse(ev.data); }catch(e){ return; }
    if(msg.type==='reset'){ st.loaded=false; loadTab(st,true); return; }
    if(msg.type!=='cells'||!msg.cells) return;
    // Never clobber the cell the person has open in the editor right now.
    var ed=$('gs-editor');
    var editing=!!(ed && ed.style.display==='block' && T===st);
    var edR=editing&&T.view?T.view[T.activeR]:-1;
    var edC=editing&&T.colOrder?T.colOrder[T.activeC]:-1;
    var touched=false;
    for(var i=0;i<msg.cells.length;i++){
      var c=msg.cells[i], dr=c.r-1, dc=c.c-1;
      if(dr<0||dc<0) continue;
      if(editing && dr===edR && dc===edC) continue;
      setLocal(st,dr,dc,c.preview==null?'':c.preview);
      if(dr+1>st.nRows) st.nRows=dr+1;
      touched=true;
    }
    if(touched && T===st){ rebuildView(st); renderAll(); }
  };
  ws.onclose=function(){
    if(LIVE.tab!==st.id) return;
    // Back off, then try again — an object that hibernated will accept a fresh socket.
    LIVE.retry=Math.min(LIVE.retry+1,6);
    setTimeout(function(){ if(T===st) liveConnect(st); }, 1000*Math.pow(2,LIVE.retry));
  };
  ws.onerror=function(){ /* onclose handles it */ };
}
function cellVal(st,dr,dc){ var row=st.vals[dr]; return row? (row[dc]==null?'':String(row[dc])) : ''; }

// The ledger scrolls forever: near the bottom, page in rows strictly
// older than the oldest loaded ts and append them. Filters and sorts stay client-side on top.
function loadMoreLedger(){
  if(!T||T.kind!=='ledger'||T._noMore||T._loadingMore||!T.loaded||!T.vals.length) return;
  var tsIdx=0; // LED_FIELDS[0] === 'ts'
  var oldest=cellVal(T,T.nRows-1,tsIdx);
  if(!oldest) return;
  T._loadingMore=true;
  var p=T.ledParams, qs=['data=1','before='+encodeURIComponent(oldest)];
  ['limit','key','trace_id','q','status','source'].forEach(function(k){ if(p[k]) qs.push(k+'='+encodeURIComponent(p[k])); });
  jfetch('/admin/ledger?'+qs.join('&')).then(function(res){
    var rows=((res.j)||{}).rows||[];
    T._loadingMore=false;
    if(!rows.length){ T._noMore=true; return; }
    rows.forEach(function(r){
      T.meta.push({id:r.id, ro:true, href:'/admin/ledger/'+encodeURIComponent(r.id)+'?data=1'});
      T.vals.push(LED_FIELDS.map(function(f){ var v=r[f]; return v==null?'':String(v); }));
    });
    T.nRows=T.vals.length;
    rebuildView(T); renderRows(); renderColHeads(); renderSel(); renderStats();
  }).catch(function(){ T._loadingMore=false; });
}
function setLocal(st,dr,dc,v){ if(!st.vals[dr]) st.vals[dr]=[]; st.vals[dr][dc]=v; }

/* view prefs: column order + widths for directory/ledger persist per browser */
function persistViewPrefs(st,tag){ try{ localStorage.setItem('gs_prefs_'+tag, JSON.stringify({order:st.colOrder,w:st.colW})); }catch(e){} }
function restoreViewPrefs(st,tag){ try{ var p=JSON.parse(localStorage.getItem('gs_prefs_'+tag)||'null');
  if(p&&p.order&&p.order.length===st.nCols) st.colOrder=p.order;
  if(p&&p.w) Object.keys(p.w).forEach(function(k){ st.colW[k]=p.w[k]; }); }catch(e){} }

/* ═══════════════════ commits (per kind) ═══════════════════ */
// One cell edit committed to the backing store. onDone(ok, errMsg).
function commitCell(st, dr, dc, val, onDone){
  if(st.kind==='ledger'){ onDone(false,'The ledger is append-only — cells here are read-only.'); return; }
  if(st.kind==='turns'||st.kind==='forum'){ onDone(false,'This sheet is a read-only projection of the ledger.'); return; }
  if(st.kind==='directory'){
    var field=st.fields[dc];
    if(st.drafts[dr]){ setLocal(st,dr,dc,val); maybeCommitDraft(st,dr,onDone); return; }
    if(st.meta[dr]&&st.meta[dr].ro){ onDone(false,'This row is a projection ('+(st.meta[dr].kind||'corpus')+') — open it at its own address: '+(st.meta[dr].href||'')); return; }
    if(!DIR_EDITABLE[field]){ onDone(false, field==='key' ? 'key is the primary key — insert a new row instead' : field+' is computed here, not stored on the row'); return; }
    var key=st.meta[dr].key, body={}; body[field]=val;
    saveStatus('Saving…');
    jfetch('/api/directory/'+encodeURIComponent(key),{method:'PATCH',body:body}).then(function(res){
      if(res.ok&&res.j.ok){ setLocal(st,dr,dc,val); saveStatus('All changes saved'); onDone(true); }
      else { saveStatus('Save failed',true); onDone(false,(res.j&&(res.j.how_to_fix||res.j.error))||('HTTP '+res.status)); }
    });
    return;
  }
  // user sheet: local set + queue flush
  setLocal(st,dr,dc,val);
  queueUserFlush(st, dr, dc);
  onDone(true);
}
function maybeCommitDraft(st, dr, onDone){
  var iKey=st.fields.indexOf('key'), iType=st.fields.indexOf('type');
  var key=cellVal(st,dr,iKey).trim(), type=cellVal(st,dr,iType).trim();
  if(!key||!type){ onDone(true); renderAll(); return; } // still drafting
  var body={};
  st.fields.forEach(function(f,i){ if(DIR_EDITABLE[f]||f==='key'){ var v=cellVal(st,dr,i); if(v!=='') body[f]=v; } });
  saveStatus('Saving…');
  jfetch('/api/directory',{method:'POST',body:body}).then(function(res){
    if(res.ok&&res.j.ok){ delete st.drafts[dr]; st.meta[dr]={key:key, cap:true, kind:(body.type==='agent'?'agent':(body.type==='flow'?'flow':'tool')), href:'/admin/directory/'+encodeURIComponent(key)+'?view=classic'}; saveStatus('All changes saved'); toast('Row created: '+key); onDone(true); renderAll(); }
    else { saveStatus('Create refused',true); onDone(false,(res.j&&(res.j.how_to_fix||res.j.error))||('HTTP '+res.status)); }
  });
}

// user-sheet write queue: dirty cells flushed as one bounding-box PUT (local vals are truth)
var flushTimer=null;
function queueUserFlush(st, dr, dc){
  st._dirty=st._dirty||{minR:dr,maxR:dr,minC:dc,maxC:dc,n:0};
  var d=st._dirty;
  d.minR=Math.min(d.minR,dr); d.maxR=Math.max(d.maxR,dr);
  d.minC=Math.min(d.minC,dc); d.maxC=Math.max(d.maxC,dc); d.n++;
  saveStatus('Saving…');
  clearTimeout(flushTimer);
  flushTimer=setTimeout(function(){ flushUser(st); }, 450);
}
function flushUser(st){
  var d=st._dirty; if(!d) return; st._dirty=null;
  var values=[];
  for(var r=d.minR;r<=d.maxR;r++){ var row=[];
    for(var c=d.minC;c<=d.maxC;c++) row.push(cellVal(st,r,c));
    values.push(row); }
  var anchor=colLetter(d.minC+1)+(d.minR+1);
  jfetch('/api/sheets/'+encodeURIComponent(st.id)+'/values/'+anchor,{method:'PUT',body:{values:values}}).then(function(res){
    if(res.ok&&res.j.ok){ saveStatus('All changes saved'); }
    else { saveStatus('Save failed',true); toast('Write refused: '+((res.j&&res.j.error)||res.status)); }
  });
}

/* ═══════════════════ view (filter + sort) ═══════════════════ */
function matchKindTab(kind, tab){
  if(!tab) return true;
  if(tab==='tool') return kind==='tool'||kind==='flow';
  if(tab==='code') return kind==='tool'||kind==='flow';
  if(tab==='other') return ['agent','tool','flow','content','page','file'].indexOf(kind)<0;
  return kind===tab;
}

/* ═══════ every view state is a link ═══════
   Kind tab, filters, sort and the active cell serialize into the URL; a pasted link
   restores the exact view; every populated cell is addressable as ?id=<object>&field=<col>. */
var URLSYNC={last:'',suppress:true};
function fieldName(st,dc){ return st.fields?st.fields[dc]:colLetter(dc+1); }
function fieldIndex(st,name){ if(!name) return -1; if(st.fields){ var i=st.fields.indexOf(name); if(i>=0) return i; }
  var c=letterCol(name); return c?c-1:-1; }
function stateUrl(){
  if(!T) return null;
  var base = T.kind==='directory' ? '/admin/directory' : T.kind==='ledger' ? '/admin/ledger' : '/admin/sheets';
  var p=new URLSearchParams();
  if(TOKQ){ var tq=TOKQ.split('='); p.set(tq[0], decodeURIComponent(tq.slice(1).join('='))); }
  if(base==='/admin/sheets') p.set('tab', T.id);
  if(T.kind==='directory'&&T.kindFilter) p.set('kind', T.kindFilter);
  if(T.sortBy) p.set('sort', fieldName(T,T.sortBy.c)+':'+(T.sortBy.dir===1?'asc':'desc'));
  Object.keys(T.filters||{}).forEach(function(k){ var r=T.filters[k]; if(!r) return; var f=fieldName(T,Number(k));
    if(r.cond) p.set('f.'+f, r.cond+':'+(r.needle==null?'':r.needle));
    if(r.values){ var on=[],off=[]; Object.keys(r.values).forEach(function(v){ (r.values[v]?on:off).push(v); });
      var pick = off.length<=on.length ? {m:'out',v:off} : {m:'in',v:on};
      if(pick.v.length&&pick.v.length<=20) p.set('v.'+f, pick.m+':'+pick.v.join('~~')); }
  });
  if(T.sel&&T.view.length){
    var dr=T.view[clamp(T.activeR,0,T.view.length-1)], m=T.meta[dr];
    var fld=fieldName(T,T.colOrder[clamp(T.activeC,0,T.colOrder.length-1)]);
    var oid=m&&(m.key||m.id);
    if(oid){ p.set('id',String(oid)); p.set('field',fld); }
    else if(T.kind!=='directory') p.set('cell', colLetter(T.activeC+1)+(dr+1));
  }
  var q=p.toString();
  return base+(q?'?'+q:'');
}
function syncUrl(push){
  if(URLSYNC.suppress) return;
  var u=stateUrl(); if(!u||u===URLSYNC.last) return;
  URLSYNC.last=u;
  try{ history[push?'pushState':'replaceState']({gs:1},'',u); }catch(e){}
}
function applyUrlState(){
  if(!T||!T.loaded) return;
  var p=new URLSearchParams(location.search);
  var changed=false;
  if(T.kind==='directory'){ var k=p.get('kind'); if(k!=null&&k!==(T.kindFilter||'')){ T.kindFilter=k; changed=true; } }
  var srt=p.get('sort');
  if(srt){ var si=srt.lastIndexOf(':'); var sc=fieldIndex(T,si<0?srt:srt.slice(0,si));
    if(sc>=0){ T.sortBy={c:sc,dir:srt.slice(si+1)==='asc'?1:-1}; changed=true; } }
  p.forEach(function(val,key){
    if(key.indexOf('f.')===0){ var c=fieldIndex(T,key.slice(2)); if(c<0) return;
      var i=val.indexOf(':'); var cond=i<0?val:val.slice(0,i), needle=i<0?'':val.slice(i+1);
      var rule=T.filters[c]||{}; rule.cond=cond; rule.needle=needle; T.filters[c]=rule; changed=true; }
    if(key.indexOf('v.')===0){ var c2=fieldIndex(T,key.slice(2)); if(c2<0) return;
      var j=val.indexOf(':'); if(j<0) return; var mode=val.slice(0,j), list=val.slice(j+1).split('~~');
      var values={}; for(var r=0;r<T.nRows;r++){ var cv=cellVal(T,r,c2);
        values[cv] = mode==='in' ? list.indexOf(cv)>=0 : list.indexOf(cv)<0; }
      var rule2=T.filters[c2]||{}; rule2.values=values; T.filters[c2]=rule2; changed=true; }
  });
  if(changed) rebuildView(T);
  clampSel(); renderAll();
  var oid=p.get('id'), fld=p.get('field'), cellRef=p.get('cell');
  var tDr=-1, tDc=-1;
  if(oid){ for(var r2=0;r2<T.meta.length;r2++){ var m=T.meta[r2]; if(m&&(String(m.key)===oid||String(m.id)===oid)){ tDr=r2; break; } }
    var fc=fieldIndex(T,fld); if(fc>=0) tDc=fc; }
  else if(cellRef){ var mm=String(cellRef).toUpperCase().match(/^([A-Z]+)(\\d+)$/);
    if(mm){ tDc=letterCol(mm[1])-1; tDr=Number(mm[2])-1; } }
  if(tDr>=0){ var v=T.view.indexOf(tDr);
    if(v>=0){ var vi=tDc>=0?T.colOrder.indexOf(tDc):0; setActive(v, vi<0?0:vi, false); } }
}
// workbook kind tab -> classic bigtab, so the toggle lands on the same slice of objects
var KIND2CLASSIC={agent:'agent',content:'content',tool:'code',flow:'code',code:'code',page:'other',file:'files',other:'other'};

/* ═══════ cached grids: instant paint, background refresh ═══════ */
var GS_CACHE='gs-grid-cache-v1';
function ck(url){ return TOKQ && url.charAt(0)==='/' ? url+(url.indexOf('?')>=0?'&':'?')+TOKQ : url; }
function cacheGet(url){ if(!window.caches) return Promise.resolve(null);
  return caches.open(GS_CACHE).then(function(c){ return c.match(url); })
    .then(function(r){ return r?r.json():null; }).catch(function(){ return null; }); }
function cachePut(url,j){ if(!window.caches||j==null) return;
  try{ caches.open(GS_CACHE).then(function(c){ return c.put(url, new Response(JSON.stringify(j),{headers:{'content-type':'application/json'}})); }).catch(function(){}); }catch(e){} }
function preserveSel(st,fn){
  var keep=null;
  if(st===T&&st.sel&&st.view.length){ var dr=st.view[clamp(st.activeR,0,st.view.length-1)]; var m=st.meta[dr];
    keep={oid:m&&(m.key||m.id), dc:st.colOrder[clamp(st.activeC,0,st.colOrder.length-1)], top:scrollEl?scrollEl.scrollTop:0}; }
  fn();
  if(keep&&keep.oid&&st===T){
    for(var r=0;r<st.meta.length;r++){ var m2=st.meta[r]; if(m2&&(m2.key===keep.oid||m2.id===keep.oid)){
      var v=st.view.indexOf(r); if(v>=0) setActiveSilently(v, Math.max(0,st.colOrder.indexOf(keep.dc))); break; } }
    if(scrollEl) scrollEl.scrollTop=keep.top;
    renderAll();
  }
}
// Cache-first load: last good copy paints the grid instantly, the live fetch replaces it
// in place. The loading overlay only ever shows on a cold first visit.
function cacheFirstAll(st, urls, build){
  var keys=urls.map(ck);
  var hadData=st.loaded, usedCache=false;
  return Promise.all(keys.map(cacheGet)).then(function(cc){
    if(!st.loaded && cc.length && cc.every(function(x){ return x; })){
      usedCache=true; build(cc);
      st.loading=true; // still fetching fresh underneath
      if(st===T){ saveStatus('Refreshing…'); var ld=$('gs-loading'); if(ld) ld.style.display='none'; }
    }
    return Promise.all(urls.map(function(u){ return jfetch(u); })).then(function(rr){
      rr.forEach(function(r,i){ if(r&&r.ok&&r.j) cachePut(keys[i], r.j); });
      var js=rr.map(function(r){ return r&&r.j; });
      // A failed refresh never blanks a grid: keep what is on screen (cache or old data)
      // and say so; a cold failure leaves the tab retryable via ⟳.
      if(!rr.every(function(r){ return r&&r.ok; })){
        st.loading=false;
        var why=(rr.filter(function(r){ return r&&!r.ok; })[0]||{}).j; why=(why&&why.error)||'feed failed';
        if(usedCache||hadData){ if(st===T) saveStatus('Refresh failed — showing last copy ('+why+')', true); }
        else { if(st===T){ saveStatus('Load failed — press ⟳ to retry', true); var ld3=$('gs-loading'); if(ld3) ld3.textContent='Load failed ('+why+') — press ⟳ to retry'; } }
        return;
      }
      if(usedCache||hadData) preserveSel(st, function(){ build(js); });
      else build(js);
    });
  });
}
function rebuildView(st){
  var idx=[]; var f=st.filters||{};
  var activeF=Object.keys(f).filter(function(k){ return f[k]; });
  for(var r=0;r<st.nRows;r++){
    var okRow=true;
    if(st.kindFilter&&st.kind==='directory'){ var km=st.meta[r]; if(!st.drafts[r]&&!matchKindTab(km?km.kind:'',st.kindFilter)) continue; }
    for(var i=0;i<activeF.length&&okRow;i++){
      var c=Number(activeF[i]), rule=f[c], v=cellVal(st,r,c);
      if(rule.values && !rule.values[v==null?'':v]) okRow=false;
      if(okRow&&rule.cond&&rule.needle!=null&&rule.needle!==''){
        var hay=String(v).toLowerCase(), nd=String(rule.needle).toLowerCase();
        if(rule.cond==='contains'&&hay.indexOf(nd)<0) okRow=false;
        if(rule.cond==='not_contains'&&hay.indexOf(nd)>=0) okRow=false;
        if(rule.cond==='eq'&&hay!==nd) okRow=false;
        if(rule.cond==='neq'&&hay===nd) okRow=false;
        if(rule.cond==='gt'&&!(Number(v)>Number(rule.needle))) okRow=false;
        if(rule.cond==='lt'&&!(Number(v)<Number(rule.needle))) okRow=false;
        if(rule.cond==='empty'&&v!=='') okRow=false;
        if(rule.cond==='not_empty'&&v==='') okRow=false;
      }
    }
    if(okRow) idx.push(r);
  }
  if(st.sortBy){
    var sc=st.sortBy.c, dir=st.sortBy.dir;
    idx.sort(function(a,b){
      var va=cellVal(st,a,sc), vb=cellVal(st,b,sc);
      var na=isNum(va), nb=isNum(vb);
      if(na&&nb) return (Number(va)-Number(vb))*dir;
      if(va===vb) return a-b;
      return (va<vb?-1:1)*dir;
    });
  }
  st.view=idx;
}
function hasActiveFilter(st){ for(var k in st.filters){ if(st.filters[k]) return true; } return !!st.sortBy; }

/* ═══════════════════ grid geometry + render ═══════════════════ */
var scrollEl, canvasEl, rowheadsInner, colheadsInner;
function viewCols(){ return T.colOrder; }
function colX(vi){ var x=0; for(var i=0;i<vi;i++) x+=T.colW[T.colOrder[i]]||DEFAULT_W; return x; }
// The pinned bands, in pixels. Clamped every time they are read: a sheet can lose rows or
// columns after a freeze was saved, and a band wider than the grid would pin everything.
function fzRows(){ return clamp((T.freeze&&T.freeze.rows)|0, 0, Math.max(0, Math.min(T.view.length-1, 20))); }
function fzCols(){ return clamp((T.freeze&&T.freeze.cols)|0, 0, Math.max(0, Math.min(T.colOrder.length-1, 20))); }
function fzH(){ return fzRows()*ROW_H; }
function fzW(){ return colX(fzCols()); }
function totalW(){ return colX(T.colOrder.length); }
function totalH(){ return T.view.length*ROW_H + (T.kind==='user'?120:40); }
function colAtX(x){ var acc=0; for(var i=0;i<T.colOrder.length;i++){ acc+=T.colW[T.colOrder[i]]||DEFAULT_W; if(x<acc) return i; } return T.colOrder.length-1; }

// Where the two grips sit, and the shadow that tells you a band is pinned. Called from every
// render and every scroll, because the grip tracks the band and the band tracks the scroll.
function renderFreeze(){
  var gh=$('gs-fzgrip-h'), gv=$('gs-fzgrip-v');
  if(!gh||!gv) return;
  var FH=fzH(), FW=fzW();
  gh.style.top=(FH-4)+'px';
  gh.style.width=(scrollEl.clientWidth+ROWHEAD_W)+'px';
  gv.style.left=(ROWHEAD_W+FW-4)+'px';
  gv.style.height=(scrollEl.clientHeight)+'px';
  var sh=$('gs-fzshadow-h'), sv=$('gs-fzshadow-v');
  if(sh){ sh.style.top=FH+'px'; sh.style.display=FH>0?'block':'none'; }
  if(sv){ sv.style.left=(ROWHEAD_W+FW)+'px'; sv.style.display=FW>0?'block':'none'; }
}
function saveFreeze(){
  try{ localStorage.setItem('gs_freeze_'+(T.id||T.kind), JSON.stringify(T.freeze)); }catch(e){}
  // A user sheet carries its own freeze so it is the same for anyone who opens it; the
  // directory and ledger projections are per-browser, like their column widths already are.
  if(T.kind==='user'&&T.id){
    var meta=(T.sheet&&T.sheet.col_meta)||{};
    meta.freeze={rows:T.freeze.rows|0, cols:T.freeze.cols|0};
    if(T.sheet) T.sheet.col_meta=meta;
    jfetch('/api/sheets/'+encodeURIComponent(T.id),{method:'PATCH',body:{col_meta:meta}});
  }
}
function renderAll(){ renderColHeads(); renderRows(); renderSel(); renderTabs(); renderStats(); syncTitle(); renderKindTabs(); renderFreeze(); }
function syncTitle(){
  var t=$('gs-title');
  t.textContent=T.title;
  t.contentEditable = T.kind==='user' ? 'true' : 'false';
  // Sheet ⇄ Classic, top right: two views of the same objects, each a working link.
  // The classic href carries the active kind tab so the toggle lands on the same slice.
  var vt=$('gs-viewtoggle'), cls=$('gs-classic');
  var classicHref = T.kind==='directory' ? '/admin/directory?view=classic'+(T.kindFilter&&KIND2CLASSIC[T.kindFilter]?'&tab='+KIND2CLASSIC[T.kindFilter]:'')
    : T.kind==='ledger' ? '/admin/ledger?view=classic'
    : T.kind==='turns' ? '/admin/ledger?view=turns'
    : T.kind==='forum' ? '/admin/ledger?forum=1' : '';
  if(classicHref){
    vt.style.display='inline-flex';
    cls.href=TOKQ?classicHref+(classicHref.indexOf('?')>=0?'&':'?')+TOKQ:classicHref;
    var self=stateUrl(); $('gs-vt-sheet').href=self||location.pathname;
  }
  else vt.style.display='none';
  document.title=T.title+' — Sheets — miscsubjects.com';
}
function renderColHeads(){
  var html='', off=-scrollEl.scrollLeft;
  for(var vi=0; vi<T.colOrder.length; vi++){
    var dc=T.colOrder[vi], w=T.colW[dc]||DEFAULT_W;
    var selCol = T.sel && T.sel.c1<=vi && vi<=T.sel.c2;
    var fOn = T.filters[dc] || (T.sortBy&&T.sortBy.c===dc);
    var pinned = vi<fzCols();
    html+='<div class="gs-colhead'+(selCol?' sel':'')+(pinned?' fz':'')+'" data-vi="'+vi+'" style="width:'+w+'px;height:'+HEAD_H+'px'+(pinned?';transform:translateX('+scrollEl.scrollLeft+'px)':'')+'">'
      +'<span class="cl">'+colLetter(vi+1)+'</span>'
      +(T.fields?'<span class="cf" title="'+esc(T.fields[dc])+'">'+esc(T.fields[dc])+'</span>':'')
      +'<span class="funnel'+(fOn?' on':'')+'" data-vi="'+vi+'" title="Filter / sort">▼</span>'
      +'<span class="gs-grip" data-vi="'+vi+'"></span>'
      +'</div>';
  }
  colheadsInner.innerHTML=html;
  colheadsInner.style.transform='translateX('+off+'px)';
  colheadsInner.style.width=totalW()+'px';
}
var overscan=8;
// What counts as a picture: an http(s) address ending in an image extension, or one of the
// build's own R2 asset paths, which carry no extension.
//
// Deliberately written with NO backslashes. This whole script is carried inside a template
// literal, so a single-backslash regex loses its escapes on the way out: the served line became
// /^https?://[^s]+... where the // opened a comment, the regex never closed, and that one
// SyntaxError killed every line of the grid — no column letters, no rows, no tabs. String
// comparisons cannot be mangled by the literal that carries them.
var IMG_EXTS=['.png','.jpg','.jpeg','.gif','.webp','.avif','.svg'];
var IMG_DIRS=['/img/','/images/','/image/','/assets/','/asset/'];
function isImgUrl(v){
  if(!v) return false;
  var s=String(v);
  if(s.length>2000 || s.indexOf('http')!==0 || s.indexOf(' ')>=0 || s.indexOf(String.fromCharCode(10))>=0) return false;
  var q=s.indexOf('?');
  var base=(q<0?s:s.slice(0,q)).toLowerCase();
  for(var i=0;i<IMG_EXTS.length;i++){
    var e=IMG_EXTS[i];
    if(base.length>e.length && base.slice(-e.length)===e) return true;
  }
  for(var j=0;j<IMG_DIRS.length;j++){ if(base.indexOf(IMG_DIRS[j])>=0) return true; }
  return false;
}
function renderRows(){
  canvasEl.style.width=totalW()+'px';
  canvasEl.style.height=totalH()+'px';
  var stTop=scrollEl.scrollTop, stLeft=scrollEl.scrollLeft;
  var FR=fzRows(), FC=fzCols(), FH=fzH(), FW=fzW();
  // The frozen band covers the top of the viewport, so the first scrolling row worth painting
  // is the one below it — and the band's own rows are painted separately, always, however far
  // down the sheet is scrolled.
  var first=clamp(Math.floor((stTop+FH)/ROW_H)-overscan,FR,Math.max(FR,T.view.length-1));
  var last=clamp(Math.ceil((stTop+scrollEl.clientHeight)/ROW_H)+overscan,0,T.view.length);
  var order=[];
  for(var fv=0; fv<FR && fv<T.view.length; fv++) order.push(fv);
  for(var sv=first; sv<last; sv++) if(sv>=FR) order.push(sv);
  // cells
  var frag='', rh='';
  for(var oi=0; oi<order.length; oi++){
    var v=order[oi];
    var rowPinned = v<FR;
    var dr=T.view[v], y=rowPinned ? stTop+v*ROW_H : v*ROW_H;
    var isDraft=T.kind==='directory'&&T.drafts[dr];
    rh+='<div class="gs-rowhead'+((T.sel&&T.sel.r1<=v&&v<=T.sel.r2)?' sel':'')+(isDraft?' draft':'')+(rowPinned?' fz':'')+'" data-v="'+v+'" style="top:'+y+'px;height:'+ROW_H+'px">'+(isDraft?'✎':(dr+1))+'</div>';
    var x=0;
    for(var vi=0; vi<T.colOrder.length; vi++){
      var dc=T.colOrder[vi], w=T.colW[dc]||DEFAULT_W;
      var val=cellVal(T,dr,dc);
      var ro = cellRo(T,dr,dc);
      var isImg = isImgUrl(val);
      var cls='gs-cell'+(ro?' ro':'')+(isNum(val)?' num':'')+(isImg?' img':'');
      if(FIND.q && val && val.toLowerCase().indexOf(FIND.q)>=0) cls+=' hl';
      // Google Sheets overflow: text longer than its column spills over the empty cells to
      // its right instead of clipping (clicks still land on the cell under the pointer —
      // hit-testing is geometric).
      var spanW=w;
      if(val && !isNum(val) && val.length*7.2 > w-6){
        for(var nvi=vi+1; nvi<T.colOrder.length && nvi<=vi+4; nvi++){
          if(cellVal(T,dr,T.colOrder[nvi])!=='') break;
          spanW+=(T.colW[T.colOrder[nvi]]||DEFAULT_W);
          if(spanW>val.length*7.2+12) break;
        }
      }
      if(spanW>w) cls+=' ovf';
      var colPinned = vi<FC;
      // A pinned cell is the same cell drawn at scroll+offset. Both pinned puts it in the
      // corner block, which has to sit above both bands or the two overlap wrongly.
      if(colPinned||rowPinned) cls+=' fz';
      if(colPinned&&rowPinned) cls+=' fzboth';
      var cx = colPinned ? stLeft+x : x;
      var inner = isImg
        ? '<img src="'+esc(val)+'" alt="" loading="lazy" title="'+esc(val)+'">'
        : esc(val.length>500?val.slice(0,500)+'…':val);
      frag+='<div class="'+cls+'" data-v="'+v+'" data-vi="'+vi+'" style="left:'+cx+'px;top:'+y+'px;width:'+(isImg?w:spanW)+'px;height:'+ROW_H+'px">'+inner+'</div>';
      x+=w;
    }
  }
  // blank ghost row for adding data (user + directory)
  if(T.kind!=='ledger'){
    var vy=T.view.length*ROW_H;
    rh+='<div class="gs-rowhead" data-add="1" style="top:'+vy+'px;height:'+ROW_H+'px" title="Add a row">+</div>';
  }
  var cells=canvasEl.querySelectorAll('.gs-cell,.gs-rowspacer'); for(var i=0;i<cells.length;i++) cells[i].remove();
  canvasEl.insertAdjacentHTML('beforeend',frag);
  rowheadsInner.innerHTML=rh;
  rowheadsInner.style.transform='translateY('+(-stTop)+'px)';
  rowheadsInner.style.height=totalH()+'px';
}
function renderSel(){
  var sb=$('gs-selbox'), ab=$('gs-activebox'), fh=$('gs-fill');
  if(!T.sel||!T.view.length){ sb.style.display='none'; ab.style.display='none'; fh.style.display='none'; var oi=$('gs-objid'); if(oi) oi.style.display='none'; renderStats(); return; }
  var s=T.sel;
  var x1=colX(s.c1), x2=colX(s.c2+1), y1=s.r1*ROW_H, y2=(s.r2+1)*ROW_H;
  sb.style.display='block';
  sb.style.left=x1+'px'; sb.style.top=y1+'px'; sb.style.width=(x2-x1-1)+'px'; sb.style.height=(y2-y1-1)+'px';
  var av=clamp(T.activeR,0,T.view.length-1), ac=clamp(T.activeC,0,T.colOrder.length-1);
  var ax1=colX(ac), ax2=colX(ac+1);
  ab.style.display='block';
  ab.style.left=(ax1)+'px'; ab.style.top=(av*ROW_H)+'px'; ab.style.width=(ax2-ax1-2)+'px'; ab.style.height=(ROW_H-2)+'px';
  fh.style.display=(T.ro===true)?'none':'block';
  fh.style.left=(x2-4)+'px'; fh.style.top=(y2-4)+'px';
  $('gs-namebox').value = refOf(av,ac) + (s.r1!==s.r2||s.c1!==s.c2 ? ':'+refOf(s.r2===av&&s.c2===ac?s.r1:s.r2, s.c2===ac&&s.c1!==s.c2?s.c1:s.c2) : '');
  if(document.activeElement!==$('gs-fxinput')) $('gs-fxinput').value=cellVal(T, T.view[av], T.colOrder[ac]);
  renderObjId(av,ac);
  renderStats();
  syncUrl(false);
}
// The clicked cell names its object: <object id> · <field>, linked to the object's own address.
function renderObjId(av,ac){
  var el=$('gs-objid'); if(!el) return;
  var dr=T.view[av], m=T.meta[dr]||{};
  var fld=fieldName(T,T.colOrder[ac]);
  var oid = T.kind==='directory'&&T.drafts[dr] ? '(draft row)' : (m.key||m.id||(T.kind==='user'?T.id:''));
  if(!oid){ el.style.display='none'; return; }
  el.textContent=oid+' · '+fld;
  var href = m.href || (T.kind==='directory'&&m.key ? '/admin/directory/'+encodeURIComponent(m.key)+'?view=classic' : '');
  if(href&&TOKQ&&href.charAt(0)==='/') href+=(href.indexOf('?')>=0?'&':'?')+TOKQ;
  if(href){ el.href=href; el.style.pointerEvents=''; el.style.opacity=''; }
  else { el.removeAttribute('href'); el.style.pointerEvents='none'; el.style.opacity='.75'; }
  el.style.display='inline-flex';
}
function refOf(v,vi){ var dr=T.view[v]; return colLetter(vi+1)+(dr!=null?(dr+1):(v+1)); }
function renderStats(){
  var el=$('gs-stats'); if(!T.sel){ el.textContent=T.view.length+' rows'; return; }
  var s=T.sel, nums=[], count=0;
  for(var v=s.r1;v<=s.r2&&v<T.view.length;v++) for(var vi=s.c1;vi<=s.c2;vi++){
    var val=cellVal(T,T.view[v],T.colOrder[vi]);
    if(val!==''){ count++; if(isNum(val)) nums.push(Number(String(val).replace(/,/g,''))); } }
  if(nums.length>1){ var sum=nums.reduce(function(a,b){return a+b;},0);
    el.textContent='Sum: '+(+sum.toFixed(6))+'  ·  Avg: '+(+(sum/nums.length).toFixed(6))+'  ·  Count: '+count; }
  else el.textContent=T.view.length+' rows · '+count+' selected';
}

/* ═══════════════════ selection + keyboard ═══════════════════ */
function setActive(v,vi,extend){
  v=clamp(v,0,Math.max(0,T.view.length-1)); vi=clamp(vi,0,T.colOrder.length-1);
  if(extend&&T.anchor){ T.sel={r1:Math.min(T.anchor.v,v),r2:Math.max(T.anchor.v,v),c1:Math.min(T.anchor.vi,vi),c2:Math.max(T.anchor.vi,vi)}; }
  else { T.anchor={v:v,vi:vi}; T.sel={r1:v,r2:v,c1:vi,c2:vi}; }
  T.activeR=v; T.activeC=vi;
  scrollIntoView(v,vi);
  renderRows(); renderColHeads(); renderSel();
}
function clampSel(){ if(!T.view.length){ T.sel=null; return; } if(!T.sel) setActiveSilently(0,0); }
function setActiveSilently(v,vi){ T.anchor={v:v,vi:vi}; T.sel={r1:v,r2:v,c1:vi,c2:vi}; T.activeR=v; T.activeC=vi; }
function scrollIntoView(v,vi){
  var y1=v*ROW_H, y2=y1+ROW_H, x1=colX(vi), x2=colX(vi+1);
  if(y1<scrollEl.scrollTop) scrollEl.scrollTop=y1;
  if(y2>scrollEl.scrollTop+scrollEl.clientHeight) scrollEl.scrollTop=y2-scrollEl.clientHeight;
  if(x1<scrollEl.scrollLeft) scrollEl.scrollLeft=x1;
  if(x2>scrollEl.scrollLeft+scrollEl.clientWidth) scrollEl.scrollLeft=x2-scrollEl.clientWidth;
}
function dataEdge(v,vi,dv,dvi){ // ctrl+arrow: jump to edge of data block
  var cur=v, curc=vi;
  function has(vv,cc){ if(vv<0||cc<0||vv>=T.view.length||cc>=T.colOrder.length) return false; return cellVal(T,T.view[vv],T.colOrder[cc])!==''; }
  var stepped=false;
  while(true){ var nv=cur+dv, nc=curc+dvi;
    if(nv<0||nc<0||nv>=T.view.length||nc>=T.colOrder.length) break;
    if(has(nv,nc)){ cur=nv; curc=nc; stepped=true; if(!has(cur+dv,curc+dvi)&&stepped) break; }
    else { if(stepped||!has(cur,curc)) { if(!stepped){ cur=nv; curc=nc; while(has(cur+dv,curc+dvi)===false&&cur+dv>=0&&curc+dvi>=0&&cur+dv<T.view.length&&curc+dvi<T.colOrder.length){ cur+=dv; curc+=dvi; if(has(cur,curc)) break; } } break; } }
  }
  return [clamp(cur,0,T.view.length-1),clamp(curc,0,T.colOrder.length-1)];
}

document.addEventListener('keydown',function(e){
  if(!T) return;
  var ed=$('gs-editor'), editing=ed.style.display==='block';
  var inField=/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&document.activeElement!==ed;
  if(document.activeElement===$('gs-title')) return;
  if(e.key==='Escape'){ if(editing){ closeEditor(false); e.preventDefault(); } hideMenus(); $('gs-find').style.display='none'; FIND.q=''; var fq=$('gs-find-q'); if(fq&&document.activeElement===fq) fq.blur(); renderRows(); return; }
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='f'){ e.preventDefault(); openFind(); return; }
  if(inField) return;
  if(editing){
    if(e.key==='Enter'&&e.altKey){ if(!ed.readOnly){ var s=ed.selectionStart; ed.value=ed.value.slice(0,s)+'\\n'+ed.value.slice(ed.selectionEnd); ed.selectionStart=ed.selectionEnd=s+1; } e.preventDefault(); }
    else if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){ e.preventDefault(); closeEditor(true); } // commit, stay (Sheets)
    else if(e.key==='Enter'&&e.shiftKey){ e.preventDefault(); closeEditor(true); move(-1,0); } // commit, up (Sheets)
    else if(e.key==='Enter'){ e.preventDefault(); closeEditor(true); move(1,0); }
    else if(e.key==='Tab'){ e.preventDefault(); closeEditor(true); move(0,e.shiftKey?-1:1); }
    return;
  }
  var k=e.key;
  if((e.metaKey||e.ctrlKey)&&k.toLowerCase()==='z'&&!e.shiftKey){ e.preventDefault(); doUndo(); return; }
  if((e.metaKey||e.ctrlKey)&&(k.toLowerCase()==='y'||(k.toLowerCase()==='z'&&e.shiftKey))){ e.preventDefault(); doRedo(); return; }
  if((e.metaKey||e.ctrlKey)&&k.toLowerCase()==='c'){ copySel(); return; }
  if((e.metaKey||e.ctrlKey)&&k.toLowerCase()==='v'){ return; } // paste event handles it
  if((e.metaKey||e.ctrlKey)&&k.toLowerCase()==='a'){ e.preventDefault(); T.sel={r1:0,r2:Math.max(0,T.view.length-1),c1:0,c2:T.colOrder.length-1}; renderSel(); renderRows(); renderColHeads(); return; }
  if(!T.sel) return;
  var moves={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
  if(moves[k]){ e.preventDefault();
    if(e.metaKey||e.ctrlKey){ var t=dataEdge(T.activeR,T.activeC,moves[k][0],moves[k][1]); setActive(t[0],t[1],e.shiftKey); }
    else if(e.shiftKey){ headExtend(moves[k][0],moves[k][1]); }
    else move(moves[k][0],moves[k][1]);
    return; }
  if(k==='PageDown'||k==='PageUp'){ e.preventDefault(); var page=Math.floor(scrollEl.clientHeight/ROW_H)-2;
    move(k==='PageDown'?page:-page,0); return; }
  if(k==='Home'){ e.preventDefault(); setActive(e.ctrlKey||e.metaKey?0:T.activeR, 0, e.shiftKey); return; }
  if(k==='End'){ e.preventDefault(); setActive(e.ctrlKey||e.metaKey?T.view.length-1:T.activeR, T.colOrder.length-1, e.shiftKey); return; }
  if(k==='Enter'){ e.preventDefault(); openEditor(false); return; }
  if(k==='F2'){ e.preventDefault(); openEditor(false); return; }
  if(k==='Tab'){ e.preventDefault(); move(0,e.shiftKey?-1:1); return; }
  if(k==='Delete'||k==='Backspace'){ e.preventDefault(); clearSelection(); return; }
  if(k.length===1&&!e.metaKey&&!e.ctrlKey&&!e.altKey){ openEditor(true, k); e.preventDefault(); }
});
function move(dv,dvi){ setActive(T.activeR+dv, T.activeC+dvi, false); }
function headExtend(dv,dvi){
  var s=T.sel; var headV=(T.anchor.v===s.r1)?s.r2:s.r1; var headC=(T.anchor.vi===s.c1)?s.c2:s.c1;
  setActive(clamp(headV+dv,0,T.view.length-1), clamp(headC+dvi,0,T.colOrder.length-1), true);
  T.activeR=T.anchor.v; T.activeC=T.anchor.vi; renderSel();
}

/* ═══════════════════ mouse: cells, headers, fill, drag ═══════════════════ */
var mouseMode=null;
function hitCell(e){
  var rect=scrollEl.getBoundingClientRect();
  var x=e.clientX-rect.left+scrollEl.scrollLeft, y=e.clientY-rect.top+scrollEl.scrollTop;
  var v=Math.floor(y/ROW_H), vi=colAtX(x);
  return {v:v, vi:vi, inRows:v>=0&&v<T.view.length};
}
// Google-Sheets focus rule: clicking the grid returns
// typing to the grid. Without this, a click after using the name box / formula bar / a
// shell field leaves that field focused (the grid's mousedown preventDefault blocks the
// browser's own focus move), so keys land in the old field instead of opening the editor.
function blurStrayField(){
  var a=document.activeElement;
  if(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a!==$('gs-editor')) a.blur();
}
function wireGrid(){
  scrollEl.addEventListener('scroll',function(){ renderRows(); renderColHeads(); renderSel(); renderFreeze();
    if(T&&T.kind==='ledger'&&scrollEl.scrollTop+scrollEl.clientHeight>canvasEl.offsetHeight-800) loadMoreLedger();
    // User sheets page the same way: ask for the next block once the viewport nears the end
    // of what is loaded, so a 50,000-row sheet scrolls instead of arriving all at once.
    if(T&&T.kind==='user') ensureRows(T, Math.ceil((scrollEl.scrollTop+scrollEl.clientHeight)/ROW_H)+50);
  });
  scrollEl.addEventListener('mousedown',function(e){
    if(e.button===2) return;
    blurStrayField();
    if(e.target.id==='gs-fill'){ mouseMode={t:'fill', from:JSON.parse(JSON.stringify(T.sel))}; e.preventDefault(); return; }
    var h=hitCell(e); if(!h.inRows){ if(T.kind!=='ledger'&&h.v===T.view.length) addRowGhost(); return; }
    closeEditorIfOpen();
    setActive(h.v,h.vi,e.shiftKey);
    mouseMode={t:'sel'};
    e.preventDefault();
  });
  scrollEl.addEventListener('dblclick',function(e){
    var h=hitCell(e); if(!h.inRows) return;
    setActive(h.v,h.vi,false); openEditor(false);
  });
  document.addEventListener('mousemove',function(e){
    if(!mouseMode) return;
    if(mouseMode.t==='sel'){ var h=hitCell(e); setActive(clamp(h.v,0,T.view.length-1),h.vi,true); T.activeR=T.anchor.v; T.activeC=T.anchor.vi; renderSel(); }
    if(mouseMode.t==='fill'){ var h2=hitCell(e); var f=mouseMode.from;
      var sel=JSON.parse(JSON.stringify(f));
      var dv=h2.v-f.r2, dc=h2.vi-f.c2;
      if(Math.abs(dv)>=Math.abs(dc)&&h2.v>f.r2) sel.r2=clamp(h2.v,0,T.view.length-1);
      else if(Math.abs(dv)>=Math.abs(dc)&&h2.v<f.r1) sel.r1=clamp(h2.v,0,T.view.length-1);
      else if(h2.vi>f.c2) sel.c2=h2.vi; else if(h2.vi<f.c1) sel.c1=h2.vi;
      mouseMode.to=sel; T.sel=sel; renderSel(); }
    if(mouseMode.t==='resize'){ var dx=e.clientX-mouseMode.x0; T.colW[mouseMode.dc]=Math.max(40,mouseMode.w0+dx); renderColHeads(); renderRows(); renderSel(); }
    // Dragging a freeze grip. The blue line follows the pointer and snaps to a row or column
    // edge, so you can see exactly where the pin will land before letting go.
    if(mouseMode.t==='fzrow'){
      var bodyR=$('gs-scroll').getBoundingClientRect();
      var yy=clamp(e.clientY-bodyR.top, 0, scrollEl.clientHeight);
      var n=clamp(Math.round(yy/ROW_H), 0, Math.min(T.view.length-1<0?0:T.view.length-1, 20));
      mouseMode.n=n;
      var ln=$('gs-fzline-h'); ln.style.display='block'; ln.style.top=(n*ROW_H)+'px';
      e.preventDefault(); return;
    }
    if(mouseMode.t==='fzcol'){
      var bodyC=$('gs-scroll').getBoundingClientRect();
      var xx=clamp(e.clientX-bodyC.left, 0, scrollEl.clientWidth);
      var nc=0, accw=0;
      for(var ci=0; ci<T.colOrder.length && ci<20; ci++){
        var cw=T.colW[T.colOrder[ci]]||DEFAULT_W;
        if(xx < accw+cw/2) break;
        accw+=cw; nc=ci+1;
      }
      mouseMode.n=nc;
      var lnv=$('gs-fzline-v'); lnv.style.display='block'; lnv.style.left=(ROWHEAD_W+colX(nc))+'px';
      e.preventDefault(); return;
    }
    if(mouseMode.t==='coldrag'){
      var g=$('gs-dragghost'); g.style.display='block'; g.style.left=(e.clientX+8)+'px'; g.style.top=(e.clientY+8)+'px';
      var strip=$('gs-colheads').getBoundingClientRect();
      var x=e.clientX-strip.left+scrollEl.scrollLeft;
      var vi=colAtX(x); var ind=$('gs-dropind');
      var half=(x-colX(vi))>( (T.colW[T.colOrder[vi]]||DEFAULT_W)/2 );
      mouseMode.dropVi=vi+(half?1:0);
      ind.style.display='block';
      ind.style.left=(ROWHEAD_W+colX(mouseMode.dropVi)-scrollEl.scrollLeft)+'px';
      ind.style.top='0px'; ind.style.height='100%';
    }
  });
  document.addEventListener('mouseup',function(e){
    if(!mouseMode) return;
    if(mouseMode.t==='fzrow'||mouseMode.t==='fzcol'){
      $('gs-fzline-h').style.display='none'; $('gs-fzline-v').style.display='none';
      var gh=$('gs-fzgrip-h'), gv=$('gs-fzgrip-v');
      if(gh) gh.classList.remove('drag'); if(gv) gv.classList.remove('drag');
      if(mouseMode.n!=null){
        if(mouseMode.t==='fzrow') T.freeze.rows=mouseMode.n; else T.freeze.cols=mouseMode.n;
        // Scrolled away from the top with rows about to pin, the band would cover the rows it
        // pins. Bring the grid back so the pinned band and the first scrolling row both show.
        if(mouseMode.t==='fzrow'&&scrollEl.scrollTop<fzH()) scrollEl.scrollTop=0;
        if(mouseMode.t==='fzcol'&&scrollEl.scrollLeft<fzW()) scrollEl.scrollLeft=0;
        saveFreeze(); renderAll();
      }
      mouseMode=null; return;
    }
    if(mouseMode.t==='fill'&&mouseMode.to) applyFill(mouseMode.from, mouseMode.to);
    if(mouseMode.t==='resize') persistColWidths();
    if(mouseMode.t==='coldrag'){
      $('gs-dragghost').style.display='none'; $('gs-dropind').style.display='none';
      if(mouseMode.dropVi!=null) moveColumn(mouseMode.vi, mouseMode.dropVi);
    }
    mouseMode=null;
  });
  // the two freeze grips
  var fgh=$('gs-fzgrip-h'), fgv=$('gs-fzgrip-v');
  if(fgh) fgh.addEventListener('mousedown',function(e){
    blurStrayField(); fgh.classList.add('drag');
    mouseMode={t:'fzrow', n:fzRows()}; e.preventDefault(); e.stopPropagation();
  });
  if(fgv) fgv.addEventListener('mousedown',function(e){
    blurStrayField(); fgv.classList.add('drag');
    mouseMode={t:'fzcol', n:fzCols()}; e.preventDefault(); e.stopPropagation();
  });
  // column heads: click select, drag reorder, grip resize, funnel filter
  $('gs-colheads').addEventListener('mousedown',function(e){
    blurStrayField();
    var grip=e.target.closest('.gs-grip');
    if(grip){ var vi=Number(grip.getAttribute('data-vi')); var dc=T.colOrder[vi];
      mouseMode={t:'resize', dc:dc, x0:e.clientX, w0:T.colW[dc]||DEFAULT_W}; e.preventDefault(); return; }
    if(e.target.closest('.funnel')) return;
    var head=e.target.closest('.gs-colhead'); if(!head) return;
    var vi2=Number(head.getAttribute('data-vi'));
    T.sel={r1:0,r2:Math.max(0,T.view.length-1),c1:vi2,c2:vi2}; T.anchor={v:0,vi:vi2}; T.activeR=0; T.activeC=vi2;
    renderSel(); renderRows(); renderColHeads();
    mouseMode={t:'coldrag', vi:vi2, dropVi:null};
    $('gs-dragghost').textContent=(T.fields?T.fields[T.colOrder[vi2]]:colLetter(vi2+1));
    e.preventDefault();
  });
  $('gs-colheads').addEventListener('click',function(e){
    var f=e.target.closest('.funnel'); if(!f) return;
    openFilterPanel(Number(f.getAttribute('data-vi')), e.clientX, e.clientY);
    e.stopPropagation();
  });
  // Tap-to-sort: double-click a column header cycles
  // high-to-low -> low-to-high -> off. Numbers sort numerically (used, size, status...).
  $('gs-colheads').addEventListener('dblclick',function(e){
    var head=e.target.closest('.gs-colhead'); if(!head||e.target.closest('.gs-grip')||e.target.closest('.funnel')) return;
    var dc=T.colOrder[Number(head.getAttribute('data-vi'))];
    if(T.sortBy&&T.sortBy.c===dc&&T.sortBy.dir===-1) T.sortBy={c:dc,dir:1};
    else if(T.sortBy&&T.sortBy.c===dc&&T.sortBy.dir===1) T.sortBy=null;
    else T.sortBy={c:dc,dir:-1};
    rebuildView(T); clampSel(); syncUrl(true); renderAll();
    toast(T.sortBy?('Sorted '+(T.fields?T.fields[dc]:colLetter(dc+1))+(T.sortBy.dir===-1?' high → low':' low → high')):'Sort cleared');
  });
  $('gs-rowheads').addEventListener('mousedown',function(e){
    blurStrayField();
    var rh=e.target.closest('.gs-rowhead'); if(!rh) return;
    if(rh.getAttribute('data-add')){ addRowGhost(); return; }
    var v=Number(rh.getAttribute('data-v'));
    if(e.shiftKey&&T.sel){ T.sel.r1=Math.min(T.anchor.v,v); T.sel.r2=Math.max(T.anchor.v,v); T.sel.c1=0; T.sel.c2=T.colOrder.length-1; }
    else { T.anchor={v:v,vi:0}; T.sel={r1:v,r2:v,c1:0,c2:T.colOrder.length-1}; T.activeR=v; T.activeC=0; }
    renderSel(); renderRows(); renderColHeads();
  });
  $('gs-corner').addEventListener('click',function(){ if(!T.view.length) return;
    T.sel={r1:0,r2:T.view.length-1,c1:0,c2:T.colOrder.length-1}; T.anchor={v:0,vi:0}; renderSel(); renderRows(); renderColHeads(); });
  // context menus
  scrollEl.addEventListener('contextmenu',function(e){ e.preventDefault();
    var h=hitCell(e); if(h.inRows&&(!T.sel||h.v<T.sel.r1||h.v>T.sel.r2||h.vi<T.sel.c1||h.vi>T.sel.c2)) setActive(h.v,h.vi,false);
    openCellCtx(e.clientX,e.clientY); });
  $('gs-rowheads').addEventListener('contextmenu',function(e){ e.preventDefault();
    var rh=e.target.closest('.gs-rowhead'); if(!rh||rh.getAttribute('data-add')) return;
    var v=Number(rh.getAttribute('data-v'));
    if(!T.sel||v<T.sel.r1||v>T.sel.r2){ T.anchor={v:v,vi:0}; T.sel={r1:v,r2:v,c1:0,c2:T.colOrder.length-1}; renderSel(); }
    openRowCtx(e.clientX,e.clientY); });
  $('gs-colheads').addEventListener('contextmenu',function(e){ e.preventDefault();
    var head=e.target.closest('.gs-colhead'); if(!head) return;
    var vi=Number(head.getAttribute('data-vi'));
    if(!T.sel||vi<T.sel.c1||vi>T.sel.c2){ T.sel={r1:0,r2:Math.max(0,T.view.length-1),c1:vi,c2:vi}; T.anchor={v:0,vi:vi}; renderSel(); renderColHeads(); }
    openColCtx(vi,e.clientX,e.clientY); });
}
function persistColWidths(){
  if(T.kind==='directory') persistViewPrefs(T,'dir2');
  else if(T.kind==='ledger') persistViewPrefs(T,'led');
  else if(T.kind==='user') patchColMeta();
}
function patchColMeta(){
  var meta=(T.sheet&&T.sheet.col_meta)||{}; meta.widths=T.colW;
  jfetch('/api/sheets/'+encodeURIComponent(T.id),{method:'PATCH',body:{col_meta:meta}});
}
function moveColumn(fromVi,toVi){
  if(toVi===fromVi||toVi===fromVi+1) { renderColHeads(); return; }
  if(T.kind==='user'){
    var fromC=T.colOrder[fromVi]+1, toC=toVi>fromVi?toVi:toVi+1; // server is 1-based physical
    jfetch('/api/sheets/'+encodeURIComponent(T.id)+'/batch',{method:'POST',body:{requests:[{op:'move_col',from:fromC,to:toC}]}})
      .then(function(){ return loadTab(T,true); });
    // local immediate: splice values
    for(var r=0;r<T.vals.length;r++){ if(!T.vals[r]) continue;
      var row=T.vals[r]; var val=(row.splice(fromC-1,1))[0]; row.splice(toC-1,0,val); }
  } else {
    var dc=T.colOrder.splice(fromVi,1)[0];
    T.colOrder.splice(toVi>fromVi?toVi-1:toVi,0,dc);
    persistColWidths();
  }
  renderAll();
}

/* ═══════════════════ editor ═══════════════════ */
// Why a cell refuses writes, in the owner's terms.
function roReason(dr,dc){
  if(T.kind==='ledger') return 'the ledger is append-only';
  if(T.kind==='turns'||T.kind==='forum') return 'this sheet is a read-only projection of the ledger';
  var m=T.meta[dr]||{};
  if(T.kind==='directory'){
    if(m.ro) return 'a '+(m.kind||'corpus')+' projection — the object lives at its own address (the id chip above links to it)';
    var f=T.fields?T.fields[dc]:'';
    if(f==='key') return 'key is the primary key — add a new row instead of renaming';
    return f+' is computed from live data, not stored on the row';
  }
  return 'read-only';
}
// Autosize like Sheets: the editor grows to fit its text (up to 60% of the window),
// never smaller than its column — long values edit in place, not in a modal.
function fitEditor(ed,dc){
  var ctx=fitEditor._c||(fitEditor._c=document.createElement('canvas').getContext('2d'));
  ctx.font='13px Arial';
  var mw=0, lines=String(ed.value).split('\\n');
  for(var i=0;i<lines.length;i++){ var lw=ctx.measureText(lines[i]).width; if(lw>mw) mw=lw; }
  // caps floored: a tiny or hidden viewport (innerWidth 0) must never collapse the editor
  ed.style.width=Math.min(Math.max((T.colW[dc]||DEFAULT_W)+2, mw+22), Math.max(window.innerWidth*0.6, 480))+'px';
  ed.style.height='auto'; ed.style.height=Math.min(ed.scrollHeight+2, Math.max(window.innerHeight*0.4, 260))+'px';
}
// Google Sheets rule: EVERY cell opens an in-place editor at its
// own location on double-click / Enter / F2 — a read-only cell opens the same editor
// read-only (full text, caret, selectable), never a modal. Typing to replace a read-only
// value is the one refused gesture.
function openEditor(replace, seed){
  if(!T.sel||!T.view.length) return;
  var v=T.activeR, vi=T.activeC, dr=T.view[v], dc=T.colOrder[vi];
  var ro = cellRo(T,dr,dc);
  if(ro && replace){ toast('Read-only: '+roReason(dr,dc), 3800); return; }
  var ed=$('gs-editor');
  var rect=scrollEl.getBoundingClientRect();
  var wb=document.getElementById('ms-sheets-workbook').getBoundingClientRect();
  var x=colX(vi)-scrollEl.scrollLeft+rect.left-wb.left, y=v*ROW_H-scrollEl.scrollTop+rect.top-wb.top;
  ed.style.left=x-1+'px'; ed.style.top=y-1+'px';
  ed.style.minWidth=((T.colW[dc]||DEFAULT_W)+2)+'px'; ed.style.width='auto'; ed.style.height='auto';
  ed.value=replace?(seed||''):cellVal(T,dr,dc);
  ed.readOnly=!!ro;
  ed.className=ro?'ro':'';
  ed.style.display='block'; ed.focus();
  // Thicken the active-cell ring while the editor is open, the way Sheets does on a second click.
  var abx=$('gs-activebox'); if(abx) abx.classList.add('editing');
  if(!replace) ed.select ? ed.setSelectionRange(ed.value.length,ed.value.length) : 0;
  ed._cell={v:v,vi:vi,dr:dr,dc:dc,old:cellVal(T,dr,dc),ro:!!ro};
  $('gs-fxinput').value=ed.value;
  fitEditor(ed,dc);
  ed.oninput=function(){ fitEditor(ed,dc); $('gs-fxinput').value=ed.value; };
  if(ro) toast('Read-only: '+roReason(dr,dc), 2600);
}
function closeEditorIfOpen(){ var ed=$('gs-editor'); if(ed.style.display==='block') closeEditor(true); }
function closeEditor(commit){
  var _abx=$('gs-activebox'); if(_abx) _abx.classList.remove('editing');
  var ed=$('gs-editor'); if(ed.style.display!=='block') return;
  ed.style.display='none';
  var cell=ed._cell; if(!cell) return; ed._cell=null;
  if(!commit||cell.ro) return;
  var val=ed.value;
  if(val===cell.old) return;
  applyEdits([{dr:cell.dr, dc:cell.dc, old:cell.old, val:val}]);
}

// applyEdits: one undo unit; commits each cell through the adapter
function applyEdits(edits, fromUndo){
  var st=T;
  var results=[];
  var chain=Promise.resolve();
  edits.forEach(function(ed){
    chain=chain.then(function(){ return new Promise(function(res){
      commitCell(st, ed.dr, ed.dc, ed.val, function(ok, err){
        if(ok){ setLocal(st,ed.dr,ed.dc,ed.val); results.push(ed); }
        else if(err){ flashError(ed.dr, ed.dc); toast(err, 4200); }
        res();
      });
    });});
  });
  chain.then(function(){
    if(results.length&&!fromUndo){ st.undo.push(results.map(function(e){ return {dr:e.dr,dc:e.dc,old:e.old,val:e.val}; })); if(st.undo.length>100) st.undo.shift(); st.redo=[]; }
    rebuildView(st); renderRows(); renderSel();
  });
}
function flashError(dr,dc){
  var vi=T.colOrder.indexOf(dc); var v=T.view.indexOf(dr);
  if(vi<0||v<0) return;
  var el=canvasEl.querySelector('.gs-cell[data-v="'+v+'"][data-vi="'+vi+'"]');
  if(el){ el.classList.add('errflash'); setTimeout(function(){ el.classList.remove('errflash'); },1200); }
}
function doUndo(){ var u=T.undo.pop(); if(!u){ toast('Nothing to undo'); return; }
  T.redo.push(u); applyEdits(u.map(function(e){ return {dr:e.dr,dc:e.dc,old:e.val,val:e.old}; }), true); }
function doRedo(){ var u=T.redo.pop(); if(!u){ toast('Nothing to redo'); return; }
  T.undo.push(u); applyEdits(u.map(function(e){ return {dr:e.dr,dc:e.dc,old:e.old,val:e.val}; }), true); }

function clearSelection(){
  if(!T.sel) return;
  if(T.ro===true){ toast('Read-only: the ledger is append-only'); return; }
  var edits=[];
  for(var v=T.sel.r1;v<=T.sel.r2&&v<T.view.length;v++) for(var vi=T.sel.c1;vi<=T.sel.c2;vi++){
    var dr=T.view[v], dc=T.colOrder[vi];
    if(cellRo(T,dr,dc)) continue;
    var old=cellVal(T,dr,dc); if(old!=='') edits.push({dr:dr,dc:dc,old:old,val:''});
  }
  if(edits.length>200){ toast('Clearing '+edits.length+' cells…'); }
  applyEdits(edits);
}

function applyFill(from,to){
  // pattern source = from range; target = to minus from
  var edits=[];
  function srcVal(v,vi){
    var h=from.r2-from.r1+1, w=from.c2-from.c1+1;
    var sv=from.r1+((v-from.r1)%h+h)%h, sc=from.c1+((vi-from.c1)%w+w)%w;
    return cellVal(T,T.view[sv],T.colOrder[sc]);
  }
  // numeric series: single column/row source of 2+ numbers with constant delta
  var series=null;
  if(from.c1===from.c2&&from.r2>from.r1){
    var ns=[]; for(var v=from.r1;v<=from.r2;v++){ var x=cellVal(T,T.view[v],T.colOrder[from.c1]); if(!isNum(x)){ ns=null; break; } ns.push(Number(x)); }
    if(ns&&ns.length>=2){ var d=ns[1]-ns[0], okd=true; for(var i=2;i<ns.length;i++) if(Math.abs(ns[i]-ns[i-1]-d)>1e-9) okd=false;
      if(okd) series={base:ns[ns.length-1], d:d, fromR:from.r2}; }
  }
  for(var v2=to.r1;v2<=to.r2&&v2<T.view.length;v2++) for(var vi2=to.c1;vi2<=to.c2;vi2++){
    if(v2>=from.r1&&v2<=from.r2&&vi2>=from.c1&&vi2<=from.c2) continue;
    var dr=T.view[v2], dc=T.colOrder[vi2];
    if(cellRo(T,dr,dc)) continue;
    var val = series&&vi2===from.c1 ? String(series.base+series.d*(v2-series.fromR)) : srcVal(v2,vi2);
    edits.push({dr:dr,dc:dc,old:cellVal(T,dr,dc),val:val});
  }
  applyEdits(edits);
}

/* ═══════════════════ clipboard ═══════════════════ */
function copySel(){
  if(!T.sel) return;
  var out=[];
  for(var v=T.sel.r1;v<=T.sel.r2&&v<T.view.length;v++){ var row=[];
    for(var vi=T.sel.c1;vi<=T.sel.c2;vi++) row.push(cellVal(T,T.view[v],T.colOrder[vi]).replace(/\\t/g,' '));
    out.push(row.join('\\t')); }
  var text=out.join('\\n');
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function(){ toast('Copied '+out.length+' row'+(out.length>1?'s':'')); });
  else { var ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Copied'); }
}
document.addEventListener('paste',function(e){
  if(!T||!T.sel) return;
  if(/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  var text=(e.clipboardData||window.clipboardData).getData('text'); if(!text) return;
  e.preventDefault();
  var lines=text.replace(/\\r/g,'').split('\\n'); if(lines[lines.length-1]==='') lines.pop();
  var grid=lines.map(function(l){ return l.split('\\t'); });
  var edits=[], skipped=0;
  for(var i=0;i<grid.length;i++) for(var j=0;j<grid[i].length;j++){
    var v=T.activeR+i, vi=T.activeC+j;
    if(v>=T.view.length){ if(T.kind==='user'&&T.view.length===T.nRows&&!hasActiveFilter(T)){} skipped++; continue; }
    if(vi>=T.colOrder.length){ skipped++; continue; }
    var dr=T.view[v], dc=T.colOrder[vi];
    if(cellRo(T,dr,dc)){ skipped++; continue; }
    edits.push({dr:dr,dc:dc,old:cellVal(T,dr,dc),val:grid[i][j]});
  }
  applyEdits(edits);
  if(skipped) toast('Pasted '+edits.length+' cells · '+skipped+' skipped (read-only or out of range)');
});
document.addEventListener('copy',function(e){
  if(!T||!T.sel) return;
  if(/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
});

/* ═══════════════════ filters + sort UI ═══════════════════ */
function openFilterPanel(vi,x,y){
  var dc=T.colOrder[vi];
  var fp=$('gs-filterpanel');
  var rule=T.filters[dc]||{};
  var uniq={}, count=0;
  for(var r=0;r<T.nRows&&count<20000;r++){ var v=cellVal(T,r,dc); if(!(v in uniq)){ uniq[v]=0; } uniq[v]++; count++; }
  var keys=Object.keys(uniq).sort().slice(0,300);
  var name=T.fields?T.fields[dc]:colLetter(vi+1);
  var html='<div style="font-weight:700;font-size:13px;margin-bottom:2px">'+esc(name)+'</div>'
    +'<h4>Sort</h4><div class="frow">'
    +'<button class="gs-btn" data-sort="1" style="flex:1">A → Z</button>'
    +'<button class="gs-btn" data-sort="-1" style="flex:1">Z → A</button>'
    +'<button class="gs-btn" data-sort="0" title="Clear sort">✕</button></div>'
    +'<h4>Filter by condition</h4>'
    +'<select id="gs-f-cond">'
    +['','contains','not_contains','eq','neq','gt','lt','empty','not_empty'].map(function(c){
      var tenant={'':'None',contains:'Contains',not_contains:'Does not contain',eq:'Is exactly',neq:'Is not',gt:'Greater than',lt:'Less than',empty:'Is empty',not_empty:'Is not empty'}[c];
      return '<option value="'+c+'"'+((rule.cond||'')===c?' selected':'')+'>'+tenant+'</option>'; }).join('')
    +'</select>'
    +'<div class="frow"><input type="text" id="gs-f-needle" placeholder="Value" value="'+esc(rule.needle||'')+'"></div>'
    +'<h4>Filter by values</h4>'
    +'<div class="frow"><input type="text" id="gs-f-search" placeholder="Search values"><button class="gs-btn" id="gs-f-all">All</button><button class="gs-btn" id="gs-f-none">Clear</button></div>'
    +'<div class="gs-vals" id="gs-f-vals">'
    +keys.map(function(k){ var checked=!rule.values||rule.values[k];
      return '<label data-v="'+esc(k)+'"><input type="checkbox" '+(checked?'checked':'')+' data-val="'+esc(k)+'"><span>'+(k===''?'(empty)':esc(k.length>40?k.slice(0,40)+'…':k))+'</span><span style="margin-left:auto;color:#9aa0a6">'+uniq[k]+'</span></label>'; }).join('')
    +'</div>'
    +'<div class="gs-fbtns"><button class="gs-btn" id="gs-f-clear">Remove filter</button><button class="gs-btn pri" id="gs-f-ok">OK</button></div>';
  fp.innerHTML=html;
  fp.style.display='block';
  fp.style.left=Math.min(x, window.innerWidth-290)+'px';
  fp.style.top=Math.min(y+8, window.innerHeight-460)+'px';
  fp.querySelectorAll('[data-sort]').forEach(function(b){ b.onclick=function(){
    var d=Number(b.getAttribute('data-sort'));
    T.sortBy = d===0?null:{c:dc,dir:d};
    rebuildView(T); clampSel(); syncUrl(true); renderAll(); }; });
  $('gs-f-search').oninput=function(){ var q=this.value.toLowerCase();
    fp.querySelectorAll('#gs-f-vals label').forEach(function(l){ l.style.display=l.getAttribute('data-v').toLowerCase().indexOf(q)>=0?'':'none'; }); };
  $('gs-f-all').onclick=function(){ fp.querySelectorAll('#gs-f-vals input').forEach(function(i){ i.checked=true; }); };
  $('gs-f-none').onclick=function(){ fp.querySelectorAll('#gs-f-vals input').forEach(function(i){ i.checked=false; }); };
  $('gs-f-clear').onclick=function(){ delete T.filters[dc]; fp.style.display='none'; rebuildView(T); clampSel(); syncUrl(true); renderAll(); };
  $('gs-f-ok').onclick=function(){
    var cond=$('gs-f-cond').value, needle=$('gs-f-needle').value;
    var boxes=fp.querySelectorAll('#gs-f-vals input');
    var vals={}, allOn=true;
    boxes.forEach(function(b){ vals[b.getAttribute('data-val')]=b.checked; if(!b.checked) allOn=false; });
    var rule2={};
    if(cond) { rule2.cond=cond; rule2.needle=needle; }
    if(!allOn) rule2.values=vals;
    if(!cond&&allOn){ delete T.filters[dc]; } else T.filters[dc]=rule2;
    fp.style.display='none';
    rebuildView(T); clampSel(); syncUrl(true); renderAll();
  };
}
document.addEventListener('mousedown',function(e){
  var fp=$('gs-filterpanel'); if(fp.style.display==='block'&&!fp.contains(e.target)&&!e.target.closest('.funnel')) fp.style.display='none';
  var cx=$('gs-ctx'); if(cx.style.display==='block'&&!cx.contains(e.target)) cx.style.display='none';
  if(!e.target.closest('.gs-menu')&&!e.target.closest('.gs-dropdown')) hideMenus();
});

/* ═══════════════════ context menus ═══════════════════ */
function menu(items,x,y){
  var cx=$('gs-ctx');
  cx.innerHTML=items.map(function(it,i){
    if(it==='-') return '<div class="gs-sep"></div>';
    return '<div class="gs-item'+(it.disabled?' disabled':'')+'" data-i="'+i+'">'+esc(it.label)+(it.kbd?'<span class="kbd">'+it.kbd+'</span>':'')+'</div>';
  }).join('');
  cx.style.display='block';
  cx.style.left=Math.min(x,window.innerWidth-230)+'px';
  cx.style.top=Math.min(y,window.innerHeight-cx.offsetHeight-10)+'px';
  cx.onclick=function(e){
    var el=e.target.closest('.gs-item'); if(!el) return;
    var it=items[Number(el.getAttribute('data-i'))];
    cx.style.display='none';
    if(it&&it.fn) it.fn();
  };
}
function openCellCtx(x,y){
  var items=[
    {label:'Copy',kbd:'⌘C',fn:copySel},
    {label:'Paste',kbd:'⌘V',fn:function(){ toast('Press ⌘V to paste'); }},
    '-',
    {label:'Clear values',kbd:'⌫',fn:clearSelection,disabled:T.ro===true},
    {label:'View full value',fn:function(){ showValueViewer(cellVal(T,T.view[T.activeR],T.colOrder[T.activeC])); }},
    {label:'Copy link to this cell',fn:function(){ var u=location.origin+(stateUrl()||location.pathname);
      if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(u); toast('Cell link copied — it reopens this exact view'); }},
  ];
  if(T.kind==='directory'){
    var key=T.meta[T.view[T.activeR]]&&T.meta[T.view[T.activeR]].key;
    items.push('-');
    items.push({label:'Open row editor ('+(key||'')+') ↗',fn:function(){ window.open('/admin/directory/'+encodeURIComponent(key)+'?view=classic','_blank'); }});
  }
  var mh=T.meta[T.view[T.activeR]]&&T.meta[T.view[T.activeR]].href;
  if(mh){
    items.push('-');
    items.push({label:'Open this row&#39;s raw object ↗',fn:function(){ var h=mh; if(TOKQ&&h.charAt(0)==='/') h+=(h.indexOf('?')>=0?'&':'?')+TOKQ; window.open(h,'_blank'); }});
  }
  if(T.kind==='user'){
    items.push('-');
    items.push({label:'Run model on this column…',fn:function(){ openRunPanel(); }});
  }
  menu(items,x,y);
}
function openRowCtx(x,y){
  var n=T.sel?T.sel.r2-T.sel.r1+1:1;
  var items=[{label:'Copy',kbd:'⌘C',fn:copySel}];
  if(T.kind==='user'){
    items.push('-');
    items.push({label:'Insert '+n+' row'+(n>1?'s':'')+' above',fn:function(){ userDim('insert_rows',T.view[T.sel.r1]+1,n); }});
    items.push({label:'Insert '+n+' row'+(n>1?'s':'')+' below',fn:function(){ userDim('insert_rows',T.view[T.sel.r2]+2,n); }});
    items.push({label:'Delete row'+(n>1?'s':''),fn:function(){ userDim('delete_rows',T.view[T.sel.r1]+1,n); }});
    items.push('-');
    items.push({label:'Run model on selected rows…',fn:function(){
      var rows=[]; for(var v=T.sel.r1;v<=T.sel.r2;v++) rows.push(T.view[v]+1);
      openRunPanel(); var f=$('rp-rows'); if(f) f.value=rows.join(',');
    }});
  }
  if(T.kind==='directory'){
    items.push('-');
    items.push({label:'New row (draft)',fn:addRowGhost});
    items.push({label:'Delete row'+(n>1?'s':'')+'…',fn:deleteDirectoryRows});
  }
  var rh=T.meta[T.view[T.activeR]]&&T.meta[T.view[T.activeR]].href;
  if(rh){
    items.push({label:'Open this row&#39;s raw object ↗',fn:function(){ var h=rh; if(TOKQ&&h.charAt(0)==='/') h+=(h.indexOf('?')>=0?'&':'?')+TOKQ; window.open(h,'_blank'); }});
  }
  menu(items,x,y);
}
function openColCtx(vi,x,y){
  var dc=T.colOrder[vi];
  var items=[
    {label:'Sort sheet A → Z',fn:function(){ T.sortBy={c:dc,dir:1}; rebuildView(T); renderAll(); }},
    {label:'Sort sheet Z → A',fn:function(){ T.sortBy={c:dc,dir:-1}; rebuildView(T); renderAll(); }},
    {label:'Filter…',fn:function(){ openFilterPanel(vi,x,y); }},
  ];
  if(T.kind==='user'){
    items.push('-');
    items.push({label:'Insert 1 column left',fn:function(){ userDim('insert_cols',dc+1,1); }});
    items.push({label:'Insert 1 column right',fn:function(){ userDim('insert_cols',dc+2,1); }});
    items.push({label:'Delete column '+colLetter(dc+1),fn:function(){ userDim('delete_cols',dc+1,1); }});
    items.push('-');
    items.push({label:'Run model into columns…',fn:openRunPanel});
  }
  menu(items,x,y);
}
function userDim(op,at,n){
  if(hasActiveFilter(T)&&/rows/.test(op)){ toast('Clear filters and sort before inserting or deleting rows — the view order is not the stored order'); return; }
  jfetch('/api/sheets/'+encodeURIComponent(T.id)+'/batch',{method:'POST',body:{requests:[{op:op,at:at,n:n}]}})
    .then(function(res){ if(!res.ok||!res.j.ok){ toast('Refused: '+((res.j&&res.j.error)||res.status)); return; }
      loadTab(T,true).then(function(){ toast(op.replace('_',' ')+' ✓'); }); });
}
function addRowGhost(){
  if(T.kind==='directory'){
    var dr=T.nRows;
    T.vals.push(new Array(T.fields.length).fill(''));
    T.meta.push({key:null, cap:true, kind:'agent'}); T.drafts[dr]=true; T.nRows++;
    rebuildView(T); renderAll();
    var v=T.view.indexOf(dr); if(v>=0){ setActive(v, T.colOrder.indexOf(0)>=0?T.colOrder.indexOf(0):0, false); openEditor(false); }
    toast('Draft row — fill key and type to create it');
  } else if(T.kind==='user'){
    if(T.view.length>=T.nRows){ T.nRows+=100; jfetch('/api/sheets/'+encodeURIComponent(T.id),{method:'PATCH',body:{rows:T.nRows}}); }
    rebuildView(T); renderAll();
  }
}
function deleteDirectoryRows(){
  var keys=[];
  for(var v=T.sel.r1;v<=T.sel.r2;v++){ var m=T.meta[T.view[v]]; if(m&&m.key&&m.cap) keys.push(m.key); }
  if(!keys.length){ toast('Only capability rows (agent/fn/http/flow) can be deleted here — corpus rows live at their own addresses'); return; }
  if(!window.confirm('DELETE '+keys.length+' directory row'+(keys.length>1?'s':'')+':\\n'+keys.slice(0,8).join(', ')+(keys.length>8?'…':''))) return;
  var chain=Promise.resolve(), okN=0, failN=0;
  keys.forEach(function(k){ chain=chain.then(function(){
    return jfetch('/api/directory/'+encodeURIComponent(k),{method:'DELETE'}).then(function(res){ if(res.ok&&res.j.ok) okN++; else failN++; }); }); });
  chain.then(function(){ toast('Deleted '+okN+(failN?' · '+failN+' failed':'')); loadTab(T,true); });
}
// A read-only cell is a handle: the preview lives in the grid, the object lives at its own
// address. The viewer shows both — the value and the door.
function showValueViewer(val, href){
  var hp=$('gs-help-body');
  var link='';
  if(href){ var h=href; if(TOKQ&&h.charAt(0)==='/') h+=(h.indexOf('?')>=0?'&':'?')+TOKQ;
    link='<p style="font-size:12.5px;margin:6px 0"><a href="'+esc(h)+'" target="_blank" rel="noopener">Open this row&#39;s raw object ↗</a> <span style="color:#9aa0a6">'+esc(href.split('?')[0])+'</span></p>'; }
  hp.innerHTML='<h2>Cell value</h2>'+link+'<pre style="max-height:60vh;white-space:pre-wrap">'+esc(val)+'</pre>'
    +'<div class="gs-fbtns"><button class="gs-btn" id="gs-vv-copy">Copy</button><button class="gs-btn pri" id="gs-vv-x">Close</button></div>';
  $('gs-help').style.display='flex';
  $('gs-vv-copy').onclick=function(){ navigator.clipboard&&navigator.clipboard.writeText(val); toast('Copied'); };
  $('gs-vv-x').onclick=function(){ $('gs-help').style.display='none'; };
}

/* ═══════════════════ find ═══════════════════ */
var FIND={q:'',hits:[],i:0};
function openFind(){ $('gs-find').style.display='flex'; $('gs-find-q').focus(); $('gs-find-q').select(); }
function runFind(){
  FIND.q=$('gs-find-q').value.toLowerCase(); FIND.hits=[];
  if(FIND.q){ for(var v=0;v<T.view.length;v++) for(var vi=0;vi<T.colOrder.length;vi++){
    if(cellVal(T,T.view[v],T.colOrder[vi]).toLowerCase().indexOf(FIND.q)>=0) FIND.hits.push([v,vi]); } }
  FIND.i=0; $('gs-find-c').textContent=FIND.hits.length?('1 of '+FIND.hits.length):'0 of 0';
  renderRows(); if(FIND.hits.length) setActive(FIND.hits[0][0],FIND.hits[0][1],false);
}
$('gs-find-q').addEventListener('input',function(){ runFind(); });
$('gs-find-q').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); findStep(e.shiftKey?-1:1); } if(e.key==='Escape'){ $('gs-find').style.display='none'; FIND.q=''; renderRows(); this.blur(); } });
function findStep(d){ if(!FIND.hits.length) return; FIND.i=(FIND.i+d+FIND.hits.length)%FIND.hits.length;
  $('gs-find-c').textContent=(FIND.i+1)+' of '+FIND.hits.length;
  setActive(FIND.hits[FIND.i][0],FIND.hits[FIND.i][1],false); }
$('gs-find-next').onclick=function(){ findStep(1); };
$('gs-find-prev').onclick=function(){ findStep(-1); };
$('gs-find-x').onclick=function(){ $('gs-find').style.display='none'; FIND.q=''; renderRows(); $('gs-find-q').blur(); };

/* ═══════════════════ name box + formula bar ═══════════════════ */
$('gs-namebox').addEventListener('keydown',function(e){
  if(e.key!=='Enter') return;
  e.preventDefault();
  var m=String(this.value||'').trim().toUpperCase().match(/^([A-Z]+)(\\d+)(?::([A-Z]+)(\\d+))?$/);
  if(!m){ toast('Use a ref like B3 or A1:C10'); return; }
  var c1=letterCol(m[1])-1, r1=Number(m[2]);
  // displayed row numbers are data rows + 1 — find them in the current view
  var v1=T.view.indexOf(r1-1); if(v1<0){ toast('Row '+r1+' is filtered out or beyond data'); return; }
  setActive(v1, clamp(c1,0,T.colOrder.length-1), false);
  if(m[3]){ var c2=letterCol(m[3])-1, r2=Number(m[4]); var v2=T.view.indexOf(r2-1);
    if(v2>=0){ T.sel={r1:Math.min(v1,v2),r2:Math.max(v1,v2),c1:Math.min(c1,c2),c2:Math.max(c1,c2)}; renderSel(); } }
  scrollEl.focus&&scrollEl.focus();
});
$('gs-fxinput').addEventListener('keydown',function(e){
  if(e.key==='Enter'){ e.preventDefault();
    if(!T.sel) return;
    var dr=T.view[T.activeR], dc=T.colOrder[T.activeC];
    applyEdits([{dr:dr,dc:dc,old:cellVal(T,dr,dc),val:this.value}]);
    this.blur();
  }
  if(e.key==='Escape'){ this.value=cellVal(T,T.view[T.activeR],T.colOrder[T.activeC]); this.blur(); }
});

/* ═══════════════════ title rename ═══════════════════ */
$('gs-title').addEventListener('blur',function(){
  if(T.kind!=='user') { syncTitle(); return; }
  var t=this.textContent.trim()||'Untitled sheet';
  if(t===T.title) return;
  T.title=t;
  jfetch('/api/sheets/'+encodeURIComponent(T.id),{method:'PATCH',body:{title:t}}).then(function(){ renderTabs(); });
});
$('gs-title').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); this.blur(); } });

/* ═══════════════════ menubar + toolbar ═══════════════════ */
var MENUS=[
  {label:'File',items:function(){ return [
    {label:'New sheet',kbd:'',fn:createNewSheet},
    {label:'Duplicate tab to new sheet',fn:duplicateToSheet},
    {label:'Import CSV → new sheet',fn:importCsv},
    '-',
    {label:'Download as CSV',fn:downloadCsv},
    '-',
    T.kind==='user'?{label:'Delete this sheet…',fn:deleteThisSheet}:{label:'Classic view',fn:function(){ var h=$('gs-classic').getAttribute('href'); if(h) location.href=h; }},
  ];}},
  {label:'Edit',items:function(){ return [
    {label:'Undo',kbd:'⌘Z',fn:doUndo},
    {label:'Redo',kbd:'⌘⇧Z',fn:doRedo},
    '-',
    {label:'Copy',kbd:'⌘C',fn:copySel},
    {label:'Clear values',kbd:'⌫',fn:clearSelection,disabled:T.ro===true},
    '-',
    {label:'Find',kbd:'⌘F',fn:openFind},
  ];}},
  {label:'View',items:function(){ return [
    {label:'Refresh data',fn:function(){ loadTab(T,true); }},
    {label:(hasActiveFilter(T)?'✓ ':'')+'Filters active — clear all',fn:function(){ T.filters={}; T.sortBy=null; rebuildView(T); renderAll(); }},
    {label:'Reset column layout',fn:function(){ T.colOrder=[]; T.colW={}; T.loaded=false; loadTab(T,true); }},
  ];}},
  {label:'Insert',items:function(){ return [
    {label:'Row above',fn:function(){ if(T.kind==='user'&&T.sel) userDim('insert_rows',T.view[T.sel.r1]+1,1); else if(T.kind==='directory') addRowGhost(); },disabled:T.kind==='ledger'},
    {label:'Row below',fn:function(){ if(T.kind==='user'&&T.sel) userDim('insert_rows',T.view[T.sel.r2]+2,1); else if(T.kind==='directory') addRowGhost(); },disabled:T.kind==='ledger'},
    {label:'Column left',fn:function(){ if(T.sel) userDim('insert_cols',T.colOrder[T.sel.c1]+1,1); },disabled:T.kind!=='user'},
    {label:'Column right',fn:function(){ if(T.sel) userDim('insert_cols',T.colOrder[T.sel.c2]+2,1); },disabled:T.kind!=='user'},
    '-',
    {label:'New sheet',fn:createNewSheet},
  ];}},
  {label:'Data',items:function(){ return [
    {label:'Sort A → Z (active column)',fn:function(){ if(T.sel){ T.sortBy={c:T.colOrder[T.activeC],dir:1}; rebuildView(T); renderAll(); } }},
    {label:'Sort Z → A (active column)',fn:function(){ if(T.sel){ T.sortBy={c:T.colOrder[T.activeC],dir:-1}; rebuildView(T); renderAll(); } }},
    {label:'Filter active column…',fn:function(){ if(T.sel) openFilterPanel(T.activeC, 300, 200); }},
    {label:'Clear all filters + sort',fn:function(){ T.filters={}; T.sortBy=null; rebuildView(T); renderAll(); }},
    '-',
    {label:'Refresh from server',fn:function(){ loadTab(T,true); }},
  ];}},
  {label:'Model',items:function(){ return [
    {label:'Run model panel…',fn:openRunPanel,disabled:T.kind!=='user'},
    T.kind!=='user'?{label:'(runs need an editable sheet — File → Duplicate tab)',disabled:true}:null,
    '-',
    {label:'Invoke lane fields ↗',fn:function(){ window.open('/api/invoke?fields=1','_blank'); }},
    {label:'Model catalog ↗',fn:function(){ window.open('/admin/models-catalog','_blank'); }},
  ].filter(Boolean);}},
  {label:'Help',items:function(){ return [
    {label:'Sheet help + shortcuts',fn:showHelp},
    {label:'REST for this sheet',fn:showRest},
    {label:'API contract ↗',fn:function(){ window.open('/api/sheets','_blank'); }},
  ];}},
];
// The classic directory kind tabs, back where he asked: right of Help on the menubar row.
var KINDTABS=[
  {id:'',label:'Everything'},{id:'agent',label:'Agents'},{id:'tool',label:'Tools'},
  {id:'flow',label:'Flows'},{id:'content',label:'Content'},{id:'page',label:'Pages'},
  {id:'file',label:'Files'},{id:'other',label:'Other'}];
function renderKindTabs(){
  var host=$('gs-kindtabs'); if(!host) return;
  if(T.kind!=='directory'){ host.innerHTML=''; return; }
  var counts={}; T.meta.forEach(function(m){ KINDTABS.forEach(function(k){ if(k.id&&matchKindTab(m.kind,k.id)) counts[k.id]=(counts[k.id]||0)+1; }); });
  counts['']=T.meta.length;
  host.innerHTML=KINDTABS.map(function(k){
    return '<span class="gs-kind'+((T.kindFilter||'')===k.id?' on':'')+'" data-k="'+k.id+'">'+k.label+'<span class="kc">'+(counts[k.id]||0)+'</span></span>';
  }).join('');
  host.querySelectorAll('.gs-kind').forEach(function(el){
    el.onclick=function(){ T.kindFilter=el.getAttribute('data-k'); rebuildView(T); clampSel(); syncUrl(true); renderAll(); };
  });
}
function renderMenubar(){
  var mb=$('gs-menubar');
  mb.innerHTML=MENUS.map(function(m,i){ return '<span class="gs-menu" data-m="'+i+'">'+m.label+'</span>'; }).join('')
    +'<span class="gs-kindtabs" id="gs-kindtabs"></span>'
    +'<div class="gs-dropdown" id="gs-dropdown"></div>';
  renderKindTabs();
  mb.querySelectorAll('.gs-menu').forEach(function(el){
    el.addEventListener('click',function(){ toggleMenu(Number(el.getAttribute('data-m')), el); });
    el.addEventListener('mouseenter',function(){ var dd=$('gs-dropdown'); if(dd.classList.contains('open')) toggleMenu(Number(el.getAttribute('data-m')), el, true); });
  });
}
function toggleMenu(i, el, force){
  var dd=$('gs-dropdown');
  var was=dd.classList.contains('open')&&dd._mi===i;
  hideMenus();
  if(was&&!force) return;
  var items=MENUS[i].items();
  dd.innerHTML=items.map(function(it,j){
    if(it==='-') return '<div class="gs-sep"></div>';
    return '<div class="gs-item'+(it.disabled?' disabled':'')+'" data-j="'+j+'">'+esc(it.label)+(it.kbd?'<span class="kbd">'+it.kbd+'</span>':'')+'</div>';
  }).join('');
  dd.style.left=el.offsetLeft+'px';
  dd.classList.add('open'); dd._mi=i;
  el.classList.add('open');
  dd.onclick=function(e){ var t=e.target.closest('.gs-item'); if(!t) return;
    var it=items[Number(t.getAttribute('data-j'))]; hideMenus(); if(it&&it.fn) it.fn(); };
}
function hideMenus(){ var dd=$('gs-dropdown'); if(dd){ dd.classList.remove('open'); }
  document.querySelectorAll('.gs-menu.open').forEach(function(m){ m.classList.remove('open'); }); }

function renderToolbar(){
  var tb=$('gs-toolbar');
  var h='<button class="gs-tb" id="tb-undo" title="Undo (⌘Z)">↶</button>'
   +'<button class="gs-tb" id="tb-redo" title="Redo (⌘⇧Z)">↷</button>'
   +'<span class="gs-tbsep"></span>'
   +'<button class="gs-tb'+(hasActiveFilter(T)?' on':'')+'" id="tb-filter" title="Filter active column">⏷ Filter</button>'
   +'<button class="gs-tb" id="tb-clearf" title="Clear filters + sort">✕</button>'
   +'<span class="gs-tbsep"></span>'
   +'<button class="gs-tb" id="tb-run" title="Run a model over rows">▶ Run model</button>'
   +'<button class="gs-tb" id="tb-csv" title="Download CSV">⤓ CSV</button>'
   +'<button class="gs-tb" id="tb-refresh" title="Refresh from server">⟳</button>'
   +'<button class="gs-tb" id="tb-help" title="Help + REST">?</button>';
  if(T.kind==='ledger'){
    var p=T.ledParams;
    h+='<span class="gs-tbsep"></span><span class="tenant">server query:</span>'
     +'<input id="lq-key" placeholder="key" value="'+esc(p.key||'')+'" style="width:130px">'
     +'<input id="lq-q" placeholder="text contains" value="'+esc(p.q||'')+'" style="width:130px">'
     +'<input id="lq-trace" placeholder="trace_id" value="'+esc(p.trace_id||'')+'" style="width:110px">'
     +'<select id="lq-limit">'+['100','250','500','1000'].map(function(n){ return '<option'+(p.limit===n?' selected':'')+'>'+n+'</option>'; }).join('')+'</select>'
     +'<button class="gs-tb" id="lq-go">Query</button>';
  }
  tb.innerHTML=h;
  $('tb-undo').onclick=doUndo; $('tb-redo').onclick=doRedo;
  $('tb-filter').onclick=function(){ if(T.sel) openFilterPanel(T.activeC, 300, 160); };
  $('tb-clearf').onclick=function(){ T.filters={}; T.sortBy=null; rebuildView(T); clampSel(); syncUrl(true); renderAll(); };
  $('tb-run').onclick=function(){ if(T.kind!=='user'){ toast('Runs write into editable sheets — File → Duplicate tab to new sheet'); return; } openRunPanel(); };
  $('tb-csv').onclick=downloadCsv;
  $('tb-refresh').onclick=function(){ loadTab(T,true); };
  $('tb-help').onclick=showHelp;
  if(T.kind==='ledger'){
    $('lq-go').onclick=function(){
      T.ledParams={key:$('lq-key').value.trim(), q:$('lq-q').value.trim(), trace_id:$('lq-trace').value.trim(), limit:$('lq-limit').value};
      loadTab(T,true);
    };
  }
}

/* ═══════════════════ file ops ═══════════════════ */
function createNewSheet(){
  var name=window.prompt('Sheet name','Sheet '+(TABS.filter(function(t){return t.kind==='user';}).length+1));
  if(name==null) return;
  jfetch('/api/sheets',{method:'POST',body:{title:name||'Untitled sheet'}}).then(function(res){
    if(!res.ok||!res.j.ok){ toast('Create failed: '+((res.j&&res.j.error)||res.status)); return; }
    var sh=res.j.sheet;
    TABS.push({kind:'user',id:sh.id,title:sh.title});
    switchTab(sh.id);
  });
}
function deleteThisSheet(){
  if(T.kind!=='user') return;
  if(!window.confirm('Delete sheet "'+T.title+'" and all its cells?')) return;
  jfetch('/api/sheets/'+encodeURIComponent(T.id),{method:'DELETE'}).then(function(){
    TABS=TABS.filter(function(t){ return t.id!==T.id; });
    delete TSTATES[T.id];
    switchTab('directory');
  });
}
function duplicateToSheet(){
  var src=T;
  var name=window.prompt('New sheet name', src.title+' copy');
  if(name==null) return;
  jfetch('/api/sheets',{method:'POST',body:{title:name}}).then(function(res){
    if(!res.ok||!res.j.ok){ toast('Create failed'); return; }
    var sh=res.j.sheet;
    var rows=[];
    if(src.fields) rows.push(src.fields.map(function(f){ return f; }));
    var cap=Math.min(src.view.length, 500);
    for(var v=0;v<cap;v++){ var dr=src.view[v];
      rows.push(src.colOrder.map(function(dc){ return cellVal(src,dr,dc); })); }
    var chunks=[]; var per=Math.max(1, Math.floor(380/Math.max(1,rows[0].length)));
    for(var i=0;i<rows.length;i+=per) chunks.push({at:i+1, vals:rows.slice(i,i+per)});
    var chain=Promise.resolve();
    chunks.forEach(function(ch){ chain=chain.then(function(){
      return jfetch('/api/sheets/'+encodeURIComponent(sh.id)+'/values/A'+ch.at,{method:'PUT',body:{values:ch.vals}}); }); });
    chain.then(function(){
      TABS.push({kind:'user',id:sh.id,title:sh.title});
      switchTab(sh.id);
      toast('Copied '+cap+' rows'+(src.view.length>cap?' (first 500)':''));
    });
  });
}
function importCsv(){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='.csv,.tsv,text/csv';
  inp.onchange=function(){
    var f=inp.files[0]; if(!f) return;
    var rd=new FileReader();
    rd.onload=function(){
      var text=String(rd.result||'');
      var rows=parseCsv(text);
      if(!rows.length){ toast('Empty CSV'); return; }
      jfetch('/api/sheets',{method:'POST',body:{title:f.name.replace(/\\.[^.]+$/,'')}}).then(function(res){
        if(!res.ok||!res.j.ok){ toast('Create failed'); return; }
        var sh=res.j.sheet;
        var per=Math.max(1, Math.floor(380/Math.max(1,rows[0].length)));
        var chain=Promise.resolve();
        for(var i=0;i<Math.min(rows.length, 5000);i+=per){ (function(at,vals){
          chain=chain.then(function(){ return jfetch('/api/sheets/'+encodeURIComponent(sh.id)+'/values/A'+at,{method:'PUT',body:{values:vals}}); });
        })(i+1, rows.slice(i,i+per)); }
        chain.then(function(){ TABS.push({kind:'user',id:sh.id,title:sh.title}); switchTab(sh.id); toast('Imported '+Math.min(rows.length,5000)+' rows'); });
      });
    };
    rd.readAsText(f);
  };
  inp.click();
}
function parseCsv(text){
  var rows=[], row=[], cur='', inQ=false;
  for(var i=0;i<text.length;i++){ var ch=text[i];
    if(inQ){ if(ch==='"'){ if(text[i+1]==='"'){ cur+='"'; i++; } else inQ=false; } else cur+=ch; }
    else if(ch==='"') inQ=true;
    else if(ch===','){ row.push(cur); cur=''; }
    else if(ch==='\\n'||ch==='\\r'){ if(ch==='\\r'&&text[i+1]==='\\n') i++;
      row.push(cur); cur=''; rows.push(row); row=[]; }
    else cur+=ch; }
  if(cur!==''||row.length){ row.push(cur); rows.push(row); }
  return rows.filter(function(r){ return r.length>1||r[0]!==''; });
}
function downloadCsv(){
  if(T.kind==='user'){ location.href='/api/sheets/'+encodeURIComponent(T.id)+'/export.csv'; return; }
  var rows=[];
  if(T.fields) rows.push(T.colOrder.map(function(dc){ return T.fields[dc]; }));
  for(var v=0;v<T.view.length;v++){ var dr=T.view[v];
    rows.push(T.colOrder.map(function(dc){ return cellVal(T,dr,dc); })); }
  var csv=rows.map(function(r){ return r.map(function(x){ return /[",\\n\\r]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x; }).join(','); }).join('\\r\\n');
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download=T.title.toLowerCase()+'.csv'; a.click();
}

/* ═══════════════════ run panel ═══════════════════ */
var RUN={going:false, stop:false};
function nextEmptyCols(n){
  var used=0;
  for(var c=0;c<T.nCols;c++){ for(var r=0;r<T.vals.length;r++){ if(cellVal(T,r,c)!==''){ if(c+1>used) used=c+1; break; } } }
  var out=[]; for(var i=1;i<=n;i++) out.push(colLetter(used+i));
  return out;
}
function openRunPanel(){
  if(T.kind!=='user'){ toast('Runs write into editable sheets'); return; }
  var rp=$('gs-runpanel');
  var defs=nextEmptyCols(3);
  var cfgs=T.runs||[];
  rp.innerHTML='<div class="rp-head">▶ Model run <button class="rp-x" id="rp-x">✕</button></div>'
   +'<div class="rp-body">'
   +'<div class="rp-row"><label>Saved versions</label><div style="display:flex;gap:6px">'
   +'<select id="rp-cfg" style="flex:1"><option value="">— new configuration —</option>'
   +cfgs.map(function(c){ return '<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>'; }).join('')+'</select>'
   +'<button class="gs-btn" id="rp-delcfg" title="Delete selected version">🗑</button></div></div>'
   +'<div class="rp-row"><label>Mode</label><select id="rp-mode">'
   +'<option value="template">Template — build the call per row</option>'
   +'<option value="raw">Raw — input column holds the full JSON call object</option></select></div>'
   +'<div class="rp-row rp-grid2"><span><label>Model (alias or gateway id)</label><input type="text" id="rp-model" list="rp-models" value="grok" placeholder="grok"></span>'
   +'<span><label>or directory key (agent row)</label><input type="text" id="rp-key" list="rp-keys" placeholder=""></span></div>'
   +'<datalist id="rp-models"></datalist><datalist id="rp-keys"></datalist>'
   +'<div class="rp-row" id="rp-sysrow"><label>System prompt (this run only — saved into the version, never into code)</label><textarea id="rp-system" placeholder="optional; the directory key already carries one"></textarea></div>'
   +'<div class="rp-row" id="rp-promptrow"><label>Prompt template — {{A}}…{{Z}} = that row&#39;s cell, {{input}} = input column</label><textarea id="rp-prompt" placeholder="{{input}}"></textarea></div>'
   +'<div class="rp-row rp-grid2"><span><label>Input column</label><input type="text" id="rp-incol" value="A"></span>'
   +'<span><label>Rows</label><input type="text" id="rp-rows" placeholder="auto = every row with input"></span></div>'
   +'<div class="rp-row rp-grid3"><span><label>Request → col</label><input type="text" id="rp-reqcol" value="'+defs[0]+'"></span>'
   +'<span><label>Raw response → col</label><input type="text" id="rp-rescol" value="'+defs[1]+'"></span>'
   +'<span><label>Text → col</label><input type="text" id="rp-txtcol" value="'+defs[2]+'"></span></div>'
   +'<div class="rp-row rp-grid3"><span><label>temperature</label><input type="number" id="rp-temp" step="0.1" placeholder="provider"></span>'
   +'<span><label>max_tokens</label><input type="number" id="rp-maxtok" value="1024"></span>'
   +'<span><label>timeout_ms</label><input type="number" id="rp-timeout" value="25000"></span></div>'
   +'<div class="rp-row rp-grid3"><span><label>top_p</label><input type="number" id="rp-topp" step="0.05" placeholder=""></span>'
   +'<span><label>seed</label><input type="number" id="rp-seed" placeholder=""></span>'
   +'<span><label>json mode</label><select id="rp-json"><option value="">off</option><option value="1">on</option></select></span></div>'
   +'<div class="rp-row"><label>Version name (Save stores it as a reusable v-row)</label><input type="text" id="rp-name" value="v'+(cfgs.length+1)+'"></div>'
   +'</div>'
   +'<div class="rp-foot">'
   +'<button class="gs-btn pri" id="rp-run">▶ Run</button>'
   +'<button class="gs-btn" id="rp-shape" title="Write the exact request JSON without sending">Shape only</button>'
   +'<button class="gs-btn" id="rp-save">Save version</button>'
   +'<button class="gs-btn" id="rp-stop" disabled>Stop</button>'
   +'<span id="gs-runprog"></span></div>';
  rp.classList.add('open');
  $('rp-x').onclick=function(){ rp.classList.remove('open'); };
  jfetch('/api/models').then(function(res){
    var list=[]; var j=res.j||{};
    ['grok','kimi','glm','fast','gpt','opus5','sonnet5'].forEach(function(a){ list.push(a); });
    (j.models||j.rows||[]).forEach(function(m){ var id=m.id||m.model||m.name; if(id) list.push(id); });
    $('rp-models').innerHTML=list.map(function(m){ return '<option value="'+esc(m)+'">'; }).join('');
  });
  jfetch('/api/directory?type=agent').then(function(res){
    $('rp-keys').innerHTML=((res.j&&res.j.rows)||[]).map(function(r){ return '<option value="'+esc(r.key)+'">'; }).join('');
  });
  $('rp-mode').onchange=function(){
    var raw=this.value==='raw';
    $('rp-promptrow').style.display=raw?'none':'';
    $('rp-sysrow').style.display=raw?'none':'';
  };
  $('rp-cfg').onchange=function(){
    var c=(T.runs||[]).filter(function(x){ return x.id===$('rp-cfg').value; })[0];
    if(!c) return;
    var g=c.config||{};
    $('rp-mode').value=g.mode||'template'; $('rp-mode').onchange.call($('rp-mode'));
    $('rp-model').value=g.model||''; $('rp-key').value=g.key||'';
    $('rp-system').value=g.system||''; $('rp-prompt').value=g.prompt||'';
    $('rp-incol').value=g.input_col||'A';
    $('rp-reqcol').value=g.request_col||''; $('rp-rescol').value=g.response_col||''; $('rp-txtcol').value=g.text_col||'';
    $('rp-temp').value=g.temperature!=null?g.temperature:''; $('rp-maxtok').value=g.max_tokens||1024;
    $('rp-timeout').value=g.timeout_ms||25000; $('rp-topp').value=g.top_p!=null?g.top_p:''; $('rp-seed').value=g.seed!=null?g.seed:'';
    $('rp-json').value=g.json?'1':'';
    $('rp-name').value=c.name;
  };
  $('rp-delcfg').onclick=function(){
    var id=$('rp-cfg').value; if(!id) return;
    jfetch('/api/sheets/'+encodeURIComponent(T.id)+'/runs/'+encodeURIComponent(id),{method:'DELETE'}).then(function(){
      T.runs=T.runs.filter(function(x){ return x.id!==id; }); openRunPanel(); });
  };
  function readConfig(){
    var cfg={ mode:$('rp-mode').value, input_col:$('rp-incol').value.trim()||'A' };
    ['request_col','response_col','text_col'].forEach(function(k,i){
      var v=[$('rp-reqcol'),$('rp-rescol'),$('rp-txtcol')][i].value.trim(); if(v) cfg[k]=v.toUpperCase(); });
    if($('rp-model').value.trim()) cfg.model=$('rp-model').value.trim();
    if($('rp-key').value.trim()) cfg.key=$('rp-key').value.trim();
    if($('rp-system').value.trim()) cfg.system=$('rp-system').value;
    if($('rp-prompt').value.trim()) cfg.prompt=$('rp-prompt').value;
    if($('rp-temp').value!=='') cfg.temperature=Number($('rp-temp').value);
    if($('rp-maxtok').value!=='') cfg.max_tokens=Number($('rp-maxtok').value);
    if($('rp-timeout').value!=='') cfg.timeout_ms=Number($('rp-timeout').value);
    if($('rp-topp').value!=='') cfg.top_p=Number($('rp-topp').value);
    if($('rp-seed').value!=='') cfg.seed=Number($('rp-seed').value);
    if($('rp-json').value) cfg.json=true;
    return cfg;
  }
  function targetRows(cfg){
    var manual=$('rp-rows').value.trim();
    if(manual){
      var out=[];
      manual.split(',').forEach(function(part){
        var m=part.trim().match(/^(\\d+)(?:-(\\d+))?$/); if(!m) return;
        var a=Number(m[1]), b=m[2]?Number(m[2]):a;
        for(var r=a;r<=b;r++) out.push(r);
      });
      return out;
    }
    var inC=letterCol(cfg.input_col)-1, out2=[];
    for(var dr=0;dr<T.vals.length;dr++) if(cellVal(T,dr,inC)!=='') out2.push(dr+1);
    return out2;
  }
  function doRun(shapeOnly){
    if(RUN.going) return;
    var cfg=readConfig();
    if(!shapeOnly&&!cfg.text_col&&!cfg.response_col){ toast('Set a text or response output column'); return; }
    var rows=targetRows(cfg);
    if(!rows.length){ toast('No rows to run — fill the input column or set Rows'); return; }
    RUN.going=true; RUN.stop=false;
    $('rp-run').disabled=true; $('rp-shape').disabled=true; $('rp-stop').disabled=false;
    var done=0, okN=0, chunks=[];
    for(var i=0;i<rows.length;i+=10) chunks.push(rows.slice(i,i+10));
    $('gs-runprog').textContent='0 / '+rows.length;
    var chain=Promise.resolve();
    chunks.forEach(function(ch){
      chain=chain.then(function(){
        if(RUN.stop) return;
        return jfetch('/api/sheets/'+encodeURIComponent(T.id)+'/run-row',{method:'POST',body:{config:cfg, rows:ch, shape:!!shapeOnly}})
          .then(function(res){
            done+=ch.length;
            if(res.ok&&res.j&&res.j.rows) okN+=res.j.rows.filter(function(r){ return r.ok; }).length;
            $('gs-runprog').textContent=done+' / '+rows.length+(RUN.stop?' (stopped)':'');
            return loadTab(T,true);
          });
      });
    });
    chain.then(function(){
      RUN.going=false;
      $('rp-run').disabled=false; $('rp-shape').disabled=false; $('rp-stop').disabled=true;
      $('gs-runprog').textContent=done+' / '+rows.length+' · '+okN+' ok';
      toast(shapeOnly?('Shaped '+done+' request objects'):('Run complete: '+okN+' / '+done+' ok'));
    });
  }
  $('rp-run').onclick=function(){ doRun(false); };
  $('rp-shape').onclick=function(){ doRun(true); };
  $('rp-stop').onclick=function(){ RUN.stop=true; };
  $('rp-save').onclick=function(){
    var cfg=readConfig(), name=$('rp-name').value.trim()||'v1';
    var selId=$('rp-cfg').value||null;
    jfetch('/api/sheets/'+encodeURIComponent(T.id)+'/runs'+(selId?'/'+encodeURIComponent(selId):''),
      {method:selId?'PATCH':'POST', body:{name:name, config:cfg}}).then(function(res){
      if(res.ok){ toast('Saved '+name);
        jfetch('/api/sheets/'+encodeURIComponent(T.id)).then(function(r2){ if(r2.ok){ T.runs=r2.j.runs||[]; } }); }
      else toast('Save failed');
    });
  };
}

/* ═══════════════════ tabs ═══════════════════ */
function renderTabs(){
  var el=$('gs-tabs');
  var navHtml=NAVTABS.map(function(t){
    var href=t.href; if(TOKQ) href+=(href.indexOf('?')>=0?'&':'?')+TOKQ;
    return '<a class="gs-tab nav" href="'+esc(href)+'">'+esc(t.label)+'</a>';
  }).join('');
  el.innerHTML=TABS.map(function(t){
    return '<div class="gs-tab'+(T&&T.id===t.id?' on':'')+'" data-id="'+esc(t.id)+'">'+esc(t.title)
      +((t.kind==='ledger'||t.kind==='turns'||t.kind==='forum')?'<span class="lock" title="read-only projection">🔒</span>':'')+'</div>';
  }).join('')+(navHtml?'<span class="gs-tabdiv"></span>'+navHtml:'');
  el.querySelectorAll('.gs-tab').forEach(function(tab){
    tab.onclick=function(){ switchTab(tab.getAttribute('data-id')); };
    tab.ondblclick=function(){
      var id=tab.getAttribute('data-id'); var t=TABS.filter(function(x){ return x.id===id; })[0];
      if(t.kind!=='user') return;
      var name=window.prompt('Rename sheet', t.title); if(name==null||!name.trim()) return;
      t.title=name.trim();
      jfetch('/api/sheets/'+encodeURIComponent(id),{method:'PATCH',body:{title:t.title}});
      if(TSTATES[id]) TSTATES[id].title=t.title;
      renderTabs(); if(T.id===id){ T.title=t.title; syncTitle(); }
    };
    tab.oncontextmenu=function(e){
      e.preventDefault();
      var id=tab.getAttribute('data-id'); var t=TABS.filter(function(x){ return x.id===id; })[0];
      var items=[{label:'Open',fn:function(){ switchTab(id); }}];
      if(t.kind==='user'){
        items.push({label:'Rename',fn:function(){ tab.ondblclick(); }});
        items.push({label:'Delete',fn:function(){ switchTab(id); deleteThisSheet(); }});
      } else {
        items.push({label:'Classic view ↗',fn:function(){ location.href='/admin/'+id+'?view=classic'; }});
      }
      menu(items,e.clientX,e.clientY-10);
    };
  });
}
$('gs-addtab').onclick=createNewSheet;
$('gs-alltabs').onclick=function(e){
  menu(TABS.map(function(t){ return {label:t.title,fn:function(){ switchTab(t.id); }}; }), e.clientX, e.clientY-10-TABS.length*28);
};
function switchTab(id){
  var tab=TABS.filter(function(t){ return t.id===id; })[0]||TABS[0];
  if(!TSTATES[tab.id]) TSTATES[tab.id]=newState(tab);
  T=TSTATES[tab.id];
  $('gs-runpanel').classList.remove('open');
  syncUrl(true); // a tab tap is its own link
  // keep the shell nav honest when the sheet under it changes
  try{ var navPath=(stateUrl()||'').split('?')[0];
    document.querySelectorAll('header .tab-row a').forEach(function(a2){
      a2.classList.toggle('active', a2.getAttribute('href')===navPath || (tab.kind==='user'&&a2.getAttribute('href')==='/admin/sheets')); });
  }catch(e){}
  var ld=$('gs-loading'); if(ld) ld.style.display = T.loaded ? 'none' : ld.style.display;
  renderMenubar(); renderToolbar(); renderTabs();
  var done=loadTab(T).then(function(){ var l2=$('gs-loading'); if(l2&&T.loaded) l2.style.display='none'; clampSel(); renderAll(); });
  renderAll();
  return done;
}

/* ═══════════════════ help ═══════════════════ */
function showHelp(){
  var hp=$('gs-help-body');
  hp.innerHTML='<h2>This backend is a spreadsheet</h2>'
  +'<p style="font-size:13px;color:#5f6368">Every tab is one sheet. Directory and Ledger are live projections of the build&#39;s tables; sheets you add store their cells in D1 and are fully editable. Everything on screen has a REST twin — Help → REST for this sheet.</p>'
  +'<h3>Keyboard</h3><table>'
  +[['Arrows / Tab / Enter','Move · commit'],['⌘+Arrow','Jump to data edge'],['Shift+Arrows','Extend selection'],['Type / Enter / F2','Edit cell'],['Alt+Enter','New line inside a cell'],['⌘C / ⌘V','Copy / paste (TSV, works with real Google Sheets)'],['Delete','Clear values'],['⌘Z / ⌘⇧Z','Undo / redo'],['⌘F','Find'],['Right-click','Row / column / cell menus'],['Drag column header','Reorder columns'],['Drag header edge','Resize column'],['Drag fill handle','Fill down/right (numeric series supported)']]
    .map(function(r){ return '<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>'; }).join('')
  +'</table>'
  +'<h3>The three sheet kinds</h3><table>'
  +'<tr><td>Directory</td><td>One row = one capability. Cells PATCH <code>/api/directory/&lt;key&gt;</code> on commit; a draft row POSTs when key + type are filled; deletes DELETE. <code>key</code> is the primary key (read-only on existing rows).</td></tr>'
  +'<tr><td>Ledger</td><td>Append-only event chain — read-only cells, full filter/sort, server query in the toolbar, right-click a row for the full raw event.</td></tr>'
  +'<tr><td>Your sheets</td><td>A1-addressable grids in D1. Insert/delete/move rows and columns, and run models over rows (▶ Run model).</td></tr>'
  +'</table>'
  +'<div class="gs-fbtns"><button class="gs-btn" id="gs-h-rest">REST for this sheet</button><button class="gs-btn pri" id="gs-h-x">Close</button></div>';
  $('gs-help').style.display='flex';
  $('gs-h-x').onclick=function(){ $('gs-help').style.display='none'; };
  $('gs-h-rest').onclick=showRest;
}
function showRest(){
  var hp=$('gs-help-body'), base=location.origin, ex='';
  if(T.kind==='directory'){
    ex='# list rows (public read)\\ncurl '+base+'/api/directory\\n\\n'
      +'# read one\\ncurl '+base+'/api/directory/ROUTER\\n\\n'
      +'# edit a cell (field = column name)\\ncurl -X PATCH '+base+'/api/directory/&lt;key&gt; \\\\\\n  -H "authorization: Bearer $TERMINAL_KEY" -H "content-type: application/json" \\\\\\n  -d &#39;{"category":"llm"}&#39;\\n\\n'
      +'# new row\\ncurl -X POST '+base+'/api/directory -H "authorization: Bearer $TERMINAL_KEY" \\\\\\n  -d &#39;{"key":"MY_TOOL","type":"http","target":"GET https://…"}&#39;';
  } else if(T.kind==='ledger'){
    ex='# rows this grid shows (same filters)\\ncurl -H "authorization: Bearer $TERMINAL_KEY" \\\\\\n  "'+base+'/admin/ledger?data=1&limit=500&key=&q=&trace_id="\\n\\n'
      +'# one full raw event\\ncurl -H "authorization: Bearer $TERMINAL_KEY" "'+base+'/admin/ledger/&lt;id&gt;?data=1"\\n\\n# the chain is append-only: there is no write lane.';
  } else {
    var sid=encodeURIComponent(T.id);
    ex='# read a range\\ncurl -H "authorization: Bearer $TERMINAL_KEY" '+base+'/api/sheets/'+sid+'/values/A1:C10\\n\\n'
      +'# write cells anchored at B3\\ncurl -X PUT '+base+'/api/sheets/'+sid+'/values/B3 \\\\\\n  -H "authorization: Bearer $TERMINAL_KEY" -H "content-type: application/json" \\\\\\n  -d &#39;{"values":[["hello","world"]]}&#39;\\n\\n'
      +'# append a row\\ncurl -X POST '+base+'/api/sheets/'+sid+'/values:append -H "authorization: Bearer $TERMINAL_KEY" \\\\\\n  -d &#39;{"values":[["new","row"]]}&#39;\\n\\n'
      +'# insert / delete / move\\ncurl -X POST '+base+'/api/sheets/'+sid+'/batch -H "authorization: Bearer $TERMINAL_KEY" \\\\\\n  -d &#39;{"requests":[{"op":"insert_rows","at":2,"n":1}]}&#39;\\n\\n'
      +'# run a model over rows 2-4 (request JSON → B, raw response → C, text → D)\\ncurl -X POST '+base+'/api/sheets/'+sid+'/run-row -H "authorization: Bearer $TERMINAL_KEY" \\\\\\n  -d &#39;{"config":{"mode":"template","input_col":"A","request_col":"B","response_col":"C","text_col":"D","model":"grok","max_tokens":512},"rows":[2,3,4]}&#39;\\n\\n'
      +'# export\\ncurl -H "authorization: Bearer $TERMINAL_KEY" -o sheet.csv '+base+'/api/sheets/'+sid+'/export.csv';
  }
  hp.innerHTML='<h2>REST — '+esc(T.title)+'</h2>'
    +'<p style="font-size:12.5px;color:#5f6368">Full contract: <a href="/api/sheets" target="_blank">'+base+'/api/sheets</a> · invoke fields: <a href="/api/invoke?fields=1" target="_blank">/api/invoke?fields=1</a></p>'
    +'<pre>'+ex+'</pre>'
    +'<div class="gs-fbtns"><button class="gs-btn pri" id="gs-h-x2">Close</button></div>';
  $('gs-help').style.display='flex';
  $('gs-h-x2').onclick=function(){ $('gs-help').style.display='none'; };
}
$('gs-help').addEventListener('mousedown',function(e){ if(e.target===this) this.style.display='none'; });

/* ═══════════════════ boot ═══════════════════ */
scrollEl=$('gs-scroll'); canvasEl=$('gs-canvas'); rowheadsInner=$('gs-rowheads-inner'); colheadsInner=$('gs-colheads-inner');
var ed=$('gs-editor');
ed.addEventListener('blur',function(){ setTimeout(function(){ if(document.activeElement!==ed) closeEditor(true); },0); });
wireGrid();
// The workbook fills the viewport under whatever the shell header actually measures —
// the fixed calc() left the tab strip below the fold on tall headers.
function fitHeight(){
  var wb=document.getElementById('ms-sheets-workbook');
  var top=wb.getBoundingClientRect().top + (window.pageYOffset||document.documentElement.scrollTop||0);
  wb.style.height=Math.max(430, window.innerHeight - top) + 'px';
}
fitHeight();
setTimeout(fitHeight, 250);
window.addEventListener('resize',function(){ fitHeight(); renderRows(); renderSel(); });

// Boot without waiting on the network: user tabs from the last visit paint immediately
// (localStorage), the live list replaces them when it arrives, and the wanted tab loads
// straight from its cached grid. The URL's own state (kind/sort/filters/id) applies after
// the first load, so a pasted link restores the exact view.
try{ (JSON.parse(localStorage.getItem('gs_user_tabs_v1')||'[]')||[]).forEach(function(s){
  if(s&&s.id&&!TABS.some(function(t){ return t.id===s.id; })) TABS.push({kind:'user',id:String(s.id),title:String(s.title||s.id)});
}); }catch(e){}
var want=document.getElementById('ms-sheets-workbook').getAttribute('data-active-tab')||'directory';
var qsTab=new URLSearchParams(location.search).get('tab');
if(qsTab) want=qsTab;
if(!TABS.some(function(t){ return t.id===want; })) TABS.push({kind:'user',id:want,title:want});
(switchTab(want)||Promise.resolve()).then(function(){
  URLSYNC.suppress=false;
  applyUrlState();
  URLSYNC.last=''; syncUrl(false);
}).catch(function(){ URLSYNC.suppress=false; });
jfetch('/api/sheets').then(function(res){
  if(noteAuthFailure(res)) return;
  var live=((res.j&&res.j.sheets)||[]);
  live.forEach(function(s){ if(!TABS.some(function(t){ return t.id===s.id; })) TABS.push({kind:'user',id:s.id,title:s.title}); });
  try{ localStorage.setItem('gs_user_tabs_v1', JSON.stringify(live.map(function(s){ return {id:s.id,title:s.title}; }))); }catch(e){}
  renderTabs();
});
// Back/forward walk the taps: every pushState above is a real history entry.
window.addEventListener('popstate', function(){
  URLSYNC.suppress=true;
  var path=location.pathname;
  var p=new URLSearchParams(location.search);
  var wantNow = path.indexOf('/admin/ledger')===0 ? 'ledger'
    : path.indexOf('/admin/directory')===0 ? 'directory'
    : (p.get('tab')||'directory');
  var pr=(T&&T.id===wantNow) ? Promise.resolve() : (switchTab(wantNow)||Promise.resolve());
  pr.then(function(){
    if(T){ T.kindFilter=''; T.sortBy=null; T.filters={}; applyUrlState(); }
    URLSYNC.suppress=false; URLSYNC.last=location.pathname+location.search;
  }).catch(function(){ URLSYNC.suppress=false; });
});
})();
</script>
`;
  return new Response(shellHtml({ activeHref, title: 'Sheets', body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const tab = url.searchParams.get('tab') || 'directory';
  return workbookResponse(tab, '/admin/sheets');
}
