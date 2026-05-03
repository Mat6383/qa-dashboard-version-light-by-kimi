declare module 'yamljs' {
  const YAML: {
    load(path: string): any;
    parse(str: string): any;
    stringify(obj: any): string;
  };
  export default YAML;
}
