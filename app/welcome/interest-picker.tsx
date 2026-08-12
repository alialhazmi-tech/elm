"use client";

import { useActionState, useMemo, useState } from "react";
import { MEMBER_INTERESTS } from "@/lib/membership/interests";
import { completeOnboarding, type InterestsState } from "./actions";

const initialState: InterestsState = {};

export function InterestPicker({ name, initial = [] }: { name: string; initial?: string[] }) {
  const [selected, setSelected] = useState(initial);
  const [state, action, pending] = useActionState(completeOnboarding, initialState);
  const suggestions = useMemo(
    () => MEMBER_INTERESTS.filter((interest) => !selected.includes(interest.id)).slice(0, selected.length >= 2 ? 3 : 0),
    [selected],
  );

  const toggle = (id: string) => setSelected((current) => {
    if (current.includes(id)) return current.filter((item) => item !== id);
    return current.length < 7 ? [...current, id] : current;
  });

  return (
    <form action={action} className="onboard-choice">
      <header className="onboard-head">
        <span>أهلًا يا {name}</span>
        <h1>وش تحب تعرف أكثر؟</h1>
        <p>اختر من 3 إلى 7 اهتمامات. أنت تتحكم بما يعرفه العلم عن اهتماماتك، ويمكنك تعديلها متى شئت.</p>
      </header>

      <div className="interest-grid">
        {MEMBER_INTERESTS.map((interest) => {
          const checked = selected.includes(interest.id);
          return (
            <label key={interest.id} className={checked ? "selected" : ""} style={{ "--interest": interest.color } as React.CSSProperties}>
              <input type="checkbox" name="interests" value={interest.id} checked={checked} onChange={() => toggle(interest.id)} />
              <i>{checked ? "✓" : "+"}</i><b>{interest.label}</b><small>{interest.description}</small>
            </label>
          );
        })}
      </div>

      {suggestions.length > 0 && (
        <aside className="interest-suggestions">
          <span>بناءً على اختياراتك، قد يعجبك أيضًا</span>
          <div>{suggestions.map((item) => <button type="button" key={item.id} onClick={() => toggle(item.id)}>+ {item.label}</button>)}</div>
          <small>اقتراحات آلية خفيفة، ولا نضيف شيئًا دون اختيارك.</small>
        </aside>
      )}

      {state.error && <p className="member-auth-error" role="alert">{state.error}</p>}
      <footer className="onboard-actions">
        <span>{selected.length} مختارة</span>
        <button disabled={pending || selected.length < 3}>{pending ? "نحفظ اختياراتك…" : "تأكيد اهتماماتي"}</button>
      </footer>
    </form>
  );
}
