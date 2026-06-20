use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Listener, Manager};

// 抓取列表:在 BOSS 搜索页注入,等卡片+__TAURI__ 就绪后用 IPC 事件回传。
const SCRAPE_LIST_JS: &str = r#"(function(){
  var tries=0;
  function pick(el,sels){for(var i=0;i<sels.length;i++){var n=el.querySelector(sels[i]);if(n&&n.innerText)return n.innerText.trim();}return '';}
  function emit(ev,data){try{window.__TAURI__.event.emit(ev,data);}catch(e){}}
  function go(){
    try{
      if(!window.__TAURI__||!window.__TAURI__.event){if(tries<30){tries++;return setTimeout(go,400);}return;}
      var cards=document.querySelectorAll('li.job-card-box, li.job-card-wrapper');
      if(cards.length===0 && tries<25){tries++;return setTimeout(go,400);}
      var out=[];
      cards.forEach(function(li){
        var a=li.querySelector('a.job-card-left, a[ka^="search_list"], a');
        var href=a?a.href:'';
        var id='';var m=href.match(/job_detail\/([^.?\/]+)/);if(m)id=m[1];
        out.push({
          id:id, href:href,
          title:pick(li,['.job-name','.job-title','[class*="job-name"]']),
          salary:pick(li,['.job-salary','.salary','[class*="salary"]']),
          company:pick(li,['.boss-name','.company-name','[class*="company-name"]']),
          tags:pick(li,['.tag-list','.job-card-footer'])
        });
      });
      emit('boss-result', out);
    }catch(e){emit('boss-error','list: '+String(e));}
  }
  go();
})();"#;

// 抓取详情页 JD。
const SCRAPE_JD_JS: &str = r#"(function(){
  var tries=0;
  function txt(sels){for(var i=0;i<sels.length;i++){var n=document.querySelector(sels[i]);if(n&&n.innerText)return n.innerText.trim();}return '';}
  function emit(ev,data){try{window.__TAURI__.event.emit(ev,data);}catch(e){}}
  function go(){
    try{
      if(!window.__TAURI__||!window.__TAURI__.event){if(tries<30){tries++;return setTimeout(go,400);}return;}
      var jd=txt(['.job-sec-text','.job-detail-section .text','[class*="job-sec"] .text']);
      if(!jd && tries<25){tries++;return setTimeout(go,400);}
      emit('boss-jd',{
        title:txt(['.job-banner .name h1','.name h1','.job-name','h1']),
        salary:txt(['.job-banner .salary','.salary','[class*="salary"]']),
        company:txt(['.company-info .name','.sider-company .name','[class*="company"] .name']),
        jd:jd
      });
    }catch(e){emit('boss-error','jd: '+String(e));}
  }
  go();
})();"#;

// 打招呼流程:点「立即沟通」→ 处理"已向BOSS发送消息"弹窗点「继续沟通」(可能在 iframe 内)。
// 用完整鼠标事件序列触发,并优先点 button/a 本身(裸 .click() 点外层 div 无效)。
const CLICK_STARTCHAT_JS: &str = r#"(function(){
  function docs(){var a=[document];document.querySelectorAll('iframe').forEach(function(f){try{if(f.contentDocument)a.push(f.contentDocument);}catch(e){}});return a;}
  function fire(el){try{['pointerdown','mousedown','pointerup','mouseup','click'].forEach(function(t){el.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window}));});}catch(e){try{el.click();}catch(_){}}}
  function clickText(s){var ds=docs(),sels=['button','a','span','div'];for(var p=0;p<sels.length;p++){for(var k=0;k<ds.length;k++){var e=ds[k].querySelectorAll(sels[p]);for(var i=0;i<e.length;i++){if(e[i].innerText&&e[i].innerText.trim()===s){var tg=(e[i].closest&&e[i].closest('button,a'))||e[i];fire(tg);return true;}}}}return false;}
  var b=document.querySelector('a.btn-startchat, .btn-startchat, a[ka="job-detail-startchat"]');
  if(b){fire(b);} else { clickText('立即沟通'); }
  var t=0;
  function cont(){ if(clickText('继续沟通'))return; if(t<30){t++;setTimeout(cont,400);} }
  setTimeout(cont, 1000);
})();"#;

