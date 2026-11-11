// Reconcile only NVWA-owned wallpaper filenames. A saved install flag is never inventory.
export function wallpaperInventory(payload) {
    const list=Array.isArray(payload)?payload:payload?.images;
    if(!Array.isArray(list))throw new Error('inventory-shape');
    const names=list.map(item=>typeof item==='string'?item:item?.filename);
    if(names.some(name=>typeof name!=='string'||!name))throw new Error('inventory-shape');
    return new Set(names);
}
export function createBundledWallpapers({files,getHeaders,assetURL,refresh,fetcher=fetch,onReady=()=>{},timeoutMs=12000}) {
    const owned=[...new Set(files)];let pending=null;
    let state={phase:'idle',missing:0,uploaded:0,verified:false,refreshed:false,error:''};
    async function request(url,options={}) {
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
        try{return await fetcher(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}
    }
    async function inventory() {
        const response=await request('/api/backgrounds/all',{method:'POST',headers:getHeaders(),body:'{}',cache:'no-store'});
        if(!response.ok)throw new Error('inventory-http-'+response.status);
        return wallpaperInventory(await response.json());
    }
    async function run() {
        state={phase:'checking',missing:0,uploaded:0,verified:false,refreshed:false,error:''};
        try{
            const have=await inventory(),missing=owned.filter(file=>!have.has(file));state.missing=missing.length;
            for(const file of missing){
                state.phase='uploading';
                const image=await request(assetURL(file),{cache:'no-store'});
                if(!image.ok)throw new Error('asset-http-'+image.status);
                const blob=await image.blob();if(!blob.size)throw new Error('asset-empty');
                const form=new FormData();form.append('avatar',new File([blob],file,{type:'image/png'}));
                const uploaded=await request('/api/backgrounds/upload',{method:'POST',headers:getHeaders({omitContentType:true}),body:form});
                if(!uploaded.ok)throw new Error('upload-http-'+uploaded.status);
                state.uploaded++;
            }
            if(missing.length){state.phase='verifying';const after=await inventory();if(owned.some(file=>!after.has(file)))throw new Error('verification-missing');}
            state.verified=true;onReady();state.phase='refreshing';
            try{await refresh();state.refreshed=true;}catch{state.error='refresh-unavailable';}
            state.phase='ready';return{ok:true,...state};
        }catch(error){state.phase='failed';state.error=error?.name==='AbortError'?'request-timeout':/^(inventory|asset|upload|verification)-/.test(error?.message)?error.message:'request-failed';return{ok:false,...state};}
    }
    return{ensure(){if(!pending)pending=run().finally(()=>{pending=null;});return pending;},status:()=>({...state,busy:!!pending})};
}
