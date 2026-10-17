import { Glyph } from './Glyph';

export function SearchField(props: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="search">
      <Glyph name="eye" />
      <input
        className="input"
        type="search"
        aria-label={props.placeholder}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}
