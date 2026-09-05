// Keep G6 behind a small lazy boundary so the large renderer is only loaded
// when the relationship graph is actually opened, while preserving tree-shaking.
export { CanvasEvent, EdgeEvent, Graph, GraphEvent, NodeEvent } from "@antv/g6";
export { Renderer as CanvasRenderer } from "@antv/g-canvas";
