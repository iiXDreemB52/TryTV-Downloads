from pathlib import Path
import base64, mimetypes
root=Path.home()/'Documents'/'TryTV-Google-TV-0.2.3-HTML-Development'
s=(root/'player-ui.html').read_text(encoding='utf8')
logo=root/'assets'/'windows-logo.png'
mime=mimetypes.guess_type(str(logo))[0] or 'image/png'
s=s.replace('assets/windows-logo.png','data:'+mime+';base64,'+base64.b64encode(logo.read_bytes()).decode('ascii'))
demo="""
<style>
#tv-player-preview-info{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:30;
 background:rgba(17,23,35,.8);border:1px solid #ffffff44;color:#fff;border-radius:11px;
 padding:8px 18px;text-align:center;font:15px Tahoma,sans-serif}
#tv-player-preview-info small{display:block;color:#c7cbd4;margin-top:5px;font-size:12px}
body{background:radial-gradient(ellipse at 46% 36%,#303947,#10141f 68%,#070a11)!important}
</style>
<div id="tv-player-preview-info">معاينة أزرار مشغل TryTV Google TV
 <small>الأسهم للتنقل · Enter للاختيار · Esc للعودة · الفيديو غير مشغّل في HTML</small></div>
<script>
(function(){
 const demo={position:1036000,duration:2480000,paused:false,loading:false,
   title:'TryTV — نموذج واجهة المشغل',quality:0,speed:1,hasPrev:true,hasNext:true,volume:90};
 function paint(){TryTVChrome.update(JSON.stringify(demo));}
 let timer;
 function refreshControls(){TryTVChrome.show();clearTimeout(timer);
   if(!demo.paused)timer=setTimeout(()=>TryTVChrome.hide(),10000);}
 window.NativePlayer={action:(name,value)=>{
   if(name==='toggle')demo.paused=!demo.paused;
   else if(name==='seekPercent')demo.position=demo.duration*Number(value)/1000;
   else if(name==='seekDelta')demo.position=Math.max(0,Math.min(demo.duration,demo.position+Number(value)));
   else if(name==='quality')demo.quality=(demo.quality+1)%3;
   else if(name==='speed')demo.speed=demo.speed===1?1.25:demo.speed===1.25?1.5:1;
   else if(name==='mute')demo.volume=demo.volume?0:90;
   else if(name==='listServers'){TryTVChrome.serverList(JSON.stringify(['السيرفر الأسرع','السيرفر الاحتياطي']),0);return;}
   else if(name==='next'||name==='previous')TryTVChrome.toast(name==='previous'?'الحلقة السابقة':'الحلقة التالية');
   else if(name==='exit'){location.href='https://iixdreemb52.github.io/TryTV-Downloads/';return;}
   paint();refreshControls();
 }};
 document.addEventListener('keydown',e=>{
  const k={ArrowLeft:'Left',ArrowRight:'Right',ArrowUp:'Up',ArrowDown:'Down',
   Enter:'OK',Escape:'Back',Backspace:'Back'}[e.key];
  if(!k)return;e.preventDefault();
  TryTVChrome.nextRemote(k);
  if(k!=='Back')refreshControls();
 },true);
 setInterval(()=>{if(!demo.paused)demo.position=Math.min(demo.duration,demo.position+1000);paint()},1000);
 paint();refreshControls();
})();
</script>
"""
assert '</body>' in s
s=s.replace('</body>',demo+'</body>',1)
out=root/'TryTV-TV-0.2.3-Player-Remote-Preview.html'
out.write_text(s,encoding='utf8')
print('PLAYER_PREVIEW_CREATED',out.stat().st_size)
