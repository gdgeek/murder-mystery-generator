(function(){
'use strict';
var A='',cs=0,ci=null,si=null,pt=null,ephAi=null;
var PROV_DEFAULTS={openai:{ep:'https://api.openai.com/v1/chat/completions',mdl:'gpt-4'},anthropic:{ep:'https://api.anthropic.com/v1/messages',mdl:'claude-3-sonnet'},doubao:{ep:'https://ark.cn-beijing.volces.com/api/v3/chat/completions',mdl:'doubao-seed-1-8-251228'},glm:{ep:'https://open.bigmodel.cn/api/paas/v4/chat/completions',mdl:'glm-4-plus'},deepseek:{ep:'https://api.deepseek.com/v1/chat/completions',mdl:'deepseek-chat'},custom:{ep:'',mdl:''}};
function $(s){return document.querySelector(s)}
function $$(s){return document.querySelectorAll(s)}
function sr(el,d,ok){el.textContent=typeof d==='string'?d:JSON.stringify(d,null,2);el.className='res '+(ok?'ok':'err')}
async function api(m,p,b){var o={method:m,headers:{'Content-Type':'application/json'}};if(b)o.body=JSON.stringify(b);var r=await fetch(A+p,o);var j=await r.json().catch(function(){return null});return{ok:r.ok,status:r.status,data:j}}

// URL hash persistence
function saveHash(){var p=new URLSearchParams();if(ci)p.set('config',ci);if(si)p.set('session',si);history.replaceState(null,'','#'+p.toString())}
function clearHash(){history.replaceState(null,'','/')}
function readHash(){var h=location.hash.slice(1);if(!h)return null;var p=new URLSearchParams(h);return{config:p.get('config'),session:p.get('session')}}
var STATE_STEP={draft:1,planning:2,plan_review:2,designing:3,design_review:3,executing:4,chapter_review:4,generating:2,completed:5,failed:-1};

// AI Config Modal
function showAiBadge(provider,model,source){
  var el=$('#ai-badge');if(!el)return;
  var isServer=source==='server';
  var tag=isServer?'环境配置':'用户输入';
  var label='<i class="bi bi-cpu"></i><span class="ai-src '+(isServer?'ai-src-s':'ai-src-u')+'">'+tag+'</span>'+(provider||'')+(model?' / '+model:'');
  el.innerHTML=label;
  el.style.display='inline-flex';el.className='ai-badge';
  if(isServer){el.style.cursor='default';el.onclick=null}
  else{el.style.cursor='pointer';el.onclick=function(){var cb=$('#ai-modal-close');if(cb)cb.style.display='inline-flex';showAiModalForSession(function(){location.reload()})}}
}
$('#ai-modal-close').addEventListener('click',function(){$('#ai-modal').style.display='none'});
(async function(){
  try{
    var r=await api('GET','/api/ai-status');
    if(r.ok&&r.data&&r.data.status==='configured'&&r.data.verified){showAiBadge(r.data.provider,r.data.model,'server')}
    else{
      if(r.ok&&r.data&&r.data.status==='configured'&&!r.data.verified){
        showAiBadge(r.data.provider,r.data.model,'server');
        var hint=$('.modal-box .hint');if(hint)hint.textContent='环境已配置 AI（'+(r.data.provider||'')+' / '+(r.data.model||'')+'），但连通性验证未通过。请输入有效的 AI 配置以继续。';
        var cb=$('#ai-modal-close');if(cb)cb.style.display='inline-flex';
      }
      $('#ai-modal').style.display='flex';
      var prov=$('#ai-prov');
      function fillDefaults(){var d=PROV_DEFAULTS[prov.value];if(d){$('#ai-ep').value=d.ep;$('#ai-mdl').value=d.mdl}}
      fillDefaults();
      prov.addEventListener('change',fillDefaults);
      $('#ai-verify').addEventListener('click',async function(){
        var btn=$('#ai-verify');
        var key=$('#ai-key').value.trim(),ep=$('#ai-ep').value.trim(),mdl=$('#ai-mdl').value.trim();
        $$('.ferr').forEach(function(e){e.style.display='none';e.textContent=''});
        var hasErr=false;
        if(!key){$('#ai-key-err').textContent='API Key 不能为空';$('#ai-key-err').style.display='block';hasErr=true}
        if(!ep){$('#ai-ep-err').textContent='Endpoint 不能为空';$('#ai-ep-err').style.display='block';hasErr=true}
        if(!mdl){$('#ai-mdl-err').textContent='Model 不能为空';$('#ai-mdl-err').style.display='block';hasErr=true}
        if(hasErr)return;
        btn.disabled=true;btn.innerHTML='<span class="sp"></span>验证中...';
        var ms=$('#ai-msts');ms.style.display='flex';ms.style.background='rgba(139,92,246,.1)';ms.style.color='var(--ac)';ms.innerHTML='<span class="sp"></span>正在验证连通性...';
        var cfg={provider:prov.value,apiKey:key,endpoint:ep,model:mdl};
        var vr=await api('POST','/api/ai-status/verify',{ephemeralAiConfig:cfg});
        if(vr.ok&&vr.data&&vr.data.valid){
          ms.style.background='rgba(16,185,129,.1)';ms.style.color='var(--ok)';ms.innerHTML='<i class="bi bi-check-circle"></i>验证通过';
          ephAi=cfg;
          showAiBadge(cfg.provider,cfg.model,'user');
          setTimeout(function(){$('#ai-modal').style.display='none'},600);
        }else{
          var errMsg=(vr.data&&vr.data.error)||'验证失败，请检查配置';
          ms.style.background='rgba(239,68,68,.1)';ms.style.color='var(--err)';ms.innerHTML='<i class="bi bi-x-circle"></i>'+errMsg;
        }
        btn.disabled=false;btn.innerHTML='<i class="bi bi-plug"></i>验证并进入';
      });
    }
  }catch(e){console.error('ai-status check failed',e)}
})();

// Health
(async function(){var el=$('#health');try{var r=await fetch(A+'/health');el.innerHTML=r.ok?'<span class="dot on"></span><span class="hl">在线</span>':'<span class="dot off"></span><span class="hl">异常</span>'}catch(e){el.innerHTML='<span class="dot off"></span><span class="hl">离线</span>'}})();

// Tabs
$$('.tb').forEach(function(b){b.addEventListener('click',function(){$$('.tb').forEach(function(x){x.classList.remove('on')});b.classList.add('on');$$('.tp').forEach(function(p){p.classList.remove('on')});$('#tab-'+b.dataset.tab).classList.add('on')})});

// Ratio
$('#wf-rt').addEventListener('input',function(){$('#wf-rr').textContent=this.value;$('#wf-dr').textContent=100-this.value});

// Detective card data
var DET={detective:{icon:'bi-search',name:'正统侦探',desc:'严密逻辑推理，冷静克制，证据链环环相扣'},drama:{icon:'bi-emoji-laughing',name:'戏影侦探',desc:'谐音梗、无厘头、喜剧反转'},discover:{icon:'bi-compass',name:'寻迹侦探',desc:'多分支多结局，隐藏内容，高可重玩性'},destiny:{icon:'bi-heart',name:'命运侦探',desc:'命运交织，浪漫情感，宿命羁绊'},dream:{icon:'bi-cloud-moon',name:'幻梦侦探',desc:'梦幻叙事，真假不分，叙述性诡计'},dimension:{icon:'bi-robot',name:'赛博侦探',desc:'全息投影、传送门、太空飞船等高科技设定'},death:{icon:'bi-moon-stars',name:'幽冥侦探',desc:'民俗/日式/哥特/克苏鲁恐怖，充满未知'}};

// Detective card selection
$$('.det-card').forEach(function(c){c.addEventListener('click',function(){$$('.det-card').forEach(function(x){x.classList.remove('on')});c.classList.add('on');var v=c.dataset.val;$('#wf-sty').value=v;var d=DET[v];$('#wf-lock-icon').className='bi '+d.icon;$('#wf-lock-name').textContent=d.name;$('#wf-lock-desc').textContent=d.desc;$('#wf-cfg-panel').style.display='block'})});
$('#wf-sty-change').addEventListener('click',function(){$('#wf-cfg-panel').style.display='none';$('#wf-sty').value='';$$('.det-card').forEach(function(x){x.classList.remove('on')})});

// Stepper
function go(n){cs=n;$$('.st').forEach(function(el){var s=+el.dataset.step;el.classList.remove('on','ok','er');if(s<n)el.classList.add('ok');else if(s===n)el.classList.add('on')});$$('.sp-p').forEach(function(el){el.style.display=(+el.dataset.step===n)?'block':'none'})}

// Poll
function sp(){if(pt){clearInterval(pt);pt=null}}
function poll(cb){sp();pt=setInterval(async function(){try{var r=await api('GET','/api/authoring-sessions/'+si);if(r.ok)cb(r.data)}catch(e){}},3000)}
function ss(el,msg,t){el.innerHTML='<div class="sts '+t+'">'+(t==='w'?'<span class="pl"></span>':'<i class="bi bi-'+(t==='o'?'check-circle':'x-circle')+'"></i>')+msg+'</div>'}

// Step 0: Create config
$('#wf-cf').addEventListener('submit',async function(e){e.preventDefault();var b=$('#wf-bc');b.disabled=true;b.innerHTML='<span class="sp"></span>创建中...';
var body={playerCount:+$('#wf-pc').value,durationHours:+$('#wf-dh').value,gameType:$('#wf-gt').value,ageGroup:$('#wf-ag').value,restorationRatio:+$('#wf-rt').value,deductionRatio:100-(+$('#wf-rt').value),language:$('#wf-ln').value,era:$('#wf-era').value,location:$('#wf-loc').value,theme:$('#wf-thm').value,style:$('#wf-sty').value};
var r=await api('POST','/api/configs',body);sr($('#wf-cr'),r.data,r.ok);b.disabled=false;b.innerHTML='<i class="bi bi-arrow-right"></i>创建配置并继续';
if(r.ok){ci=r.data.id;$('#wf-cid').textContent=ci;saveHash();go(1)}});

// Step 1: Create session (with ephemeral AI config support)
$('#wf-bs').addEventListener('click',async function(){var b=$('#wf-bs');b.disabled=true;b.innerHTML='<span class="sp"></span>创建中...';
var body={configId:ci,mode:$('#wf-md').value};
if(ephAi)body.ephemeralAiConfig=ephAi;
var r=await api('POST','/api/authoring-sessions',body);sr($('#wf-sr'),r.data,r.ok);
if(!r.ok){b.disabled=false;b.innerHTML='<i class="bi bi-arrow-right"></i>创建并推进';return}
si=r.data.id;saveHash();showSessionId(si);var adv=await api('POST','/api/authoring-sessions/'+si+'/advance');sr($('#wf-sr'),adv.data,adv.ok||adv.status===202);
b.disabled=false;b.innerHTML='<i class="bi bi-arrow-right"></i>创建并推进';
if(adv.ok||adv.status===202){go(2);disableStep(2);ss($('#wf-ps'),'LLM 正在生成企划...','w');poll(hu)}
else if(adv.data&&adv.data.error&&adv.data.error.indexOf('API Key')>=0){showAiModalForSession(function(){
go(2);disableStep(2);ss($('#wf-ps'),'LLM 正在生成企划...','w');
api('POST','/api/authoring-sessions/'+si+'/advance').then(function(a2){if(a2.ok||a2.status===202){poll(hu)}else{sr($('#wf-sr'),a2.data,false)}});
})}});

// Enable/disable editing controls
function enableStep(step){
  if(step===2){$('#wf-pc2').disabled=false;$('#wf-pc2').placeholder='';$('#wf-psa').disabled=false;$('#wf-pa').disabled=false}
  if(step===3){$('#wf-oc').disabled=false;$('#wf-oc').placeholder='';$('#wf-osa').disabled=false;$('#wf-oa').disabled=false}
  if(step===4){$('#wf-cc').disabled=false;$('#wf-cc').placeholder='';$('#wf-csa').disabled=false;$('#wf-crg').disabled=false;$('#wf-ca').disabled=false}
}
function disableStep(step){
  if(step===2){$('#wf-pc2').disabled=true;$('#wf-psa').disabled=true;$('#wf-pa').disabled=true}
  if(step===3){$('#wf-oc').disabled=true;$('#wf-osa').disabled=true;$('#wf-oa').disabled=true}
  if(step===4){$('#wf-cc').disabled=true;$('#wf-csa').disabled=true;$('#wf-crg').disabled=true;$('#wf-ca').disabled=true;$('#wf-ca').innerHTML='<i class="bi bi-check-lg"></i>批准章节'}
}

// Poll handler
function hu(s){
  // Update token display on every poll
  updateTokenDisplay(s);
  // Failed — show error with retry + change AI config buttons, and show existing outputs
  if(s.state==='failed'){
    sp();$$('.st')[cs].classList.add('er');
    var rm={2:'#wf-pr',3:'#wf-or',4:'#wf-chr'},sm={2:'#wf-ps',3:'#wf-os',4:'#wf-cs'};
    var errInfo=s.failureInfo||{error:'生成失败'};
    var errMsg=typeof errInfo==='string'?errInfo:(errInfo.error||errInfo.message||JSON.stringify(errInfo));
    sr($(rm[cs]||'#wf-pr'),errInfo,false);
    ss($(sm[cs]||'#wf-ps'),'<i class="bi bi-x-circle"></i> 生成失败：'+errMsg+'<button class="btn bw" onclick="retrySession()" style="margin-left:.5rem;font-size:.72rem;padding:.2rem .6rem"><i class="bi bi-arrow-repeat"></i>重试</button><button class="btn bw" onclick="changeAiAndRetry()" style="margin-left:.4rem;font-size:.72rem;padding:.2rem .6rem"><i class="bi bi-gear"></i>更换AI配置并重试</button>','e');
    // Populate existing outputs as read-only
    if(s.planOutput){var pc=s.planOutput.authorEdited||s.planOutput.llmOriginal;$('#wf-pc2').value=typeof pc==='string'?pc:JSON.stringify(pc,null,2);$('#wf-pc2').disabled=true}
    if(s.outlineOutput){var oc=s.outlineOutput.authorEdited||s.outlineOutput.llmOriginal;$('#wf-oc').value=typeof oc==='string'?oc:JSON.stringify(oc,null,2);$('#wf-oc').disabled=true}
    if(s.chapters&&s.chapters.length>0){sch(s);$('#wf-cc').disabled=true}
    disableStep(cs);
    return;
  }
  // Plan review — enable editing
  if(s.state==='plan_review'&&cs===2){
    sp();var c=s.planOutput&&(s.planOutput.authorEdited||s.planOutput.llmOriginal);
    $('#wf-pc2').value=typeof c==='string'?c:JSON.stringify(c,null,2);
    ss($('#wf-ps'),'企划已生成，请审阅','o');sr($('#wf-pr'),s.planOutput,true);enableStep(2);
  }
  // Design review — enable editing
  if(s.state==='design_review'&&cs<=3){
    sp();go(3);var c2=s.outlineOutput&&(s.outlineOutput.authorEdited||s.outlineOutput.llmOriginal);
    $('#wf-oc').value=typeof c2==='string'?c2:JSON.stringify(c2,null,2);
    ss($('#wf-os'),'大纲已生成，请审阅','o');sr($('#wf-or'),s.outlineOutput,true);enableStep(3);
  }
  // Chapter review — enable editing
  if(s.state==='chapter_review'&&cs<=4){sp();go(4);sch(s);enableStep(4)}
  // Completed
  if(s.state==='completed'){sp();go(5);sr($('#wf-ar'),s,true)}
  // Generating states — DISABLE all buttons, show progress
  if(['planning','designing','executing','generating'].indexOf(s.state)>=0){
    var batch=s.parallelBatch;
    var bm=batch?' (并行 '+(batch.completedIndices?batch.completedIndices.length:0)+'/'+batch.chapterIndices.length+')':'';
    if(cs===2){disableStep(2);ss($('#wf-ps'),'正在生成... '+s.state+bm,'w')}
    if(cs===3){disableStep(3);ss($('#wf-os'),'正在生成... '+s.state+bm,'w')}
    if(cs===4){disableStep(4);ss($('#wf-cs'),'正在并行生成中...'+bm,'w')}
  }
}
var CHTYPE={dm_handbook:'DM手册',player_handbook:'玩家手册',materials:'游戏物料集',branch_structure:'分支结构'};
function sch(s){var i=s.currentChapterIndex||0,ch=s.chapters&&s.chapters.find(function(c){return c.index===i}),c=ch?(typeof ch.content==='string'?ch.content:JSON.stringify(ch.content,null,2)):'';$('#wf-cc').value=c;
var batch=s.parallelBatch;
if(batch){var done=batch.reviewedIndices?batch.reviewedIndices.length:0;var total=batch.chapterIndices?batch.chapterIndices.length:0;var tl=ch?CHTYPE[ch.type]||'章节':'章节';ss($('#wf-cs'),'批量审阅 '+(done+1)+'/'+total+' — '+tl+'（索引'+i+'）','o')}
else{ss($('#wf-cs'),'章节 '+(i+1)+'/'+s.totalChapters+' — 请审阅','o')}
sr($('#wf-chr'),ch||'无章节数据',!!ch);
// Show failed chapters notice and retry button
var fcBox=$('#wf-fc-box');
if(fcBox){
  var fi=batch&&batch.failedIndices&&batch.failedIndices.length>0?batch.failedIndices:null;
  if(fi){
    fcBox.style.display='block';
    fcBox.innerHTML='<div class="sts e" style="flex-direction:column;align-items:flex-start;gap:.4rem"><div><i class="bi bi-exclamation-triangle"></i> 有 '+fi.length+' 个章节生成失败（索引：'+fi.join(', ')+'）</div><button class="btn bw" onclick="retryFailedChapters()" id="wf-rfc-btn" style="font-size:.72rem;padding:.2rem .6rem"><i class="bi bi-arrow-repeat"></i>重试失败章节</button></div>';
  }else{fcBox.style.display='none';fcBox.innerHTML=''}
}}

// Plan
$('#wf-psa').addEventListener('click',async function(){var r=await api('PUT','/api/authoring-sessions/'+si+'/phases/plan/edit',{content:$('#wf-pc2').value});sr($('#wf-pr'),r.data,r.ok)});
$('#wf-pa').addEventListener('click',async function(){var b=$('#wf-pa');b.disabled=true;b.innerHTML='<span class="sp"></span>批准中...';
var r=await api('POST','/api/authoring-sessions/'+si+'/phases/plan/approve');sr($('#wf-pr'),r.data,r.ok||r.status===202);
if(!r.ok&&r.status!==202){b.disabled=false;b.innerHTML='<i class="bi bi-check-lg"></i>批准并继续';if(r.data&&r.data.error&&r.data.error.indexOf('API Key')>=0){ss($('#wf-ps'),'AI 配置有误，请重新输入','e');showAiModalForSession(function(){
b.disabled=true;b.innerHTML='<span class="sp"></span>批准中...';disableStep(2);
api('POST','/api/authoring-sessions/'+si+'/phases/plan/approve').then(function(r2){
sr($('#wf-pr'),r2.data,r2.ok||r2.status===202);b.disabled=false;b.innerHTML='<i class="bi bi-check-lg"></i>批准并继续';
if(r2.ok||r2.status===202){go(3);ss($('#wf-os'),'LLM 正在生成大纲...','w');disableStep(3);poll(hu)}
else{ss($('#wf-ps'),'批准失败：'+(r2.data&&r2.data.error||'未知错误'),'e');enableStep(2)}});
})}else{ss($('#wf-ps'),'批准失败：'+(r.data&&r.data.error||'未知错误'),'e')}return}
disableStep(2);b.innerHTML='<i class="bi bi-check-lg"></i>批准并继续';
if(r.ok||r.status===202){go(3);ss($('#wf-os'),'LLM 正在生成大纲...','w');disableStep(3);poll(hu)}});

// Outline
$('#wf-osa').addEventListener('click',async function(){var r=await api('PUT','/api/authoring-sessions/'+si+'/phases/outline/edit',{content:$('#wf-oc').value});sr($('#wf-or'),r.data,r.ok)});
$('#wf-oa').addEventListener('click',async function(){var b=$('#wf-oa');b.disabled=true;b.innerHTML='<span class="sp"></span>批准中...';
var r=await api('POST','/api/authoring-sessions/'+si+'/phases/outline/approve');sr($('#wf-or'),r.data,r.ok||r.status===202);
if(!r.ok&&r.status!==202){b.disabled=false;b.innerHTML='<i class="bi bi-check-lg"></i>批准并继续';if(r.data&&r.data.error&&r.data.error.indexOf('API Key')>=0){ss($('#wf-os'),'AI 配置有误，请重新输入','e');showAiModalForSession(function(){
b.disabled=true;b.innerHTML='<span class="sp"></span>批准中...';disableStep(3);
api('POST','/api/authoring-sessions/'+si+'/phases/outline/approve').then(function(r2){
sr($('#wf-or'),r2.data,r2.ok||r2.status===202);b.disabled=false;b.innerHTML='<i class="bi bi-check-lg"></i>批准并继续';
if(r2.ok||r2.status===202){go(4);ss($('#wf-cs'),'LLM 正在生成章节...','w');disableStep(4);poll(hu)}
else{ss($('#wf-os'),'批准失败：'+(r2.data&&r2.data.error||'未知错误'),'e');enableStep(3)}});
})}else{ss($('#wf-os'),'批准失败：'+(r.data&&r.data.error||'未知错误'),'e')}return}
disableStep(3);b.innerHTML='<i class="bi bi-check-lg"></i>批准并继续';
if(r.ok||r.status===202){go(4);ss($('#wf-cs'),'LLM 正在生成章节...','w');disableStep(4);poll(hu)}});

// Chapter
$('#wf-csa').addEventListener('click',async function(){var r=await api('PUT','/api/authoring-sessions/'+si+'/phases/chapter/edit',{content:$('#wf-cc').value});sr($('#wf-chr'),r.data,r.ok)});
$('#wf-crg').addEventListener('click',async function(){disableStep(4);ss($('#wf-cs'),'正在重新生成章节...','w');var s=await api('GET','/api/authoring-sessions/'+si);var i=s.ok?(s.data.currentChapterIndex||0):0;var r=await api('POST','/api/authoring-sessions/'+si+'/chapters/'+i+'/regenerate');sr($('#wf-chr'),r.data,r.ok||r.status===202);if(!r.ok&&r.status!==202){ss($('#wf-cs'),'重新生成失败：'+(r.data&&r.data.error||'未知错误'),'e');enableStep(4);return}poll(hu)});
$('#wf-ca').addEventListener('click',async function(){var b=$('#wf-ca');b.disabled=true;b.innerHTML='<span class="sp"></span>批准中...';disableStep(4);ss($('#wf-cs'),'正在提交批准...','w');
var r=await api('POST','/api/authoring-sessions/'+si+'/phases/chapter/approve');
if(!r.ok&&r.status!==202){sr($('#wf-chr'),r.data,false);if(r.data&&r.data.error&&r.data.error.indexOf('API Key')>=0){ss($('#wf-cs'),'AI 配置有误，请重新输入','e');showAiModalForSession(function(){
disableStep(4);ss($('#wf-cs'),'正在提交批准...','w');
api('POST','/api/authoring-sessions/'+si+'/phases/chapter/approve').then(function(r2){
if(!r2.ok&&r2.status!==202){sr($('#wf-chr'),r2.data,false);ss($('#wf-cs'),'批准失败：'+(r2.data&&r2.data.error||'未知错误'),'e');enableStep(4);return}
if(r2.ok&&r2.status!==202){var s2=r2.data;if(s2.state==='completed'){go(5);sr($('#wf-ar'),s2,true)}else if(s2.state==='chapter_review'){sch(s2);enableStep(4)}else{ss($('#wf-cs'),'正在并行生成下一批章节...','w');poll(hu)}return}
ss($('#wf-cs'),'正在并行生成下一批章节，请稍候...','w');poll(hu)});
})}else{ss($('#wf-cs'),'批准失败：'+(r.data&&r.data.error||'未知错误'),'e')}enableStep(4);return}
if(r.ok&&r.status!==202){var s=r.data;if(s.state==='completed'){go(5);sr($('#wf-ar'),s,true)}else if(s.state==='chapter_review'){sch(s);enableStep(4)}else{ss($('#wf-cs'),'正在并行生成下一批章节...','w');poll(hu)}return}
ss($('#wf-cs'),'正在并行生成下一批章节，请稍候...','w');sr($('#wf-chr'),'后台并行生成中，请耐心等待...',true);poll(hu)});

// Done
$('#wf-asm').addEventListener('click',async function(){var b=$('#wf-asm');b.disabled=true;b.innerHTML='<span class="sp"></span>组装中...';var r=await api('POST','/api/authoring-sessions/'+si+'/assemble');sr($('#wf-ar'),r.data,r.ok);b.disabled=false;b.innerHTML='<i class="bi bi-box"></i>组装剧本';if(r.ok&&r.data&&r.data.id){$('#wf-exp').dataset.scriptId=r.data.id}});
$('#wf-exp').addEventListener('click',function(){var sid=$('#wf-exp').dataset.scriptId;if(sid){window.open(A+'/api/scripts/'+sid+'/export','_blank')}else{alert('请先组装剧本')}});
$('#wf-rst').addEventListener('click',function(){sp();ci=null;si=null;clearHash();go(0);$('#wf-sid-box').style.display='none';$('#wf-token-box').style.display='none';['#wf-cr','#wf-sr','#wf-pr','#wf-or','#wf-chr','#wf-ar'].forEach(function(s){$(s).textContent='等待操作...';$(s).className='res'});$('#wf-pc2').value='';$('#wf-oc').value='';$('#wf-cc').value='';$('#wf-sty').value='';$('#wf-cfg-panel').style.display='none';$$('.det-card').forEach(function(x){x.classList.remove('on')});delete $('#wf-exp').dataset.scriptId});
// Token usage display
function fmtTokens(t){if(!t)return '—';return 'P:'+t.prompt+' C:'+t.completion+' T:'+t.total}
function updateTokenDisplay(s){
  var box=$('#wf-token-box');if(!box)return;
  var hasData=s.lastStepTokens||s.tokenUsage;
  box.style.display=hasData?'block':'none';
  $('#wf-step-tokens').textContent=fmtTokens(s.lastStepTokens);
  $('#wf-total-tokens').textContent=fmtTokens(s.tokenUsage);
}

// Session ID display + copy
function showSessionId(id){
  var box=$('#wf-sid-box');if(!box||!id)return;
  $('#wf-sid-val').textContent=id;box.style.display='block';
}
$('#wf-sid-copy').addEventListener('click',function(){
  var val=$('#wf-sid-val').textContent;if(!val)return;
  navigator.clipboard.writeText(val).then(function(){
    var btn=$('#wf-sid-copy');btn.innerHTML='<i class="bi bi-check-lg"></i>已复制';
    setTimeout(function(){btn.innerHTML='<i class="bi bi-clipboard"></i>复制'},1500);
  }).catch(function(){
    var ta=document.createElement('textarea');ta.value=val;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    var btn=$('#wf-sid-copy');btn.innerHTML='<i class="bi bi-check-lg"></i>已复制';
    setTimeout(function(){btn.innerHTML='<i class="bi bi-clipboard"></i>复制'},1500);
  });
});
window.retrySession=async function(){
  var sm={2:'#wf-ps',3:'#wf-os',4:'#wf-cs'};
  if(sm[cs])ss($(sm[cs]),'正在重试...','w');
  disableStep(cs);
  var r=await api('POST','/api/authoring-sessions/'+si+'/retry');
  if(!r.ok){if(sm[cs])ss($(sm[cs]),'重试失败：'+(r.data&&r.data.error||'未知错误'),'e');return}
  await api('POST','/api/authoring-sessions/'+si+'/advance');
  poll(hu);
};
window.retryFailedChapters=async function(){
  var btn=$('#wf-rfc-btn');if(btn){btn.disabled=true;btn.innerHTML='<span class="sp"></span>重试中...'}
  disableStep(4);ss($('#wf-cs'),'正在重试失败章节...','w');
  var r=await api('POST','/api/authoring-sessions/'+si+'/retry-failed-chapters');
  if(!r.ok){
    ss($('#wf-cs'),'重试失败：'+(r.data&&r.data.error||'未知错误'),'e');
    enableStep(4);if(btn){btn.disabled=false;btn.innerHTML='<i class="bi bi-arrow-repeat"></i>重试失败章节'}
    return;
  }
  poll(hu);
};

// Show AI config modal for session — verify, update session config, then call onSuccess callback
function showAiModalForSession(onSuccess){
  var modal=$('#ai-modal');modal.style.display='flex';
  var ms=$('#ai-msts');ms.style.display='none';ms.innerHTML='';
  $$('.ferr').forEach(function(e){e.style.display='none';e.textContent=''});
  var verifyBtn=$('#ai-verify');
  var newBtn=verifyBtn.cloneNode(true);
  verifyBtn.parentNode.replaceChild(newBtn,verifyBtn);
  newBtn.id='ai-verify';
  newBtn.innerHTML='<i class="bi bi-plug"></i>验证并继续';
  newBtn.addEventListener('click',async function(){
    var key=$('#ai-key').value.trim(),ep=$('#ai-ep').value.trim(),mdl=$('#ai-mdl').value.trim();
    $$('.ferr').forEach(function(e){e.style.display='none';e.textContent=''});
    var hasErr=false;
    if(!key){$('#ai-key-err').textContent='API Key 不能为空';$('#ai-key-err').style.display='block';hasErr=true}
    if(!ep){$('#ai-ep-err').textContent='Endpoint 不能为空';$('#ai-ep-err').style.display='block';hasErr=true}
    if(!mdl){$('#ai-mdl-err').textContent='Model 不能为空';$('#ai-mdl-err').style.display='block';hasErr=true}
    if(hasErr)return;
    newBtn.disabled=true;newBtn.innerHTML='<span class="sp"></span>验证中...';
    ms.style.display='flex';ms.style.background='rgba(139,92,246,.1)';ms.style.color='var(--ac)';ms.innerHTML='<span class="sp"></span>正在验证连通性...';
    var cfg={provider:$('#ai-prov').value,apiKey:key,endpoint:ep,model:mdl};
    var vr=await api('POST','/api/ai-status/verify',{ephemeralAiConfig:cfg});
    if(!vr.ok||!vr.data||!vr.data.valid){
      var errMsg=(vr.data&&vr.data.error)||'验证失败，请检查配置';
      ms.style.background='rgba(239,68,68,.1)';ms.style.color='var(--err)';ms.innerHTML='<i class="bi bi-x-circle"></i>'+errMsg;
      newBtn.disabled=false;newBtn.innerHTML='<i class="bi bi-plug"></i>验证并继续';return;
    }
    ms.style.background='rgba(16,185,129,.1)';ms.style.color='var(--ok)';ms.innerHTML='<i class="bi bi-check-circle"></i>验证通过，正在更新配置...';
    ephAi=cfg;
    showAiBadge(cfg.provider,cfg.model,'user');
    if(si){
      var ur=await api('PUT','/api/authoring-sessions/'+si+'/ai-config',{ephemeralAiConfig:cfg});
      if(!ur.ok){
        ms.style.background='rgba(239,68,68,.1)';ms.style.color='var(--err)';ms.innerHTML='<i class="bi bi-x-circle"></i>'+(ur.data&&ur.data.error||'更新配置失败');
        newBtn.disabled=false;newBtn.innerHTML='<i class="bi bi-plug"></i>验证并继续';return;
      }
    }
    setTimeout(function(){modal.style.display='none'},400);
    if(onSuccess)onSuccess();
  });
}

window.changeAiAndRetry=function(){
  // Show the AI config modal for changing config on existing session
  var modal=$('#ai-modal');modal.style.display='flex';
  var ms=$('#ai-msts');ms.style.display='none';ms.innerHTML='';
  $('.ferr').forEach(function(e){e.style.display='none';e.textContent=''});
  // Replace the verify button handler temporarily
  var verifyBtn=$('#ai-verify');
  var newBtn=verifyBtn.cloneNode(true);
  verifyBtn.parentNode.replaceChild(newBtn,verifyBtn);
  newBtn.id='ai-verify';
  newBtn.innerHTML='<i class="bi bi-arrow-repeat"></i>更换配置并重试';
  newBtn.addEventListener('click',async function(){
    var key=$('#ai-key').value.trim(),ep=$('#ai-ep').value.trim(),mdl=$('#ai-mdl').value.trim();
    $('.ferr').forEach(function(e){e.style.display='none';e.textContent=''});
    var hasErr=false;
    if(!key){$('#ai-key-err').textContent='API Key 不能为空';$('#ai-key-err').style.display='block';hasErr=true}
    if(!ep){$('#ai-ep-err').textContent='Endpoint 不能为空';$('#ai-ep-err').style.display='block';hasErr=true}
    if(!mdl){$('#ai-mdl-err').textContent='Model 不能为空';$('#ai-mdl-err').style.display='block';hasErr=true}
    if(hasErr)return;
    newBtn.disabled=true;newBtn.innerHTML='<span class="sp"></span>更换中...';
    ms.style.display='flex';ms.style.background='rgba(139,92,246,.1)';ms.style.color='var(--ac)';ms.innerHTML='<span class="sp"></span>正在更换 AI 配置...';
    var cfg={provider:$('#ai-prov').value,apiKey:key,endpoint:ep,model:mdl};
    var ur=await api('PUT','/api/authoring-sessions/'+si+'/ai-config',{ephemeralAiConfig:cfg});
    if(!ur.ok){
      ms.style.background='rgba(239,68,68,.1)';ms.style.color='var(--err)';ms.innerHTML='<i class="bi bi-x-circle"></i>'+(ur.data&&ur.data.error||'更换失败');
      newBtn.disabled=false;newBtn.innerHTML='<i class="bi bi-arrow-repeat"></i>更换配置并重试';return;
    }
    ms.style.background='rgba(16,185,129,.1)';ms.style.color='var(--ok)';ms.innerHTML='<i class="bi bi-check-circle"></i>配置已更换，正在重试...';
    ephAi=cfg;
    showAiBadge(cfg.provider,cfg.model,'user');
    setTimeout(function(){modal.style.display='none'},400);
    // Now retry + advance
    var sm={2:'#wf-ps',3:'#wf-os',4:'#wf-cs'};
    if(sm[cs])ss($(sm[cs]),'正在重试...','w');
    disableStep(cs);
    var rr=await api('POST','/api/authoring-sessions/'+si+'/retry');
    if(!rr.ok){if(sm[cs])ss($(sm[cs]),'重试失败：'+(rr.data&&rr.data.error||'未知错误'),'e');return}
    await api('POST','/api/authoring-sessions/'+si+'/advance');
    poll(hu);
  });
};

// Quick config
$('#qf').addEventListener('submit',async function(e){e.preventDefault();var body={playerCount:+$('#q-pc').value,durationHours:+$('#q-dh').value,gameType:$('#q-gt').value,ageGroup:$('#q-ag').value,restorationRatio:60,deductionRatio:40,language:$('#q-ln').value,era:$('#q-era').value,location:$('#q-loc').value,theme:$('#q-thm').value,style:$('#q-sty').value};var r=await api('POST','/api/configs',body);sr($('#q-res'),r.data,r.ok)});

// Raw request
$('#r-go').addEventListener('click',async function(){var m=$('#r-m').value,u=$('#r-u').value;var b=null;if(['POST','PUT'].indexOf(m)>=0){try{b=JSON.parse($('#r-b').value||'{}')}catch(e){b=$('#r-b').value}}var r=await api(m,u,b);sr($('#r-res'),r.data,r.ok)});

// Restore session from URL hash on page load
async function restore(){
  var h=readHash();if(!h||!h.session)return;
  si=h.session;ci=h.config;
  if(ci)$('#wf-cid').textContent=ci;
  if(si)showSessionId(si);
  try{
    var r=await api('GET','/api/authoring-sessions/'+si);
    if(!r.ok){sr($('#wf-sr'),{error:'会话不存在或已过期',id:si},false);si=null;ci=null;clearHash();return}
    var s=r.data;ci=s.configId||ci;saveHash();
    updateTokenDisplay(s);
    var step=STATE_STEP[s.state];
    if(step===undefined||step<0){
      // Failed state — infer the step from existing outputs
      var failStep=2;
      if(s.chapters&&s.chapters.length>0)failStep=4;
      else if(s.outlineOutput)failStep=3;
      else if(s.planOutput)failStep=2;
      go(failStep);cs=failStep;
      var errInfo=s.failureInfo||{error:'生成失败'};
      var errMsg=typeof errInfo==='string'?errInfo:(errInfo.error||errInfo.message||JSON.stringify(errInfo));
      var rm={2:'#wf-pr',3:'#wf-or',4:'#wf-chr'};
      var sm={2:'#wf-ps',3:'#wf-os',4:'#wf-cs'};
      if(rm[failStep])sr($(rm[failStep]),errInfo,false);
      if(sm[failStep])ss($(sm[failStep]),'<i class="bi bi-x-circle"></i> 生成失败：'+errMsg+'<button class="btn bw" onclick="retrySession()" style="margin-left:.5rem;font-size:.72rem;padding:.2rem .6rem"><i class="bi bi-arrow-repeat"></i>重试</button><button class="btn bw" onclick="changeAiAndRetry()" style="margin-left:.4rem;font-size:.72rem;padding:.2rem .6rem"><i class="bi bi-gear"></i>更换AI配置并重试</button>','e');
      $$('.st')[failStep].classList.add('er');
      // Populate existing outputs as read-only
      if(s.planOutput){var pc=s.planOutput.authorEdited||s.planOutput.llmOriginal;$('#wf-pc2').value=typeof pc==='string'?pc:JSON.stringify(pc,null,2);$('#wf-pc2').disabled=true}
      if(s.outlineOutput){var oc=s.outlineOutput.authorEdited||s.outlineOutput.llmOriginal;$('#wf-oc').value=typeof oc==='string'?oc:JSON.stringify(oc,null,2);$('#wf-oc').disabled=true}
      if(s.chapters&&s.chapters.length>0){sch(s);$('#wf-cc').disabled=true}
      disableStep(failStep);
      return;
    }
    if(step<=1){go(step);return}
    if(step>=2&&s.planOutput){var c=s.planOutput.authorEdited||s.planOutput.llmOriginal;$('#wf-pc2').value=typeof c==='string'?c:JSON.stringify(c,null,2);enableStep(2)}
    if(step>=3&&s.outlineOutput){var c2=s.outlineOutput.authorEdited||s.outlineOutput.llmOriginal;$('#wf-oc').value=typeof c2==='string'?c2:JSON.stringify(c2,null,2);enableStep(3)}
    if(step>=4&&s.chapters){sch(s);enableStep(4)}
    go(step);
    if(['planning','designing','executing','generating'].indexOf(s.state)>=0){
      disableStep(step);
      var sm={2:'#wf-ps',3:'#wf-os',4:'#wf-cs'};
      if(sm[step])ss($(sm[step]),'正在生成... '+s.state,'w');
      poll(hu);
    } else if(s.state==='plan_review'){ss($('#wf-ps'),'企划已生成，请审阅','o');sr($('#wf-pr'),s.planOutput,true)}
    else if(s.state==='design_review'){ss($('#wf-os'),'大纲已生成，请审阅','o');sr($('#wf-or'),s.outlineOutput,true)}
    else if(s.state==='chapter_review'){ss($('#wf-cs'),'章节审阅中','o')}
    else if(s.state==='completed'){sr($('#wf-ar'),s,true)}
  }catch(e){console.error('restore failed',e)}
}
restore();

// Manual session restore via input
function showRestoreMsg(msg,ok){
  var el=$('#restore-msg');el.style.display='block';
  el.style.background=ok?'rgba(16,185,129,.1)':'rgba(239,68,68,.1)';
  el.style.color=ok?'var(--ok)':'var(--err)';
  el.textContent=msg;
}
function hideRestoreMsg(){$('#restore-msg').style.display='none'}
async function restoreFromInput(){
  var input=$('#restore-sid');var id=input.value.trim();
  if(!id){showRestoreMsg('请输入 Session ID',false);return}
  hideRestoreMsg();
  var btn=$('#restore-btn');btn.disabled=true;btn.innerHTML='<span class="sp"></span>恢复中...';
  try{
    var r=await api('GET','/api/authoring-sessions/'+id);
    if(!r.ok){showRestoreMsg('会话不存在或已过期',false);btn.disabled=false;btn.innerHTML='<i class="bi bi-box-arrow-in-right"></i>恢复';return}
    var s=r.data;
    sp();si=id;ci=s.configId||null;
    if(ci)$('#wf-cid').textContent=ci;
    showSessionId(si);saveHash();
    updateTokenDisplay(s);
    var step=STATE_STEP[s.state];
    if(step===undefined||step<0){
      go(1);
      if(s.state==='failed'){
        var errInfo=s.failureInfo||{error:'生成失败'};
        var errMsg=typeof errInfo==='string'?errInfo:(errInfo.error||errInfo.message||JSON.stringify(errInfo));
        // Show failed state at the step where it failed, infer from outputs
        var failStep=1;
        if(s.chapters&&s.chapters.length>0)failStep=4;
        else if(s.outlineOutput)failStep=3;
        else if(s.planOutput)failStep=2;
        go(failStep);
        var rm={2:'#wf-pr',3:'#wf-or',4:'#wf-chr'};
        var sm={2:'#wf-ps',3:'#wf-os',4:'#wf-cs'};
        if(rm[failStep])sr($(rm[failStep]),errInfo,false);
        if(sm[failStep])ss($(sm[failStep]),'<i class="bi bi-x-circle"></i> 生成失败：'+errMsg+'<button class="btn bw" onclick="retrySession()" style="margin-left:.5rem;font-size:.72rem;padding:.2rem .6rem"><i class="bi bi-arrow-repeat"></i>重试</button><button class="btn bw" onclick="changeAiAndRetry()" style="margin-left:.4rem;font-size:.72rem;padding:.2rem .6rem"><i class="bi bi-gear"></i>更换AI配置并重试</button>','e');
        $$('.st')[failStep].classList.add('er');
        disableStep(failStep);
      }
      // Populate existing outputs as read-only
      if(s.planOutput){var c=s.planOutput.authorEdited||s.planOutput.llmOriginal;$('#wf-pc2').value=typeof c==='string'?c:JSON.stringify(c,null,2);$('#wf-pc2').disabled=true}
      if(s.outlineOutput){var c2=s.outlineOutput.authorEdited||s.outlineOutput.llmOriginal;$('#wf-oc').value=typeof c2==='string'?c2:JSON.stringify(c2,null,2);$('#wf-oc').disabled=true}
      if(s.chapters&&s.chapters.length>0){sch(s);$('#wf-cc').disabled=true}
      showRestoreMsg('会话已恢复（状态：'+s.state+'）',true);
      btn.disabled=false;btn.innerHTML='<i class="bi bi-box-arrow-in-right"></i>恢复';
      return;
    }
    // Populate all existing outputs
    if(step>=2&&s.planOutput){var c=s.planOutput.authorEdited||s.planOutput.llmOriginal;$('#wf-pc2').value=typeof c==='string'?c:JSON.stringify(c,null,2);enableStep(2)}
    if(step>=3&&s.outlineOutput){var c2=s.outlineOutput.authorEdited||s.outlineOutput.llmOriginal;$('#wf-oc').value=typeof c2==='string'?c2:JSON.stringify(c2,null,2);enableStep(3)}
    if(step>=4&&s.chapters&&s.chapters.length>0){sch(s);enableStep(4)}
    go(step);
    // Handle generating states — start polling
    if(['planning','designing','executing','generating'].indexOf(s.state)>=0){
      disableStep(step);
      var sm={2:'#wf-ps',3:'#wf-os',4:'#wf-cs'};
      if(sm[step])ss($(sm[step]),'正在生成... '+s.state,'w');
      poll(hu);
    } else if(s.state==='plan_review'){ss($('#wf-ps'),'企划已生成，请审阅','o');sr($('#wf-pr'),s.planOutput,true)}
    else if(s.state==='design_review'){ss($('#wf-os'),'大纲已生成，请审阅','o');sr($('#wf-or'),s.outlineOutput,true)}
    else if(s.state==='chapter_review'){ss($('#wf-cs'),'章节审阅中','o')}
    else if(s.state==='completed'){sr($('#wf-ar'),s,true)}
    showRestoreMsg('会话已恢复（步骤 '+(step+1)+'，状态：'+s.state+'）',true);
  }catch(e){console.error('manual restore failed',e);showRestoreMsg('恢复失败：'+(e.message||'网络错误'),false)}
  btn.disabled=false;btn.innerHTML='<i class="bi bi-box-arrow-in-right"></i>恢复';
}
$('#restore-btn').addEventListener('click',restoreFromInput);
$('#restore-sid').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();restoreFromInput()}});

