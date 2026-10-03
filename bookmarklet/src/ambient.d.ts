declare module "*.css" {
  const content: string;
  export default content;
}

declare module "*.html" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const dataUrl: string;
  export default dataUrl;
}
