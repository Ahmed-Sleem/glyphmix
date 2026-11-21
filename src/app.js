// Browser editor orchestration: media loading, controls, history, playback, and exports.
import { clamp, dims, draw, RAMPS, PALS, toTextFrame } from './render-core.js';
import coreSource from './render-core.js?raw';
import { decompressFrames, parseGIF } from 'gifuct-js';
const $=id=>document.getElementById(id);
const S={style:'ascii',cs:'standard',custom:'',cm:'palette',pal:'Mono',bg:'#000000',st:PALS.Mono.st,ink:1,gm:1,lo:0,hi:1,ar:1.8,gap:1,hs:1,alg:'bayer4',lv:2,
 cols:120,asp:'source',fit:'cover',zoom:1,px:0,py:0,rot:0,flip:0,bri:0,con:0,sat:0,inv:0,edge:0,smooth:0,key:'off',tol:40,keyc:null,nf:48,fps:12,a:0,b:1,pp:0,cov:0,transparent:0};
const CT=[
['Canvas','asp','Aspect ratio','s',['source','16:9','4:3','1:1','9:16','21:9']],['Canvas','fit','Image fit','s',['cover','contain','stretch']],
['Canvas','zoom','Zoom','r',.5,4,.01],['Canvas','px','Horizontal position','r',-1,1,.01],['Canvas','py','Vertical position','r',-1,1,.01],['Canvas','rot','Rotation','s',[0,90,180,270]],['Canvas','flip','Mirror horizontally','c'],
['Detail','cols','Detail (columns)','r',16,300,1],['Detail','ar','Character proportions','r',.5,2.4,.05],
['Image adjustments','bri','Brightness','r',-100,100,1],['Image adjustments','con','Contrast','r',-100,100,1],['Image adjustments','sat','Saturation','r',-100,100,1],['Image adjustments','inv','Invert image','c'],['Image adjustments','edge','Edge emphasis','r',0,1,.05],['Image adjustments','smooth','Motion smoothing','r',0,.9,.05],
['Background removal','key','Method','s',['off','color key','remove dark','remove bright']],['Background removal','tol','Tolerance','r',0,100,1],
['Appearance','cs','Character set','s',[...Object.keys(RAMPS),'custom']],['Appearance','custom','Custom characters (light → dark)','t'],
['Appearance','cm','Colour source','s',['palette','source','koi']],['Appearance','pal','Palette','s',Object.keys(PALS)],['Appearance','bg','Background colour','k'],['Appearance','ink','Bright areas use dense marks','c'],
['Appearance','gm','Density curve','r',.3,3,.05],['Appearance','lo','Shadow point','r',0,.9,.01],['Appearance','hi','Highlight point','r',.1,1,.01],
['Appearance','gap','Shape spacing','r',0,6,.5],['Appearance','hs','Halftone dot size','r',.4,1.6,.05],['Appearance','alg','Dither method','s',['bayer2','bayer4','bayer8','floyd','atkinson','threshold','noise']],['Appearance','lv','Dither colours','r',2,8,1]];
const PR={'Classic ASCII':{style:'ascii',cs:'standard',cm:'palette',pal:'Mono',cols:120,ar:1.8,key:'off'},
'Terminal':{style:'ascii',cs:'dense',cm:'palette',pal:'Terminal',cols:140,ar:1.8,key:'off'},
'Koi tiles':{style:'tiles',cs:'letters',cm:'koi',pal:'Koi',cols:48,ar:1,gap:1,key:'color key',tol:40,keyc:null},
'1-bit dither':{style:'dither',cm:'palette',pal:'Mono',alg:'atkinson',lv:2,cols:300,ar:1,con:20,key:'off'},
'Halftone print':{style:'halftone',cm:'palette',pal:'Paper',cols:90,ar:1,hs:1.1,key:'off'},
'Pixel mosaic':{style:'blocks',cm:'source',pal:'Mono',bg:'#0b0b0c',cols:70,ar:1,gap:1,key:'off'},
'Cyber blocks':{style:'ascii',cs:'blocks',cm:'palette',pal:'Cyber',cols:110,ar:1.6,key:'off'},
'Gameboy':{style:'dither',cm:'palette',pal:'Gameboy',alg:'bayer4',lv:4,cols:160,ar:1,key:'off'},
'Amber CRT':{style:'ascii',cs:'letters',cm:'palette',pal:'Amber',cols:130,ar:1.8,key:'off'}};
const UI=[];let src=null,dirty=1,playing=true,tc=0,lastN=performance.now(),lt=-1,prev=null,curD=null,picking=0,B=null,sourceUrl=null,exportCancelled=false;
const out=$('out'),octx=out.getContext('2d'),SC=document.createElement('canvas'),sx=SC.getContext('2d',{willReadFrequently:true});
const stt=m=>{$('stt').textContent=m;const live=$('exportCompatibility');if(live)live.textContent=m},prog=p=>{const n=Math.round(p*100);$('bar').firstChild.style.width=n+'%';$('bar').setAttribute('aria-valuenow',String(n))};
let busyCurrent=null,previewWork=null,previewReadyAt=0;
function beginBusy(title,detail,delay=180){if(busyCurrent){clearTimeout(busyCurrent.reveal);clearInterval(busyCurrent.clock);}const token=Symbol('busy'),started=performance.now(),overlay=$('busyOverlay'),show=()=>{if(busyCurrent?.token!==token)return;busyCurrent.visibleAt=performance.now();overlay.hidden=false;$('stage').setAttribute('aria-busy','true')};const reveal=setTimeout(show,delay),clock=setInterval(()=>{if(busyCurrent?.token===token)$('busyTime').textContent=((performance.now()-started)/1000).toFixed(1)+'s'},100);busyCurrent={token,started,reveal,clock};$('busyTitle').textContent=title;$('busyDetail').textContent=detail;$('busyTime').textContent='0.0s';$('busyCancel').hidden=true;return token}
function updateBusy(token,detail){if(busyCurrent?.token===token)$('busyDetail').textContent=detail}
function endBusy(token){if(!busyCurrent||busyCurrent.token!==token)return;if(busyCurrent.visibleAt&&performance.now()-busyCurrent.visibleAt<400){setTimeout(()=>endBusy(token),400-(performance.now()-busyCurrent.visibleAt));return}clearTimeout(busyCurrent.reveal);clearInterval(busyCurrent.clock);$('busyOverlay').hidden=true;$('stage').removeAttribute('aria-busy');busyCurrent=null}
function schedulePreviewProcessing(){if(S.cols<180||!src)return;if(previewWork)endBusy(previewWork);previewWork=beginBusy('Updating preview','Processing the high-detail frame…',0);previewReadyAt=performance.now()+60}
function applyPal(n){const p=PALS[n];S.pal=n;S.bg=p.bg;S.st=p.st;S.ink=p.ink}
function setVals(o){if(o.pal)applyPal(o.pal);Object.assign(S,o,{cell:8});UI.forEach(f=>f());dirty=1;prev=null;schedulePreviewProcessing()}
// ---------- UI ----------
const STYLE_OPTIONS=[
 {id:'ascii',name:'ASCII text',desc:'Characters shaped by light and shadow',icon:'Aa'},
 {id:'tiles',name:'Glyph tiles',desc:'Characters inside rounded colour tiles',icon:'▦'},
 {id:'dither',name:'Dither',desc:'Ordered and error-diffused pixel patterns',icon:'░'},
 {id:'halftone',name:'Halftone',desc:'Print-inspired variable dots',icon:'●'},
 {id:'blocks',name:'Pixel blocks',desc:'Clean mosaic cells',icon:'■'}
];
const PRESET_ORDER=['Terminal','Koi tiles','1-bit dither','Halftone print','Pixel mosaic','Cyber blocks','Gameboy','Amber CRT'];
const PRESET_META={Terminal:['>_','Green phosphor text'], 'Koi tiles':['鯉','Editorial colour tiles'], '1-bit dither':['░','High-detail monochrome'], 'Halftone print':['●','Printed dot pattern'], 'Pixel mosaic':['■','Source-colour blocks'], 'Cyber blocks':['▦','Neon block characters'], Gameboy:['▤','Four-tone handheld palette'], 'Amber CRT':['Aa','Warm terminal glow']};
const sameValue=(a,b)=>Array.isArray(a)&&Array.isArray(b)?JSON.stringify(a)===JSON.stringify(b):a===b;
const presetMatches=preset=>Object.entries(preset).every(([key,value])=>sameValue(S[key],value));
function presetButton(name,preset,custom=false){const b=document.createElement('button'),meta=custom?['★','Saved preset']:PRESET_META[name];b.type='button';b.dataset.preset=name;b.dataset.customPreset=custom?'true':'false';b.setAttribute('role','radio');b.innerHTML=`<i aria-hidden="true">${meta[0]}</i><span><strong>${name}</strong><small>${meta[1]}</small></span><b aria-hidden="true">✓</b>`;b.onclick=()=>{setVals(preset);recordState()};return b}
(function(){const box=$('ctl'),presets=document.createElement('details');presets.className='choice-section';presets.innerHTML='<summary>Presets</summary><div id="presetList" class="preset-list" role="radiogroup" aria-label="Built-in presets"></div>';box.appendChild(presets);const presetList=presets.querySelector('#presetList');for(const name of PRESET_ORDER)presetList.appendChild(presetButton(name,PR[name]));
 UI.push(()=>presetList.querySelectorAll('[data-preset]').forEach(b=>{const preset=b.dataset.customPreset==='true'?JSON.parse(b.dataset.value):PR[b.dataset.preset];b.setAttribute('aria-checked',String(!!preset&&presetMatches(preset)))}));
 const style=document.createElement('details');style.className='choice-section';style.innerHTML='<summary>Style</summary><div class="style-list" role="radiogroup" aria-label="Render style"></div>';box.appendChild(style);const list=style.querySelector('.style-list');
 for(const option of STYLE_OPTIONS){const b=document.createElement('button');b.type='button';b.dataset.style=option.id;b.setAttribute('role','radio');b.innerHTML=`<i aria-hidden="true">${option.icon}</i><span><strong>${option.name}</strong><small>${option.desc}</small></span><b aria-hidden="true">✓</b>`;b.onclick=()=>{S.style=option.id;dirty=1;prev=null;UI.forEach(f=>f());schedulePreviewProcessing();recordState()};list.appendChild(b)}
 UI.push(()=>list.querySelectorAll('button').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.style===S.style))));
 const G={};for(const c of CT){if(!G[c[0]]){const d=G[c[0]]=document.createElement('details');d.open=false;d.innerHTML=`<summary>${c[0]}</summary>`;box.appendChild(d)}
  const el=document.createElement('label'),k=c[1],t=c[3],isn=typeof S[k]==='number';el.dataset.setting=k;el.innerHTML=`<span>${c[2]}<b></b></span>`;let i;
  if(t==='s'){i=document.createElement('select');i.setAttribute('aria-label',c[2]);c[4].forEach(o=>i.add(new Option(String(o).replaceAll('_',' '),o)))}else{i=document.createElement('input');i.type={r:'range',c:'checkbox',k:'color',t:'text'}[t];i.setAttribute('aria-label',c[2]);if(t==='r'){i.min=c[4];i.max=c[5];i.step=c[6]}}
  const sync=()=>{if(t==='c')i.checked=!!S[k];else i.value=S[k];if(t==='r')el.querySelector('b').textContent=k==='cols'?`${S[k]} · ${S[k]*8}px`:(+S[k]).toFixed(c[6]<1?2:0)};
  i.oninput=()=>{S[k]=t==='c'?+i.checked:isn?+i.value:i.value;if(k==='pal')applyPal(i.value);if(k==='key'&&i.value!=='color key')S.keyc=null;prev=null;B=null;dirty=1;schedulePreviewProcessing();if(k==='pal')UI.forEach(f=>f());else{sync();UI.forEach(f=>f())}};
  el.appendChild(i);G[c[0]].appendChild(el);UI.push(sync);sync()}
 const r=document.createElement('div');r.className='row';r.innerHTML='<button id="pk" type="button">Pick from preview</button><button id="au" type="button">Detect edges</button>';G['Background removal'].appendChild(r);
 $('pk').onclick=()=>{picking=1;out.style.cursor='crosshair';stt('Click the background colour in the preview.')};
 $('au').onclick=()=>{S.keyc=null;S.key='color key';UI.forEach(f=>f());prev=null;dirty=1};
 UI.push(()=>{const visible={cs:['ascii','tiles'],custom:['ascii','tiles'],gap:['tiles','blocks'],hs:['halftone'],alg:['dither'],lv:['dither']};for(const [key,styles] of Object.entries(visible)){const row=box.querySelector(`[data-setting="${key}"]`);row.hidden=!styles.includes(S.style)}const tolerance=box.querySelector('[data-setting="tol"]');tolerance.hidden=S.key==='off'});UI.forEach(f=>f())})();;
