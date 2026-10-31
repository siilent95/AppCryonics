import type { AnalyticsData, Drill } from "./types";
export function StatusChart({ data, onDrill }: { data: AnalyticsData; onDrill: (drill: Drill) => void }) {
  const rate = data.total ? Math.round(data.completed / data.total * 100) : 0;
  const closed = data.total ? data.completed / data.total * 360 : 0;
  const review = data.total ? (data.completed + data.review) / data.total * 360 : 0;
  const states = [{ value: "completed", label: "Completed", count: data.completed, color: "closed" }, { value: "draft", label: "Draft", count: data.draft, color: "open" }, { value: "review", label: "Review", count: data.review, color: "review" }];
  return <section className="analytics-panel status-panel"><header><div><h2>Document status</h2></div></header>
    <div className="status-donut" role="img" aria-label={`${data.completed} completed, ${data.draft} draft, ${data.review} review records`} style={{ background: data.total ? `conic-gradient(#00a9ce 0deg ${closed}deg,#d6aa62 ${closed}deg ${review}deg,#526f85 ${review}deg 360deg)` : "#294358" }}><div><strong>{data.total ? `${rate}%` : "—"}</strong><span>{data.total ? "Completed" : "No records"}</span></div></div>
    <div className="status-key">{states.map(state => <button type="button" key={state.value} onClick={() => onDrill({ kind: "state", value: state.value, title: `${state.label} PM records` })}><span><i className={`swatch ${state.color}`} />{state.label}</span><strong>{state.count}</strong><small>{data.total ? Math.round(state.count / data.total * 100) : 0}%</small></button>)}</div>
  </section>;
}
