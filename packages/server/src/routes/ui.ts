/**
 * 内嵌测试 UI — 暗色玻璃拟态风格 + 分步骤工作流
 */
import { Router } from 'express';
const router: Router = Router();
router.get('/', (_req, res) => { res.send(PAGE_HTML); });

const PAGE_HTML = /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>剧本杀创作工坊</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#0a0a1a;--glass:rgba(255,255,255,.06);--glass-h:rgba(255,255,255,.1);
  --bdr:rgba(255,255,255,.08);--bdr-a:rgba(139,92,246,.5);
  --txt:#e2e8f0;--dim:#64748b;--bright:#f8fafc;
  --ac:#8b5cf6;--ac-glow:rgba(139,92,246,.3);--ac2:#06b6d4;
  --ok:#10b981;--err:#ef4444;--warn:#f59e0b;--r:12px;
}
body{
  font-family:'Noto Sans SC',system-ui,sans-serif;background:var(--bg);color:var(--txt);
  min-height:100vh;line-height:1.6;
  background-image:radial-gradient(ellipse at 20% 50%,rgba(139,92,246,.08) 0%,transparent 50%),
                   radial-gradient(ellipse at 80% 20%,rgba(6,182,212,.06) 0%,transparent 50%);
}
.nb{position:sticky;top:0;z-index:100;padding:.75rem 1.5rem;background:rgba(10,10,26,.85);backdrop-filter:blur(20px);border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:.6rem;font-weight:700;font-size:1.05rem;color:var(--bright);text-decoration:none}
.brand i{font-size:1.3rem;color:var(--ac)}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}
.dot.on{background:var(--ok);box-shadow:0 0 8px var(--ok)}.dot.off{background:var(--err);box-shadow:0 0 8px var(--err)}
.dot.ld{background:var(--warn);animation:bl 1s infinite}
@keyframes bl{0%,100%{opacity:1}50%{opacity:.3}}
.hl{font-size:.78rem;color:var(--dim)}
.mn{max-width:960px;margin:0 auto;padding:1.5rem 1rem}
.tabs{display:flex;gap:2px;margin-bottom:1.5rem;background:rgba(255,255,255,.03);border-radius:var(--r);padding:4px;border:1px solid var(--bdr)}
.tb{flex:1;padding:.6rem .5rem;text-align:center;font-size:.82rem;font-weight:500;color:var(--dim);background:0;border:0;border-radius:calc(var(--r) - 4px);cursor:pointer;transition:.2s;font-family:inherit}
.tb:hover{color:var(--txt);background:rgba(255,255,255,.04)}.tb.on{color:var(--bright);background:var(--glass-h);box-shadow:0 1px 4px rgba(0,0,0,.3)}
.tp{display:none}.tp.on{display:block}
.stp{display:flex;gap:0;margin-bottom:1.5rem;overflow-x:auto;padding-bottom:.25rem}
.st{flex:1;text-align:center;padding:.65rem .25rem;font-size:.72rem;font-weight:500;color:var(--dim);border-bottom:2px solid var(--bdr);transition:.25s;white-space:nowrap}
.st i{display:block;font-size:1rem;margin-bottom:.2rem}
.st.on{color:var(--ac);border-color:var(--ac);text-shadow:0 0 20px var(--ac-glow)}
.st.ok{color:var(--ok);border-color:var(--ok)}.st.er{color:var(--err);border-color:var(--err)}
.g{background:var(--glass);border:1px solid var(--bdr);border-radius:16px;backdrop-filter:blur(12px);overflow:hidden;margin-bottom:1rem}
.gh{padding:.85rem 1.2rem;border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between}
.gh h3{font-size:.9rem;font-weight:600;color:var(--bright);display:flex;align-items:center;gap:.5rem}
.gh h3 i{color:var(--ac);font-size:1rem}
.et{font-family:'JetBrains Mono',monospace;font-size:.65rem;padding:.2rem .6rem;background:rgba(139,92,246,.15);color:var(--ac);border-radius:20px;border:1px solid rgba(139,92,246,.2)}
.gb{padding:1.2rem}.gf{padding:0 1.2rem 1.2rem}
.fg{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem}
@media(max-width:640px){.fg{grid-template-columns:repeat(2,1fr)}}
.fi{display:flex;flex-direction:column;gap:.3rem}.fi.s2{grid-column:span 2}
@media(max-width:640px){.fi.s2{grid-column:span 1}}
label{font-size:.75rem;font-weight:500;color:var(--dim);text-transform:uppercase;letter-spacing:.5px}
input,select,textarea{font-family:inherit;font-size:.85rem;padding:.55rem .75rem;background:rgba(255,255,255,.04);border:1px solid var(--bdr);border-radius:8px;color:var(--txt);outline:0;transition:.2s}
input:focus,select:focus,textarea:focus{border-color:var(--ac);box-shadow:0 0 0 3px var(--ac-glow)}
textarea{font-family:'JetBrains Mono',monospace;font-size:.8rem;resize:vertical;min-height:160px}
input[type=range]{-webkit-appearance:none;background:linear-gradient(90deg,var(--ac2),var(--ac));padding:0;height:6px;border:0;border-radius:3px;margin-top:.5rem}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:var(--bright);cursor:pointer;box-shadow:0 0 8px var(--ac-glow)}
.rr{display:flex;gap:.5rem;margin-top:.4rem}
.rb{font-size:.7rem;padding:.15rem .5rem;border-radius:20px;font-weight:500}
.rb.a{background:rgba(6,182,212,.15);color:var(--ac2)}.rb.b{background:rgba(245,158,11,.15);color:var(--warn)}
.btn{font-family:inherit;font-size:.82rem;font-weight:600;padding:.6rem 1.2rem;border:0;border-radius:8px;cursor:pointer;transition:.2s;display:inline-flex;align-items:center;gap:.4rem}
.bp{background:linear-gradient(135deg,var(--ac),#7c3aed);color:#fff;box-shadow:0 2px 12px var(--ac-glow)}
.bp:hover{transform:translateY(-1px);box-shadow:0 4px 20px var(--ac-glow)}.bp:disabled{opacity:.5;cursor:not-allowed;transform:none}
.bs{background:linear-gradient(135deg,var(--ok),#059669);color:#fff;box-shadow:0 2px 12px rgba(16,185,129,.3)}.bs:hover{transform:translateY(-1px)}
.bg{background:rgba(255,255,255,.06);color:var(--txt);border:1px solid var(--bdr)}.bg:hover{background:rgba(255,255,255,.1)}
.bw{background:rgba(245,158,11,.15);color:var(--warn);border:1px solid rgba(245,158,11,.2)}.bw:hover{background:rgba(245,158,11,.25)}
.br{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1rem}
pre.res{font-family:'JetBrains Mono',monospace;font-size:.78rem;line-height:1.6;padding:1rem;border-radius:var(--r);max-height:45vh;overflow:auto;background:rgba(0,0,0,.4);color:var(--dim);white-space:pre-wrap;word-break:break-all;border:1px solid var(--bdr);margin-top:.75rem}
pre.res.ok{border-left:3px solid var(--ok);color:var(--txt)}pre.res.err{border-left:3px solid var(--err);color:#fca5a5}
.sts{font-size:.82rem;padding:.5rem .75rem;border-radius:8px;margin-bottom:.75rem;display:flex;align-items:center;gap:.5rem}
.sts.w{background:rgba(139,92,246,.1);color:var(--ac)}.sts.o{background:rgba(16,185,129,.1);color:var(--ok)}.sts.e{background:rgba(239,68,68,.1);color:var(--err)}
.pl{width:8px;height:8px;border-radius:50%;background:var(--ac);animation:bl 1s infinite}
.sp{width:14px;height:14px;border:2px solid rgba(255,255,255,.2);border-top-color:#fff;border-radius:50%;animation:sn .6s linear infinite;display:inline-block}
@keyframes sn{to{transform:rotate(360deg)}}
footer{text-align:center;padding:2rem 1rem;color:var(--dim);font-size:.75rem}
::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:0}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
select option{background:#1e1b4b;color:var(--txt)}
.rw{display:flex;gap:.5rem;margin-bottom:.5rem}.rw select{width:100px;flex-shrink:0}.rw input{flex:1}
@media(max-width:480px){.stp{gap:0}.st{font-size:.65rem;padding:.5rem .15rem}.st i{font-size:.85rem}.gb{padding:.85rem}.fg{gap:.5rem}.nb{padding:.6rem 1rem}}
</style>
</head>
<body>
<nav class="nb"><a class="brand" href="/"><i class="bi bi-mask"></i>剧本杀创作工坊</a><span id="health"><span class="dot ld"></span><span class="hl">检查中</span></span></nav>
<div class="mn">
<!-- Tabs -->
<div class="tabs">
  <button class="tb on" data-tab="workflow"><i class="bi bi-diagram-3"></i> 分步创作</button>
  <button class="tb" data-tab="quick"><i class="bi bi-lightning-charge"></i> 快速配置</button>
  <button class="tb" data-tab="raw"><i class="bi bi-terminal"></i> 原始请求</button>
</div>

<!-- Tab: Workflow -->
<div class="tp on" id="tab-workflow">
<div class="stp" id="stepper">
  <div class="st on" data-step="0"><i class="bi bi-gear"></i>配置</div>
  <div class="st" data-step="1"><i class="bi bi-play-circle"></i>会话</div>
  <div class="st" data-step="2"><i class="bi bi-lightbulb"></i>企划</div>
  <div class="st" data-step="3"><i class="bi bi-map"></i>大纲</div>
  <div class="st" data-step="4"><i class="bi bi-book"></i>章节</div>
  <div class="st" data-step="5"><i class="bi bi-trophy"></i>完成</div>
</div>

<!-- Step 0: Config -->
<div class="sp-p" data-step="0">
<div class="g"><div class="gh"><h3><i class="bi bi-gear"></i>创建配置</h3><span class="et">POST /api/configs</span></div>
<div class="gb"><form id="wf-cf">
<div class="fi" style="margin-bottom:.75rem"><label>风格</label><select id="wf-sty" style="width:100%"><option value="detective">悬疑 — 正统侦探：严密逻辑推理，证据链环环相扣</option><option value="drama">搞笑 — 戏影侦探：谐音梗、无厘头、喜剧反转</option><option value="discover">探索 — 寻迹侦探：多分支多结局，高可重玩性</option><option value="destiny">浪漫 — 命运侦探：命运交织，宿命羁绊</option><option value="dream">叙诡 — 幻梦侦探：梦幻叙事，叙述性诡计</option><option value="dimension">科幻 — 赛博侦探：全息投影、传送门等高科技</option><option value="death">恐怖 — 幽冥侦探：民俗/哥特/克苏鲁，充满未知</option></select></div>
<div class="fg">
  <div class="fi"><label>玩家人数</label><input type="number" id="wf-pc" value="4" min="1" max="6"></div>
  <div class="fi"><label>时长 (小时)</label><input type="number" id="wf-dh" value="3" min="2" max="6"></div>
  <div class="fi"><label>类型</label><select id="wf-gt"><option value="honkaku">本格 — 公平逻辑推理</option><option value="shin_honkaku">新本格 — 特殊设定+推理</option><option value="henkaku">变格 — 猎奇恐怖幻想</option></select></div>
  <div class="fi"><label>年龄段</label><select id="wf-ag"><option value="adult">成年人</option><option value="college">大学生</option><option value="middle_school">中学生</option><option value="elementary">小学生</option></select></div>
  <div class="fi s2"><label>还原 / 推理 比例</label><input type="range" id="wf-rt" min="0" max="100" value="60"><div class="rr"><span class="rb a">还原 <span id="wf-rr">60</span>%</span><span class="rb b">推理 <span id="wf-dr">40</span>%</span></div></div>
  <div class="fi"><label>语言</label><select id="wf-ln"><option value="zh-CN">中文</option><option value="en-US">English</option><option value="ja-JP">日本語</option><option value="ko-KR">한국어</option></select></div>
  <div class="fi"><label>时代</label><input type="text" id="wf-era" value="现代"></div>
  <div class="fi"><label>地点</label><input type="text" id="wf-loc" value="别墅"></div>
  <div class="fi"><label>主题</label><input type="text" id="wf-thm" value="复仇"></div>
</div>
<div class="br"><button type="submit" class="btn bp" id="wf-bc"><i class="bi bi-arrow-right"></i>创建配置并继续</button></div>
</form></div>
<div class="gf"><pre class="res" id="wf-cr">等待提交...</pre></div></div>
</div>

<!-- Step 1: Session -->
<div class="sp-p" data-step="1" style="display:none">
<div class="g"><div class="gh"><h3><i class="bi bi-play-circle"></i>创建创作会话</h3><span class="et">POST /api/authoring-sessions</span></div>
<div class="gb">
  <div style="display:flex;gap:.75rem;align-items:flex-end;flex-wrap:wrap">
    <div class="fi"><label>模式</label><select id="wf-md" style="width:160px"><option value="staged">staged（分步）</option><option value="vibe">vibe（一键）</option></select></div>
    <button class="btn bp" id="wf-bs"><i class="bi bi-arrow-right"></i>创建并推进</button>
  </div>
  <div style="margin-top:.6rem;font-size:.78rem;color:var(--dim)">Config ID: <code id="wf-cid" style="color:var(--ac)">—</code></div>
</div>
<div class="gf"><pre class="res" id="wf-sr">等待操作...</pre></div></div>
</div>

<!-- Step 2: Plan -->
<div class="sp-p" data-step="2" style="display:none">
<div class="g"><div class="gh"><h3><i class="bi bi-lightbulb"></i>企划审阅</h3></div>
<div class="gb">
  <div id="wf-ps"></div>
  <div class="fi" style="margin-top:.5rem"><label>企划内容（可编辑后保存）</label><textarea id="wf-pc2"></textarea></div>
  <div class="br"><button class="btn bg" id="wf-psa"><i class="bi bi-floppy"></i>保存编辑</button><button class="btn bs" id="wf-pa"><i class="bi bi-check-lg"></i>批准并继续</button></div>
</div>
<div class="gf"><pre class="res" id="wf-pr">等待生成...</pre></div></div>
</div>

<!-- Step 3: Outline -->
<div class="sp-p" data-step="3" style="display:none">
<div class="g"><div class="gh"><h3><i class="bi bi-map"></i>大纲审阅</h3></div>
<div class="gb">
  <div id="wf-os"></div>
  <div class="fi" style="margin-top:.5rem"><label>大纲内容（可编辑后保存）</label><textarea id="wf-oc"></textarea></div>
  <div class="br"><button class="btn bg" id="wf-osa"><i class="bi bi-floppy"></i>保存编辑</button><button class="btn bs" id="wf-oa"><i class="bi bi-check-lg"></i>批准并继续</button></div>
</div>
<div class="gf"><pre class="res" id="wf-or">等待生成...</pre></div></div>
</div>

<!-- Step 4: Chapter -->
<div class="sp-p" data-step="4" style="display:none">
<div class="g"><div class="gh"><h3><i class="bi bi-book"></i>章节审阅</h3></div>
<div class="gb">
  <div id="wf-cs"></div>
  <div class="fi" style="margin-top:.5rem"><label>当前章节内容</label><textarea id="wf-cc" style="min-height:220px"></textarea></div>
  <div class="br"><button class="btn bg" id="wf-csa"><i class="bi bi-floppy"></i>保存编辑</button><button class="btn bw" id="wf-crg"><i class="bi bi-arrow-repeat"></i>重新生成</button><button class="btn bs" id="wf-ca"><i class="bi bi-check-lg"></i>批准章节</button></div>
</div>
<div class="gf"><pre class="res" id="wf-chr">等待生成...</pre></div></div>
</div>

<!-- Step 5: Done -->
<div class="sp-p" data-step="5" style="display:none">
<div class="g"><div class="gh"><h3><i class="bi bi-trophy" style="color:var(--warn)"></i>创作完成</h3></div>
<div class="gb"><div class="br" style="margin-top:0"><button class="btn bp" id="wf-asm"><i class="bi bi-box"></i>组装剧本</button><button class="btn bg" id="wf-rst"><i class="bi bi-arrow-counterclockwise"></i>重新开始</button></div></div>
<div class="gf"><pre class="res" id="wf-ar">等待操作...</pre></div></div>
</div>
</div><!-- /workflow -->

<!-- Tab: Quick -->
<div class="tp" id="tab-quick">
<div class="g"><div class="gh"><h3><i class="bi bi-lightning-charge"></i>快速创建配置</h3><span class="et">POST /api/configs</span></div>
<div class="gb"><form id="qf">
<div class="fi" style="margin-bottom:.75rem"><label>风格</label><select id="q-sty" style="width:100%"><option value="detective">悬疑 — 正统侦探：严密逻辑推理，证据链环环相扣</option><option value="drama">搞笑 — 戏影侦探：谐音梗、无厘头、喜剧反转</option><option value="discover">探索 — 寻迹侦探：多分支多结局，高可重玩性</option><option value="destiny">浪漫 — 命运侦探：命运交织，宿命羁绊</option><option value="dream">叙诡 — 幻梦侦探：梦幻叙事，叙述性诡计</option><option value="dimension">科幻 — 赛博侦探：全息投影、传送门等高科技</option><option value="death">恐怖 — 幽冥侦探：民俗/哥特/克苏鲁，充满未知</option></select></div>
<div class="fg">
  <div class="fi"><label>玩家</label><input type="number" id="q-pc" value="4" min="1" max="6"></div>
  <div class="fi"><label>时长</label><input type="number" id="q-dh" value="3" min="2" max="6"></div>
  <div class="fi"><label>类型</label><select id="q-gt"><option value="honkaku">本格 — 公平逻辑推理</option><option value="shin_honkaku">新本格 — 特殊设定+推理</option><option value="henkaku">变格 — 猎奇恐怖幻想</option></select></div>
  <div class="fi"><label>年龄段</label><select id="q-ag"><option value="adult">成年人</option><option value="college">大学生</option></select></div>
  <div class="fi"><label>语言</label><select id="q-ln"><option value="zh-CN">中文</option><option value="en-US">English</option><option value="ja-JP">日本語</option><option value="ko-KR">한국어</option></select></div>
  <div class="fi"><label>时代</label><input type="text" id="q-era" value="现代"></div>
  <div class="fi"><label>地点</label><input type="text" id="q-loc" value="别墅"></div>
  <div class="fi"><label>主题</label><input type="text" id="q-thm" value="复仇"></div>
</div>
<div class="br"><button type="submit" class="btn bp"><i class="bi bi-send"></i>创建</button></div>
</form></div>
<div class="gf"><pre class="res" id="q-res">等待提交...</pre></div></div>
</div>

<!-- Tab: Raw -->
<div class="tp" id="tab-raw">
<div class="g"><div class="gh"><h3><i class="bi bi-terminal"></i>自定义请求</h3></div>
<div class="gb">
  <div class="rw"><select id="r-m"><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option></select><input type="text" id="r-u" value="/api/configs" style="font-family:'JetBrains Mono',monospace;font-size:.82rem"><button class="btn bp" id="r-go"><i class="bi bi-send"></i>发送</button></div>
  <textarea id="r-b" placeholder='{"key":"value"}' style="width:100%;min-height:80px"></textarea>
</div>
<div class="gf"><pre class="res" id="r-res">等待发送...</pre></div></div>
</div>

</div><!-- /mn -->
<footer>剧本杀创作工坊 · Murder Mystery Generator</footer>

<script>
(function(){
const A='';let cs=0,ci=null,si=null,pt=null;
function $(s){return document.querySelector(s)}
function $$(s){return document.querySelectorAll(s)}
function sr(el,d,ok){el.textContent=typeof d==='string'?d:JSON.stringify(d,null,2);el.className='res '+(ok?'ok':'err')}
async function api(m,p,b){const o={method:m,headers:{'Content-Type':'application/json'}};if(b)o.body=JSON.stringify(b);const r=await fetch(A+p,o);const j=await r.json().catch(()=>null);return{ok:r.ok,status:r.status,data:j}}

// URL hash persistence
function saveHash(){const p=new URLSearchParams();if(ci)p.set('config',ci);if(si)p.set('session',si);history.replaceState(null,'','#'+p.toString())}
function clearHash(){history.replaceState(null,'','/')}
function readHash(){const h=location.hash.slice(1);if(!h)return null;const p=new URLSearchParams(h);return{config:p.get('config'),session:p.get('session')}}
const STATE_STEP={draft:1,planning:2,plan_review:2,designing:3,design_review:3,executing:4,chapter_review:4,completed:5,failed:-1};

// Health
(async()=>{const el=$('#health');try{const r=await fetch(A+'/api/configs');el.innerHTML=r.ok?'<span class="dot on"></span><span class="hl">在线</span>':'<span class="dot off"></span><span class="hl">异常</span>'}catch{el.innerHTML='<span class="dot off"></span><span class="hl">离线</span>'}})();

// Tabs
$$('.tb').forEach(b=>{b.addEventListener('click',()=>{$$('.tb').forEach(x=>x.classList.remove('on'));b.classList.add('on');$$('.tp').forEach(p=>p.classList.remove('on'));$('#tab-'+b.dataset.tab).classList.add('on')})});

// Ratio
$('#wf-rt').addEventListener('input',function(){$('#wf-rr').textContent=this.value;$('#wf-dr').textContent=100-this.value});

// Stepper
function go(n){cs=n;$$('.st').forEach(el=>{const s=+el.dataset.step;el.classList.remove('on','ok','er');if(s<n)el.classList.add('ok');else if(s===n)el.classList.add('on')});$$('.sp-p').forEach(el=>{el.style.display=(+el.dataset.step===n)?'block':'none'})}

// Poll
function sp(){if(pt){clearInterval(pt);pt=null}}
function poll(cb){sp();pt=setInterval(async()=>{try{const r=await api('GET','/api/authoring-sessions/'+si);if(r.ok)cb(r.data)}catch{}},3000)}
function ss(el,msg,t){el.innerHTML='<div class="sts '+t+'">'+(t==='w'?'<span class="pl"></span>':'<i class="bi bi-'+(t==='o'?'check-circle':'x-circle')+'"></i>')+msg+'</div>'}

// Step 0: Create config
$('#wf-cf').addEventListener('submit',async(e)=>{e.preventDefault();const b=$('#wf-bc');b.disabled=true;b.innerHTML='<span class="sp"></span>创建中...';
const body={playerCount:+$('#wf-pc').value,durationHours:+$('#wf-dh').value,gameType:$('#wf-gt').value,ageGroup:$('#wf-ag').value,restorationRatio:+$('#wf-rt').value,deductionRatio:100-(+$('#wf-rt').value),language:$('#wf-ln').value,era:$('#wf-era').value,location:$('#wf-loc').value,theme:$('#wf-thm').value,style:$('#wf-sty').value};
const r=await api('POST','/api/configs',body);sr($('#wf-cr'),r.data,r.ok);b.disabled=false;b.innerHTML='<i class="bi bi-arrow-right"></i>创建配置并继续';
if(r.ok){ci=r.data.id;$('#wf-cid').textContent=ci;saveHash();go(1)}});

// Step 1: Create session
$('#wf-bs').addEventListener('click',async()=>{const b=$('#wf-bs');b.disabled=true;b.innerHTML='<span class="sp"></span>创建中...';
const r=await api('POST','/api/authoring-sessions',{configId:ci,mode:$('#wf-md').value});sr($('#wf-sr'),r.data,r.ok);
if(!r.ok){b.disabled=false;b.innerHTML='<i class="bi bi-arrow-right"></i>创建并推进';return}
si=r.data.id;saveHash();const adv=await api('POST','/api/authoring-sessions/'+si+'/advance');sr($('#wf-sr'),adv.data,adv.ok||adv.status===202);
b.disabled=false;b.innerHTML='<i class="bi bi-arrow-right"></i>创建并推进';
if(adv.ok||adv.status===202){go(2);ss($('#wf-ps'),'LLM 正在生成企划...','w');poll(hu)}});

// Poll handler
function hu(s){
  if(s.state==='failed'){sp();$$('.st')[cs].classList.add('er');const rm={2:'#wf-pr',3:'#wf-or',4:'#wf-chr'},sm={2:'#wf-ps',3:'#wf-os',4:'#wf-cs'};sr($(rm[cs]||'#wf-pr'),s.failureInfo||{error:'生成失败'},false);ss($(sm[cs]||'#wf-ps'),'生成失败','e');return}
  if(s.state==='plan_review'&&cs===2){sp();const c=s.planOutput?.authorEdited||s.planOutput?.llmOriginal;$('#wf-pc2').value=typeof c==='string'?c:JSON.stringify(c,null,2);ss($('#wf-ps'),'企划已生成，请审阅','o');sr($('#wf-pr'),s.planOutput,true)}
  if(s.state==='design_review'&&cs<=3){sp();go(3);const c=s.outlineOutput?.authorEdited||s.outlineOutput?.llmOriginal;$('#wf-oc').value=typeof c==='string'?c:JSON.stringify(c,null,2);ss($('#wf-os'),'大纲已生成，请审阅','o');sr($('#wf-or'),s.outlineOutput,true)}
  if(s.state==='chapter_review'&&cs<=4){sp();go(4);sch(s)}
  if(s.state==='completed'){sp();go(5);sr($('#wf-ar'),s,true)}
  if(['planning','designing','executing','generating'].includes(s.state)){const batch=s.parallelBatch;const bm=batch?' (并行 '+(batch.completedIndices?batch.completedIndices.length:0)+'/'+batch.chapterIndices.length+')':'';if(cs===2)ss($('#wf-ps'),'正在生成... '+s.state+bm,'w');if(cs===3)ss($('#wf-os'),'正在生成... '+s.state+bm,'w');if(cs===4)ss($('#wf-cs'),'正在并行生成中...'+bm,'w')}
}
const CHTYPE={dm_handbook:'DM手册',player_handbook:'玩家手册',materials:'游戏物料集',branch_structure:'分支结构'};
function sch(s){const i=s.currentChapterIndex||0,ch=s.chapters&&s.chapters.find(c=>c.index===i),c=ch?(typeof ch.content==='string'?ch.content:JSON.stringify(ch.content,null,2)):'';$('#wf-cc').value=c;
const batch=s.parallelBatch;
if(batch){const done=batch.reviewedIndices?batch.reviewedIndices.length:0;const total=batch.chapterIndices?batch.chapterIndices.length:0;const tl=ch?CHTYPE[ch.type]||'章节':'章节';ss($('#wf-cs'),'批量审阅 '+(done+1)+'/'+total+' — '+tl+'（索引'+i+'）','o')}
else{ss($('#wf-cs'),'章节 '+(i+1)+'/'+s.totalChapters+' — 请审阅','o')}
sr($('#wf-chr'),ch||'无章节数据',!!ch)}

// Plan
$('#wf-psa').addEventListener('click',async()=>{const r=await api('PUT','/api/authoring-sessions/'+si+'/phases/plan/edit',{content:$('#wf-pc2').value});sr($('#wf-pr'),r.data,r.ok)});
$('#wf-pa').addEventListener('click',async()=>{const b=$('#wf-pa');b.disabled=true;const r=await api('POST','/api/authoring-sessions/'+si+'/phases/plan/approve');sr($('#wf-pr'),r.data,r.ok||r.status===202);b.disabled=false;if(r.ok||r.status===202){go(3);ss($('#wf-os'),'LLM 正在生成大纲...','w');poll(hu)}});

// Outline
$('#wf-osa').addEventListener('click',async()=>{const r=await api('PUT','/api/authoring-sessions/'+si+'/phases/outline/edit',{content:$('#wf-oc').value});sr($('#wf-or'),r.data,r.ok)});
$('#wf-oa').addEventListener('click',async()=>{const b=$('#wf-oa');b.disabled=true;const r=await api('POST','/api/authoring-sessions/'+si+'/phases/outline/approve');sr($('#wf-or'),r.data,r.ok||r.status===202);b.disabled=false;if(r.ok||r.status===202){go(4);ss($('#wf-cs'),'LLM 正在生成章节...','w');poll(hu)}});

// Chapter
$('#wf-csa').addEventListener('click',async()=>{const r=await api('PUT','/api/authoring-sessions/'+si+'/phases/chapter/edit',{content:$('#wf-cc').value});sr($('#wf-chr'),r.data,r.ok)});
$('#wf-crg').addEventListener('click',async()=>{const s=await api('GET','/api/authoring-sessions/'+si);const i=s.ok?(s.data.currentChapterIndex||0):0;const r=await api('POST','/api/authoring-sessions/'+si+'/chapters/'+i+'/regenerate');sr($('#wf-chr'),r.data,r.ok||r.status===202);if(r.ok||r.status===202){ss($('#wf-cs'),'正在重新生成章节...','w');poll(hu)}});
$('#wf-ca').addEventListener('click',async()=>{const b=$('#wf-ca');b.disabled=true;b.innerHTML='<span class="sp"></span>批准中...';ss($('#wf-cs'),'正在提交批准...','w');
const r=await api('POST','/api/authoring-sessions/'+si+'/phases/chapter/approve');
if(!r.ok&&r.status!==202){sr($('#wf-chr'),r.data,false);ss($('#wf-cs'),'批准失败','e');b.disabled=false;b.innerHTML='<i class="bi bi-check-lg"></i>批准章节';return}
// If sync response (batch has more to review, or completed), handle directly
if(r.ok&&r.status!==202){const s=r.data;if(s.state==='completed'){b.disabled=false;b.innerHTML='<i class="bi bi-check-lg"></i>批准章节';go(5);sr($('#wf-ar'),s,true)}else if(s.state==='chapter_review'){b.disabled=false;b.innerHTML='<i class="bi bi-check-lg"></i>批准章节';sch(s)}else{b.disabled=false;b.innerHTML='<i class="bi bi-check-lg"></i>批准章节';ss($('#wf-cs'),'正在并行生成下一批章节...','w');poll(hu)}return}
// 202 — async generation started
ss($('#wf-cs'),'正在并行生成下一批章节，请稍候...','w');sr($('#wf-chr'),'后台并行生成中，请耐心等待...',true);
b.disabled=false;b.innerHTML='<i class="bi bi-check-lg"></i>批准章节';poll(hu)});

// Done
$('#wf-asm').addEventListener('click',async()=>{const b=$('#wf-asm');b.disabled=true;b.innerHTML='<span class="sp"></span>组装中...';const r=await api('POST','/api/authoring-sessions/'+si+'/assemble');sr($('#wf-ar'),r.data,r.ok);b.disabled=false;b.innerHTML='<i class="bi bi-box"></i>组装剧本'});
$('#wf-rst').addEventListener('click',()=>{sp();ci=null;si=null;clearHash();go(0);['#wf-cr','#wf-sr','#wf-pr','#wf-or','#wf-chr','#wf-ar'].forEach(s=>{$(s).textContent='等待操作...';$(s).className='res'});$('#wf-pc2').value='';$('#wf-oc').value='';$('#wf-cc').value=''});
window.retrySession=async function(){const r=await api('POST','/api/authoring-sessions/'+si+'/retry');if(r.ok){await api('POST','/api/authoring-sessions/'+si+'/advance');poll(hu)}};

// Quick config
$('#qf').addEventListener('submit',async(e)=>{e.preventDefault();const body={playerCount:+$('#q-pc').value,durationHours:+$('#q-dh').value,gameType:$('#q-gt').value,ageGroup:$('#q-ag').value,restorationRatio:60,deductionRatio:40,language:$('#q-ln').value,era:$('#q-era').value,location:$('#q-loc').value,theme:$('#q-thm').value,style:$('#q-sty').value};const r=await api('POST','/api/configs',body);sr($('#q-res'),r.data,r.ok)});

// Raw request
$('#r-go').addEventListener('click',async()=>{const m=$('#r-m').value,u=$('#r-u').value;let b=null;if(['POST','PUT'].includes(m)){try{b=JSON.parse($('#r-b').value||'{}')}catch{b=$('#r-b').value}}const r=await api(m,u,b);sr($('#r-res'),r.data,r.ok)});

// Restore session from URL hash on page load
async function restore(){
  const h=readHash();if(!h||!h.session)return;
  si=h.session;ci=h.config;
  if(ci)$('#wf-cid').textContent=ci;
  try{
    const r=await api('GET','/api/authoring-sessions/'+si);
    if(!r.ok){sr($('#wf-sr'),{error:'会话不存在或已过期',id:si},false);si=null;ci=null;clearHash();return}
    const s=r.data;ci=s.configId||ci;saveHash();
    const step=STATE_STEP[s.state];
    if(step===undefined||step<0){
      go(2);sr($('#wf-pr'),s.failureInfo||{error:'生成失败'},false);ss($('#wf-ps'),'生成失败','e');return;
    }
    if(step<=1){go(step);return}
    if(step>=2&&s.planOutput){const c=s.planOutput.authorEdited||s.planOutput.llmOriginal;$('#wf-pc2').value=typeof c==='string'?c:JSON.stringify(c,null,2)}
    if(step>=3&&s.outlineOutput){const c=s.outlineOutput.authorEdited||s.outlineOutput.llmOriginal;$('#wf-oc').value=typeof c==='string'?c:JSON.stringify(c,null,2)}
    if(step>=4&&s.chapters){sch(s)}
    go(step);
    if(['planning','designing','executing','generating'].includes(s.state)){
      const sm={2:'#wf-ps',3:'#wf-os',4:'#wf-cs'};
      if(sm[step])ss($(sm[step]),'正在生成... '+s.state,'w');
      poll(hu);
    } else if(s.state==='plan_review'){ss($('#wf-ps'),'企划已生成，请审阅','o');sr($('#wf-pr'),s.planOutput,true)}
    else if(s.state==='design_review'){ss($('#wf-os'),'大纲已生成，请审阅','o');sr($('#wf-or'),s.outlineOutput,true)}
    else if(s.state==='chapter_review'){ss($('#wf-cs'),'章节审阅中','o')}
    else if(s.state==='completed'){sr($('#wf-ar'),s,true)}
  }catch(e){console.error('restore failed',e)}
}
restore();
})();
</script>
</body>
</html>`;

export default router;