out.onclick=e=>{if(!picking||!curD)return;const r=out.getBoundingClientRect(),[c,rw]=grid(),x=clamp(Math.floor((e.clientX-r.left)/r.width*c),0,c-1),y=clamp(Math.floor((e.clientY-r.top)/r.height*rw),0,rw-1),q=(y*c+x)*4;
 S.keyc=[curD[q],curD[q+1],curD[q+2]];S.key='color key';picking=0;out.style.cursor='';stt('Key colour set.');UI.forEach(f=>f());prev=null;dirty=1};
// ---------- sources ----------
const dc=document.createElement('canvas');dc.width=192;dc.height=108;const dxx=dc.getContext('2d');
function demoAt(t){const im=dxx.createImageData(192,108),d=im.data,ph=t/6*6.2832;for(let y=0;y<108;y++)for(let x=0;x<192;x++){const u=x/192,v=y/108,p=Math.sin(u*9+ph)+Math.sin(v*7-ph)+Math.sin((u+v)*8+ph)+Math.sin(Math.hypot(u-.5+Math.sin(ph)*.25,v-.5+Math.cos(ph)*.2)*18-2*ph),l=(p+4)/8,o=(y*192+x)*4;d[o]=255*Math.pow(l,1.5);d[o+1]=200*Math.pow(l,2.2)+30*l;d[o+2]=230*(1-l)+30;d[o+3]=255}dxx.putImageData(im,0,0);return dc}
const demoSrc=()=>({kind:'demo',w:192,h:108,dur:6,get:demoAt,async frame(t){return demoAt(t)}});
function use(s){disposeSource();if(src&&src.el&&src.el.pause)src.el.pause();src=s;tc=0;prev=null;B=null;S.keyc=null;dirty=1;stt(`${s.w}×${s.h}${s.dur?' · '+s.dur.toFixed(1)+'s':''} loaded.`)}
async function load(f){const operation=beginBusy('Loading media',`Reading ${f?.name||'file'}…`);try{if(!f||f.size>500*1024*1024)throw Error('Choose a media file smaller than 500 MB.');stt('Loading…');
 if(/gif/.test(f.type)&&window.ImageDecoder){const d=new ImageDecoder({data:f.stream(),type:f.type});await d.tracks.ready;const n=Math.min(d.tracks.selectedTrack.frameCount,400),fr=[];let tot=0;
  for(let i=0;i<n;i++){updateBusy(operation,`Decoding GIF frame ${i+1} of ${n}…`);const r=await d.decode({frameIndex:i}),du=(r.image.duration||100000)/1e6;fr.push({bmp:await createImageBitmap(r.image),du});tot+=du;r.image.close()}
  const get=t=>{t%=tot;let a=0;for(const q of fr){a+=q.du;if(t<a)return q.bmp}return fr[fr.length-1].bmp};
  use({kind:'gif',frames:fr,w:fr[0].bmp.width,h:fr[0].bmp.height,dur:tot,get,async frame(t){return get(t)}});d.close()}
 else if(/gif/.test(f.type)){const frames=decompressFrames(parseGIF(await f.arrayBuffer()),true),dc=document.createElement('canvas'),dx=dc.getContext('2d'),built=[];dc.width=frames[0].dims.width;dc.height=frames[0].dims.height;let tot=0;for(const [i,q] of frames.slice(0,400).entries()){updateBusy(operation,`Decoding GIF frame ${i+1} of ${Math.min(frames.length,400)}…`);const patch=new ImageData(new Uint8ClampedArray(q.patch),q.dims.width,q.dims.height);const pc=document.createElement('canvas');pc.width=q.dims.width;pc.height=q.dims.height;pc.getContext('2d').putImageData(patch,0,0);dx.drawImage(pc,q.dims.left,q.dims.top);const bmp=await createImageBitmap(dc),du=Math.max(.02,(q.delay||10)/100);built.push({bmp,du});tot+=du}const get=t=>{t%=tot;let a=0;for(const q of built){a+=q.du;if(t<a)return q.bmp}return built.at(-1).bmp};use({kind:'gif',frames:built,w:dc.width,h:dc.height,dur:tot,get,async frame(t){return get(t)}})}
 else if(f.type.startsWith('video')){const v=document.createElement('video');v.muted=v.loop=v.playsInline=true;v.crossOrigin='anonymous';sourceUrl=URL.createObjectURL(f);v.src=sourceUrl;updateBusy(operation,'Waiting for the browser to decode the video…');
  await new Promise((ok,no)=>{v.onloadeddata=ok;v.onerror=()=>no(Error('This browser can’t decode that video (codec). Convert it to H.264 MP4 or WebM and retry.'))});
  if(!v.videoWidth)throw Error('No video track found — codec unsupported. Convert to H.264 MP4 / WebM.');
  use({kind:'video',el:v,w:v.videoWidth,h:v.videoHeight,dur:v.duration,get:()=>v,frame:t=>new Promise(ok=>{v.onseeked=()=>ok(v);v.currentTime=Math.min(t,v.duration-.02)})});v.play().catch(()=>{})}
 else if(f.type.startsWith('image')){const im=new Image();sourceUrl=URL.createObjectURL(f);im.src=sourceUrl;updateBusy(operation,'Decoding the image…');await im.decode();use({kind:'img',w:im.naturalWidth,h:im.naturalHeight,dur:0,get:()=>im,async frame(){return im}})}
 else throw Error('Unsupported file type.');
 setPlay(true)}catch(e){stt('⚠ '+e.message)}finally{endBusy(operation)}}
