/* OG MotoWorks – keuzewijzer (PREVIEW). Probleem → verfijning → motor (OGMotor) → advies. Boom: keuzewijzer.json (Werkplaats). */
(function(){'use strict';
var box=document.getElementById('kw'),mbox=document.getElementById('kw-motor'),D=null,st={};
var WEET='Weet ik niet / anders';
function esc(t){return String(t).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function step(n){document.querySelectorAll('.kw-steps li').forEach(function(l){l.classList.toggle('on',+l.dataset.s===n);});}
function tile(label,foto,cls,fn){var b=document.createElement('button');b.type='button';b.className='kw-tile '+(cls||'')+(foto?' foto':'');if(foto)b.style.backgroundImage='linear-gradient(180deg,rgba(0,0,0,.15) 0%,rgba(0,0,0,.82) 100%),url('+foto+')';b.innerHTML='<span>'+esc(label)+'</span>';b.onclick=fn;return b;}
function grid(title,tiles,back){box.innerHTML='<h2>'+esc(title)+'</h2>';var g=document.createElement('div');g.className='kw-grid';tiles.forEach(function(t){g.appendChild(t);});box.appendChild(g);
 if(back){var b=document.createElement('button');b.className='kw-back';b.textContent='← Terug';b.onclick=back;box.appendChild(b);} mbox.hidden=true;box.hidden=false;box.scrollIntoView({block:'start'});}
function s1(){st={};step(1);grid('Wat merk je?',D.voorkant.map(function(v){return tile(v.label,v.foto,v.id==='anders'?'weet':'',function(){st.sym=v;s2();});}));}
function s2(){step(2);var t=st.sym.opties.map(function(o){return tile(o.label,'',o.veilig?'red':'',function(){st.opt=o;s3();});});
 t.push(tile(WEET,'','weet',function(){st.opt=null;s3();}));grid(st.sym.label+': wat precies?',t,s1);}
function s3(){step(3);box.hidden=true;mbox.hidden=false;mbox.scrollIntoView({block:'start'});}
document.getElementById('kw-motor-ok').onclick=function(){st.motor=window.OGMotor&&OGMotor.get();s4();};
document.getElementById('kw-motor-skip').onclick=function(){st.motor=null;s4();};
function cat(id){return D.categorieen.filter(function(c){return c.id===id;})[0];}
function chips(m){if(!m)return[];var n=(m.merk+' '+m.model+' '+(m.uitvoering||'')).toLowerCase(),out=[];
 D.typisch.forEach(function(t){if(t.match.some(function(k){return n.indexOf(k)>=0;}))out=out.concat(t.chips);});return out;}
function s4(){step(4);var o=st.opt,c=o&&cat(o.cat),veilig=o&&(o.veilig||(c&&c.veilig));
 var motor=st.motor&&window.OGMotor?OGMotor.label(st.motor):'';
 var pad=[st.sym.label,o?o.label:WEET].join(' > ');
 var msg='Hoi OG MotoWorks, ik heb een vraag via de keuzewijzer.\nProbleem: '+pad+(motor?'\nMotor: '+motor:'')+'\n(Ik stuur zo een foto of filmpje mee.)';st.msg=msg;
 var wa='https://wa.me/'+D.whatsapp+'?text='+encodeURIComponent(msg);
 var ch=chips(st.motor),h='<div class="kw-res"><h2>'+esc(o?o.label:'We kijken graag met je mee')+'</h2>';
 if(veilig)h+='<p class="kw-safe">⚠️ '+esc(D.tekst_veilig||'Niet mee rijden; bel of app ons.')+'</p>';
 h+='<p>'+esc((o&&o.tekst)||D.tekst_weet_niet)+'</p>';
 if(o)h+='<p>We kijken het samen met je na en vertellen je vooraf wat we vinden, voordat we iets doen.</p>';
 h+='<p><strong>Tip:</strong> stuur een foto of kort filmpje mee (geluid, lek, lampje op het dashboard). Dan kunnen wij vaak al meer zeggen.</p>';
 if(motor)h+='<p>Jouw motor: <strong>'+esc(motor)+'</strong></p>';
 if(ch.length)h+='<p>'+esc(D.label_typisch||'Vaak gezien bij dit type')+':</p><div class="kw-chips">'+ch.map(function(x){return'<span>'+esc(x)+'</span>';}).join('')+'</div>';
 h+='<label class="kw-eigen" for="kw-eigen">'+esc(D.label_eigen||'Wat denk je zelf?')+' <span>(mag leeg blijven)</span></label><textarea id="kw-eigen" rows="3" placeholder="Bijv. sinds wanneer, bij welke snelheid, of wat je al geprobeerd hebt"></textarea>';
 h+='<p class="kw-foto">📷 '+esc(D.tekst_foto||'Stuur een foto of kort filmpje mee via WhatsApp.')+'</p>';
 h+='<div class="kw-row"><a id="kw-wa" class="btn btn--wa" href="'+wa+'" target="_blank" rel="noopener">App ons via WhatsApp</a><a class="btn btn--ghost" href="/afspraak/">Maak een afspraak</a></div>';
 h+='<p style="font-size:14px;opacity:.8">Wij werken op afspraak.</p></div>';
 box.innerHTML=h;var ta=document.getElementById('kw-eigen'),wl=document.getElementById('kw-wa');ta.oninput=function(){var v=ta.value.trim();wl.href='https://wa.me/'+D.whatsapp+'?text='+encodeURIComponent(st.msg+(v?'\nWat ik zelf denk: '+v:''));};var b=document.createElement('button');b.className='kw-back';b.textContent='← Opnieuw beginnen';b.onclick=s1;box.appendChild(b);box.hidden=false;mbox.hidden=true;box.scrollIntoView({block:'start'});}
fetch('keuzewijzer.json',{cache:'no-cache'}).then(function(r){return r.json();}).then(function(d){D=d;s1();}).catch(function(){box.innerHTML='<p>Kan de keuzewijzer niet laden. <a href="https://wa.me/31642939555">App ons</a>.</p>';});
})();
