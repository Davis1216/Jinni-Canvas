(function(){
    const state = {
        space: {categories:[], items:[]},
        activeCategory: 'all',
        query: '',
        sort: 'created_desc',
        view: localStorage.getItem('inspiration_space_view') || 'grid',
        selectedItemId: '',
    };

    const $ = id => document.getElementById(id);
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
    const formatDate = ms => {
        const n = Number(ms || 0);
        if(!n) return '未记录';
        try { return new Date(n).toLocaleString('zh-CN', {hour12:false}); } catch { return '未记录'; }
    };
    const categoryName = id => state.space.categories.find(cat => cat.id === id)?.name || '未分类';
    const selectedItem = () => state.space.items.find(item => item.id === state.selectedItemId);
    const normalizeTags = value => String(value || '').split(/[,，、\n]/).map(s => s.trim()).filter(Boolean).slice(0, 40);

    function toast(message){
        const el = $('toast');
        if(!el) return;
        el.textContent = message;
        el.hidden = false;
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => { el.hidden = true; }, 2200);
    }

    const CHANGE_KEY = 'inspiration-space-changed';
    let spaceRevision = 0;
    let pendingWrites = 0;
    let loadPromise = null;
    let refreshQueued = false;
    let refreshTimer = 0;
    let hasLoadedSpace = false;
    const emptyMessage = $('emptyState').querySelector('p').textContent;
    function spaceIsVisible(){
        if(document.hidden) return false;
        try { return !window.frameElement || getComputedStyle(window.frameElement).visibility !== 'hidden'; }
        catch { return true; }
    }
    function requestRefresh(){
        if(!spaceIsVisible()) return;
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
            loadSpace().catch(() => {}); // Retain the current gallery on a temporary network failure.
        }, 0);
    }
    async function api(path, options={}){
        const writing = options.method && options.method !== 'GET';
        if(writing){ spaceRevision++; pendingWrites++; }
        try {
            const res = await fetch(path, {
                cache:'no-store',
                ...options,
                headers: {'Content-Type':'application/json', ...(options.headers || {})},
            });
            if(!res.ok){
                let detail = '';
                try { detail = (await res.json()).detail || ''; } catch {}
                throw new Error(detail || `请求失败：${res.status}`);
            }
            const data = await res.json();
            if(writing){
                try { localStorage.setItem(CHANGE_KEY, `${Date.now()}-${Math.random()}`); } catch {}
            }
            return data;
        } finally {
            if(writing){
                pendingWrites--;
                requestRefresh();
            }
        }
    }

    async function loadSpace(){
        if(pendingWrites){ refreshQueued = true; return; }
        if(loadPromise){ refreshQueued = true; return loadPromise; }
        const revision = spaceRevision;
        loadPromise = (async () => {
            const data = await api('/api/inspiration-space');
            // A GET started before a local edit must never restore its older snapshot.
            if(revision !== spaceRevision || pendingWrites) return;
            const next = data.space || {categories:[], items:[]};
            if(hasLoadedSpace && JSON.stringify(next) === JSON.stringify(state.space)) return;
            hasLoadedSpace = true;
            $('emptyState').querySelector('p').textContent = emptyMessage;
            state.space = next;
            if(state.activeCategory !== 'all' && !next.categories.some(cat => cat.id === state.activeCategory)){
                state.activeCategory = 'all';
            }
            render();
            if(state.selectedItemId){
                if(next.items.some(item => item.id === state.selectedItemId)) openDetail(state.selectedItemId);
                else closeDetail();
            }
        })();
        try { await loadPromise; }
        finally {
            loadPromise = null;
            if(refreshQueued){
                refreshQueued = false;
                requestRefresh();
            }
        }
    }

    function itemMatches(item){
        if(state.activeCategory !== 'all' && item.category_id !== state.activeCategory) return false;
        const q = state.query.trim().toLowerCase();
        if(!q) return true;
        return [
            item.title, item.prompt, item.notes, item.model, item.provider_name, item.workflow, item.ratio, item.size,
            ...(item.tags || [])
        ].some(value => String(value || '').toLowerCase().includes(q));
    }

    function sortedItems(){
        const items = (state.space.items || []).filter(itemMatches);
        const catIndex = new Map((state.space.categories || []).map((cat, index) => [cat.id, index]));
        items.sort((a, b) => {
            if(state.sort === 'updated_desc') return Number(b.updated_at || 0) - Number(a.updated_at || 0);
            if(state.sort === 'model') return String(a.model || '').localeCompare(String(b.model || ''), 'zh-CN') || Number(b.created_at || 0) - Number(a.created_at || 0);
            if(state.sort === 'category') return (catIndex.get(a.category_id) ?? 999) - (catIndex.get(b.category_id) ?? 999) || Number(b.created_at || 0) - Number(a.created_at || 0);
            return Number(b.created_at || 0) - Number(a.created_at || 0);
        });
        return items;
    }

    function renderCategories(){
        const counts = new Map();
        (state.space.items || []).forEach(item => counts.set(item.category_id || 'uncategorized', (counts.get(item.category_id || 'uncategorized') || 0) + 1));
        $('totalCount').textContent = `${state.space.items?.length || 0} 张`;
        const allCount = state.space.items?.length || 0;
        const cats = [
            {id:'all', name:'全部灵感', color:'#2563eb', count:allCount, system:true},
            ...(state.space.categories || []).map(cat => ({...cat, count:counts.get(cat.id) || 0}))
        ];
        $('categoryList').innerHTML = cats.map(cat => `
            <div class="category-item ${state.activeCategory === cat.id ? 'active' : ''}" data-category-id="${escapeHtml(cat.id)}" style="--cat-color:${escapeHtml(cat.color || '#2563eb')}">
                <span class="category-dot"></span>
                <span class="category-name">${escapeHtml(cat.name)}</span>
                <span class="category-count">${cat.count}</span>
                <div class="category-actions">
                    ${cat.id !== 'all' ? `<button class="category-btn category-edit" data-edit-category="${escapeHtml(cat.id)}" type="button" title="编辑分类"><i data-lucide="pencil"></i></button>` : ''}
                    ${cat.id !== 'all' ? `<button class="category-btn category-delete" data-delete-category="${escapeHtml(cat.id)}" type="button" title="删除分类"><i data-lucide="trash-2"></i></button>` : ''}
                </div>
            </div>
        `).join('');
        $('categoryList').querySelectorAll('.category-item').forEach(btn => {
            btn.addEventListener('click', event => {
                const del = event.target.closest('[data-delete-category]');
                if(del){
                    event.preventDefault();
                    event.stopPropagation();
                    deleteCategoryById(del.dataset.deleteCategory);
                    return;
                }
                const edit = event.target.closest('[data-edit-category]');
                if(edit){
                    event.preventDefault();
                    event.stopPropagation();
                    openCategoryModal(edit.dataset.editCategory);
                    return;
                }
                state.activeCategory = btn.dataset.categoryId || 'all';
                render();
            });
        });
    }

    function chipsFor(item){
        return [item.model, item.ratio || item.size, item.provider_name || item.workflow, ...(item.tags || []).slice(0, 2)]
            .filter(Boolean)
            .slice(0, 4)
            .map(value => `<span class="chip">${escapeHtml(value)}</span>`)
            .join('');
    }

    function renderGallery(){
        const grid = $('galleryGrid');
        grid.classList.toggle('masonry', state.view === 'masonry');
        $('gridViewBtn').classList.toggle('active', state.view === 'grid');
        $('masonryViewBtn').classList.toggle('active', state.view === 'masonry');
        const items = sortedItems();
        $('emptyState').hidden = items.length > 0;
        grid.innerHTML = items.map(item => `
            <article class="insp-card" data-item-id="${escapeHtml(item.id)}">
                <div class="card-media">
                    <img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy">
                    <div class="card-overlay">
                        <button type="button" data-copy-prompt="${escapeHtml(item.id)}" title="复制提示词"><i data-lucide="copy"></i></button>
                        <button type="button" data-edit-item="${escapeHtml(item.id)}" title="编辑"><i data-lucide="pencil"></i></button>
                        <button type="button" data-open-item="${escapeHtml(item.id)}" title="详情"><i data-lucide="maximize-2"></i></button>
                        <button type="button" class="btn-delete-card" data-delete-item="${escapeHtml(item.id)}" title="删除灵感"><i data-lucide="trash-2"></i></button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="card-title">${escapeHtml(item.title || '灵感图像')}</div>
                    <div class="card-prompt">${escapeHtml(item.prompt || item.notes || '未记录提示词')}</div>
                    <div class="chip-row">${chipsFor(item) || `<span class="chip">${escapeHtml(categoryName(item.category_id))}</span>`}</div>
                </div>
            </article>
        `).join('');
        grid.querySelectorAll('.insp-card').forEach(card => {
            card.addEventListener('click', event => {
                if(event.target.closest('button')) return;
                openDetail(card.dataset.itemId);
            });
        });
        grid.querySelectorAll('[data-open-item]').forEach(btn => btn.addEventListener('click', () => openDetail(btn.dataset.openItem)));
        grid.querySelectorAll('[data-edit-item]').forEach(btn => btn.addEventListener('click', () => openItemModal(btn.dataset.editItem)));
        grid.querySelectorAll('[data-copy-prompt]').forEach(btn => btn.addEventListener('click', () => copyPrompt(btn.dataset.copyPrompt)));
        grid.querySelectorAll('[data-delete-item]').forEach(btn => btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteItemById(btn.dataset.deleteItem);
        }));
    }

    function render(){
        renderCategories();
        renderGallery();
        lucide.createIcons();
    }

    function metaRows(item){
        const rows = [
            ['分类', categoryName(item.category_id)],
            ['来源', sourceLabel(item.source_type)],
            ['供应商', item.provider_name || item.provider_id],
            ['模型', item.model],
            ['比例', item.ratio],
            ['尺寸', item.size],
            ['工作流', item.workflow || item.workflow_id],
            ['Seed', item.seed],
            ['加入时间', formatDate(item.created_at)],
            ['更新时间', formatDate(item.updated_at)],
        ].filter(([, value]) => value);
        return rows.map(([label, value]) => `<div class="meta-item"><span>${escapeHtml(label)}</span><strong title="${escapeHtml(value)}">${escapeHtml(value)}</strong></div>`).join('');
    }

    function sourceLabel(type){
        return {online:'在线生图', canvas:'无限画布'}[type] || type || '未记录';
    }

    function openDetail(id){
        const item = state.space.items.find(entry => entry.id === id);
        if(!item) return;
        state.selectedItemId = id;
        $('detailTitle').textContent = item.title || '灵感图像';
        $('detailImage').src = item.image_url;
        $('detailPrompt').textContent = item.prompt || '未记录';
        $('detailNotes').textContent = item.notes || '未记录';
        $('detailMeta').innerHTML = metaRows(item) || '<div class="meta-item"><span>参数</span><strong>未记录</strong></div>';
        $('detailDrawer').hidden = false;
        lucide.createIcons();
    }

    function closeDetail(){
        $('detailDrawer').hidden = true;
        state.selectedItemId = '';
    }

    async function copyPrompt(id){
        const item = state.space.items.find(entry => entry.id === id) || selectedItem();
        if(!item?.prompt) return toast('没有可复制的提示词');
        await navigator.clipboard?.writeText(item.prompt);
        toast('已复制提示词');
    }

    function fillCategorySelect(selected=''){
        $('categorySelect').innerHTML = (state.space.categories || []).map(cat => `<option value="${escapeHtml(cat.id)}" ${cat.id === selected ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`).join('');
    }

    function openCategoryModal(categoryId=''){
        const cat = categoryId ? state.space.categories.find(item => item.id === categoryId) : null;
        $('editingKind').value = 'category';
        $('editingId').value = cat?.id || '';
        $('editKicker').textContent = cat ? 'CATEGORY' : 'NEW CATEGORY';
        $('editTitle').textContent = cat ? '编辑分类' : '新建分类';
        $('titleInput').value = cat?.name || '';
        $('notesInput').value = cat?.description || '';
        $('colorInput').value = cat?.color || '#2563eb';
        $('categoryField').hidden = true;
        $('tagsField').hidden = true;
        $('promptField').hidden = true;
        $('colorField').hidden = false;
        $('deleteCategoryBtn').hidden = !cat;
        $('deleteItemFromEditBtn').hidden = true;
        $('titleField').querySelector('span').textContent = '名称';
        $('editModal').hidden = false;
        lucide.createIcons();
    }

    function openItemModal(itemId){
        const item = state.space.items.find(entry => entry.id === itemId);
        if(!item) return;
        $('editingKind').value = 'item';
        $('editingId').value = item.id;
        $('editKicker').textContent = 'INSPIRATION';
        $('editTitle').textContent = '编辑灵感';
        $('titleInput').value = item.title || '';
        $('promptInput').value = item.prompt || '';
        $('notesInput').value = item.notes || '';
        $('tagsInput').value = (item.tags || []).join('，');
        fillCategorySelect(item.category_id);
        $('categoryField').hidden = false;
        $('tagsField').hidden = false;
        $('promptField').hidden = false;
        $('colorField').hidden = true;
        $('deleteCategoryBtn').hidden = true;
        $('deleteItemFromEditBtn').hidden = false;
        $('titleField').querySelector('span').textContent = '标题';
        $('editModal').hidden = false;
        lucide.createIcons();
    }

    function closeEdit(){
        $('editModal').hidden = true;
        $('deleteCategoryBtn').hidden = true;
        $('deleteItemFromEditBtn').hidden = true;
        $('editForm').reset();
    }

    async function saveEdit(event){
        event.preventDefault();
        const kind = $('editingKind').value;
        const id = $('editingId').value;
        if(kind === 'category'){
            const payload = {name:$('titleInput').value.trim() || '新分类', description:$('notesInput').value.trim(), color:$('colorInput').value};
            try {
                const data = id
                    ? await api(`/api/inspiration-space/categories/${encodeURIComponent(id)}`, {method:'PATCH', body:JSON.stringify(payload)})
                    : await api('/api/inspiration-space/categories', {method:'POST', body:JSON.stringify(payload)});
                state.space = data.space;
                closeEdit();
                render();
                toast(id ? '分类已更新' : '分类已创建');
            } catch(e) {
                toast(e.message || '操作失败');
            }
            return;
        }
        if(kind === 'item' && id){
            const item = state.space.items.find(entry => entry.id === id);
            const payload = {
                title:$('titleInput').value.trim() || item?.title || '灵感图像',
                category_id:$('categorySelect').value || 'uncategorized',
                prompt:$('promptInput').value,
                tags:normalizeTags($('tagsInput').value),
                notes:$('notesInput').value,
                params:item?.params || {},
            };
            try {
                const data = await api(`/api/inspiration-space/items/${encodeURIComponent(id)}`, {method:'PATCH', body:JSON.stringify(payload)});
                state.space = data.space;
                closeEdit();
                render();
                if(!$('detailDrawer').hidden) openDetail(id);
                toast('灵感已更新');
            } catch(e) {
                toast(e.message || '更新失败');
            }
        }
    }

    function uiConfirm(message, title = '确认操作') {
        const modal = $('confirmModal');
        if (!modal) return Promise.resolve(window.confirm(message));
        return new Promise(resolve => {
            $('confirmTitle').textContent = title;
            $('confirmMessage').innerHTML = escapeHtml(message).replace(/\n/g, '<br>');
            modal.hidden = false;
            lucide.createIcons();

            const cleanup = (result) => {
                modal.hidden = true;
                $('confirmOkBtn')?.removeEventListener('click', onOk);
                $('confirmCancelBtn')?.removeEventListener('click', onCancel);
                $('confirmCloseXBtn')?.removeEventListener('click', onCancel);
                $('confirmBackdrop')?.removeEventListener('click', onCancel);
                resolve(result);
            };

            const onOk = () => cleanup(true);
            const onCancel = () => cleanup(false);

            $('confirmOkBtn')?.addEventListener('click', onOk);
            $('confirmCancelBtn')?.addEventListener('click', onCancel);
            $('confirmCloseXBtn')?.addEventListener('click', onCancel);
            $('confirmBackdrop')?.addEventListener('click', onCancel);
        });
    }

    async function deleteItemById(id){
        if(!id) return;
        const item = state.space.items.find(entry => entry.id === id);
        if(!item) return;
        const ok = await uiConfirm(`确定删除灵感「${item.title || '此图片'}」？\n只会删除灵感空间副本，不影响画布原图。`, '确认删除灵感');
        if(!ok) return;

        // 乐观更新：瞬间从本地列表剔除并从界面消除，彻底消灭延迟感！
        const backupItems = [...state.space.items];
        state.space.items = state.space.items.filter(entry => entry.id !== id);
        if(state.selectedItemId === id) closeDetail();
        if(!$('editModal').hidden && $('editingId').value === id) closeEdit();
        render();
        toast('已删除灵感');

        try {
            const data = await api(`/api/inspiration-space/items/${encodeURIComponent(id)}`, {method:'DELETE'});
            state.space = data.space;
            render();
        } catch(err) {
            state.space.items = backupItems;
            render();
            toast('删除失败: ' + err.message);
        }
    }

    async function deleteCategoryById(id){
        if(!id || id === 'all') return;
        const cat = state.space.categories.find(c => c.id === id);
        const name = cat ? cat.name : '该分类';
        const ok = await uiConfirm(`确定删除分类「${name}」？\n分类下的灵感图像不会被删除，将保留在全部灵感中。`, '确认删除分类');
        if(!ok) return;

        // 乐观更新：立即移除分类并把该分类下的条目归整
        const backupCategories = [...state.space.categories];
        const backupItems = state.space.items.map(it => ({...it}));
        const remainingCats = state.space.categories.filter(c => c.id !== id);
        const fallbackId = remainingCats[0]?.id || '';
        state.space.categories = remainingCats;
        state.space.items.forEach(it => {
            if(it.category_id === id) it.category_id = fallbackId;
        });
        if(state.activeCategory === id) state.activeCategory = 'all';
        if(!$('editModal').hidden && $('editingId').value === id) closeEdit();
        render();
        toast('分类已删除');

        try {
            const data = await api(`/api/inspiration-space/categories/${encodeURIComponent(id)}`, {method:'DELETE'});
            state.space = data.space;
            render();
        } catch(err) {
            state.space.categories = backupCategories;
            state.space.items = backupItems;
            render();
            toast('删除分类失败: ' + err.message);
        }
    }

    function bindEvents(){
        $('searchInput')?.addEventListener('input', event => {
            state.query = event.target.value;
            renderGallery();
            lucide.createIcons();
        });
        $('sortSelect')?.addEventListener('change', event => {
            state.sort = event.target.value;
            renderGallery();
            lucide.createIcons();
        });
        $('gridViewBtn')?.addEventListener('click', () => {
            state.view = 'grid';
            localStorage.setItem('inspiration_space_view', state.view);
            renderGallery();
            lucide.createIcons();
        });
        $('masonryViewBtn')?.addEventListener('click', () => {
            state.view = 'masonry';
            localStorage.setItem('inspiration_space_view', state.view);
            renderGallery();
            lucide.createIcons();
        });
        $('addCategoryBtn')?.addEventListener('click', () => openCategoryModal());
        document.querySelectorAll('[data-close-detail]').forEach(el => el.addEventListener('click', closeDetail));
        document.querySelectorAll('[data-close-edit]').forEach(el => el.addEventListener('click', closeEdit));
        $('editForm')?.addEventListener('submit', saveEdit);
        $('copyPromptBtn')?.addEventListener('click', () => copyPrompt());
        $('editItemBtn')?.addEventListener('click', () => {
            const item = selectedItem();
            if(item) openItemModal(item.id);
        });
        $('deleteItemBtn')?.addEventListener('click', () => deleteItemById(state.selectedItemId));
        $('deleteCategoryBtn')?.addEventListener('click', () => deleteCategoryById($('editingId').value));
        $('deleteItemFromEditBtn')?.addEventListener('click', () => deleteItemById($('editingId').value));
        document.addEventListener('keydown', event => {
            if(event.key === 'Escape'){
                if(!$('editModal').hidden) closeEdit();
                else if(!$('detailDrawer').hidden) closeDetail();
            }
        });
    }

    window.addEventListener('message', event => {
        if(event.origin !== location.origin || event.source !== window.parent) return;
        if(event.data?.type === 'inspiration-focus') requestRefresh();
    });
    window.addEventListener('focus', requestRefresh);
    window.addEventListener('pageshow', requestRefresh);
    document.addEventListener('visibilitychange', requestRefresh);
    // Fallback for updates from another window or a client without notifications.
    setInterval(requestRefresh, 5000);
    window.addEventListener('storage', event => {
        if(event.key === CHANGE_KEY) requestRefresh();
        if(event.key === 'studio_theme' || event.key === 'canvas_theme') {
            const dark = event.newValue === 'dark';
            document.documentElement.classList.toggle('studio-theme-dark', dark);
            document.documentElement.classList.toggle('theme-dark', dark);
        }
    });

    bindEvents();
    loadSpace().catch(err => {
        $('emptyState').hidden = false;
        $('emptyState').querySelector('p').textContent = err.message || '灵感空间加载失败';
        lucide.createIcons();
    });
})();
