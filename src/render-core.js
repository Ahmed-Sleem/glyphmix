// Pure rendering primitives shared by the editor and every standalone export.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),hs=(a,b)=>Math.abs(Math.sin(a*12.9898+b*78.233)*43758.5453)%1,h2r=h=>[1,3,5].map(i=>parseInt(h.substr(i,2),16));
const RAMPS={standard:" .:-=+*#%@",letters:" .':;+*%ZX#@",dense:" .'`^,:;Il!i><~+_-?][}{1)(|tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",binary:" 01",blocks:" ░▒▓█",dots:" ·•●",symbols:" .+x*#%@"};
const PALS={Mono:{bg:'#000000',st:['#4a4a4a','#ffffff'],ink:1},Terminal:{bg:'#010a04',st:['#06401a','#39ff6a'],ink:1},Amber:{bg:'#100800',st:['#4a2600','#ffb52e'],ink:1},Paper:{bg:'#f3f0e8',st:['#b9b4a6','#151515'],ink:0},Blueprint:{bg:'#0c2a55',st:['#2f6bb8','#e2f0ff'],ink:1},Cyber:{bg:'#0a0620',st:['#ff2bd6','#2be8ff'],ink:1},Sunset:{bg:'#12061f',st:['#6a1b9a','#ff4d6d','#ffd166'],ink:1},Gameboy:{bg:'#0f380f',st:['#0f380f','#306230','#8bac0f','#9bbc0f'],ink:1},Koi:{bg:'#fafaf8',st:['#d5d5d2','#d9573a','#474747'],ink:1}};
const REP=[[225,222,215],[217,87,58],[170,50,35],[60,60,60],[211,163,41],[150,150,150]],KP=['#e8e7e3','#d9573a','#c2442a','#474747','#d3a329','#d5d5d2'],KT=['#8d8d8a','#f6cdc1','#f2bcab','#bdbdbd','#f5e3a4','#807f7c'],KE=['#a9a9a6','#d9573a','#c2442a','#555','#c99a20','#a9a9a6'];
const near=(r,g,b)=>{let bi=0,bd=1e9;REP.forEach((p,i)=>{const d=(p[0]-r)**2+(p[1]-g)**2+(p[2]-b)**2;if(d<bd){bd=d;bi=i}});return bi};
const LC={};function lutr(st){const key=st.join();if(LC[key])return LC[key];const c=st.map(h2r),r=new Uint8Array(768),s=[];for(let i=0;i<256;i++){const p=i/255*(c.length-1),j=Math.min(c.length-2,Math.floor(p)),f=p-j;for(let k=0;k<3;k++)r[i*3+k]=c[j][k]+(c[j+1][k]-c[j][k])*f;s.push(`rgb(${r[i*3]},${r[i*3+1]},${r[i*3+2]})`)}return LC[key]={r,s}}
const BY={};function bay(n){if(BY[n])return BY[n];let m=[[0]];while(m.length<n){const s=m.length,r=[];for(let y=0;y<2*s;y++){r[y]=[];for(let x=0;x<2*s;x++)r[y][x]=4*m[y%s][x%s]+[[0,2],[3,1]][y>=s?1:0][x>=s?1:0]}m=r}return BY[n]=m}
function dith(V,cols,rows,S){const L=S.lv,mx=L-1,Q=Float32Array.from(V,v=>Math.max(0,v)),o=new Uint8Array(cols*rows),a=S.alg,bn=a.startsWith('bayer')?+a.slice(5):0,B=bn&&bay(bn);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=y*cols+x;let v=Q[i];if(bn)v+=((B[y%bn][x%bn]+.5)/(bn*bn)-.5)/mx;else if(a==='noise')v+=(hs(x,y)-.5)/mx;
  const l=clamp(Math.round(v*mx),0,mx);o[i]=l;
  if(a==='floyd'||a==='atkinson'){const e=Q[i]-l/mx,add=(dx,dy,w)=>{const xx=x+dx,yy=y+dy;if(xx>=0&&xx<cols&&yy<rows)Q[yy*cols+xx]+=e*w};
   if(a==='floyd'){add(1,0,7/16);add(-1,1,3/16);add(0,1,5/16);add(1,1,1/16)}else[[1,0],[2,0],[-1,1],[0,1],[1,1],[0,2]].forEach(p=>add(p[0],p[1],1/8))}}
 return o}
