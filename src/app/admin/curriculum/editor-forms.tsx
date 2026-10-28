"use client";

import { useActionState } from "react";
import { saveEducationSystem, saveGrade, saveLearningArea, type SaveState } from "./actions";

const initialState: SaveState = { ok: false, message: "" };

function Feedback({ state }: { state: SaveState }) {
  if (!state.message) return null;
  return <p className="admin-form-message" data-ok={state.ok ? "true" : "false"} role="status">{state.message}</p>;
}

export function SystemEditor({
  id,
  startsOn,
  endsOn,
  isActive,
}: {
  id: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveEducationSystem, initialState);
  return (
    <form action={formAction} className="admin-form">
      <input type="hidden" name="id" value={id} />
      <div className="admin-field"><label htmlFor={`system-start-${id}`}>Starts on</label><input id={`system-start-${id}`} name="starts_on" type="date" defaultValue={startsOn} /></div>
      <div className="admin-field"><label htmlFor={`system-end-${id}`}>Ends on</label><input id={`system-end-${id}`} name="ends_on" type="date" defaultValue={endsOn} /></div>
      <label className="admin-check"><input type="checkbox" name="is_active" defaultChecked={isActive} /> Active</label>
      <button className="admin-submit" type="submit" disabled={pending}>{pending ? "Saving…" : "Save system"}</button>
      <Feedback state={state} />
    </form>
  );
}

export function GradeEditor({
  id,
  startsOn,
  endsOn,
  isActive,
}: {
  id: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveGrade, initialState);
  return (
    <form action={formAction} className="admin-form">
      <input type="hidden" name="id" value={id} />
      <div className="admin-field"><label htmlFor={`grade-start-${id}`}>Starts on</label><input id={`grade-start-${id}`} name="starts_on" type="date" defaultValue={startsOn} /></div>
      <div className="admin-field"><label htmlFor={`grade-end-${id}`}>Ends on</label><input id={`grade-end-${id}`} name="ends_on" type="date" defaultValue={endsOn} /></div>
      <label className="admin-check"><input type="checkbox" name="is_active" defaultChecked={isActive} /> Active</label>
      <button className="admin-submit" type="submit" disabled={pending}>{pending ? "Saving…" : "Save grade"}</button>
      <Feedback state={state} />
    </form>
  );
}

export function LearningAreaEditor({
  id,
  title,
  iconName,
  accentColor,
  description,
  isActive,
}: {
  id: string;
  title: string;
  iconName: string;
  accentColor: string;
  description: string;
  isActive: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveLearningArea, initialState);
  return (
    <form action={formAction} className="admin-form admin-form--area">
      <input type="hidden" name="id" value={id} />
      <div className="admin-field"><label htmlFor={`area-title-${id}`}>Title</label><input id={`area-title-${id}`} name="title" defaultValue={title} maxLength={100} required /></div>
      <div className="admin-field"><label htmlFor={`area-icon-${id}`}>Icon name</label><input id={`area-icon-${id}`} name="icon_name" defaultValue={iconName} maxLength={40} required /></div>
      <div className="admin-field"><label htmlFor={`area-color-${id}`}>Accent color</label><input id={`area-color-${id}`} name="accent_color" type="color" defaultValue={/^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : "#2563eb"} required /><small>{accentColor}</small></div>
      <div className="admin-field"><label htmlFor={`area-description-${id}`}>Illustration description</label><textarea id={`area-description-${id}`} name="description" defaultValue={description} maxLength={500} /></div>
      <label className="admin-check"><input type="checkbox" name="is_active" defaultChecked={isActive} /> Active</label>
      <button className="admin-submit" type="submit" disabled={pending}>{pending ? "Saving…" : "Save area"}</button>
      <Feedback state={state} />
    </form>
  );
}
