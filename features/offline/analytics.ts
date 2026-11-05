import type { AnalyticsData, AnalyticsDetails, AnalyticsFilters } from "../pm/analytics/types";
import type { ReportDetail } from "../pm/types";
const sections=["construction","operation","verification","examination"] as const;
const shift=(day:string,n:number)=>{const d=new Date(day+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const state=(d:ReportDetail)=>d.record.status==="completed" ? "completed" : d.record.status==="ready_for_signature"||d.record.currentStep==="review" ? "review" : "draft";
const brand=(d:ReportDetail)=>d.record.equipmentBrandId||d.record.brand;
const lab=(d:ReportDetail)=>d.record.labName?.trim()||"Not recorded";
export function offlineAnalytics(details:ReportDetail[], filters:AnalyticsFilters, params?:URLSearchParams):AnalyticsData|AnalyticsDetails {
  const start=shift(filters.end,1-filters.days),previousStart=shift(start,-filters.days),previousEnd=shift(start,-1);
  const cohort=details.filter(d=>d.record.status!=="archived"&&!d.record.deletedAt&&(filters.brand==="all"||brand(d)===filters.brand));
  const valid=(s:string|null)=>Boolean(s&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s);
  const current=cohort.filter(d=>valid(d.record.performedOn)&&d.record.performedOn!>=start&&d.record.performedOn!<=filters.end);
  const ordered=[...current].sort((a,b)=>(b.record.performedOn||"").localeCompare(a.record.performedOn||"")||b.record.updatedAt.localeCompare(a.record.updatedAt)||a.record.id.localeCompare(b.record.id));
  const summary=(d:ReportDetail)=>({ ...d.record,performedOn:d.record.performedOn! });
  if (params) {
    const kind=params.get("kind")||"all",value=params.get("value")||"";
    const matched=ordered.filter(d=>{
      if(kind==="all")return true;
      if(kind==="period")return d.record.performedOn!>=(params.get("from")||start)&&d.record.performedOn!<=(params.get("to")||filters.end);
      if(kind==="state")return state(d)===value;
      if(kind==="lab")return lab(d)===value;
      if(kind==="brand")return brand(d)===value;
      if(kind==="equipment")return `${brand(d)}:${d.record.freezerSerial?.trim().toUpperCase()}`===value;
      if(kind==="section")return !!d.record.payload.notes?.[value as typeof sections[number]]?.trim();
      if(kind==="model") { try { const [b,f,m]=JSON.parse(value);return b===brand(d)&&f===d.record.modelFamily&&m===d.record.model; }catch{return false;} }
      return false;
    });
    const page=Math.max(1,Number(params.get("page"))||1);return {records:matched.slice((page-1)*25,page*25).map(summary),total:matched.length,page,pageSize:25};
  }
  const group=(key:(d:ReportDetail)=>string,label:(d:ReportDetail)=>string)=>Array.from(current.reduce((m,d)=>{const k=key(d);const old=m.get(k);m.set(k,{key:k,label:label(d),count:(old?.count||0)+1});return m;},new Map<string,{key:string;label:string;count:number}>()).values()).sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key));
  const days=Array.from(new Set(current.map(d=>d.record.performedOn!))).sort();
  const models=group(d=>JSON.stringify([brand(d),d.record.modelFamily,d.record.model]),d=>d.record.equipmentBrandName||(d.record.brand==="mve"?"MVE":"Taylor-Wharton"));
  return {start,end:filters.end,previousStart,previousEnd,total:current.length,previousTotal:cohort.filter(d=>valid(d.record.performedOn)&&d.record.performedOn!>=previousStart&&d.record.performedOn!<=previousEnd).length,
    completed:current.filter(d=>state(d)==="completed").length,review:current.filter(d=>state(d)==="review").length,draft:current.filter(d=>state(d)==="draft").length,
    equipment:new Set(current.filter(d=>d.record.freezerSerial?.trim()).map(d=>`${brand(d)}:${d.record.freezerSerial!.trim().toUpperCase()}`)).size,
    missingSerial:current.filter(d=>!d.record.freezerSerial?.trim()).length,undated:cohort.filter(d=>!valid(d.record.performedOn)).length,
    daily:days.map(date=>({date,completed:current.filter(d=>d.record.performedOn===date&&state(d)==="completed").length,open:current.filter(d=>d.record.performedOn===date&&state(d)!=="completed").length})),
    sections:sections.map(key=>({key,label:key[0].toUpperCase()+key.slice(1),count:current.filter(d=>d.record.payload.notes?.[key]?.trim()).length})),
    labs:group(lab,lab),brands:group(brand,d=>d.record.equipmentBrandName||(d.record.brand==="mve"?"MVE":"Taylor-Wharton")),
    topModels:models.slice(0,3).map(m=>{const [brandId,family,model]=JSON.parse(m.key);return {key:m.key,brandId,brandName:m.label,family,model,count:m.count};}),featured:ordered[0]?summary(ordered[0]):null};
}
