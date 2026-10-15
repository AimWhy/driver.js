// The entries import their stylesheets for the bundler to extract; this keeps
// those imports type-safe without depending on vite/client's ambient types.
declare module "*.css" {}
