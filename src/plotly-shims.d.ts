// Ambient module declarations for the Plotly packages, which ship without
// bundled TypeScript types and have no installed @types package. These expose
// the type names and runtime methods the charting components use (as `any`) so
// the project type-checks instead of erroring on a missing declaration file.
declare module 'plotly.js' {
  export type Layout = any;
  export type Data = any;
  export type PlotData = any;
  export type Config = any;
  export type PlotlyHTMLElement = any;
}

declare module 'plotly.js-dist-min' {
  export type Layout = any;
  export type Data = any;
  export type PlotData = any;
  export type Config = any;
  export type PlotlyHTMLElement = any;
  export function react(...args: any[]): Promise<any>;
  export function newPlot(...args: any[]): Promise<any>;
  export function purge(...args: any[]): void;
  export function downloadImage(...args: any[]): Promise<any>;
  export function toImage(...args: any[]): Promise<any>;
  export const Icons: any;
  const Plotly: any;
  export default Plotly;
}

// Global `Plotly` type-namespace so namespace-qualified casts such as
// `arr as Plotly.Data[]` resolve regardless of the local import alias.
declare namespace Plotly {
  type Layout = any;
  type Data = any;
  type PlotData = any;
  type Config = any;
  type PlotlyHTMLElement = any;
}