// ---------- sampling (grid + tone + effects) ----------
const AS={'16:9':16/9,'4:3':4/3,'1:1':1,'9:16':9/16,'21:9':21/9};
function grid(){const A=S.asp==='source'?(S.rot%180?src.h/src.w:src.w/src.h):AS[S.asp];return[S.cols,Math.max(2,Math.round(S.cols/A/S.ar))]}
function sample(el,cols,rows){
 const ss=cols>220?2:3,w=cols*ss,h=rows*ss,odd=S.rot%180;SC.width=w;SC.height=h;sx.clearRect(0,0,w,h);
 let kx,ky;if(S.fit==='stretch'){kx=odd?h/src.w:w/src.w;ky=odd?w/src.h:h/src.h}else{kx=ky=(S.fit==='cover'?Math.max:Math.min)(w/(odd?src.h:src.w),h/(odd?src.w:src.h))}
 sx.save();sx.translate(w/2+S.px*w/2,h/2+S.py*h/2);sx.rotate(S.rot*Math.PI/180);if(S.flip)sx.scale(-1,1);sx.scale(kx*S.zoom,ky*S.zoom);sx.drawImage(el,-src.w/2,-src.h/2,src.w,src.h);sx.restore();
 const I=sx.getImageData(0,0,w,h).data,N=cols*rows,D=new Uint8ClampedArray(N*4),n=ss*ss,cf=(259*(S.con*2.55+255))/(255*(259-S.con*2.55)),b0=S.bri*2.55,sa=1+S.sat/100;
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){let r=0,g=0,b=0,a=0;
  for(let j=0;j<ss;j++)for(let i=0;i<ss;i++){const o=((y*ss+j)*w+x*ss+i)*4,al=I[o+3];r+=I[o]*al;g+=I[o+1]*al;b+=I[o+2]*al;a+=al}
  if(a>0){r/=a;g/=a;b/=a}a/=n;r=(r-128)*cf+128+b0;g=(g-128)*cf+128+b0;b=(b-128)*cf+128+b0;const l=.299*r+.587*g+.114*b;r=l+(r-l)*sa;g=l+(g-l)*sa;b=l+(b-l)*sa;
  if(S.inv){r=255-r;g=255-g;b=255-b}const q=(y*cols+x)*4;D[q]=r;D[q+1]=g;D[q+2]=b;D[q+3]=a}
 if(S.edge>0){const L=new Float32Array(N);for(let i=0;i<N;i++)L[i]=.299*D[i*4]+.587*D[i*4+1]+.114*D[i*4+2];
  for(let y=1;y<rows-1;y++)for(let x=1;x<cols-1;x++){const i=y*cols+x,gx=L[i-cols+1]+2*L[i+1]+L[i+cols+1]-L[i-cols-1]-2*L[i-1]-L[i+cols-1],gy=L[i+cols-1]+2*L[i+cols]+L[i+cols+1]-L[i-cols-1]-2*L[i-cols]-L[i-cols+1],m=Math.min(255,Math.hypot(gx,gy)*.7);for(let c=0;c<3;c++)D[i*4+c]+=(m-D[i*4+c])*S.edge}}
 if(S.smooth>0&&prev&&prev.length===D.length){const s=S.smooth;for(let i=0;i<D.length;i++)D[i]=prev[i]*s+D[i]*(1-s)}prev=D.slice();
 if(S.key!=='off'){const col=S.key==='color key';
  if(col&&!S.keyc){const m=[[],[],[]],P=(x,y)=>{for(let c=0;c<3;c++)m[c].push(D[(y*cols+x)*4+c])};for(let x=0;x<cols;x++){P(x,0);P(x,rows-1)}for(let y=0;y<rows;y++){P(0,y);P(cols-1,y)}S.keyc=m.map(a=>a.sort((p,q)=>p-q)[a.length>>1])}
  const kc=S.keyc,t=S.tol;for(let i=0;i<N;i++){const q=i*4;let d;if(col)d=(Math.hypot(D[q]-kc[0],D[q+1]-kc[1],D[q+2]-kc[2])-t*2.2)/18;else{const l=(.299*D[q]+.587*D[q+1]+.114*D[q+2])/255;d=S.key==='remove dark'?(l-t/100)*12:(1-t/100-l)*12}D[q+3]*=clamp(d,0,1)}}
 return D}