const dims=(cols,rows,S)=>[Math.round(cols*S.cell),Math.round(rows*S.cell*S.ar)];
let OC=null;
function draw(ctx,D,cols,rows,S,W,H){
 const cw=W/cols,ch=H/rows,N=cols*rows,st=S.style,lc=lutr(S.st),R=RAMPS[S.cs]||S.custom||' .#',rl=R.length-1,hi=Math.max(S.lo+.01,S.hi),V=new Float32Array(N);
 ctx.clearRect(0,0,W,H);if(!S.transparent){ctx.fillStyle=S.bg;ctx.fillRect(0,0,W,H)}
 for(let i=0;i<N;i++){const o=i*4;let l=(.299*D[o]+.587*D[o+1]+.114*D[o+2])/255;if(!S.ink)l=1-l;V[i]=D[o+3]<100?-1:Math.pow(clamp((l-S.lo)/(hi-S.lo),0,1),S.gm)}
 const kq=i=>near(D[i*4],D[i*4+1],D[i*4+2]),col=i=>S.cm==='source'?`rgb(${D[i*4]},${D[i*4+1]},${D[i*4+2]})`:S.cm==='koi'?KP[kq(i)]:lc.s[Math.round(V[i]*255)];
 if(st==='ascii'||st==='tiles'){ctx.textAlign='center';ctx.textBaseline='middle';const fs=Math.min(cw*1.75,ch*.92),g=S.gap;let cf='';const F=f=>{if(f!==cf){ctx.font=f;cf=f}};
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=y*cols+x,v=V[i];if(v<0)continue;const k=Math.round(v*rl),c=R[k];if(c===' ')continue;const px=x*cw+cw/2,py=y*ch+ch/2,koi=S.cm==='koi',q=koi?kq(i):0;
   if(st==='tiles'&&k>rl*.4){ctx.fillStyle=col(i);ctx.beginPath();ctx.roundRect(x*cw+g,y*ch+g,cw-2*g,ch-2*g,Math.min(cw,ch)*.15);ctx.fill();F(`bold ${fs*.8}px ui-monospace,Menlo,monospace`);ctx.fillStyle=koi?KT[q]:v>.7?'rgba(0,0,0,.4)':'rgba(255,255,255,.6)';ctx.fillText(c,px,py+1)}
   else{F(`${fs}px ui-monospace,Menlo,monospace`);ctx.fillStyle=koi?KE[q]:col(i);ctx.fillText(c,px,py+1)}}}
 else if(st==='dither'){const o=dith(V,cols,rows,S),mx=S.lv-1;OC=OC||document.createElement('canvas');OC.width=cols;OC.height=rows;const id=new ImageData(cols,rows),P=id.data;
  for(let i=0;i<N;i++){const l=o[i];if(V[i]<0||!l)continue;const q=i*4,f=l/mx;if(S.cm==='source'){P[q]=D[q]*f;P[q+1]=D[q+1]*f;P[q+2]=D[q+2]*f}else{const k=Math.round(f*255)*3;P[q]=lc.r[k];P[q+1]=lc.r[k+1];P[q+2]=lc.r[k+2]}P[q+3]=255}
  OC.getContext('2d').putImageData(id,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(OC,0,0,W,H)}
 else if(st==='halftone'){const m=Math.max(cw,ch)*S.hs*.5;for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=y*cols+x,v=V[i];if(v<.02)continue;ctx.fillStyle=col(i);ctx.beginPath();ctx.arc(x*cw+cw/2,y*ch+ch/2,Math.sqrt(v)*m,0,6.2832);ctx.fill()}}
 else{const g=S.gap;for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=y*cols+x;if(V[i]<0)continue;ctx.fillStyle=col(i);ctx.fillRect(x*cw+g,y*ch+g,cw-2*g,ch-2*g)}}
}

export { clamp, dims, draw, RAMPS, PALS, h2r, bay as getDitherMatrix };