// 追发定制招呼语:在主文档+同源 iframe 里找 contenteditable 输入框,
// 拿父级 __vue__ 调 handleSubmit。失败回传诊断。__MSG__ 由 Rust serde_json 注入。
const SEND_MSG_JS: &str = r#"(function(){
  var MSG=__MSG__; var tries=0;
  function emit(ev,d){try{window.__TAURI__.event.emit(ev,d);}catch(e){}}
  function docs(){var a=[document];document.querySelectorAll('iframe').forEach(function(f){try{if(f.contentDocument)a.push(f.contentDocument);}catch(e){}});return a;}
  function fire(el){try{['pointerdown','mousedown','pointerup','mouseup','click'].forEach(function(t){el.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window}));});}catch(e){try{el.click();}catch(_){}}}
  function clickText(s){var ds=docs(),sels=['button','a','span','div'];for(var p=0;p<sels.length;p++){for(var k=0;k<ds.length;k++){var e=ds[k].querySelectorAll(sels[p]);for(var i=0;i<e.length;i++){if(e[i].innerText&&e[i].innerText.trim()===s){var tg=(e[i].closest&&e[i].closest('button,a'))||e[i];fire(tg);return true;}}}}return false;}
  function findInput(){
    var sels=['div.chat-input[contenteditable=true]','div.chat-input[contenteditable]','.chat-input[contenteditable]','.chat-editor [contenteditable=true]','[contenteditable=true]'];
    var ds=docs();
    for(var i=0;i<ds.length;i++){for(var j=0;j<sels.length;j++){var n=ds[i].querySelector(sels[j]);if(n)return {el:n,doc:ds[i]};}}
    return null;
  }
  function diag(){
    var ce=0,cont=false,stay=false;
    docs().forEach(function(d){try{ce+=d.querySelectorAll('[contenteditable]').length;d.querySelectorAll('a,button,span,div').forEach(function(e){var t=e.innerText&&e.innerText.trim();if(t==='继续沟通')cont=true;if(t==='留在此页')stay=true;});}catch(e){}});
    var acc=[];document.querySelectorAll('iframe').forEach(function(f){try{acc.push(!!f.contentDocument);}catch(e){acc.push(false);}});
    return {url:location.href.slice(0,90),startChat:!!document.querySelector('a.btn-startchat,.btn-startchat'),ce:ce,iframesAcc:acc,continueBtn:cont,stayBtn:stay,ta:document.querySelectorAll('textarea').length};
  }
  function go(){
    try{
      if(!window.__TAURI__||!window.__TAURI__.event){if(tries<40){tries++;return setTimeout(go,400);}return;}
      // 兜底:每轮都尝试点掉"继续沟通"弹窗(可能在 iframe 内,可能晚出现)
      clickText('继续沟通');
      var f=findInput();
      if(!f){if(tries<40){tries++;return setTimeout(go,500);}emit('boss-error','未出现聊天输入框 ·诊断:'+JSON.stringify(diag()));return;}
      var ce=f.el, doc=f.doc;
      ce.focus();
      try{doc.execCommand('insertText',false,MSG);}catch(e){ce.textContent=MSG;}
      var n=ce; while(n&&!n.__vue__) n=n.parentElement;
      if(!n||!n.__vue__){emit('boss-error','找到输入框但无 __vue__ ·'+JSON.stringify(diag()));return;}
      n.__vue__.enableSubmit=true; n.__vue__.handleSubmit();
      setTimeout(function(){emit('boss-apply-done',{ok:!ce.innerText.trim()});},900);
    }catch(e){emit('boss-error','send异常: '+String(e));}
  }
  go();
})();"#;

// 抓聊天列表统计回复:总会话数、有新回复(未读)数、明细。失败回传诊断。
const SCRAPE_REPLIES_JS: &str = r#"(function(){
  var tries=0;
  function emit(ev,d){try{window.__TAURI__.event.emit(ev,d);}catch(e){}}
  function pick(el,sels){for(var i=0;i<sels.length;i++){var n=el.querySelector(sels[i]);if(n&&n.innerText)return n.innerText.trim();}return '';}
  function go(){
    try{
      if(!window.__TAURI__||!window.__TAURI__.event){if(tries<30){tries++;return setTimeout(go,400);}return;}
      var items=document.querySelectorAll('.geek-item, ul.geek-list>li, .chat-list li, [role="listitem"], li[ka^="chat_"]');
      if(items.length===0 && tries<25){tries++;return setTimeout(go,500);}
      var out=[],withReply=0;
      items.forEach(function(li){
        var unread=!!li.querySelector('.badge-count, .red-dot, [class*="badge"], [class*="unread"], .notice-dot');
        if(unread)withReply++;
        out.push({
          name:pick(li,['.name','.geek-name','[class*="name"]']),
          last:pick(li,['.push-text','.last-msg','.gray','[class*="last"]','[class*="content"]']).slice(0,40),
          unread:unread
        });
      });
      if(items.length===0){emit('boss-error','聊天列表空 ·诊断:'+JSON.stringify({url:location.href.slice(0,80),lis:document.querySelectorAll('li').length}));return;}
      emit('boss-replies',{total:items.length,withReply:withReply,items:out.slice(0,60)});
    }catch(e){emit('boss-error','replies: '+String(e));}
  }
  go();
})();"#;

