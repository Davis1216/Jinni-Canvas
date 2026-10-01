/* Shared wheel physics. Distances are CSS pixels, independent of device event rate. */
(function(root){
 const queued=new Map();
 const api={
  factor(e){const d=Number(e.deltaY)||0;const unit=e.deltaMode===1?16:e.deltaMode===2?Math.max(100,root.innerHeight||800):1;return Math.exp(-Math.max(-240,Math.min(240,d*unit))*.0015)},
  point(e,el){const r=el.getBoundingClientRect();return {x:(e.clientX-r.left)*(el.clientWidth/r.width||1),y:(e.clientY-r.top)*(el.clientHeight/r.height||1)}},
  render(key,fn){if(queued.has(key))return;queued.set(key,requestAnimationFrame(()=>{queued.delete(key);fn()}))}
 };root.JinniPreviewZoom=api;
 if(typeof module==='object')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
