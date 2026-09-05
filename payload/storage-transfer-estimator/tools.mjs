const clean = (v) => typeof v === 'string' ? v.trim() : '';
const issue = (path, code, message) => ({ path, code, message });

export function aiShotRiskRegister(input) {
  const errors=[]; const rows=[];
  if (!input || !Array.isArray(input.shots)) return {valid:false,errors:[issue('shots','required','shots must be an array')],rows:[]};
  const weights={low:0,medium:1,high:2}; const controls=['continuity','controllability','disclosure','fallbackReadiness'];
  for (const [i,shot] of input.shots.entries()) {
    const unanswered=[]; let score=0;
    for (const key of controls) { const v=shot?.risks?.[key]; if (!(v in weights)) unanswered.push(key); else score+=weights[v]; }
    const level=unanswered.length?'unknown':score>=5?'high':score>=3?'medium':'low';
    const owner=clean(shot?.reviewOwner); const fallback=clean(shot?.fallbackMethod);
    if (level==='high'&&!owner) errors.push(issue(`shots[${i}].reviewOwner`,'owner_required','High-risk rows require a human review owner'));
    rows.push({shotId:clean(shot?.id)||`shot-${i+1}`,score:unanswered.length?null:score,level,unansweredControls:unanswered,fallbackReady:Boolean(fallback),reviewOwner:owner||null,decision:'HUMAN_REVIEW_ONLY'});
  }
  return {valid:errors.length===0,errors,rows,fallbackCoverage:{ready:rows.filter(r=>r.fallbackReady).length,total:rows.length},rightsClearance:'NOT_ASSESSED',productionMethodDecision:'NOT_MADE'};
}

export function cgiAssetReadiness(input) {
  const errors=[]; const rows=[]; const accepted=new Set(input?.requirements?.acceptedFormats||[]); const convertible=new Set(input?.requirements?.convertibleFormats||[]);
  if (!Array.isArray(input?.assets)) return {valid:false,errors:[issue('assets','required','assets must be an array')],rows:[]};
  for (const [i,a] of input.assets.entries()) {
    const gaps=[]; const conversions=[]; const format=clean(a.format).toLowerCase();
    if (!format) gaps.push('format'); else if (accepted.has(format)) {} else if (convertible.has(format)) conversions.push(`convert ${format}`); else gaps.push('unsupported format');
    if (!(Number(a.scale)>0)||!clean(a.unit)) gaps.push('scale/unit');
    if (a.textureStatus!=='complete') gaps.push(a.textureStatus==='placeholder'?'final textures':'textures');
    if (a.approvalStatus!=='current') gaps.push(a.approvalStatus==='expired'?'renew approval':'approval');
    const id=clean(a.id)||`asset-${i+1}`; if(!clean(a.id)) errors.push(issue(`assets[${i}].id`,'required','Asset ID is required'));
    rows.push({assetId:id,status:gaps.length?'BLOCKED':conversions.length?'CONVERTIBLE':'READY',conversionNeeds:conversions,blockingGaps:gaps,metadataOnly:true});
  }
  return {valid:errors.length===0,errors,rows,binaryMediaInspected:false};
}

export function mediaRightsEvidence(input,{today='2026-09-05'}={}) {
  if (!Array.isArray(input?.items)) return {valid:false,errors:[issue('items','required','items must be an array')],rows:[]};
  const errors=[]; const rows=[]; const need=input.requirements||{};
  for (const [i,m] of input.items.entries()) {
    const gaps=[]; if(!clean(m.provenance))gaps.push('provenance'); if(!clean(m.evidenceReference))gaps.push('evidence reference');
    const territories=new Set(m.territories||[]); for(const x of need.territories||[])if(!territories.has(x))gaps.push(`territory:${x}`);
    const channels=new Set(m.channels||[]); for(const x of need.channels||[])if(!channels.has(x))gaps.push(`channel:${x}`);
    if(m.termEnd&&m.termEnd<today)gaps.push('expired term'); if(need.termEnd&&m.termEnd&&m.termEnd<need.termEnd)gaps.push('term scope');
    if(m.perpetual===true&&!clean(m.evidenceReference))gaps.push('unsupported perpetual claim');
    rows.push({mediaId:clean(m.id)||`media-${i+1}`,readiness:gaps.length?'REVIEW_REQUIRED':'EVIDENCE_PRESENT',gaps,legalClearance:'NOT_PROVIDED'});
  }
  return {valid:errors.length===0,errors,rows,legalClearance:'NOT_PROVIDED'};
}

