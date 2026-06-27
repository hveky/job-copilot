use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Listener, Manager};

/// 与 BOSS 扩展约定的共享令牌(请求头 X-Copilot-Token)。两端需一致。
const BRIDGE_TOKEN: &str = "job-copilot-local";
/// 桥接服务监听端口(只绑回环地址,不暴露局域网)。
const BRIDGE_ADDR: &str = "127.0.0.1:14530";

// 抓取列表:在 BOSS 搜索页注入,等卡片+__TAURI__ 就绪后用 IPC 事件回传。
const SCRAPE_LIST_JS: &str = r#"(function(){
  var tries=0;
  function pick(el,sels){for(var i=0;i<sels.length;i++){var n=el.querySelector(sels[i]);if(n&&n.innerText)return n.innerText.trim();}return '';}
  function cleanSalary(s){if(!s)return '';if(!/[0-9]/.test(s))return '';if(!/^[0-9Kk·.\-万元天月年薪面议以上\s]+$/.test(s))return '';return s.trim();}
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
          salary:cleanSalary(pick(li,['.job-salary','.salary','[class*="salary"]'])),
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
  function cleanSalary(s){if(!s)return '';if(!/[0-9]/.test(s))return '';if(!/^[0-9Kk·.\-万元天月年薪面议以上\s]+$/.test(s))return '';return s.trim();}
  function emit(ev,data){try{window.__TAURI__.event.emit(ev,data);}catch(e){}}
  function go(){
    try{
      if(!window.__TAURI__||!window.__TAURI__.event){if(tries<30){tries++;return setTimeout(go,400);}return;}
      var jd=txt(['.job-sec-text','.job-detail-section .text','[class*="job-sec"] .text']);
      if(!jd && tries<25){tries++;return setTimeout(go,400);}
      emit('boss-jd',{
        title:txt(['.job-banner .name h1','.name h1','.job-name','h1']),
        salary:cleanSalary(txt(['.job-banner .salary','.salary','[class*="salary"]'])),
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

// ===== 文件 agent:本地求职工作区读写(路径安全) =====
fn safe_join(root: &str, rel: &str) -> Result<PathBuf, String> {
    if rel.contains("..") {
        return Err("路径不能包含 ..".into());
    }
    let root_p = PathBuf::from(root);
    if !root_p.is_dir() {
        return Err("工作区目录无效".into());
    }
    let rel = rel.trim_start_matches(['/', '\\']);
    Ok(root_p.join(rel))
}

/// 列出工作区下的文本文件(相对路径),跳过重目录。
#[tauri::command]
fn fs_list(root: String) -> Result<Vec<String>, String> {
    let root_p = PathBuf::from(&root);
    if !root_p.is_dir() {
        return Err("工作区目录无效".into());
    }
    let mut out = vec![];
    for entry in walkdir::WalkDir::new(&root_p)
        .max_depth(4)
        .into_iter()
        .filter_entry(|e| {
            let n = e.file_name().to_string_lossy();
            !matches!(
                n.as_ref(),
                "node_modules" | ".git" | "target" | "dist" | ".claude"
            )
        })
    {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        if entry.file_type().is_file() {
            let n = entry.file_name().to_string_lossy().to_lowercase();
            if n.ends_with(".md") || n.ends_with(".txt") || n.ends_with(".json") {
                if let Ok(rel) = entry.path().strip_prefix(&root_p) {
                    out.push(rel.to_string_lossy().replace('\\', "/"));
                }
            }
        }
        if out.len() >= 500 {
            break;
        }
    }
    out.sort();
    Ok(out)
}

/// 返回固定数据根目录(用户主目录下 job-copilot),并确保四个子目录存在。
#[tauri::command]
fn data_root(app: tauri::AppHandle) -> Result<String, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|e| format!("找不到用户主目录: {}", e))?;
    let root = home.join("job-copilot");
    for sub in ["preps", "talk", "jds", "resumes"] {
        std::fs::create_dir_all(root.join(sub)).map_err(|e| e.to_string())?;
    }
    Ok(root.to_string_lossy().to_string())
}

/// 读取工作区内某文件。
#[tauri::command]
fn fs_read(root: String, path: String) -> Result<String, String> {
    let p = safe_join(&root, &path)?;
    std::fs::read_to_string(&p).map_err(|e| e.to_string())
}

/// 写入工作区内某文件(覆盖)。调用方须先让用户确认。
#[tauri::command]
fn fs_write(root: String, path: String, content: String) -> Result<(), String> {
    let p = safe_join(&root, &path)?;
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    std::fs::write(&p, content).map_err(|e| e.to_string())
}

/// 飞书授权登录(账号):开授权 WebView,拦截重定向拿 code,换 user_access_token。
/// 返回 access_token(以用户身份写表,无需把表分享给机器人)。
#[tauri::command]
async fn feishu_oauth(
    app: tauri::AppHandle,
    client_id: String,
    client_secret: String,
    redirect_uri: String,
) -> Result<String, String> {
    let auth_url = format!(
        "https://accounts.feishu.cn/open-apis/authen/v1/authorize?client_id={}&redirect_uri={}&scope={}&state=qzc",
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode("bitable:app offline_access")
    );
    if let Some(w) = app.get_webview_window("feishu-auth") {
        let _ = w.close();
    }
    let (tx, rx) = tokio::sync::oneshot::channel::<String>();
    let tx = Arc::new(Mutex::new(Some(tx)));
    let redir = redirect_uri.clone();
    let txc = tx.clone();
    let url: tauri::Url = auth_url.parse().map_err(|_| "授权 URL 无效".to_string())?;
    tauri::WebviewWindowBuilder::new(&app, "feishu-auth", tauri::WebviewUrl::External(url))
        .title("飞书账号授权")
        .inner_size(520.0, 720.0)
        .on_navigation(move |u| {
            if u.as_str().starts_with(&redir) {
                if let Some((_, code)) = u.query_pairs().find(|(k, _)| k == "code") {
                    if let Some(tx) = txc.lock().unwrap().take() {
                        let _ = tx.send(code.to_string());
                    }
                    return false;
                }
            }
            true
        })
        .build()
        .map_err(|e| e.to_string())?;

    let code = match tokio::time::timeout(Duration::from_secs(180), rx).await {
        Ok(Ok(c)) => c,
        _ => {
            if let Some(w) = app.get_webview_window("feishu-auth") {
                let _ = w.close();
            }
            return Err("授权超时或已取消".into());
        }
    };
    if let Some(w) = app.get_webview_window("feishu-auth") {
        let _ = w.close();
    }

    let client = reqwest::Client::new();
    let j = client
        .post("https://open.feishu.cn/open-apis/authen/v2/oauth/token")
        .json(&serde_json::json!({
            "grant_type": "authorization_code",
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())?;
    j["access_token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| format!("换取 user token 失败: {}", j))
}

/// 飞书多维表格写入。user_token 非空则以用户身份写;否则用 app_id/secret 走应用身份。
/// records 为前端构造好的 JSON 数组字符串:[{"fields":{...}}, ...]。
#[tauri::command]
async fn feishu_sync(
    app_id: String,
    app_secret: String,
    user_token: String,
    base_token: String,
    table_id: String,
    records: String,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    // 1. 取 token:优先用户身份
    let token = if !user_token.is_empty() {
        user_token
    } else {
        let tok = client
            .post("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal")
            .json(&serde_json::json!({ "app_id": app_id, "app_secret": app_secret }))
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json::<serde_json::Value>()
            .await
            .map_err(|e| e.to_string())?;
        tok["tenant_access_token"]
            .as_str()
            .ok_or_else(|| format!("获取 token 失败: {}", tok))?
            .to_string()
    };
    // 2. batch_create
    let recs: serde_json::Value =
        serde_json::from_str(&records).map_err(|e| format!("记录 JSON 解析失败: {}", e))?;
    let url = format!(
        "https://open.feishu.cn/open-apis/bitable/v1/apps/{}/tables/{}/records/batch_create",
        base_token, table_id
    );
    let j = client
        .post(&url)
        .bearer_auth(token)
        .json(&serde_json::json!({ "records": recs }))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())?;
    if j["code"].as_i64() == Some(0) {
        let n = j["data"]["records"]
            .as_array()
            .map(|a| a.len())
            .unwrap_or(0);
        Ok(n.to_string())
    } else {
        Err(format!("飞书写入失败: {}", j))
    }
}

// ===== 与 BOSS 扩展的入站桥:接收推送岗位,落到 jds/ =====

/// 从 BOSS 详情页 href 提取 jobId(job_detail/<id>.html);失败时退化为 href 的 FNV 哈希。
fn extract_job_id(href: &str) -> String {
    if let Some(idx) = href.find("job_detail/") {
        let rest = &href[idx + "job_detail/".len()..];
        let id: String = rest
            .chars()
            .take_while(|c| !matches!(c, '.' | '?' | '/' | '&'))
            .collect();
        if !id.is_empty() {
            return id;
        }
    }
    let mut h: u64 = 1469598103934665603;
    for b in href.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(1099511628211);
    }
    format!("{:x}", h)
}

/// 清掉文件名非法字符并截断到 max 字符。
fn safe_filename(s: &str, max: usize) -> String {
    let cleaned: String = s
        .chars()
        .filter(|c| {
            !matches!(
                c,
                '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\n' | '\r' | '\t'
            )
        })
        .collect();
    cleaned.trim().chars().take(max).collect()
}

/// 把一条推送岗位写入 jds/ 下的 Markdown(copilot-meta 注释 + 可读正文)。返回相对路径。
fn write_inbox_job(root: &PathBuf, job: &serde_json::Value) -> Result<String, String> {
    let s = |k: &str| {
        job.get(k)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string()
    };
    let title = s("title");
    let company = s("company");
    let salary = s("salary");
    let href = s("href");
    let reason = s("reason");
    let jd = s("jd");
    let time = s("time");
    let query = s("query");
    let score = job
        .get("score")
        .and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|x| x.parse().ok())))
        .unwrap_or(0)
        .clamp(0, 999);

    let job_id = extract_job_id(&href);
    let safe_title = {
        let t = safe_filename(&title, 40);
        if t.is_empty() {
            "JD".to_string()
        } else {
            t
        }
    };
    let rel = format!("jds/{:03}-{}-{}.md", score, safe_title, job_id);

    let meta = serde_json::json!({
        "score": score,
        "title": title,
        "company": company,
        "salary": salary,
        "href": href,
        "reason": reason,
        "query": query,
        "source": "boss-extension",
        "time": time,
    });
    let body_jd = if jd.is_empty() {
        "(扩展未带完整 JD,可在 BOSS 打开链接查看)".to_string()
    } else {
        jd
    };
    let header_line = if company.is_empty() {
        title.clone()
    } else {
        format!("{} · {}", title, company)
    };
    let content = format!(
        "<!--copilot-meta {} -->\n# {}\n> 评分 {} ·（AI）{}\n> 来源 BOSS 扩展 · {}\n\n{}\n",
        serde_json::to_string(&meta).unwrap_or_default(),
        header_line,
        score,
        reason,
        href,
        body_jd
    );

    let p = root.join(&rel);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    std::fs::write(&p, content).map_err(|e| e.to_string())?;
    Ok(rel)
}

