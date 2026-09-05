import documentEditorMd from "../../prose/algorithms/document-editor.md?raw";
import { Box, Diagram, Edge, Page } from "../../components/common";
import { Sections } from "../../components/Sections";

const Loop = () => (
  <Diagram viewBox="0 0 1180 330" caption="One keystroke. The editor's state changes first; the body is derived from it, the ops from the difference, and the runtime buffers them. A body arriving from the server is compared against what was last sent before anything is repainted.">
    <Box x={20} y={30} w={170} h={70} tone="client" title="keystroke" lines={["ProseMirror transaction"]} />
    <Box x={240} y={30} w={200} h={70} tone="client" title="dispatch → lay" lines={["stampIds · repaginate", "anchor the selection"]} mono />
    <Box x={490} y={30} w={210} h={70} tone="client" title="emit" lines={["bodyOf(doc, sent)", "translate(sent, body)"]} mono />
    <Box x={750} y={30} w={190} h={70} tone="active" title="runtime.apply(ops)" lines={["undo stack · buffer", "schedule flush"]} mono />
    <Box x={990} y={30} w={170} h={70} tone="server" title="submitDocumentChanges" lines={["leader · apply · write"]} mono />
    <Edge d="M 190 65 L 238 65" tone="strong" />
    <Edge d="M 440 65 L 488 65" tone="strong" />
    <Edge d="M 700 65 L 748 65" tone="strong" />
    <Edge d="M 940 65 L 988 65" tone="strong" label="after 50 ops · 2 s" lx={964} ly={20} />
    <Box x={750} y={190} w={190} h={70} tone="active" title="runtime.body" lines={["sync() re-reads the leader", "every 5 s when settled"]} />
    <Edge d="M 1075 100 L 1075 160 L 940 225" dashed />
    <Box x={240} y={190} w={460} h={70} tone="client" title="$effect: body !== painted" lines={["translate(sent, body).length === 0 → adopt silently", "otherwise paint(body): docOf → EditorState → sent = bodyOf"]} mono />
    <Edge d="M 750 225 L 702 225" dashed />
    <Edge d="M 330 190 L 330 100" dashed label="repaint only when it differs" lx={330} ly={150} />
    <text x={20} y={310} className="muted">
      truth: runtime.body · projection: EditorState.doc · input: ProseMirror · record: DocumentOp[]
    </text>
  </Diagram>
);

export const DocumentEditor = () => (
  <Page crumbs={[{ label: "Algorithms" }]} title="Document editor" lede="Document-first: the runtime body is the truth, ProseMirror is a projection and an input device, and every change is a list of ops.">
    <Sections markdown={documentEditorMd} after={{ "the-loop": <Loop /> }} />
  </Page>
);
