/* A save operation reports completion only after the destination has been written. */
window.JinniExport = {
 async prepare(filename, mime){
  const native = window.webkit?.messageHandlers?.saveCanvasExport;
  const windows = window.top.jinniSaveExport;
  if(native || windows){
   return async blob=>{
    const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob)});
    const result=native?await native.postMessage({filename,base64:encoded}):await windows(filename,encoded);
    if(result.status==='error')throw Error(result.message||'写入失败');
    return result;
   };
  }
  if(window.showSaveFilePicker){
   const handle=await window.showSaveFilePicker({id:'jinni-canvas-export',suggestedName:filename,types:[{description:mime==='application/zip'?'画布与资源':'画布',accept:{[mime]:[mime==='application/zip'?'.zip':'.json']}}]});
   return async blob=>{const stream=await handle.createWritable();try{await stream.write(blob);await stream.close()}catch(error){await stream.abort().catch(()=>{});throw error}return {status:'saved',path:handle.name}};
  }
  return async blob=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);return {status:'download',message:'已提交浏览器下载，保存位置由浏览器下载设置管理'}};
 },
 message(result){return result.status==='cancelled'?'已取消导出':result.status==='saved'?'已导出至 '+result.path:result.message}
};