/// 启动本地桥接 HTTP 服务(独立线程):接收 BOSS 扩展推送的岗位,落到 jds/,并 emit 通知前端刷新。
/// 失败(如端口被占用)仅告警,不阻塞主程序——收件箱退化为手动粘贴 JD,原流程不受影响。
fn start_bridge_server(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let server = match tiny_http::Server::http(BRIDGE_ADDR) {
            Ok(s) => s,
            Err(e) => {
                log::warn!("桥接服务启动失败(端口可能被占用),已跳过: {}", e);
                return;
            }
        };
        log::info!("桥接服务监听 http://{}", BRIDGE_ADDR);

        let root = match app.path().home_dir() {
            Ok(h) => h.join("job-copilot"),
            Err(_) => return,
        };

        let cors = |mut resp: tiny_http::Response<std::io::Cursor<Vec<u8>>>| {
            for (k, v) in [
                ("Access-Control-Allow-Origin", "*"),
                ("Access-Control-Allow-Headers", "content-type, x-copilot-token"),
                ("Access-Control-Allow-Methods", "POST, OPTIONS"),
            ] {
                if let Ok(h) = tiny_http::Header::from_bytes(k.as_bytes(), v.as_bytes()) {
                    resp.add_header(h);
                }
            }
            resp
        };
        let json_resp = |code: u16, body: &str| {
            let mut r = tiny_http::Response::from_string(body).with_status_code(code);
            r.add_header(
                tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..])
                    .unwrap(),
            );
            r
        };

        for mut request in server.incoming_requests() {
            if request.method() == &tiny_http::Method::Options {
                let _ = request
                    .respond(cors(tiny_http::Response::from_string("").with_status_code(204)));
                continue;
            }
            if request.method() != &tiny_http::Method::Post {
                let _ = request.respond(cors(json_resp(405, "{\"ok\":false,\"error\":\"method\"}")));
                continue;
            }
            let token_ok = request
                .headers()
                .iter()
                .any(|h| h.field.equiv("X-Copilot-Token") && h.value.as_str() == BRIDGE_TOKEN);
            if !token_ok {
                let _ = request.respond(cors(json_resp(401, "{\"ok\":false,\"error\":\"token\"}")));
                continue;
            }
            let mut body = String::new();
            if request.as_reader().read_to_string(&mut body).is_err() {
                let _ = request.respond(cors(json_resp(400, "{\"ok\":false,\"error\":\"body\"}")));
                continue;
            }
            let parsed: serde_json::Value = match serde_json::from_str(&body) {
                Ok(v) => v,
                Err(_) => {
                    let _ = request.respond(cors(json_resp(400, "{\"ok\":false,\"error\":\"json\"}")));
                    continue;
                }
            };
            let jobs = parsed
                .get("jobs")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            let mut written = 0;
            for job in &jobs {
                match write_inbox_job(&root, job) {
                    Ok(_) => written += 1,
                    Err(e) => log::warn!("写入推送岗位失败: {}", e),
                }
            }
            let _ = app.emit("jobs-received", written);
            let _ = request.respond(cors(json_resp(
                200,
                &format!("{{\"ok\":true,\"written\":{}}}", written),
            )));
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // 启动与 BOSS 扩展的入站桥(独立线程,失败不阻塞)
            start_bridge_server(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            boss_search,
            boss_fetch_jd,
            boss_apply,
            boss_replies,
            fs_list,
            fs_read,
            fs_write,
            data_root,
            feishu_sync,
            feishu_oauth
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
