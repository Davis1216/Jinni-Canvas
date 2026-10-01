/* Task-first smart canvas. Task snapshots contain public settings and asset refs only. */
(() => {
 const host=document.createElement('section');host.id='smartTaskBar';host.setAttribute('aria-label','创作任务');
 host.innerHTML=`<div class="task-intro"><strong>从一个想法开始</strong><span>选素材，描述需求，直接生成</span></div>
 <div class="task-types" role="group" aria-label="任务类型"><button data-kind="image">生成图片</button><button data-kind="edit">编辑图片</button><button data-kind="text">生成文本</button><button data-kind="video">生成视频</button></div>
 <div id="taskReferences" class="task-references"></div>
 <textarea id="taskPrompt" rows="2" placeholder="描述你想创作的内容…" aria-label="创作需求"></textarea>
 <div class="task-options"><button data-upload>＋ 素材</button><select id="taskModel" aria-label="供应商与模型"></select><label data-image-param>比例 <select id="taskRatio"><option>1:1</option><option>16:9</option><option>9:16</option><option>4:3</option><option>3:4</option></select></label><label data-count>数量 <input id="taskCount" type="number" min="1" max="8" value="1"></label><label data-video-param hidden>时长 <input id="taskDuration" type="number" min="1" max="60" value="5"> 秒</label><button data-settings hidden>配置模型</button><button data-run class="task-primary">生成</button></div>
 <details class="task-more"><summary>更多设置与高级工具</summary><div><label data-image-param>图像分辨率 <select id="taskResolution"><option value="1k">1K</option><option value="2k">2K</option><option value="4k">4K</option></select></label><button data-advanced>高级节点模式</button><span>循环、分组、手动连线、ComfyUI、RunningHub</span></div></details>
 <div id="taskStatus" role="status"></div>`;
 document.body.append(host);
 const actions=document.createElement('div');actions.id='smartTaskActions';document.body.append(actions);
 const tools=document.createElement('div');tools.id='smartTaskTools';tools.innerHTML='<button data-undo>撤销</button><button data-redo>重做</button><button data-fit>适应全部</button><button data-arrange>整理选中</button><button data-locate>定位结果</button><button data-basic hidden>返回快捷创作</button>';document.body.append(tools);
 const $=s=>host.querySelector(s), prompt=$('#taskPrompt'),model=$('#taskModel'),status=$('#taskStatus');
 let kind='image', refs=[], busy=false, signature='', lastResult='', advanced=false;
 let remembered={};try{remembered=JSON.parse(localStorage.getItem('jinni_task_models')||'{}')}catch(e){}
 const labels={image:'图像',edit:'图像',text:'文本',video:'视频'};
 function message(text){status.textContent=text}
 function models(){
  const scope=kind==='text'?'llm':kind==='video'?'video':'image',field=scope==='llm'?'chat_models':scope+'_models';
  const list=apiProviders.filter(p=>p.enabled!==false && (p.key_scopes?.[scope]?.configured ?? p.has_key) && !['runninghub','jimeng','codex','gemini-cli'].includes(p.protocol));
  const sig=JSON.stringify([kind,list.map(p=>[p.id,p[field]])]);if(sig===signature)return;signature=sig;
  const previous=model.value;model.replaceChildren();for(const p of list){const group=document.createElement('optgroup');group.label=p.name;for(const m of p[field]||[])group.append(new Option(m,JSON.stringify([p.id,m])));model.append(group)}
  const selected=remembered[kind]||previous;if([...model.options].some(o=>o.value===selected))model.value=selected;
  $('[data-settings]').hidden=!!model.options.length;$('[data-run]').disabled=busy||!model.options.length;
  if(!model.options.length)message('尚无可用模型，请先配置供应商及对应功能 Key。');
 }
 function setKind(next){kind=next;signature='';host.querySelectorAll('[data-kind]').forEach(b=>b.classList.toggle('active',b.dataset.kind===kind));host.querySelectorAll('[data-image-param]').forEach(el=>el.hidden=kind==='text');$('[data-count]').hidden=kind==='video'||kind==='text';$('[data-video-param]').hidden=kind!=='video';models();prompt.focus()}
 function renderRefs(){const area=$('#taskReferences');area.replaceChildren();refs.forEach((ref,index)=>{const button=document.createElement('button');button.type='button';button.title='移除参考素材';button.textContent=(ref.name||'参考素材')+' ×';if(mediaKindForItem(ref)==='image'){const img=document.createElement('img');img.src=ref.url;img.alt='';button.prepend(img)}button.onclick=()=>{refs.splice(index,1);renderRefs()};area.append(button)})}
 function addRefs(items){for(const ref of items){if(ref.url&&!refs.some(r=>r.url===ref.url)&&refs.length<SMART_REFERENCE_IMAGE_MAX)refs.push({...ref})}renderRefs()}
 async function upload(files){try{message('正在导入素材…');const images=await uploadFiles(files);if(!images.length)return;pushUndo();const node=createImageNodeAt(viewportCenter(),images,{skipUndo:true,select:false});addRefs(images.map(ref=>({...ref,sourceNodeId:node.id})));message('素材已加入本次任务')}catch(error){message(error.message)}}
 const input=document.createElement('input');input.type='file';input.multiple=true;input.accept='image/*,video/*,audio/*';input.hidden=true;host.append(input);input.onchange=()=>{upload([...input.files]);input.value=''};
 $('[data-upload]').onclick=()=>input.click();host.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation()});host.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();upload([...e.dataTransfer.files])});
 host.addEventListener('paste',e=>{const files=[...e.clipboardData.files];if(files.length){e.preventDefault();e.stopPropagation();upload(files)}});
 // Keep the canvas shortcuts from consuming task text or pointer gestures.
 for(const event of ['mousedown','pointerdown','dblclick','wheel'])host.addEventListener(event,e=>e.stopPropagation());
 $('[data-settings]').onclick=()=>{if(parent!==window)parent.postMessage({type:'jinni-open-settings'},location.origin);else window.open('/static/api-settings.html','_blank')};
 host.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>setKind(b.dataset.kind));
 model.onchange=()=>{remembered[kind]=model.value;localStorage.setItem('jinni_task_models',JSON.stringify(remembered))};
 function point(){const anchor=refs.map(r=>nodes.find(n=>n.id===r.sourceNodeId)).find(Boolean);const center=viewportCenter();let p={x:anchor?anchor.x+420:center.x-160,y:anchor?anchor.y:center.y-180};while(nodes.some(n=>Math.abs(n.x-p.x)<350&&Math.abs(n.y-p.y)<280))p.y+=310;return p}
 async function execute(retry=null){
  if(busy||!canvas)return;
  const text=retry?.task?.prompt??prompt.value.trim();
  if(!text){message('请先描述创作需求');return}
  if(!retry&&!model.value){message('请先配置可用模型');return}
  const selected=retry?[retry.task.provider,retry.task.model]:JSON.parse(model.value);
  const task=retry?structuredClone(retry.task):{kind,prompt:text,refs:structuredClone(refs),provider:selected[0],model:selected[1],count:kind==='text'||kind==='video'?1:Math.max(1,Math.min(8,Number($('#taskCount').value)||1)),ratio:$('#taskRatio').value,resolution:$('#taskResolution').value,duration:Math.max(1,Math.min(60,Number($('#taskDuration').value)||5)),status:'waiting'};
  if(task.kind==='edit'&&!task.refs.some(r=>mediaKindForItem(r)==='image')){message('请先添加要编辑的图片');return}
  busy=true;$('[data-run]').disabled=true;message('正在提交任务…');
  let node=retry;
  if(!node){const pos=point();pushUndo();node=task.kind==='text'?createPromptNode(pos.x,pos.y,{skipUndo:true,select:false}):createNode(pos.x,pos.y,[],{skipUndo:true,select:false});node.task=task;node.title=labels[task.kind]+'任务';for(const ref of task.refs){if(ref.sourceNodeId&&nodes.some(n=>n.id===ref.sourceNodeId)&&!canvas.connections.some(c=>c.from===ref.sourceNodeId&&c.to===node.id))canvas.connections.push({id:uid('conn'),from:ref.sourceNodeId,to:node.id,kind:'flow'})}}
  const owned=node.task;owned.status='running';delete owned.error;node.running=true;node.runStartedAt=nowMs();lastResult=node.id;render();scheduleSave();
  const runSettings={engine:'api',provider_id:task.provider,model:task.model,ratio:task.ratio,resolution:task.resolution,count:task.count,videoProvider:task.provider,videoModel:task.model,videoAspect:task.ratio,videoDuration:task.duration};
  try{
   if(task.kind==='text'){
    const response=await fetch('/api/canvas-llm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:task.prompt,provider:task.provider,model:task.model,images:imageRefsOnly(task.refs).map(r=>r.url),videos:videoRefsOnly(task.refs).map(r=>r.url)})});
    if(!response.ok)throw Error(await smartResponseErrorMessage(response,'文本生成失败'));node.text=(await response.json()).text||'';node.title='文本输出';
   }else if(task.kind==='video'){
    const results=await runApiVideoGeneration(task.prompt,task.refs,runSettings);if(!results.length)throw Error('未返回视频');finalizePendingNode(node,results,{prompt:task.prompt,sourceNodeId:node.id},'video');
   }else{
    if(node.pendingTasks?.length)await resumeSmartPendingNode(node);
    if(node.pendingTasks?.length)throw Error('已有任务尚未取回结果，请先查询该任务，避免重复提交');
    const count=Math.max(0,task.count-(node.images||[]).length);let submissionError='';
    // Persist each accepted task before submitting the next, so partial failures retain paid work.
    for(let i=0;i<count;i++){
     try{const result=await runApiGeneration(task.prompt,task.refs,{...runSettings,count:1});node.pendingTasks=[...(node.pendingTasks||[]),...result.taskIds.map(taskId=>({taskId,kind:'image',providerId:task.provider,model:task.model}))];node.pending=node.pendingTasks.length;await saveCanvas()}catch(error){submissionError=error.message;break}
    }
    if(node.pendingTasks?.length)await resumeSmartPendingNode(node);
    if((node.images||[]).length<task.count)throw Error(submissionError||'部分图片未生成，可重试失败项');
   }
   owned.status='done';message('生成完成，可选中结果继续创作');
  }catch(error){owned.status='failed';owned.error=String(error.message||error).slice(0,240);message(owned.error)}
  finally{node.running=false;node.pending=node.pendingTasks?.length||0;busy=false;$('[data-run]').disabled=!model.options.length;render();scheduleSave()}
 }
 $('[data-run]').onclick=()=>execute();prompt.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();execute()}});
 function advancedMode(value){advanced=value;document.body.classList.toggle('smart-advanced',value);host.hidden=value;tools.querySelector('[data-basic]').hidden=!value;if(value)updateComposer()}
 $('[data-advanced]').onclick=()=>advancedMode(true);tools.querySelector('[data-basic]').onclick=()=>advancedMode(false);
 tools.querySelector('[data-undo]').onclick=performUndo;tools.querySelector('[data-redo]').onclick=()=>performRedo();tools.querySelector('[data-fit]').onclick=fitAllNodesViewport;tools.querySelector('[data-arrange]').onclick=arrangeSelectedSmartNodes;
 function locate(node){if(!node)return;viewport.x=shell.clientWidth/2-(node.x+150)*viewport.scale;viewport.y=(shell.clientHeight-host.offsetHeight)/2-(node.y+100)*viewport.scale;applyViewport();scheduleSave()}
 tools.querySelector('[data-locate]').onclick=()=>locate(nodes.find(n=>n.id===lastResult));
 function button(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=fn;actions.append(b)}
 function sync(){
  models();host.classList.toggle('empty',!nodes.length);actions.replaceChildren();const node=selectedNode();
  if(node){
   const items=selectedImage.nodeId===node.id&&selectedImage.index>=0?[node.images?.[selectedImage.index]].filter(Boolean):imagesForNode(node);
   if(items.length){button('用作参考',()=>addRefs(items.map(r=>({...r,sourceNodeId:node.id}))));if(items.some(r=>mediaKindForItem(r)==='image')){button('继续修改',()=>{addRefs(items.map(r=>({...r,sourceNodeId:node.id})));setKind('edit')});button('生成视频',()=>{addRefs(items.map(r=>({...r,sourceNodeId:node.id})));setKind('video')})}button(items.some(r=>mediaKindForItem(r)==='video')?'播放':'预览',()=>openImagePreviewSmart(node.id,Math.max(0,selectedImage.index)));button('下载',()=>{for(const item of items){const a=document.createElement('a');a.href=item.url;a.download=item.name||'result';a.click()}})}
   if(node.text){button('复制文本',()=>navigator.clipboard.writeText(node.text).catch(()=>message('复制失败，请选中文本复制')));button('用作提示词',()=>{prompt.value=node.text;prompt.focus()})}
   if(node.task?.status==='failed')button('重试失败项',()=>execute(node));
  }
  for(const node of nodes.filter(n=>n.task)){
   const el=world.querySelector('[data-id="'+CSS.escape(node.id)+'"]');if(!el)continue;
   let badge=el.querySelector('.task-state');if(!badge){badge=document.createElement('div');badge.className='task-state';el.append(badge)}
   const t=node.task;badge.textContent=({waiting:'等待',running:'执行中',done:'已完成',failed:'失败 · 选中后重试'})[t.status]||t.status;badge.dataset.state=t.status;badge.title=t.error||t.prompt;
  }
 }
 const originalRender=render;render=function(...args){const value=originalRender(...args);sync();return value};
 document.addEventListener('click',()=>requestAnimationFrame(sync));window.addEventListener('focus',()=>{signature='';models()});
 window.JinniSmartTasks={sync,execute,addRefs,setKind};setKind('image');sync();
})();
