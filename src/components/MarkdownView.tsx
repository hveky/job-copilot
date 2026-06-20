import { renderMd } from "../lib/markdown";

// 预览/编辑二选一:editing=true 显示 textarea,否则渲染 Markdown。
export function MarkdownView(props: {
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  if (props.editing) {
    return (
      <textarea
        className="md-edit"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
      />
    );
  }
  if (!props.value) {
    return <div className="content empty">{props.placeholder}</div>;
  }
  return (
    <div
      className="content md-preview"
      dangerouslySetInnerHTML={{ __html: renderMd(props.value) }}
    />
  );
}