fn boss_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window("boss")
        .ok_or_else(|| "BOSS 窗口未打开,请先点「打开 / 登录 BOSS」并登录".to_string())
}

/// 注入脚本后,等待成功事件或 boss-error,带超时。
async fn wait_event(app: &tauri::AppHandle, ok_event: &str) -> Result<String, String> {
    let (tx, rx) = tokio::sync::oneshot::channel::<Result<String, String>>();
    let tx = Arc::new(Mutex::new(Some(tx)));

    let tx_ok = tx.clone();
    let id_ok = app.once(ok_event.to_string(), move |e| {
        if let Some(tx) = tx_ok.lock().unwrap().take() {
            let _ = tx.send(Ok(e.payload().to_string()));
        }
    });
    let tx_err = tx.clone();
    let id_err = app.once("boss-error", move |e| {
        if let Some(tx) = tx_err.lock().unwrap().take() {
            let _ = tx.send(Err(e.payload().to_string()));
        }
    });

    let res = match tokio::time::timeout(Duration::from_secs(25), rx).await {
        Ok(Ok(r)) => r,
        _ => Err("抓取超时(BOSS 页未回传:可能未登录、被风控,或页面结构已变化)".into()),
    };
    app.unlisten(id_ok);
    app.unlisten(id_err);
    res
}

async fn navigate_scrape(
    app: &tauri::AppHandle,
    url: String,
    script: &str,
    ok_event: &str,
) -> Result<String, String> {
    let boss = boss_window(app)?;
    boss.eval(&format!("window.location.href = {:?};", url))
        .map_err(|e| e.to_string())?;
    tokio::time::sleep(Duration::from_millis(1600)).await;
    boss.eval(script).map_err(|e| e.to_string())?;
    wait_event(app, ok_event).await
}

/// 按岗位+城市码搜岗,抓取列表(返回 JSON 数组字符串)。
#[tauri::command]
async fn boss_search(
    app: tauri::AppHandle,
    query: String,
    city: String,
) -> Result<String, String> {
    let url = format!(
        "https://www.zhipin.com/web/geek/jobs?query={}&city={}",
        urlencoding::encode(&query),
        urlencoding::encode(&city)
    );
    navigate_scrape(&app, url, SCRAPE_LIST_JS, "boss-result").await
}

/// 打开某岗位详情页并抓 JD(返回 JSON 对象字符串)。
#[tauri::command]
async fn boss_fetch_jd(app: tauri::AppHandle, url: String) -> Result<String, String> {
    navigate_scrape(&app, url, SCRAPE_JD_JS, "boss-jd").await
}

/// 投递单个岗位:导航详情 → 点立即沟通(打招呼)→ 追发定制招呼语 message。
/// 必须由用户审核后调用。返回 boss-apply-done(含 ok:是否清空=发送成功)。
#[tauri::command]
async fn boss_apply(
    app: tauri::AppHandle,
    url: String,
    message: String,
) -> Result<String, String> {
    let boss = boss_window(&app)?;
    // 1. 导航到详情页
    boss.eval(&format!("window.location.href = {:?};", url))
        .map_err(|e| e.to_string())?;
    tokio::time::sleep(Duration::from_millis(1800)).await;
    // 2. 点「立即沟通」+ 弹窗「继续沟通」(跳转聊天页),留足跳转时间
    boss.eval(CLICK_STARTCHAT_JS).map_err(|e| e.to_string())?;
    tokio::time::sleep(Duration::from_millis(5000)).await;
    // 3. 追发定制招呼语(message 用 serde_json 安全注入)
    let msg_lit = serde_json::to_string(&message).map_err(|e| e.to_string())?;
    let send_js = SEND_MSG_JS.replacen("__MSG__", &msg_lit, 1);
    boss.eval(&send_js).map_err(|e| e.to_string())?;
    // 4. 等结果
    wait_event(&app, "boss-apply-done").await
}

/// 抓 BOSS 聊天列表统计回复(总会话/有新回复)。
#[tauri::command]
async fn boss_replies(app: tauri::AppHandle) -> Result<String, String> {
    navigate_scrape(
        &app,
        "https://www.zhipin.com/web/geek/chat".to_string(),
        SCRAPE_REPLIES_JS,
        "boss-replies",
    )
    .await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            boss_search,
            boss_fetch_jd,
            boss_apply,
            boss_replies
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