// History tab
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
async function loadHistory(){
  var el=$('#hist-list');el.innerHTML='<div style="color:var(--dim);font-size:.82rem"><span class="sp"></span> 加载中...</div>';
  try{
    var r=await api('GET','/api/scripts/export-all');
    if(!r.ok){el.innerHTML='<div style="color:var(--err);font-size:.82rem">加载失败</div>';return}
    if(!r.data||r.data.length===0){el.innerHTML='<div style="color:var(--dim);font-size:.82rem">暂无剧本</div>';return}
    el.innerHTML='';
    r.data.forEach(function(s){
      var d=document.createElement('div');d.className='hist-item';
      var dt=s.createdAt?new Date(s.createdAt).toLocaleString('zh-CN'):'';
      d.innerHTML='<div class="hist-info"><div class="hist-title">'+esc(s.title||'未命名')+'</div><div class="hist-meta"><span style="color:var(--ok)">'+esc(s.status)+'</span> · '+esc(dt)+'</div></div><a class="btn bs" href="'+A+s.exportUrl+'" target="_blank" style="font-size:.72rem;padding:.3rem .7rem;text-decoration:none"><i class="bi bi-download"></i>导出</a>';
      el.appendChild(d);
    });
  }catch(e){el.innerHTML='<div style="color:var(--err);font-size:.82rem">网络错误</div>'}
}
$('#hist-refresh').addEventListener('click',loadHistory);
$$('.tb').forEach(function(b){if(b.dataset.tab==='history')b.addEventListener('click',loadHistory)});

