// Local host state only. Unrelated input SVG/class updates do not rescan quick replies.
export function createHostInteractionState({holder,form,home,qrToggle,onQrBar=()=>{}}) {
    let enabled=false,bar=null;
    function syncHome(){home.classList.toggle('ilg-home-covered',!!holder.querySelector(':scope > .drawer > .drawer-content.openDrawer'));}
    function syncQr(){qrToggle.classList.toggle('ilg-qr-empty',!bar?.querySelector('.qr--button'));}
    function bindQr(){
        const found=form.ownerDocument.getElementById('qr--bar');
        const next=found&&form.contains(found)?found:null;
        if(next===bar)return;
        const previous=bar;qrObserver.disconnect();bar=next;
        if(bar)qrObserver.observe(bar,{childList:true,subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['class','id']});
        onQrBar(previous,bar);syncQr();
    }
    const homeObserver=new MutationObserver(mutations=>{
        if(mutations.some(m=>m.target===holder||m.target.parentElement===holder
            ||m.target.parentElement?.parentElement===holder))syncHome();
    });
    const qrObserver=new MutationObserver(mutations=>{
        if(bar?.id!=='qr--bar'){bindQr();return;}
        if(mutations.some(m=>m.type==='childList'
            ? [...m.addedNodes,...m.removedNodes].some(n=>n.nodeType===1)
            : m.attributeName==='class'&&m.target.classList.contains('qr--button')!==(m.oldValue||'').split(/\s+/).includes('qr--button')))syncQr();
    });
    const formObserver=new MutationObserver(mutations=>{
        if(!bar||!bar.isConnected||!form.contains(bar)||mutations.some(m=>m.type==='attributes'
            &&(m.target===bar||m.target.id==='qr--bar'||m.oldValue==='qr--bar')))bindQr();
    });
    function setEnabled(value){
        const next=value===true;if(next===enabled)return;enabled=next;
        if(enabled){
            syncHome();bindQr();syncQr();
            homeObserver.observe(holder,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
            formObserver.observe(form,{childList:true,subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['id']});
        }else{
            homeObserver.disconnect();qrObserver.disconnect();formObserver.disconnect();bar=null;
            home.classList.remove('ilg-home-covered');qrToggle.classList.remove('ilg-qr-empty');
        }
    }
    return{setEnabled,destroy:()=>setEnabled(false)};
}
