/**
 * UI 前端脚本
 * 注意：此文件内容会嵌入 HTML 的 <script> 标签中，
 * 使用 new RegExp() 代替正则字面量以避免模板字符串转义问题。
 */
export const UI_SCRIPTS = `
(function(){
const A='';let cs=0,ci=null,si=null,pt=null,ephAi=null;
const PROV_DEFAULTS={openai:{ep:'https://api.openai.com/v1/chat/completions',mdl:'gpt-4'},anthropic:{ep:'https://api.anthropic.com/v1/messages',mdl:'claude-3-sonnet'},doubao:{ep:'https://ark.cn-beijing.volces.com/api/v3/chat/completions',mdl:'doubao-seed-1-8-251228'},custom:{ep:'',mdl:''}};
function $(s){return document.querySelector(s)}
function $$(s){return document.querySelectorAll(s)}
function sr(el,d,ok){el.textContent=typeof d==='string'?d:JSON.stringify(d,null,2);el.className='res '+(ok?'ok':'err')}
async function api(m,p,b){const o={method:m,headers:{'Content-Type':'application/json'}};if(b)o.body=JSON.stringify(b);const r=await fetch(A+p,o);const j=await r.json().catch(()=>null);return{ok:r.ok,status:r.status,data:j}}

// URL hash persistence
function saveHash(){const p=new URLSearchParams();if(ci)p.set('config',ci);if(si)p.set('session',si);history.replaceState(null,'','#'+p.toString())}
function clearHash(){history.replaceState(null,'','/')}
function readHash(){const h=location.hash.slice(1);if(!h)return null;const p=new URLSearchParams(h);return{config:p.get('config'),session:p.get('session')}}
const STATE_STEP={draft:1,planning:2,plan_review:2,designing:3,design_review:3,executing:4,chapter_review:4,generating:2,completed:5,failed:-1};

// AI Config Modal
(async()=>{
  try{
    const r=await api('GET','/api/ai-status');
    if(r.ok&&r.data&&r.data.status==='unconfigured'){
      $('#ai-modal').style.display='flex';
      const prov=$('#ai-prov');
      function fillDefaults(){const d=PROV_DEFAULTS[prov.value];if(d){$('#ai-ep').value=d.ep;$('#ai-mdl').value=d.mdl}}
      fillDefaults();
      prov.addEventListener('change',fillDefaults);
      $('#ai-verify').addEventListener('click',async()=>{
        const btn=$('#ai-verify');
        const key=$('#ai-key').value.trim(),ep=$('#ai-ep').value.trim(),mdl=$('#ai-mdl').value.trim();
        $$('.ferr').forEach(e=>{e.style.display='none';e.textContent=''});
        let hasErr=false;
        if(!key){$('#ai-key-err').textContent='API Key 不能为空';$('#ai-key-err').style.display='block';hasErr=true}
        if(!ep){$('#ai-ep-err').textContent='Endpoint 不能为空';$('#ai-ep-err').style.display='block';hasErr=true}
        if(!mdl){$('#ai-mdl-err').textContent='Model 不能为空';$('#ai-mdl-err').style.display='block';hasErr=true}
        if(hasErr)return;
        btn.disabled=true;btn.innerHTML='<span class="sp"></span>验证中...';
        const ms=$('#ai-msts');ms.style.display='flex';ms.style.background='rgba(139,92,246,.1)';ms.style.color='var(--ac)';ms.innerHTML='<span class="sp"></span>正在验证连通性...';
        const cfg={provider:prov.value,apiKey:key,endpoint:ep,model:mdl};
        const vr=await api('POST','/api/ai-status/verify',cfg);
        if(vr.ok&&vr.data&&vr.data.valid){
          ms.style.background='rgba(16,185,129,.1)';ms.style.color='var(--ok)';ms.innerHTML='<i class="bi bi-check-circle"></i>验证通过';
          ephAi=cfg;
          setTimeout(()=>{$('#ai-modal').style.display='none'},600);
        }else{
          const errMsg=(vr.data&&vr.data.error)||'验证失败，请检查配置';
          ms.style.background='rgba(239,68,68,.1)';ms.style.color='var(--err)';ms.innerHTML='<i class="bi bi-x-circle"></i>'+errMsg;
        }
        btn.disabled=false;btn.innerHTML='<i class="bi bi-plug"></i>验证并进入';
      });
    }
  }catch(e){console.error('ai-status check failed',e)}
})();

// Health
(async()=>{const el=$('#health');try{const r=await fetch(A+'/health');el.innerHTML=r.ok?'<span class="dot on"></span><span class="hl">在线</span>':'<span class="dot off"></span><span class="hl">异常</span>'}catch{el.innerHTML='<span class="dot off"></span><span class="hl">离线</span>'}})();

// Tabs
$$('.tb').forEach(b=>{b.addEventListener('click',()=>{$$('.tb').forEach(x=>x.classList.remove('on'));b.classList.add('on');$$('.tp').forEach(p=>p.classList.remove('on'));$('#tab-'+b.dataset.tab).classList.add('on')})});

// Ratio
$('#wf-rt').addEventListener('input',function(){$('#wf-rr').textContent=this.value;$('#wf-dr').textContent=100-this.value});

// Detective card data
const DET={detective:{icon:'bi-search',name:'正统侦探',desc:'严密逻辑推理，冷静克制，证据链环环相扣'},drama:{icon:'bi-emoji-laughing',name:'戏影侦探',desc:'谐音梗、无厘头、喜剧反转'},discover:{icon:'bi-compass',name:'寻迹侦探',desc:'多分支多结局，隐藏内容，高可重玩性'},destiny:{icon:'bi-heart',name:'命运侦探',desc:'命运交织，浪漫情感，宿命羁绊'},dream:{icon:'bi-cloud-moon',name:'幻梦侦探',desc:'梦幻叙事，真假不分，叙述性诡计'},dimension:{icon:'bi-robot',name:'赛博侦探',desc:'全息投影、传送门、太空飞船等高科技设定'},death:{icon:'bi-moon-stars',name:'幽冥侦探',desc:'民俗/日式/哥特/克苏鲁恐怖，充满未知'}};

// Detective card selection
$$('.det-card').forEach(c=>{c.addEventListener('click',()=>{$$('.det-card').forEach(x=>x.classList.remove('on'));c.classList.add('on');const v=c.dataset.val;$('#wf-sty').value=v;const d=DET[v];$('#wf-lock-icon').className='bi '+d.icon;$('#wf-lock-name').textContent=d.name;$('#wf-lock-desc').textContent=d.desc;$('#wf-cfg-panel').style.display='block'})});
$('#wf-sty-change').addEventListener('click',()=>{$('#wf-cfg-panel').style.display='none';$('#wf-sty').value='';$$('.det-card').forEach(x=>x.classList.remove('on'))});

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

// Step 1: Create session (with ephemeral AI config support)
$('#wf-bs').addEventListener('click',async()=>{const b=$('#wf-bs');b.disabled=true;b.innerHTML='<span class="sp"></span>创建中...';
const body={configId:ci,mode:$('#wf-md').value};
if(ephAi)body.ephemeralAiConfig=ephAi;
const r=await api('POST','/api/authoring-sessions',body);sr($('#wf-sr'),r.data,r.ok);
if(!r.ok){b.disabled=false;b.innerHTML='<i class="bi bi-arrow-right"></i>创建并推进';return}
si=r.data.id;saveHash();const adv=await api('POST','/api/authoring-sessions/'+si+'/advance');sr($('#wf-sr'),adv.data,adv.ok||adv.status===202);
b.disabled=false;b.innerHTML='<i class="bi bi-arrow-right"></i>创建并推进';
if(adv.ok||adv.status===202){go(2);ss($('#wf-ps'),'LLM 正在生成企划...','w');poll(hu)}});

// Enable/disable editing controls
function enableStep(step){
  if(step===2){$('#wf-pc2').disabled=false;$('#wf-pc2').placeholder='';$('#wf-psa').disabled=false;$('#wf-pa').disabled=false}
  if(step===3){$('#wf-oc').disabled=false;$('#wf-oc').placeholder='';$('#wf-osa').disabled=false;$('#wf-oa').disabled=false}
  if(step===4){$('#wf-cc').disabled=false;$('#wf-cc').placeholder='';$('#wf-csa').disabled=false;$('#wf-crg').disabled=false;$('#wf-ca').disabled=false}
}
function disableStep(step){
  if(step===2){$('#wf-pc2').disabled=true;$('#wf-psa').disabled=true;$('#wf-pa').disabled=true}
  if(step===3){$('#wf-oc').disabled=true;$('#wf-osa').disabled=true;$('#wf-oa').disabled=true}
  if(step===4){$('#wf-cc').disabled=true;$('#wf-csa').disabled=true;$('#wf-crg').disabled=true;$('#wf-ca').disabled=true}
}

// Poll handler
function hu(s){
  if(s.state==='failed'){sp();$$('.st')[cs].classList.add('er');const rm={2:'#wf-pr',3:'#wf-or',4:'#wf-chr'},sm={2:'#wf-ps',3:'#wf-os',4:'#wf-cs'};sr($(rm[cs]||'#wf-pr'),s.failureInfo||{error:'生成失败'},false);ss($(sm[cs]||'#wf-ps'),'生成失败','e');return}
  if(s.state==='plan_review'&&cs===2){sp();const c=s.planOutput?.authorEdited||s.planOutput?.llmOriginal;$('#wf-pc2').value=typeof c==='string'?c:JSON.stringify(c,null,2);ss($('#wf-ps'),'企划已生成，请审阅','o');sr($('#wf-pr'),s.planOutput,true);enableStep(2)}
  if(s.state==='design_review'&&cs<=3){sp();go(3);const c=s.outlineOutput?.authorEdited||s.outlineOutput?.llmOriginal;$('#wf-oc').value=typeof c==='string'?c:JSON.stringify(c,null,2);ss($('#wf-os'),'大纲已生成，请审阅','o');sr($('#wf-or'),s.outlineOutput,true);enableStep(3)}
  if(s.state==='chapter_review'&&cs<=4){sp();go(4);sch(s);enableStep(4)}
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
if(r.ok&&r.status!==202){const s=r.data;if(s.state==='completed'){b.disabled=false;b.innerHTML='<i class="bi bi-check-lg"></i>批准章节';go(5);sr($('#wf-ar'),s,true)}else if(s.state==='chapter_review'){b.disabled=false;b.innerHTML='<i class="bi bi-check-lg"></i>批准章节';sch(s)}else{b.disabled=false;b.innerHTML='<i class="bi bi-check-lg"></i>批准章节';ss($('#wf-cs'),'正在并行生成下一批章节...','w');poll(hu)}return}
ss($('#wf-cs'),'正在并行生成下一批章节，请稍候...','w');sr($('#wf-chr'),'后台并行生成中，请耐心等待...',true);
b.disabled=false;b.innerHTML='<i class="bi bi-check-lg"></i>批准章节';poll(hu)});

// Done
$('#wf-asm').addEventListener('click',async()=>{const b=$('#wf-asm');b.disabled=true;b.innerHTML='<span class="sp"></span>组装中...';const r=await api('POST','/api/authoring-sessions/'+si+'/assemble');sr($('#wf-ar'),r.data,r.ok);b.disabled=false;b.innerHTML='<i class="bi bi-box"></i>组装剧本';if(r.ok&&r.data&&r.data.id){$('#wf-exp').dataset.scriptId=r.data.id}});
$('#wf-exp').addEventListener('click',()=>{const sid=$('#wf-exp').dataset.scriptId;if(sid){window.open(A+'/api/scripts/'+sid+'/export','_blank')}else{alert('请先组装剧本')}});
$('#wf-rst').addEventListener('click',()=>{sp();ci=null;si=null;clearHash();go(0);['#wf-cr','#wf-sr','#wf-pr','#wf-or','#wf-chr','#wf-ar'].forEach(s=>{$(s).textContent='等待操作...';$(s).className='res'});$('#wf-pc2').value='';$('#wf-oc').value='';$('#wf-cc').value='';$('#wf-sty').value='';$('#wf-cfg-panel').style.display='none';$$('.det-card').forEach(x=>x.classList.remove('on'));delete $('#wf-exp').dataset.scriptId});
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
    if(step>=2&&s.planOutput){const c=s.planOutput.authorEdited||s.planOutput.llmOriginal;$('#wf-pc2').value=typeof c==='string'?c:JSON.stringify(c,null,2);enableStep(2)}
    if(step>=3&&s.outlineOutput){const c=s.outlineOutput.authorEdited||s.outlineOutput.llmOriginal;$('#wf-oc').value=typeof c==='string'?c:JSON.stringify(c,null,2);enableStep(3)}
    if(step>=4&&s.chapters){sch(s);enableStep(4)}
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

// History tab
async function loadHistory(){
  const el=$('#hist-list');el.innerHTML='<div style="color:var(--dim);font-size:.82rem"><span class="sp"></span> 加载中...</div>';
  try{
    const r=await api('GET','/api/scripts/export-all');
    if(!r.ok){el.innerHTML='<div style="color:var(--err);font-size:.82rem">加载失败</div>';return}
    if(!r.data||r.data.length===0){el.innerHTML='<div style="color:var(--dim);font-size:.82rem">暂无剧本</div>';return}
    el.innerHTML='';
    r.data.forEach(s=>{
      const d=document.createElement('div');d.className='hist-item';
      const dt=s.createdAt?new Date(s.createdAt).toLocaleString('zh-CN'):'';
      d.innerHTML='<div class="hist-info"><div class="hist-title">'+esc(s.title||'未命名')+'</div><div class="hist-meta"><span style="color:var(--ok)">'+esc(s.status)+'</span> · '+esc(dt)+'</div></div><a class="btn bs" href="'+A+s.exportUrl+'" target="_blank" style="font-size:.72rem;padding:.3rem .7rem;text-decoration:none"><i class="bi bi-download"></i>导出</a>';
      el.appendChild(d);
    });
  }catch(e){el.innerHTML='<div style="color:var(--err);font-size:.82rem">网络错误</div>'}
}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
$('#hist-refresh').addEventListener('click',loadHistory);
$$('.tb').forEach(b=>{if(b.dataset.tab==='history')b.addEventListener('click',loadHistory)});

// Work Log tab
function renderMd(md){return md.replace(/^### (.+)/gm,'<h3 style="color:var(--ac);font-size:.9rem;margin:1rem 0 .3rem;font-family:inherit">$1</h3>').replace(new RegExp('[*][*](.+?)[*][*]','g'),'<strong style="color:var(--bright)">$1</strong>').replace(/^---$/gm,'<hr style="border:0;border-top:1px solid var(--bdr);margin:.6rem 0">').replace(/^# (.+)/gm,'<h1 style="color:var(--bright);font-size:1.1rem;margin-bottom:.5rem;font-family:inherit">$1</h1>').replace(/^## (.+)/gm,'<h2 style="color:var(--ac2);font-size:.92rem;margin:1rem 0 .3rem;font-family:inherit">$1</h2>').replace(/^- (.+)/gm,'<div style="padding-left:.8rem;margin:.15rem 0">• $1</div>').replace(new RegExp('\\\\n','g'),'<br>')}
async function loadWorkLogRaw(){const el=$('#wl-raw-content');el.innerHTML='<span class="sp"></span> 加载中...';try{const r=await api('GET','/api/work-log/raw');if(r.ok&&r.data.content){el.innerHTML=renderMd(r.data.content)}else{el.innerHTML='<span style="color:var(--dim)">暂无工作日志</span>'}}catch{el.innerHTML='<span style="color:var(--err)">加载失败</span>'}}
async function loadDiaryList(){const el=$('#wl-diary-list');el.innerHTML='<span class="sp"></span> 加载中...';try{const r=await api('GET','/api/work-log/diary');if(!r.ok||!r.data.entries||r.data.entries.length===0){el.innerHTML='<div style="color:var(--dim);font-size:.82rem">暂无每日日记，请手动触发 daily-summary hook 生成</div>';return}el.innerHTML='';r.data.entries.forEach(e=>{const d=document.createElement('div');d.className='hist-item';d.style.cursor='pointer';d.innerHTML='<div class="hist-info"><div class="hist-title"><i class="bi bi-calendar-event" style="color:var(--ac);margin-right:.4rem"></i>'+esc(e.date)+'</div><div class="hist-meta">点击查看详情</div></div>';d.addEventListener('click',()=>loadDiaryDetail(e.date));el.appendChild(d)})}catch{el.innerHTML='<div style="color:var(--err);font-size:.82rem">加载失败</div>'}}
async function loadDiaryDetail(date){const el=$('#wl-diary-detail');el.style.display='block';el.innerHTML='<span class="sp"></span> 加载中...';try{const r=await api('GET','/api/work-log/diary/'+date);if(r.ok){el.innerHTML='<button class="btn bg" onclick="this.parentElement.style.display=&quot;none&quot;" style="font-size:.7rem;padding:.2rem .5rem;margin-bottom:.5rem"><i class="bi bi-arrow-left"></i>返回</button>'+renderMd(r.data.content)}else{el.innerHTML='<span style="color:var(--err)">'+esc(r.data.error||'加载失败')+'</span>'}}catch{el.innerHTML='<span style="color:var(--err)">网络错误</span>'}}
$$('.wl-sw').forEach(b=>{b.addEventListener('click',()=>{$$('.wl-sw').forEach(x=>x.classList.remove('on'));b.classList.add('on');const t=b.dataset.wl;$('#wl-raw-view').style.display=t==='raw'?'block':'none';$('#wl-diary-view').style.display=t==='diary'?'block':'none';if(t==='raw')loadWorkLogRaw();if(t==='diary')loadDiaryList()})});
$$('.tb').forEach(b=>{if(b.dataset.tab==='worklog')b.addEventListener('click',loadWorkLogRaw)});
})();
`;
