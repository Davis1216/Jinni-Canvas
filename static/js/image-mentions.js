(function(){
    'use strict';

    const TOKEN_CLASS = 'image-mention-token';
    let activePreview = null;

    function escapeHtml(value){
        return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
    }
    function candidateKey(item){
        return String(item?.key || item?.sourceId || item?.source_id || item?.url || '');
    }
    function findMatchingCandidate(part, candidates){
        if(!part || !candidates || !candidates.length) return null;
        const norm = normalizeCandidates(candidates);
        const key = candidateKey(part);
        // 1. 精确 key 匹配
        let found = norm.find(item => item.key === key || item.sourceId === key);
        if(found) return found;

        // 2. node id 前缀匹配
        const partNodeId = String(part.sourceId || part.key || '').split(':')[0];
        if(partNodeId){
            found = norm.find(item => {
                const itemNodeId = String(item.linkSourceId || item.sourceId || item.key || '').split(':')[0];
                return itemNodeId === partNodeId;
            });
            if(found) return found;
        }

        // 3. 图片 URL 精确匹配（导入工作流资源、替换资源后的强力兼容）
        if(part.url){
            const partCleanUrl = String(part.url).split('?')[0];
            found = norm.find(item => item.url && String(item.url).split('?')[0] === partCleanUrl);
            if(found) return found;
        }

        // 4. 图片标签名匹配（如“图片1”，“图片2”）
        const partLabel = String(part.name || part.label || '').trim();
        if(partLabel){
            found = norm.find(item => item.label === partLabel || item.name === partLabel);
            if(found) return found;
        }

        return null;
    }
    function normalizeCandidates(items){
        return (items || []).filter(item => item?.url).map((item, index) => ({
            ...item,
            key:candidateKey(item),
            sourceId:String(item.sourceId || item.source_id || candidateKey(item)),
            index:Number(item.index || index + 1),
            label:String(item.label || `图片${index + 1}`),
            name:String(item.name || item.label || `图片${index + 1}`)
        }));
    }
    function tokenElement(part, candidate=null){
        const item = candidate || part || {};
        const token = document.createElement('span');
        token.className = TOKEN_CLASS + (candidate ? '' : ' invalid');
        token.contentEditable = 'false';
        token.dataset.key = candidateKey(item);
        token.dataset.sourceId = String(item.sourceId || item.source_id || '');
        token.dataset.url = String(item.url || '');
        token.dataset.name = String(candidate ? (item.label || item.name || '图片') : (item.name || item.label || '图片'));
        token.title = candidate ? `${item.label || item.name} · ${item.name || ''}` : `引用已失效：${item.name || '图片'}`;
        const label = candidate ? (item.label || item.name) : `${item.name || '图片'}（失效）`;
        token.innerHTML = item.url
            ? `<img decoding="async" src="${escapeHtml(item.thumbnailUrl || item.url)}" alt=""><span class="image-mention-label">${escapeHtml(label)}</span>`
            : `<span class="image-mention-missing">!</span><span class="image-mention-label">${escapeHtml(label)}</span>`;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'image-mention-remove';
        remove.contentEditable = 'false';
        remove.setAttribute('aria-label', `删除${label}引用`);
        remove.title = '删除图片引用';
        remove.textContent = '×';
        remove.addEventListener('mousedown', event => {
            event.preventDefault();
            event.stopPropagation();
        });
        remove.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            removeToken(token);
        });
        token.appendChild(remove);
        token.addEventListener('mouseenter', () => showPreview(token));
        token.addEventListener('mouseleave', hidePreview);
        return token;
    }
    function ensurePreview(){
        if(activePreview) return activePreview;
        activePreview = document.createElement('div');
        activePreview.className = 'image-mention-preview';
        activePreview.innerHTML = '<img alt="reference preview">';
        document.body.appendChild(activePreview);
        return activePreview;
    }
    function showPreview(token){
        const url = token?.dataset?.url;
        if(!url || token.classList.contains('invalid')) return;
        const preview = ensurePreview();
        preview.querySelector('img').src = url;
        const rect = token.getBoundingClientRect();
        preview.style.left = `${Math.max(8, Math.min(window.innerWidth - 228, rect.left))}px`;
        preview.style.top = `${Math.min(window.innerHeight - 228, rect.bottom + 7)}px`;
        preview.classList.add('open');
    }
    function hidePreview(){
        activePreview?.classList.remove('open');
    }
    function removeToken(token){
        if(!confirm('确认移除这张图片引用？')) return;
        const editor = token?.closest?.('.image-mention-editor');
        if(!editor) return;
        let caretNode = token.nextSibling;
        if(caretNode?.nodeType === Node.TEXT_NODE && String(caretNode.textContent || '').startsWith(' ')){
            if(caretNode.textContent.length === 1){
                const following = caretNode.nextSibling;
                caretNode.remove();
                caretNode = following;
            } else {
                caretNode.textContent = caretNode.textContent.slice(1);
            }
        }
        token.remove();
        hidePreview();
        editor.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        if(caretNode && editor.contains(caretNode)){
            if(caretNode.nodeType === Node.TEXT_NODE) range.setStart(caretNode, 0);
            else range.setStartBefore(caretNode);
            range.collapse(true);
        } else {
            range.selectNodeContents(editor);
            range.collapse(false);
        }
        selection?.removeAllRanges();
        selection?.addRange(range);
        editor.dispatchEvent(new Event('input', {bubbles:true}));
    }
    function appendText(parent, text){
        const lines = String(text || '').split('\n');
        lines.forEach((line, index) => {
            if(index) parent.appendChild(document.createElement('br'));
            if(line) parent.appendChild(document.createTextNode(line));
        });
    }
    function renderParts(editor, parts, candidates=[]){
        if(!editor) return;
        editor.replaceChildren();
        (parts || []).forEach(part => {
            if(part?.type === 'image') {
                const matched = findMatchingCandidate(part, candidates);
                editor.appendChild(tokenElement(part, matched));
            }
            else appendText(editor, part?.text || '');
        });
    }
    function setPlainText(editor, text){
        if(!editor) return;
        editor.replaceChildren();
        appendText(editor, text || '');
    }
    function serialize(editor){
        const parts = [];
        const pushText = text => {
            if(!text) return;
            const last = parts[parts.length - 1];
            if(last?.type === 'text') last.text += text;
            else parts.push({type:'text', text});
        };
        const walk = node => {
            if(node.nodeType === Node.TEXT_NODE){ pushText(node.textContent || ''); return; }
            if(node.nodeType !== Node.ELEMENT_NODE) return;
            if(node.classList?.contains(TOKEN_CLASS)){
                parts.push({
                    type:'image',
                    key:node.dataset.key || '',
                    sourceId:node.dataset.sourceId || '',
                    url:node.dataset.url || '',
                    name:node.dataset.name || '图片'
                });
                return;
            }
            if(node.tagName === 'BR'){ pushText('\n'); return; }
            const isBlock = node !== editor && ['DIV','P','LI'].includes(node.tagName);
            if(isBlock && parts.length && !String(parts.at(-1)?.text || '').endsWith('\n')) pushText('\n');
            node.childNodes.forEach(walk);
            if(isBlock) pushText('\n');
        };
        editor.childNodes.forEach(walk);
        return parts;
    }
    function plainText(parts){
        return (parts || []).map(part => part?.type === 'image' ? `@${part.name || '图片'}` : (part?.text || ''))
            .join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    function partsFromText(text, candidates=[]){
        const value = String(text || '');
        const items = normalizeCandidates(candidates).sort((a,b) => b.label.length - a.label.length);
        if(!value.includes('@') || !items.length) return [{type:'text', text:value}];
        const parts = [];
        let buffer = '';
        const flush = () => { if(buffer){ parts.push({type:'text', text:buffer}); buffer = ''; } };
        for(let i=0; i<value.length;){
            if(value[i] === '@'){
                const hit = items.find(item => value.slice(i + 1, i + 1 + item.label.length) === item.label);
                if(hit){
                    flush();
                    parts.push({type:'image', key:hit.key, sourceId:hit.sourceId, url:hit.url, name:hit.label});
                    i += hit.label.length + 1;
                    continue;
                }
            }
            buffer += value[i++];
        }
        flush();
        return parts;
    }
    function compile(parts, references=[]){
        const refs = normalizeCandidates(references);
        const byKey = new Map(refs.map((item, index) => [item.key, {...item, finalIndex:index + 1}]));
        const invalid = [];
        let mentioned = false;
        let body = '';
        (parts || []).forEach(part => {
            if(part?.type !== 'image'){ body += part?.text || ''; return; }
            mentioned = true;
            const ref = byKey.get(candidateKey(part));
            if(!ref){ invalid.push(part); body += `@${part.name || '图片'}`; return; }
            body += `图${ref.finalIndex}`;
        });
        body = body.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        const displayPrompt = plainText(parts);
        if(!mentioned || invalid.length) return {modelPrompt:body, displayPrompt, mentioned, invalid};
        const mapping = refs.map((ref, index) => `图${index + 1}：${ref.label || ref.name || `图片${index + 1}`}${ref.name && ref.name !== ref.label ? `，${ref.name}` : ''}`).join('\n');
        return {modelPrompt:`参考图映射：\n${mapping}\n\n用户要求：\n${body}`, displayPrompt, mentioned:true, invalid:[]};
    }
    function textBeforeCaret(editor){
        const sel = window.getSelection();
        if(!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return '';
        const range = sel.getRangeAt(0).cloneRange();
        range.selectNodeContents(editor);
        range.setEnd(sel.anchorNode, sel.anchorOffset);
        return range.toString();
    }
    function create(options){
        const editor = options.editor;
        const picker = options.picker;
        let savedRange = null;
        let activeIndex = 0;
        let openItems = [];
        const getCandidates = () => normalizeCandidates(options.getCandidates?.() || []);
        const notify = () => options.onChange?.(serialize(editor));
        const saveRange = () => {
            const sel = window.getSelection();
            if(sel?.rangeCount && editor.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
        };
        const close = () => {
            picker?.classList.remove('open');
            if(picker) picker.innerHTML = '';
            openItems = [];
            activeIndex = 0;
        };
        const positionPicker = () => {
            if(!picker) return;
            const shell = picker.offsetParent || editor.parentElement;
            const shellRect = shell.getBoundingClientRect();
            const editorRect = editor.getBoundingClientRect();
            const caretRect = savedRange?.getBoundingClientRect?.();
            const anchor = caretRect && (caretRect.width || caretRect.height) ? caretRect : editorRect;
            const maxLeft = Math.max(0, shellRect.width - picker.offsetWidth);
            picker.style.left = `${Math.max(0, Math.min(maxLeft, anchor.left - shellRect.left))}px`;
            const below = anchor.bottom - shellRect.top + 6;
            const above = anchor.top - shellRect.top - picker.offsetHeight - 6;
            picker.style.top = `${anchor.bottom + picker.offsetHeight + 12 <= window.innerHeight || above < 0 ? below : above}px`;
        };
        const markActive = () => picker?.querySelectorAll('[data-mention-option]').forEach((el, i) => el.classList.toggle('active', i === activeIndex));
        const open = () => {
            if(!picker) return;
            openItems = getCandidates();
            picker.innerHTML = openItems.length
                ? `<div class="image-mention-picker-title">选择参考图</div><div class="image-mention-options">${openItems.map((item, i) => `<button type="button" data-mention-option="${i}"><span class="image-mention-option-index">${item.index}</span><img decoding="async" src="${escapeHtml(item.thumbnailUrl || item.url)}" alt=""><span>${escapeHtml(item.label)}</span></button>`).join('')}</div>`
                : '<div class="image-mention-empty">请先上传或连接参考图</div>';
            activeIndex = 0;
            picker.classList.add('open');
            positionPicker();
            markActive();
            picker.querySelectorAll('[data-mention-option]').forEach(button => {
                button.addEventListener('mousedown', event => {
                    event.preventDefault(); event.stopPropagation();
                    insert(openItems[Number(button.dataset.mentionOption)]);
                });
            });
        };
        const insert = item => {
            if(!item) return;
            editor.focus();
            const sel = window.getSelection();
            if(savedRange){ sel.removeAllRanges(); sel.addRange(savedRange); }
            const range = sel.rangeCount ? sel.getRangeAt(0) : document.createRange();
            if(range.startContainer?.nodeType === Node.TEXT_NODE && range.startOffset > 0){
                const value = range.startContainer.textContent || '';
                if(value[range.startOffset - 1] === '@'){
                    range.setStart(range.startContainer, range.startOffset - 1);
                    range.deleteContents();
                }
            }
            const token = tokenElement({type:'image', ...item}, item);
            range.insertNode(token);
            const spacer = document.createTextNode(' ');
            token.after(spacer);
            range.setStartAfter(spacer); range.collapse(true);
            sel.removeAllRanges(); sel.addRange(range);
            savedRange = range.cloneRange();
            close(); notify(); editor.focus();
        };
        const insertText = (text, mode='insert') => {
            if(mode === 'replace'){
                setPlainText(editor, text || '');
                notify(); editor.focus();
                return;
            }
            editor.focus();
            const sel = window.getSelection();
            if(savedRange){ sel.removeAllRanges(); sel.addRange(savedRange); }
            const range = sel.rangeCount ? sel.getRangeAt(0) : document.createRange();
            if(!sel.rangeCount){ range.selectNodeContents(editor); range.collapse(false); }
            const beforeRange = range.cloneRange();
            beforeRange.selectNodeContents(editor);
            beforeRange.setEnd(range.startContainer, range.startOffset);
            const afterRange = range.cloneRange();
            afterRange.selectNodeContents(editor);
            afterRange.setStart(range.endContainer, range.endOffset);
            const before = beforeRange.toString();
            const after = afterRange.toString();
            const value = String(text || '');
            const insertedText = `${before && !before.endsWith('\n') ? '\n' : ''}${value}${after && !value.endsWith('\n') ? '\n' : ''}`;
            range.deleteContents();
            const fragment = document.createDocumentFragment();
            insertedText.split('\n').forEach((line, index) => {
                if(index) fragment.appendChild(document.createElement('br'));
                if(line) fragment.appendChild(document.createTextNode(line));
            });
            const tail = document.createTextNode('');
            fragment.appendChild(tail);
            range.insertNode(fragment);
            range.setStartAfter(tail); range.collapse(true);
            sel.removeAllRanges(); sel.addRange(range);
            savedRange = range.cloneRange();
            notify(); editor.focus();
        };
        editor.addEventListener('input', () => {
            saveRange();
            if(/@$/.test(textBeforeCaret(editor))) open(); else close();
            notify();
        });
        editor.addEventListener('keyup', saveRange);
        editor.addEventListener('mouseup', saveRange);
        editor.addEventListener('keydown', event => {
            if(!picker?.classList.contains('open')) return;
            if(event.key === 'ArrowDown' || event.key === 'ArrowUp'){
                event.preventDefault();
                activeIndex = (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + Math.max(1, openItems.length)) % Math.max(1, openItems.length);
                markActive();
            } else if(event.key === 'Enter' && openItems.length){ event.preventDefault(); insert(openItems[activeIndex]); }
            else if(event.key === 'Escape'){ event.preventDefault(); close(); }
        });
        editor.addEventListener('blur', () => setTimeout(() => { if(!picker?.matches(':hover')) close(); }, 100));
        return {
            serialize:() => serialize(editor),
            plainText:() => plainText(serialize(editor)),
            setParts:(parts) => { renderParts(editor, parts, getCandidates()); notify(); },
            setText:(text) => { setPlainText(editor, text); notify(); },
            insertText,
            restoreText:(text) => { renderParts(editor, partsFromText(text, getCandidates()), getCandidates()); notify(); },
            refresh:() => {
                const parts = serialize(editor);
                const caretInside = editor.contains(document.activeElement) || editor === document.activeElement;
                renderParts(editor, parts, getCandidates());
                if(caretInside) editor.focus();
            },
            candidates:getCandidates,
            close
        };
    }

    window.StudioImageMentions = {create, compile, serialize, plainText, renderParts, setPlainText, partsFromText, normalizeCandidates, candidateKey, findMatchingCandidate};
})();
