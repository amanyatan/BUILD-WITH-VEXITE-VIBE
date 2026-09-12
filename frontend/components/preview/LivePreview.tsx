export function LivePreview() {
  return (
    <div className="h-full border-l bg-white">
      <iframe title="preview" className="w-full h-full border-0" srcDoc="<html><body><h1>Preview</h1></body></html>" />
    </div>
  );
}