// Work Log tab
function renderMd(md){
  return md
    .replace(/^### (.+)/gm,'<h3 style="color:var(--ac);font-size:.9rem;margin:1rem 0 .3rem;font-family:inherit">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g,'<strong style="color:var(--bright)">$1</strong>')
    .replace(/^---$/gm,'<hr style="border:0;border-top:1px solid var(--bdr);margin:.6rem 0">')
    .replace(/^# (.+)/gm,'<h1 style="color:var(--bright);font-size:1.1rem;margin-bottom:.5rem;font-family:inherit">$1</h1>')
    .replace(/^## (.+)/gm,'<h2 style="color:var(--ac2);font-size:.92rem;margin:1rem 0 .3rem;font-family:inherit">$1</h2>')
    .replace(/^- (.+)/gm,'<div style="padding-left:.8rem;margin:.15rem 0">• $1</div>')
    .replace(/\\n/g,'<br>');
}
async function loadWorkLogRaw(){var el=$('#wl-raw-content');el.innerHTML='<span class="sp"></span> 加载中...';try{var r=await api('GET','/api/work-log/raw');if(r.ok&&r.data.content){el.innerHTML=renderMd(r.data.content)}else{el.innerHTML='<span style="color:var(--dim)">暂无工作日志</span>'}}catch(e){el.innerHTML='<span style="color:var(--err)">加载失败</span>'}}
async function loadDiaryList(){var el=$('#wl-diary-list');el.innerHTML='<span class="sp"></span> 加载中...';try{var r=await api('GET','/api/work-log/diary');if(!r.ok||!r.data.entries||r.data.entries.length===0){el.innerHTML='<div style="color:var(--dim);font-size:.82rem">暂无每日日记，请手动触发 daily-summary hook 生成</div>';return}el.innerHTML='';r.data.entries.forEach(function(e){var d=document.createElement('div');d.className='hist-item';d.style.cursor='pointer';d.innerHTML='<div class="hist-info"><div class="hist-title"><i class="bi bi-calendar-event" style="color:var(--ac);margin-right:.4rem"></i>'+esc(e.date)+'</div><div class="hist-meta">点击查看详情</div></div>';d.addEventListener('click',function(){loadDiaryDetail(e.date)});el.appendChild(d)})}catch(e){el.innerHTML='<div style="color:var(--err);font-size:.82rem">加载失败</div>'}}
async function loadDiaryDetail(date){var el=$('#wl-diary-detail');el.style.display='block';el.innerHTML='<span class="sp"></span> 加载中...';try{var r=await api('GET','/api/work-log/diary/'+date);if(r.ok){el.innerHTML='<button class="btn bg" onclick="this.parentElement.style.display=&quot;none&quot;" style="font-size:.7rem;padding:.2rem .5rem;margin-bottom:.5rem"><i class="bi bi-arrow-left"></i>返回</button>'+renderMd(r.data.content)}else{el.innerHTML='<span style="color:var(--err)">'+esc((r.data&&r.data.error)||'加载失败')+'</span>'}}catch(e){el.innerHTML='<span style="color:var(--err)">网络错误</span>'}}
$$('.wl-sw').forEach(function(b){b.addEventListener('click',function(){$$('.wl-sw').forEach(function(x){x.classList.remove('on')});b.classList.add('on');var t=b.dataset.wl;$('#wl-raw-view').style.display=t==='raw'?'block':'none';$('#wl-diary-view').style.display=t==='diary'?'block':'none';if(t==='raw')loadWorkLogRaw();if(t==='diary')loadDiaryList()})});
$$('.tb').forEach(function(b){if(b.dataset.tab==='worklog')b.addEventListener('click',loadWorkLogRaw)});
})();
