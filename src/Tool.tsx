// Plotline: plots, waiting list, watering rota and harvest log for a community garden.
import { useState } from "react";
import { downloadIcs, localDate } from "./lib/ics";
import { waLink } from "./lib/share";
import { uid, useStored } from "./lib/store";
import { addDays, prettyDate, todayISO } from "./lib/time";
import { Section, Stat, Stats } from "./ui/kit";

const T = "plotline";
type Plot = { no: number; holder: string; phone: string; since: string; paid: boolean; state: "tended" | "needs care" | "free" };
type Wait = { id: string; name: string; phone: string; joined: string };
type Harvest = { id: string; date: string; plot: number; crop: string; kg: number };
const names = ["Amel", "Hedi", "Sonia", "Karim", "Rym", "", "Walid", "Nadia", "Omar", "", "Lina", "Sami"];
const SAMPLE_PLOTS: Plot[] = names.map((n, i) => ({ no: i + 1, holder: n, phone: "", since: n ? "2025-03-01" : "", paid: n ? i % 4 !== 2 : false, state: !n ? "free" : i === 7 ? "needs care" : "tended" }));

export default function Plotline() {
  const [garden, setGarden] = useStored(T, "garden", { name: "Jardin partagé d'El Menzah", fee: 60, cols: 4, day: 6, commonBeds: "Herb spiral, compost, fruit trees" });
  const [plots, setPlots] = useStored<Plot[]>(T, "plots", SAMPLE_PLOTS);
  const [wait, setWait] = useStored<Wait[]>(T, "wait", [{ id: "w1", name: "Youssef", phone: "", joined: "2026-05-12" }, { id: "w2", name: "Ines", phone: "", joined: "2026-07-03" }, { id: "w3", name: "Dora", phone: "", joined: "2026-09-01" }]);
  const [harvest, setHarvest] = useStored<Harvest[]>(T, "harvest", [{ id: "h1", date: addDays(todayISO(), -9), plot: 2, crop: "Tomatoes", kg: 6.5 }, { id: "h2", date: addDays(todayISO(), -6), plot: 5, crop: "Courgettes", kg: 4 }, { id: "h3", date: addDays(todayISO(), -2), plot: 2, crop: "Peppers", kg: 2.2 }, { id: "h4", date: addDays(todayISO(), -1), plot: 11, crop: "Herbs", kg: 0.8 }]);
  const [sel, setSel] = useState<number | null>(null);
  const [nw, setNw] = useState({ name: "", phone: "" });
  const [nh, setNh] = useState({ plot: "1", crop: "", kg: "" });
  const members = plots.filter(p => p.holder);
  // Watering rota for the shared beds: plot holders take turns, one per week.
  const rota = Array.from({ length: 8 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + ((garden.day - d.getDay() + 7) % 7) + i * 7); return { date: d.toISOString().slice(0, 10), who: members[i % Math.max(1, members.length)]?.holder ?? "" }; });
  const p = plots.find(x => x.no === sel);
  const setP = (no: number, patch: Partial<Plot>) => setPlots(plots.map(x => (x.no === no ? { ...x, ...patch } : x)));
  const offer = (no: number) => { const w = wait[0]; if (!w) return; setP(no, { holder: w.name, phone: w.phone, since: todayISO(), paid: false, state: "tended" }); setWait(wait.slice(1)); };
  const kg = harvest.filter(h => h.date >= `${new Date().getFullYear()}-01-01`).reduce((a, h) => a + h.kg, 0);

  return (
    <div className="stack">
      <Section title={garden.name}>
        <Stats><Stat value={`${members.length}/${plots.length}`} label="Plots taken" /><Stat value={wait.length} label="Waiting list" tone={wait.length ? "warn" : undefined} /><Stat value={plots.filter(x => x.holder && !x.paid).length} label="Fees unpaid" tone="bad" /><Stat value={`${kg.toFixed(1)} kg`} label="Harvested this year" tone="good" /></Stats>
      </Section>
      <div className="grid2">
        <Section title="The plots">
          <div className="pl-map" style={{ gridTemplateColumns: `repeat(${garden.cols}, 1fr)` }}>{plots.map(x => <button key={x.no} className={"pl-plot " + x.state.replace(" ", "-") + (sel === x.no ? " on" : "")} onClick={() => setSel(x.no)}><b>{x.no}</b><span>{x.holder || "Free"}</span>{x.holder && !x.paid && <em>Unpaid</em>}</button>)}</div>
          <div className="row" style={{ marginTop: 10, gap: 12 }}><span className="note"><i className="pl-key tended" /> Tended</span><span className="note"><i className="pl-key needs-care" /> Needs care</span><span className="note"><i className="pl-key free" /> Free</span></div>
          <button className="btn small" style={{ marginTop: 10 }} onClick={() => setPlots([...plots, { no: plots.length + 1, holder: "", phone: "", since: "", paid: false, state: "free" }])}>Add a plot</button>
        </Section>
        {p ? <Section title={`Plot ${p.no}`} aside={<button className="btn ghost small" onClick={() => setSel(null)}>Close</button>}>
          {p.holder ? <div className="stack" style={{ gap: 10 }}>
            <div className="row"><label className="field"><span>Gardener</span><input className="input" value={p.holder} onChange={e => setP(p.no, { holder: e.target.value })} /></label><label className="field"><span>WhatsApp</span><input className="input" value={p.phone} onChange={e => setP(p.no, { phone: e.target.value })} /></label></div>
            <div className="row" style={{ alignItems: "center" }}><label className="check"><input type="checkbox" checked={p.paid} onChange={e => setP(p.no, { paid: e.target.checked })} />Paid {garden.fee} this year</label><select className="input" style={{ width: "auto" }} aria-label="State" value={p.state} onChange={e => setP(p.no, { state: e.target.value as Plot["state"] })}><option value="tended">Tended</option><option value="needs care">Needs care</option></select></div>
            <div className="row">{p.state === "needs care" && <a className="btn small" href={waLink(`Hi ${p.holder}, plot ${p.no} at ${garden.name} needs some attention (weeds and watering). Is everything OK? Let us know if you need help or want to give the plot up.`, p.phone)} target="_blank" rel="noreferrer">Send a friendly nudge</a>}{!p.paid && <a className="btn small" href={waLink(`Hi ${p.holder}, a reminder that the ${garden.fee} plot fee for ${garden.name} is due. Thank you!`, p.phone)} target="_blank" rel="noreferrer">Fee reminder</a>}<button className="btn ghost small danger" onClick={() => setP(p.no, { holder: "", phone: "", since: "", paid: false, state: "free" })}>Free this plot</button></div>
            <p className="note">Since {p.since || "unknown"}. Harvested {harvest.filter(h => h.plot === p.no).reduce((a, h) => a + h.kg, 0).toFixed(1)} kg.</p>
          </div> : <div className="stack" style={{ gap: 10 }}><p>This plot is free.</p>{wait[0] ? <button className="btn primary" style={{ alignSelf: "flex-start" }} onClick={() => offer(p.no)}>Give it to {wait[0].name} (first on the list)</button> : <p className="note">Nobody is waiting.</p>}</div>}
        </Section> : <Section title="Waiting list">
          {wait.map((w, i) => <div key={w.id} className="row" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)", alignItems: "center" }}><span className="pill">{i + 1}</span><span style={{ flex: 1 }}>{w.name} <span className="note">since {prettyDate(w.joined)}</span></span><button className="btn ghost small danger" onClick={() => setWait(wait.filter(x => x.id !== w.id))}>×</button></div>)}
          <form className="row" style={{ marginTop: 10 }} onSubmit={e => { e.preventDefault(); if (!nw.name.trim()) return; setWait([...wait, { id: uid(), name: nw.name.trim(), phone: nw.phone, joined: todayISO() }]); setNw({ name: "", phone: "" }); }}><input className="input" style={{ flex: 1 }} aria-label="Name" placeholder="Name" value={nw.name} onChange={e => setNw({ ...nw, name: e.target.value })} /><input className="input" style={{ flex: 1 }} aria-label="WhatsApp" placeholder="WhatsApp" value={nw.phone} onChange={e => setNw({ ...nw, phone: e.target.value })} /><button className="btn small" type="submit">Add</button></form>
          <p className="note" style={{ marginTop: 8 }}>Tap a free plot to offer it to the first person waiting.</p>
        </Section>}
      </div>
      <div className="grid2">
        <Section title={`Watering the shared beds (${garden.commonBeds})`} aside={<button className="btn small" onClick={() => downloadIcs("watering-rota.ics", rota.map(r => ({ title: `Watering duty: ${r.who}`, start: localDate(r.date, "08:00"), allDay: true })), "Garden rota")}>To calendar</button>}>
          {rota.map(r => <p key={r.date} className="row" style={{ justifyContent: "space-between" }}><span>{prettyDate(r.date)}</span><strong>{r.who}</strong></p>)}
          <label className="field" style={{ marginTop: 10, maxWidth: 200 }}><span>Rota day</span><select className="input" value={garden.day} onChange={e => setGarden({ ...garden, day: +e.target.value })}>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
        </Section>
        <Section title="Harvest log">
          <form className="row" onSubmit={e => { e.preventDefault(); if (!nh.crop.trim()) return; setHarvest([{ id: uid(), date: todayISO(), plot: parseInt(nh.plot) || 1, crop: nh.crop.trim(), kg: parseFloat(nh.kg) || 0 }, ...harvest]); setNh({ ...nh, crop: "", kg: "" }); }}><select className="input" aria-label="Plot" value={nh.plot} onChange={e => setNh({ ...nh, plot: e.target.value })}>{plots.map(x => <option key={x.no} value={x.no}>Plot {x.no}</option>)}</select><input className="input" style={{ flex: 1 }} aria-label="Crop" placeholder="Crop" value={nh.crop} onChange={e => setNh({ ...nh, crop: e.target.value })} /><input className="input num" style={{ width: 70 }} aria-label="Kg" placeholder="kg" value={nh.kg} onChange={e => setNh({ ...nh, kg: e.target.value })} /><button className="btn small" type="submit">Log</button></form>
          {Object.entries(harvest.reduce((a, h) => ({ ...a, [h.crop]: (a[h.crop] ?? 0) + h.kg }), {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).map(([c, v]) => <p key={c} className="row" style={{ justifyContent: "space-between", marginTop: 6 }}><span>{c}</span><span className="num">{v.toFixed(1)} kg</span></p>)}
        </Section>
      </div>
      <Section title="Garden settings"><div className="row"><label className="field"><span>Name</span><input className="input" value={garden.name} onChange={e => setGarden({ ...garden, name: e.target.value })} /></label><label className="field"><span>Yearly fee</span><input className="input num" value={garden.fee} onChange={e => setGarden({ ...garden, fee: parseFloat(e.target.value) || 0 })} /></label><label className="field"><span>Plots per row</span><input className="input num" value={garden.cols} onChange={e => setGarden({ ...garden, cols: Math.max(1, parseInt(e.target.value) || 4) })} /></label><label className="field"><span>Shared beds</span><input className="input" value={garden.commonBeds} onChange={e => setGarden({ ...garden, commonBeds: e.target.value })} /></label></div></Section>
      <style>{`.pl-map{display:grid;gap:6px}.pl-plot{border:0;border-radius:8px;padding:10px 6px;display:grid;gap:2px;cursor:pointer;text-align:center;color:#151933;position:relative;min-height:70px}.pl-plot b{font-family:var(--serif);font-weight:400;font-size:22px}.pl-plot span{font-size:12px;font-weight:600}
      .pl-plot.tended,.pl-key.tended{background:#9fd8a8}.pl-plot.needs-care,.pl-key.needs-care{background:#f2cf7a}.pl-plot.free,.pl-key.free{background:repeating-linear-gradient(135deg,#e3e5ec 0 6px,#f4f5f8 6px 12px)}.pl-plot.on{outline:3px solid var(--accent)}.pl-plot em{position:absolute;top:4px;right:4px;font-style:normal;font-size:9px;background:#C0343F;color:#fff;padding:0 4px;border-radius:3px}
      .pl-key{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:middle;margin-right:4px}`}</style>
    </div>
  );
}