export function releaseFormAudit(input) {
  const errors=[]; const missing=[]; const conflicts=[]; const form=input?.form||{};
  for(const key of input?.requiredFields||[]) if(!clean(form[key]))missing.push(key);
  for(const [k,v] of Object.entries(form)) if(/signature|identityDocument/i.test(k)&&(typeof v==='string'&&(/data:image|base64/i.test(v)||v.length>500))) errors.push(issue(`form.${k}`,'sensitive_upload_rejected','Signature images and identity documents are not accepted'));
  if(form.consentDate&&form.usageStart&&form.consentDate>form.usageStart)conflicts.push('consent after usage start');
  if(form.termEnd&&form.usageStart&&form.termEnd<form.usageStart)conflicts.push('term ends before usage starts');
  if(form.revoked===true)conflicts.push('release marked revoked');
  if(form.isMinor===true&&!clean(form.guardianConsentReference))missing.push('guardianConsentReference');
  return {valid:errors.length===0&&missing.length===0&&conflicts.length===0,errors,missingFields:[...new Set(missing)],conflicts,humanReviewRequired:true,signerAuthenticated:false,dataStored:false};
}

export function safeAreaCalculate(input) {
  const w=Number(input?.sourceWidth),h=Number(input?.sourceHeight),safeX=Number(input?.safePercentX),safeY=Number(input?.safePercentY); const mode=input?.fitMode;
  const m=/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(clean(input?.targetRatio));
  const errors=[]; if(!(w>0&&h>0))errors.push(issue('source','invalid','Source dimensions must be positive')); if(!m)errors.push(issue('targetRatio','invalid','Use W:H')); if(!(safeX>=0&&safeX<50&&safeY>=0&&safeY<50))errors.push(issue('safePercent','invalid','Safe percentages must be 0..<50')); if(!['contain','cover'].includes(mode))errors.push(issue('fitMode','invalid','fitMode must be contain or cover')); if(errors.length)return{valid:false,errors};
  const ratio=Number(m[1])/Number(m[2]); let tw,th;
  if (mode==='contain') {
    if (w/h>ratio) { tw=Math.round(w); th=Math.round(w/ratio); }
    else { th=Math.round(h); tw=Math.round(h*ratio); }
  } else {
    if (w/h>ratio) { th=Math.round(h); tw=Math.round(h*ratio); }
    else { tw=Math.round(w); th=Math.round(w/ratio); }
  }
  const delta={x:tw-w,y:th-h}; const rect={x:Math.round(tw*safeX/100),y:Math.round(th*safeY/100),width:Math.round(tw*(1-2*safeX/100)),height:Math.round(th*(1-2*safeY/100))};
  return {valid:true,errors:[],rounding:'nearest integer pixel',sourceRatio:w/h,targetRatio:ratio,dimensions:{width:tw,height:th},operation:mode==='contain'?'pad':'crop',deltaPixels:delta,safeArea:rect};
}

export function storageTransferEstimate(input) {
  const system=input?.unitSystem; const base=system==='SI'?1000:system==='IEC'?1024:null; const errors=[];
  if(!base)errors.push(issue('unitSystem','invalid','Use SI or IEC')); if(!Array.isArray(input?.assets))errors.push(issue('assets','required','assets must be an array')); if(errors.length)return{valid:false,errors};
  let raw=0; const unknown=[];
  for(const [i,a] of input.assets.entries()){const size=Number(a.size),versions=Number(a.versions);if(a.size==null||a.size===''){unknown.push(clean(a.id)||`asset-${i+1}`);continue}if(!(size>=0&&Number.isSafeInteger(versions)&&versions>=0)){errors.push(issue(`assets[${i}]`,'invalid','Size must be nonnegative and versions a safe nonnegative integer'));continue}raw+=size*versions}
  const replication=Number(input.replicationFactor),copies=Number(input.transferCopies); if(!Number.isSafeInteger(replication)||replication<0||!Number.isSafeInteger(copies)||copies<0)errors.push(issue('multipliers','invalid','Replication and transfer copies must be safe nonnegative integers'));
  const storage=raw*replication,transfer=raw*copies;if(!Number.isSafeInteger(storage)||!Number.isSafeInteger(transfer))errors.push(issue('total','overflow','Calculated total exceeds safe integer precision'));
  return {valid:errors.length===0,errors,status:unknown.length?'UNKNOWN_INPUTS':'COMPLETE',unknownAssets:unknown,unitSystem:system,base,storageTotal:errors.length?null:storage,transferTotal:errors.length?null:transfer,cloudPrice:null,bandwidthPromise:false};
}

export const tools={
 'ai-shot-risk-register':aiShotRiskRegister,'cgi-asset-readiness-checker':cgiAssetReadiness,
 'media-rights-evidence-checklist':mediaRightsEvidence,'release-form-field-auditor':releaseFormAudit,
 'aspect-ratio-safe-area-calculator':safeAreaCalculate,'storage-transfer-estimator':storageTransferEstimate
};
