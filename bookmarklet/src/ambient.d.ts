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

declare const __VERSION__: string;
declare const __SERVER_BASE__: string;
declare const __CLIENT_SECRET__: string;