// ---------- playback / render ----------
const cur=()=>{if(src.kind==='video')return src.el.currentTime;const n=performance.now();if(playing&&src.dur)tc=(tc+(n-lastN)/1000)%src.dur;lastN=n;return tc};
const isPaused=()=>src.kind==='video'?src.el.paused:!playing;
function setPlay(p){playing=p;if(src&&src.kind==='video')p?src.el.play():src.el.pause();$('pl').textContent=p?'⏸':'▶'}
$('pl').onclick=()=>setPlay(isPaused());
$('sk').oninput=e=>{if(!src||!src.dur)return;const t=e.target.value/1000*src.dur;if(src.kind==='video')src.el.currentTime=t;else tc=t;dirty=1};
function fitPreview(){const stage=$('stage'),canvas=out.hidden?$('original'):out;if(!canvas.width||!canvas.height)return;const css=getComputedStyle(stage),aw=Math.max(1,stage.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)),ah=Math.max(1,stage.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom)),scale=Math.min(aw/canvas.width,ah/canvas.height);canvas.style.width=Math.floor(canvas.width*scale)+'px';canvas.style.height=Math.floor(canvas.height*scale)+'px'}
function render(el){drawOriginal(el);const[c,r]=grid(),D=sample(el,c,r),[W,H]=dims(c,r,S);if(out.width!==W||out.height!==H){out.width=W;out.height=H}draw(octx,D,c,r,S,W,H);curD=D;fitPreview()}
function tick(){requestAnimationFrame(tick);if(!src)return;const t=cur();if(!dirty&&(isPaused()||t===lt))return;if(dirty&&previewWork&&performance.now()<previewReadyAt)return;if(src.kind==='video'&&src.el.readyState<2)return;lt=t;dirty=0;
 try{render(src.get(t))}catch(e){stt('⚠ '+e.message)}finally{if(previewWork){endBusy(previewWork);previewWork=null}}
 if(src.dur){$('sk').value=t/src.dur*1000;$('tm').textContent=t.toFixed(1)+' / '+src.dur.toFixed(1)+'s'}else $('tm').textContent='image'}
