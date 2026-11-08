(function(){
  var st=document.createElement('style');
  st.textContent='section.card>h2:not(.coll){cursor:pointer;display:flex;align-items:center;gap:8px;user-select:none}'
   +'section.card>h2:not(.coll)::after{content:"\\25BE";margin-left:auto;transition:transform .15s}'
   +'section.card.cl>h2:not(.coll)::after{transform:rotate(-90deg)}'
   +'section.card.cl>*:not(h2){display:none!important}'
   +'section.card>h2:not(.coll):focus-visible{outline:2px solid currentColor;outline-offset:3px;border-radius:4px}';
  document.head.appendChild(st);
  function key(h){ return 'cl:'+location.pathname+':'+h.textContent.trim().slice(0,60); }
  function get(h){ try{ return localStorage.getItem(key(h))==='1'; }catch(e){ return false; } }
  function put(h,v){ try{ if(v) localStorage.setItem(key(h),'1'); else localStorage.removeItem(key(h)); }catch(e){} }
  function prep(root){
    var hs=(root||document).querySelectorAll('section.card>h2:not(.coll)');
    for(var i=0;i<hs.length;i++){
      var h=hs[i], s=h.parentNode;
      if(h.getAttribute('data-cl')) continue;
      h.setAttribute('data-cl','1'); h.setAttribute('role','button'); h.tabIndex=0;
      var c=get(h); s.classList.toggle('cl',c); h.setAttribute('aria-expanded',c?'false':'true');
    }
  }
  function toggle(h){
    var s=h.parentNode, c=!s.classList.contains('cl');
    s.classList.toggle('cl',c); h.setAttribute('aria-expanded',c?'false':'true'); put(h,c);
  }
  document.addEventListener('click',function(e){
    var h=e.target.closest&&e.target.closest('section.card>h2:not(.coll)');
    if(h&&h.getAttribute('data-cl')&&!e.target.closest('a,button,input,select')) toggle(h);
  });
  document.addEventListener('keydown',function(e){
    if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('section.card>h2[data-cl]')){ e.preventDefault(); toggle(e.target); }
  });
  prep();
  var t=null;
  new MutationObserver(function(){ clearTimeout(t); t=setTimeout(prep,50); }).observe(document.body,{childList:true,subtree:true});
})();
