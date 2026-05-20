// Type shim for the plotly.js/dist/plotly sub-path import used in Plot.tsx.
// The sub-path entry point isn't declared in @types/plotly.js, so we re-export
// everything from the main package types.
declare module 'plotly.js/dist/plotly' {
  export * from 'plotly.js'
  import Plotly from 'plotly.js'
  export default Plotly
}