requestAnimationFrame(tick);
// ---------- export ----------
const BK=['asp','fit','zoom','px','py','rot','flip','cols','ar','bri','con','sat','inv','edge','smooth','key','tol','keyc','nf','a','b'];
async function bake(){if(S.b<=S.a)S.b=Math.min(1,S.a+.02);const sig=JSON.stringify(BK.map(k=>S[k]))+src.w+src.dur+src.kind;if(B&&B.sig===sig)return B;
 const[cols,rows]=grid(),N=cols*rows*4,n=S.nf,f=new Uint8Array(N*n),v=src.kind==='video'?src.el:null,was=v&&!v.paused,started=performance.now();if(v){v.pause();updateBusy(busyCurrent?.token,'Playback paused while frames are processed deterministically.')}prev=null;
 try{for(let i=0;i<n;i++){if(exportCancelled)throw Error('Export cancelled.');const t=src.dur?src.dur*(S.a+(S.b-S.a)*i/n):0;f.set(sample(await src.frame(t),cols,rows),i*N);const done=i+1,eta=Math.max(0,(performance.now()-started)/done*(n-done)/1000);prog(done/n);const progress=`Frame ${done} of ${n} · ${Math.round(done/n*100)}% · about ${eta.toFixed(1)}s remaining`;stt(`Processing ${progress.toLowerCase()}`);updateBusy(busyCurrent?.token,progress);if(i%4===0)await new Promise(r=>setTimeout(r))}}finally{prev=null;if(was)v.play();dirty=1}
 return B={sig,f,cols,rows,n}}
