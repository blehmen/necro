const SKEY="sr-pwa-state-v06";
let tesseractPromise=null;
let guide=[], tips=[], cfg={}, state=null, pendingDetected=null, templateCache=[];
const $=id=>document.getElementById(id);
const DAY_START={1:0,2:37,3:60};
const boardOptions=[
 'Furnace L1','Furnace L2','Furnace L3','Furnace L4','Furnace L5','Cannon L1','Cannon L2','Cannon L3','Cannon L4','Cannon L5',
 'Anvil L1','Anvil L2','Anvil L3','Anvil L4','Anvil L5','Alchemy Table L1','Alchemy Table L2','Alchemy Table L3',
 'Weapon L1','Weapon L2','Weapon L3','Weapon L4','Weapon L5','Weapon L6','Iron Grunt','Gunpowder Grunt','Steel Grunt','Musketeer','Warrior','Battle Mage','Bomb L1','Bomb L2','Decoy','Fancy Decoy','Magic Decoy','Banner'
];
const stationDefs=[
 ['f1','Furnace L1 count',0],['f2','Furnace L2 count',0],['f3','Furnace L3 count',0],['f4','Furnace L4 count',0],['f5','Furnace L5 count',0],
 ['c1','Cannon L1 count',0],['c2','Cannon L2 count',0],['c3','Cannon L3 count',0],['c4','Cannon L4 count',0],['c5','Cannon L5 count',0],
 ['anvil','Anvil level',4],['at','Alchemy Table level',2],['ironCap','Iron cap',300000],['crates','Max-level Iron Crates held',0],['banners','Complete banners on board',0],['damageHour','Cannon damage/hour',169000],['scoreMult','Score multiplier',1.3],['bombUp','Bomb damage upgrades maxed',false],['mageHp','Mage/Magic Decoy HP currently/planned',316000]
];
async function load(){
 // Initialize a usable local state BEFORE binding. Screenshot import must work
 // even while JSON data or OCR libraries are still loading.
 const fallback={score:0,iron:0,gunpowder:0,steel:0,gems:0,eventEnd:null,sleeping:false,sleepStarted:null,sleepWake:null,completed:{},board:{},stations:{},lastScreenshot:null};
 state=normalize(JSON.parse(localStorage.getItem(SKEY)||'null')||fallback);
 bind();
 try {
   const [g,t,c,d] = await Promise.all([
     fetch('data/guide.json').then(r=>{if(!r.ok)throw new Error('guide.json '+r.status);return r.json()}),
     fetch('data/tips.json').then(r=>{if(!r.ok)throw new Error('tips.json '+r.status);return r.json()}),
     fetch('data/forecast.json').then(r=>{if(!r.ok)throw new Error('forecast.json '+r.status);return r.json()}),
     fetch('data/default-state.json').then(r=>{if(!r.ok)throw new Error('default-state.json '+r.status);return r.json()})
   ]);
   guide=g; tips=t; cfg=c;
   state=JSON.parse(localStorage.getItem(SKEY)||'null')||normalize(d);
 } catch(e) {
   console.error('PWA data load failed:',e);
   guide=Array.isArray(guide)?guide:[]; tips=Array.isArray(tips)?tips:[];
   cfg=cfg&&cfg.sourceGuidance?cfg:{sourceGuidance:[]};
   const fallback={score:0,iron:0,gunpowder:0,steel:0,gems:0,eventEnd:null,sleeping:false,sleepStarted:null,sleepWake:null,completed:{},board:{},stations:{},lastScreenshot:null};
   state=normalize(JSON.parse(localStorage.getItem(SKEY)||'null')||fallback);
   showAppError('Some guide data could not be loaded. Screenshot import is still available.');
 }
 renderAll();
}
function showAppError(msg){
 const el=$('appStatus');
 if(el){el.hidden=false;el.textContent=msg;}
}
function normalize(s){
 s=s||{};s.score=+s.score||0;s.iron=+s.iron||0;s.gunpowder=+s.gunpowder||0;s.steel=+s.steel||0;s.gems=+s.gems||0;
 s.eventEnd=s.eventEnd||null;s.sleeping=!!s.sleeping;s.sleepStarted=s.sleepStarted||null;s.sleepWake=s.sleepWake||null;s.completed=s.completed||{};s.board=s.board||{};s.stations=Object.assign({},s.stations||{});s.lastScreenshot=s.lastScreenshot||null;return s;
}
function save(){localStorage.setItem(SKEY,JSON.stringify(state))}
function bind(){
 ['score','iron','gp','steel','gems'].forEach(id=>$(id).addEventListener('change',e=>{state[id==='gp'?'gunpowder':id]=Math.max(0,Number(e.target.value)||0);save();renderAll()}));
 $('resetBtn').onclick=()=>{if(confirm('Reset the local event state?')){localStorage.removeItem(SKEY);location.reload()}};
 $('screenshotBtn').onclick=()=>$('fileInput').click();
 $('fileInput').onchange=e=>{
   const file=e.target.files&&e.target.files[0];
   if(!file)return;
   analyzeScreenshot(file).catch(err=>{
     console.error('Screenshot analysis failed:',err);
     $('ocrStatus').textContent='Screenshot could not be processed: '+(err?.message||err);
     showAppError('Screenshot processing failed. The image preview is still available.');
   });
 };
 $('setEventBtn').onclick=()=>{const v=prompt('Enter event end time in local time, e.g. 2026-10-10T14:00');if(v){const d=new Date(v);if(!isNaN(d)){state.eventEnd=d.toISOString();save();renderAll()}}};
 $('sleepBtn').onclick=()=>sleep();$('wakeBtn').onclick=()=>wake();$('closeShot').onclick=()=>$('screenshotCard').hidden=true;
 $('applyDetected').onclick=applyDetected;$('discardDetected').onclick=()=>{$('screenshotCard').hidden=true;pendingDetected=null};
 $('dayFilter').onchange=renderGuide;$('hideDone').onchange=renderGuide;
 $('addBoard').onclick=()=>{let n='Musketeer',i=1;while(state.board[n])n='Musketeer '+(++i);state.board[n]=1;save();renderAll()};
 $('clearBoard').onclick=()=>{if(confirm('Clear all board counts?')){state.board={};save();renderAll()}};
 document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tabpane').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.tab+'Tab').classList.add('active')});
}
function renderAll(){renderInputs();renderTimer();renderStations();renderGuide();renderNext();renderTips();renderBoard();renderForecast();renderSleep();clearTimeout(window.__rt);window.__rt=setTimeout(renderAll,1000)}
function renderInputs(){$('score').value=state.score;$('iron').value=state.iron;$('gp').value=state.gunpowder;$('steel').value=state.steel;$('gems').value=state.gems}
function remaining(){return state.eventEnd?Math.max(0,new Date(state.eventEnd)-Date.now()):null}
function fmt(ms){if(ms==null)return 'Set event end time';let s=Math.floor(ms/1000),d=Math.floor(s/86400);s%=86400;let h=Math.floor(s/3600);s%=3600;let m=Math.floor(s/60);let sec=s%60;return `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`}
function renderTimer(){let r=remaining();$('eventTimer').textContent=fmt(r);let pct=r==null?0:Math.max(0,Math.min(100,100-r/(3*86400000)*100));$('eventProgress').style.width=pct+'%'}
function dayFor(i){return guide[i]?.day||3}
function targetMs(s){if(!s)return null;let m=0,d=0,h=0;let md=s.match(/(\d+)d/),mh=s.match(/(\d+)h/),mm=s.match(/(\d+)m/);if(md)d=+md[1];if(mh)h=+mh[1];if(mm)m=+mm[1];return ((d*24+h)*60+m)*60000}
function dueText(step){let r=remaining(),t=targetMs(step.time);if(r==null||t==null)return 'No fixed time';let diff=r-t;if(Math.abs(diff)<60000)return 'Due now';return diff>0?`Due in ${fmt(diff)}`:`Overdue by ${fmt(-diff)}`}
function renderGuide(){const filter=$('dayFilter').value,hide=$('hideDone').checked;$('guideList').innerHTML='';guide.forEach((x,i)=>{const done=!!state.completed[i];if(hide&&done)return;if(filter!=='all'&&String(x.day)!==filter)return;const d=document.createElement('div');d.className='checkrow'+(done?' done':'');const gp=Number(x.gp),st=Number(x.steel);const cost=(Number.isFinite(gp)?gp:0)||(Number.isFinite(st)?st:0);d.innerHTML=`<input type="checkbox" ${done?'checked':''}><div class="grow"><div class="action">${escapeHtml(x.action)}</div><div class="meta">Day ${x.day} · GP ${x.gp||'—'} · Steel ${x.steel||'—'} · ${escapeHtml(x.time||'no fixed time')} · <b>${dueText(x)}</b></div>${x.tips?`<div class="tips">${escapeHtml(x.tips)}</div>`:''}</div>`;d.querySelector('input').onchange=e=>{state.completed[i]=e.target.checked;save();renderAll()};$('guideList').appendChild(d)})}
function nextIndex(){for(let i=0;i<guide.length;i++)if(!state.completed[i])return i;return guide.length}
function renderNext(){let i=nextIndex();if(i>=guide.length){$('dayBadge').textContent='Complete';$('nextAction').innerHTML='<div class="step-title">Guide checklist complete</div>';return}const x=guide[i], gp=Number(x.gp)||0, st=Number(x.steel)||0, haveGp=state.gunpowder,haveSt=state.steel;let blocking=[];if(gp>haveGp)blocking.push(`${fmtNum(gp-haveGp)} GP short`);if(st>haveSt)blocking.push(`${fmtNum(st-haveSt)} Steel short`);$('dayBadge').textContent=`Day ${x.day}`;$('nextAction').innerHTML=`<div class="step-title">☐ ${escapeHtml(x.action)}</div><div class="meta">Step ${i+1}/67 · ${escapeHtml(x.time||'no fixed time')} · ${dueText(x)}</div>${blocking.length?`<div class="warning">WAIT: ${blocking.join(' and ')}. Do not spend the reserved resource.</div>`:''}${x.tips?`<div class="why">${escapeHtml(x.tips)}</div>`:''}<button class="small secondary" onclick="document.querySelector('[data-tab=guide]').click()">Open checklist</button>`}
function renderTips(){$('tips').innerHTML=`<div class="notice">Source forecast assumptions</div>`+cfg.sourceGuidance.map(t=>`<div class="checkrow"><div><div class="action">Forecast guidance</div><div class="tips">${escapeHtml(t)}</div></div></div>`).join('')+tips.map(t=>`<div class="checkrow"><div><div class="action">Guide rule</div><div class="tips">${escapeHtml(t)}</div></div></div>`).join('')}
function renderStations(){const s=state.stations;$('stationInputs').innerHTML=stationDefs.map(([k,label,def])=>{let v=s[k]??def;if(typeof def==='boolean')return `<label>${label}<input data-st="${k}" type="checkbox" ${v?'checked':''}></label>`;let type=k==='anvil'||k==='at'?'number':'number';return `<label>${label}<input data-st="${k}" type="${type}" inputmode="decimal" value="${escapeHtml(v)}"></label>`}).join('');$('stationInputs').querySelectorAll('[data-st]').forEach(el=>el.onchange=()=>{let k=el.dataset.st;state.stations[k]=el.type==='checkbox'?el.checked:Number(el.value)||0;save();renderAll()})}
function renderBoard(){let entries=Object.entries(state.board).filter(([,v])=>v>0);$('board').innerHTML=entries.length?entries.map(([k,v])=>`<div class="board-item"><select data-k="${escapeHtml(k)}">${boardOptions.map(o=>`<option ${o===k?'selected':''}>${escapeHtml(o)}</option>`).join('')}</select><input data-v="${escapeHtml(k)}" type="number" min="0" value="${v}"></div>`).join(''):'<div class="muted">No board counts entered yet.</div>';$('board').querySelectorAll('select').forEach(s=>s.onchange=()=>{const old=s.dataset.k,n=s.value;state.board[n]=(state.board[n]||0)+(state.board[old]||0);if(n!==old)delete state.board[old];save();renderAll()});$('board').querySelectorAll('input').forEach(inp=>inp.onchange=()=>{state.board[inp.dataset.v]=Math.max(0,Number(inp.value)||0);save();renderAll()})}
function count(name){return Number(state.board[name]||0)}
function forecast(){
 const ms=remaining(),hours=ms?ms/3600000:0,s=state.stations||{};
 const ironRate=(s.f1||0)*3+(s.f2||0)*5+(s.f3||0)*8+(s.f4||0)*15+(s.f5||0)*25;
 const timeH=Math.max(0,hours),remainingMin=timeH*60;
 const banners=Math.max(0,(s.banners||0)+((remainingMin<40&&remainingMin>0)?0:1)+Math.floor(remainingMin/40));
 const maxCrates=Math.floor(banners/2),cap=s.ironCap||300000;
 const ironFromCrates=(s.crates||0)*cap*.12,maxCrateIron=maxCrates*cap*.12,gruntIron=(maxCrates*cap*.12)+(Math.max(0,banners-2*maxCrates)*cap*.05);
 const ironForecast=state.iron+ironRate*timeH+ironFromCrates+gruntIron;
 const an='Anvil'+(s.anvil||4), at='AT'+(s.at||2), av=cfg.anvil[an]||cfg.anvil.Anvil4;
 const heldM=count('Musketeer'),heldW=count('Warrior');
 const genM=av?Math.floor(ironForecast/av.muskIron):0,genW=av?Math.floor(ironForecast/av.warriorIron):0,totalM=heldM+genM,totalW=heldW+genW;
 const totalGrunts=banners; const cannonDmg=(s.damageHour||0)*timeH; const nonMageHp=totalM*25000+totalW*50000+totalGrunts*4000;
 const gpGen=Math.floor((totalM+totalW)/2)*30+(Math.floor((totalM+totalW))%2)*12; const steelGen=Math.floor((totalW+totalM)/2)*30+(Math.floor(totalW+totalM)%2)*12;
 const totalGP=state.gunpowder+gpGen,totalSteel=state.steel+steelGen;
 const atInfo=cfg.at[at]||cfg.at.AT2; const opts=[];
 for(const shop of [false,true]){const o=shop?atInfo.shop:atInfo.noShop;if(totalGP<o.gp||totalSteel<o.steel){opts.push({shop,gp:totalGP,steel:totalSteel,mages:0,t1:0,t2:0,bomb:0,possible:false});continue}const m=Math.max(0,Math.floor((totalGP-(shop? (at==='AT3'?90:50):(at==='AT3'?80:40)))/40));const t1=Math.max(0,Math.floor((timeH*60-(o.t1Time))/ (at==='AT3'?20:28)));const t2=Math.floor(t1/2),left=t1-2*t2,bomb=t2*150000+left*50000;opts.push({shop,gp:totalGP,steel:totalSteel,mages:m,t1,t2,bomb,possible:true})}
 const best=opts.filter(x=>x.possible).sort((a,b)=>b.mages-a.mages||b.bomb-a.bomb)[0]||opts[0];
 const maxMages=best?.mages||0; const mageHp=maxMages*500000+(s.mageHp||0); const totalDmg=cannonDmg+(best?.bomb||0); const canKillAll=totalDmg>=nonMageHp+mageHp; const delta=cannonDmg-nonMageHp; const scoreMult=s.scoreMult||1; const incoming=(totalGrunts*2000+totalM*15000+totalW*50000+maxMages*750000)*scoreMult; const scoreForecast=state.score+incoming;
 return {timeH,banners,maxCrates,ironRate,ironForecast,heldM,heldW,genM,genW,totalM,totalW,totalGrunts,cannonDmg,nonMageHp,gpGen,steelGen,totalGP,totalSteel,opts,best,maxMages,mageHp,totalDmg,canKillAll,delta,scoreForecast,scoreMult};
}
function renderForecast(){const f=forecast();const overflow=f.delta-500000;const rec=f.delta<500000?'More cannon damage / fewer target HP is recommended before relying on endgame Mage kills.':f.canKillAll?'Use max bombs and let cannons finish the Mages.':'Sacrifice one or more Mage kills and recalculate; cannon + bomb damage does not cover the maximum Mage HP.';$('forecast').innerHTML=`<div class="forecast-grid"><div class="forecastbox"><div class="muted">IRON</div><b>${fmtNum(f.ironForecast)}</b><small>${fmtNum(f.ironRate)}/h from Furnaces</small></div><div class="forecastbox"><div class="muted">EXPECTED ENEMIES</div><b>${f.totalM} Musk · ${f.totalW} Warrior · ${f.totalGrunts} Grunt</b><small>${f.banners} banner cycles assumed</small></div><div class="forecastbox"><div class="muted">RESOURCES</div><b>${fmtNum(f.totalGP)} GP · ${fmtNum(f.totalSteel)} Steel</b><small>after forecast generation</small></div><div class="forecastbox"><div class="muted">CANNON</div><b>${fmtNum(f.cannonDmg)} damage</b><small>${fmtNum(f.delta)} over non-Mage HP</small></div><div class="forecastbox"><div class="muted">MAGES</div><b>${f.maxMages}</b><small>${fmtNum(f.best?.bomb||0)} max bomb damage</small></div><div class="forecastbox"><div class="muted">SCORE FORECAST</div><b>${fmtNum(f.scoreForecast)}</b><small>using ${f.scoreMult}× multiplier</small></div></div><div class="recommend ${f.canKillAll?'good':'warning'}"><b>Endgame recommendation</b><br>${rec}<br><span class="muted">Source target: aim for roughly 500k–1M cannon-damage overflow over non-Mage HP because sleep can cause damage to hit Mages.</span></div><h3>Alchemy Table options</h3><div class="optiongrid">${f.opts.map(o=>`<div class="forecastbox"><b>AT${safenum(state.stations.at,2)} · ${o.shop?'Shop':'No shop'}</b><div>${o.possible?`${o.mages} Mages · ${o.t2} T2 + ${o.t1-2*o.t2} T1 bombs`:'Insufficient GP/Steel'}</div><small>${o.gp} GP / ${o.steel} Steel available</small></div>`).join('')}</div><div class="notice">Assumptions from the source forecast: bombs are used, bomb-damage upgrades are maxed, floating weapons add no damage, and each T2 bomb can contribute its full 150k to a Mage.</div>`}
function safenum(v,d){return Number(v)||d}
function sleep(){let h=prompt('Expected sleep duration in hours','7');h=Number(h);if(!h||h<0)return;state.sleeping=true;state.sleepStarted=new Date().toISOString();state.sleepWake=new Date(Date.now()+h*3600000).toISOString();save();renderAll()}
function wake(){state.sleeping=false;state.sleepStarted=null;state.sleepWake=null;save();renderAll();$('screenshotBtn').click()}
function renderSleep(){$('sleepBtn').hidden=state.sleeping;$('wakeBtn').hidden=!state.sleeping;$('sleepInfo').hidden=!state.sleeping;if(state.sleeping){const r=Math.max(0,new Date(state.sleepWake)-Date.now());$('sleepInfo').textContent=`Sleep mode: ${fmt(r)} until ${new Date(state.sleepWake).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}. The event timer continues while asleep. On wake, update from a fresh screenshot.`}}
function fmtNum(n){return Math.round(Number(n)||0).toLocaleString()}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function parseCompact(s){if(!s)return null;s=String(s).replace(/,/g,'').replace(/\s/g,'').replace(/[Oo]/g,'0');let m=s.match(/(-?[0-9]+(?:\.[0-9]+)?)([kKmMbB])?/);if(!m)return null;let n=Number(m[1]);const u=(m[2]||'').toLowerCase();if(u==='k')n*=1e3;if(u==='m')n*=1e6;if(u==='b')n*=1e9;return Math.round(n)}
async function ensureTesseract(){
 if(window.Tesseract)return true;
 if(tesseractPromise)return tesseractPromise;
 tesseractPromise=new Promise(resolve=>{
   const script=document.createElement('script');
   script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
   script.async=true;
   script.onload=()=>resolve(!!window.Tesseract);
   script.onerror=()=>resolve(false);
   document.head.appendChild(script);
 });
 return tesseractPromise;
}
async function ocrCrop(img,box){const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*(box[2]-box[0]));c.height=Math.round(img.naturalHeight*(box[3]-box[1]));const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(img,img.naturalWidth*box[0],img.naturalHeight*box[1],img.naturalWidth*(box[2]-box[0]),img.naturalHeight*(box[3]-box[1]),0,0,c.width,c.height);const r=await Tesseract.recognize(c,'eng',{logger:m=>{if(m.status==='recognizing text')$('ocrStatus').textContent=`OCR ${Math.round((m.progress||0)*100)}%`}});return r.data.text}
const OCR_BOXES={score:[.105,.067,.205,.103],iron:[.315,.067,.445,.103],gp:[.685,.067,.805,.103],gems:[.825,.067,.925,.103],event:[.02,.145,.145,.215]};
async function analyzeScreenshot(file){
 // UI update FIRST. Nothing below this point should be able to prevent the
 // user from seeing that the selected file was received.
 $('screenshotCard').hidden=false;
 $('ocrStatus').textContent=`FILE SELECTED: ${file.name} (${Math.round(file.size/1024)} KB)`;
 $('ocrResults').innerHTML='';
 $('detectedGrid').innerHTML='';
 $('shotPreview').removeAttribute('src');
 const url=URL.createObjectURL(file);
 $('shotPreview').src=url;
 state.lastScreenshot={name:file.name,time:new Date().toISOString()};
 save();
 await new Promise(requestAnimationFrame);
 const img=new Image();
 img.src=url;
 await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(new Error('The selected file is not a readable image.'))});
 $('ocrStatus').textContent=`Screenshot loaded. ${img.naturalWidth}×${img.naturalHeight}. Preparing OCR…`;
 let detected={score:null,iron:null,gunpowder:null,steel:null,gems:null,eventText:null,board:{}};
 const ocrAvailable=await ensureTesseract();
 if(ocrAvailable){
   for(const [key,box] of Object.entries(OCR_BOXES)){
     try{
       const text=await ocrCrop(img,box);
       if(key==='event')detected.eventText=text;
       else if(key==='gp')detected.gunpowder=parseCompact(text);
       else if(key==='score')detected.score=parseCompact(text);
       else if(key==='iron')detected.iron=parseCompact(text);
       else if(key==='gems')detected.gems=parseCompact(text);
       else if(key==='steel')detected.steel=parseCompact(text);
     }catch(e){console.warn('OCR crop failed',key,e);}
   }
 } else {
   $('ocrStatus').textContent='OCR engine is unavailable. Board recognition can still be reviewed manually.';
 }
 $('ocrResults').innerHTML=`<div class="statgrid">${['score','iron','gunpowder','steel','gems'].map(k=>`<label>${k==='gunpowder'?'Gunpowder':k[0].toUpperCase()+k.slice(1)}<input id="det-${k}" type="number" value="${detected[k]??''}"></label>`).join('')}</div><div class="notice">Detected event text: ${escapeHtml(detected.eventText||'—')}. If OCR missed a value, edit it here before applying.</div>`;
 $('ocrStatus').textContent=ocrAvailable?'OCR finished. Reviewing board…':'OCR unavailable. Reviewing board…';
 try {
   const board=await detectBoard(img);
   detected.board=board; pendingDetected=detected; renderDetected(board);
   $('ocrStatus').textContent=ocrAvailable?'Screenshot read. Review the detected values and board before applying.':'Screenshot loaded. Review the board; OCR was unavailable.';
 } catch(e) {
   console.error('Board detection failed:',e);
   pendingDetected=detected;
   renderDetected({});
   $('ocrStatus').textContent='Screenshot loaded, but board recognition failed. You can still enter the values manually.';
 }
}
async function loadTemplate(file){if(templateCache.find(x=>x.file===file))return templateCache.find(x=>x.file===file);const im=new Image();im.src='assets/icons/'+file;await new Promise((res,rej)=>{im.onload=res;im.onerror=()=>res()});if(!im.naturalWidth)return null;const c=document.createElement('canvas');c.width=c.height=48;const x=c.getContext('2d');x.clearRect(0,0,48,48);x.drawImage(im,4,4,40,40);const d=x.getImageData(0,0,48,48).data;let alpha=0;for(let i=3;i<d.length;i+=4)if(d[i]>40)alpha++;if(alpha<30)return null;const obj={file,im,canvas:c,data:d,alpha};templateCache.push(obj);return obj}
const TEMPLATE_FILES=['Musketeer.webp','Warrior.webp','Battle_Mage.webp','Iron_Grunt.webp','Gunpowder_Grunt.webp','Steel_Grunt.webp','Floating_Weapon_L1.webp','Floating_Weapon_L2.webp','Floating_Weapon_L3.webp','Floating_Weapon_L4.webp','Floating_Weapon_L5.webp','Floating_Weapon_L6.webp','Bomb_L1.webp','Bomb_L2.webp','Furnace_L2.png','Furnace_L5.png','Anvil_L5.webp','Alchemy_Table_L2.webp','Sibling_More_Score.png','Sibling_Barrage_of_Banners.png','Sibling_Iron_Stores.png','Sibling_Sharper_Blades.png','Sibling_Bigger_Boom.png','Sibling_Huge_Explosions.png'];
async function cellScore(cellCanvas,t){const c=document.createElement('canvas');c.width=c.height=48;const x=c.getContext('2d');x.drawImage(cellCanvas,0,0,48,48);const src=x.getImageData(0,0,48,48).data,td=t.data;let sum=0,n=0;for(let i=0;i<src.length;i+=4){const a=td[i+3];if(a<40)continue;const dr=src[i]-td[i],dg=src[i+1]-td[i+1],db=src[i+2]-td[i+2];sum+=(dr*dr+dg*dg+db*db)*(a/255);n+=a/255}return n?sum/n:1e9}
async function detectBoard(img){const W=img.naturalWidth,H=img.naturalHeight;const bx=.135*W,by=.295*H,bw=.75*W,bh=.535*H;const cols=5,rows=8;const out={};const templates=[];for(const f of TEMPLATE_FILES){const t=await loadTemplate(f);if(t)templates.push(t)};for(let r=0;r<rows;r++){for(let c=0;c<cols;c++){const cc=document.createElement('canvas');cc.width=cc.height=80;const x=cc.getContext('2d');x.drawImage(img,bx+c*bw/cols,by+r*bh/rows,bw/cols,bh/rows,0,0,80,80);let best={name:'Empty / unknown',score:1e9};for(const t of templates){const sc=await cellScore(cc,t);if(sc<best.score)best={name:labelFromFile(t.file),score:sc}}if(best.score<18000)out[`${r}-${c}`]={name:best.name,score:Math.round(best.score)};else out[`${r}-${c}`]={name:'Empty / unknown',score:Math.round(best.score)}}}return out}
function labelFromFile(f){let s=f.replace(/\.(webp|png)$/,'').replaceAll('_',' ');s=s.replace('Floating Weapon','Weapon').replace('Battle Mage','Battle Mage');return s}
function renderDetected(board){$('detectedGrid').innerHTML='';for(let r=0;r<8;r++)for(let c=0;c<5;c++){const k=`${r}-${c}`,v=board[k]||{name:'Empty / unknown'};const d=document.createElement('div');d.className='det-cell';d.innerHTML=`<span>${r+1},${c+1}</span><select data-cell="${k}">${['Empty / unknown',...boardOptions].map(o=>`<option ${o===v.name?'selected':''}>${escapeHtml(o)}</option>`).join('')}</select><small>${v.score??''}</small>`;$('detectedGrid').appendChild(d)}$('detectedGrid').querySelectorAll('select').forEach(s=>s.onchange=()=>{pendingDetected.board[s.dataset.cell]={name:s.value,score:0}})}
function applyDetected(){if(!pendingDetected)return;for(const k of ['score','iron','gunpowder','steel','gems']){const v=Number($('det-'+k)?.value);if(Number.isFinite(v)&&v>=0)state[k]=v}state.board={};Object.values(pendingDetected.board).forEach(v=>{if(v.name&&v.name!=='Empty / unknown')state.board[v.name]=(state.board[v.name]||0)+1});save();$('screenshotCard').hidden=true;pendingDetected=null;renderAll()}
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js?v=6').catch(e=>console.warn('SW registration failed',e)));
window.addEventListener('error',e=>showAppError('JavaScript error: '+(e.message||'Unknown error')));
window.addEventListener('unhandledrejection',e=>showAppError('Unexpected error: '+(e.reason?.message||e.reason||'Unknown error')));
load();
