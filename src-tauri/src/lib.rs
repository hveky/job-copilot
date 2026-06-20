use std::time::Duration;
use tauri::Manager;

// 抓取列表:在 BOSS 搜索页注入,等卡片出现后把 JSON 写进 document.title 回传。
const SCRAPE_LIST_JS: &str = r#"(function(){
  var tries=0;
  function pick(el,sels){for(var i=0;i<sels.length;i++){var n=el.querySelector(sels[i]);if(n&&n.innerText)return n.innerText.trim();}return '';}
  function go(){
    var cards=document.querySelectorAll('li.job-card-box, li.job-card-wrapper');
    if(cards.length===0 && tries<25){tries++;return setTimeout(go,400);}
    var out=[];
    cards.forEach(function(li){
      var a=li.querySelector('a.job-card-left, a[ka^="search_list"], a');
      var href=a?a.href:'';
      var id='';
      var m=href.match(/job_detail\/([^.?\/]+)/);
      if(m)id=m[1];
      out.push({
        id:id, href:href,
        title:pick(li,['.job-name','.job-title','[class*="job-name"]']),
        salary:pick(li,['.job-salary','.salary','[class*="salary"]']),
        company:pick(li,['.boss-name','.company-name','[class*="company-name"]']),
        tags:pick(li,['.tag-list','.job-card-footer'])
      });
    });
    document.title='QZC_JOBS:'+JSON.stringify(out).slice(0,60000);
  }
  go();
})();"#;

// 抓取详情页 JD。
const SCRAPE_JD_JS: &str = r#"(function(){
  var tries=0;
  function txt(sels){for(var i=0;i<sels.length;i++){var n=document.querySelector(sels[i]);if(n&&n.innerText)return n.innerText.trim();}return '';}
  function go(){
    var jd=txt(['.job-sec-text','.job-detail-section .text','[class*="job-sec"] .text']);
    if(!jd && tries<25){tries++;return setTimeout(go,400);}
    var o={
      title:txt(['.job-banner .name h1','.name h1','.job-name','h1']),
      salary:txt(['.job-banner .salary','.salary','[class*="salary"]']),
      company:txt(['.company-info .name','.sider-company .name','[class*="company"] .name']),
      jd:jd
    };
    document.title='QZC_JD:'+JSON.stringify(o).slice(0,120000);
  }
  go();
})();"#;

/// 注入脚本 + 轮询窗口标题,取出指定前缀后的载荷(依赖 document.title 同步到原生窗口标题)。
async fn eval_and_collect(
    boss: &tauri::WebviewWindow,
    nav_url: Option<String>,
    script: &str,
    prefix: &str,
) -> Result<String, String> {
    if let Some(url) = nav_url {
        boss.eval(&format!("window.location.href = {:?};", url))
            .map_err(|e| e.to_string())?;
        tokio::time::sleep(Duration::from_millis(1600)).await;
    }
    boss.eval(script).map_err(|e| e.to_string())?;
    let want = format!("{}:", prefix);
    for _ in 0..40 {
        tokio::time::sleep(Duration::from_millis(400)).await;
        let t = boss.title().map_err(|e| e.to_string())?;
        if let Some(rest) = t.strip_prefix(&want) {
            let _ = boss.eval("document.title='BOSS直聘';");
            return Ok(rest.to_string());
        }
        if let Some(err) = t.strip_prefix("QZC_ERR:") {
            return Err(err.to_string());
        }
    }
    Err("抓取超时(可能未登录、被风控、或页面结构已变化)".into())
}

fn boss_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window("boss")
        .ok_or_else(|| "BOSS 窗口未打开,请先点「打开 / 登录 BOSS」并登录".to_string())
}

/// 按岗位+城市码搜岗,抓取列表(返回 JSON 字符串数组)。
#[tauri::command]
async fn boss_search(
    app: tauri::AppHandle,
    query: String,
    city: String,
) -> Result<String, String> {
    let boss = boss_window(&app)?;
    let url = format!(
        "https://www.zhipin.com/web/geek/jobs?query={}&city={}",
        urlencoding::encode(&query),
        urlencoding::encode(&city)
    );
    eval_and_collect(&boss, Some(url), SCRAPE_LIST_JS, "QZC_JOBS").await
}

/// 打开某岗位详情页并抓 JD。
#[tauri::command]
async fn boss_fetch_jd(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let boss = boss_window(&app)?;
    eval_and_collect(&boss, Some(url), SCRAPE_JD_JS, "QZC_JD").await
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
        .invoke_handler(tauri::generate_handler![boss_search, boss_fetch_jd])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