async function pack(buf){let z=0,b=buf;if(window.CompressionStream){b=new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());z=1}
 let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode.apply(null,b.subarray(i,i+32768));return[btoa(s),z]}
const dl=(blob,n)=>{const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
const sc=t=>'<scr'+'ipt>'+t+'</scr'+'ipt>';
function textFrames(b){const N=b.cols*b.rows*4,frames=[];for(let i=0;i<b.n;i++)frames.push(toTextFrame(b.f.subarray(i*N,(i+1)*N),b.cols,b.rows,S));return frames}
async function xTextHTML(){const b=await bake(),frames=textFrames(b),safe=JSON.stringify(frames).replaceAll('<','\\u003c'),ink=S.st.at(-1)||'#fff';const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Glyphmix animated text</title><style>:root{color-scheme:dark}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:${S.bg};color:${ink}}body{display:grid;place-items:center;overflow:auto;padding:2vmin}figure{margin:0;max-width:100%}pre{margin:0;font:clamp(3px,calc(92vw / ${b.cols}),16px)/${S.ar} ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:0;white-space:pre;user-select:text}figcaption{text-align:center;margin-top:1rem;font:12px system-ui;opacity:.65}button{font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:99px;padding:.45rem .8rem}</style></head><body><figure><pre id="art" role="img" aria-label="Animated ASCII art"></pre><figcaption><button id="toggle" type="button">Pause</button> · Select and copy any frame</figcaption></figure>${sc(`const frames=${safe},fps=${S.fps},ping=${!!S.pp},art=document.getElementById('art'),toggle=document.getElementById('toggle');let playing=true,start=performance.now(),pausedAt=0,last=-1;function tick(now){requestAnimationFrame(tick);if(!playing)return;const n=frames.length,period=ping&&n>1?2*n-2:n;let i=Math.floor((now-start)/1000*fps)%period;if(i>=n)i=period-i;if(i!==last){last=i;art.textContent=frames[i]}}toggle.onclick=()=>{playing=!playing;toggle.textContent=playing?'Pause':'Play';if(playing)start=performance.now()-pausedAt;else pausedAt=performance.now()-start};addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();toggle.click()}});tick(start);`)}</body></html>`;dl(new Blob([html],{type:'text/html'}),'glyphmix-text.html');stt('Animated text HTML saved.')}
async function xCanvasHTML(){const b=await bake();stt('Compressing canvas animation…');const[d,z]=await pack(b.f),M={cols:b.cols,rows:b.rows,n:b.n,fps:S.fps,pp:S.pp,z,S:{...S,keyc:null},d};
 const player=`const M=${JSON.stringify(M)};(async()=>{let b=Uint8Array.from(atob(M.d),c=>c.charCodeAt(0));if(M.z)b=new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());const c=document.getElementById('c'),x=c.getContext('2d'),[W,H]=dims(M.cols,M.rows,M.S),N=M.cols*M.rows*4;c.width=W;c.height=H;let p=0,tm=0,pt=performance.now(),last=-1;c.onclick=()=>p=!p;(function f(now){requestAnimationFrame(f);if(!p)tm+=now-pt;pt=now;const n=M.n,per=M.pp&&n>1?2*n-2:n;let i=Math.floor(tm/1000*M.fps)%per;if(i>=n)i=per-i;if(i!==last){last=i;draw(x,b.subarray(i*N,(i+1)*N),M.cols,M.rows,M.S,W,H)}})(pt)})();`;
 const standaloneCore=coreSource.replace(/export\s*\{[^}]+\};?/,'');const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Glyphmix</title><style>html,body{margin:0;height:100%;overflow:hidden;background:'+S.bg+'}canvas{display:block;width:100vw;height:100vh;object-fit:'+(S.cov?'cover':'contain')+'}</style></head><body><canvas id="c"></canvas>'+sc(standaloneCore)+sc(player)+'</body></html>';dl(new Blob([html],{type:'text/html'}),'glyphmix-canvas.html');stt('Canvas HTML saved.')}
function xText(){const[c,r]=grid(),text=toTextFrame(curD,c,r,S);dl(new Blob([text+'\n'],{type:'text/plain'}),'glyphmix-frame.txt');stt('Text frame saved.')}
async function xTextSequence(){const b=await bake(),frames=textFrames(b),text=frames.map((f,i)=>`--- FRAME ${i+1} / ${frames.length} · ${(i/S.fps).toFixed(3)}s ---\n${f}`).join('\n\n');dl(new Blob([text+'\n'],{type:'text/plain'}),'glyphmix-frames.txt');stt('Animated text frames saved.')}
async function xWebm(){if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw Error('WebM recording is not supported by this browser.');const b=await bake(),[W,H]=dims(b.cols,b.rows,S),c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),ch=[],N=b.cols*b.rows*4,stream=c.captureStream(S.fps),type=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm',rec=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:12e6});rec.ondataavailable=e=>e.data.size&&ch.push(e.data);const done=new Promise((resolve,reject)=>{rec.onstop=resolve;rec.onerror=()=>reject(rec.error||Error('Recording failed.'))});rec.start();for(let i=0;i<b.n;i++){if(exportCancelled){rec.stop();throw Error('Export cancelled.')}draw(x,b.f.subarray(i*N,(i+1)*N),b.cols,b.rows,S,W,H);prog((i+1)/b.n);updateBusy(busyCurrent?.token,`Recording frame ${i+1} of ${b.n} · ${Math.round((i+1)/b.n*100)}%`);await new Promise(r=>setTimeout(r,1000/S.fps))}rec.stop();await done;stream.getTracks().forEach(t=>t.stop());dl(new Blob(ch,{type}),'glyphmix.webm');stt('WebM saved.')}
async function xPNG(){render(src.get(cur()));await new Promise((resolve,reject)=>out.toBlob(blob=>{if(!blob)return reject(Error('PNG encoding failed.'));dl(blob,'glyphmix.png');resolve()},'image/png'));stt('PNG frame saved.')}
const EXPORT_FORMATS={
 'text-html':{label:'Export animated text HTML',animated:1,run:xTextHTML,hint:'Real selectable ASCII text in one standalone HTML file—no canvas, GIF, or video.'},
 'canvas-html':{label:'Export canvas HTML',animated:1,canvas:1,visual:1,run:xCanvasHTML,hint:'Best visual match. Uses a canvas inside a standalone HTML file.'},
 text:{label:'Export text frame',run:xText,hint:'Exports the current processed frame as plain UTF-8 text.'},
 'text-sequence':{label:'Export text frames',animated:1,run:xTextSequence,hint:'Exports every frame as timestamped plain text in one file.'},
 png:{label:'Export PNG',visual:1,run:xPNG,hint:'Exports the current frame as a lossless PNG image.'},
 webm:{label:'Export WebM',animated:1,visual:1,run:xWebm,hint:'Exports a rendered video. Codec support depends on your browser.'}
};
function selectedFormat(){return document.querySelector('input[name="exportFormat"]:checked').value}
function syncExportState(){const key=selectedFormat(),format=EXPORT_FORMATS[key];$('formatHint').textContent=format.hint;$('confirmExport').textContent=format.label;document.querySelectorAll('[data-export-option]').forEach(el=>{const type=el.dataset.exportOption;el.hidden=!format[type]});const bytes=S.cols*Math.max(2,grid()[1])*4*(format.animated?Number($('exportFrames').value):1);$('estimate').textContent=format.animated?`About ${(bytes/1048576).toFixed(1)} MB working memory`:`Output: ${S.cols*8}px wide`;$('exportCompatibility').textContent=key==='webm'&&!window.MediaRecorder?'Not supported in this browser':''}
function pullExportState(){S.nf=clamp(Math.round(Number($('exportFrames').value)||48),8,240);S.fps=clamp(Math.round(Number($('exportFps').value)||12),4,30);S.a=clamp(Number($('exportStart').value)/100,0,.99);S.b=clamp(Number($('exportEnd').value)/100,.01,1);if(S.b<=S.a)throw Error('Clip end must be after clip start.');S.pp=+$('exportPingPong').checked;S.cov=+$('exportCover').checked;S.transparent=+$('exportTransparent').checked;B=null}
function pushExportState(){$('exportFrames').value=S.nf;$('exportFps').value=S.fps;$('exportStart').value=Math.round(S.a*100);$('exportEnd').value=Math.round(S.b*100);$('exportPingPong').checked=!!S.pp;$('exportCover').checked=!!S.cov;$('exportTransparent').checked=!!S.transparent;syncExportState()}
async function runSelectedExport(){if(!src)return;exportCancelled=false;$('cancelExport').hidden=false;$('confirmExport').disabled=true;const format=EXPORT_FORMATS[selectedFormat()],operation=beginBusy(format.label.replace('Export','Preparing'),'Playback may pause while Glyphmix processes the selected output.',0);$('busyCancel').hidden=false;$('exportDialog').close();try{pullExportState();await format.run();recordState();$('exportDialog').close()}catch(e){stt('⚠ '+e.message)}finally{endBusy(operation);$('confirmExport').disabled=false;$('cancelExport').hidden=true;prog(0)}}
// ---------- file input / drag & drop ----------
$('open').onclick=()=>$('file').click();$('file').onchange=e=>e.target.files[0]&&load(e.target.files[0]);$('demo').onclick=()=>{use(demoSrc());setPlay(true)};
['dragenter','dragover'].forEach(t=>addEventListener(t,e=>{e.preventDefault();document.body.classList.add('dg')}));
['dragleave','drop'].forEach(t=>addEventListener(t,e=>{e.preventDefault();if(t==='drop'||!e.relatedTarget){document.body.classList.remove('dg');if(t==='drop'&&e.dataTransfer.files[0])load(e.dataTransfer.files[0])}}));

// ---------- editor ergonomics, persistence, accessibility ----------
const SETTINGS_KEY='glyphmix.settings.v1',PRESETS_KEY='glyphmix.presets.v1';
const history=[],future=[];let lastState='';
const snapshot=()=>JSON.stringify({...S,keyc:null,st:[...S.st]});
function updateHistoryButtons(){$('undo').disabled=!history.length;$('redo').disabled=!future.length}
function recordState(){const next=snapshot();if(lastState&&next!==lastState){history.push(lastState);if(history.length>50)history.shift();future.length=0}lastState=next;updateHistoryButtons();try{localStorage.setItem(SETTINGS_KEY,next)}catch{stt('Settings could not be saved in this browser.')}}
function loadSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY))}catch{return null}}
function disposeSource(){if(sourceUrl){URL.revokeObjectURL(sourceUrl);sourceUrl=null}if(src?.frames)for(const f of src.frames)f.bmp?.close?.()}
function drawOriginal(el){const c=$('original');if(c.hidden)return;const max=1000,scale=Math.min(1,max/Math.max(src.w,src.h));c.width=Math.max(1,Math.round(src.w*scale));c.height=Math.max(1,Math.round(src.h*scale));const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);x.drawImage(el,0,0,c.width,c.height)}
function updateEstimate(){if(src&&$('exportDialog').open)syncExportState()}
function setPreviewMode(original){$('original').hidden=!original;out.hidden=original;$('viewOriginal').setAttribute('aria-pressed',String(original));$('viewEffect').setAttribute('aria-pressed',String(!original));dirty=1;requestAnimationFrame(fitPreview)}
function renderCustomPresets(){document.querySelectorAll('[data-custom-preset="true"]').forEach(e=>e.remove());let saved={};try{saved=JSON.parse(localStorage.getItem(PRESETS_KEY)||'{}')}catch{saved={}}for(const [name,value] of Object.entries(saved)){const b=presetButton(name,value,true);b.dataset.value=JSON.stringify(value);$('presetList').appendChild(b)}UI.forEach(f=>f())}
function addPresetControls(){const details=document.createElement('details');details.innerHTML='<summary>Custom presets</summary><div class="row"><button type="button" id="savePreset">Save current</button><button type="button" id="clearPresets">Clear saved</button></div>';$('ctl').appendChild(details);details.querySelector('#savePreset').onclick=()=>{const name=prompt('Preset name');if(!name?.trim())return;let saved={};try{saved=JSON.parse(localStorage.getItem(PRESETS_KEY)||'{}')}catch{saved={}}saved[name.trim().slice(0,30)]={...S,keyc:null};localStorage.setItem(PRESETS_KEY,JSON.stringify(saved));renderCustomPresets();stt(`Saved preset “${name.trim().slice(0,30)}”.`)};details.querySelector('#clearPresets').onclick=()=>{localStorage.removeItem(PRESETS_KEY);renderCustomPresets();stt('Custom presets cleared.')}}
function initializeEnhancements(){
 addPresetControls();renderCustomPresets();
 $('undo').onclick=()=>{if(!history.length)return;future.push(snapshot());const raw=history.pop();lastState=raw;setVals(JSON.parse(raw));updateHistoryButtons()};
 $('redo').onclick=()=>{if(!future.length)return;history.push(snapshot());const raw=future.pop();lastState=raw;setVals(JSON.parse(raw));updateHistoryButtons()};
 $('reset').onclick=()=>{setVals(PR['Classic ASCII']);recordState();stt('Settings reset.')};
 $('ctl').addEventListener('change',()=>{recordState();updateEstimate()});
 $('exportButton').onclick=()=>{pushExportState();$('exportDialog').showModal()};
 $('formatList').onchange=syncExportState;['exportFrames','exportFps','exportStart','exportEnd'].forEach(id=>$(id).oninput=syncExportState);
 $('confirmExport').onclick=runSelectedExport;const cancelProcessing=()=>{exportCancelled=true;updateBusy(busyCurrent?.token,'Cancelling safely after the current frame…');stt('Cancelling export…')};$('cancelExport').onclick=cancelProcessing;$('busyCancel').onclick=cancelProcessing;
 $('viewOriginal').onclick=()=>setPreviewMode(true);$('viewEffect').onclick=()=>setPreviewMode(false);
 $('helpButton').onclick=()=>$('helpDialog').showModal();
 $('stage').onkeydown=e=>{if(e.code==='Space'){e.preventDefault();setPlay(isPaused())}};
 addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?$('redo').click():$('undo').click()}else if(e.key.toLowerCase()==='o'){e.preventDefault();$('file').click()}});
 if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){const webm=document.querySelector('input[name="exportFormat"][value="webm"]');webm.disabled=true;webm.closest('label').classList.add('is-disabled')}
 const previewObserver=new ResizeObserver(()=>requestAnimationFrame(fitPreview));previewObserver.observe($('stage'));
 addEventListener('beforeunload',()=>{previewObserver.disconnect();disposeSource()});
 setInterval(updateEstimate,1500);
}

initializeEnhancements();use(demoSrc());setVals(loadSettings()||PR['Classic ASCII']);recordState();
