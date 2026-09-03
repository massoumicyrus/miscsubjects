/******************************************************************
 * ARTICLE WRITER — Google Apps Script for Sheets
 * One tab "WRITE". Columns:
 *   slug | title | about | system_prompt | images_links | embed_slug | run | status | link
 *
 * about         = what the article is about (your direction)
 * system_prompt = the writer's system prompt for THIS row (your control)
 * images_links  = format for images + hyperlinks (prefilled; edit freely)
 * embed_slug    = optional: another row's slug — its JSON is handed to the writer
 * run           = put x to write this row
 *
 * Per flagged row: sets the writer's prompt to yours → tells it topic + image/link
 * format + roster of all articles so they cross-link + any embedded article JSON →
 * writer writes and publishes via ARTICLE_PUT → texts you the link via Blooio.
 * Re-run a row to edit it (texts you again).
 *
 * Menu: "Articles" → Build sheet / Write flagged rows.
 ******************************************************************/
var BASE  = 'https://miscsubjects.com';
var PHONE = '[OWNER_PHONE]';     // who gets the Blooio link
var WRITER = 'KIMI_WRITER';     // the writing agent

function aw_key() { var p = PropertiesService.getScriptProperties(); return p.getProperty('TERMINAL_KEY') || ''; }
function aw_H(){ return {'x-terminal-key':aw_key(),'content-type':'application/json'}; }

function onOpen(){
  SpreadsheetApp.getUi().createMenu('Articles')
    .addItem('Build / reset the WRITE sheet','aw_build')
    .addItem('Write flagged rows (x in run)','aw_run')
    .addToUi();
}

function aw_req(m,p,b){
  var o={method:m,headers:aw_H(),muteHttpExceptions:true};
  if(b!=null)o.payload=JSON.stringify(b);
  try{ var r=UrlFetchApp.fetch(BASE+p,o); var t=r.getContentText(); var j; try{j=JSON.parse(t);}catch(e){j=null;}
       return {code:r.getResponseCode(),text:t,json:j}; }
  catch(e){ return {code:0,text:String(e),json:null}; }
}
function aw_strip(s){ s=String(s==null?'':s); var m=s.match(/\[REPLY\]([\s\S]*?)\[\/REPLY\]/); return (m?m[1]:s.replace(/\[\/?[A-Z_]+\]/g,'')).trim(); }
function aw_ss(){ return SpreadsheetApp.getActive(); }

var AW_HEAD=['slug','title','about','system_prompt','images_links','embed_slug','run','status','link'];
var AW_FORMAT='Images: put ![caption](https://your-image-url.jpg) on its own line. '+
  'Link to another of my articles: [anchor text](/a/other-slug). '+
  'External link: [text](https://site.com). Use ## for subheads, **bold** for key facts.';

function aw_build(){
  var sh=aw_ss().getSheetByName('WRITE')||aw_ss().insertSheet('WRITE'); sh.clear();
  sh.getRange(1,1,1,AW_HEAD.length).setValues([AW_HEAD]).setFontWeight('bold'); sh.setFrozenRows(1);
  var ex=[
    ['bpc-157','BPC-157','What BPC-157 is and the gut-repair research, for someone on Ozempic.',
     'You are a precise health writer. Short lines. Every line teaches or gives a number. Label study vs anecdotal. No medical claims — say studied for / in rat models.',
     AW_FORMAT,'','x','',''],
    ['tb-500','TB-500','What TB-500 is and recovery research; link back to the BPC-157 article.',
     'Same voice as the BPC-157 article. Cross-link to /a/bpc-157.',
     AW_FORMAT,'bpc-157','','','']
  ];
  sh.getRange(2,1,ex.length,AW_HEAD.length).setValues(ex);
  sh.getRange(2,7,500,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['x',''],true).build());
  sh.setColumnWidth(3,300); sh.setColumnWidth(4,360); sh.setColumnWidth(5,360); sh.setColumnWidth(9,300);
  aw_ss().toast('WRITE ready. Fill rows, x in run, then Articles > Write flagged rows.');
}

function aw_run(){
  var sh=aw_ss().getSheetByName('WRITE'); if(!sh){ aw_build(); return; }
  var d=sh.getDataRange().getValues();
  // roster of all articles in the sheet, so they can link back to one another
  var roster=[];
  for(var i=1;i<d.length;i++){ if(d[i][0]) roster.push('- /a/'+String(d[i][0]).trim()+' ('+String(d[i][1]||'').trim()+')'); }
  var rosterStr=roster.join('\n');
  var n=0;
  for(var r=1;r<d.length;r++){
    if(String(d[r][6]||'').toLowerCase().trim()!=='x') continue;
    var slug=String(d[r][0]||'').trim(), title=String(d[r][1]||'').trim(),
        about=String(d[r][2]||''), sys=String(d[r][3]||''),
        fmt=String(d[r][4]||AW_FORMAT), embed=String(d[r][5]||'').trim();
    if(!slug||!title){ sh.getRange(r+1,8).setValue('need slug + title'); sh.getRange(r+1,7).setValue(''); continue; }

    // 1. set the writer's system prompt to YOUR row's prompt
    if(sys) aw_req('PATCH','/api/directory/'+WRITER,{content:sys});

    // 2. optional: pull another article as a JSON object to embed/reference
    var embedJson='';
    if(embed){ var e=aw_req('GET','/api/articles/'+embed); if(e.code===200) embedJson=e.text; }

    // 3. tell the writer everything, it writes + publishes via ARTICLE_PUT
    var body='Write ONE complete article and SAVE it via ARTICLE_PUT.\n'+
      'slug: '+slug+'\ntitle: '+title+'\nABOUT: '+about+'\n\n'+
      'IMAGE & LINK FORMAT (follow exactly):\n'+fmt+'\n\n'+
      'LINK BACK to my other articles where relevant, with [text](/a/<slug>):\n'+rosterStr+'\n\n'+
      (embedJson?('EMBED / reference this article (JSON object):\n'+embedJson+'\n\n'):'')+
      'Save: [ARTICLE_PUT]{"slug":"'+slug+'","title":"'+title+'","body":"<full markdown>"}[/ARTICLE_PUT] then reply with the link.';
    var resp=aw_req('POST','/api/dispatch',{key:WRITER,body:body});

    // 4. confirm it published, then text YOU the link via Blooio
    var chk=aw_req('GET','/api/articles/'+slug);
    var link=BASE+'/a/'+slug;
    if(chk.code===200){
      aw_req('POST','/api/dispatch',{key:'SEND_BY_CHANNEL',body:'blooio|'+PHONE+'|Article ready: '+title+' — '+link});
      sh.getRange(r+1,8).setValue('written + texted');
      sh.getRange(r+1,9).setValue(link);
    } else {
      sh.getRange(r+1,8).setValue('writer ran but not saved — '+aw_strip(resp.json&&resp.json.result));
    }
    sh.getRange(r+1,7).setValue('');
    n++; SpreadsheetApp.flush();
  }
  aw_ss().toast(n?('Wrote '+n+' article(s); links texted to '+PHONE):'No rows had x in run.');
}
